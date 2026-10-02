import { readPersonnelRosterForMail } from "./personnel-roster-mail-read";
import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";
import type { OperationalDelivery, OperationalMailEvent, OperationalRecipient } from "./operational-mail.types";

@Injectable()
export class OperationalMailRepository {
  constructor(private readonly db:DatabaseService) {}
  async activate(stream:"operational"|"weekly"|"monthly"|"personnel"|"visit_plans") {
    await this.db.query("INSERT INTO ops.operational_mail_activation(stream) VALUES($1) ON CONFLICT DO NOTHING",[stream]);
  }
  async enqueue(input: {key:string;kind:OperationalMailEvent["kind"];companyId?:string;storeId?:string;entityId?:string;payload:Record<string,unknown>}) {
    await this.db.query(`INSERT INTO ops.operational_mail_event(event_key,kind,company_id,store_id,entity_id,payload)
      VALUES($1,$2,$3::uuid,$4::uuid,$5,$6::jsonb) ON CONFLICT(event_key) DO NOTHING`,
    [input.key,input.kind,input.companyId ?? null,input.storeId ?? null,input.entityId ?? null,JSON.stringify(input.payload)]);
  }
  async events(streams:string[]) {
    return (await this.db.query<OperationalMailEvent>(`SELECT event.* FROM ops.operational_mail_event event
      JOIN ops.operational_mail_activation activation ON activation.stream=CASE event.kind
        WHEN 'visit_plan_created' THEN 'visit_plans' WHEN 'personnel_roster' THEN 'personnel' WHEN 'weekly_report' THEN 'weekly' WHEN 'monthly_report' THEN 'monthly' ELSE 'operational' END
      WHERE activation.stream=ANY($1::text[]) AND event.created_at>=activation.activated_at
        AND event.available_at<=clock_timestamp() AND (event.expanded_at IS NULL OR EXISTS(
          SELECT 1 FROM ops.operational_mail_delivery delivery WHERE delivery.event_id=event.event_id AND delivery.status='pending'))
      ORDER BY event.attempted_at ASC NULLS FIRST,event.created_at LIMIT 100`,[streams])).rows;
  }
  personnelRoster(asOf:string) { return readPersonnelRosterForMail(this.db,asOf); }
  async attempted(eventId:string) {
    await this.db.query("UPDATE ops.operational_mail_event SET attempted_at=clock_timestamp() WHERE event_id=$1::uuid",[eventId]);
  }
  async expand(event:OperationalMailEvent,recipients:OperationalRecipient[],complete:boolean) {
    await this.db.withTransaction(async client=>{
      if(event.kind==='actions_assigned') {
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1)::bigint)',[`operational-mail-actions:${event.payload.checklistId}`]);
        const current=await client.query('SELECT 1 FROM ops.operational_mail_event WHERE event_id=$1::uuid AND payload=$2::jsonb FOR UPDATE',[event.event_id,JSON.stringify(event.payload)]);
        if(!current.rows.length) throw new Error('operational_mail_action_batch_changed');
      }
      for(const recipient of recipients) await client.query(`INSERT INTO ops.operational_mail_delivery(event_id,recipient,audience,user_id)
        VALUES($1::uuid,$2,$3,$4::uuid) ON CONFLICT(event_id,recipient) DO NOTHING`,
      [event.event_id,recipient.recipient,recipient.audience,recipient.user_id]);
      await client.query(`UPDATE ops.operational_mail_event SET attempted_at=clock_timestamp(),
        expanded_at=CASE WHEN $2 THEN COALESCE(expanded_at,clock_timestamp()) ELSE NULL END WHERE event_id=$1::uuid`,[event.event_id,complete]);
    });
  }
  async pending(id:string) {
    return (await this.db.query<OperationalDelivery>("SELECT delivery_id::text,recipient,audience,user_id::text FROM ops.operational_mail_delivery WHERE event_id=$1::uuid AND status='pending' ORDER BY delivery_id",[id])).rows;
  }
  async claim(id:string,sha256:string|null=null) {
    return Boolean((await this.db.query(`UPDATE ops.operational_mail_delivery SET status='sending',claimed_at=clock_timestamp(),attachment_sha256=$2
      WHERE delivery_id=$1::uuid AND status='pending' RETURNING delivery_id`,[id,sha256])).rows.length);
  }
  async finish(id:string,status:"sent"|"uncertain"|"pending"|"cancelled",messageId:string|null=null) {
    await this.db.query(`UPDATE ops.operational_mail_delivery SET status=$2,smtp_message_id=$3,
      sent_at=CASE WHEN $2='sent' THEN clock_timestamp() ELSE NULL END WHERE delivery_id=$1::uuid AND status IN ('pending','sending')`,[id,status,messageId]);
  }
  async suppress(eventId:string) {
    await this.db.query("UPDATE ops.operational_mail_delivery SET status='cancelled' WHERE event_id=$1::uuid AND status='pending'",[eventId]);
    await this.db.query("UPDATE ops.operational_mail_event SET expanded_at=clock_timestamp(),attempted_at=clock_timestamp() WHERE event_id=$1::uuid",[eventId]);
  }
  async abandon() {
    await this.db.query("UPDATE ops.operational_mail_delivery SET status='uncertain' WHERE status='sending' AND claimed_at<clock_timestamp()-INTERVAL '5 minutes'");
  }
}
