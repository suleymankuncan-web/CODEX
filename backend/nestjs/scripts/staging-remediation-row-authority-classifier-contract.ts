import {
  authorityFamilies,
  authorityReasons,
  authoritySources,
  reasonBelongsToAuthorityFamily,
  sourceBelongsToAuthorityReason,
  type AuthorityFamily,
  type AuthorityReason,
  type AuthoritySource,
} from "./staging-remediation-row-authority-classifier-allowlists";
import {
  assertSanitizedDiagnosticJson,
  sha256Canonical,
} from "./staging-remediation-diagnostic-contract";
import {
  validateInvariantV2QueryResult,
  type InvariantV2QueryResult,
} from "./staging-remediation-invariant-v2-contract";
import type { InvariantV2Family } from "./staging-remediation-invariant-v2-allowlists";

export const AUTHORITY_CLASSIFIER_QUERY_SET_VERSION =
  "staging-remediation-row-authority-classifier-v1" as const;

export type AuthorityBucket = {
  authorityUnitCount: number;
  checkHitCount: number;
  family: AuthorityFamily;
  reason: AuthorityReason;
  sampleAuthorityRefs: string[];
  source: AuthoritySource;
  units: { authority: "authority_units"; findings: "check_hits" };
};

export type AuthorityClassifierResult = {
  buckets: AuthorityBucket[];
  familyTotals: Array<{
    authorityUnitCount: number;
    checkHitCount: number;
    family: AuthorityFamily;
  }>;
  observedAt: string;
  overall: { authorityUnitCount: number; checkHitCount: number };
  querySetVersion: typeof AUTHORITY_CLASSIFIER_QUERY_SET_VERSION;
  sourceContracts: [{
    code: "assignment_rotation_lifecycle";
    state: "absent";
  }];
  v2FamilyTotals: Array<{ family: InvariantV2Family; hitCount: number }>;
};

export type AuthorityClassifierSqlDocument = Omit<AuthorityClassifierResult, "v2FamilyTotals">;

export type AuthorityClassifierReceipt = {
  certificateVerified: boolean;
  classifierQueryDigest: string;
  event: "staging_remediation_row_authority_classifier.completed";
  invariantV2QueryDigest: string;
  queryResult: AuthorityClassifierResult;
  receiptDigest: string;
  receiptVersion: "1";
  reviewedCommit: string;
  runnerDigest: string;
  targetClass: "disposable" | "staging";
  targetFingerprint: string;
  timeoutProfile: {
    connectionMs: 5000;
    idleMs: 1000;
    queryMs: 30000;
    statementMs: 30000;
  };
  tlsMode: "disable" | "verify-full";
  transactionIsolation: "repeatable_read";
  transactionReadOnly: true;
};

const familySet = new Set<string>(authorityFamilies);
const reasonSet = new Set<string>(authorityReasons);
const sourceSet = new Set<string>(authoritySources);
const invariantFamilies = ["ASSIGN-01", "ORG-02", "ORG-04", "TARGET-02"] as const;

export function buildAuthorityClassifierResult(
  value: unknown,
  invariantV2Result: InvariantV2QueryResult,
): AuthorityClassifierResult {
  const document = exactObject(value, [
    "buckets",
    "familyTotals",
    "observedAt",
    "overall",
    "querySetVersion",
    "sourceContracts",
  ], "authority_classifier_sql_schema_mismatch");
  const validatedV2 = validateInvariantV2QueryResult(invariantV2Result);
  return validateAuthorityClassifierResult({
    ...document,
    v2FamilyTotals: validatedV2.familyTotals.map(({ family, hitCount }) => ({
      family,
      hitCount,
    })),
  });
}

export function validateAuthorityClassifierResult(value: unknown): AuthorityClassifierResult {
  const result = exactObject(value, [
    "buckets",
    "familyTotals",
    "observedAt",
    "overall",
    "querySetVersion",
    "sourceContracts",
    "v2FamilyTotals",
  ], "authority_classifier_schema_mismatch");
  if (result.querySetVersion !== AUTHORITY_CLASSIFIER_QUERY_SET_VERSION) {
    fail("authority_classifier_query_set_version_mismatch");
  }
  const observedAt = requiredString(result.observedAt, "invalid_observed_at");
  if (Number.isNaN(Date.parse(observedAt))) fail("invalid_observed_at");

  const sourceContracts = readSourceContracts(result.sourceContracts);
  const buckets = requiredArray(result.buckets, "invalid_authority_buckets").map(readBucket);
  const familyTotals = requiredArray(result.familyTotals, "invalid_authority_family_totals")
    .map(readFamilyTotal);
  const v2FamilyTotals = requiredArray(result.v2FamilyTotals, "invalid_v2_family_totals")
    .map(readV2FamilyTotal);
  const overall = readOverall(result.overall);

  assertUnique(
    buckets.map((item) => `${item.family}\0${item.reason}\0${item.source}`),
    "duplicate_authority_bucket",
  );
  assertUnique(familyTotals.map((item) => item.family), "duplicate_authority_family_total");
  assertUnique(v2FamilyTotals.map((item) => item.family), "duplicate_v2_family_total");
  if (!sameMembers(familyTotals.map((item) => item.family), authorityFamilies)) {
    fail("incomplete_authority_family_catalog");
  }
  if (!sameMembers(v2FamilyTotals.map((item) => item.family), invariantFamilies)) {
    fail("incomplete_v2_family_catalog");
  }

  const bucketTotals = new Map<AuthorityFamily, { authority: number; checks: number }>();
  for (const bucket of buckets) {
    const current = bucketTotals.get(bucket.family) ?? { authority: 0, checks: 0 };
    current.authority += bucket.authorityUnitCount;
    current.checks += bucket.checkHitCount;
    bucketTotals.set(bucket.family, current);
  }
  for (const total of familyTotals) {
    const calculated = bucketTotals.get(total.family) ?? { authority: 0, checks: 0 };
    if (calculated.authority !== total.authorityUnitCount
      || calculated.checks !== total.checkHitCount) {
      fail("dishonest_authority_family_total");
    }
  }

  const v2ByFamily = new Map(v2FamilyTotals.map((item) => [item.family, item.hitCount]));
  for (const total of familyTotals) {
    if (v2ByFamily.get(total.family) !== total.checkHitCount) {
      fail("v2_authority_reconciliation_mismatch");
    }
  }
  if (v2ByFamily.get("TARGET-02") !== 0) fail("target_classifier_bucket_forbidden");

  const calculatedOverall = familyTotals.reduce(
    (sum, item) => ({
      authorityUnitCount: sum.authorityUnitCount + item.authorityUnitCount,
      checkHitCount: sum.checkHitCount + item.checkHitCount,
    }),
    { authorityUnitCount: 0, checkHitCount: 0 },
  );
  if (overall.authorityUnitCount !== calculatedOverall.authorityUnitCount
    || overall.checkHitCount !== calculatedOverall.checkHitCount) {
    fail("dishonest_authority_overall_total");
  }

  const typed: AuthorityClassifierResult = {
    buckets,
    familyTotals,
    observedAt,
    overall,
    querySetVersion: AUTHORITY_CLASSIFIER_QUERY_SET_VERSION,
    sourceContracts,
    v2FamilyTotals,
  };
  assertSanitizedAuthorityClassifierJson(JSON.stringify(typed));
  return typed;
}

export function createAuthorityClassifierReceipt(input: {
  certificateVerified: boolean;
  classifierQueryDigest: string;
  invariantV2QueryDigest: string;
  queryResult: AuthorityClassifierResult;
  reviewedCommit: string;
  runnerDigest: string;
  targetClass: "disposable" | "staging";
  targetFingerprint: string;
  tlsMode: "disable" | "verify-full";
}): AuthorityClassifierReceipt {
  const withoutDigest = {
    certificateVerified: input.certificateVerified,
    classifierQueryDigest: input.classifierQueryDigest,
    event: "staging_remediation_row_authority_classifier.completed" as const,
    invariantV2QueryDigest: input.invariantV2QueryDigest,
    queryResult: validateAuthorityClassifierResult(input.queryResult),
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
  return validateAuthorityClassifierReceipt({
    ...withoutDigest,
    receiptDigest: sha256Canonical(withoutDigest),
  });
}

export function validateAuthorityClassifierReceipt(value: unknown): AuthorityClassifierReceipt {
  const receipt = exactObject(value, [
    "certificateVerified",
    "classifierQueryDigest",
    "event",
    "invariantV2QueryDigest",
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
  ], "authority_classifier_receipt_schema_mismatch");
  if (receipt.event !== "staging_remediation_row_authority_classifier.completed"
    || receipt.receiptVersion !== "1") {
    fail("authority_classifier_receipt_schema_mismatch");
  }
  if (!/^[a-f0-9]{40}$/.test(String(receipt.reviewedCommit))) fail("invalid_reviewed_commit");
  for (const digest of [
    receipt.classifierQueryDigest,
    receipt.invariantV2QueryDigest,
    receipt.runnerDigest,
    receipt.targetFingerprint,
    receipt.receiptDigest,
  ]) {
    if (!/^[a-f0-9]{64}$/.test(String(digest))) fail("invalid_digest");
  }
  if (!(receipt.targetClass === "disposable" || receipt.targetClass === "staging")) {
    fail("authority_classifier_receipt_schema_mismatch");
  }
  if (!(receipt.tlsMode === "disable" || receipt.tlsMode === "verify-full")) {
    fail("authority_classifier_receipt_schema_mismatch");
  }
  if (typeof receipt.certificateVerified !== "boolean") {
    fail("authority_classifier_receipt_schema_mismatch");
  }
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
  const queryResult = validateAuthorityClassifierResult(receipt.queryResult);
  const typed = { ...receipt, queryResult } as unknown as AuthorityClassifierReceipt;
  const { receiptDigest, ...withoutDigest } = typed;
  if (sha256Canonical(withoutDigest) !== receiptDigest) fail("receipt_digest_mismatch");
  assertSanitizedAuthorityClassifierJson(JSON.stringify(typed));
  return typed;
}

export function assertSanitizedAuthorityClassifierJson(serialized: string) {
  assertSanitizedDiagnosticJson(serialized);
}

function readBucket(value: unknown): AuthorityBucket {
  const item = exactObject(value, [
    "authorityUnitCount",
    "checkHitCount",
    "family",
    "reason",
    "sampleAuthorityRefs",
    "source",
    "units",
  ], "invalid_authority_bucket");
  const family = allowedString(item.family, familySet, "authority_family_not_allowed") as AuthorityFamily;
  const reason = allowedString(item.reason, reasonSet, "authority_reason_not_allowed") as AuthorityReason;
  if (!reasonBelongsToAuthorityFamily(family, reason)) fail("authority_reason_family_mismatch");
  const source = allowedString(item.source, sourceSet, "authority_source_not_allowed") as AuthoritySource;
  if (!sourceBelongsToAuthorityReason(reason, source)) fail("authority_source_reason_mismatch");
  const checkHitCount = positiveCount(item.checkHitCount, "invalid_authority_check_hit_count");
  const authorityUnitCount = positiveCount(item.authorityUnitCount, "invalid_authority_unit_count");
  if (authorityUnitCount > checkHitCount) fail("invalid_authority_unit_count");
  const refs = requiredArray(item.sampleAuthorityRefs, "invalid_sample_authority_refs")
    .map((entry) => {
      const ref = requiredString(entry, "invalid_sample_authority_ref");
      if (!/^[a-f0-9]{12}$/.test(ref)) fail("invalid_sample_authority_ref");
      return ref;
    });
  if (refs.length > 5) fail("too_many_sample_authority_refs");
  if (new Set(refs).size !== refs.length) fail("duplicate_sample_authority_ref");
  if (refs.some((ref, index) => index > 0 && refs[index - 1].localeCompare(ref) > 0)) {
    fail("unsorted_sample_authority_ref");
  }
  const units = exactObject(item.units, ["authority", "findings"], "invalid_authority_units");
  if (units.authority !== "authority_units" || units.findings !== "check_hits") {
    fail("invalid_authority_units");
  }
  return {
    authorityUnitCount,
    checkHitCount,
    family,
    reason,
    sampleAuthorityRefs: refs,
    source,
    units: { authority: "authority_units", findings: "check_hits" },
  };
}

function readFamilyTotal(value: unknown) {
  const item = exactObject(value, [
    "authorityUnitCount", "checkHitCount", "family",
  ], "invalid_authority_family_total");
  return {
    authorityUnitCount: safeCount(item.authorityUnitCount, "invalid_authority_family_count"),
    checkHitCount: safeCount(item.checkHitCount, "invalid_authority_family_count"),
    family: allowedString(item.family, familySet, "authority_family_not_allowed") as AuthorityFamily,
  };
}

function readV2FamilyTotal(value: unknown) {
  const item = exactObject(value, ["family", "hitCount"], "invalid_v2_family_total");
  const family = requiredString(item.family, "invalid_v2_family");
  if (!(invariantFamilies as readonly string[]).includes(family)) fail("invalid_v2_family");
  return { family: family as InvariantV2Family, hitCount: safeCount(item.hitCount, "invalid_v2_count") };
}

function readSourceContracts(value: unknown): AuthorityClassifierResult["sourceContracts"] {
  const entries = requiredArray(value, "invalid_source_contracts");
  if (entries.length !== 1) fail("invalid_source_contracts");
  const entry = exactObject(entries[0], ["code", "state"], "invalid_source_contract");
  if (entry.code !== "assignment_rotation_lifecycle") fail("invalid_source_contract");
  if (entry.state !== "absent") fail("source_contract_version_change_required");
  return [{ code: "assignment_rotation_lifecycle", state: "absent" }];
}

function readOverall(value: unknown) {
  const item = exactObject(value, ["authorityUnitCount", "checkHitCount"], "invalid_authority_overall");
  return {
    authorityUnitCount: safeCount(item.authorityUnitCount, "invalid_authority_overall"),
    checkHitCount: safeCount(item.checkHitCount, "invalid_authority_overall"),
  };
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

function positiveCount(value: unknown, error: string): number {
  const result = safeCount(value, error);
  if (result === 0) fail(error);
  return result;
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
