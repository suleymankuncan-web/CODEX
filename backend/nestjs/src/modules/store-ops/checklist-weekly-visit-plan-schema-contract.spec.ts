import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const projectRoot = join(process.cwd(), "..", "..");
const schemaSql = readFileSync(join(projectRoot, "db", "schema.sql"), "utf8");
const migrationPath = join(
  projectRoot,
  "db",
  "migrations",
  "061_region_weekly_visit_plan_v1.sql",
);
const migrationSql = existsSync(migrationPath)
  ? readFileSync(migrationPath, "utf8")
  : "";
const smokeSql = readFileSync(
  join(projectRoot, "db", "preflight", "region-weekly-visit-plan-v1-smoke.sql"),
  "utf8",
);

describe("region weekly visit plan schema contract", () => {
  const contracts = [schemaSql, migrationSql];
  const tableDefinition = (sql: string, table: string) =>
    sql.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${table.replace(".", "\\.")} \\([\\s\\S]*?\\n\\);`))?.[0] ?? "";

  it("owns one BM plan per region and ISO week without manager ownership", () => {
    for (const sql of contracts) {
      expect(sql).toContain("CREATE TABLE IF NOT EXISTS ops.region_weekly_visit_plan (");
      expect(sql).toContain("UNIQUE (region_id, week_start_date, visit_type)");
      expect(sql).toContain("CHECK (EXTRACT(ISODOW FROM week_start_date) = 1)");
      expect(sql).toContain("CHECK (visit_type = 'BM_STORE_VISIT')");
      expect(sql).toContain("CHECK (timezone_name = 'Europe/Istanbul')");
      const planTable = tableDefinition(sql, "ops.region_weekly_visit_plan");
      expect(planTable).not.toContain("manager_employee_id");
      expect(planTable).not.toContain("manager_user_id");
    }
  });

  it("keeps complete revisions idempotent and concurrency-addressable", () => {
    for (const sql of contracts) {
      expect(sql).toContain("CREATE TABLE IF NOT EXISTS ops.region_weekly_visit_plan_revision (");
      expect(sql).toContain("created_by_user_id UUID NOT NULL REFERENCES ops.user_account(user_id)");
      expect(sql).toContain("idempotency_key UUID NOT NULL");
      expect(sql).toContain("request_sha256 CHAR(64) NOT NULL");
      expect(sql).toContain("UNIQUE (plan_id, revision_no)");
      expect(sql).toContain("UNIQUE (plan_id, idempotency_key)");
      expect(sql).toContain("WHERE is_current");
      expect(sql).toContain("guard_region_weekly_visit_plan_revision_mutation");
      expect(sql).toContain("OLD.is_current");
      expect(sql).toContain("NOT NEW.is_current");
      expect(sql).toContain("BEFORE UPDATE OR DELETE ON ops.region_weekly_visit_plan_revision");
    }
  });

  it("allows repeat weekly stores while rejecting same-day duplicates and Sundays", () => {
    for (const sql of contracts) {
      expect(sql).toContain("CREATE TABLE IF NOT EXISTS ops.region_weekly_visit_plan_item (");
      expect(sql).toContain("UNIQUE (revision_id, store_id, planned_date, visit_type)");
      expect(sql).toContain("planned_date BETWEEN week_start_date AND week_start_date + 5");
      expect(sql).toContain("FOREIGN KEY (store_id, region_id)");
      expect(sql).toContain("REFERENCES ops.store(store_id, region_id)");
      expect(sql).toContain("CHECK (visit_type = 'BM_STORE_VISIT')");
      expect(sql).toContain("guard_region_weekly_visit_plan_item_mutation");
      expect(sql).toContain("BEFORE UPDATE OR DELETE ON ops.region_weekly_visit_plan_item");
      expect(tableDefinition(sql, "ops.region_weekly_visit_plan_item")).not.toContain("ON DELETE CASCADE");
    }
  });

  it("adds bounded plan reads and completed checklist lookup without storing outcomes", () => {
    for (const sql of contracts) {
      expect(sql).toContain("idx_region_weekly_visit_plan_item_store_date");
      expect(sql).toContain("idx_checklist_instance_completed_visit_lookup");
      expect(sql).not.toMatch(/\b(display_status|outcome_status|waiting|missed)\b/i);
    }
  });

  it("rehearses positive and negative constraints inside a rollback-only fixture", () => {
    expect(smokeSql).toContain("BEGIN;");
    expect(smokeSql).toContain("ROLLBACK;");
    expect(smokeSql).toContain("same-day duplicate was accepted");
    expect(smokeSql).toContain("Sunday plan was accepted");
    expect(smokeSql).toContain("cross-region store was accepted");
    expect(smokeSql).toContain("VM visit type was accepted");
    expect(smokeSql).toContain("non-Monday week start was accepted");
    expect(smokeSql).toContain("second current revision was accepted");
    expect(smokeSql).toContain("revision content update was accepted");
    expect(smokeSql).toContain("retired revision resurrection was accepted");
    expect(smokeSql).toContain("revision delete was accepted");
    expect(smokeSql).toContain("plan item update was accepted");
    expect(smokeSql).toContain("plan item delete was accepted");
    expect(smokeSql).toContain("GET STACKED DIAGNOSTICS violated_constraint = CONSTRAINT_NAME");
    expect(smokeSql).not.toMatch(/\b(COMMIT|TRUNCATE|DROP)\b/i);
  });
});
