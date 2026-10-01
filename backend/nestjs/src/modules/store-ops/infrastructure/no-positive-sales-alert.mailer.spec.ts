import { ConfigService } from "@nestjs/config";
import { DefiniteNoSalesSmtpRejection, NoPositiveSalesAlertMailer } from "./no-positive-sales-alert.mailer";
import * as nodemailer from "nodemailer";

jest.mock("nodemailer", () => ({ createTransport: jest.fn() }));

describe("NoPositiveSalesAlertMailer", () => {
  const sendMail = jest.fn(); const close = jest.fn();
  const settings = { NO_SALES_SMTP_HOST: "smtp.example.test", NO_SALES_SMTP_FROM: "axis@example.test" };
  const alerts = [{ delivery_id: "delivery-a", recipient_email: "hr@example.test", store_name: "LP Store", display_name: "Personel", business_date: "2026-09-30" }];
  beforeEach(() => { jest.resetAllMocks(); (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail, close }); sendMail.mockResolvedValue({ messageId: "smtp-id", accepted: ["hr@example.test"], rejected: [] }); });
  it("accepts only configured HR addresses for the requested company", () => {
    const mailer = new NoPositiveSalesAlertMailer(new ConfigService({ NO_SALES_HR_RECIPIENTS_JSON: '{"company-a":["HR@example.test","hr@example.test"],"company-b":["other@example.test"]}' }));
    expect(mailer.hrRecipients("company-a")).toEqual(["hr@example.test"]);
    expect(mailer.hrRecipients("company-c")).toEqual([]);
  });

  it("fails closed without SMTP settings", () => {
    const mailer = new NoPositiveSalesAlertMailer(new ConfigService({ NO_SALES_ALERTS_ENABLED: "true" }));
    expect(mailer.enabled()).toBe(true);
    expect(mailer.ready()).toBe(false);
  });

  it("adds HTML/CID presentation while keeping the warning, recipient and stable delivery identity", async () => {
    const mailer = new NoPositiveSalesAlertMailer(new ConfigService(settings));
    await expect(mailer.sendSummary("hr@example.test", alerts)).resolves.toBe("smtp-id");
    const first = sendMail.mock.calls[0][0];
    expect(first.to).toBe("hr@example.test");
    expect(first.html).toContain("LP Store");
    expect(first.text).toContain("prim kesintisi oluşturmaz");
    expect(first.attachments.map((asset: { cid: string }) => asset.cid)).toEqual(["hr-axis-logo", "hr-axis-people"]);
    await mailer.sendSummary("hr@example.test", alerts);
    expect(sendMail.mock.calls[1][0].messageId).toBe(first.messageId);
    expect(close).toHaveBeenCalledTimes(2);
  });

  it.each(["EAUTH", "EENVELOPE"])("preserves definite pre-DATA rejection %s and closes transport", async code => {
    sendMail.mockRejectedValue({ code });
    await expect(new NoPositiveSalesAlertMailer(new ConfigService(settings)).sendSummary("hr@example.test", alerts)).rejects.toBeInstanceOf(DefiniteNoSalesSmtpRejection);
    expect(close).toHaveBeenCalled();
  });

  it("does not record success for the wrong recipient even when acceptance counts match",async()=>{
    sendMail.mockResolvedValueOnce({messageId:"wrong",accepted:["other@example.test"],rejected:[]});
    await expect(new NoPositiveSalesAlertMailer(new ConfigService(settings)).sendSummary("hr@example.test",alerts)).rejects.toThrow("uncertain");
  });
  it("keeps a post-DATA timeout uncertain without resending", async () => {
    const error = Object.assign(new Error("timeout"), { code: "ETIMEDOUT" });
    sendMail.mockRejectedValue(error);
    await expect(new NoPositiveSalesAlertMailer(new ConfigService(settings)).sendSummary("hr@example.test", alerts)).rejects.toBe(error);
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalled();
  });
});
