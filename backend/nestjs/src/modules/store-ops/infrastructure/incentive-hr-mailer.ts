import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { isEmail } from "class-validator";
import * as nodemailer from "nodemailer";
import { readFileBackedSetting } from "../../../shared/secret-file-config";
import { renderIncentiveHandoff } from "../../../shared/mail/notification.templates";
import { renderBaseTemplate, type MailContent } from "../../../shared/mail/base.template";
import { incentiveMailOrigin, incentiveMailLink } from "../../../shared/mail/incentive-mail-link";

export class DefiniteIncentiveSmtpRejection extends Error {}

@Injectable()
export class IncentiveHrMailer {
  constructor(private readonly config: ConfigService) {}

  recipients(companyId: string): string[] {
    try {
      const map: unknown = JSON.parse(this.config.get<string>("INCENTIVE_HR_RECIPIENTS_JSON") || "{}");
      const value = map && typeof map === "object" ? (map as Record<string, unknown>)[companyId] : null;
      if (!Array.isArray(value) || value.length === 0 || value.length > 20 || !value.every(item => typeof item === "string" && isEmail(item.trim()))) return [];
      return [...new Set((value as string[]).map(email=>email.trim().toLowerCase()))].sort();
    } catch { return []; }
  }

  ready() { return this.settings() !== null; }

  async verify() {
    const settings = this.settings();
    if (!settings) throw new Error("incentive_smtp_not_configured");
    const transport = this.transport(settings);
    try { await transport.verify(); } finally { transport.close(); }
  }

  /** Notifications cannot accept a workbook. The only attachments here are the shared inline images. */
  async sendNotification(input: { recipient: string; deliveryId: string; content: MailContent }) {
    const settings = this.settings();
    if (!settings || !isEmail(input.recipient)) throw new Error("incentive_notification_invalid_delivery");
    const transport = this.transport(settings);
    try {
      const template = renderBaseTemplate(input.content);
      const receipt = await transport.sendMail({ from: settings.from, to: input.recipient,
        messageId: `<incentive-notice-${input.deliveryId}@${settings.from.split("@")[1]}>`,
        subject: `HR Axis | ${input.content.title}`, ...template,
      }).catch((error: unknown) => {
        const code = (error as { code?: unknown }).code;
        if (code === "EAUTH" || code === "EENVELOPE") throw new DefiniteIncentiveSmtpRejection("incentive_notification_pre_data_rejection");
        throw error;
      });
      if (!receipt.accepted.length && receipt.rejected.length) throw new DefiniteIncentiveSmtpRejection("incentive_notification_rejected");
      if (receipt.rejected.length || receipt.accepted.length !== 1 || String(receipt.accepted[0]).toLowerCase() !== input.recipient.toLowerCase()) throw new Error("incentive_notification_uncertain");
      return String(receipt.messageId);
    } finally { transport.close(); }
  }

  async send(input: { recipients: string[]; filename: string; attachment: Buffer; period: string; companyName: string; deliveryId: string; content?: MailContent; companyId?: string }) {
    const settings = this.settings();
    if (!settings) throw new ServiceUnavailableException("Prim e-posta ayarları henüz tamamlanmadı.");
    if (input.companyId && JSON.stringify(input.recipients.map(r=>r.toLowerCase()).sort()) !== JSON.stringify(this.recipients(input.companyId).map(r=>r.toLowerCase()).sort())) throw new Error("incentive_hr_recipient_mismatch");
    const transport = this.transport(settings);
    try {
      const origin = incentiveMailOrigin(this.config);
      const template = input.content ? renderBaseTemplate(input.content) : renderIncentiveHandoff({...input,detailUrl:origin ? incentiveMailLink(origin,input.period) : undefined});
      const receipt = await transport.sendMail({
        from: settings.from, to: input.recipients,
        messageId: `<incentive-${input.deliveryId}@${settings.from.split("@")[1]}>`,
        subject: input.content ? `HR Axis | ${input.content.title}` : `${input.companyName} | ${input.period} onaylı prim listesi`,
        html: template.html, text: template.text,
        attachments: [{ filename: input.filename, content: input.attachment, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }, ...template.attachments],
      });
      if (receipt.rejected.length || JSON.stringify(receipt.accepted.map(email=>String(email).toLowerCase()).sort()) !== JSON.stringify(input.recipients.map(email=>email.toLowerCase()).sort())) throw new Error("SMTP did not accept every recipient");
      return String(receipt.messageId);
    } finally { transport.close(); }
  }

  private settings() {
    const host = this.config.get<string>("INCENTIVE_HR_SMTP_HOST")?.trim();
    const from = this.config.get<string>("INCENTIVE_HR_SMTP_FROM")?.trim();
    const port = Number(this.config.get<string>("INCENTIVE_HR_SMTP_PORT") || "587");
    const user = this.config.get<string>("INCENTIVE_HR_SMTP_USER")?.trim();
    const password = readFileBackedSetting(this.config, "INCENTIVE_HR_SMTP_PASSWORD");
    if (!host || !from || !isEmail(from) || !Number.isInteger(port) || port < 1 || port > 65535 || (user && !password)) return null;
    return { host, from, port, user, password };
  }

  private transport(settings: NonNullable<ReturnType<IncentiveHrMailer["settings"]>>) {
    return nodemailer.createTransport({ host: settings.host, port: settings.port, secure: settings.port === 465,
      requireTLS: settings.port !== 465, auth: settings.user ? { user: settings.user, pass: settings.password! } : undefined,
      connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 30_000,
      disableFileAccess: true, disableUrlAccess: true });
  }
}
