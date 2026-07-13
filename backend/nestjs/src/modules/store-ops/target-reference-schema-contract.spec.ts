import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const root = join(__dirname, "../../../../..");
const schemaSql = readFileSync(join(root, "db/schema.sql"), "utf8");
const migrationSql = readFileSync(
  join(root, "db/migrations/039_target_reference_control_surface_v1.sql"),
  "utf8",
);
const combinedSql = `${schemaSql}\n${migrationSql}`;
const allowedTargetReferenceWriterPaths = [
  "src/modules/store-ops/infrastructure/target-distribution.repository.ts",
  "src/modules/store-ops/infrastructure/pilot-roster-reconciliation.repository.ts",
];
const backendRoot = join(__dirname, "../../..");

function listRuntimeTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) return listRuntimeTypeScriptFiles(absolutePath);
    if (!entry.isFile() || !entry.name.endsWith(".ts") || /\.(spec|test)\.ts$/.test(entry.name)) {
      return [];
    }
    return [absolutePath];
  });
}

const targetReferenceWriterSources = listRuntimeTypeScriptFiles(join(backendRoot, "src"))
  .map((absolutePath) => ({
    relativePath: absolutePath.slice(backendRoot.length + 1).replace(/\\/g, "/"),
    source: readFileSync(absolutePath, "utf8"),
  }))
  .filter(({ source }) => /INSERT\s+INTO\s+ops\.personnel_target_reference/i.test(source));

describe("target reference schema contract", () => {
  it("defines approved personnel target references", () => {
    expect(combinedSql).toContain(
      "CREATE TABLE IF NOT EXISTS ops.personnel_target_reference",
    );
    expect(combinedSql).toContain(
      "personnel_target_reference_id UUID PRIMARY KEY DEFAULT gen_random_uuid()",
    );
    expect(combinedSql).toContain(
      "source_request_id UUID NOT NULL REFERENCES ops.target_distribution_request(target_distribution_request_id)",
    );
    expect(combinedSql).toContain(
      "employee_id UUID NOT NULL REFERENCES ops.employee(employee_id)",
    );
    expect(combinedSql).toContain(
      "target_type TEXT NOT NULL DEFAULT 'monthly_sales_target'",
    );
    expect(combinedSql).toContain("status TEXT NOT NULL DEFAULT 'approved'");
    expect(combinedSql).toContain(
      "CHECK (status IN ('approved', 'superseded', 'voided_future'))",
    );
    expect(combinedSql).toContain(
      "supersedes_target_reference_id UUID REFERENCES ops.personnel_target_reference(personnel_target_reference_id)",
    );
  });

  it("guards lookup and active uniqueness indexes", () => {
    expect(combinedSql).toContain(
      "CREATE INDEX IF NOT EXISTS idx_personnel_target_reference_employee_period",
    );
    expect(combinedSql).toContain(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_personnel_target_reference_active_unique",
    );
    expect(combinedSql).toContain("WHERE status = 'approved'");
  });

  it("anchors employee KPI snapshots to the personnel target reference used", () => {
    expect(combinedSql).toContain("ALTER TABLE rpt.employee_kpi_snapshot");
    expect(combinedSql).toContain(
      "ADD COLUMN IF NOT EXISTS personnel_target_reference_id UUID REFERENCES ops.personnel_target_reference(personnel_target_reference_id)",
    );
  });

  it("documents the scoring boundary", () => {
    expect(combinedSql).toContain(
      "COMMENT ON TABLE ops.personnel_target_reference IS 'Approved personnel target references promoted from region-approved target distribution requests for scoring.'",
    );
  });

  it("keeps every direct target-reference writer append-only", () => {
    expect(targetReferenceWriterSources.map(({ relativePath }) => relativePath).sort()).toEqual(
      [...allowedTargetReferenceWriterPaths].sort(),
    );
    for (const writer of targetReferenceWriterSources) {
      const targetInsert = writer.source.match(
        /INSERT INTO ops\.personnel_target_reference[\s\S]{0,2200}/,
      )?.[0];
      expect(targetInsert).toBeDefined();
      expect(targetInsert).not.toContain("ON CONFLICT");
    }
  });
});
