import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const projectRoot = join(process.cwd(), "..", "..");
const jobsSql = readFileSync(
  join(projectRoot, "db", "jobs", "generate_snapshots.sql"),
  "utf8",
);
const schemaSql = readFileSync(join(projectRoot, "db", "schema.sql"), "utf8");
const migrationPath = join(
  projectRoot,
  "db",
  "migrations",
  "038_checklist_store_score_integration_v1.sql",
);
const migrationSql = existsSync(migrationPath)
  ? readFileSync(migrationPath, "utf8")
  : "";

describe("checklist store score integration SQL contract", () => {
  it("generates checklist snapshots only from completed instances by completed_at", () => {
    for (const sql of [jobsSql, migrationSql]) {
      expect(sql).toContain(
        "CREATE OR REPLACE FUNCTION rpt.generate_store_checklist_snapshot",
      );
      expect(sql).toContain("ci.status = 'completed'");
      expect(sql).toContain(
        "ci.completed_at::date BETWEEN p_period_start AND p_period_end",
      );
      expect(sql).not.toContain(
        "ci.created_at::date BETWEEN p_period_start AND p_period_end",
      );
    }
  });

  it("keeps checklist snapshot rows able to report visit counts and average score", () => {
    expect(schemaSql).toContain("CREATE TABLE rpt.store_checklist_snapshot");
    expect(schemaSql).toContain("audit_count INTEGER NOT NULL");
    expect(schemaSql).toContain("avg_score NUMERIC(12,2)");
  });
});
