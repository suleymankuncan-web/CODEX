import { readFileSync } from "node:fs";
import { join } from "node:path";

const workspaceRoot = join(__dirname, "../../../../..");
const schemaSql = readFileSync(join(workspaceRoot, "db/schema.sql"), "utf8");
const migrationSql = readFileSync(
  join(workspaceRoot, "db/migrations/082_checklist_item_remediation_task_policy.sql"),
  "utf8",
);

describe("checklist remediation task policy schema contract", () => {
  it("keeps existing checklist behavior by default", () => {
    expect(schemaSql).toMatch(
      /creates_remediation_task BOOLEAN NOT NULL DEFAULT TRUE/i,
    );
    expect(migrationSql).toMatch(
      /ADD COLUMN IF NOT EXISTS creates_remediation_task BOOLEAN NOT NULL DEFAULT TRUE/i,
    );
  });

  it("prevents task policy changes after a checklist template is published", () => {
    for (const sql of [schemaSql, migrationSql]) {
      expect(sql).toContain(
        "NEW.creates_remediation_task IS DISTINCT FROM OLD.creates_remediation_task",
      );
    }
  });
});
