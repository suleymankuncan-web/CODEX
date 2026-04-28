import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const projectRoot = join(process.cwd(), "..", "..");
const schemaSql = readFileSync(join(projectRoot, "db", "schema.sql"), "utf8");
const migrationPath = join(
  projectRoot,
  "db",
  "migrations",
  "036_mobile_device_sessions.sql",
);
const migrationSql = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";

describe("mobile auth session schema contract", () => {
  it("keeps mobile device session tracking in canonical schema and migration file", () => {
    for (const sql of [schemaSql, migrationSql]) {
      expect(sql).toContain("CREATE TABLE IF NOT EXISTS ops.mobile_device_session");
      expect(sql).toContain("mobile_device_session_id UUID PRIMARY KEY");
      expect(sql).toContain("user_id UUID NOT NULL REFERENCES ops.user_account");
      expect(sql).toContain("provider_subject TEXT NOT NULL");
      expect(sql).toContain("device_id_hash TEXT NOT NULL");
      expect(sql).toContain("status TEXT NOT NULL DEFAULT 'active'");
      expect(sql).toContain("idx_mobile_device_session_user_status");
      expect(sql).toContain("idx_mobile_device_session_active_lookup");
      expect(sql).toContain("uq_mobile_device_session_active_device");
      expect(sql.toLowerCase()).not.toContain("refresh_token");
    }
  });
});
