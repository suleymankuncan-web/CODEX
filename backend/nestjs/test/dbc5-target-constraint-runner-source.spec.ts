import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("DB-C5 TARGET apply runner source contract", () => {
  const source = readFileSync(join(
    __dirname,
    "..",
    "scripts",
    "dbc5-target-constraint-apply.ts",
  ), "utf8");

  // Trace: FR-04, FR-08; NFR-03, NFR-05; AC-01, AC-04; EC-08.
  it("does not import an executable runner while building its read-only preflight", () => {
    expect(source).not.toMatch(/from\s+["']\.\/rem8-target-constraint-observation["']/);
    expect(source).toContain("function parseSanitizedPlan(");
    expect(source).toContain('"SHOW transaction_isolation"');
    expect(source).toContain('"SHOW transaction_read_only"');
    expect(source).toContain("let ddlAttempted = false;");
    expect(source).toContain('"unverified_after_attempt"');
    expect(source).toContain("let migrationPreparation: MigrationPreparation | null = null;");
    expect(source).toContain("rmSync(migrationPreparation.temporaryRoot");
    expect(source).toContain('"BEGIN READ ONLY"');
  });
});
