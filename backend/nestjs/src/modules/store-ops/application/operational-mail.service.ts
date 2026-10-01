import { assertOperationalMailAttachment } from "../infrastructure/operational-mail-attachment";
import { buildPersonnelRosterMailWorkbook } from "./personnel-roster-mail-workbook";
import { istanbulClock } from "../../../shared/mail/pilot-periods";
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "node:crypto";
import { workflowMailContent } from "../../../shared/mail/workflow.templates";
import { workflowMailLink, workflowMailOrigin } from "../../../shared/mail/workflow-mail-link";
import { OperationalMailRepository } from "../infrastructure/operational-mail.repository";
import { OperationalMailSource, type OperationalSource } from "../infrastructure/operational-mail-source";
import { DefiniteOperationalMailRejection, OperationalMailer } from "../infrastructure/operational-mailer";
import type { OperationalMailEvent } from "../infrastructure/operational-mail.types";
import { StoreMonthlyReportPackageService } from "./store-monthly-report-package.service";
import { OperationalMailScheduler } from "../infrastructure/operational-mail-scheduler.repository";

@Injectable()
export class OperationalMailService implements OnModuleInit,OnModuleDestroy {
  private readonly logger=new Logger(OperationalMailService.name);
  private timer:NodeJS.Timeout|null=null;
  private running=false;
  constructor(private readonly repository:OperationalMailRepository,private readonly source:OperationalMailSource,
    private readonly scheduler:OperationalMailScheduler,private readonly reports:StoreMonthlyReportPackageService,
    private readonly mailer:OperationalMailer,private readonly config:ConfigService) {}
  private streams() {
    return ([['OPERATIONAL_MAIL_ENABLED','operational'],['OPERATIONAL_WEEKLY_REPORT_EMAIL_ENABLED','weekly'],['OPERATIONAL_MONTHLY_REPORT_EMAIL_ENABLED','monthly'],['OPERATIONAL_PERSONNEL_ROSTER_EMAIL_ENABLED','personnel']])
      .filter(([key])=>this.config.get<string>(key)==='true').map(([,stream])=>stream);
  }
  onModuleInit() {if(!this.streams().length) return;this.timer=setInterval(()=>void this.runOnce(),60_000);this.timer.unref?.();void this.runOnce();}
  onModuleDestroy() {if(this.timer) clearInterval(this.timer);this.timer=null;}
  async runOnce() {
    const streams=this.streams(),origin=workflowMailOrigin(this.config);
    if(this.running || !streams.length) return;
    this.running=true;
    try {
      for(const stream of streams) await this.repository.activate(stream as 'operational'|'weekly'|'monthly'|'personnel');
      await this.scheduler.schedule(streams);
      if(!origin || !this.mailer.ready()) {this.logger.warn('operational_mail.configuration_incomplete');return;}
      try {await this.mailer.verify();} catch {this.logger.warn('operational_mail.smtp_preflight_failed');return;}
      await this.repository.abandon();
      for(const event of await this.repository.events(streams)) {
        try {await this.deliver(event,origin);} catch {this.logger.warn('operational_mail.event_pending');}
      }
    } catch {this.logger.warn('operational_mail.poll_failed');} finally {this.running=false;}
  }
  private async deliver(event:OperationalMailEvent,origin:string) {
    await this.repository.attempted(event.event_id);
    const initial=await this.source.resolve(event);if(!initial) {await this.repository.suppress(event.event_id);return;}
    await this.repository.expand(event,initial.recipients,initial.complete);
    if(!initial.complete) this.logger.warn('operational_mail.recipient_configuration_incomplete');
    const roster=event.kind==='personnel_roster' ? buildPersonnelRosterMailWorkbook(await this.repository.personnelRoster(istanbulClock().date),String(event.payload.period)) : undefined;
    for(const delivery of await this.repository.pending(event.event_id)) {
      let current=await this.source.resolve(event);
      if(!current?.recipients.some(r=>r.recipient===delivery.recipient && r.audience===delivery.audience && r.user_id===delivery.user_id)) {
        await this.repository.finish(delivery.delivery_id,'cancelled');continue;
      }
      const report=roster ?? (current.reportManager ? await this.report(event,current) : undefined);
      if(report && !roster) {
        const before=current.reportManager!;current=await this.source.resolve(event);
        if(!current?.reportManager || current.reportManager.email!==delivery.recipient
          || current.reportManager.store_ids.join(',')!==before.store_ids.join(',')) {await this.repository.finish(delivery.delivery_id,'cancelled');continue;}
      }
      const content=workflowMailContent({...current.content,...(roster ? {rosterTotal:roster.total,rosterActive:roster.active,rosterPassive:roster.passive} : {}),url:workflowMailLink(origin,event)});
      if(report) assertOperationalMailAttachment(delivery.recipient,report);
      const sha=report ? createHash('sha256').update(report.buffer).digest('hex') : null;
      if(!await this.repository.claim(delivery.delivery_id,sha)) continue;
      try {const id=await this.mailer.send({recipient:delivery.recipient,deliveryId:delivery.delivery_id,content,report});
        await this.repository.finish(delivery.delivery_id,'sent',id);
      } catch(error) {await this.repository.finish(delivery.delivery_id,error instanceof DefiniteOperationalMailRejection ? 'pending' : 'uncertain');
        this.logger.warn('operational_mail.delivery_not_confirmed');}
    }
  }
  private async report(event:OperationalMailEvent,source:OperationalSource) {
    const manager=source.reportManager!;const start=String(event.payload.start),end=String(event.payload.end);
    const input={period:end.slice(0,7),companyIds:[],regionIds:[],storeIds:manager.store_ids,
      rankingContext:{userId:manager.user_id,roleCodes:['REGION_MANAGER'],companyIds:manager.company_ids,regionIds:[],storeIds:manager.store_ids,assignedStoreIds:manager.store_ids}};
    return event.kind==='weekly_report' ? this.reports.buildWeeklyWorkbook({...input,periodStart:start,periodEnd:end}) : this.reports.buildWorkbook(input);
  }
}
