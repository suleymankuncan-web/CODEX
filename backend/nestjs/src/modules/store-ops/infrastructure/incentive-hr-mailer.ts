import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { isEmail } from "class-validator";
import * as nodemailer from "nodemailer";
import { readFileBackedSetting } from "../../../shared/secret-file-config";

@Injectable()
export class IncentiveHrMailer {
  constructor(private readonly config: ConfigService) {}

  recipients(companyId: string): string[] {
    try {
      const map: unknown = JSON.parse(this.config.get<string>("INCENTIVE_HR_RECIPIENTS_JSON") || "{}");
      const value = map && typeof map === "object" ? (map as Record<string, unknown>)[companyId] : null;
      if (!Array.isArray(value) || value.length === 0 || value.length > 20 || !value.every(item => typeof item === "string" && isEmail(item))) return [];
      return [...new Set(value as string[])].sort();
    } catch { return []; }
  }

  ready() { return this.settings() !== null; }

  async send(input: { recipients: string[]; filename: string; attachment: Buffer; period: string; companyName: string; deliveryId: string }) {
    const settings = this.settings();
    if (!settings) throw new ServiceUnavailableException("Prim e-posta ayarları henüz tamamlanmadı.");
    const transport = nodemailer.createTransport({
      host: settings.host, port: settings.port, secure: settings.port === 465,
      requireTLS: settings.port !== 465, auth: settings.user ? { user: settings.user, pass: settings.password! } : undefined,
      connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 30_000,
      disableFileAccess: true, disableUrlAccess: true,
    });
    try {
      const receipt = await transport.sendMail({
        from: settings.from, to: input.recipients,
        messageId: `<incentive-${input.deliveryId}@${settings.from.split("@")[1]}>`,
        subject: `${input.companyName} | ${input.period} onaylı prim listesi`,
        text: `Merhaba,\n\n${input.period} dönemine ait bölge paketlerinin tamamı onaylanmıştır. Mağaza ve personel bazında onaylı prim tutarlarını içeren Excel dosyası ektedir.\n\nİyi çalışmalar.\nHR Axis`,
        attachments: [{ filename: input.filename, content: input.attachment, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }],
      });
      if (receipt.rejected.length || receipt.accepted.length !== input.recipients.length) throw new Error("SMTP did not accept every recipient");
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
}
