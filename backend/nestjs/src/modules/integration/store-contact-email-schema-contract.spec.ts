import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "../../../../..");
const schemaSql = readFileSync(join(root, "db/schema.sql"), "utf8");
const migrationSql = readFileSync(join(root, "db/migrations/093_store_contact_email_v1.sql"), "utf8");
const rollbackSql = readFileSync(join(root, "db/rollback/093_store_contact_email_v1.rollback.sql"), "utf8");

describe("store contact email schema", () => {
  it("keeps normalized multi-address contacts with one active primary", () => {
    for (const sql of [schemaSql, migrationSql]) {
      expect(sql).toContain("ops.store_contact_email");
      expect(sql).toContain("normalized_email");
      expect(sql).toContain("uq_store_contact_email_primary_active");
      expect(sql).toContain("trg_store_contact_email_company_guard");
      expect(sql).toContain("trg_store_contact_email_primary_guard");
      expect(sql).toContain("DEFERRABLE INITIALLY DEFERRED");
      expect(sql).toContain("idx_external_id_map_internal_entity_active");
    }
  });

  it("refuses rollback after contact data exists", () => {
    expect(rollbackSql).toContain("cannot be rolled back after store contact emails exist");
    expect(rollbackSql).toContain("093_store_contact_email_v1.sql");
    expect(rollbackSql).toContain("IN ACCESS EXCLUSIVE MODE");
  });
});
