import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const projectRoot = join(process.cwd(), "..", "..");
const schemaSql = readFileSync(join(projectRoot, "db", "schema.sql"), "utf8");
const migrationPath = join(
  projectRoot,
  "db",
  "migrations",
  "010_checklist_acknowledgements.sql",
);
const migrationSql = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";

describe("checklist acknowledgement schema contract", () => {
  it("keeps checklist acknowledgement table in canonical schema and migration file", () => {
    for (const sql of [schemaSql, migrationSql]) {
      expect(sql).toContain("CREATE TABLE IF NOT EXISTS ops.checklist_acknowledgement");
      expect(sql).toContain("checklist_acknowledgement_id UUID PRIMARY KEY");
      expect(sql).toContain(
        "checklist_instance_id UUID NOT NULL REFERENCES ops.checklist_instance",
      );
      expect(sql).toContain("store_id UUID NOT NULL REFERENCES ops.store");
      expect(sql).toContain("acknowledged_by_user_id TEXT NOT NULL");
      expect(sql).toContain("acknowledgement_note TEXT");
      expect(sql).toContain("acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()");
      expect(sql).toContain("UNIQUE (checklist_instance_id)");
      expect(sql).toContain("idx_checklist_acknowledgement_store_acknowledged_at");
    }
  });
});
