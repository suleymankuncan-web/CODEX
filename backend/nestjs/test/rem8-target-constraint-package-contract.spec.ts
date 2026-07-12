import {
  CANDIDATE_CONSTRAINT_NAME,
  CANDIDATE_FUNCTION_SIGNATURE,
  loadRem8TargetConstraintPackage,
  validateRem8TargetConstraintPackage,
} from "../scripts/rem8-target-constraint-package-contract";

describe("REM-8 TARGET constraint package contract", () => {
  // Trace: FR-01..04, FR-17; NFR-04, NFR-05; AC-01, AC-08; EC-01..06.
  it("loads the exact function, NOT VALID, validation, and rollback package", () => {
    const candidate = loadRem8TargetConstraintPackage();

    expect(candidate.functionSignature).toBe(CANDIDATE_FUNCTION_SIGNATURE);
    expect(candidate.constraintName).toBe(CANDIDATE_CONSTRAINT_NAME);
    expect(candidate.indexStrategy).toBe("not_applicable_no_index_candidate");
    expect(candidate.addLock).toBe("access_exclusive");
    expect(candidate.validateLock).toBe("share_update_exclusive");
    expect(candidate.digests).toEqual({
      addConstraint: expect.stringMatching(/^[a-f0-9]{64}$/),
      createFunction: expect.stringMatching(/^[a-f0-9]{64}$/),
      rollback: expect.stringMatching(/^[a-f0-9]{64}$/),
      validateConstraint: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });

  it.each([
    ["function replacement", "createFunction", (sql: string) => sql.replace("CREATE FUNCTION", "CREATE OR REPLACE FUNCTION"), "candidate_function_replace_refused"],
    ["index DDL", "addConstraint", (sql: string) => `${sql}\nCREATE INDEX forbidden ON ops.target_distribution_request (store_id);`, "candidate_index_refused"],
    ["valid-at-add", "addConstraint", (sql: string) => sql.replace(" NOT VALID", ""), "candidate_not_valid_required"],
    ["wrong rollback order", "rollback", (sql: string) => sql.replace(/ALTER TABLE[\s\S]*?;\s*/i, ""), "candidate_rollback_mismatch"],
  ])("rejects %s", (_name, field, mutate, expected) => {
    const candidate = loadRem8TargetConstraintPackage();
    const value = {
      ...candidate.sql,
      [field]: mutate(candidate.sql[field as keyof typeof candidate.sql]),
    };
    expect(() => validateRem8TargetConstraintPackage(value)).toThrow(expected);
  });
});
