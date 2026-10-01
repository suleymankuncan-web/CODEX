import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";
import { istanbulClock, previousWeek, reminderBand } from "../../../shared/mail/pilot-periods";
import { OperationalMailRepository } from "./operational-mail.repository";
import { OperationalMailSource, missingTargetSql } from "./operational-mail-source";
import { operationalReportManagers } from "./operational-mail-scope";

@Injectable()
export class OperationalMailScheduler {
  constructor(private readonly db:DatabaseService,private readonly repository:OperationalMailRepository,private readonly source:OperationalMailSource) {}
  async schedule(streams:string[],now=new Date()) {
    const clock=istanbulClock(now);
    if(streams.includes('operational') && clock.hour>=9) {
      await this.reminders(clock.date);
      if(Number(clock.date.slice(8))>=10) await this.targets(clock.date.slice(0,7));
    }
    if(streams.includes('weekly')) {
      const week=previousWeek(now);
      if(week.due) for(const manager of await operationalReportManagers(this.db)) {
        await this.repository.enqueue({key:`weekly:${manager.user_id}:${week.start}`,kind:'weekly_report',entityId:manager.user_id,
          payload:{userId:manager.user_id,start:week.start,end:week.end}});
      }
    }
    if(streams.includes('personnel') && (Number(clock.date.slice(8))>1 || clock.hour>=9)) await this.repository.enqueue({key:`personnel-roster:${clock.date.slice(0,7)}`,
      kind:'personnel_roster',payload:{period:clock.date.slice(0,7)}});
    if(streams.includes('monthly')) await this.monthly(clock.date);
  }
  private async reminders(today:string) {
    const actions=(await this.db.query<{id:string;company_id:string;store_id:string;source_id:string;due_on:string;status:string}>(`SELECT
      action.store_action_plan_id::text AS id,action.company_id::text,action.store_id::text,action.source_id,to_char(action.due_on,'YYYY-MM-DD') AS due_on,action.status
      FROM ops.store_action_plan action JOIN ops.store store ON store.store_id=action.store_id AND store.company_id=action.company_id AND store.status='active'
      JOIN ops.company company ON company.company_id=store.company_id AND company.status='active'
      WHERE action.source_type='checklist_remediation' AND action.status IN ('open','in_progress','blocked','correction_required','solution_review_pending')
        AND action.due_on<=$1::date+5 AND action.source_id ~ '^checklist:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}:item:'`,[today])).rows;
    for(const action of actions) {
      const band=reminderBand(action.due_on,today);if(!band) continue;
      const reviewPending=action.status==='solution_review_pending';
      await this.repository.enqueue({key:`reminder:${action.id}:${action.due_on}:${band}:${reviewPending}`,kind:'action_reminder',
        companyId:action.company_id,storeId:action.store_id,entityId:action.id,
        payload:{checklistId:action.source_id.split(':')[1],actionIds:[action.id],dueOn:action.due_on,band,reviewPending}});
    }
  }
  private async targets(period:string) {
    const stores=(await this.db.query<{store_id:string;company_id:string}>(`SELECT store.store_id::text,store.company_id::text FROM ops.store store
      JOIN ops.company company ON company.company_id=store.company_id AND company.status='active'
      WHERE store.status='active' AND ${missingTargetSql}`,[`${period}-01`])).rows;
    for(const store of stores) await this.repository.enqueue({key:`target-missing:${store.store_id}:${period}`,kind:'target_missing',
      companyId:store.company_id,storeId:store.store_id,payload:{period}});
    if(stores.length) await this.repository.enqueue({key:`target-missing-digest:${period}`,kind:'target_missing_digest',payload:{period}});
  }
  private async monthly(today:string) {
    const periods=(await this.db.query<{start:string;end:string}>(`SELECT DISTINCT to_char(run.period_start,'YYYY-MM-DD') AS start,to_char(run.period_end,'YYYY-MM-DD') AS end
      FROM rpt.snapshot_run run JOIN ops.operational_mail_activation activation ON activation.stream='monthly'
      WHERE run.snapshot_type='monthly' AND run.run_status='completed' AND COALESCE(run.finished_at,run.generated_at)>=activation.activated_at
        AND run.period_start=date_trunc('month',run.period_start)::date
        AND run.period_end=(date_trunc('month',run.period_start)+INTERVAL '1 month - 1 day')::date AND run.period_end<$1::date
      ORDER BY start DESC LIMIT 24`,[today])).rows;
    if(!periods.length) return;
    for(const manager of await operationalReportManagers(this.db)) for(const period of periods) {
      if(!await this.source.monthClosed(period.start,period.end,manager.company_ids)) continue;
      await this.repository.enqueue({key:`monthly:${manager.user_id}:${period.start}`,kind:'monthly_report',entityId:manager.user_id,
        payload:{userId:manager.user_id,...period}});
    }
  }
}
