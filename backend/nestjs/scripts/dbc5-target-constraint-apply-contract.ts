import {
  assertSanitizedDiagnosticJson,
  sha256Canonical,
  sha256Hex,
} from "./staging-remediation-diagnostic-contract";
import {
  validateRem8ObservationReceipt,
  type Rem8ObservationReceipt,
} from "./rem8-target-constraint-observation-contract";
import {
  decideRem8C,
  validateRem8RehearsalReceipt,
  type Rem8RehearsalReceipt,
} from "./rem8-target-constraint-rehearsal-contract";
import type { Rem8TargetConstraintSql } from "./rem8-target-constraint-package-contract";

export const DBC5_MIGRATION_NAME =
  "060_target_distribution_duplicate_employee_constraint_v1.sql" as const;
export const DBC5_REM8_PROVENANCE = Object.freeze({
  observationReceiptDigest: "450ea647b22152a0bf476478fe472abcb398c3f55c1489c834a88e607a6f6aeb",
  rehearsalReceiptDigest: "db1359e9086754ae6f7382648cbdd8ac728f90d9f5539de67448b3c9b5dbabda",
  reviewedCommit: "b60776c033528438118322b8b09652f16909f78d",
});

type CandidateDigestSet = {
  addConstraint: string;
  createFunction: string;
  rollback: string;
  validateConstraint: string;
};

export type DualCandidateDigests = {
  evidenceCrlf: CandidateDigestSet;
  gitLf: CandidateDigestSet;
};

export type Dbc5ApplyReceipt = {
  candidateDigests: DualCandidateDigests;
  certificateVerified: true;
  event: "dbc5_target_constraint.apply_completed";
  evidenceReceipts: { observation: string; rehearsal: string };
  migration: {
    appliedCount: 1;
    checksum: string;
    checksumStyles: { gitLf: number; windowsCrlf: number };
    failedCount: 0;
    name: typeof DBC5_MIGRATION_NAME;
    skippedCount: 59;
  };
  postflight: {
    activeTargetV2Hits: 0;
    constraintState: "present_valid_exact";
    functionState: "present_immutable_exact";
    indexStrategy: "not_applicable_no_index_candidate";
    migrationState: "succeeded_exact";
    transactionReadOnly: true;
  };
  preflight: {
    lockBuckets: number;
    over30sTransactions: 0;
    state: "eligible";
    targetLiveRows: number;
    transactionIsolation: "repeatable_read";
    transactionReadOnly: true;
  };
  receiptDigest: string;
  receiptVersion: "1";
  reviewedCommit: string;
  runnerDigest: string;
  stagingDdlExecuted: true;
  targetClass: "staging";
  targetFingerprint: string;
  timeoutProfile: {
    connectionMs: 5000;
    idleMs: 1000;
    lockMs: 5000;
    queryMs: 30000;
    statementMs: 30000;
  };
  tlsMode: "verify-full";
};

type ApplyInput = Omit<
  Dbc5ApplyReceipt,
  "event" | "receiptDigest" | "receiptVersion" | "stagingDdlExecuted" |
  "targetClass" | "timeoutProfile" | "tlsMode"
>;

const hex40 = /^[a-f0-9]{40}$/;
const hex64 = /^[a-f0-9]{64}$/;

// Trace: FR-01, FR-02; NFR-01, NFR-04; AC-01; EC-01.
export function createDualCandidateDigests(sql: Rem8TargetConstraintSql): DualCandidateDigests {
  return {
    evidenceCrlf: digestSqlSet(sql, crlf),
    gitLf: digestSqlSet(sql, lf),
  };
}

export function validateDbc5Prerequisites(
  observationValue: unknown,
  rehearsalValue: unknown,
  candidateDigests: DualCandidateDigests,
) {
  const observation = validateRem8ObservationReceipt(observationValue);
  const rehearsal = validateRem8RehearsalReceipt(rehearsalValue);
  if (observation.reviewedCommit !== DBC5_REM8_PROVENANCE.reviewedCommit
    || rehearsal.reviewedCommit !== DBC5_REM8_PROVENANCE.reviewedCommit
    || observation.receiptDigest !== DBC5_REM8_PROVENANCE.observationReceiptDigest
    || rehearsal.receiptDigest !== DBC5_REM8_PROVENANCE.rehearsalReceiptDigest) {
    fail("rem8_evidence_provenance_mismatch");
  }
  const dual = readDualDigests(candidateDigests);
  const expectedEvidence = {
    addConstraint: observation.queryResult.candidate.addConstraintDigest,
    createFunction: observation.queryResult.candidate.functionDigest,
    rollback: observation.queryResult.candidate.rollbackDigest,
    validateConstraint: observation.queryResult.candidate.validateConstraintDigest,
  };
  if (!sameDigests(dual.evidenceCrlf, expectedEvidence)
    || !sameDigests(dual.evidenceCrlf, rehearsal.packageDigests)) {
    fail("candidate_evidence_digest_mismatch");
  }
  const decision = decideRem8C(observation.queryResult, rehearsal);
  if (decision.decision !== "rem_8c_not_required" || decision.stagingDdlExecuted !== false) {
    fail("rem8_decision_not_ready");
  }
  return { decision: "rem_8c_not_required" as const, ready: true as const };
}

// Trace: FR-06, FR-07; NFR-01..05; AC-03, AC-04; EC-07, EC-09.
export function createDbc5ApplyReceipt(input: ApplyInput): Dbc5ApplyReceipt {
  const withoutDigest = {
    ...input,
    event: "dbc5_target_constraint.apply_completed" as const,
    receiptVersion: "1" as const,
    stagingDdlExecuted: true as const,
    targetClass: "staging" as const,
    timeoutProfile: {
      connectionMs: 5000 as const,
      idleMs: 1000 as const,
      lockMs: 5000 as const,
      queryMs: 30000 as const,
      statementMs: 30000 as const,
    },
    tlsMode: "verify-full" as const,
  };
  return validateDbc5ApplyReceipt({
    ...withoutDigest,
    receiptDigest: sha256Canonical(withoutDigest),
  });
}

export function validateDbc5ApplyReceipt(value: unknown): Dbc5ApplyReceipt {
  const receipt = exactObject(value, [
    "candidateDigests", "certificateVerified", "event", "evidenceReceipts", "migration",
    "postflight", "preflight", "receiptDigest", "receiptVersion", "reviewedCommit",
    "runnerDigest", "stagingDdlExecuted", "targetClass", "targetFingerprint",
    "timeoutProfile", "tlsMode",
  ], "dbc5_receipt_schema_mismatch");
  if (receipt.event !== "dbc5_target_constraint.apply_completed"
    || receipt.receiptVersion !== "1" || receipt.certificateVerified !== true
    || receipt.stagingDdlExecuted !== true || receipt.targetClass !== "staging"
    || receipt.tlsMode !== "verify-full") fail("dbc5_receipt_schema_mismatch");
  if (!hex40.test(String(receipt.reviewedCommit))) fail("invalid_reviewed_commit");
  const evidenceReceipts = readEvidenceReceipts(receipt.evidenceReceipts);
  const candidateDigests = readDualDigests(receipt.candidateDigests);
  const migration = readMigration(receipt.migration);
  const preflight = readPreflight(receipt.preflight);
  const postflight = readPostflight(receipt.postflight);
  const timeoutProfile = exactObject(receipt.timeoutProfile, [
    "connectionMs", "idleMs", "lockMs", "queryMs", "statementMs",
  ], "invalid_timeout_profile");
  if (timeoutProfile.connectionMs !== 5000 || timeoutProfile.idleMs !== 1000
    || timeoutProfile.lockMs !== 5000 || timeoutProfile.queryMs !== 30000
    || timeoutProfile.statementMs !== 30000) fail("invalid_timeout_profile");
  for (const digest of [receipt.receiptDigest, receipt.runnerDigest, receipt.targetFingerprint]) {
    requireDigest(digest, "invalid_digest");
  }
  const typed: Dbc5ApplyReceipt = {
    candidateDigests,
    certificateVerified: true,
    event: "dbc5_target_constraint.apply_completed",
    evidenceReceipts,
    migration,
    postflight,
    preflight,
    receiptDigest: String(receipt.receiptDigest),
    receiptVersion: "1",
    reviewedCommit: String(receipt.reviewedCommit),
    runnerDigest: String(receipt.runnerDigest),
    stagingDdlExecuted: true,
    targetClass: "staging",
    targetFingerprint: String(receipt.targetFingerprint),
    timeoutProfile: {
      connectionMs: 5000, idleMs: 1000, lockMs: 5000, queryMs: 30000, statementMs: 30000,
    },
    tlsMode: "verify-full",
  };
  const { receiptDigest, ...withoutDigest } = typed;
  if (sha256Canonical(withoutDigest) !== receiptDigest) fail("receipt_digest_mismatch");
  assertSanitizedDiagnosticJson(JSON.stringify(typed));
  return typed;
}

function digestSqlSet(sql: Rem8TargetConstraintSql, normalize: (value: string) => string) {
  return {
    addConstraint: sha256Hex(normalize(sql.addConstraint)),
    createFunction: sha256Hex(normalize(sql.createFunction)),
    rollback: sha256Hex(normalize(sql.rollback)),
    validateConstraint: sha256Hex(normalize(sql.validateConstraint)),
  };
}

function lf(value: string) { return value.replace(/\r\n/g, "\n"); }
function crlf(value: string) { return lf(value).replace(/\n/g, "\r\n"); }

function readDualDigests(value: unknown): DualCandidateDigests {
  const item = exactObject(value, ["evidenceCrlf", "gitLf"], "invalid_candidate_digests");
  return { evidenceCrlf: readDigestSet(item.evidenceCrlf), gitLf: readDigestSet(item.gitLf) };
}

function readDigestSet(value: unknown): CandidateDigestSet {
  const item = exactObject(value, [
    "addConstraint", "createFunction", "rollback", "validateConstraint",
  ], "invalid_candidate_digests");
  return {
    addConstraint: requireDigest(item.addConstraint, "invalid_candidate_digest"),
    createFunction: requireDigest(item.createFunction, "invalid_candidate_digest"),
    rollback: requireDigest(item.rollback, "invalid_candidate_digest"),
    validateConstraint: requireDigest(item.validateConstraint, "invalid_candidate_digest"),
  };
}

function readEvidenceReceipts(value: unknown) {
  const item = exactObject(value, ["observation", "rehearsal"], "invalid_evidence_receipts");
  return {
    observation: requireDigest(item.observation, "invalid_evidence_digest"),
    rehearsal: requireDigest(item.rehearsal, "invalid_evidence_digest"),
  };
}

function readMigration(value: unknown): Dbc5ApplyReceipt["migration"] {
  const item = exactObject(value, [
    "appliedCount", "checksum", "checksumStyles", "failedCount", "name", "skippedCount",
  ], "invalid_migration_proof");
  const styles = exactObject(item.checksumStyles, ["gitLf", "windowsCrlf"], "invalid_checksum_styles");
  const gitLf = safeCount(styles.gitLf, "invalid_checksum_styles");
  const windowsCrlf = safeCount(styles.windowsCrlf, "invalid_checksum_styles");
  if (gitLf + windowsCrlf !== 59 || item.appliedCount !== 1 || item.failedCount !== 0
    || item.skippedCount !== 59 || item.name !== DBC5_MIGRATION_NAME) {
    fail("invalid_migration_proof");
  }
  return {
    appliedCount: 1,
    checksum: requireDigest(item.checksum, "invalid_migration_checksum"),
    checksumStyles: { gitLf, windowsCrlf },
    failedCount: 0,
    name: DBC5_MIGRATION_NAME,
    skippedCount: 59,
  };
}

function readPreflight(value: unknown): Dbc5ApplyReceipt["preflight"] {
  const item = exactObject(value, [
    "lockBuckets", "over30sTransactions", "state", "targetLiveRows",
    "transactionIsolation", "transactionReadOnly",
  ], "invalid_preflight");
  if (item.state !== "eligible" || item.over30sTransactions !== 0
    || item.transactionIsolation !== "repeatable_read" || item.transactionReadOnly !== true) {
    fail("invalid_preflight");
  }
  return {
    lockBuckets: safeCount(item.lockBuckets, "invalid_preflight"),
    over30sTransactions: 0,
    state: "eligible",
    targetLiveRows: safeCount(item.targetLiveRows, "invalid_preflight"),
    transactionIsolation: "repeatable_read",
    transactionReadOnly: true,
  };
}

function readPostflight(value: unknown): Dbc5ApplyReceipt["postflight"] {
  const item = exactObject(value, [
    "activeTargetV2Hits", "constraintState", "functionState", "indexStrategy", "migrationState",
    "transactionReadOnly",
  ], "invalid_postflight");
  if (item.activeTargetV2Hits !== 0 || item.constraintState !== "present_valid_exact"
    || item.functionState !== "present_immutable_exact"
    || item.indexStrategy !== "not_applicable_no_index_candidate"
    || item.migrationState !== "succeeded_exact"
    || item.transactionReadOnly !== true) fail("invalid_postflight");
  return {
    activeTargetV2Hits: 0,
    constraintState: "present_valid_exact",
    functionState: "present_immutable_exact",
    indexStrategy: "not_applicable_no_index_candidate",
    migrationState: "succeeded_exact",
    transactionReadOnly: true,
  };
}

function sameDigests(left: CandidateDigestSet, right: CandidateDigestSet) {
  return Object.keys(left).every((key) =>
    left[key as keyof CandidateDigestSet] === right[key as keyof CandidateDigestSet]);
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

function requireDigest(value: unknown, error: string) {
  const digest = String(value ?? "");
  if (!hex64.test(digest)) fail(error);
  return digest;
}

function fail(message: string): never { throw new Error(message); }
