import { readFileSync } from "fs";
import { join } from "path";

const root = join(__dirname, "../../../../..");
const schemaSql = readFileSync(join(root, "db/schema.sql"), "utf8");
const migrationSql = readFileSync(
  join(root, "db/migrations/049_store_action_plan_v1.sql"),
  "utf8",
);

function expectStoreActionPlanShape(sql: string): void {
  expect(sql).toMatch(/CREATE TABLE(?: IF NOT EXISTS)? ops\.store_action_plan\s*\(/);
  expect(sql).toContain("store_action_plan_id UUID PRIMARY KEY DEFAULT gen_random_uuid()");
  expect(sql).toContain("company_id UUID NOT NULL REFERENCES ops.company(company_id)");
  expect(sql).toContain("region_id UUID NOT NULL REFERENCES ops.region(region_id)");
  expect(sql).toContain("store_id UUID NOT NULL REFERENCES ops.store(store_id)");
  expect(sql).toContain("owner_user_id UUID NOT NULL REFERENCES ops.user_account(user_id)");
  expect(sql).toContain("created_by_user_id UUID NOT NULL REFERENCES ops.user_account(user_id)");
  expect(sql).toContain("source_type TEXT NOT NULL");
  expect(sql).toContain("source_id TEXT NOT NULL");
  expect(sql).toContain("source_snapshot_run_id UUID REFERENCES rpt.snapshot_run(snapshot_run_id)");
  expect(sql).toContain("source_kpi_id UUID REFERENCES ops.kpi_definition(kpi_id)");
  expect(sql).toContain("due_on DATE NOT NULL");
  expect(sql).toContain("CHECK (source_type IN ('kpi_exception'))");
  expect(sql).toContain("CHECK (priority IN ('high', 'medium', 'low'))");
  expect(sql).toContain("CHECK (status IN ('open', 'in_progress', 'blocked', 'closed', 'cancelled'))");
}

function expectStoreActionPlanIndexes(sql: string): void {
  expect(sql).toContain("CREATE INDEX IF NOT EXISTS idx_store_action_plan_store_status_due");
  expect(sql).toContain("ON ops.store_action_plan (store_id, status, due_on)");
  expect(sql).toContain("CREATE INDEX IF NOT EXISTS idx_store_action_plan_owner_status_due");
  expect(sql).toContain("ON ops.store_action_plan (owner_user_id, status, due_on)");
  expect(sql).toContain("CREATE INDEX IF NOT EXISTS idx_store_action_plan_scope_status_due");
  expect(sql).toContain("ON ops.store_action_plan (company_id, region_id, status, due_on)");
  expect(sql).toContain("CREATE UNIQUE INDEX IF NOT EXISTS idx_store_action_plan_active_source_unique");
  expect(sql).toContain("ON ops.store_action_plan (store_id, source_type, source_id)");
  expect(sql).toContain("WHERE status IN ('open', 'in_progress', 'blocked')");
}

describe("store action plan schema contract", () => {
  it("defines persisted store action plans in both canonical schema and migration", () => {
    expectStoreActionPlanShape(schemaSql);
    expectStoreActionPlanShape(migrationSql);
  });

  it("guards terminal status evidence constraints in both schema paths", () => {
    for (const sql of [schemaSql, migrationSql]) {
      expect(sql).toContain(
        "CHECK (status <> 'closed' OR (closed_at IS NOT NULL AND resolution_note IS NOT NULL))",
      );
      expect(sql).toContain(
        "CHECK (status <> 'cancelled' OR (cancelled_at IS NOT NULL AND cancel_reason IS NOT NULL))",
      );
    }
  });

  it("guards active source uniqueness and scope lookup indexes in both schema paths", () => {
    expectStoreActionPlanIndexes(schemaSql);
    expectStoreActionPlanIndexes(migrationSql);
  });

  it("documents the Store Action ownership boundary in both schema paths", () => {
    for (const sql of [schemaSql, migrationSql]) {
      expect(sql).toContain(
        "COMMENT ON TABLE ops.store_action_plan IS 'Store-owned follow-up plans created from approved Store Action candidate sources.'",
      );
    }
  });

  it("does not let canonical schema mask a broken migration", () => {
    const brokenMigration = migrationSql
      .replace(
        "CREATE TABLE IF NOT EXISTS ops.store_action_plan",
        "CREATE TABLE IF NOT EXISTS ops.store_action_plan_missing",
      )
      .replace("CREATE UNIQUE INDEX IF NOT EXISTS idx_store_action_plan_active_source_unique", "");

    expect(() => expectStoreActionPlanShape(brokenMigration)).toThrow();
    expect(() => expectStoreActionPlanIndexes(brokenMigration)).toThrow();
  });
});
