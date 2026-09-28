import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "../../../../..");
const schemaSql = readFileSync(join(root, "db/schema.sql"), "utf8");
const migrationSql = readFileSync(
  join(root, "db/migrations/090_master_identity_code_reservation_v1.sql"),
  "utf8",
);
const rollbackSql = readFileSync(
  join(root, "db/rollback/090_master_identity_code_reservation_v1.rollback.sql"),
  "utf8",
);

describe("master identity code reservation schema", () => {
  it("keeps normalized store and personnel aliases reserved", () => {
    for (const sql of [schemaSql, migrationSql]) {
      expect(sql).toContain("ops.normalize_master_external_code_v1");
      expect(sql).toContain("ops.master_identity_code_reservation");
      expect(sql).toContain("UNIQUE (entity_type, normalized_code)");
      expect(sql).toContain("uq_master_identity_code_current");
      expect(sql).toContain("trg_external_id_master_code_guard");
      expect(sql).toContain("trg_store_master_identity_code_sync");
      expect(sql).toContain("trg_employee_master_identity_code_sync");
      expect(sql).toContain("ops.sync_master_identity_code_v1");
      expect(sql).toContain("pg_try_advisory_xact_lock");
      expect(sql).toContain("ARRAY['assignment', 'kpi', 'store']");
      expect(sql).toContain("ARRAY['assignment', 'employee', 'kpi']");
      expect(sql).toContain("ck_master_identity_company_immutable");
      expect(sql).toContain("ck_master_identity_store_code_nonempty");
      expect(sql).toContain("ck_master_identity_employee_code_nonempty");
    }
    expect(migrationSql).toContain("Existing master data contains conflicting normalized store or personnel codes");
    expect(migrationSql).toContain("Active external mappings conflict with reserved master identity codes");
    expect(migrationSql).toContain("IN SHARE ROW EXCLUSIVE MODE");
    expect(migrationSql).toContain("normalizes to empty");
    expect(migrationSql).toContain("CREATE TABLE IF NOT EXISTS ops.master_identity_code_reservation");
    expect(migrationSql).toContain("DROP TRIGGER IF EXISTS trg_store_master_identity_code_sync");
    expect(rollbackSql).toContain("DROP TABLE IF EXISTS ops.master_identity_code_reservation");
    expect(rollbackSql).toContain("cannot be rolled back after master identity code history is in use");
    expect(rollbackSql).toContain("090_master_identity_code_reservation_v1.sql");
  });
});
