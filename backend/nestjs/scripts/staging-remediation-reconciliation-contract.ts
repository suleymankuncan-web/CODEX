import type { CheckRow } from "./database-invariant-preflight-core";
import {
  assertSanitizedDiagnosticJson,
  sha256Canonical,
} from "./staging-remediation-diagnostic-contract";
import {
  INVARIANT_V2_QUERY_SET_VERSION,
  validateInvariantV2QueryResult,
  type InvariantV2QueryResult,
} from "./staging-remediation-invariant-v2-contract";
import {
  buildAuthorityClassifierResult,
  validateAuthorityClassifierResult,
  type AuthorityClassifierResult,
} from "./staging-remediation-row-authority-classifier-contract";
import {
  constraintEligibilities,
  decisionRefs,
  invariantV1Checks,
  nextGates,
  reconciliationFamilies,
  reconciliationReasons,
  terminalStates,
  type ConstraintEligibility,
  type NextGate,
  type ReconciliationFamily,
  type ReconciliationReason,
  type TerminalState,
} from "./staging-remediation-reconciliation-allowlists";

export const RECONCILIATION_QUERY_SET_VERSION =
  "staging-remediation-reconciliation-v1" as const;

export type SourceDigests = {
  authorityClassifierV1: string;
  invariantV1: string;
  invariantV2: string;
};

export type FamilyReconciliation = {
  activeCount: number;
  activeQuerySetVersion: typeof INVARIANT_V2_QUERY_SET_VERSION;
  authorityUnitCount?: number;
  constraintEligibility: ConstraintEligibility;
  decisionRefs: string[];
  family: ReconciliationFamily;
  nextGate: NextGate;
  reason: ReconciliationReason;
  state: TerminalState;
  v1ContinuityCount: number;
};

export type ReconciliationResult = {
  applicationContracts: [{
    code: "target_duplicate_employee_rejected";
    sourceDigest: string;
    state: "present";
  }];
  families: FamilyReconciliation[];
  observedAt: string;
  overallState: "target_eligible_other_families_blocked" | "blocked";
  querySetVersion: typeof RECONCILIATION_QUERY_SET_VERSION;
  sourceDigests: SourceDigests;
};

export type ReconciliationReceipt = {
  certificateVerified: boolean;
  event: "staging_remediation_reconciliation.completed";
  queryResult: ReconciliationResult;
  receiptDigest: string;
  receiptVersion: "1";
  reviewedCommit: string;
  runnerDigest: string;
  targetClass: "disposable" | "staging";
  targetFingerprint: string;
  timeoutProfile: { connectionMs: 5000; idleMs: 1000; queryMs: 30000; statementMs: 30000 };
  tlsMode: "disable" | "verify-full";
  transactionIsolation: "repeatable_read";
  transactionReadOnly: true;
};

// The authority classifier owns only ORG/assignment families. Its historical
// strict contract pins TARGET to zero, so reconciliation validates a target-free
// projection while retaining the unmodified V2 result for TARGET disposition.
// Trace: FR-04, FR-05, FR-07; AC-04, AC-05; EC-03, EC-05.
export function buildReconciliationAuthorityResult(
  value: unknown,
  invariantV2Value: unknown,
) {
  const invariantV2 = validateInvariantV2QueryResult(invariantV2Value);
  const targetBridge = invariantV2.bridge.find((item) => item.family === "TARGET-02");
  if (!targetBridge) fail("terminal_state_prerequisite_missing");
  const targetCount = invariantV2.familyTotals.find((item) => item.family === "TARGET-02")?.hitCount;
  if (targetCount === undefined) fail("terminal_state_prerequisite_missing");
  const authorityProjection: InvariantV2QueryResult = {
    ...invariantV2,
    bridge: invariantV2.bridge.map((item) => item.family === "TARGET-02" ? {
      ...item,
      carriedForwardCount: 0,
      revisedValidCount: item.v1HitCount,
      v2HitCount: 0,
      v2NewCount: 0,
    } : item),
    familyTotals: invariantV2.familyTotals.map((item) => item.family === "TARGET-02"
      ? { ...item, hitCount: 0 }
      : item),
    hits: invariantV2.hits.filter((item) => !item.invariant.startsWith("target.")),
    overallCheckHits: {
      count: invariantV2.overallCheckHits.count - targetCount,
      unit: "check_hits",
    },
  };
  return buildAuthorityClassifierResult(value, validateInvariantV2QueryResult(authorityProjection));
}

const hex12 = /^[a-f0-9]{12}$/;
const hex40 = /^[a-f0-9]{40}$/;
const hex64 = /^[a-f0-9]{64}$/;

// Trace: FR-01..10; NFR-01, NFR-02; AC-01..05; EC-01..08, EC-12.
export function buildReconciliationResult(
  v1Rows: CheckRow[],
  invariantV2Value: unknown,
  authorityValue: unknown,
  applicationContractDigest: string,
  sourceDigests: SourceDigests,
): ReconciliationResult {
  const v1 = validateV1Rows(v1Rows);
  const v2 = validateInvariantV2QueryResult(invariantV2Value);
  const authority = validateAuthorityClassifierResult(authorityValue);
  const digests = readSourceDigests(sourceDigests);
  requireDigest(applicationContractDigest, "application_contract_digest_missing");

  if (Date.parse(v2.observedAt) !== Date.parse(authority.observedAt)) {
    fail("snapshot_observation_mismatch");
  }
  const v2Totals = new Map(v2.familyTotals.map((item) => [item.family, item.hitCount]));
  const authorityTotals = new Map(authority.familyTotals.map((item) => [item.family, item]));
  for (const bridge of v2.bridge) {
    if (v1.get(bridge.family) !== bridge.v1HitCount) {
      fail("v1_v2_reconciliation_mismatch");
    }
  }
  for (const family of ["ORG-02", "ORG-04", "ASSIGN-01"] as const) {
    if (authorityTotals.get(family)?.checkHitCount !== v2Totals.get(family)) {
      fail("authority_reconciliation_mismatch");
    }
  }
  const authorityUnitTotal = authority.familyTotals.reduce(
    (sum, item) => sum + item.authorityUnitCount,
    0,
  );
  if (authorityUnitTotal !== authority.overall.authorityUnitCount) {
    fail("authority_reconciliation_mismatch");
  }

  const targetEligible = v2Totals.get("TARGET-02") === 0 && v1.get("TARGET-03") === 0;
  const families: FamilyReconciliation[] = reconciliationFamilies.map((family) => {
    const bridge = v2.bridge.find((item) => item.family === family);
    if (!bridge) fail("terminal_state_prerequisite_missing");
    if (family === "TARGET-02") {
      return {
        activeCount: bridge.v2HitCount,
        activeQuerySetVersion: INVARIANT_V2_QUERY_SET_VERSION,
        constraintEligibility: targetEligible ? "eligible_after_rem8" : "blocked",
        decisionRefs: [...decisionRefs[family]],
        family,
        nextGate: targetEligible ? "rem_8" : "none",
        reason: targetEligible
          ? "target_zero_locked_preserve_application_enforced"
          : "target_prerequisite_missing",
        state: targetEligible ? "eligible_zero" : "blocked",
        v1ContinuityCount: bridge.v1HitCount,
      };
    }
    const authorityTotal = authorityTotals.get(family);
    if (!authorityTotal) fail("terminal_state_prerequisite_missing");
    return {
      activeCount: bridge.v2HitCount,
      activeQuerySetVersion: INVARIANT_V2_QUERY_SET_VERSION,
      authorityUnitCount: authorityTotal.authorityUnitCount,
      constraintEligibility: "blocked",
      decisionRefs: [...decisionRefs[family]],
      family,
      nextGate: "authoritative_row_evidence",
      reason: "authoritative_row_evidence_absent",
      state: "blocked",
      v1ContinuityCount: bridge.v1HitCount,
    };
  });
  return validateReconciliationResult({
    applicationContracts: [{
      code: "target_duplicate_employee_rejected",
      sourceDigest: applicationContractDigest,
      state: "present",
    }],
    families,
    observedAt: new Date(v2.observedAt).toISOString(),
    overallState: targetEligible ? "target_eligible_other_families_blocked" : "blocked",
    querySetVersion: RECONCILIATION_QUERY_SET_VERSION,
    sourceDigests: digests,
  });
}

export function validateReconciliationResult(value: unknown): ReconciliationResult {
  const result = exactObject(value, [
    "applicationContracts", "families", "observedAt", "overallState", "querySetVersion", "sourceDigests",
  ], "reconciliation_schema_mismatch");
  if (result.querySetVersion !== RECONCILIATION_QUERY_SET_VERSION) fail("query_set_version_mismatch");
  const observedAt = requiredString(result.observedAt, "invalid_observed_at");
  if (Number.isNaN(Date.parse(observedAt)) || new Date(observedAt).toISOString() !== observedAt) {
    fail("invalid_observed_at");
  }
  const sourceDigests = readSourceDigests(result.sourceDigests);
  const applications = requiredArray(result.applicationContracts, "invalid_application_contracts");
  if (applications.length !== 1) fail("invalid_application_contracts");
  const application = exactObject(applications[0], ["code", "sourceDigest", "state"], "invalid_application_contract");
  if (application.code !== "target_duplicate_employee_rejected" || application.state !== "present") {
    fail("terminal_state_prerequisite_missing");
  }
  const applicationDigest = requireDigest(application.sourceDigest, "application_contract_digest_missing");
  const families = requiredArray(result.families, "invalid_families").map(readFamily);
  if (families.length !== reconciliationFamilies.length
    || families.some((item, index) => item.family !== reconciliationFamilies[index])) {
    fail("incomplete_reconciliation_family_catalog");
  }
  const targetEligible = families[0].state === "eligible_zero";
  const expectedOverall = targetEligible ? "target_eligible_other_families_blocked" : "blocked";
  if (result.overallState !== expectedOverall) fail("dishonest_overall_state");
  if (families.slice(1).some((item) => item.state !== "blocked")) fail("terminal_state_prerequisite_missing");
  const typed: ReconciliationResult = {
    applicationContracts: [{
      code: "target_duplicate_employee_rejected",
      sourceDigest: applicationDigest,
      state: "present",
    }],
    families,
    observedAt,
    overallState: expectedOverall,
    querySetVersion: RECONCILIATION_QUERY_SET_VERSION,
    sourceDigests,
  };
  assertSanitizedDiagnosticJson(JSON.stringify(typed));
  return typed;
}

// Trace: FR-10, FR-11; NFR-01..04; AC-06; EC-09, EC-11.
export function createReconciliationReceipt(input: {
  certificateVerified: boolean;
  queryResult: ReconciliationResult;
  reviewedCommit: string;
  runnerDigest: string;
  targetClass: "disposable" | "staging";
  targetFingerprint: string;
  tlsMode: "disable" | "verify-full";
}): ReconciliationReceipt {
  const withoutDigest = {
    certificateVerified: input.certificateVerified,
    event: "staging_remediation_reconciliation.completed" as const,
    queryResult: validateReconciliationResult(input.queryResult),
    receiptVersion: "1" as const,
    reviewedCommit: input.reviewedCommit,
    runnerDigest: input.runnerDigest,
    targetClass: input.targetClass,
    targetFingerprint: input.targetFingerprint,
    timeoutProfile: {
      connectionMs: 5000 as const,
      idleMs: 1000 as const,
      queryMs: 30000 as const,
      statementMs: 30000 as const,
    },
    tlsMode: input.tlsMode,
    transactionIsolation: "repeatable_read" as const,
    transactionReadOnly: true as const,
  };
  return validateReconciliationReceipt({
    ...withoutDigest,
    receiptDigest: sha256Canonical(withoutDigest),
  });
}

export function validateReconciliationReceipt(value: unknown): ReconciliationReceipt {
  const receipt = exactObject(value, [
    "certificateVerified", "event", "queryResult", "receiptDigest", "receiptVersion",
    "reviewedCommit", "runnerDigest", "targetClass", "targetFingerprint", "timeoutProfile",
    "tlsMode", "transactionIsolation", "transactionReadOnly",
  ], "reconciliation_receipt_schema_mismatch");
  if (receipt.event !== "staging_remediation_reconciliation.completed" || receipt.receiptVersion !== "1") {
    fail("reconciliation_receipt_schema_mismatch");
  }
  if (!hex40.test(String(receipt.reviewedCommit))) fail("invalid_reviewed_commit");
  for (const digest of [receipt.runnerDigest, receipt.targetFingerprint, receipt.receiptDigest]) {
    requireDigest(digest, "invalid_digest");
  }
  if (receipt.targetClass !== "disposable" && receipt.targetClass !== "staging") {
    fail("reconciliation_receipt_schema_mismatch");
  }
  if (receipt.tlsMode !== "disable" && receipt.tlsMode !== "verify-full") {
    fail("reconciliation_receipt_schema_mismatch");
  }
  if (typeof receipt.certificateVerified !== "boolean") fail("reconciliation_receipt_schema_mismatch");
  if (receipt.targetClass === "staging"
    && (receipt.tlsMode !== "verify-full" || receipt.certificateVerified !== true)) {
    fail("certificate_verification_failed");
  }
  if (receipt.transactionIsolation !== "repeatable_read" || receipt.transactionReadOnly !== true) {
    fail("snapshot_contract_failed");
  }
  const timeout = exactObject(receipt.timeoutProfile, [
    "connectionMs", "idleMs", "queryMs", "statementMs",
  ], "invalid_timeout_profile");
  if (timeout.connectionMs !== 5000 || timeout.idleMs !== 1000
    || timeout.queryMs !== 30000 || timeout.statementMs !== 30000) {
    fail("invalid_timeout_profile");
  }
  const queryResult = validateReconciliationResult(receipt.queryResult);
  const typed = { ...receipt, queryResult } as unknown as ReconciliationReceipt;
  const { receiptDigest, ...withoutDigest } = typed;
  if (sha256Canonical(withoutDigest) !== receiptDigest) fail("receipt_digest_mismatch");
  assertSanitizedDiagnosticJson(JSON.stringify(typed));
  return typed;
}

export function validateV1Rows(rows: CheckRow[]) {
  if (!Array.isArray(rows) || rows.length !== invariantV1Checks.length) fail("v1_check_catalog_mismatch");
  const expected = new Map<string, string>(invariantV1Checks);
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (!row || typeof row !== "object" || !expected.has(row.check_id)) fail("v1_check_catalog_mismatch");
    if (counts.has(row.check_id) || row.category !== expected.get(row.check_id)) fail("v1_check_catalog_mismatch");
    const count = Number(row.violation_count);
    if (!Number.isSafeInteger(count) || count < 0) fail("invalid_v1_violation_count");
    const refs = Array.isArray(row.sample_refs) ? row.sample_refs : [];
    if (refs.length > 5 || refs.some((ref) => typeof ref !== "string" || !hex12.test(ref))) {
      fail("unsafe_v1_sample_ref");
    }
    counts.set(row.check_id, count);
  }
  if (counts.size !== expected.size) fail("v1_check_catalog_mismatch");
  return counts;
}

function readFamily(value: unknown): FamilyReconciliation {
  const item = exactObject(value, [
    "activeCount", "activeQuerySetVersion", "authorityUnitCount?", "constraintEligibility",
    "decisionRefs", "family", "nextGate", "reason", "state", "v1ContinuityCount",
  ], "invalid_family_reconciliation");
  const family = allowed(item.family, reconciliationFamilies, "invalid_reconciliation_family") as ReconciliationFamily;
  const state = allowed(item.state, terminalStates, "invalid_terminal_state") as TerminalState;
  const constraintEligibility = allowed(
    item.constraintEligibility,
    constraintEligibilities,
    "invalid_constraint_eligibility",
  ) as ConstraintEligibility;
  const nextGate = allowed(item.nextGate, nextGates, "invalid_next_gate") as NextGate;
  const reason = allowed(item.reason, reconciliationReasons, "invalid_reconciliation_reason") as ReconciliationReason;
  const refs = requiredArray(item.decisionRefs, "invalid_decision_refs").map((ref) => requiredString(ref, "invalid_decision_ref"));
  if (!sameMembers(refs, decisionRefs[family])) fail("invalid_decision_refs");
  const activeCount = safeCount(item.activeCount, "invalid_reconciliation_count");
  const v1ContinuityCount = safeCount(item.v1ContinuityCount, "invalid_reconciliation_count");
  if (item.activeQuerySetVersion !== INVARIANT_V2_QUERY_SET_VERSION) fail("active_query_set_version_mismatch");
  const authorityUnitCount = item.authorityUnitCount === undefined
    ? undefined
    : safeCount(item.authorityUnitCount, "invalid_authority_unit_count");
  if (family === "TARGET-02") {
    if (authorityUnitCount !== undefined) fail("invalid_authority_unit_count");
    const eligible = state === "eligible_zero";
    const eligibleContract = activeCount === 0
      && constraintEligibility === "eligible_after_rem8"
      && nextGate === "rem_8"
      && reason === "target_zero_locked_preserve_application_enforced";
    const blockedContract = state === "blocked"
      && constraintEligibility === "blocked"
      && nextGate === "none"
      && reason === "target_prerequisite_missing";
    if ((eligible !== eligibleContract) || (!eligible && !blockedContract)) {
      fail("terminal_state_prerequisite_missing");
    }
  } else if (authorityUnitCount === undefined || state !== "blocked"
    || constraintEligibility !== "blocked" || nextGate !== "authoritative_row_evidence"
    || reason !== "authoritative_row_evidence_absent") {
    fail("terminal_state_prerequisite_missing");
  }
  return {
    activeCount,
    activeQuerySetVersion: INVARIANT_V2_QUERY_SET_VERSION,
    ...(authorityUnitCount === undefined ? {} : { authorityUnitCount }),
    constraintEligibility,
    decisionRefs: refs,
    family,
    nextGate,
    reason,
    state,
    v1ContinuityCount,
  };
}

function readSourceDigests(value: unknown): SourceDigests {
  const digests = exactObject(value, [
    "authorityClassifierV1", "invariantV1", "invariantV2",
  ], "source_digest_mismatch");
  return {
    authorityClassifierV1: requireDigest(digests.authorityClassifierV1, "source_digest_mismatch"),
    invariantV1: requireDigest(digests.invariantV1, "source_digest_mismatch"),
    invariantV2: requireDigest(digests.invariantV2, "source_digest_mismatch"),
  };
}

function exactObject(value: unknown, keys: string[], error: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(error);
  const required = keys.filter((key) => !key.endsWith("?"));
  const allowedKeys = new Set(keys.map((key) => key.replace(/\?$/, "")));
  const actual = Object.keys(value as object);
  if (required.some((key) => !actual.includes(key)) || actual.some((key) => !allowedKeys.has(key))) fail(error);
  return value as Record<string, unknown>;
}

function requiredArray(value: unknown, error: string): unknown[] {
  if (!Array.isArray(value)) fail(error);
  return value;
}

function requiredString(value: unknown, error: string): string {
  if (typeof value !== "string" || value.length === 0) fail(error);
  return value;
}

function allowed(value: unknown, values: readonly string[], error: string) {
  const result = requiredString(value, error);
  if (!values.includes(result)) fail(error);
  return result;
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

function sameMembers(actual: readonly string[], expected: readonly string[]) {
  return actual.length === expected.length && expected.every((value) => actual.includes(value));
}

function fail(message: string): never {
  throw new Error(message);
}
