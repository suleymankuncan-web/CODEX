import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import { DefiniteIncentiveSmtpRejection, IncentiveHrMailer } from "./incentive-hr-mailer";
import { incentiveApprovalContent } from "../../../shared/mail/operational.templates";

jest.mock("nodemailer", () => ({ createTransport: jest.fn() }));
describe("corporate SMTP adapter", () => {
  const sendMail = jest.fn(); const close = jest.fn();
  const settings = { INCENTIVE_HR_SMTP_HOST: "smtp.example.test", INCENTIVE_HR_SMTP_FROM: "payroll@example.test", INCENTIVE_HR_SMTP_PORT: "587", INCENTIVE_HR_RECIPIENTS_JSON: '{"company-a":["hr@example.test"," HR@EXAMPLE.TEST "]}' };
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
    const mail = sendMail.mock.calls[0][0];
    expect(mail).toEqual(expect.objectContaining({ to: input.recipients, messageId: "<incentive-delivery-a@example.test>", html: expect.stringContaining("Prim listesi onaylandı"), text: expect.stringContaining("Prim listesi onaylandı") }));
    expect(mail.attachments).toHaveLength(3);
    expect(mail.attachments[0]).toEqual({ content: input.attachment, filename: input.filename, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    expect(mail.attachments.slice(1).map((asset: { cid: string }) => asset.cid)).toEqual(["hr-axis-logo", "hr-axis-approval"]);
    expect(close).toHaveBeenCalled();
  });
  it("treats partial acceptance as uncertain and closes the transport", async () => {
    sendMail.mockResolvedValue({ accepted: [], rejected: input.recipients });
    await expect(new IncentiveHrMailer(new ConfigService(settings)).send(input)).rejects.toThrow("SMTP did not accept every recipient");
    expect(sendMail).toHaveBeenCalledTimes(1); expect(close).toHaveBeenCalled();
  });
  it("sends a director notification with two inline images and no workbook or finances", async () => {
    const recipient="director@example.test";
    sendMail.mockResolvedValue({messageId:"notice-id",accepted:[recipient],rejected:[]});
    const content=incentiveApprovalContent({stage:"region-manager",approverName:"Ad Soyad",period:"Eylül 2026",detailUrl:"https://app.example.test/store/incentives?period=2026-09"});
    await expect(new IncentiveHrMailer(new ConfigService(settings)).sendNotification({recipient,deliveryId:"notice-a",content})).resolves.toBe("notice-id");
    const mail=sendMail.mock.calls[0][0];
    expect(mail.to).toBe(recipient);
    expect(mail.attachments).toHaveLength(2);
    expect(mail.attachments.every((a:{contentType:string})=>a.contentType==="image/png")).toBe(true);
    expect(mail.text).toContain("Prim detayına git: https://app.example.test/store/incentives?period=2026-09");
    expect(mail.text).not.toMatch(/\bTL\b|net satış|hedef/i);
  });
  it("blocks workbook recipients outside the configured company HR mapping before SMTP", async () => {
    await expect(new IncentiveHrMailer(new ConfigService(settings)).send({...input,companyId:"company-a",recipients:["director@example.test"]})).rejects.toThrow("recipient_mismatch");
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });
  it("does not record workbook success for acceptance of a different address with the same count",async()=>{
    sendMail.mockResolvedValue({messageId:"wrong",accepted:["director@example.test"],rejected:[]});
    await expect(new IncentiveHrMailer(new ConfigService(settings)).send(input)).rejects.toThrow("SMTP did not accept every recipient");
  });
  it("does not record notice success for acceptance of a different address",async()=>{
    sendMail.mockResolvedValue({messageId:"wrong",accepted:["other@example.test"],rejected:[]});
    const content=incentiveApprovalContent({stage:"hr",approverName:"Ad Soyad",period:"Eylül 2026",detailUrl:"https://app.example.test/store/incentives?period=2026-09"});
    await expect(new IncentiveHrMailer(new ConfigService(settings)).sendNotification({recipient:"gm@example.test",deliveryId:"notice-a",content})).rejects.toThrow("uncertain");
  });
  it.each(["EAUTH","EENVELOPE"])("marks %s before DATA as a definite rejection and closes SMTP", async code => {
    sendMail.mockRejectedValue(Object.assign(new Error("synthetic"),{code}));
    const content=incentiveApprovalContent({stage:"hr",approverName:"Ad Soyad",period:"Eylül 2026",detailUrl:"https://app.example.test/store/incentives?period=2026-09"});
    await expect(new IncentiveHrMailer(new ConfigService(settings)).sendNotification({recipient:"gm@example.test",deliveryId:"notice-a",content})).rejects.toBeInstanceOf(DefiniteIncentiveSmtpRejection);
    expect(close).toHaveBeenCalled();
  });
});
