import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("DB-C5 TARGET constraint migration contract", () => {
  const root = join(__dirname, "..", "..", "..");
  const packageRoot = join(root, "db", "constraint-packages", "rem8-target-duplicate-v1");
  const createFunction = readFileSync(join(packageRoot, "001_create_function.sql"), "utf8");
  const addConstraint = readFileSync(join(packageRoot, "002_add_constraint_not_valid.sql"), "utf8");
  const validateConstraint = readFileSync(join(packageRoot, "003_validate_constraint.sql"), "utf8");
  const rollback = readFileSync(join(packageRoot, "rollback.sql"), "utf8");
  const migration = readFileSync(join(
    root,
    "db",
    "migrations",
    "060_target_distribution_duplicate_employee_constraint_v1.sql",
  ), "utf8");
  const observationReceipt = JSON.parse(readFileSync(join(
    root,
    "docs",
    "evidence",
    "readiness",
    "2026-07-12-staging-rem8-target-constraint-observation-v1.json",
  ), "utf8")) as { queryResult: { candidate: Record<string, string> } };

  // Trace: FR-01..03, FR-05, FR-09, FR-11; NFR-03..05; AC-01..03, AC-05, AC-07.
  it("composes migration 060 from the exact reviewed package and bounded timeouts", () => {
    const expected = [
      "SET LOCAL lock_timeout = '5000ms';\nSET LOCAL statement_timeout = '30000ms';",
      lf(createFunction).trim(),
      lf(addConstraint).trim(),
      lf(validateConstraint).trim(),
    ].join("\n\n") + "\n";
    expect(lf(migration)).toBe(expected);
  });

  it("binds candidate files to the merged REM-8 receipt and creates no index or DML", () => {
    expect(sha256(crlf(createFunction))).toBe(observationReceipt.queryResult.candidate.functionDigest);
    expect(sha256(crlf(addConstraint))).toBe(observationReceipt.queryResult.candidate.addConstraintDigest);
    expect(sha256(crlf(validateConstraint))).toBe(
      observationReceipt.queryResult.candidate.validateConstraintDigest,
    );
    expect(sha256(crlf(rollback))).toBe(observationReceipt.queryResult.candidate.rollbackDigest);
    expect(migration).not.toMatch(/\bCREATE\s+(?:UNIQUE\s+)?INDEX\b/i);
    expect(migration).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|MERGE|TRUNCATE|GRANT|REVOKE|COPY|CALL|DO)\b/i);
  });

  it("keeps rollback constraint-first and leaves reference history outside DB-C5", () => {
    expect(rollback.indexOf("DROP CONSTRAINT")).toBeGreaterThanOrEqual(0);
    expect(rollback.indexOf("DROP FUNCTION")).toBeGreaterThan(rollback.indexOf("DROP CONSTRAINT"));
    expect(migration).not.toContain("personnel_target_reference");
    expect(migration).not.toContain("approval_evidence_json");
  });
});

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function lf(value: string) {
  return value.replace(/\r\n/g, "\n");
}

function crlf(value: string) {
  return lf(value).replace(/\n/g, "\r\n");
}
