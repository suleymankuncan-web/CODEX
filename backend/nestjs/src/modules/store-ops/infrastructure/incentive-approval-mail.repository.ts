import { incentiveManagerRoleScopeSql } from "./incentive-manager-role-scope";
import { Injectable } from "@nestjs/common";
import { isEmail } from "class-validator";
import { DatabaseService } from "../../../shared/database/database.service";
import type { ApprovalMailEvent, ApprovalMailStage } from "./incentive-approval-mail-event";
import { companyPayrollPackagesSql, companyPayrollRowsSql } from "./incentive-company-payroll.sql";
import type { HrExportRow, HrPackageRow } from "./incentive-hr-handoff.repository";

export type ApprovalAudience = ApprovalMailStage;
export type ApprovalMailDelivery = { delivery_id: string; recipient: string; user_id: string | null; audience: ApprovalAudience };
const managerAuthority = `EXISTS(SELECT 1 FROM ops.user_role_assignment ura
  JOIN ops.role role ON role.role_id=ura.role_id AND role.role_code='REGION_MANAGER'
  JOIN ops.user_action_store_assignment assigned ON assigned.user_id=ura.user_id
  JOIN ops.store store ON store.store_id=assigned.store_id AND store.company_id=$1::uuid AND store.status='active'
  WHERE ura.user_id=account.user_id AND ura.start_at<=clock_timestamp() AND (ura.end_at IS NULL OR ura.end_at>clock_timestamp())
    AND assigned.start_at<=clock_timestamp() AND (assigned.end_at IS NULL OR assigned.end_at>clock_timestamp())
    AND ${incentiveManagerRoleScopeSql("store")})`;
const authority: Record<ApprovalAudience, string> = {
  region_manager: managerAuthority,
  sales_director: "ops.incentive_stage_authorized(account.user_id,$1::uuid,'sales_director')",
  hr: "(ops.incentive_stage_authorized(account.user_id,$1::uuid,'hr') OR ops.incentive_stage_authorized(account.user_id,$1::uuid,'payroll'))",
  general_manager: "ops.incentive_stage_authorized(account.user_id,$1::uuid,'general_manager')",
};

@Injectable()
export class IncentiveApprovalMailRepository {
  constructor(private readonly database: DatabaseService) {}

  async events() {
    return (await this.database.query<ApprovalMailEvent>(`SELECT event.* FROM ops.incentive_approval_mail_event event
      WHERE expanded_at IS NULL OR EXISTS(SELECT 1 FROM ops.incentive_approval_mail_delivery d WHERE d.event_id=event.event_id AND d.status='pending')
        OR (event.stage='general_manager' AND NOT EXISTS(SELECT 1 FROM ops.incentive_hr_delivery hr WHERE hr.company_id=event.company_id AND hr.period_key=event.period_key))
      ORDER BY attempted_at ASC NULLS FIRST,created_at,event_id LIMIT 100`)).rows;
  }

  async attempted(eventId: string) {
    await this.database.query("UPDATE ops.incentive_approval_mail_event SET attempted_at=clock_timestamp() WHERE event_id=$1::uuid",[eventId]);
  }

  async expand(event: ApprovalMailEvent, hrRecipients: string[]) {
    return this.database.withTransaction(async client => {
      const row = (await client.query<{ expanded_at: string | null }>("SELECT expanded_at FROM ops.incentive_approval_mail_event WHERE event_id=$1::uuid FOR UPDATE",[event.event_id])).rows[0];
      if (!row || row.expanded_at) return;
      const audiences: ApprovalAudience[] = event.stage === "region_manager" ? ["sales_director"] : event.stage === "sales_director" ? ["hr"] : event.stage === "hr" ? ["general_manager"] : ["region_manager","sales_director","hr"];
      const recipients = new Map<string, { userId: string | null; audience: ApprovalAudience }>();
      for (const audience of audiences) {
        const accounts = (await client.query<{ user_id: string; email: string }>(`SELECT account.user_id::text,account.email FROM ops.user_account account
          JOIN ops.company company ON company.company_id=$1::uuid AND company.status='active'
          WHERE account.is_active AND ${authority[audience]} ORDER BY account.user_id`,[event.company_id])).rows;
        for (const account of accounts) if (isEmail(account.email) && !recipients.has(account.email.toLowerCase())) {
          recipients.set(account.email.toLowerCase(),{ userId: account.user_id, audience });
        }
      }
      const mailboxesSafe = hrRecipients.length && (await client.query<{allowed:boolean}>("SELECT ops.incentive_mail_hr_recipient_allowed($1::uuid,$2::text[]) AS allowed",[event.company_id,hrRecipients])).rows[0]?.allowed;
      if (event.stage === "sales_director" && mailboxesSafe) for (const email of hrRecipients) recipients.set(email.toLowerCase(), { userId: null, audience: "hr" });
      // Final HR mailboxes get the same final notification with their private Excel, once.
      if (event.stage === "general_manager" && mailboxesSafe) for (const email of hrRecipients) {
        if (recipients.get(email.toLowerCase())?.audience === "hr") recipients.delete(email.toLowerCase());
      }
      if (!recipients.size && !(event.stage === "general_manager" && hrRecipients.length)) return;
      for (const [recipient, value] of recipients) await client.query(`INSERT INTO ops.incentive_approval_mail_delivery(event_id,user_id,audience,recipient)
        VALUES($1::uuid,$2::uuid,$3,$4) ON CONFLICT(event_id,recipient) DO NOTHING`,[event.event_id,value.userId,value.audience,recipient]);
      await client.query("UPDATE ops.incentive_approval_mail_event SET expanded_at=clock_timestamp() WHERE event_id=$1::uuid",[event.event_id]);
    });
  }

  async pending(eventId: string) {
    return (await this.database.query<ApprovalMailDelivery>("SELECT delivery_id::text,recipient,user_id::text,audience FROM ops.incentive_approval_mail_delivery WHERE event_id=$1::uuid AND status='pending' ORDER BY delivery_id",[eventId])).rows;
  }

  async claim(event: ApprovalMailEvent, delivery: ApprovalMailDelivery, hrRecipients: string[]) {
    const allowed = delivery.user_id
      ? (await this.database.query<{ allowed: boolean }>(`SELECT account.is_active AND lower(account.email)=$3 AND ${authority[delivery.audience]} AS allowed
          FROM ops.user_account account JOIN ops.company company ON company.company_id=$1::uuid AND company.status='active'
          WHERE account.user_id=$2::uuid`,[event.company_id,delivery.user_id,delivery.recipient])).rows[0]?.allowed
      : delivery.audience === "hr" && hrRecipients.map(e => e.toLowerCase()).includes(delivery.recipient) && await this.hrMailboxSafe(event.company_id,[delivery.recipient]);
    if (!allowed) {
      await this.database.query("UPDATE ops.incentive_approval_mail_delivery SET status='cancelled' WHERE delivery_id=$1::uuid AND status='pending'",[delivery.delivery_id]);
      return false;
    }
    return Boolean((await this.database.query(`UPDATE ops.incentive_approval_mail_delivery SET status='sending',claimed_at=clock_timestamp()
      WHERE delivery_id=$1::uuid AND status='pending' RETURNING delivery_id`,[delivery.delivery_id])).rows.length);
  }

  async finishNotice(id: string, status: "sent" | "uncertain" | "pending" | "cancelled", messageId: string | null = null) {
    await this.database.query(`UPDATE ops.incentive_approval_mail_delivery SET status=$2,smtp_message_id=$3,
      sent_at=CASE WHEN $2='sent' THEN clock_timestamp() ELSE NULL END WHERE delivery_id=$1::uuid AND status IN ('sending','pending')`,[id,status,messageId]);
  }

  async abandon() {
    await this.database.query("UPDATE ops.incentive_approval_mail_delivery SET status='uncertain' WHERE status='sending' AND claimed_at<clock_timestamp()-INTERVAL '5 minutes'");
    await this.database.query("UPDATE ops.incentive_hr_delivery SET status='uncertain',updated_at=clock_timestamp() WHERE delivery_origin='gm_final' AND status='sending' AND created_at<clock_timestamp()-INTERVAL '5 minutes'");
  }

  async hrMailboxSafe(companyId: string, emails: string[]) {
    if (!emails.length || !emails.every(email => isEmail(email))) return false;
    const result = await this.database.query<{allowed:boolean}>("SELECT ops.incentive_mail_hr_recipient_allowed($1::uuid,$2::text[]) AS allowed",[companyId,emails]);
    return result.rows[0]?.allowed === true;
  }

  async finalSnapshot(event: ApprovalMailEvent) {
    return this.database.withTransaction(async client => {
      await client.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY");
      const proof = await client.query(`SELECT 1 FROM ops.incentive_company_cycle c JOIN ops.incentive_company_decision d ON d.cycle_id=c.cycle_id
        WHERE c.company_id=$1::uuid AND c.period_key=$2 AND c.cycle_id=$3::uuid AND c.stage='final' AND c.current_revision=$4
          AND d.revision_no=$4 AND d.seal_hash=$5 AND d.stage='general_manager' AND d.decision='approve' AND d.actor_user_id=$6::uuid`,
      [event.company_id,event.period_key,event.cycle_id,event.revision_no,event.seal_hash,event.actor_user_id]);
      if (!proof.rows.length) throw new Error("incentive_mail_final_proof_missing");
      return {
        packages: (await client.query<HrPackageRow>(companyPayrollPackagesSql,[event.period_key,[event.company_id]])).rows,
        rows: (await client.query<HrExportRow>(companyPayrollRowsSql,[event.period_key,[event.company_id]])).rows,
      };
    });
  }

  async claimFinalHr(event: ApprovalMailEvent, recipients: string[], sha256: string) {
    return this.database.withTransaction(async client => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)",[`incentive-hr:${event.period_key}:${event.company_id}`]);
      const old = await client.query("SELECT delivery_id FROM ops.incentive_hr_delivery WHERE company_id=$1::uuid AND period_key=$2",[event.company_id,event.period_key]);
      if (old.rows.length) return null;
      const row = await client.query<{ delivery_id: string }>(`INSERT INTO ops.incentive_hr_delivery(company_id,period_key,created_by_user_id,preview_version,recipients,
        attachment_sha256,final_cycle_id,final_revision_no,final_seal_hash,delivery_origin)
        VALUES($1::uuid,$2,$3::uuid,$4,$5::text[],$4,$6::uuid,$7,$8,'gm_final') RETURNING delivery_id::text`,
      [event.company_id,event.period_key,event.actor_user_id,sha256,recipients,event.cycle_id,event.revision_no,event.seal_hash]);
      await client.query(`INSERT INTO audit.event_log(actor_user_id,event_type,entity_name,entity_id,scope_type,company_id,metadata_json)
        VALUES($1::uuid,'incentive_hr.gm_final_delivery_started','ops.incentive_hr_delivery',$2::uuid,'company',$3::uuid,$4::jsonb)`,
      [event.actor_user_id,row.rows[0].delivery_id,event.company_id,JSON.stringify({eventId:event.event_id,period:event.period_key,attachmentSha256:sha256})]);
      return row.rows[0].delivery_id;
    });
  }
}
