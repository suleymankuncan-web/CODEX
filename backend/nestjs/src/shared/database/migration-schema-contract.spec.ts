import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const projectRoot = join(process.cwd(), "..", "..");
const schemaSql = readFileSync(join(projectRoot, "db", "schema.sql"), "utf8");
const migrationPath = join(
  projectRoot,
  "db",
  "migrations",
  "035_schema_migration_tracking.sql",
);
const migrationSql = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";
const mobileChecklistMigrationSql = readFileSync(
  join(projectRoot, "db", "migrations", "037_mobile_checklist_today_v1.sql"),
  "utf8",
);

describe("migration tracking schema contract", () => {
  it("keeps schema migration tracking in canonical schema and migration file", () => {
    for (const sql of [schemaSql, migrationSql]) {
      expect(sql).toContain("CREATE TABLE IF NOT EXISTS audit.schema_migration");
      expect(sql).toContain("migration_name TEXT PRIMARY KEY");
      expect(sql).toContain("migration_checksum TEXT NOT NULL");
      expect(sql).toContain("status TEXT NOT NULL");
      expect(sql).toContain("attempt_count INTEGER NOT NULL DEFAULT 0");
      expect(sql).toContain("error_message TEXT");
      expect(sql).toContain("idx_schema_migration_status");
    }
  });

  it("keeps mobile checklist migration idempotent against the current schema baseline", () => {
    expect(schemaSql).toContain("checklist_template_code_version_unique");
    expect(mobileChecklistMigrationSql).toContain(
      "DROP CONSTRAINT IF EXISTS checklist_template_code_version_unique",
    );
    expect(mobileChecklistMigrationSql).toContain(
      "ADD CONSTRAINT checklist_template_code_version_unique UNIQUE (template_code, version_no)",
    );
  });
});
