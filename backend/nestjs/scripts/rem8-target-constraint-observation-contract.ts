import {
  assertSanitizedDiagnosticJson,
  sha256Canonical,
} from "./staging-remediation-diagnostic-contract";
import type { Rem8TargetConstraintPackage } from "./rem8-target-constraint-package-contract";

export const REM8_OBSERVATION_QUERY_SET_VERSION =
  "rem8-target-constraint-observation-v1" as const;

const lockModes = [
  "AccessShareLock",
  "RowShareLock",
  "RowExclusiveLock",
  "ShareUpdateExclusiveLock",
  "ShareLock",
  "ShareRowExclusiveLock",
  "ExclusiveLock",
  "AccessExclusiveLock",
] as const;
const planNodeTypes = [
  "Aggregate",
  "Bitmap Heap Scan",
  "Bitmap Index Scan",
  "Function Scan",
  "Hash",
  "Hash Join",
  "Index Only Scan",
  "Index Scan",
  "Limit",
  "Materialize",
  "Nested Loop",
  "Result",
  "Seq Scan",
  "Sort",
  "Subquery Scan",
] as const;
const reasonOrder = [
  "active_target_v2_hits_present",
  "ordinary_duplicate_rows_present",
  "pilot_duplicate_groups_present",
  "target_non_array_rows_present",
  "pilot_unique_index_not_exact",
  "candidate_artifact_conflict",
  "target_table_partitioned",
  "server_major_mismatch",
] as const;
type ObservationReason = typeof reasonOrder[number] | "all_prerequisites_satisfied";

export type Rem8ObservationSqlDocument = {
  artifacts: {
    constraintState: "absent" | "present_not_valid" | "present_valid";
    functionState: "absent" | "present";
  };
  compatibility: {
    nonArrayRows: number;
    ordinaryDuplicateRows: number;
    pilotDuplicateGroups: number;
    pilotUniqueIndex: "present_valid_exact" | "absent" | "invalid" | "definition_drifted";
  };
  locks: Array<{ count: number; granted: boolean; mode: string }>;
  observedAt: string;
  querySetVersion: typeof REM8_OBSERVATION_QUERY_SET_VERSION;
  server: { major: number };
  targetTable: {
    deadRows: number;
    estimatedRows: number;
    indexBytes: number;
    liveRows: number;
    partitioned: boolean;
    tableBytes: number;
    totalBytes: number;
  };
  transactions: {
    activeCount: number;
    maxAgeMs: number;
    over30sCount: number;
    over5sCount: number;
  };
  writes: {
    deleted: number;
    inserted: number;
    statsAgeSeconds: number | null;
    updated: number;
  };
};

export type Rem8ObservationPlan = {
  nodeTypes: string[];
  planRows: number;
  totalCost: number;
};

export type Rem8Observation = Rem8ObservationSqlDocument & {
  candidate: {
    addConstraintDigest: string;
    addLock: "access_exclusive";
    functionDigest: string;
    rollbackDigest: string;
    validateConstraintDigest: string;
    validateLock: "share_update_exclusive";
  };
  compatibility: Rem8ObservationSqlDocument["compatibility"] & {
    activeTargetV2Hits: number;
  };
  indexStrategy: "not_applicable_no_index_candidate";
  plan: Rem8ObservationPlan;
  reasons: ObservationReason[];
  rem7ReceiptDigest: string;
  state: "eligible_for_disposable_rehearsal" | "blocked";
};

export type Rem8ObservationReceipt = {
  certificateVerified: boolean;
  event: "rem8_target_constraint.observation_completed";
  invariantV2QueryDigest: string;
  observationQueryDigest: string;
  planQueryDigest: string;
  queryResult: Rem8Observation;
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

type PackageDigests = Rem8TargetConstraintPackage["digests"];
const hex40 = /^[a-f0-9]{40}$/;
const hex64 = /^[a-f0-9]{64}$/;

// Trace: FR-05..09; NFR-01..04; AC-02; EC-05..10, EC-16.
export function buildRem8Observation(
  sqlValue: unknown,
  activeTargetV2Hits: number,
  planValue: unknown,
  rem7ReceiptDigest: string,
  packageDigests: PackageDigests,
): Rem8Observation {
  const sql = readSqlDocument(sqlValue);
  const plan = readPlan(planValue);
  const targetHits = safeCount(activeTargetV2Hits, "invalid_active_target_v2_hits");
  requireDigest(rem7ReceiptDigest, "invalid_rem7_receipt_digest");
  const digests = readPackageDigests(packageDigests);
  const reasons: ObservationReason[] = [];
  if (targetHits > 0) reasons.push("active_target_v2_hits_present");
  if (sql.compatibility.ordinaryDuplicateRows > 0) reasons.push("ordinary_duplicate_rows_present");
  if (sql.compatibility.pilotDuplicateGroups > 0) reasons.push("pilot_duplicate_groups_present");
  if (sql.compatibility.nonArrayRows > 0) reasons.push("target_non_array_rows_present");
  if (sql.compatibility.pilotUniqueIndex !== "present_valid_exact") {
    reasons.push("pilot_unique_index_not_exact");
  }
  if (sql.artifacts.functionState !== "absent" || sql.artifacts.constraintState !== "absent") {
    reasons.push("candidate_artifact_conflict");
  }
  if (sql.targetTable.partitioned) reasons.push("target_table_partitioned");
  if (sql.server.major !== 17) reasons.push("server_major_mismatch");

  return validateRem8Observation({
    ...sql,
    candidate: {
      addConstraintDigest: digests.addConstraint,
      addLock: "access_exclusive",
      functionDigest: digests.createFunction,
      rollbackDigest: digests.rollback,
      validateConstraintDigest: digests.validateConstraint,
      validateLock: "share_update_exclusive",
    },
    compatibility: { ...sql.compatibility, activeTargetV2Hits: targetHits },
    indexStrategy: "not_applicable_no_index_candidate",
    plan,
    reasons: reasons.length === 0 ? ["all_prerequisites_satisfied"] : reasons,
    rem7ReceiptDigest,
    state: reasons.length === 0 ? "eligible_for_disposable_rehearsal" : "blocked",
  });
}

export function validateRem8Observation(value: unknown): Rem8Observation {
  const result = exactObject(value, [
    "artifacts", "candidate", "compatibility", "indexStrategy", "locks", "observedAt",
    "plan", "querySetVersion", "reasons", "rem7ReceiptDigest", "server", "state",
    "targetTable", "transactions", "writes",
  ], "observation_schema_mismatch");
  const sql = readSqlDocument({
    artifacts: result.artifacts,
    compatibility: withoutActiveTargetHits(result.compatibility),
    locks: result.locks,
    observedAt: result.observedAt,
    querySetVersion: result.querySetVersion,
    server: result.server,
    targetTable: result.targetTable,
    transactions: result.transactions,
    writes: result.writes,
  });
  const compatibilityObject = exactObject(result.compatibility, [
    "activeTargetV2Hits", "nonArrayRows", "ordinaryDuplicateRows", "pilotDuplicateGroups",
    "pilotUniqueIndex",
  ], "invalid_observation_compatibility");
  const activeTargetV2Hits = safeCount(
    compatibilityObject.activeTargetV2Hits,
    "invalid_active_target_v2_hits",
  );
  const candidate = readCandidate(result.candidate);
  if (result.indexStrategy !== "not_applicable_no_index_candidate") fail("invalid_index_strategy");
  const plan = readPlan(result.plan);
  const rem7ReceiptDigest = requireDigest(result.rem7ReceiptDigest, "invalid_rem7_receipt_digest");
  const reasons = requiredArray(result.reasons, "invalid_observation_reasons")
    .map((item) => allowedString(
      item,
      ["all_prerequisites_satisfied", ...reasonOrder],
      "observation_reason_not_allowed",
    ) as ObservationReason);
  if (new Set(reasons).size !== reasons.length) fail("duplicate_observation_reason");
  const state = allowedString(
    result.state,
    ["eligible_for_disposable_rehearsal", "blocked"],
    "invalid_observation_state",
  ) as Rem8Observation["state"];
  const expectedReasons = calculateReasons(sql, activeTargetV2Hits);
  const normalizedReasons: ObservationReason[] = expectedReasons.length === 0
    ? ["all_prerequisites_satisfied"]
    : expectedReasons;
  if (!sameMembers(reasons, normalizedReasons)
    || (state === "eligible_for_disposable_rehearsal") !== (expectedReasons.length === 0)) {
    fail("dishonest_observation_state");
  }
  const typed: Rem8Observation = {
    ...sql,
    candidate,
    compatibility: { ...sql.compatibility, activeTargetV2Hits },
    indexStrategy: "not_applicable_no_index_candidate",
    plan,
    reasons: normalizedReasons,
    rem7ReceiptDigest,
    state,
  };
  assertSanitizedDiagnosticJson(JSON.stringify(typed));
  return typed;
}

// Trace: FR-09; NFR-01..04; AC-02, AC-03; EC-16.
export function createRem8ObservationReceipt(input: {
  certificateVerified: boolean;
  invariantV2QueryDigest: string;
  observationQueryDigest: string;
  planQueryDigest: string;
  queryResult: Rem8Observation;
  reviewedCommit: string;
  runnerDigest: string;
  targetClass: "disposable" | "staging";
  targetFingerprint: string;
  tlsMode: "disable" | "verify-full";
}): Rem8ObservationReceipt {
  const withoutDigest = {
    certificateVerified: input.certificateVerified,
    event: "rem8_target_constraint.observation_completed" as const,
    invariantV2QueryDigest: input.invariantV2QueryDigest,
    observationQueryDigest: input.observationQueryDigest,
    planQueryDigest: input.planQueryDigest,
    queryResult: validateRem8Observation(input.queryResult),
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
  return validateRem8ObservationReceipt({
    ...withoutDigest,
    receiptDigest: sha256Canonical(withoutDigest),
  });
}

export function validateRem8ObservationReceipt(value: unknown): Rem8ObservationReceipt {
  const receipt = exactObject(value, [
    "certificateVerified", "event", "invariantV2QueryDigest", "observationQueryDigest",
    "planQueryDigest", "queryResult", "receiptDigest", "receiptVersion", "reviewedCommit", "runnerDigest",
    "targetClass", "targetFingerprint", "timeoutProfile", "tlsMode",
    "transactionIsolation", "transactionReadOnly",
  ], "observation_receipt_schema_mismatch");
  if (receipt.event !== "rem8_target_constraint.observation_completed" || receipt.receiptVersion !== "1") {
    fail("observation_receipt_schema_mismatch");
  }
  if (!hex40.test(String(receipt.reviewedCommit))) fail("invalid_reviewed_commit");
  for (const digest of [
    receipt.invariantV2QueryDigest,
    receipt.observationQueryDigest,
    receipt.planQueryDigest,
    receipt.receiptDigest,
    receipt.runnerDigest,
    receipt.targetFingerprint,
  ]) requireDigest(digest, "invalid_digest");
  if (!(receipt.targetClass === "disposable" || receipt.targetClass === "staging")) {
    fail("observation_receipt_schema_mismatch");
  }
  if (!(receipt.tlsMode === "disable" || receipt.tlsMode === "verify-full")) {
    fail("observation_receipt_schema_mismatch");
  }
  if (typeof receipt.certificateVerified !== "boolean") fail("observation_receipt_schema_mismatch");
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
  const queryResult = validateRem8Observation(receipt.queryResult);
  const typed = { ...receipt, queryResult } as unknown as Rem8ObservationReceipt;
  const { receiptDigest, ...withoutDigest } = typed;
  if (sha256Canonical(withoutDigest) !== receiptDigest) fail("receipt_digest_mismatch");
  assertSanitizedDiagnosticJson(JSON.stringify(typed));
  return typed;
}

function readSqlDocument(value: unknown): Rem8ObservationSqlDocument {
  const item = exactObject(value, [
    "artifacts", "compatibility", "locks", "observedAt", "querySetVersion", "server",
    "targetTable", "transactions", "writes",
  ], "observation_sql_schema_mismatch");
  if (item.querySetVersion !== REM8_OBSERVATION_QUERY_SET_VERSION) fail("query_set_version_mismatch");
  const observedAt = requiredString(item.observedAt, "invalid_observed_at");
  if (Number.isNaN(Date.parse(observedAt)) || new Date(observedAt).toISOString() !== observedAt) {
    fail("invalid_observed_at");
  }
  const artifactsObject = exactObject(
    item.artifacts,
    ["constraintState", "functionState"],
    "invalid_observation_artifacts",
  );
  const artifacts: Rem8ObservationSqlDocument["artifacts"] = {
    constraintState: allowedString(
      artifactsObject.constraintState,
      ["absent", "present_not_valid", "present_valid"],
      "invalid_constraint_state",
    ) as Rem8ObservationSqlDocument["artifacts"]["constraintState"],
    functionState: allowedString(
      artifactsObject.functionState,
      ["absent", "present"],
      "invalid_function_state",
    ) as Rem8ObservationSqlDocument["artifacts"]["functionState"],
  };
  const compatibilityObject = exactObject(item.compatibility, [
    "nonArrayRows", "ordinaryDuplicateRows", "pilotDuplicateGroups", "pilotUniqueIndex",
  ], "invalid_observation_compatibility");
  const compatibility: Rem8ObservationSqlDocument["compatibility"] = {
    nonArrayRows: safeCount(compatibilityObject.nonArrayRows, "invalid_compatibility_count"),
    ordinaryDuplicateRows: safeCount(
      compatibilityObject.ordinaryDuplicateRows,
      "invalid_compatibility_count",
    ),
    pilotDuplicateGroups: safeCount(
      compatibilityObject.pilotDuplicateGroups,
      "invalid_compatibility_count",
    ),
    pilotUniqueIndex: allowedString(
      compatibilityObject.pilotUniqueIndex,
      ["present_valid_exact", "absent", "invalid", "definition_drifted"],
      "invalid_pilot_unique_index_state",
    ) as Rem8ObservationSqlDocument["compatibility"]["pilotUniqueIndex"],
  };
  const locks = requiredArray(item.locks, "invalid_locks").map(readLock);
  if (new Set(locks.map((lock) => `${lock.mode}\0${lock.granted}`)).size !== locks.length) {
    fail("duplicate_lock_bucket");
  }
  const serverObject = exactObject(item.server, ["major"], "invalid_server");
  const server = { major: safeCount(serverObject.major, "invalid_server_major") };
  const targetObject = exactObject(item.targetTable, [
    "deadRows", "estimatedRows", "indexBytes", "liveRows", "partitioned", "tableBytes", "totalBytes",
  ], "invalid_target_table");
  if (typeof targetObject.partitioned !== "boolean") fail("invalid_target_table");
  const targetTable = {
    deadRows: safeCount(targetObject.deadRows, "invalid_target_table_count"),
    estimatedRows: safeCount(targetObject.estimatedRows, "invalid_target_table_count"),
    indexBytes: safeCount(targetObject.indexBytes, "invalid_target_table_bytes"),
    liveRows: safeCount(targetObject.liveRows, "invalid_target_table_count"),
    partitioned: targetObject.partitioned,
    tableBytes: safeCount(targetObject.tableBytes, "invalid_target_table_bytes"),
    totalBytes: safeCount(targetObject.totalBytes, "invalid_target_table_bytes"),
  };
  if (targetTable.totalBytes < targetTable.tableBytes + targetTable.indexBytes) {
    fail("dishonest_target_table_bytes");
  }
  const transactionObject = exactObject(item.transactions, [
    "activeCount", "maxAgeMs", "over30sCount", "over5sCount",
  ], "invalid_transactions");
  const transactions = {
    activeCount: safeCount(transactionObject.activeCount, "invalid_transaction_count"),
    maxAgeMs: safeCount(transactionObject.maxAgeMs, "invalid_transaction_age"),
    over30sCount: safeCount(transactionObject.over30sCount, "invalid_transaction_count"),
    over5sCount: safeCount(transactionObject.over5sCount, "invalid_transaction_count"),
  };
  if (transactions.over30sCount > transactions.over5sCount
    || transactions.over5sCount > transactions.activeCount) fail("dishonest_transaction_counts");
  const writesObject = exactObject(item.writes, [
    "deleted", "inserted", "statsAgeSeconds", "updated",
  ], "invalid_write_stats");
  const writes = {
    deleted: safeCount(writesObject.deleted, "invalid_write_count"),
    inserted: safeCount(writesObject.inserted, "invalid_write_count"),
    statsAgeSeconds: writesObject.statsAgeSeconds === null
      ? null
      : safeCount(writesObject.statsAgeSeconds, "invalid_stats_age"),
    updated: safeCount(writesObject.updated, "invalid_write_count"),
  };
  return {
    artifacts,
    compatibility,
    locks,
    observedAt,
    querySetVersion: REM8_OBSERVATION_QUERY_SET_VERSION,
    server,
    targetTable,
    transactions,
    writes,
  };
}

function readLock(value: unknown) {
  const item = exactObject(value, ["count", "granted", "mode"], "invalid_lock_bucket");
  if (typeof item.granted !== "boolean") fail("invalid_lock_bucket");
  return {
    count: positiveCount(item.count, "invalid_lock_count"),
    granted: item.granted,
    mode: allowedString(item.mode, lockModes, "lock_mode_not_allowed"),
  };
}

function readPlan(value: unknown): Rem8ObservationPlan {
  const plan = exactObject(value, ["nodeTypes", "planRows", "totalCost"], "observation_plan_schema_mismatch");
  const nodeTypes = requiredArray(plan.nodeTypes, "invalid_plan_node_types")
    .map((item) => allowedString(item, planNodeTypes, "plan_node_type_not_allowed"));
  if (nodeTypes.length === 0 || new Set(nodeTypes).size !== nodeTypes.length) {
    fail("invalid_plan_node_types");
  }
  const totalCost = finiteNonNegative(plan.totalCost, "invalid_plan_cost");
  return {
    nodeTypes,
    planRows: safeCount(plan.planRows, "invalid_plan_rows"),
    totalCost,
  };
}

function readCandidate(value: unknown): Rem8Observation["candidate"] {
  const item = exactObject(value, [
    "addConstraintDigest", "addLock", "functionDigest", "rollbackDigest",
    "validateConstraintDigest", "validateLock",
  ], "invalid_candidate");
  if (item.addLock !== "access_exclusive" || item.validateLock !== "share_update_exclusive") {
    fail("invalid_candidate_lock_declaration");
  }
  return {
    addConstraintDigest: requireDigest(item.addConstraintDigest, "invalid_digest"),
    addLock: "access_exclusive",
    functionDigest: requireDigest(item.functionDigest, "invalid_digest"),
    rollbackDigest: requireDigest(item.rollbackDigest, "invalid_digest"),
    validateConstraintDigest: requireDigest(item.validateConstraintDigest, "invalid_digest"),
    validateLock: "share_update_exclusive",
  };
}

function readPackageDigests(value: unknown): PackageDigests {
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

function calculateReasons(
  sql: Rem8ObservationSqlDocument,
  activeTargetV2Hits: number,
): ObservationReason[] {
  const reasons: ObservationReason[] = [];
  if (activeTargetV2Hits > 0) reasons.push("active_target_v2_hits_present");
  if (sql.compatibility.ordinaryDuplicateRows > 0) reasons.push("ordinary_duplicate_rows_present");
  if (sql.compatibility.pilotDuplicateGroups > 0) reasons.push("pilot_duplicate_groups_present");
  if (sql.compatibility.nonArrayRows > 0) reasons.push("target_non_array_rows_present");
  if (sql.compatibility.pilotUniqueIndex !== "present_valid_exact") reasons.push("pilot_unique_index_not_exact");
  if (sql.artifacts.functionState !== "absent" || sql.artifacts.constraintState !== "absent") {
    reasons.push("candidate_artifact_conflict");
  }
  if (sql.targetTable.partitioned) reasons.push("target_table_partitioned");
  if (sql.server.major !== 17) reasons.push("server_major_mismatch");
  return reasons;
}

function withoutActiveTargetHits(value: unknown) {
  const item = exactObject(value, [
    "activeTargetV2Hits", "nonArrayRows", "ordinaryDuplicateRows", "pilotDuplicateGroups",
    "pilotUniqueIndex",
  ], "invalid_observation_compatibility");
  const { activeTargetV2Hits: _activeTargetV2Hits, ...sqlCompatibility } = item;
  return sqlCompatibility;
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

function requiredArray(value: unknown, error: string): unknown[] {
  if (!Array.isArray(value)) fail(error);
  return value;
}

function requiredString(value: unknown, error: string): string {
  if (typeof value !== "string" || value.length === 0) fail(error);
  return value;
}

function allowedString(value: unknown, allowed: readonly string[], error: string) {
  const result = requiredString(value, error);
  if (!allowed.includes(result)) fail(error);
  return result;
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

function finiteNonNegative(value: unknown, error: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) fail(error);
  return value;
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
