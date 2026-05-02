import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const projectRoot = join(process.cwd(), "..", "..");
const schemaSql = readFileSync(join(projectRoot, "db", "schema.sql"), "utf8");
const migrationPath = join(projectRoot, "db", "migrations", "027_kpi_raw_lineage_columns.sql");
const migrationSql = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";

describe("source agnostic ingest schema contract", () => {
  it("keeps row-level KPI lineage columns in canonical schema and migrations", () => {
    expect(schemaSql).toContain("CREATE TABLE stg.kpi_raw");
    expect(schemaSql).toContain("row_hash TEXT");
    expect(schemaSql).toContain("raw_row_reference TEXT");
    expect(schemaSql).toContain("kpi_raw_row_hash_idx");

    expect(migrationSql).toContain("ALTER TABLE stg.kpi_raw");
    expect(migrationSql).toContain("ADD COLUMN IF NOT EXISTS row_hash TEXT");
    expect(migrationSql).toContain("ADD COLUMN IF NOT EXISTS raw_row_reference TEXT");
    expect(migrationSql).toContain("CREATE INDEX IF NOT EXISTS kpi_raw_row_hash_idx");
  });
});
