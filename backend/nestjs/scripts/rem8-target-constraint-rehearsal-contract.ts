import {
  assertSanitizedDiagnosticJson,
  sha256Canonical,
} from "./staging-remediation-diagnostic-contract";
import {
  validateRem8Observation,
  type Rem8Observation,
} from "./rem8-target-constraint-observation-contract";

export type Rem8RehearsalReceipt = {
  addConstraintMs: number;
  cleanupVerified: true;
  constraintValidated: true;
  dumpDigest: string;
  duplicateWriteRejected: true;
  event: "rem8_target_constraint.disposable_rehearsal_completed";
  failureValidationSqlState: "23514";
  indexStrategy: "not_applicable_no_index_candidate";
  lockTimeoutSqlState: "55P03";
  migrationCount: number;
  packageDigests: {
    addConstraint: string;
    createFunction: string;
    rollback: string;
    validateConstraint: string;
  };
  receiptDigest: string;
  receiptVersion: "1";
  representativeness: "schema_writer_and_scale_contract_only";
  restoreAggregateDigest: string;
  restoreSourceClass: "synthetic_migrated_fixture";
  restoredTargetRows: number;
  reviewedCommit: string;
  rollbackMs: number;
  runnerDigest: string;
  sourceAggregateDigest: string;
  syntheticScaleRows: number;
  validateConstraintMs: number;
  writerAttempts: number;
  writerFailures: 0;
  writerSuccesses: number;
};

export type Rem8Decision = {
  decision: "rem_8c_not_required" | "rem_8c_required" | "blocked";
  reasons: string[];
  stagingDdlExecuted: false;
};

type RehearsalInput = Omit<
  Rem8RehearsalReceipt,
  "event" | "receiptDigest" | "receiptVersion"
>;

const hex40 = /^[a-f0-9]{40}$/;
const hex64 = /^[a-f0-9]{64}$/;

// Trace: FR-11..17; NFR-02..04, NFR-09; AC-04..08; EC-11..15.
export function createRem8RehearsalReceipt(input: RehearsalInput): Rem8RehearsalReceipt {
  const withoutDigest = {
    ...input,
    event: "rem8_target_constraint.disposable_rehearsal_completed" as const,
    receiptVersion: "1" as const,
  };
  return validateRem8RehearsalReceipt({
    ...withoutDigest,
    receiptDigest: sha256Canonical(withoutDigest),
  });
}

export function validateRem8RehearsalReceipt(value: unknown): Rem8RehearsalReceipt {
  const receipt = exactObject(value, [
    "addConstraintMs", "cleanupVerified", "constraintValidated", "dumpDigest",
    "duplicateWriteRejected", "event", "failureValidationSqlState", "indexStrategy",
    "lockTimeoutSqlState", "migrationCount", "packageDigests", "receiptDigest",
    "receiptVersion", "representativeness", "restoreAggregateDigest", "restoreSourceClass",
    "restoredTargetRows", "reviewedCommit", "rollbackMs", "runnerDigest",
    "sourceAggregateDigest", "syntheticScaleRows", "validateConstraintMs", "writerAttempts",
    "writerFailures", "writerSuccesses",
  ], "rehearsal_receipt_schema_mismatch");
  if (receipt.event !== "rem8_target_constraint.disposable_rehearsal_completed"
    || receipt.receiptVersion !== "1") fail("rehearsal_receipt_schema_mismatch");
  if (receipt.restoreSourceClass !== "synthetic_migrated_fixture"
    || receipt.representativeness !== "schema_writer_and_scale_contract_only") {
    fail("invalid_restore_classification");
  }
  if (receipt.failureValidationSqlState !== "23514") fail("invalid_failure_validation_sqlstate");
  if (receipt.lockTimeoutSqlState !== "55P03") fail("invalid_lock_timeout_sqlstate");
  if (receipt.indexStrategy !== "not_applicable_no_index_candidate") fail("invalid_index_strategy");
  if (receipt.cleanupVerified !== true || receipt.constraintValidated !== true
    || receipt.duplicateWriteRejected !== true) fail("incomplete_rehearsal_proof");
  if (!hex40.test(String(receipt.reviewedCommit))) fail("invalid_reviewed_commit");
  for (const digest of [
    receipt.dumpDigest,
    receipt.receiptDigest,
    receipt.restoreAggregateDigest,
    receipt.runnerDigest,
    receipt.sourceAggregateDigest,
  ]) requireDigest(digest, "invalid_digest");
  const packageDigests = readPackageDigests(receipt.packageDigests);
  if (receipt.sourceAggregateDigest !== receipt.restoreAggregateDigest) {
    fail("restore_aggregate_mismatch");
  }
  const migrationCount = positiveCount(receipt.migrationCount, "invalid_migration_count");
  const restoredTargetRows = positiveCount(receipt.restoredTargetRows, "invalid_target_row_count");
  const syntheticScaleRows = positiveCount(receipt.syntheticScaleRows, "invalid_synthetic_scale");
  if (restoredTargetRows < syntheticScaleRows) fail("invalid_target_row_count");
  const writerAttempts = positiveCount(receipt.writerAttempts, "invalid_writer_count");
  const writerSuccesses = safeCount(receipt.writerSuccesses, "invalid_writer_count");
  const writerFailures = safeCount(receipt.writerFailures, "invalid_writer_count");
  if (writerFailures !== 0 || writerAttempts !== writerSuccesses + writerFailures) {
    fail("writer_compatibility_failed");
  }
  const typed: Rem8RehearsalReceipt = {
    addConstraintMs: duration(receipt.addConstraintMs, "invalid_rehearsal_duration"),
    cleanupVerified: true,
    constraintValidated: true,
    dumpDigest: String(receipt.dumpDigest),
    duplicateWriteRejected: true,
    event: "rem8_target_constraint.disposable_rehearsal_completed",
    failureValidationSqlState: "23514",
    indexStrategy: "not_applicable_no_index_candidate",
    lockTimeoutSqlState: "55P03",
    migrationCount,
    packageDigests,
    receiptDigest: String(receipt.receiptDigest),
    receiptVersion: "1",
    representativeness: "schema_writer_and_scale_contract_only",
    restoreAggregateDigest: String(receipt.restoreAggregateDigest),
    restoreSourceClass: "synthetic_migrated_fixture",
    restoredTargetRows,
    reviewedCommit: String(receipt.reviewedCommit),
    rollbackMs: duration(receipt.rollbackMs, "invalid_rehearsal_duration"),
    runnerDigest: String(receipt.runnerDigest),
    sourceAggregateDigest: String(receipt.sourceAggregateDigest),
    syntheticScaleRows,
    validateConstraintMs: duration(receipt.validateConstraintMs, "invalid_rehearsal_duration"),
    writerAttempts,
    writerFailures: 0,
    writerSuccesses,
  };
  const { receiptDigest, ...withoutDigest } = typed;
  if (sha256Canonical(withoutDigest) !== receiptDigest) fail("receipt_digest_mismatch");
  assertSanitizedDiagnosticJson(JSON.stringify(typed));
  return typed;
}

// Trace: FR-18; NFR-09; AC-09; EC-09, EC-10, EC-14.
export function decideRem8C(
  observationValue: unknown,
  rehearsalValue: unknown,
): Rem8Decision {
  const observation = validateRem8Observation(observationValue);
  const rehearsal = validateRem8RehearsalReceipt(rehearsalValue);
  if (observation.state !== "eligible_for_disposable_rehearsal") {
    return { decision: "blocked", reasons: ["observation_blocked"], stagingDdlExecuted: false };
  }
  if (!packageDigestsMatch(observation, rehearsal)) {
    return { decision: "blocked", reasons: ["package_digest_mismatch"], stagingDdlExecuted: false };
  }
  const reasons: string[] = [];
  if (observation.targetTable.liveRows > rehearsal.syntheticScaleRows) {
    reasons.push("staging_scale_exceeds_rehearsal");
  }
  if (observation.transactions.over30sCount > 0) {
    reasons.push("staging_long_transaction_pressure");
  }
  if (observation.locks.some((lock) => !lock.granted
    || (lock.granted && ["AccessExclusiveLock", "ShareUpdateExclusiveLock"].includes(lock.mode)))) {
    reasons.push("staging_conflicting_lock_pressure");
  }
  if (reasons.length > 0) {
    return { decision: "rem_8c_required", reasons, stagingDdlExecuted: false };
  }
  return {
    decision: "rem_8c_not_required",
    reasons: ["staging_fits_conservative_disposable_envelope"],
    stagingDdlExecuted: false,
  };
}

function packageDigestsMatch(
  observation: Rem8Observation,
  rehearsal: Rem8RehearsalReceipt,
) {
  return observation.candidate.addConstraintDigest === rehearsal.packageDigests.addConstraint
    && observation.candidate.functionDigest === rehearsal.packageDigests.createFunction
    && observation.candidate.rollbackDigest === rehearsal.packageDigests.rollback
    && observation.candidate.validateConstraintDigest === rehearsal.packageDigests.validateConstraint;
}

function readPackageDigests(value: unknown): Rem8RehearsalReceipt["packageDigests"] {
  const item = exactObject(value, [
    "addConstraint", "createFunction", "rollback", "validateConstraint",
  ], "invalid_package_digests");
  return {
    addConstraint: requireDigest(item.addConstraint, "invalid_package_digest"),
    createFunction: requireDigest(item.createFunction, "invalid_package_digest"),
    rollback: requireDigest(item.rollback, "invalid_package_digest"),
    validateConstraint: requireDigest(item.validateConstraint, "invalid_package_digest"),
  };
}

function exactObject(value: unknown, keys: string[], error: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(error);
  const actual = Object.keys(value as object).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    fail(error);
  }
  return value as Record<string, unknown>;
}

function safeCount(value: unknown, error: string) {
  if (!Number.isSafeInteger(value) || (value as number) < 0) fail(error);
  return value as number;
}

function positiveCount(value: unknown, error: string) {
  const result = safeCount(value, error);
  if (result === 0) fail(error);
  return result;
}

function duration(value: unknown, error: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) fail(error);
  return value;
}

function requireDigest(value: unknown, error: string) {
  const digest = String(value ?? "");
  if (!hex64.test(digest)) fail(error);
  return digest;
}

function fail(message: string): never {
  throw new Error(message);
}
