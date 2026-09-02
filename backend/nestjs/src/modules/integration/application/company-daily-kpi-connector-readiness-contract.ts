/**
 * Provider-neutral contract declarations and low-level structural helpers for
 * the company daily KPI connector readiness evidence.
 *
 * This module has no I/O and no runtime wiring.  The public facade re-exports
 * the contract declarations while the validation module consumes the helper
 * values below to keep each active source file within the repository budget.
 */

export const sourceOperationAliases = [
  "sales",
  "footfall",
  "gsm",
  "store-directory",
] as const;
export type SourceOperationAlias = (typeof sourceOperationAliases)[number];

export type ReadinessState = "not_ready" | "ready_for_connector_implementation";

export const authCategories = [
  "none",
  "basic",
  "bearer",
  "api-key",
  "cookie",
  "mutual-tls",
  "custom",
  "unknown",
] as const;
export type AuthCategory = (typeof authCategories)[number];

export const transportCategories = ["http", "https", "unknown"] as const;
export type TransportCategory = (typeof transportCategories)[number];

export const tlsVerifications = [
  "verified",
  "not-applicable",
  "unverified",
  "unknown",
] as const;
export type TlsVerification = (typeof tlsVerifications)[number];

export const rateLimitKnowledgeValues = ["documented", "observed", "unknown"] as const;
export type RateLimitKnowledge = (typeof rateLimitKnowledgeValues)[number];

export const neutralFieldPresences = ["required", "nullable", "absent"] as const;
export type NeutralFieldPresence = (typeof neutralFieldPresences)[number];

export const neutralFieldTypes = [
  "string",
  "boolean",
  "integer",
  "decimal-text",
  "date",
] as const;
export type NeutralFieldType = (typeof neutralFieldTypes)[number];

export const salesNeutralFieldAliases = [
  "sourceDateToken",
  "ephemeralInvoiceId",
  "personnelCode",
  "displayName",
  "storeCode",
  "isReturn",
  "quantity",
  "amountTry",
] as const;
export type SalesNeutralFieldAlias = (typeof salesNeutralFieldAliases)[number];

export const footfallNeutralFieldAliases = ["sourceDateToken", "storeCode", "total"] as const;
export type FootfallNeutralFieldAlias = (typeof footfallNeutralFieldAliases)[number];

export const gsmNeutralFieldAliases = ["storeCode", "consent"] as const;
export type GsmNeutralFieldAlias = (typeof gsmNeutralFieldAliases)[number];

export const storeDirectoryNeutralFieldAliases = ["storeCode", "displayDescription"] as const;
export type StoreDirectoryNeutralFieldAlias = (typeof storeDirectoryNeutralFieldAliases)[number];

export const alertChannelCategories = ["email", "chat", "incident-system", "other", "unknown"] as const;
export type AlertChannelCategory = (typeof alertChannelCategories)[number];

export const failureStatusClasses = [
  "3xx",
  "4xx",
  "5xx",
  "timeout",
  "connection-failure",
  "unknown",
] as const;
export type FailureStatusClass = (typeof failureStatusClasses)[number];

export const safeReasonCodes = [
  "transport_failure",
  "timeout",
  "unexpected_status",
  "content_type_mismatch",
  "envelope_mismatch",
  "validation_failed",
  "budget_exceeded",
  "mapping_missing",
  "persistence_failed",
  "unknown_failure",
] as const;
export type SafeReasonCode = (typeof safeReasonCodes)[number];

export type SanitizedOperationObservation = {
  observationDate: string;
  rowCount: number;
  responseBytes: number;
  requestElapsedMs: number;
  parseElapsedMs: number;
  totalComponentElapsedMs: number;
  statusClass: "2xx" | "3xx" | "4xx" | "5xx" | "timeout" | "connection-failure";
  parseOutcome: "accepted" | "empty" | "rejected";
};

export type SanitizedOperationEvidence = {
  operation: SourceOperationAlias;
  successStatusClass: "2xx" | "unknown";
  contentType: "application/json" | "other" | "unknown";
  topLevelShape: "array" | "object" | "unknown";
  emptyResultShape: "empty-array" | "empty-object" | "no-content" | "unknown";
  failureStatusClasses: readonly FailureStatusClass[];
  safeFailureCategories: readonly SafeReasonCode[];
  observations: readonly SanitizedOperationObservation[];
};

export type NeutralFieldRule = {
  presence: NeutralFieldPresence;
  acceptedTypes: readonly NeutralFieldType[];
};

export type NeutralFieldClassification =
  | (NeutralFieldRule & {
      operation: "sales";
      fieldAlias: SalesNeutralFieldAlias;
    })
  | (NeutralFieldRule & {
      operation: "footfall";
      fieldAlias: FootfallNeutralFieldAlias;
    })
  | (NeutralFieldRule & {
      operation: "gsm";
      fieldAlias: GsmNeutralFieldAlias;
    })
  | (NeutralFieldRule & {
      operation: "store-directory";
      fieldAlias: StoreDirectoryNeutralFieldAlias;
    });

export type OperationRuntimeBudget = {
  operation: SourceOperationAlias;
  maxRows: number;
  maxResponseBytes: number;
  requestTimeoutMs: number;
  parseTimeoutMs: number;
  totalComponentTimeoutMs: number;
};

export type SanitizedOwnershipEvidence = {
  storeMappingOwnerRole: string;
  allowlistOwnerRole: string;
  alertOwnerRole: string;
  alertChannelCategory: AlertChannelCategory;
};

export type ConnectorReadinessEvidence = {
  schemaVersion: 1;
  dataClass: "sanitized-metadata";
  networkScope: "company-private";
  authCategory: AuthCategory;
  transport: TransportCategory;
  tlsVerification: TlsVerification;
  securityAcceptanceRecorded: boolean;
  rateLimitKnowledge: RateLimitKnowledge;
  operationEvidence: readonly SanitizedOperationEvidence[];
  neutralFieldClassifications: readonly NeutralFieldClassification[];
  runtimeBudgets: readonly OperationRuntimeBudget[];
  ownership: SanitizedOwnershipEvidence;
  privacyReviewPassed: boolean;
  evidenceCollectedThrough: string;
  reviewedAt: string;
};

export type ConnectorReadinessEvaluationContext = {
  evaluatedAt: string;
  /** Supplied by the approved retry schedule; it is deliberately not evidence. */
  nextRetryBoundaryMs: number;
  /** Explicit owner-approved role aliases; never inferred from role syntax. */
  approvedOwnerRoleAliases: readonly string[];
};

export type ConnectorReadinessSummary = {
  state: ReadinessState;
  evidenceCollectedThrough: string;
  reviewedAt: string;
  evaluatedAt: string;
  evidenceAgeDays: number;
  completedGates: string[];
  missingGates: string[];
};

export type ConnectorReadinessValidationResult = {
  valid: boolean;
  /** Paths and safe reason labels only; input values never cross this boundary. */
  errors: string[];
};

export const connectorReadinessGateNames = [
  "evidence_structure",
  "operation_completeness",
  "operation_envelope_review",
  "neutral_field_completeness",
  "observation_coverage",
  "runtime_budgets",
  "retry_boundary",
  "transport_security",
  "rate_limit_posture",
  "ownership",
  "privacy_review",
  "evidence_freshness",
  "date_ordering",
] as const;

export const evidenceKeys = [
  "schemaVersion",
  "dataClass",
  "networkScope",
  "authCategory",
  "transport",
  "tlsVerification",
  "securityAcceptanceRecorded",
  "rateLimitKnowledge",
  "operationEvidence",
  "neutralFieldClassifications",
  "runtimeBudgets",
  "ownership",
  "privacyReviewPassed",
  "evidenceCollectedThrough",
  "reviewedAt",
] as const;

export const operationEvidenceKeys = [
  "operation",
  "successStatusClass",
  "contentType",
  "topLevelShape",
  "emptyResultShape",
  "failureStatusClasses",
  "safeFailureCategories",
  "observations",
] as const;

export const observationKeys = [
  "observationDate",
  "rowCount",
  "responseBytes",
  "requestElapsedMs",
  "parseElapsedMs",
  "totalComponentElapsedMs",
  "statusClass",
  "parseOutcome",
] as const;

export const neutralFieldClassificationKeys = [
  "operation",
  "fieldAlias",
  "presence",
  "acceptedTypes",
] as const;

export const runtimeBudgetKeys = [
  "operation",
  "maxRows",
  "maxResponseBytes",
  "requestTimeoutMs",
  "parseTimeoutMs",
  "totalComponentTimeoutMs",
] as const;

export const ownershipKeys = [
  "storeMappingOwnerRole",
  "allowlistOwnerRole",
  "alertOwnerRole",
  "alertChannelCategory",
] as const;

export const expectedNeutralFields: ReadonlyMap<SourceOperationAlias, readonly string[]> = new Map<
  SourceOperationAlias,
  readonly string[]
>([
  ["sales", salesNeutralFieldAliases],
  ["footfall", footfallNeutralFieldAliases],
  ["gsm", gsmNeutralFieldAliases],
  ["store-directory", storeDirectoryNeutralFieldAliases],
]);

export const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER;
export const DAY_MS = 86_400_000;
export const MAX_EVIDENCE_AGE_DAYS = 30;
export const EVIDENCE_PATH = "evidence";
const ROLE_SENTINELS = new Set([
  "unknown",
  "unassigned",
  "unreviewed",
  "none",
  "null",
  "n/a",
  "na",
  "pending",
]);

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

export function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

export function hasExactKeys(
  value: unknown,
  expected: readonly string[],
  path: string,
  errors: string[],
): value is Record<string, unknown> {
  if (!isRecord(value)) {
    errors.push(`${path}:object_required`);
    return false;
  }

  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== expected.length ||
    keys.some((key) => typeof key !== "string" || !expected.includes(key))
  ) {
    errors.push(`${path}:unknown_keys`);
  }

  for (const key of expected) {
    if (!hasOwn(value, key)) {
      errors.push(`${path}.${key}:missing`);
    }
  }

  return true;
}

export function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === "string" && values.includes(value as T);
}

export function isSafeNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= MAX_SAFE_INTEGER;
}

export function isSafePositiveInteger(value: unknown): value is number {
  return isSafeNonNegativeInteger(value) && value > 0;
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function isBeforeOrEqual(left: string, right: string): boolean {
  return left <= right;
}

export function containsForbiddenString(value: string): boolean {
  const privateEndpoint =
    /\b(?:10|127|169\.254|172\.(?:1[6-9]|2\d|3[01])|192\.168)(?:\.\d{1,3}){2,3}\b/.test(value) ||
    /(?:^|[^0-9a-f])(?:f[cd][0-9a-f]{2}|fe[89ab][0-9a-f]):[0-9a-f:]+(?:$|[^0-9a-f])/i.test(value) ||
    /(?:^|[^0-9a-f])::1(?:$|[^0-9a-f])/i.test(value) ||
    /\blocalhost(?::\d+)?\b/i.test(value) ||
    /\b(?:[a-z0-9-]+\.)+(?:internal|local|lan|corp|private)(?::\d+)?\b/i.test(value) ||
    /https?:\/\//i.test(value);
  const valueLike =
    /\b(?:authorization|password|secret|token|api[-_ ]?key|credential|cookie|header|certificate|private[-_ ]?key)\b/i.test(
      value,
    );
  const contactLike = /@/.test(value) || /\+?\d[\d\s().-]{6,}\d/.test(value);
  return privateEndpoint || valueLike || contactLike;
}

/**
 * Role aliases have no approved private allowlist in this contract.  Keep the
 * public syntax conservative and reject contact/person-like values instead of
 * attempting to identify a real person from an unbounded name list.
 */
export function isSafeRoleAlias(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value &&
    /^(?:[a-z][a-z0-9]*|[A-Z][A-Z0-9]*)(?:[-_](?:[a-z][a-z0-9]*|[A-Z][A-Z0-9]*))*$/.test(value) &&
    !ROLE_SENTINELS.has(value.toLowerCase()) &&
    !containsForbiddenString(value)
  );
}

export function pushEnumError(
  record: Record<string, unknown>,
  key: string,
  values: readonly string[],
  path: string,
  errors: string[],
): boolean {
  if (!isOneOf(record[key], values)) {
    errors.push(`${path}.${key}:unknown_value`);
    return false;
  }
  return true;
}
