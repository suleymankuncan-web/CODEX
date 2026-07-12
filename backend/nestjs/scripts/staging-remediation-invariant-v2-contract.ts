import {
  familyForInvariant,
  invariantV2Codes,
  invariantV2Families,
  invariantV2ReasonCodes,
  invariantV2SourceTables,
  reasonBelongsToInvariant,
  sourceBelongsToInvariant,
  type InvariantV2Code,
  type InvariantV2Family,
  type InvariantV2ReasonCode,
  type InvariantV2SourceTable,
} from "./staging-remediation-invariant-v2-allowlists";
import {
  assertSanitizedDiagnosticJson,
  sha256Canonical,
} from "./staging-remediation-diagnostic-contract";

export const INVARIANT_V2_QUERY_SET_VERSION = "staging-remediation-invariant-v2";

export type InvariantV2Hit = {
  count: number;
  invariant: InvariantV2Code;
  reason: InvariantV2ReasonCode;
  sampleRefs: string[];
  sourceTable: InvariantV2SourceTable;
  unit: "check_hits";
};

export type InvariantV2Bridge = {
  carriedForwardCount: number;
  family: InvariantV2Family;
  revisedValidCount: number;
  unit: "check_hits";
  v1HitCount: number;
  v2HitCount: number;
  v2NewCount: number;
};

export type InvariantV2QueryResult = {
  bridge: InvariantV2Bridge[];
  familyTotals: Array<{ family: InvariantV2Family; hitCount: number; unit: "check_hits" }>;
  hits: InvariantV2Hit[];
  observedAt: string;
  overallCheckHits: { count: number; unit: "check_hits" };
  querySetVersion: typeof INVARIANT_V2_QUERY_SET_VERSION;
};

export type InvariantV2Receipt = {
  certificateVerified: boolean;
  event: "staging_remediation_invariant_v2.completed";
  queryDigest: string;
  queryResult: InvariantV2QueryResult;
  receiptDigest: string;
  receiptVersion: "2";
  reviewedCommit: string;
  runnerDigest: string;
  targetClass: "disposable" | "staging";
  targetFingerprint: string;
  timeoutProfile: { connectionMs: 5000; idleMs: 1000; queryMs: 30000; statementMs: 30000 };
  tlsMode: "disable" | "verify-full";
  transactionIsolation: "repeatable_read";
  transactionReadOnly: true;
};

const familySet = new Set<string>(invariantV2Families);
const invariantSet = new Set<string>(invariantV2Codes);
const reasonSet = new Set<string>(invariantV2ReasonCodes);
const sourceTableSet = new Set<string>(invariantV2SourceTables);

// Public fail-closed boundary for the V2 SQL document.
export function validateInvariantV2QueryResult(value: unknown): InvariantV2QueryResult {
  const result = exactObject(value, [
    "bridge",
    "familyTotals",
    "hits",
    "observedAt",
    "overallCheckHits",
    "querySetVersion",
  ], "invariant_v2_schema_mismatch");
  if (result.querySetVersion !== INVARIANT_V2_QUERY_SET_VERSION) fail("query_set_version_mismatch");
  const observedAt = requiredString(result.observedAt, "invalid_observed_at");
  if (Number.isNaN(Date.parse(observedAt))) fail("invalid_observed_at");

  const hits = requiredArray(result.hits, "invalid_hits").map(readHit);
  const familyTotals = requiredArray(result.familyTotals, "invalid_family_totals").map(readFamilyTotal);
  const bridge = requiredArray(result.bridge, "invalid_bridge").map(readBridge);
  const overallCheckHits = readCountUnit(result.overallCheckHits, "invalid_overall_total");

  assertUnique(familyTotals.map((item) => item.family), "duplicate_family_total");
  assertUnique(bridge.map((item) => item.family), "duplicate_bridge_family");
  if (!sameMembers(familyTotals.map((item) => item.family), invariantV2Families)
    || !sameMembers(bridge.map((item) => item.family), invariantV2Families)) {
    fail("incomplete_family_catalog");
  }
  const totalsByFamily = new Map(familyTotals.map((item) => [item.family, item.hitCount]));
  const hitTotals = new Map<InvariantV2Family, number>();
  for (const hit of hits) {
    const family = familyForInvariant(hit.invariant);
    hitTotals.set(family, (hitTotals.get(family) ?? 0) + hit.count);
  }
  for (const total of familyTotals) {
    if ((hitTotals.get(total.family) ?? 0) !== total.hitCount) fail("dishonest_family_total");
  }
  for (const item of bridge) {
    if (item.v1HitCount !== item.carriedForwardCount + item.revisedValidCount) {
      fail("dishonest_v1_bridge");
    }
    if (item.v2HitCount !== item.carriedForwardCount + item.v2NewCount) {
      fail("dishonest_v2_bridge");
    }
    if (totalsByFamily.get(item.family) !== item.v2HitCount) fail("bridge_family_total_mismatch");
  }
  const familyTotal = familyTotals.reduce((sum, item) => sum + item.hitCount, 0);
  if (overallCheckHits.count !== familyTotal) fail("dishonest_overall_total");

  return {
    bridge,
    familyTotals,
    hits,
    observedAt,
    overallCheckHits,
    querySetVersion: INVARIANT_V2_QUERY_SET_VERSION,
  };
}

export function createInvariantV2Receipt(input: {
  certificateVerified: boolean;
  queryDigest: string;
  queryResult: InvariantV2QueryResult;
  reviewedCommit: string;
  runnerDigest: string;
  targetClass: "disposable" | "staging";
  targetFingerprint: string;
  tlsMode: "disable" | "verify-full";
}): InvariantV2Receipt {
  const withoutDigest = {
    certificateVerified: input.certificateVerified,
    event: "staging_remediation_invariant_v2.completed" as const,
    queryDigest: input.queryDigest,
    queryResult: validateInvariantV2QueryResult(input.queryResult),
    receiptVersion: "2" as const,
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
  return validateInvariantV2Receipt({
    ...withoutDigest,
    receiptDigest: sha256Canonical(withoutDigest),
  });
}

export function validateInvariantV2Receipt(value: unknown): InvariantV2Receipt {
  const receipt = exactObject(value, [
    "certificateVerified",
    "event",
    "queryDigest",
    "queryResult",
    "receiptDigest",
    "receiptVersion",
    "reviewedCommit",
    "runnerDigest",
    "targetClass",
    "targetFingerprint",
    "timeoutProfile",
    "tlsMode",
    "transactionIsolation",
    "transactionReadOnly",
  ], "invariant_v2_receipt_schema_mismatch");
  if (receipt.event !== "staging_remediation_invariant_v2.completed" || receipt.receiptVersion !== "2") {
    fail("invariant_v2_receipt_schema_mismatch");
  }
  if (!/^[a-f0-9]{40}$/.test(String(receipt.reviewedCommit))) fail("invalid_reviewed_commit");
  for (const digest of [receipt.queryDigest, receipt.runnerDigest, receipt.targetFingerprint, receipt.receiptDigest]) {
    if (!/^[a-f0-9]{64}$/.test(String(digest))) fail("invalid_digest");
  }
  if (!(["disposable", "staging"] as unknown[]).includes(receipt.targetClass)) {
    fail("invariant_v2_receipt_schema_mismatch");
  }
  if (!(["disable", "verify-full"] as unknown[]).includes(receipt.tlsMode)) {
    fail("invariant_v2_receipt_schema_mismatch");
  }
  if (typeof receipt.certificateVerified !== "boolean") fail("invariant_v2_receipt_schema_mismatch");
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
  const queryResult = validateInvariantV2QueryResult(receipt.queryResult);
  const typed = { ...receipt, queryResult } as unknown as InvariantV2Receipt;
  const { receiptDigest, ...withoutDigest } = typed;
  if (sha256Canonical(withoutDigest) !== receiptDigest) fail("receipt_digest_mismatch");
  assertSanitizedInvariantV2Json(JSON.stringify(typed));
  return typed;
}

export function assertSanitizedInvariantV2Json(serialized: string) {
  assertSanitizedDiagnosticJson(serialized);
}

function readHit(value: unknown): InvariantV2Hit {
  const hit = exactObject(value, ["count", "invariant", "reason", "sampleRefs", "sourceTable", "unit"], "invalid_hit");
  const invariant = allowedString(hit.invariant, invariantSet, "invariant_not_allowed") as InvariantV2Code;
  const reason = allowedString(hit.reason, reasonSet, "reason_not_allowed") as InvariantV2ReasonCode;
  if (!reasonBelongsToInvariant(invariant, reason)) fail("reason_invariant_mismatch");
  const sourceTable = allowedString(hit.sourceTable, sourceTableSet, "source_table_not_allowed") as InvariantV2SourceTable;
  if (!sourceBelongsToInvariant(invariant, sourceTable)) fail("source_invariant_mismatch");
  const count = safeCount(hit.count, "invalid_hit_count");
  if (count === 0) fail("empty_hit_not_allowed");
  const sampleRefs = requiredArray(hit.sampleRefs, "invalid_sample_refs").map((item) => {
    const ref = requiredString(item, "invalid_sample_ref");
    if (!/^[a-f0-9]{12}$/.test(ref)) fail("invalid_sample_ref");
    return ref;
  });
  if (sampleRefs.length > 5) fail("too_many_sample_refs");
  if (hit.unit !== "check_hits") fail("invalid_hit_unit");
  return { count, invariant, reason, sampleRefs, sourceTable, unit: "check_hits" };
}

function readFamilyTotal(value: unknown) {
  const item = exactObject(value, ["family", "hitCount", "unit"], "invalid_family_total");
  const family = allowedString(item.family, familySet, "family_not_allowed") as InvariantV2Family;
  if (item.unit !== "check_hits") fail("invalid_family_unit");
  return { family, hitCount: safeCount(item.hitCount, "invalid_family_count"), unit: "check_hits" as const };
}

function readBridge(value: unknown): InvariantV2Bridge {
  const item = exactObject(value, [
    "carriedForwardCount",
    "family",
    "revisedValidCount",
    "unit",
    "v1HitCount",
    "v2HitCount",
    "v2NewCount",
  ], "invalid_bridge_item");
  const family = allowedString(item.family, familySet, "family_not_allowed") as InvariantV2Family;
  if (item.unit !== "check_hits") fail("invalid_bridge_unit");
  return {
    carriedForwardCount: safeCount(item.carriedForwardCount, "invalid_bridge_count"),
    family,
    revisedValidCount: safeCount(item.revisedValidCount, "invalid_bridge_count"),
    unit: "check_hits",
    v1HitCount: safeCount(item.v1HitCount, "invalid_bridge_count"),
    v2HitCount: safeCount(item.v2HitCount, "invalid_bridge_count"),
    v2NewCount: safeCount(item.v2NewCount, "invalid_bridge_count"),
  };
}

function readCountUnit(value: unknown, error: string) {
  const item = exactObject(value, ["count", "unit"], error);
  if (item.unit !== "check_hits") fail(error);
  return { count: safeCount(item.count, error), unit: "check_hits" as const };
}

function exactObject(value: unknown, keys: string[], error: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(error);
  const record = value as Record<string, unknown>;
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) fail(error);
  return record;
}

function requiredArray(value: unknown, error: string): unknown[] {
  if (!Array.isArray(value)) fail(error);
  return value;
}

function requiredString(value: unknown, error: string): string {
  if (typeof value !== "string" || value.length === 0) fail(error);
  return value;
}

function allowedString(value: unknown, allowed: Set<string>, error: string): string {
  const result = requiredString(value, error);
  if (!allowed.has(result)) fail(error);
  return result;
}

function safeCount(value: unknown, error: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) fail(error);
  return value as number;
}

function assertUnique(values: string[], error: string) {
  if (new Set(values).size !== values.length) fail(error);
}

function sameMembers(actual: readonly string[], expected: readonly string[]) {
  return actual.length === expected.length && expected.every((value) => actual.includes(value));
}

function fail(message: string): never {
  throw new Error(message);
}
