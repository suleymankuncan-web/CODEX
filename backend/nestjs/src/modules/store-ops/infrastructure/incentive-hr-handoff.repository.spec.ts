import { ConflictException, ForbiddenException } from "@nestjs/common";
import { hrTestSnapshot } from "../application/incentive-hr-handoff.fixture";
import { IncentiveHrHandoffRepository, hrSnapshotVersion } from "./incentive-hr-handoff.repository";

describe("atomic HR delivery claim", () => {
  let snapshot = hrTestSnapshot(); let granted = true;
  const query = jest.fn();
  const repository = new IncentiveHrHandoffRepository({ withTransaction: async (fn: (client: { query: typeof query }) => Promise<unknown>) => fn({ query }) } as never);
  const config = [{ companyId: "company-a", recipients: ["hr@example.test"] }];
  const claim = () => repository.claim({ period: "2026-09", companyIds: ["company-a"], actorId: "viewer", version: hrSnapshotVersion("2026-09", hrTestSnapshot(), config), config, attachments: [{ companyId: "company-a", sha256: "a".repeat(64) }] });
  beforeEach(() => {
    snapshot = hrTestSnapshot(); granted = true; query.mockReset();
    query.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT DISTINCT ura.company_id")) return { rows: granted ? [{ company_id: "company-a" }] : [] };
      if (sql.includes("AS packages,")) return { rows: [snapshot] };
      if (sql.includes("INSERT INTO ops.incentive_hr_delivery")) return { rows: [{ company_id: "company-a", delivery_id: "delivery-a", status: "sending" }] };
      return { rows: [] };
    });
  });
  it("reads required manager packages from the selected period and checks every assigned store", async () => {
    await repository.read("2026-09", ["company-a"]);
    const sql = String(query.mock.calls.find(call => String(call[0]).includes("AS packages,"))?.[0]);
    expect(sql).toContain("FROM rpt.sales_target_incentive_final_snapshot snapshot");
    expect(sql).toContain("snapshot.period_key = $1");
    expect(sql).toContain("SELECT DISTINCT company_id, manager_user_id FROM assigned_snapshot");
    expect(sql).toContain("FROM ops.user_action_store_assignment assignment");
    expect(sql).toContain("AND NOT EXISTS (SELECT 1 FROM ops.sales_target_incentive_region_package_store ps");
    expect(sql).not.toContain("SELECT DISTINCT company_id, region_id");
  });
  it("locks the company period and live assignments before claiming once", async () => {
    const result = await claim();
    expect(result).toHaveLength(1);
    expect(query.mock.calls[0][0]).toContain("pg_advisory_xact_lock");
    expect(query.mock.calls[1][0]).toContain("FOR SHARE");
    expect(query.mock.calls.filter(call => call[0].includes("INSERT INTO ops.incentive_hr_delivery"))).toHaveLength(1);
  });
  it("rejects revoked grants before writing or reading the payroll snapshot", async () => {
    granted = false;
    await expect(claim()).rejects.toThrow(ForbiddenException);
    expect(query.mock.calls.some(call => call[0].includes("AS packages,"))).toBe(false);
  });
  it.each(["sent", "sending", "uncertain"] as const)("blocks a second claim after %s", async status => {
    snapshot.deliveries.push({ company_id: "company-a", delivery_id: "delivery-a", status, created_at: "2026-09-02", sent_at: null });
    await expect(claim()).rejects.toThrow(ConflictException);
    expect(query.mock.calls.some(call => call[0].includes("INSERT INTO"))).toBe(false);
  });
  it("revalidates amounts changed between preview and transaction", async () => {
    snapshot.rows[0].final_amount = "999.99";
    await expect(claim()).rejects.toThrow(ConflictException);
    expect(query.mock.calls.some(call => call[0].includes("INSERT INTO"))).toBe(false);
  });
  it("rejects a newly closed store missing from an already approved package", async () => {
    snapshot.packages[0].stale_stores = 1;
    await expect(claim()).rejects.toThrow(ConflictException);
    expect(query.mock.calls.some(call => call[0].includes("INSERT INTO"))).toBe(false);
  });
});
