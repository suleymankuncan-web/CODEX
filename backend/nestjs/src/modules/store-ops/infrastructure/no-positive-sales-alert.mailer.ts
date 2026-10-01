import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "node:crypto";
import { isEmail } from "class-validator";
import * as nodemailer from "nodemailer";
import { readFileBackedSetting } from "../../../shared/secret-file-config";
import type { ClaimedNoSalesAlert } from "./no-positive-sales-alert.repository";
import { renderNoPositiveSales } from "../../../shared/mail/notification.templates";

/** SMTP rejected the recipient before accepting a message; resubmission is safe. */
export class DefiniteNoSalesSmtpRejection extends Error {}

@Injectable()
export class NoPositiveSalesAlertMailer {
  constructor(private readonly config: ConfigService) {}

  enabled(): boolean {
    return this.config.get<string>("NO_SALES_ALERTS_ENABLED") === "true";
  }

  hrRecipients(companyId: string): string[] {
    try {
      const value: unknown = JSON.parse(this.config.get<string>("NO_SALES_HR_RECIPIENTS_JSON") || "{}");
      const recipients = value && typeof value === "object" ? (value as Record<string, unknown>)[companyId] : null;
      if (!Array.isArray(recipients) || recipients.length > 20 || !recipients.every(item => typeof item === "string" && isEmail(item))) return [];
      return [...new Set(recipients.map(item => item.toLowerCase()))].sort();
    } catch { return []; }
  }

  ready(): boolean { return this.settings() !== null; }

  async verify(): Promise<void> {
    const settings = this.settings();
    if (!settings) throw new Error("no_sales_smtp_not_configured");
    const transport = this.transport(settings);
    try { await transport.verify(); } finally { transport.close(); }
  }

  async sendSummary(recipient: string, alerts: ClaimedNoSalesAlert[]): Promise<string> {
    const settings = this.settings();
    if (!settings || !isEmail(recipient) || alerts.length === 0) throw new Error("no_sales_smtp_invalid_delivery");
    const deliveryKey = createHash("sha256").update(alerts.map(item => item.delivery_id).sort().join(":"), "utf8").digest("hex").slice(0, 32);
    const transport = this.transport(settings);
    try {
      const template = renderNoPositiveSales(alerts);
      const receipt = await transport.sendMail({
          from: settings.from,
          to: recipient,
          messageId: `<no-sales-${deliveryKey}@${settings.from.split("@")[1]}>`,
          subject: "HR Axis | 15 gündür pozitif satış görülmeyen personel",
          html: template.html, text: template.text, attachments: template.attachments,
      }).catch((error: unknown) => {
        const code = (error as { code?: unknown }).code;
        if (code === "EAUTH" || code === "EENVELOPE") {
          throw new DefiniteNoSalesSmtpRejection("no_sales_smtp_pre_data_rejection");
        }
        throw error;
      });
      if (receipt.accepted.length === 0 && receipt.rejected.length > 0) {
        throw new DefiniteNoSalesSmtpRejection("no_sales_smtp_recipient_not_accepted");
      }
      if (receipt.rejected.length > 0 || receipt.accepted.length !== 1 || String(receipt.accepted[0]).toLowerCase() !== recipient.toLowerCase()) throw new Error("no_sales_smtp_delivery_uncertain");
      return String(receipt.messageId);
    } finally { transport.close(); }
  }

  private settings() {
    const host = this.config.get<string>("NO_SALES_SMTP_HOST")?.trim();
    const from = this.config.get<string>("NO_SALES_SMTP_FROM")?.trim();
    const port = Number(this.config.get<string>("NO_SALES_SMTP_PORT") || "587");
    const user = readFileBackedSetting(this.config, "NO_SALES_SMTP_USER");
    const password = readFileBackedSetting(this.config, "NO_SALES_SMTP_PASSWORD");
    if (!host || !from || !isEmail(from) || !Number.isInteger(port) || port < 1 || port > 65535 || (user && !password)) return null;
    return { host, from, port, user, password };
  }

  private transport(settings: NonNullable<ReturnType<NoPositiveSalesAlertMailer["settings"]>>) {
    return nodemailer.createTransport({
      host: settings.host, port: settings.port, secure: settings.port === 465,
      requireTLS: settings.port !== 465,
      auth: settings.user ? { user: settings.user, pass: settings.password! } : undefined,
      connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 30_000,
      disableFileAccess: true, disableUrlAccess: true,
    });
  }
}
