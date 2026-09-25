import { BadRequestException, ConflictException, ForbiddenException, ServiceUnavailableException } from "@nestjs/common";
import * as XLSX from "@e965/xlsx";
import { buildAuthenticatedUser } from "../../auth/auth-context.service";
import { hrTestSnapshot } from "./incentive-hr-handoff.fixture";
import { IncentiveHrHandoffService } from "./incentive-hr-handoff.service";

const scope = (companyIds: string[]) => ({ companyIds, regionIds: [], storeIds: [] });
const actor = (grants = ["company-a"]) => buildAuthenticatedUser({ userId: "viewer", roleCodes: ["REPORT_VIEWER"], readScope: scope(["company-a", "outside"]), roleScopes: { REPORT_VIEWER: scope(["company-a", "company-b"]) }, permissionScopes: { INCENTIVE_FINAL_APPROVAL: scope(grants) } });

describe("HR email handoff", () => {
  let snapshot = hrTestSnapshot();
  const repository = { read: jest.fn(), claim: jest.fn(), finish: jest.fn() };
  const mailer = { ready: jest.fn(), recipients: jest.fn(), send: jest.fn() };
  const service = new IncentiveHrHandoffService(repository as never, mailer as never);
  beforeEach(() => {
    jest.resetAllMocks(); snapshot = hrTestSnapshot();
    repository.read.mockImplementation(async () => snapshot);
    repository.claim.mockResolvedValue([{ delivery_id: "delivery-a", company_id: "company-a" }]);
    mailer.ready.mockReturnValue(true); mailer.recipients.mockImplementation((id: string) => [`hr@${id}.example`]); mailer.send.mockResolvedValue("smtp-id");
  });
  it("scopes the preview to explicit grants and counts all submitted stores", async () => {
    const preview = await service.preview(actor(), "2026-09");
    expect(repository.read).toHaveBeenCalledWith("2026-09", ["company-a"]);
    expect(preview.canSend).toBe(true);
    expect(preview.companies[0]).toMatchObject({ managerPackageCount: 1, storeCount: 2, personnelCount: 1, totalAmount: "1800.25" });
  });
  it("rejects an ungranted viewer before reading payroll", async () => {
    await expect(service.preview(actor([]), "2026-09")).rejects.toThrow(ForbiddenException);
    expect(repository.read).not.toHaveBeenCalled();
  });
  it.each(["unapproved", "stale", "no-store", "no-recipient", "no-smtp", "sent", "sending", "uncertain"])("does not send an ineligible %s preview", async condition => {
    if (condition === "unapproved") snapshot.packages[0].package_status = "submitted";
    if (condition === "stale") snapshot.packages[0].stale_stores = 1;
    if (condition === "no-store") snapshot.packages[0].store_ids = [];
    if (condition === "no-recipient") mailer.recipients.mockReturnValue([]);
    if (condition === "no-smtp") mailer.ready.mockReturnValue(false);
    if (["sent", "sending", "uncertain"].includes(condition)) snapshot.deliveries = [{ company_id: "company-a", delivery_id: "delivery-a", status: condition as "sent", created_at: "2026-09-02", sent_at: null }];
    const preview = await service.preview(actor(), "2026-09");
    expect(preview.canSend).toBe(false);
    await expect(service.send(actor(), "2026-09", preview.version)).rejects.toThrow(BadRequestException);
    expect(repository.claim).not.toHaveBeenCalled(); expect(mailer.send).not.toHaveBeenCalled();
  });
  it.each(["amount", "recipients"])("rejects %s changes since confirmation", async change => {
    const preview = await service.preview(actor(), "2026-09");
    if (change === "amount") snapshot.rows[0].final_amount = "1900.00";
    else mailer.recipients.mockReturnValue(["new@example.test"]);
    await expect(service.send(actor(), "2026-09", preview.version)).rejects.toThrow(BadRequestException);
    expect(mailer.send).not.toHaveBeenCalled();
  });
  it("does not email after a conflicting concurrent delivery claim", async () => {
    const preview = await service.preview(actor(), "2026-09");
    repository.claim.mockRejectedValue(new ConflictException());
    await expect(service.send(actor(), "2026-09", preview.version)).rejects.toThrow(ConflictException);
    expect(mailer.send).not.toHaveBeenCalled();
  });
  it("claims before sending and persists uncertain SMTP outcomes without retry", async () => {
    const preview = await service.preview(actor(), "2026-09");
    mailer.send.mockRejectedValue(new Error("timeout after SMTP DATA"));
    await expect(service.send(actor(), "2026-09", preview.version)).rejects.toThrow(ServiceUnavailableException);
    expect(repository.claim.mock.invocationCallOrder[0]).toBeLessThan(mailer.send.mock.invocationCallOrder[0]);
    expect(repository.finish).toHaveBeenCalledWith("delivery-a", "uncertain", null);
    expect(mailer.send).toHaveBeenCalledTimes(1);
  });
  it("keeps company attachments and recipients separate", async () => {
    const other = hrTestSnapshot("company-b");
    other.packages[0].package_id = "package-b";
    other.packages[0].manager_user_id = "manager-b";
    other.packages[0].store_ids = ["store-b", "empty-store-b"];
    other.rows[0].package_id = "package-b";
    other.rows[0].manager_user_id = "manager-b";
    other.rows[0].store_id = "store-b";
    other.rows[0].display_name = "Other company employee";
    snapshot.packages.push(...other.packages); snapshot.rows.push(...other.rows);
    repository.claim.mockResolvedValue([{ delivery_id: "delivery-a", company_id: "company-a" }, { delivery_id: "delivery-b", company_id: "company-b" }]);
    const preview = await service.preview(actor(["company-a", "company-b"]), "2026-09");
    await service.send(actor(["company-a", "company-b"]), "2026-09", preview.version);
    const messages = mailer.send.mock.calls.map(call => call[0]);
    expect(messages.map(message => message.recipients)).toEqual([["hr@company-a.example"], ["hr@company-b.example"]]);
    const sheet = XLSX.read(messages[0].attachment, { type: "buffer" }).Sheets["Personel Primleri"];
    expect(sheet["!ref"]).toBe("A1:M2");
    expect(sheet.E2.v).not.toBe("Other company employee");
    expect(repository.finish).toHaveBeenCalledWith("delivery-b", "sent", "smtp-id");
  });
});
