import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "../../../../..");
const schemaSql = readFileSync(join(root, "db/schema.sql"), "utf8");
const seedSql = readFileSync(
  join(root, "db/seeds/001_reference_seed.sql"),
  "utf8",
);
const migrationPath = join(
  root,
  "db/migrations/052_sales_target_incentive_v1.sql",
);
const migrationSql = existsSync(migrationPath)
  ? readFileSync(migrationPath, "utf8")
  : "";
const approvalFlowMigrationPath = join(
  root,
  "db/migrations/053_sales_target_incentive_region_approval_flow.sql",
);
const approvalFlowMigrationSql = existsSync(approvalFlowMigrationPath)
  ? readFileSync(approvalFlowMigrationPath, "utf8")
  : "";

function expectSalesTargetIncentiveCoreTables(sql: string): void {
  expect(sql).toContain(
    "CREATE TABLE IF NOT EXISTS ops.sales_target_incentive_rule_version",
  );
  expect(sql).toContain(
    "sales_target_incentive_rule_version_id UUID PRIMARY KEY DEFAULT gen_random_uuid()",
  );
  expect(sql).toContain("rule_version_code TEXT NOT NULL UNIQUE");
  expect(sql).toContain(
    "CHECK (bracket_boundary_policy = 'lower_inclusive_upper_exclusive')",
  );
  expect(sql).toContain("CHECK (round_before_lookup = FALSE)");
  expect(sql).toContain(
    "CREATE TABLE IF NOT EXISTS ops.sales_target_incentive_rate_bracket",
  );
  expect(sql).toContain("min_achievement_pct NUMERIC(12,4)");
  expect(sql).toContain("max_achievement_pct NUMERIC(12,4)");
  expect(sql).toContain("rate NUMERIC(10,4) NOT NULL");
  expect(sql).toContain(
    "CHECK (min_achievement_pct IS NOT NULL OR max_achievement_pct IS NOT NULL)",
  );
  expect(sql).toContain(
    "CHECK (min_achievement_pct IS NULL OR max_achievement_pct IS NULL OR max_achievement_pct > min_achievement_pct)",
  );
  expect(sql).toContain(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_target_incentive_rate_bracket_unique",
  );
}

function expectSalesTargetIncentiveProjectionTables(sql: string): void {
  expect(sql).toContain(
    "CREATE TABLE IF NOT EXISTS ops.sales_target_incentive_projection",
  );
  expect(sql).toContain("period_key CHAR(7) NOT NULL");
  expect(sql).toContain("period_timezone TEXT NOT NULL DEFAULT 'Europe/Istanbul'");
  expect(sql).toContain("store_type TEXT NOT NULL DEFAULT 'company'");
  expect(sql).toContain("CHECK (store_type = 'company')");
  expect(sql).toContain(
    "rule_version_id UUID NOT NULL REFERENCES ops.sales_target_incentive_rule_version(sales_target_incentive_rule_version_id)",
  );
  expect(sql).toContain(
    "store_target_request_id UUID REFERENCES ops.target_distribution_request(target_distribution_request_id)",
  );
  expect(sql).toContain("source_import_batch_ids UUID[] NOT NULL DEFAULT '{}'::uuid[]");
  expect(sql).toContain("source_evidence JSONB NOT NULL DEFAULT '{}'::jsonb");
  expect(sql).toContain(
    "CREATE TABLE IF NOT EXISTS ops.sales_target_incentive_projection_row",
  );
  expect(sql).toContain(
    "CHECK (calculation_status <> 'blocked' OR blocked_reason IS NOT NULL)",
  );
  expect(sql).not.toContain(
    "calculation_status NOT IN ('blocked', 'no_source')",
  );
  expect(sql).toContain(
    "personnel_target_reference_id UUID REFERENCES ops.personnel_target_reference(personnel_target_reference_id)",
  );
  expect(sql).toContain("position_code TEXT NOT NULL");
  expect(sql).toContain(
    "CHECK (position_code IN ('STORE_MANAGER', 'ASSISTANT_MANAGER', 'SENIOR_SALES_CONSULTANT', 'SALES_ASSOCIATE'))",
  );
  expect(sql).toContain("CHECK (normalized_from_position_code IS NULL OR normalized_from_position_code = 'SHIFT_LEAD')");
}

function expectSalesTargetIncentiveCloseTables(sql: string): void {
  expect(sql).toContain(
    "CREATE TABLE IF NOT EXISTS ops.sales_target_incentive_close_run",
  );
  expect(sql).toContain("close_cutoff_at TIMESTAMPTZ NOT NULL");
  expect(sql).toContain(
    "CREATE TABLE IF NOT EXISTS rpt.sales_target_incentive_rule_snapshot",
  );
  expect(sql).toContain("rate_brackets_json JSONB NOT NULL");
  expect(sql).toContain(
    "CREATE TABLE IF NOT EXISTS rpt.sales_target_incentive_assignment_snapshot",
  );
  expect(sql).toContain(
    "source_assignment_id UUID REFERENCES ops.employee_assignment_history(assignment_id)",
  );
  expect(sql).toContain(
    "CREATE TABLE IF NOT EXISTS rpt.sales_target_incentive_final_snapshot",
  );
  expect(sql).toContain(
    "CREATE TABLE IF NOT EXISTS rpt.sales_target_incentive_final_row",
  );
  expect(sql).toContain("raw_earned_amount NUMERIC(20,10) NOT NULL DEFAULT 0");
  expect(sql).toContain("payable_amount NUMERIC(18,2) NOT NULL DEFAULT 0");
  expect(sql).toContain("final_amount NUMERIC(18,2) NOT NULL DEFAULT 0");
}

function expectSalesTargetIncentiveApprovalFlowTables(sql: string): void {
  expect(sql).toContain(
    "CREATE TABLE IF NOT EXISTS ops.sales_target_incentive_store_review",
  );
  expect(sql).toContain(
    "CREATE TABLE IF NOT EXISTS ops.sales_target_incentive_region_package",
  );
  expect(sql).toContain(
    "CREATE TABLE IF NOT EXISTS ops.sales_target_incentive_region_package_store",
  );
  expect(sql).toContain(
    "CREATE TABLE IF NOT EXISTS ops.sales_target_incentive_region_correction",
  );
  expect(sql).toContain("CHECK (period_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')");
  expect(sql).toContain("CHECK (review_status IN ('pending_review', 'reviewed'))");
  expect(sql).toContain(
    "CHECK (package_status IN ('submitted', 'admin_approved', 'admin_returned'))",
  );
  expect(sql).toContain(
    "CHECK (correction_status IN ('draft', 'submitted', 'admin_approved', 'admin_returned', 'voided'))",
  );
  expect(sql).toContain(
    "approved_adjustment_id UUID REFERENCES ops.sales_target_incentive_adjustment",
  );
  expect(sql).toContain(
    "adjustment_amount NUMERIC(18,2) GENERATED ALWAYS AS (final_amount - before_amount) STORED",
  );
  expect(sql).toContain(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_sti_store_review_store_period",
  );
  expect(sql).toContain(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_sti_region_package_region_period",
  );
  expect(sql).toContain(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_sti_region_correction_open_unique",
  );
  expect(sql).toContain(
    "WHERE correction_status IN ('draft', 'submitted', 'admin_returned')",
  );
  expect(sql).toContain(
    "COMMENT ON TABLE ops.sales_target_incentive_region_package_store IS 'Immutable submitted store set snapshot",
  );
}

describe("sales target incentive schema contract", () => {
  it("adds the dedicated migration file for PR-3", () => {
    expect(migrationSql).not.toBe("");
  });

  it("adds the dedicated migration file for region manager approval flow", () => {
    expect(approvalFlowMigrationSql).not.toBe("");
  });

  it("keeps rule versions and exact rate brackets in canonical schema and migration", () => {
    for (const sql of [schemaSql, migrationSql]) {
      expectSalesTargetIncentiveCoreTables(sql);
    }
  });

  it("seeds only reference rule and bracket rows with exact lower-inclusive ranges", () => {
    expect(migrationSql).toContain("'sales-target-incentive-v1.0.0'");
    expect(migrationSql).toContain("'manager-sales-target-v1.0.0'");
    expect(migrationSql).toContain("'personnel-sales-target-v1.0.0'");
    expect(migrationSql).toContain("(rule.rule_version_id, 'manager-sales-target-v1.0.0', 'manager', NULL, 80.0000, 0.0000");
    expect(migrationSql).toContain("(rule.rule_version_id, 'personnel-sales-target-v1.0.0', 'personnel', NULL, 80.0000, 0.0000");
    expect(migrationSql).toContain("(rule.rule_version_id, 'manager-sales-target-v1.0.0', 'manager', 85.0000, 90.0000, 0.0030");
    expect(migrationSql).toContain("(rule.rule_version_id, 'personnel-sales-target-v1.0.0', 'personnel', 85.0000, 90.0000, 0.0050");
    expect(migrationSql).toContain("(rule.rule_version_id, 'manager-sales-target-v1.0.0', 'manager', 110.0000, NULL, 0.0100");
    expect(migrationSql).not.toContain("85.9");
    expect(migrationSql).not.toContain("89.9");
  });

  it("keeps projections company-store only and evidence-pointer based", () => {
    for (const sql of [schemaSql, migrationSql]) {
      expectSalesTargetIncentiveProjectionTables(sql);
    }
  });

  it("separates close runs, immutable final snapshots, rule snapshots, and assignment snapshots", () => {
    for (const sql of [schemaSql, migrationSql]) {
      expectSalesTargetIncentiveCloseTables(sql);
      expect(sql).toContain("DROP TRIGGER IF EXISTS trg_sales_target_incentive_final_snapshot_immutable");
      expect(sql).toContain("DROP TRIGGER IF EXISTS trg_sales_target_incentive_final_row_immutable");
      expect(sql).toContain("DROP TRIGGER IF EXISTS trg_sales_target_incentive_rule_snapshot_immutable");
      expect(sql).toContain("DROP TRIGGER IF EXISTS trg_sales_target_incentive_assignment_snapshot_immutable");
      expect(sql).toContain("FOR EACH ROW EXECUTE FUNCTION rpt.prevent_snapshot_mutation()");
    }
  });

  it("adds audited manual adjustments without mutating raw imports or final snapshots directly", () => {
    for (const sql of [schemaSql, migrationSql]) {
      expect(sql).toContain(
        "CREATE TABLE IF NOT EXISTS ops.sales_target_incentive_adjustment",
      );
      expect(sql).toContain("adjustment_amount NUMERIC(18,2) NOT NULL");
      expect(sql).toContain("created_by_user_id UUID NOT NULL REFERENCES ops.user_account(user_id)");
      expect(sql).toContain("approved_by_user_id UUID REFERENCES ops.user_account(user_id)");
      expect(sql).toContain("before_amount NUMERIC(18,2)");
      expect(sql).toContain("after_amount NUMERIC(18,2)");
      expect(sql).toContain("evidence JSONB NOT NULL DEFAULT '{}'::jsonb");
      expect(sql).toContain(
        "OR (adjustment_scope = 'final_snapshot' AND projection_row_id IS NULL AND final_row_id IS NOT NULL)",
      );
    }
  });

  it("separates region manager review, correction, package submit, and admin review state", () => {
    for (const sql of [schemaSql, approvalFlowMigrationSql]) {
      expectSalesTargetIncentiveApprovalFlowTables(sql);
    }
    expect(approvalFlowMigrationSql).toContain(
      "COMMENT ON TABLE ops.sales_target_incentive_region_correction IS 'Region manager draft/submitted incentive corrections, converted to payable adjustments only after admin approval.'",
    );
    expect(approvalFlowMigrationSql).not.toContain("ops.sales_target_incentive_projection_row");
  });

  it("seeds the same V1 rule and bracket references for schema reset paths", () => {
    expect(seedSql).toContain("'sales-target-incentive-v1.0.0'");
    expect(seedSql).toContain("'manager-sales-target-v1.0.0'");
    expect(seedSql).toContain("'personnel-sales-target-v1.0.0'");
    expect(seedSql).toContain("(rule.rule_version_id, 'manager-sales-target-v1.0.0', 'manager', NULL, 80.0000, 0.0000");
    expect(seedSql).toContain("(rule.rule_version_id, 'personnel-sales-target-v1.0.0', 'personnel', NULL, 80.0000, 0.0000");
    expect(seedSql).not.toContain("85.9");
    expect(seedSql).not.toContain("89.9");
  });
});
