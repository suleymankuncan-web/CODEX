import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "node:crypto";
import { incentiveApprovalContent } from "../../../shared/mail/operational.templates";
import { IncentiveApprovalMailRepository } from "../infrastructure/incentive-approval-mail.repository";
import { incentiveMailOrigin, incentiveMailLink } from "../../../shared/mail/incentive-mail-link";
import { DefiniteIncentiveSmtpRejection, IncentiveHrMailer } from "../infrastructure/incentive-hr-mailer";
import { IncentiveHrHandoffRepository, hrSnapshotReady } from "../infrastructure/incentive-hr-handoff.repository";
import type { ApprovalMailEvent } from "../infrastructure/incentive-approval-mail-event";
import { buildIncentiveHrWorkbook } from "./incentive-hr-workbook";

const contentStage = { region_manager:"region-manager", sales_director:"sales-director", hr:"hr", general_manager:"general-manager" } as const;

@Injectable()
export class IncentiveApprovalMailService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IncentiveApprovalMailService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  constructor(private readonly repository: IncentiveApprovalMailRepository, private readonly mailer: IncentiveHrMailer,
    private readonly hrRepository: IncentiveHrHandoffRepository, private readonly config: ConfigService) {}

  onModuleInit() {
    if (!this.enabled()) return;
    this.timer = setInterval(() => void this.runOnce(),30_000);
    this.timer.unref?.(); void this.runOnce();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); this.timer=null; }
  private enabled() { return this.config.get<string>("INCENTIVE_APPROVAL_EMAIL_ENABLED") === "true"; }

  async runOnce() {
    if (this.running || !this.enabled() || !this.mailer.ready()) return;
    const origin = incentiveMailOrigin(this.config); if (!origin) return;
    this.running = true;
    try {
      await this.repository.abandon();
      try { await this.mailer.verify(); } catch { this.logger.warn("incentive_mail.smtp_preflight_failed"); return; }
      for (const event of await this.repository.events()) {
        try {
          await this.repository.attempted(event.event_id);
          const hrRecipients = this.mailer.recipients(event.company_id);
          await this.repository.expand(event,hrRecipients);
          for (const delivery of await this.repository.pending(event.event_id)) {
            const content = this.content(event,origin);
            if (!await this.repository.claim(event,delivery,hrRecipients)) continue;
            try {
              const id = await this.mailer.sendNotification({recipient:delivery.recipient,deliveryId:delivery.delivery_id,content});
              await this.repository.finishNotice(delivery.delivery_id,"sent",id);
            } catch(error) {
              await this.repository.finishNotice(delivery.delivery_id,error instanceof DefiniteIncentiveSmtpRejection ? "pending" : "uncertain");
              this.logger.warn("incentive_mail.notice_not_confirmed");
            }
          }
          if (event.stage === "general_manager") await this.deliverFinalHr(event,origin,hrRecipients);
        } catch { this.logger.warn("incentive_mail.event_pending"); }
      }
    } catch { this.logger.warn("incentive_mail.poll_failed"); } finally { this.running=false; }
  }

  private async deliverFinalHr(event: ApprovalMailEvent, origin: string, recipients: string[]) {
    if (!await this.repository.hrMailboxSafe(event.company_id,recipients)) { this.logger.warn("incentive_mail.hr_mailbox_not_safe"); return; }
    const snapshot = await this.repository.finalSnapshot(event);
    if (!hrSnapshotReady({...snapshot,deliveries:[]})) throw new Error("incentive_mail_final_snapshot_not_ready");
    const attachment = buildIncentiveHrWorkbook(event.period_key,snapshot.packages,snapshot.rows);
    if (attachment.length > 15*1024*1024) throw new Error("incentive_mail_workbook_too_large");
    const id = await this.repository.claimFinalHr(event,recipients,createHash("sha256").update(attachment).digest("hex"));
    if (!id) return;
    try {
      const messageId = await this.mailer.send({companyId:event.company_id,recipients,filename:`Primler-${event.period_key}.xlsx`,attachment,
        companyName:event.company_name,period:event.period_key,deliveryId:id,content:this.content(event,origin)});
      await this.hrRepository.finish(id,"sent",messageId);
    } catch { await this.hrRepository.finish(id,"uncertain",null); this.logger.warn("incentive_mail.hr_delivery_uncertain"); }
  }

  private content(event: ApprovalMailEvent, origin: string) {
    const period = new Intl.DateTimeFormat("tr-TR",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(`${event.period_key}-01T12:00:00Z`));
    return incentiveApprovalContent({stage:contentStage[event.stage],approverName:event.approver_name,period,detailUrl:incentiveMailLink(origin,event.period_key)});
  }
}
