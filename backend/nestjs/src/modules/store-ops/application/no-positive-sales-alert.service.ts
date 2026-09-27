import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { isEmail } from "class-validator";
import { DefiniteNoSalesSmtpRejection, NoPositiveSalesAlertMailer } from "../infrastructure/no-positive-sales-alert.mailer";
import { NoPositiveSalesAlertRepository } from "../infrastructure/no-positive-sales-alert.repository";

const POLL_MS = 15 * 60 * 1000;

@Injectable()
export class NoPositiveSalesAlertService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NoPositiveSalesAlertService.name);
  private intervalRef: NodeJS.Timeout | null = null;
  private tickInFlight = false;

  constructor(
    private readonly repository: NoPositiveSalesAlertRepository,
    private readonly mailer: NoPositiveSalesAlertMailer,
  ) {}

  onModuleInit() {
    if (!this.mailer.enabled()) return;
    this.intervalRef = setInterval(() => void this.runOnce(), POLL_MS);
    this.intervalRef.unref?.();
    void this.runOnce();
  }

  onModuleDestroy() {
    if (this.intervalRef) clearInterval(this.intervalRef);
    this.intervalRef = null;
  }

  async runOnce(now = new Date()) {
    if (this.tickInFlight || !this.mailer.enabled()) return;
    this.tickInFlight = true;
    try {
      const { hour, previousDate } = istanbulMorning(now);
      if (hour < 6) return;
      await this.repository.markAbandonedClaimsUncertain();
      if (await this.repository.hasCompletedLoad(previousDate)) {
        const candidates = await this.repository.listCandidates(previousDate);
        for (const candidate of candidates) {
          const recipients = new Set([
            ...candidate.manager_emails,
            ...this.mailer.hrRecipients(candidate.company_id),
          ].filter(address => isEmail(address)).map(address => address.toLowerCase()));
          for (const recipientEmail of recipients) {
            await this.repository.enqueue({ ...candidate, businessDate: previousDate, recipientEmail });
          }
        }
      }
      const pending = await this.repository.listPendingRecipients();
      if (pending.length === 0 || !this.mailer.ready()) return;
      try {
        await this.mailer.verify();
      } catch {
        this.logger.warn(JSON.stringify({ event: "no_sales_alert.smtp_preflight_failed", retry: "next_poll" }));
        return;
      }
      for (const recipient of pending) {
        const claimed = await this.repository.claim(recipient);
        if (claimed.length === 0) continue;
        const ids = claimed.map(item => item.delivery_id);
        try {
          const messageId = await this.mailer.sendSummary(recipient, claimed);
          await this.repository.markSent(ids, messageId);
        } catch (error) {
          if (error instanceof DefiniteNoSalesSmtpRejection) {
            await this.repository.markRetryable(ids);
            this.logger.warn(JSON.stringify({ event: "no_sales_alert.delivery_rejected", count: ids.length, retry: "next_poll" }));
          } else {
            // Once DATA might have been accepted, never blindly resend.
            await this.repository.markUncertain(ids);
            this.logger.warn(JSON.stringify({ event: "no_sales_alert.delivery_uncertain", count: ids.length }));
          }
        }
      }
    } catch {
      this.logger.warn(JSON.stringify({ event: "no_sales_alert.tick_failed", retry: "next_poll" }));
    } finally {
      this.tickInFlight = false;
    }
  }
}

function istanbulMorning(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const value = (type: string) => Number(parts.find(part => part.type === type)?.value);
  const date = new Date(Date.UTC(value("year"), value("month") - 1, value("day") - 1));
  return { hour: value("hour"), previousDate: date.toISOString().slice(0, 10) };
}
