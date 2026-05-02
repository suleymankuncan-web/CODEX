import { readFileSync } from "fs";
import { join } from "path";

describe("KPI config versioning schema contract", () => {
  const root = join(__dirname, "../../../../..");
  const schemaSql = readFileSync(join(root, "db/schema.sql"), "utf8");
  const migrationSql = readFileSync(
    join(root, "db/migrations/026_kpi_config_versioning.sql"),
    "utf8",
  );

  it("defines immutable KPI config versions in ops", () => {
    expect(schemaSql).toContain("CREATE TABLE ops.kpi_config_version");
    expect(schemaSql).toContain(
      "kpi_config_version_id UUID PRIMARY KEY DEFAULT gen_random_uuid()",
    );
    expect(schemaSql).toContain("version_no INTEGER NOT NULL");
    expect(schemaSql).toContain("lifecycle_state TEXT NOT NULL DEFAULT 'published'");
    expect(schemaSql).toContain("config_payload JSONB NOT NULL");
    expect(schemaSql).toContain("UNIQUE (version_no)");
  });

  it("anchors snapshot runs to KPI config versions", () => {
    expect(schemaSql).toContain(
      "kpi_config_version_id UUID REFERENCES ops.kpi_config_version(kpi_config_version_id)",
    );
  });

  it("ships an additive migration for version history and snapshot anchoring", () => {
    expect(migrationSql).toContain("CREATE TABLE IF NOT EXISTS ops.kpi_config_version");
    expect(migrationSql).toContain("INSERT INTO ops.kpi_config_version");
    expect(migrationSql).toContain("ALTER TABLE rpt.snapshot_run");
    expect(migrationSql).toContain("ADD COLUMN IF NOT EXISTS kpi_config_version_id UUID");
  });
});
