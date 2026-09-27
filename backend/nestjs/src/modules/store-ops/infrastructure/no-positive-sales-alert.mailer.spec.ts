import { ConfigService } from "@nestjs/config";
import { NoPositiveSalesAlertMailer } from "./no-positive-sales-alert.mailer";

describe("NoPositiveSalesAlertMailer", () => {
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
});
