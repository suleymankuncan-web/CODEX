import { NoPositiveSalesAlertService } from "./no-positive-sales-alert.service";
import { DefiniteNoSalesSmtpRejection } from "../infrastructure/no-positive-sales-alert.mailer";

function harness() {
  const repository = {
    markAbandonedClaimsUncertain: jest.fn().mockResolvedValue(undefined),
    hasCompletedLoad: jest.fn().mockResolvedValue(true),
    listCandidates: jest.fn().mockResolvedValue([]),
    enqueue: jest.fn().mockResolvedValue(undefined),
    listPendingRecipients: jest.fn().mockResolvedValue([]),
    claim: jest.fn().mockResolvedValue([]),
    markSent: jest.fn().mockResolvedValue(undefined),
    markUncertain: jest.fn().mockResolvedValue(undefined),
    markRetryable: jest.fn().mockResolvedValue(undefined),
  };
  const mailer = {
    enabled: jest.fn().mockReturnValue(true),
    hrRecipients: jest.fn().mockReturnValue(["hr@example.test"]),
    ready: jest.fn().mockReturnValue(true),
    verify: jest.fn().mockResolvedValue(undefined),
    sendSummary: jest.fn().mockResolvedValue("message-1"),
  };
  return { repository, mailer, service: new NoPositiveSalesAlertService(repository as never, mailer as never) };
}

const morning = new Date("2026-09-27T06:00:00.000Z");

describe("NoPositiveSalesAlertService", () => {
  it("does nothing when disabled or before the morning window", async () => {
    const { service, mailer, repository } = harness();
    mailer.enabled.mockReturnValue(false);
    await service.runOnce(morning);
    expect(repository.hasCompletedLoad).not.toHaveBeenCalled();
    mailer.enabled.mockReturnValue(true);
    await service.runOnce(new Date("2026-09-27T01:00:00.000Z"));
    expect(repository.hasCompletedLoad).not.toHaveBeenCalled();
  });

  it("enqueues only assigned manager and configured HR recipients after complete load", async () => {
    const { service, repository } = harness();
    repository.listCandidates.mockResolvedValue([{
      company_id: "company-a", store_id: "store-a", employee_id: "person-a",
      assignment_id: "assignment-a", period_anchor: "2026-09-01",
      manager_emails: ["Manager@example.test", "manager@example.test", "not-an-email"],
    }]);
    await service.runOnce(morning);
    expect(repository.hasCompletedLoad).toHaveBeenCalledWith("2026-09-26");
    expect(repository.enqueue).toHaveBeenCalledTimes(2);
    expect(repository.enqueue.mock.calls.map(([input]) => input.recipientEmail).sort()).toEqual(["hr@example.test", "manager@example.test"]);
  });

  it("retries only before submission, not after an uncertain SMTP outcome", async () => {
    const { service, repository, mailer } = harness();
    repository.listPendingRecipients.mockResolvedValue(["manager@example.test"]);
    mailer.verify.mockRejectedValueOnce(new Error("network unavailable"));
    await service.runOnce(morning);
    expect(repository.claim).not.toHaveBeenCalled();
    repository.claim.mockResolvedValue([{ delivery_id: "delivery-a", recipient_email: "manager@example.test", business_date: "2026-09-26", store_name: "Store A", display_name: "Person A" }]);
    mailer.sendSummary.mockRejectedValueOnce(new Error("SMTP result unknown"));
    await service.runOnce(morning);
    expect(repository.markUncertain).toHaveBeenCalledWith(["delivery-a"]);
    expect(repository.markSent).not.toHaveBeenCalled();
  });

  it("records the accepted message without a second payout or roster mutation", async () => {
    const { service, repository } = harness();
    repository.listPendingRecipients.mockResolvedValue(["hr@example.test"]);
    repository.claim.mockResolvedValue([{ delivery_id: "delivery-a", recipient_email: "hr@example.test", business_date: "2026-09-26", store_name: "Store A", display_name: "Person A" }]);
    await service.runOnce(morning);
    expect(repository.markSent).toHaveBeenCalledWith(["delivery-a"], "message-1");
    expect(repository.markUncertain).not.toHaveBeenCalled();
  });

  it("requeues a definite pre-acceptance rejection for the next poll", async () => {
    const { service, repository, mailer } = harness();
    repository.listPendingRecipients.mockResolvedValue(["hr@example.test"]);
    repository.claim.mockResolvedValue([{ delivery_id: "delivery-a", recipient_email: "hr@example.test", business_date: "2026-09-26", store_name: "Store A", display_name: "Person A" }]);
    mailer.sendSummary.mockRejectedValueOnce(new DefiniteNoSalesSmtpRejection("recipient rejected"));
    await service.runOnce(morning);
    expect(repository.markRetryable).toHaveBeenCalledWith(["delivery-a"]);
    expect(repository.markUncertain).not.toHaveBeenCalled();
  });
});
