import {
  createDbc5ApplyReceipt,
  createDualCandidateDigests,
  validateDbc5ApplyReceipt,
  validateDbc5Prerequisites,
} from "../scripts/dbc5-target-constraint-apply-contract";
import {
  validateRem8ObservationReceipt,
} from "../scripts/rem8-target-constraint-observation-contract";
import {
  validateRem8RehearsalReceipt,
} from "../scripts/rem8-target-constraint-rehearsal-contract";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sha256Canonical } from "../scripts/staging-remediation-diagnostic-contract";

describe("DB-C5 TARGET apply receipt and prerequisite contract", () => {
  const root = join(__dirname, "..", "..", "..");
  const observation = validateRem8ObservationReceipt(JSON.parse(readFileSync(join(
    root, "docs", "evidence", "readiness",
    "2026-07-12-staging-rem8-target-constraint-observation-v1.json",
  ), "utf8")));
  const rehearsal = validateRem8RehearsalReceipt(JSON.parse(readFileSync(join(
    root, "docs", "evidence", "readiness",
    "2026-07-12-staging-rem8-target-constraint-disposable-rehearsal-v1.json",
  ), "utf8")));
  const packageRoot = join(root, "db", "constraint-packages", "rem8-target-duplicate-v1");
  const sql = {
    addConstraint: readFileSync(join(packageRoot, "002_add_constraint_not_valid.sql"), "utf8"),
    createFunction: readFileSync(join(packageRoot, "001_create_function.sql"), "utf8"),
    rollback: readFileSync(join(packageRoot, "rollback.sql"), "utf8"),
    validateConstraint: readFileSync(join(packageRoot, "003_validate_constraint.sql"), "utf8"),
  };

  // Trace: FR-01, FR-02; NFR-01, NFR-04; AC-01; EC-01.
  it("binds LF Git identities and CRLF REM-8 evidence identities explicitly", () => {
    const dual = createDualCandidateDigests(sql);
    expect(dual.evidenceCrlf).toEqual({
      addConstraint: observation.queryResult.candidate.addConstraintDigest,
      createFunction: observation.queryResult.candidate.functionDigest,
      rollback: observation.queryResult.candidate.rollbackDigest,
      validateConstraint: observation.queryResult.candidate.validateConstraintDigest,
    });
    expect(dual.gitLf.addConstraint).not.toBe(dual.evidenceCrlf.addConstraint);
    expect(validateDbc5Prerequisites(observation, rehearsal, dual)).toEqual({
      decision: "rem_8c_not_required",
      ready: true,
    });
  });

  it("rejects a self-consistent receipt that is not the exact merged REM-8 evidence", () => {
    const altered = structuredClone(rehearsal) as unknown as Record<string, unknown>;
    altered.reviewedCommit = "c".repeat(40);
    delete altered.receiptDigest;
    altered.receiptDigest = sha256Canonical(altered);
    expect(() => validateDbc5Prerequisites(
      observation,
      altered,
      createDualCandidateDigests(sql),
    )).toThrow("rem8_evidence_provenance_mismatch");
  });

  // Trace: FR-06, FR-07; NFR-01..05; AC-03, AC-04; EC-07, EC-09.
  it("creates and validates an exact sanitized staging apply receipt", () => {
    const receipt = createDbc5ApplyReceipt(validInput());
    expect(validateDbc5ApplyReceipt(receipt)).toEqual(receipt);
    expect(receipt).toMatchObject({
      event: "dbc5_target_constraint.apply_completed",
      stagingDdlExecuted: true,
      targetClass: "staging",
      tlsMode: "verify-full",
    });
  });

  it.each([
    ["extra field", (receipt: Record<string, unknown>) => { receipt.rawHost = "hidden"; }],
    ["writer failure", (receipt: Record<string, unknown>) => {
      (receipt.migration as Record<string, unknown>).failedCount = 1;
    }],
    ["invalid constraint", (receipt: Record<string, unknown>) => {
      (receipt.postflight as Record<string, unknown>).constraintState = "present_not_valid";
    }],
    ["digest tamper", (receipt: Record<string, unknown>) => { receipt.receiptDigest = "0".repeat(64); }],
  ])("rejects %s", (_name, mutate) => {
    const receipt = createDbc5ApplyReceipt(validInput());
    mutate(receipt as unknown as Record<string, unknown>);
    expect(() => validateDbc5ApplyReceipt(receipt)).toThrow();
  });

  function validInput(): Parameters<typeof createDbc5ApplyReceipt>[0] {
    const dual = createDualCandidateDigests(sql);
    return {
      candidateDigests: dual,
      certificateVerified: true,
      evidenceReceipts: {
        observation: observation.receiptDigest,
        rehearsal: rehearsal.receiptDigest,
      },
      migration: {
        appliedCount: 1,
        checksum: "a".repeat(64),
        checksumStyles: { gitLf: 59, windowsCrlf: 0 },
        failedCount: 0,
        name: "060_target_distribution_duplicate_employee_constraint_v1.sql",
        skippedCount: 59,
      },
      postflight: {
        activeTargetV2Hits: 0,
        constraintState: "present_valid_exact",
        functionState: "present_immutable_exact",
        indexStrategy: "not_applicable_no_index_candidate",
        migrationState: "succeeded_exact",
        transactionReadOnly: true,
      },
      preflight: {
        lockBuckets: 1,
        over30sTransactions: 0,
        state: "eligible",
        targetLiveRows: 61,
        transactionIsolation: "repeatable_read",
        transactionReadOnly: true,
      },
      reviewedCommit: "b".repeat(40),
      runnerDigest: "c".repeat(64),
      targetFingerprint: "d".repeat(64),
    };
  }
});
