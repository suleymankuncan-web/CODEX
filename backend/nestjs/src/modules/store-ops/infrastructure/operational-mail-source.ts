import { readVisitPlanMail,visitPlanRecipient,type VisitPlanMailData } from "./visit-plan-mail-read";
import { personnelRosterRecipients } from "../../../shared/mail/personnel-roster-recipients";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { isEmail } from "class-validator";
import { DatabaseService } from "../../../shared/database/database.service";
import { istanbulClock, reminderBand } from "../../../shared/mail/pilot-periods";
import { workflowMailContent } from "../../../shared/mail/workflow.templates";
import { operationalReportManagers, operationalRoleScopeSql, operationalStoreRolesSql } from "./operational-mail-scope";
import type { OperationalMailEvent, OperationalRecipient, OperationalReportManager } from "./operational-mail.types";

type ContentInput=Parameters<typeof workflowMailContent>[0];
export type OperationalSource={recipients:OperationalRecipient[];complete:boolean;content:Omit<ContentInput,"url">;reportManager?:OperationalReportManager;visitPlan?:VisitPlanMailData};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const missingTargetSql=`NOT EXISTS(SELECT 1 FROM ops.target_distribution_request target
  WHERE target.store_id=store.store_id AND target.company_id=store.company_id
    AND target.request_month=$1::date AND target.request_status IN ('pending_region_approval','approved'))`;
const activeStoreSql=`FROM ops.store store JOIN ops.company company ON company.company_id=store.company_id AND company.status='active'
  WHERE store.status='active'`;

@Injectable()
export class OperationalMailSource {
  constructor(private readonly db:DatabaseService,private readonly config:ConfigService) {}
  async resolve(event:OperationalMailEvent,now=new Date()):Promise<OperationalSource|null> {
    const content:OperationalSource["content"]={kind:event.kind};
    if(event.kind==='visit_plan_created') {
      const visitPlan=await readVisitPlanMail(this.db,event,now);if(!visitPlan)return null;
      return {...this.result([{recipient:visitPlanRecipient,audience:'visit_plan',user_id:null}],true,
        {kind:event.kind,name:visitPlan.managerName,range:visitPlan.weekStart}),visitPlan};
    }
    if(event.kind==='personnel_roster') {
      const period=String(event.payload.period ?? '');if(period!==istanbulClock(now).date.slice(0,7))return null;
      return this.result(personnelRosterRecipients.map(recipient=>({recipient,audience:'personnel_roster',user_id:null})),true,{kind:event.kind,period});
    }
    if(event.kind==='weekly_report' || event.kind==='monthly_report') return this.report(event,content);
    if(event.kind==='target_missing_digest') return this.digest(event,content);
    if(!event.store_id || !event.company_id) return null;
    const store=(await this.db.query<{store_name:string}>(`SELECT store.store_name ${activeStoreSql}
      AND store.store_id=$1::uuid AND store.company_id=$2::uuid`,[event.store_id,event.company_id])).rows[0];
    if(!store) return null;
    content.storeName=store.store_name;
    const roles=(await this.db.query<{user_id:string;email:string;role_code:string}>(operationalStoreRolesSql,[event.store_id])).rows.filter(r=>isEmail(r.email));
    if(event.kind==='target_missing' || event.kind==='target_submitted') {
      const period=String(event.payload.period ?? '');if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) return null;
      content.period=period;
      if(event.kind==='target_missing') {
        if(istanbulClock(now).date.slice(0,7)!==period) return null;
        const missing=(await this.db.query(`SELECT 1 ${activeStoreSql} AND store.store_id=$2::uuid AND ${missingTargetSql}`,[`${period}-01`,event.store_id])).rows.length;
        if(!missing) return null;
      } else {
        const valid=(await this.db.query(`SELECT 1 FROM ops.target_distribution_request WHERE target_distribution_request_id=$1::uuid
          AND store_id=$2::uuid AND company_id=$3::uuid AND to_char(request_month,'YYYY-MM')=$4 AND request_status IN ('pending_region_approval','approved')`,
        [event.entity_id,event.store_id,event.company_id,period])).rows.length;
        if(!valid) return null;
        // The historical event confirms submission; do not claim approval is still pending.
      }
      const recipients=roles.filter(r=>r.role_code==='REGION_MANAGER').map(r=>({recipient:r.email,user_id:r.user_id,audience:'region_manager' as const}));
      const mailbox=event.kind==='target_missing' ? await this.mailbox(event) : [];
      return this.result([...recipients,...mailbox],Boolean(recipients.length) && (event.kind!=='target_missing' || Boolean(mailbox.length)),content);
    }
    if(event.kind==='entry_requested' || event.kind==='exit_requested') {
      const sql=event.kind==='entry_requested' ? `SELECT first_name||' '||last_name AS name,to_char(requested_hire_date,'DD.MM.YYYY') AS date,requested_seller_code AS code
        FROM ops.seller_code_request WHERE seller_code_request_id=$1::uuid AND store_id=$2::uuid AND company_id=$3::uuid AND request_status='pending_hr_approval'`
        : `SELECT employee.first_name||' '||employee.last_name AS name,to_char(request.requested_termination_date,'DD.MM.YYYY') AS date,employee.external_employee_ref AS code
        FROM ops.employee_offboarding_request request JOIN ops.employee employee USING(employee_id)
        WHERE request.offboarding_request_id=$1::uuid AND request.store_id=$2::uuid AND request.company_id=$3::uuid AND request.request_status='pending_hr_approval'`;
      const detail=(await this.db.query<{name:string;date:string;code?:string}>(sql,[event.entity_id,event.store_id,event.company_id])).rows[0];
      if(!detail) return null;Object.assign(content,detail);
      const recipients=await this.hr(event);return this.result(recipients,Boolean(recipients.length),content);
    }
    const checklistId=String(event.payload.checklistId ?? '');if(!uuid.test(checklistId)) return null;
    const checklist=(await this.db.query<{author_id:string|null;title:string;date:string}>(`SELECT ci.completed_by_user_id AS author_id,
      template.template_name AS title,to_char(ci.completed_at AT TIME ZONE 'Europe/Istanbul','DD.MM.YYYY HH24:MI') AS date
      FROM ops.checklist_instance ci JOIN ops.checklist_template template USING(checklist_template_id)
      WHERE ci.checklist_instance_id=$1::uuid AND ci.store_id=$2::uuid AND ci.status='completed'`,[checklistId,event.store_id])).rows[0];
    if(!checklist) return null;
    content.checklistName=checklist.title;content.date=checklist.date;
    if(event.kind!=='checklist_completed') {
      const ids=Array.isArray(event.payload.actionIds) ? event.payload.actionIds.filter((v):v is string=>typeof v==='string' && uuid.test(v)) : [];
      if(!ids.length) return null;
      const actions=(await this.db.query<{status:string;due_on:string;title:string}>(`SELECT status,to_char(due_on,'YYYY-MM-DD') AS due_on,title
        FROM ops.store_action_plan WHERE store_action_plan_id=ANY($1::uuid[]) AND store_id=$2::uuid AND company_id=$3::uuid
          AND source_type='checklist_remediation' AND split_part(source_id,':',2)=$4`,[ids,event.store_id,event.company_id,checklistId])).rows;
      if(!actions.length) return null;
      if(event.kind==='action_closed' && actions.some(a=>a.status!=='closed')) return null;
      if(event.kind==='actions_assigned') {
        const open=actions.filter(a=>!['closed','cancelled'].includes(a.status));if(!open.length) return null;
        content.actionCount=open.length;
      }
      if(event.kind==='action_reminder') {
        const action=actions[0];if(actions.length!==1 || ['closed','cancelled'].includes(action.status)) return null;
        const today=istanbulClock(now).date;
        if(action.due_on!==event.payload.dueOn || reminderBand(action.due_on,today)!==event.payload.band
          || (action.status==='solution_review_pending')!==Boolean(event.payload.reviewPending)) return null;
        content.daysLeft=Math.round((Date.parse(action.due_on)-Date.parse(today))/86_400_000);
        content.reviewPending=action.status==='solution_review_pending';
      }
    }
    const author=roles.filter(r=>r.role_code==='REGION_MANAGER' && r.user_id===checklist.author_id)
      .map(r=>({recipient:r.email,user_id:r.user_id,audience:'author_bm' as const}));
    if(content.reviewPending) {
      const reviewers=roles.filter(r=>r.role_code==='REGION_MANAGER').map(r=>({recipient:r.email,user_id:r.user_id,audience:'region_manager' as const}));
      return this.result(reviewers,Boolean(reviewers.length),content);
    }
    const managers=roles.filter(r=>r.role_code==='STORE_MANAGER').map(r=>({recipient:r.email,user_id:r.user_id,audience:'store_manager' as const}));
    const mailbox=await this.mailbox(event);
    return this.result([...author,...managers,...mailbox],Boolean(author.length && managers.length && mailbox.length),content);
  }
  private result(recipients:OperationalRecipient[],complete:boolean,content:OperationalSource['content'],reportManager?:OperationalReportManager):OperationalSource {
    const seen=new Set<string>();const valid=recipients.filter(r=>isEmail(r.recipient)).map(r=>({...r,recipient:r.recipient.trim().toLowerCase()}))
      .filter(r=>{if(seen.has(r.recipient)) return false;seen.add(r.recipient);return true;});
    return {recipients:valid,complete:complete && valid.length>0,content,reportManager};
  }
  private async mailbox(event:OperationalMailEvent):Promise<OperationalRecipient[]> {
    return (await this.db.query<{recipient:string}>(`SELECT normalized_email AS recipient FROM ops.store_contact_email
      WHERE store_id=$1::uuid AND company_id=$2::uuid AND is_active AND is_primary`,[event.store_id,event.company_id])).rows
      .map(r=>({...r,user_id:null,audience:'store_mailbox'}));
  }
  private async hr(event:OperationalMailEvent):Promise<OperationalRecipient[]> {
    let mapping:unknown;try {mapping=JSON.parse(this.config.get<string>('OPERATIONAL_HR_RECIPIENTS_JSON') || this.config.get<string>('INCENTIVE_HR_RECIPIENTS_JSON') || '{}');} catch {return [];}
    if(!mapping || typeof mapping!=='object' || Array.isArray(mapping)) return [];
    const emails=(mapping as Record<string,unknown>)[event.company_id!];if(!Array.isArray(emails)) return [];
    const recipients:OperationalRecipient[]=[];
    for(const raw of emails) {
      if(typeof raw!=='string' || !isEmail(raw)) continue;const recipient=raw.trim().toLowerCase();
      const accounts=(await this.db.query<{user_id:string;allowed:boolean}>(`SELECT account.user_id::text,account.is_active AND EXISTS(
        SELECT 1 FROM ops.user_role_assignment ura JOIN ops.role role ON role.role_id=ura.role_id AND role.role_code='HR_ADMIN'
        JOIN ops.store store ON store.store_id=$2::uuid WHERE ura.user_id=account.user_id AND ${operationalRoleScopeSql}) AS allowed
        FROM ops.user_account account WHERE lower(account.email)=$1`,[recipient,event.store_id])).rows;
      if(accounts.length && accounts.some(a=>!a.allowed)) continue;
      recipients.push({recipient,user_id:accounts[0]?.user_id ?? null,audience:'hr'});
    }
    return recipients;
  }
  private async digest(event:OperationalMailEvent,content:OperationalSource['content']):Promise<OperationalSource|null> {
    const period=String(event.payload.period ?? '');if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(period) || period!==istanbulClock().date.slice(0,7)) return null;
    const owner=this.config.get<string>('OPERATIONAL_TARGET_OWNER_EMAIL')?.trim().toLowerCase();if(!owner || !isEmail(owner)) return this.result([],false,content);
    const account=(await this.db.query<{user_id:string}>(`SELECT account.user_id::text FROM ops.user_account account
      WHERE account.is_active AND lower(account.email)=$1 AND EXISTS(SELECT 1 FROM ops.user_role_assignment ura
        JOIN ops.role role ON role.role_id=ura.role_id AND role.role_code='SUPER_ADMIN' WHERE ura.user_id=account.user_id
          AND ura.start_at<=clock_timestamp() AND (ura.end_at IS NULL OR ura.end_at>clock_timestamp()))`,[owner])).rows[0];
    if(!account) return this.result([],false,content);
    const stores=(await this.db.query<{store_name:string}>(`SELECT store.store_name ${activeStoreSql}
      AND ${missingTargetSql} AND EXISTS(SELECT 1 FROM ops.user_account account_check WHERE account_check.is_active AND lower(account_check.email)=$2)
      AND EXISTS(SELECT 1 FROM ops.user_role_assignment ura JOIN ops.role role ON role.role_id=ura.role_id AND role.role_code='SUPER_ADMIN'
        JOIN ops.user_account account ON account.user_id=ura.user_id AND account.is_active AND lower(account.email)=$2 WHERE ${operationalRoleScopeSql})
      ORDER BY store.store_name`,[`${period}-01`,owner])).rows;
    // Resolve the configured owner separately; never expose another company's missing stores.
    if(!stores.length) return null;
    content.period=period;content.missingStores=stores.map(s=>s.store_name);
    return this.result([{recipient:owner,user_id:account.user_id,audience:'owner'}],true,content);
  }
  private async report(event:OperationalMailEvent,content:OperationalSource['content']):Promise<OperationalSource|null> {
    const userId=String(event.payload.userId ?? '');if(!uuid.test(userId)) return null;
    const manager=(await operationalReportManagers(this.db,userId))[0];if(!manager) return null;
    const start=String(event.payload.start ?? ''),end=String(event.payload.end ?? '');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return null;
    if(event.kind==='monthly_report' && !await this.monthClosed(start,end,manager.company_ids)) return null;
    content.period=end.slice(0,7);content.range=`${start} – ${end}`;
    return this.result([{recipient:manager.email,user_id:manager.user_id,audience:'region_manager'}],true,content,manager);
  }
  async monthClosed(start:string,end:string,companies:string[]) {
    const rows=(await this.db.query<{company_id:string}>(`SELECT scope.company_id::text FROM unnest($3::uuid[]) scope(company_id)
      WHERE EXISTS(SELECT 1 FROM rpt.snapshot_run run JOIN ops.operational_mail_activation activation ON activation.stream='monthly'
        WHERE run.snapshot_type='monthly' AND run.run_status='completed' AND run.period_start=$1::date AND run.period_end=$2::date
          AND COALESCE(run.finished_at,run.generated_at)>=activation.activated_at
          AND (cardinality(run.company_ids)=0 OR scope.company_id=ANY(run.company_ids)))`,[start,end,companies])).rows;
    return companies.length>0 && rows.length===companies.length;
  }
}
