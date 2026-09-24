import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import { IncentiveHrMailer } from "./incentive-hr-mailer";

jest.mock("nodemailer", () => ({ createTransport: jest.fn() }));
describe("corporate SMTP adapter", () => {
  const sendMail = jest.fn(); const close = jest.fn();
  const settings = { INCENTIVE_HR_SMTP_HOST: "smtp.example.test", INCENTIVE_HR_SMTP_FROM: "payroll@example.test", INCENTIVE_HR_SMTP_PORT: "587", INCENTIVE_HR_RECIPIENTS_JSON: '{"company-a":["hr@example.test","hr@example.test"]}' };
  const input = { recipients: ["hr@example.test"], filename: "Primler-2026-09.xlsx", attachment: Buffer.from("test"), period: "2026-09", companyName: "Test", deliveryId: "delivery-a" };
  beforeEach(() => { jest.resetAllMocks(); (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail, close }); sendMail.mockResolvedValue({ messageId: "smtp-id", accepted: input.recipients, rejected: [] }); });
  it("validates and deduplicates company-specific recipients", () => {
    const mailer = new IncentiveHrMailer(new ConfigService(settings));
    expect(mailer.recipients("company-a")).toEqual(["hr@example.test"]);
    expect(mailer.recipients("company-b")).toEqual([]);
    expect(new IncentiveHrMailer(new ConfigService({ INCENTIVE_HR_RECIPIENTS_JSON: '{"company-a":["invalid"]}' })).recipients("company-a")).toEqual([]);
  });
  it("requires valid SMTP settings and authenticated password when a user is configured", () => {
    expect(new IncentiveHrMailer(new ConfigService({})).ready()).toBe(false);
    expect(new IncentiveHrMailer(new ConfigService({ ...settings, INCENTIVE_HR_SMTP_USER: "user" })).ready()).toBe(false);
  });
  it("uses TLS, bounded timeouts and a buffer attachment with stable message ID", async () => {
    const mailer = new IncentiveHrMailer(new ConfigService(settings));
    await expect(mailer.send(input)).resolves.toBe("smtp-id");
    expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({ requireTLS: true, secure: false, disableFileAccess: true, disableUrlAccess: true, socketTimeout: 30000 }));
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: input.recipients, messageId: "<incentive-delivery-a@example.test>", attachments: [expect.objectContaining({ content: input.attachment, filename: input.filename })] }));
    expect(close).toHaveBeenCalled();
  });
  it("treats partial acceptance as uncertain and closes the transport", async () => {
    sendMail.mockResolvedValue({ accepted: [], rejected: input.recipients });
    await expect(new IncentiveHrMailer(new ConfigService(settings)).send(input)).rejects.toThrow("SMTP did not accept every recipient");
    expect(sendMail).toHaveBeenCalledTimes(1); expect(close).toHaveBeenCalled();
  });
});
