import { readFileSync } from "node:fs";
import { join } from "node:path";

const projectRoot = join(process.cwd(), "..", "..");
const schemaSql = readFileSync(join(projectRoot, "db", "schema.sql"), "utf8");
const migrationSql = readFileSync(
  join(
    projectRoot,
    "db",
    "migrations",
    "075_company_daily_kpi_component_storage_v1.sql",
  ),
  "utf8",
);
const rollbackSql = readFileSync(
  join(
    projectRoot,
    "db",
    "rollback",
    "075_company_daily_kpi_component_storage_v1.rollback.sql",
  ),
  "utf8",
);
const storeTotalsMigrationSql = readFileSync(
  join(
    projectRoot,
    "db",
    "migrations",
    "081_store_sales_signed_totals_v1.sql",
  ),
  "utf8",
);

describe("company daily KPI component storage schema contract", () => {
  it.each([schemaSql, migrationSql])(
    "defines independently replaceable typed component facts",
    (sql) => {
      expect(sql).toContain(
        "CREATE TABLE IF NOT EXISTS ops.company_daily_kpi_component_outcome",
      );
      expect(sql).toContain(
        "CREATE TABLE IF NOT EXISTS ops.company_daily_kpi_employee_sales",
      );
      expect(sql).toContain(
        "CREATE TABLE IF NOT EXISTS ops.company_daily_kpi_store_sales",
      );
      expect(sql).toContain(
        "CREATE TABLE IF NOT EXISTS ops.company_daily_kpi_store_footfall",
      );
      expect(sql).toContain(
        "CREATE TABLE IF NOT EXISTS ops.company_daily_kpi_store_gsm",
      );
      expect(sql).toContain(
        "UNIQUE (integration_source_id, business_date, operation)",
      );
      expect(sql).toContain(
        "UNIQUE (component_outcome_id, business_date, store_id, employee_id)",
      );
      expect(sql).toContain(
        "UNIQUE (component_outcome_id, business_date, store_id)",
      );
      expect(sql).toContain(
        "CHECK (operation IN ('sales', 'footfall', 'gsm'))",
      );
      expect(sql).toMatch(
        /CHECK \([\s\S]*yes_customer_count <= total_customer_count[\s\S]*\)/,
      );
      expect(sql).toContain("sanitized_set_digest CHAR(64)");
      expect(sql).toMatch(/sale_amount_try\s+NUMERIC\(38,12\)\s+NOT NULL/);
      expect(sql).toMatch(
        /signed_return_amount_try\s+NUMERIC\(38,12\)\s+NOT NULL/,
      );
    },
  );

  it("keeps provider rows and canonical scoring tables outside the migration", () => {
    expect(migrationSql).not.toMatch(
      /payload|ephemeral_invoice|personnel_code|store_code/i,
    );
    expect(migrationSql).not.toContain("ops.kpi_actual");
    expect(migrationSql).not.toContain("kpi_actual_employee_live_unique_idx");
    expect(migrationSql).not.toMatch(/CREATE (?:OR REPLACE )?VIEW/i);
    expect(migrationSql).not.toMatch(/(?:DOUBLE PRECISION|\bREAL\b)/i);
  });

  it("persists signed store totals independently from personnel facts", () => {
    for (const sql of [schemaSql, storeTotalsMigrationSql]) {
      expect(sql).toMatch(/sale_quantity\s+NUMERIC\(38,12\)/);
      expect(sql).toMatch(/signed_return_quantity\s+NUMERIC\(38,12\)/);
      expect(sql).toMatch(/net_quantity\s+NUMERIC\(38,12\)/);
      expect(sql).toMatch(/sale_amount_try\s+NUMERIC\(38,12\)/);
      expect(sql).toMatch(/signed_return_amount_try\s+NUMERIC\(38,12\)/);
      expect(sql).toMatch(/net_amount_try\s+NUMERIC\(38,12\)/);
      expect(sql).toContain(
        "net_amount_try = sale_amount_try + signed_return_amount_try",
      );
    }
  });

  it("provides a fail-closed rollback before dropping typed facts", () => {
    expect(rollbackSql).toContain("BEGIN;");
    expect(rollbackSql).toContain(
      "LOCK TABLE ops.company_daily_kpi_component_outcome",
    );
    expect(rollbackSql).toContain(
      "Cannot roll back company daily KPI component storage",
    );
    expect(rollbackSql).toContain("DROP TABLE ops.company_daily_kpi_store_gsm");
    expect(rollbackSql).toContain(
      "DROP TABLE ops.company_daily_kpi_component_outcome",
    );
    expect(rollbackSql).toContain("DELETE FROM audit.schema_migration");
    expect(rollbackSql).toContain("COMMIT;");
  });
});
