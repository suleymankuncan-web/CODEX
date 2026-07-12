import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("REM-8 TARGET disposable rehearsal source contract", () => {
  const source = readFileSync(join(
    __dirname,
    "..",
    "scripts",
    "rem8-target-constraint-disposable-rehearsal.ts",
  ), "utf8");

  // Trace: FR-11..17; NFR-02..06; AC-04..08; EC-11..15.
  it("pins the disposable boundary and every required rehearsal proof", () => {
    expect(source).toContain("store_ops_rem8_target_rehearsal_");
    expect(source).toContain("postgres_17_required");
    expect(source).toContain("failureValidationSqlState");
    expect(source).toContain("lockTimeoutSqlState");
    expect(source).toContain("SET LOCAL lock_timeout = '250ms'");
    expect(source).toContain("duplicateWriteRejected");
    expect(source).toContain("proveCandidateFunctionSemantics");
    expect(source).toContain("case_duplicate");
    expect(source).toContain("await writer.ready");
    expect(source).toContain("constraintValidated");
    expect(source).toContain("cleanupVerified");
    expect(source).toContain("sourceAggregateDigest");
    expect(source).toContain("restoreAggregateDigest");
  });

  it("does not contain staging, production, migration or index execution", () => {
    expect(source).not.toMatch(/DATABASE_INVARIANT_PREFLIGHT_TARGET\s*!==\s*["']staging/);
    expect(source).not.toMatch(/CREATE\s+(?:UNIQUE\s+)?INDEX/i);
    expect(source).not.toMatch(/db:migrate|runMigrations|migrationService/);
    expect(source).not.toMatch(/ssl:\s*\{/);
  });
});
