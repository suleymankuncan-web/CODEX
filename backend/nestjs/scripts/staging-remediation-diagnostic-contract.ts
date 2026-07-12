import { createHash } from "node:crypto";
import {
  diagnosticReasonCodes,
  diagnosticSourceTables,
  downstreamCodes,
  remediationFamilies,
  sourceClasses,
  sourceClassForTable,
  writePathCodes,
  type DiagnosticReasonCode,
  type DiagnosticSourceTable,
  type RemediationFamily,
} from "./staging-remediation-diagnostic-allowlists";

export const DIAGNOSTIC_QUERY_SET_VERSION = "staging-remediation-diagnostic-v1";
export const DIAGNOSTIC_IMPACT_INVENTORY_VERSION = "staging-remediation-impact-v1";
export const DIAGNOSTIC_TRANSACTION_CONTRACT = {
  begin: "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY",
  showIsolation: "SHOW transaction_isolation",
  showReadOnly: "SHOW transaction_read_only",
} as const;

const familySet = new Set<string>(remediationFamilies);
const reasonSet = new Set<string>(diagnosticReasonCodes);
const sourceTableSet = new Set<string>(diagnosticSourceTables);
const sourceClassSet = new Set<string>(sourceClasses);
const writePathSet = new Set<string>(writePathCodes);
const downstreamSet = new Set<string>(downstreamCodes);
const hex12 = /^[a-f0-9]{12}$/;
const hex40 = /^[a-f0-9]{40}$/;
const hex64 = /^[a-f0-9]{64}$/;

type CountUnit = "check_hits" | "source_records";

export type DiagnosticBucket = {
  dimensions: Record<string, unknown>;
  distinctSourceRecordCount?: number;
  family: RemediationFamily;
  hitCount: number;
  querySetVersion: typeof DIAGNOSTIC_QUERY_SET_VERSION;
  reasonCodes: DiagnosticReasonCode[];
  sampleRefs: string[];
  sourceClass: "operational" | "reporting" | "staging" | "audit";
  sourceTable: DiagnosticSourceTable;
  unit: "check_hits";
};

export type DiagnosticQueryResult = {
  buckets: DiagnosticBucket[];
  cooccurrences: Array<{
    familyA: RemediationFamily;
    familyB: RemediationFamily;
    sourceRecordCount: number;
    sourceTable: DiagnosticSourceTable;
    unit: "source_records";
  }>;
  distinctPeople: { status: "distinct_count_unresolved" };
  distinctSourceRecords: { count: number; unit: "source_records" };
  familyTotals: Array<{ family: RemediationFamily; hitCount: number; unit: "check_hits" }>;
  observedAt: string;
  overallCheckHits: { count: number; unit: "check_hits" };
  querySetVersion: typeof DIAGNOSTIC_QUERY_SET_VERSION;
};

export type ImpactInventory = {
  catalog: Array<{
    generatedColumnCount: number;
    sourceTable: DiagnosticSourceTable;
    triggerCount: number;
  }>;
  downstreamCodes: string[];
  inventoryDigest: string;
  inventoryVersion: typeof DIAGNOSTIC_IMPACT_INVENTORY_VERSION;
  writePathCodes: string[];
};

export type DiagnosticReceipt = {
  certificateVerified: boolean;
  event: "staging_remediation_diagnostic.completed";
  impactInventory: ImpactInventory;
  queryDigest: string;
  queryResult: DiagnosticQueryResult;
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

// Trace: FR-DIAG-01..07, FR-DIAG-09; NFR-02..04; AC-01, AC-02; EC-01, EC-04..08.
export function validateDiagnosticQueryResult(value: unknown): DiagnosticQueryResult {
  const result = readObject(value, [
    "buckets",
    "cooccurrences",
    "distinctPeople",
    "distinctSourceRecords",
    "familyTotals",
    "observedAt",
    "overallCheckHits",
    "querySetVersion",
  ]);
  if (result.querySetVersion !== DIAGNOSTIC_QUERY_SET_VERSION) fail("query_set_version_mismatch");
  if (!isIsoTimestamp(result.observedAt)) fail("invalid_observation_time");

  const buckets = readArray(result.buckets).map(validateBucket);
  const familyTotals = readArray(result.familyTotals).map(validateFamilyTotal);
  const overallCheckHits = validateCount(result.overallCheckHits, "check_hits");
  const distinctSourceRecords = validateCount(result.distinctSourceRecords, "source_records");
  const distinctPeople = readObject(result.distinctPeople, ["status"]);
  if (distinctPeople.status !== "distinct_count_unresolved") fail("diagnostic_schema_mismatch");
  const cooccurrences = readArray(result.cooccurrences).map(validateCooccurrence);

  const bucketTotals = new Map<RemediationFamily, number>(remediationFamilies.map((family) => [family, 0]));
  for (const bucket of buckets) {
    bucketTotals.set(bucket.family, (bucketTotals.get(bucket.family) ?? 0) + bucket.hitCount);
  }
  if (familyTotals.length !== remediationFamilies.length) fail("dishonest_diagnostic_total");
  remediationFamilies.forEach((family, index) => {
    const total = familyTotals[index];
    if (total?.family !== family || total.hitCount !== bucketTotals.get(family)) {
      fail("dishonest_diagnostic_total");
    }
  });
  const summed = familyTotals.reduce((total, item) => total + item.hitCount, 0);
  if (summed !== overallCheckHits.count) fail("dishonest_diagnostic_total");

  return {
    buckets,
    cooccurrences,
    distinctPeople: { status: "distinct_count_unresolved" },
    distinctSourceRecords,
    familyTotals,
    observedAt: result.observedAt as string,
    overallCheckHits,
    querySetVersion: DIAGNOSTIC_QUERY_SET_VERSION,
  };
}

// Trace: FR-DIAG-08, FR-DIAG-09, FR-DIAG-10; NFR-01..04; AC-01, AC-12.
export function createDiagnosticReceipt(input: {
  certificateVerified: boolean;
  impactInventory: unknown;
  queryDigest: string;
  queryResult: DiagnosticQueryResult;
  reviewedCommit: string;
  runnerDigest: string;
  targetClass: "disposable" | "staging";
  targetFingerprint: string;
  tlsMode: "disable" | "verify-full";
}): DiagnosticReceipt {
  const impactInventory = normalizeImpactInventory(input.impactInventory as ImpactInventory);
  const receiptWithoutDigest = {
    certificateVerified: input.certificateVerified,
    event: "staging_remediation_diagnostic.completed" as const,
    impactInventory,
    queryDigest: input.queryDigest,
    queryResult: validateDiagnosticQueryResult(input.queryResult),
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
  const receipt = {
    ...receiptWithoutDigest,
    receiptDigest: sha256Canonical(receiptWithoutDigest),
  };
  return validateDiagnosticReceipt(receipt);
}

export function validateDiagnosticReceipt(value: unknown): DiagnosticReceipt {
  const receipt = readObject(value, [
    "certificateVerified",
    "event",
    "impactInventory",
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
  ]);
  if (receipt.event !== "staging_remediation_diagnostic.completed" || receipt.receiptVersion !== "1") {
    fail("diagnostic_schema_mismatch");
  }
  if (!hex40.test(String(receipt.reviewedCommit))) fail("invalid_reviewed_commit");
  for (const digest of [receipt.queryDigest, receipt.runnerDigest, receipt.targetFingerprint, receipt.receiptDigest]) {
    if (!hex64.test(String(digest))) fail("invalid_digest");
  }
  if (!['disposable', 'staging'].includes(String(receipt.targetClass))) fail("diagnostic_schema_mismatch");
  if (!['disable', 'verify-full'].includes(String(receipt.tlsMode))) fail("diagnostic_schema_mismatch");
  if (typeof receipt.certificateVerified !== "boolean") fail("diagnostic_schema_mismatch");
  if (receipt.targetClass === "staging" && (receipt.tlsMode !== "verify-full" || receipt.certificateVerified !== true)) {
    fail("certificate_verification_failed");
  }
  if (receipt.transactionIsolation !== "repeatable_read" || receipt.transactionReadOnly !== true) {
    fail("snapshot_contract_failed");
  }
  validateTimeoutProfile(receipt.timeoutProfile);
  const queryResult = validateDiagnosticQueryResult(receipt.queryResult);
  const impactInventory = validateImpactInventory(receipt.impactInventory);
  const typed = { ...receipt, impactInventory, queryResult } as unknown as DiagnosticReceipt;
  const { receiptDigest, ...withoutDigest } = typed;
  if (sha256Canonical(withoutDigest) !== receiptDigest) fail("receipt_digest_mismatch");
  assertSanitizedDiagnosticJson(JSON.stringify(typed));
  return typed;
}

// Trace: FR-DIAG-07, FR-DIAG-09; NFR-02, NFR-03; AC-01.
export function assertSanitizedDiagnosticJson(serialized: string) {
  const forbidden = [
    /postgres(?:ql)?:\/\//i,
    /-----BEGIN (?:CERTIFICATE|PRIVATE KEY)-----/i,
    /\bBearer\s+[A-Za-z0-9._~-]+/i,
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/,
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i,
    /\b(?:password|passwd|pwd)\s*[=:]/i,
    /\b(?:\d{1,3}\.){3}\d{1,3}\b/,
  ];
  if (forbidden.some((pattern) => pattern.test(serialized))) fail("sanitization_failed");
}

export function sha256Hex(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

export function sha256Canonical(value: unknown) {
  return sha256Hex(canonicalStringify(value));
}

function validateBucket(value: unknown): DiagnosticBucket {
  const bucket = readObject(value, [
    "dimensions",
    "distinctSourceRecordCount?",
    "family",
    "hitCount",
    "querySetVersion",
    "reasonCodes",
    "sampleRefs",
    "sourceClass",
    "sourceTable",
    "unit",
  ]);
  const family = readEnum(bucket.family, familySet, "family_not_allowed") as RemediationFamily;
  const sourceTable = readEnum(bucket.sourceTable, sourceTableSet, "source_table_not_allowed") as DiagnosticSourceTable;
  const sourceClass = readEnum(bucket.sourceClass, sourceClassSet, "source_class_not_allowed");
  if (sourceClassForTable(sourceTable) !== sourceClass) fail("source_class_mismatch");
  if (bucket.querySetVersion !== DIAGNOSTIC_QUERY_SET_VERSION || bucket.unit !== "check_hits") {
    fail("diagnostic_schema_mismatch");
  }
  const hitCount = readNonNegativeInteger(bucket.hitCount, "invalid_hit_count");
  if (hitCount === 0) fail("empty_diagnostic_bucket");
  const reasonCodes = readArray(bucket.reasonCodes).map((reason) =>
    readEnum(reason, reasonSet, "reason_code_not_allowed") as DiagnosticReasonCode);
  if (reasonCodes.length === 0 || new Set(reasonCodes).size !== reasonCodes.length) {
    fail("reason_code_not_allowed");
  }
  const sampleRefs = readArray(bucket.sampleRefs).map((sample) => String(sample));
  if (sampleRefs.length > 5) fail("too_many_sample_refs");
  if (sampleRefs.some((sample) => !hex12.test(sample))) fail("unsafe_sample_ref");
  const dimensions = validateDimensions(family, bucket.dimensions, reasonCodes);
  validateFamilySource(family, sourceTable, reasonCodes);
  const distinct = bucket.distinctSourceRecordCount === undefined
    ? undefined
    : readNonNegativeInteger(bucket.distinctSourceRecordCount, "invalid_distinct_source_count");
  if (family === "ASSIGN-01" ? distinct !== undefined : distinct !== hitCount) {
    fail("invalid_distinct_source_count");
  }
  return {
    dimensions,
    ...(distinct === undefined ? {} : { distinctSourceRecordCount: distinct }),
    family,
    hitCount,
    querySetVersion: DIAGNOSTIC_QUERY_SET_VERSION,
    reasonCodes,
    sampleRefs,
    sourceClass: sourceClass as DiagnosticBucket["sourceClass"],
    sourceTable,
    unit: "check_hits",
  };
}

function validateDimensions(
  family: RemediationFamily,
  value: unknown,
  reasons: DiagnosticReasonCode[],
): Record<string, unknown> {
  if (family === "TARGET-02") {
    const dimensions = readObject(value, [
      "approvalEvidence", "approvalMode", "countDelta", "createdVintage", "requestStatus", "writeSource",
    ]);
    readEnum(dimensions.approvalEvidence, new Set(["absent", "present"]), "diagnostic_schema_mismatch");
    readEnum(dimensions.approvalMode, new Set(["adjusted", "direct", "unknown"]), "diagnostic_schema_mismatch");
    readEnum(dimensions.createdVintage, new Set(["before_2025", "2025", "2026_h1", "2026_h2", "future_or_unknown"]), "diagnostic_schema_mismatch");
    readEnum(dimensions.requestStatus, new Set(["approved", "pending_region_approval", "unknown"]), "diagnostic_schema_mismatch");
    readEnum(dimensions.writeSource, new Set(["legacy_or_unknown", "pilot_roster_import"]), "diagnostic_schema_mismatch");
    const delta = readInteger(dimensions.countDelta, "invalid_count_delta");
    if (delta === 0) fail("invalid_count_delta");
    const direction = delta < 0
      ? "target.count_less_than_json_length"
      : "target.count_greater_than_json_length";
    if (!reasons.includes(direction)) fail("reason_code_not_allowed");
    if (reasons.filter((reason) => reason.startsWith("target.count_")).length !== 1) {
      fail("reason_code_not_allowed");
    }
    const isUnknown = dimensions.writeSource === "legacy_or_unknown";
    if (reasons.includes("target.write_source_legacy_or_unknown") !== isUnknown) {
      fail("reason_code_not_allowed");
    }
    if (dimensions.approvalEvidence === "absent" && dimensions.approvalMode !== "unknown") {
      fail("diagnostic_schema_mismatch");
    }
    return { ...dimensions, countDelta: delta };
  }
  if (family === "ORG-02" || family === "ORG-04") {
    const dimensions = readObject(value, ["multipleReasons"]);
    if (typeof dimensions.multipleReasons !== "boolean" || dimensions.multipleReasons !== (reasons.length > 1)) {
      fail("diagnostic_schema_mismatch");
    }
    return dimensions;
  }
  const dimensions = readObject(value, ["openEnded", "overlapKind", "scopeRelation"]);
  if (typeof dimensions.openEnded !== "boolean") fail("diagnostic_schema_mismatch");
  readEnum(dimensions.overlapKind, new Set(["same_day_boundary", "strict_multi_day"]), "diagnostic_schema_mismatch");
  readEnum(dimensions.scopeRelation, new Set(["cross_scope", "same_scope"]), "diagnostic_schema_mismatch");
  const overlapReason = dimensions.overlapKind === "same_day_boundary"
    ? "assignment.same_day_boundary"
    : "assignment.strict_multi_day";
  const scopeReason = dimensions.scopeRelation === "same_scope"
    ? "assignment.same_scope"
    : "assignment.cross_scope";
  if (!reasons.includes(overlapReason) || !reasons.includes(scopeReason)) fail("reason_code_not_allowed");
  if (reasons.includes("assignment.open_ended") !== dimensions.openEnded) fail("reason_code_not_allowed");
  return dimensions;
}

function validateFamilySource(
  family: RemediationFamily,
  sourceTable: DiagnosticSourceTable,
  reasons: DiagnosticReasonCode[],
) {
  const prefix = family === "TARGET-02" ? "target."
    : family === "ASSIGN-01" ? "assignment."
      : "org.";
  if (reasons.some((reason) => !reason.startsWith(prefix))) fail("reason_code_not_allowed");
  const org02Reasons = new Set<string>([
    "org.assignment_region_store_region",
    "org.region_company_store_company",
    "org.employee_company_store_company",
    "org.position_company_store_company",
  ]);
  const org04Reasons = new Set<string>([
    "org.scope_company_region",
    "org.scope_company_store",
    "org.scope_region_store",
    "org.bootstrap_resolved_company_batch_company",
  ]);
  if (family === "ORG-02" && reasons.some((reason) => !org02Reasons.has(reason))) {
    fail("reason_code_not_allowed");
  }
  if (family === "ORG-04" && reasons.some((reason) => !org04Reasons.has(reason))) {
    fail("reason_code_not_allowed");
  }
  if (family === "TARGET-02" && sourceTable !== "ops.target_distribution_request") {
    fail("source_table_not_allowed");
  }
  if ((family === "ASSIGN-01" || family === "ORG-02") && sourceTable !== "ops.employee_assignment_history") {
    fail("source_table_not_allowed");
  }
  if (family === "ORG-04" && sourceTable === "ops.employee_assignment_history") {
    fail("source_table_not_allowed");
  }
}

function validateFamilyTotal(value: unknown) {
  const item = readObject(value, ["family", "hitCount", "unit"]);
  return {
    family: readEnum(item.family, familySet, "family_not_allowed") as RemediationFamily,
    hitCount: readNonNegativeInteger(item.hitCount, "invalid_hit_count"),
    unit: readEnum(item.unit, new Set(["check_hits"]), "diagnostic_schema_mismatch") as "check_hits",
  };
}

function validateCooccurrence(value: unknown) {
  const item = readObject(value, ["familyA", "familyB", "sourceRecordCount", "sourceTable", "unit"]);
  const familyA = readEnum(item.familyA, familySet, "family_not_allowed") as RemediationFamily;
  const familyB = readEnum(item.familyB, familySet, "family_not_allowed") as RemediationFamily;
  if (familyA === familyB) fail("diagnostic_schema_mismatch");
  return {
    familyA,
    familyB,
    sourceRecordCount: readNonNegativeInteger(item.sourceRecordCount, "invalid_distinct_source_count"),
    sourceTable: readEnum(item.sourceTable, sourceTableSet, "source_table_not_allowed") as DiagnosticSourceTable,
    unit: readEnum(item.unit, new Set(["source_records"]), "diagnostic_schema_mismatch") as "source_records",
  };
}

function normalizeImpactInventory(value: ImpactInventory): ImpactInventory {
  const inventory = validateImpactInventoryShape(value);
  const withoutDigest: Omit<ImpactInventory, "inventoryDigest"> = {
    catalog: [...inventory.catalog].sort((a, b) => a.sourceTable.localeCompare(b.sourceTable)),
    downstreamCodes: [...inventory.downstreamCodes].sort(),
    inventoryVersion: DIAGNOSTIC_IMPACT_INVENTORY_VERSION,
    writePathCodes: [...inventory.writePathCodes].sort(),
  };
  return { ...withoutDigest, inventoryDigest: sha256Canonical(withoutDigest) };
}

function validateImpactInventory(value: unknown): ImpactInventory {
  const normalized = normalizeImpactInventory(value as ImpactInventory);
  const supplied = readObject(value, [
    "catalog", "downstreamCodes", "inventoryDigest", "inventoryVersion", "writePathCodes",
  ]).inventoryDigest;
  if (normalized.inventoryDigest !== supplied) fail("inventory_digest_mismatch");
  return normalized;
}

function validateImpactInventoryShape(value: unknown) {
  const inventory = readObject(value, [
    "catalog", "downstreamCodes", "inventoryDigest", "inventoryVersion", "writePathCodes",
  ]);
  if (inventory.inventoryVersion !== DIAGNOSTIC_IMPACT_INVENTORY_VERSION) fail("diagnostic_schema_mismatch");
  if (!hex64.test(String(inventory.inventoryDigest))) fail("invalid_digest");
  const catalog = readArray(inventory.catalog).map((entry) => {
    const item = readObject(entry, ["generatedColumnCount", "sourceTable", "triggerCount"]);
    return {
      generatedColumnCount: readNonNegativeInteger(item.generatedColumnCount, "diagnostic_schema_mismatch"),
      sourceTable: readEnum(item.sourceTable, sourceTableSet, "source_table_not_allowed") as DiagnosticSourceTable,
      triggerCount: readNonNegativeInteger(item.triggerCount, "diagnostic_schema_mismatch"),
    };
  });
  const writes = readArray(inventory.writePathCodes).map((code) => readEnum(code, writePathSet, "write_path_not_allowed"));
  const downstream = readArray(inventory.downstreamCodes).map((code) => readEnum(code, downstreamSet, "downstream_not_allowed"));
  return { catalog, downstreamCodes: downstream, inventoryVersion: DIAGNOSTIC_IMPACT_INVENTORY_VERSION, writePathCodes: writes };
}

function validateCount<T extends CountUnit>(value: unknown, unit: T): { count: number; unit: T } {
  const count = readObject(value, ["count", "unit"]);
  if (count.unit !== unit) fail("diagnostic_schema_mismatch");
  return { count: readNonNegativeInteger(count.count, "invalid_hit_count"), unit };
}

function validateTimeoutProfile(value: unknown) {
  const timeout = readObject(value, ["connectionMs", "idleMs", "queryMs", "statementMs"]);
  if (timeout.connectionMs !== 5000 || timeout.idleMs !== 1000 || timeout.queryMs !== 30000 || timeout.statementMs !== 30000) {
    fail("snapshot_contract_failed");
  }
}

function readObject(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("diagnostic_schema_mismatch");
  const required = keys.filter((key) => !key.endsWith("?"));
  const allowed = new Set(keys.map((key) => key.replace(/\?$/, "")));
  const actual = Object.keys(value as object);
  if (required.some((key) => !actual.includes(key)) || actual.some((key) => !allowed.has(key))) {
    fail("diagnostic_schema_mismatch");
  }
  return value as Record<string, unknown>;
}

function readArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) fail("diagnostic_schema_mismatch");
  return value;
}

function readEnum(value: unknown, allowed: Set<string>, error: string) {
  if (typeof value !== "string" || !allowed.has(value)) fail(error);
  return value;
}

function readNonNegativeInteger(value: unknown, error: string) {
  const number = readInteger(value, error);
  if (number < 0) fail(error);
  return number;
}

function readInteger(value: unknown, error: string) {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) fail(error);
  return value;
}

function isIsoTimestamp(value: unknown) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value;
}

function canonicalStringify(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as object).sort().map((key) =>
      `${JSON.stringify(key)}:${canonicalStringify((value as Record<string, unknown>)[key])}`).join(",")}}`;
  }
  fail("diagnostic_schema_mismatch");
}

function fail(message: string): never {
  throw new Error(message);
}
