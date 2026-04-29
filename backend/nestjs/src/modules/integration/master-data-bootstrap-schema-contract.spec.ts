import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const projectRoot = join(process.cwd(), "..", "..");
const schemaSql = readFileSync(join(projectRoot, "db", "schema.sql"), "utf8");
const migrationPath = join(
  projectRoot,
  "db",
  "migrations",
  "040_master_data_bootstrap_foundation.sql",
);
const migrationSql = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";

describe("master data bootstrap schema contract", () => {
  it("keeps store/personnel bootstrap staging tables in canonical schema and migration", () => {
    for (const sql of [schemaSql, migrationSql]) {
      expect(sql).toContain("CREATE TABLE IF NOT EXISTS stg.master_data_bootstrap_batch");
      expect(sql).toContain("master_data_bootstrap_batch_id UUID PRIMARY KEY DEFAULT gen_random_uuid()");
      expect(sql).toContain("bootstrap_entity TEXT NOT NULL");
      expect(sql).toContain("CHECK (bootstrap_entity IN ('store', 'personnel'))");
      expect(sql).toContain("batch_status TEXT NOT NULL DEFAULT 'uploaded'");
      expect(sql).toContain(
        "CHECK (batch_status IN ('uploaded', 'validated', 'ready_to_promote', 'promoted', 'rejected'))",
      );
      expect(sql).toContain("CREATE TABLE IF NOT EXISTS stg.master_data_bootstrap_row");
      expect(sql).toContain("raw_payload_json JSONB NOT NULL");
      expect(sql).toContain("normalized_payload_json JSONB NOT NULL DEFAULT '{}'::JSONB");
      expect(sql).toContain("validation_status TEXT NOT NULL DEFAULT 'pending'");
      expect(sql).toContain(
        "CHECK (validation_status IN ('pending', 'valid', 'needs_review', 'invalid', 'promoted'))",
      );
      expect(sql).toContain("resolved_store_id UUID REFERENCES ops.store(store_id)");
      expect(sql).toContain("resolved_employee_id UUID REFERENCES ops.employee(employee_id)");
      expect(sql).toContain("resolved_position_id UUID REFERENCES ops.position(position_id)");
      expect(sql).toContain("uq_master_data_bootstrap_row_hash");
      expect(sql).toContain("idx_master_data_bootstrap_batch_status");
      expect(sql).toContain("idx_master_data_bootstrap_row_review");
      expect(sql).not.toContain("INSERT INTO ops.store");
      expect(sql).not.toContain("INSERT INTO ops.employee");
    }
  });
});
