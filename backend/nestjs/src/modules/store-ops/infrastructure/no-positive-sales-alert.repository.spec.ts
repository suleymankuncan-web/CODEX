import { NoPositiveSalesAlertRepository } from "./no-positive-sales-alert.repository";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("NoPositiveSalesAlertRepository", () => {
  it("keeps a unique per-period delivery ledger with fail-closed rollback", () => {
    const root = join(process.cwd(), "..", "..");
    const migration = readFileSync(join(root, "db/migrations/087_no_positive_sales_alert_delivery_v1.sql"), "utf8");
    const rollback = readFileSync(join(root, "db/rollback/087_no_positive_sales_alert_delivery_v1.rollback.sql"), "utf8");
    expect(migration).toContain("UNIQUE (employee_id, assignment_id, period_anchor, recipient_email)");
    expect(migration).toContain("CHECK (status IN ('pending', 'sending', 'sent', 'uncertain'))");
    expect(rollback).toContain("Preserve no-sale alert delivery audit");
  });

  it("requires 15 covered days and current direct assignment, with returns excluded from sale reset", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const repository = new NoPositiveSalesAlertRepository({ query } as never);
    await repository.listCandidates("2026-09-26");
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain("COUNT(DISTINCT sales.business_date) = 15");
    expect(sql).toContain("HAVING COUNT(DISTINCT operation) = 3");
    expect(sql).toContain("BOOL_OR(sales.business_date = $1::date AND source.integration_source_id IS NOT NULL)");
    expect(sql).toContain("assignment.start_date <= $1::date - 14");
    expect(sql).toContain("person_sales.sale_invoice_count > 0 AND person_sales.sale_amount_try > 0");
    expect(sql).toContain("FROM ops.user_action_store_assignment manager_store");
    expect(sql).toContain("role.role_code = 'REGION_MANAGER'");
    expect(sql).not.toContain("region_id =");
    expect(params).toEqual(["2026-09-26"]);
  });

  it("deduplicates one no-sale period per assignment and recipient", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const repository = new NoPositiveSalesAlertRepository({ query } as never);
    await repository.enqueue({ businessDate: "2026-09-26", company_id: "company-a", store_id: "store-a", employee_id: "person-a", assignment_id: "assignment-a", period_anchor: "2026-09-01", manager_emails: [], recipientEmail: "manager@example.test" });
    expect(query.mock.calls[0][0]).toContain("ON CONFLICT (employee_id, assignment_id, period_anchor, recipient_email) DO NOTHING");
    await repository.claim("manager@example.test");
    expect(query.mock.calls[1][0]).toContain("FOR UPDATE SKIP LOCKED");
    expect(query.mock.calls[1][0]).toContain("status = 'sending'");
  });
});
