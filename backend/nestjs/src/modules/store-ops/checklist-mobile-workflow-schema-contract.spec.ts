import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const projectRoot = join(process.cwd(), "..", "..");
const schemaSql = readFileSync(join(projectRoot, "db", "schema.sql"), "utf8");
const migrationPath = join(
  projectRoot,
  "db",
  "migrations",
  "037_mobile_checklist_today_v1.sql",
);
const migrationSql = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";

describe("mobile checklist workflow schema contract", () => {
  it("keeps template versioning and visit lifecycle fields in canonical schema and migration", () => {
    for (const sql of [schemaSql, migrationSql]) {
      expect(sql).toContain("template_type TEXT NOT NULL DEFAULT 'BM_STORE_VISIT'");
      expect(sql).toContain("UNIQUE (template_code, version_no)");
      expect(sql).toContain("completed_by_user_id TEXT");
      expect(sql).toContain("locked_at TIMESTAMPTZ");
      expect(sql).toContain("CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled'))");
      expect(sql).toContain("idx_checklist_instance_mobile_today");
      expect(sql).toContain("idx_checklist_instance_monthly_completed");
    }
  });
});
