/**
 * Public, provider-neutral evidence for the company daily KPI connector.
 *
 * This module intentionally has no I/O.  It validates only the sanitized
 * metadata contract and derives a closed readiness summary.  In particular,
 * a ready summary permits a separately reviewed implementation proposal; it
 * never means that a connector, scheduler, credential, or source is active.
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

const evidenceKeys = [
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

const operationEvidenceKeys = [
  "operation",
  "successStatusClass",
  "contentType",
  "topLevelShape",
  "emptyResultShape",
  "failureStatusClasses",
  "safeFailureCategories",
  "observations",
] as const;

const observationKeys = [
  "observationDate",
  "rowCount",
  "responseBytes",
  "requestElapsedMs",
  "parseElapsedMs",
  "totalComponentElapsedMs",
  "statusClass",
  "parseOutcome",
] as const;

const neutralFieldClassificationKeys = [
  "operation",
  "fieldAlias",
  "presence",
  "acceptedTypes",
] as const;

const runtimeBudgetKeys = [
  "operation",
  "maxRows",
  "maxResponseBytes",
  "requestTimeoutMs",
  "parseTimeoutMs",
  "totalComponentTimeoutMs",
] as const;

const ownershipKeys = [
  "storeMappingOwnerRole",
  "allowlistOwnerRole",
  "alertOwnerRole",
  "alertChannelCategory",
] as const;

const expectedNeutralFields: ReadonlyMap<SourceOperationAlias, readonly string[]> = new Map<
  SourceOperationAlias,
  readonly string[]
>([
  ["sales", salesNeutralFieldAliases],
  ["footfall", footfallNeutralFieldAliases],
  ["gsm", gsmNeutralFieldAliases],
  ["store-directory", storeDirectoryNeutralFieldAliases],
]);

const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER;
const DAY_MS = 86_400_000;
const MAX_EVIDENCE_AGE_DAYS = 30;
const EVIDENCE_PATH = "evidence";
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function hasExactKeys(
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

function isOneOf<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === "string" && values.includes(value as T);
}

function isSafeNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= MAX_SAFE_INTEGER;
}

function isSafePositiveInteger(value: unknown): value is number {
  return isSafeNonNegativeInteger(value) && value > 0;
}

function isIsoDate(value: unknown): value is string {
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

function isBeforeOrEqual(left: string, right: string): boolean {
  return left <= right;
}

function containsForbiddenString(value: string): boolean {
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
function isSafeRoleAlias(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value &&
    /^(?:[a-z][a-z0-9]*|[A-Z][A-Z0-9]*)(?:[-_](?:[a-z][a-z0-9]*|[A-Z][A-Z0-9]*))*$/.test(value) &&
    !ROLE_SENTINELS.has(value.toLowerCase()) &&
    !containsForbiddenString(value)
  );
}

function pushEnumError(
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

function validateObservation(value: unknown, path: string, errors: string[]): value is SanitizedOperationObservation {
  if (!hasExactKeys(value, observationKeys, path, errors)) {
    return false;
  }

  const observationDate = value.observationDate;
  if (!isIsoDate(observationDate)) errors.push(`${path}.observationDate:invalid_date`);

  for (const key of [
    "rowCount",
    "responseBytes",
    "requestElapsedMs",
    "parseElapsedMs",
    "totalComponentElapsedMs",
  ] as const) {
    if (!isSafeNonNegativeInteger(value[key])) {
      errors.push(`${path}.${key}:non_negative_safe_integer_required`);
    }
  }

  pushEnumError(value, "statusClass", ["2xx", "3xx", "4xx", "5xx", "timeout", "connection-failure"], path, errors);
  pushEnumError(value, "parseOutcome", ["accepted", "empty", "rejected"], path, errors);

  if (
    isSafeNonNegativeInteger(value.requestElapsedMs) &&
    isSafeNonNegativeInteger(value.parseElapsedMs) &&
    isSafeNonNegativeInteger(value.totalComponentElapsedMs) &&
    (value.requestElapsedMs > value.totalComponentElapsedMs - value.parseElapsedMs ||
      value.parseElapsedMs > value.totalComponentElapsedMs)
  ) {
    errors.push(`${path}:inconsistent_timing`);
  }

  return true;
}

function validateOperationEvidence(
  value: unknown,
  path: string,
  errors: string[],
): value is SanitizedOperationEvidence {
  if (!hasExactKeys(value, operationEvidenceKeys, path, errors)) {
    return false;
  }

  pushEnumError(value, "operation", sourceOperationAliases, path, errors);
  pushEnumError(value, "successStatusClass", ["2xx", "unknown"], path, errors);
  pushEnumError(value, "contentType", ["application/json", "other", "unknown"], path, errors);
  pushEnumError(value, "topLevelShape", ["array", "object", "unknown"], path, errors);
  pushEnumError(value, "emptyResultShape", ["empty-array", "empty-object", "no-content", "unknown"], path, errors);

  if (!isArray(value.failureStatusClasses)) {
    errors.push(`${path}.failureStatusClasses:array_required`);
  } else {
    const seen = new Set<string>();
    value.failureStatusClasses.forEach((status, index) => {
      if (!isOneOf(status, failureStatusClasses)) {
        errors.push(`${path}.failureStatusClasses[${index}]:unknown_value`);
      } else if (seen.has(status)) {
        errors.push(`${path}.failureStatusClasses[${index}]:duplicate_value`);
      } else {
        seen.add(status);
      }
    });
  }

  if (!isArray(value.safeFailureCategories)) {
    errors.push(`${path}.safeFailureCategories:array_required`);
  } else {
    const seen = new Set<string>();
    value.safeFailureCategories.forEach((category, index) => {
      if (!isOneOf(category, safeReasonCodes)) {
        errors.push(`${path}.safeFailureCategories[${index}]:unknown_value`);
      } else if (seen.has(category)) {
        errors.push(`${path}.safeFailureCategories[${index}]:duplicate_value`);
      } else {
        seen.add(category);
      }
    });
  }

  if (!isArray(value.observations)) {
    errors.push(`${path}.observations:array_required`);
  } else {
    const dates = new Set<string>();
    value.observations.forEach((observation, index) => {
      const observationPath = `${path}.observations[${index}]`;
      validateObservation(observation, observationPath, errors);
      if (isRecord(observation) && isIsoDate(observation.observationDate)) {
        if (dates.has(observation.observationDate)) {
          errors.push(`${observationPath}.observationDate:duplicate_value`);
        }
        dates.add(observation.observationDate);
      }
    });
  }

  return true;
}

function validateNeutralFieldClassification(
  value: unknown,
  path: string,
  errors: string[],
): value is NeutralFieldClassification {
  if (!hasExactKeys(value, neutralFieldClassificationKeys, path, errors)) {
    return false;
  }

  const operationValid = pushEnumError(value, "operation", sourceOperationAliases, path, errors);
  const operation = operationValid ? (value.operation as SourceOperationAlias) : null;
  const fieldAliases = operation === null ? undefined : expectedNeutralFields.get(operation);
  if (!fieldAliases || !isOneOf(value.fieldAlias, fieldAliases)) {
    errors.push(`${path}.fieldAlias:unknown_pair`);
  }
  pushEnumError(value, "presence", neutralFieldPresences, path, errors);

  if (!isArray(value.acceptedTypes)) {
    errors.push(`${path}.acceptedTypes:array_required`);
  } else {
    if (value.acceptedTypes.length === 0) {
      errors.push(`${path}.acceptedTypes:incomplete`);
    }
    const seen = new Set<string>();
    value.acceptedTypes.forEach((type, index) => {
      if (!isOneOf(type, neutralFieldTypes)) {
        errors.push(`${path}.acceptedTypes[${index}]:unknown_value`);
      } else if (seen.has(type)) {
        errors.push(`${path}.acceptedTypes[${index}]:duplicate_value`);
      } else {
        seen.add(type);
      }
    });
  }

  return true;
}

function validateRuntimeBudget(value: unknown, path: string, errors: string[]): value is OperationRuntimeBudget {
  if (!hasExactKeys(value, runtimeBudgetKeys, path, errors)) {
    return false;
  }

  pushEnumError(value, "operation", sourceOperationAliases, path, errors);
  for (const key of [
    "maxRows",
    "maxResponseBytes",
    "requestTimeoutMs",
    "parseTimeoutMs",
    "totalComponentTimeoutMs",
  ] as const) {
    if (!isSafePositiveInteger(value[key])) {
      errors.push(`${path}.${key}:positive_safe_integer_required`);
    }
  }
  if (
    isSafePositiveInteger(value.requestTimeoutMs) &&
    isSafePositiveInteger(value.parseTimeoutMs) &&
    isSafePositiveInteger(value.totalComponentTimeoutMs) &&
    (value.requestTimeoutMs > value.totalComponentTimeoutMs ||
      value.parseTimeoutMs > value.totalComponentTimeoutMs - value.requestTimeoutMs)
  ) {
    errors.push(`${path}:inconsistent_timing`);
  }
  return true;
}

function validateOwnership(value: unknown, path: string, errors: string[]): value is SanitizedOwnershipEvidence {
  if (!hasExactKeys(value, ownershipKeys, path, errors)) {
    return false;
  }

  for (const key of ["storeMappingOwnerRole", "allowlistOwnerRole", "alertOwnerRole"] as const) {
    if (!isSafeRoleAlias(value[key])) {
      errors.push(`${path}.${key}:safe_role_alias_required`);
    }
  }
  pushEnumError(value, "alertChannelCategory", alertChannelCategories, path, errors);
  return true;
}

function isEligibleObservation(value: SanitizedOperationObservation): boolean {
  return value.statusClass === "2xx" && (value.parseOutcome === "accepted" || value.parseOutcome === "empty");
}

function latestEligibleObservationDate(evidence: SanitizedOperationEvidence): string | null {
  const dates = evidence.observations
    .filter(isEligibleObservation)
    .map((observation) => observation.observationDate)
    .filter(isIsoDate);
  return dates.length === 0 ? null : [...dates].sort().at(-1) ?? null;
}

function expectedEvidenceCollectedThrough(
  operationEvidence: readonly SanitizedOperationEvidence[],
): string | null {
  const latestDates: string[] = [];
  for (const operation of sourceOperationAliases) {
    const evidence = operationEvidence.find((entry) => entry.operation === operation);
    if (!evidence) return null;
    const latest = latestEligibleObservationDate(evidence);
    if (latest === null) return null;
    latestDates.push(latest);
  }
  return [...latestDates].sort()[0] ?? null;
}

function operationEntriesComplete(operationEvidence: readonly SanitizedOperationEvidence[]): boolean {
  return (
    operationEvidence.length === sourceOperationAliases.length &&
    new Set(operationEvidence.map((entry) => entry.operation)).size === sourceOperationAliases.length &&
    sourceOperationAliases.every((operation) => operationEvidence.some((entry) => entry.operation === operation))
  );
}

function fieldEntriesComplete(classifications: readonly NeutralFieldClassification[]): boolean {
  const expected = sourceOperationAliases.flatMap((operation) =>
    (expectedNeutralFields.get(operation) ?? []).map((fieldAlias) => `${operation}:${fieldAlias}`),
  );
  const actual = classifications.map((entry) => `${entry.operation}:${entry.fieldAlias}`);
  return (
    classifications.length === expected.length &&
    new Set(actual).size === actual.length &&
    expected.every((key) => actual.includes(key)) &&
    classifications.every((entry) => entry.acceptedTypes.length > 0)
  );
}

function budgetEntriesComplete(budgets: readonly OperationRuntimeBudget[]): boolean {
  return (
    budgets.length === sourceOperationAliases.length &&
    new Set(budgets.map((budget) => budget.operation)).size === sourceOperationAliases.length &&
    sourceOperationAliases.every((operation) => budgets.some((budget) => budget.operation === operation))
  );
}

function budgetsCoverEligibleObservations(
  operationEvidence: readonly SanitizedOperationEvidence[],
  budgets: readonly OperationRuntimeBudget[],
): boolean {
  if (!operationEntriesComplete(operationEvidence) || !budgetEntriesComplete(budgets)) {
    return false;
  }

  return operationEvidence.every((operation) => {
    const budget = budgets.find((entry) => entry.operation === operation.operation);
    if (!budget) return false;

    return operation.observations.filter(isEligibleObservation).every((observation) =>
      observation.rowCount <= budget.maxRows &&
      observation.responseBytes <= budget.maxResponseBytes &&
      observation.requestElapsedMs <= budget.requestTimeoutMs &&
      observation.parseElapsedMs <= budget.parseTimeoutMs &&
      observation.totalComponentElapsedMs <= budget.totalComponentTimeoutMs,
    );
  });
}

function operationEnvelopesReviewed(operationEvidence: readonly SanitizedOperationEvidence[]): boolean {
  return operationEntriesComplete(operationEvidence) && operationEvidence.every((entry) =>
    entry.successStatusClass === "2xx" &&
    entry.contentType === "application/json" &&
    entry.topLevelShape !== "unknown" &&
    entry.emptyResultShape !== "unknown" &&
    entry.failureStatusClasses.length > 0 &&
    entry.failureStatusClasses.every((status) => status !== "unknown") &&
    entry.safeFailureCategories.length > 0,
  );
}

function observationsCoverMinimum(operationEvidence: readonly SanitizedOperationEvidence[]): boolean {
  return operationEntriesComplete(operationEvidence) && operationEvidence.every((entry) =>
    new Set(entry.observations.filter(isEligibleObservation).map((observation) => observation.observationDate)).size >= 3,
  );
}

function transportSecurityReady(evidence: ConnectorReadinessEvidence): boolean {
  if (evidence.authCategory === "unknown" || evidence.transport === "unknown" || evidence.tlsVerification === "unknown") {
    return false;
  }

  if (evidence.transport === "http") {
    return evidence.tlsVerification === "not-applicable" && evidence.securityAcceptanceRecorded;
  }

  if (evidence.transport === "https") {
    if (evidence.tlsVerification === "verified") {
      return evidence.authCategory !== "none" && evidence.authCategory !== "custom" || evidence.securityAcceptanceRecorded;
    }
    if (evidence.tlsVerification === "unverified") {
      return evidence.securityAcceptanceRecorded;
    }
    return false;
  }

  return false;
}

function contextIsValid(value: unknown): value is ConnectorReadinessEvaluationContext {
  const errors: string[] = [];
  if (!hasExactKeys(
    value,
    ["evaluatedAt", "nextRetryBoundaryMs", "approvedOwnerRoleAliases"],
    "evaluationContext",
    errors,
  ) || errors.length > 0) {
    return false;
  }
  if (!isIsoDate(value.evaluatedAt) || !isSafePositiveInteger(value.nextRetryBoundaryMs)) {
    return false;
  }
  if (!isArray(value.approvedOwnerRoleAliases) || value.approvedOwnerRoleAliases.length === 0) {
    return false;
  }

  const aliases = value.approvedOwnerRoleAliases;
  const normalizedAliases = aliases.map((alias) => typeof alias === "string" ? alias.toLowerCase() : "");
  return (
    aliases.every((alias) => isSafeRoleAlias(alias)) &&
    new Set(normalizedAliases).size === aliases.length
  );
}

function differenceInCalendarDays(earlier: string, later: string): number {
  const difference = (Date.parse(`${later}T00:00:00.000Z`) - Date.parse(`${earlier}T00:00:00.000Z`)) / DAY_MS;
  return Number.isSafeInteger(difference) ? difference : 0;
}

/**
 * Validate the exact public evidence shape.  Readiness completeness (minimum
 * observations, freshness, and retry-boundary comparison) is evaluated by
 * {@link evaluateConnectorReadiness}, because those checks need an explicit
 * evaluation context and must not be smuggled into the evidence schema.
 */
export function validateConnectorReadinessEvidence(input: unknown): ConnectorReadinessValidationResult {
  const errors: string[] = [];

  try {
    if (!hasExactKeys(input, evidenceKeys, "evidence", errors)) {
      return { valid: false, errors };
    }

    if (input.schemaVersion !== 1) errors.push("evidence.schemaVersion:unsupported");
    if (input.dataClass !== "sanitized-metadata") errors.push("evidence.dataClass:unsupported");
    if (input.networkScope !== "company-private") errors.push("evidence.networkScope:unsupported");
    pushEnumError(input, "authCategory", authCategories, "evidence", errors);
    pushEnumError(input, "transport", transportCategories, "evidence", errors);
    pushEnumError(input, "tlsVerification", tlsVerifications, "evidence", errors);
    if (typeof input.securityAcceptanceRecorded !== "boolean") {
      errors.push("evidence.securityAcceptanceRecorded:boolean_required");
    }
    pushEnumError(input, "rateLimitKnowledge", rateLimitKnowledgeValues, "evidence", errors);
    if (typeof input.privacyReviewPassed !== "boolean") {
      errors.push("evidence.privacyReviewPassed:boolean_required");
    }

    if (!isArray(input.operationEvidence)) {
      errors.push("evidence.operationEvidence:array_required");
    } else {
      if (input.operationEvidence.length !== sourceOperationAliases.length) {
        errors.push("evidence.operationEvidence:incomplete");
      }
      const seen = new Set<string>();
      input.operationEvidence.forEach((entry, index) => {
        const path = `evidence.operationEvidence[${index}]`;
        validateOperationEvidence(entry, path, errors);
        if (isRecord(entry) && isOneOf(entry.operation, sourceOperationAliases)) {
          if (seen.has(entry.operation)) errors.push(`${path}.operation:duplicate_value`);
          seen.add(entry.operation);
        }
      });
      if (input.operationEvidence.every((entry): entry is SanitizedOperationEvidence => isRecord(entry) && isOneOf(entry.operation, sourceOperationAliases))) {
        if (!operationEntriesComplete(input.operationEvidence)) errors.push("evidence.operationEvidence:missing_operation");
      }
    }

    if (!isArray(input.neutralFieldClassifications)) {
      errors.push("evidence.neutralFieldClassifications:array_required");
    } else {
      const expectedCount = sourceOperationAliases.reduce(
        (count, operation) => count + (expectedNeutralFields.get(operation)?.length ?? 0),
        0,
      );
      if (input.neutralFieldClassifications.length !== expectedCount) {
        errors.push("evidence.neutralFieldClassifications:incomplete");
      }
      const seen = new Set<string>();
      input.neutralFieldClassifications.forEach((entry, index) => {
        const path = `evidence.neutralFieldClassifications[${index}]`;
        validateNeutralFieldClassification(entry, path, errors);
        if (isRecord(entry) && isOneOf(entry.operation, sourceOperationAliases) && typeof entry.fieldAlias === "string") {
          const key = `${entry.operation}:${entry.fieldAlias}`;
          if (seen.has(key)) errors.push(`${path}:duplicate_pair`);
          seen.add(key);
        }
      });
      if (input.neutralFieldClassifications.every((entry): entry is NeutralFieldClassification => isRecord(entry) && isOneOf(entry.operation, sourceOperationAliases) && typeof entry.fieldAlias === "string")) {
        if (!fieldEntriesComplete(input.neutralFieldClassifications)) errors.push("evidence.neutralFieldClassifications:missing_pair");
      }
    }

    if (!isArray(input.runtimeBudgets)) {
      errors.push("evidence.runtimeBudgets:array_required");
    } else {
      if (input.runtimeBudgets.length !== sourceOperationAliases.length) {
        errors.push("evidence.runtimeBudgets:incomplete");
      }
      const seen = new Set<string>();
      input.runtimeBudgets.forEach((entry, index) => {
        const path = `evidence.runtimeBudgets[${index}]`;
        validateRuntimeBudget(entry, path, errors);
        if (isRecord(entry) && isOneOf(entry.operation, sourceOperationAliases)) {
          if (seen.has(entry.operation)) errors.push(`${path}.operation:duplicate_value`);
          seen.add(entry.operation);
        }
      });
      if (input.runtimeBudgets.every((entry): entry is OperationRuntimeBudget => isRecord(entry) && isOneOf(entry.operation, sourceOperationAliases))) {
        if (!budgetEntriesComplete(input.runtimeBudgets)) errors.push("evidence.runtimeBudgets:missing_operation");
      }
    }

    validateOwnership(input.ownership, `${EVIDENCE_PATH}.ownership`, errors);

    if (!isIsoDate(input.evidenceCollectedThrough)) {
      errors.push("evidence.evidenceCollectedThrough:invalid_date");
    }
    if (!isIsoDate(input.reviewedAt)) {
      errors.push("evidence.reviewedAt:invalid_date");
    }

    if (isArray(input.operationEvidence) && input.operationEvidence.every((entry): entry is SanitizedOperationEvidence => isRecord(entry) && isOneOf(entry.operation, sourceOperationAliases) && isArray(entry.observations))) {
      const expectedCollectedThrough = expectedEvidenceCollectedThrough(input.operationEvidence);
      if (expectedCollectedThrough !== null && input.evidenceCollectedThrough !== expectedCollectedThrough) {
        errors.push("evidence.evidenceCollectedThrough:mismatch");
      }
    }
    if (isIsoDate(input.evidenceCollectedThrough) && isIsoDate(input.reviewedAt) && !isBeforeOrEqual(input.evidenceCollectedThrough, input.reviewedAt)) {
      errors.push("evidence:date_ordering");
    }
    if (isIsoDate(input.reviewedAt) && isArray(input.operationEvidence)) {
      const reviewedAt = input.reviewedAt;
      input.operationEvidence.forEach((entry, operationIndex) => {
        if (!isRecord(entry) || !isArray(entry.observations)) return;
        entry.observations.forEach((observation, observationIndex) => {
          if (!isRecord(observation) || !isIsoDate(observation.observationDate)) return;
          if (!isBeforeOrEqual(observation.observationDate, reviewedAt)) {
            errors.push(
              `evidence.operationEvidence[${operationIndex}].observations[${observationIndex}].observationDate:after_review`,
            );
          }
        });
      });
    }

    if (isOneOf(input.transport, transportCategories) && isOneOf(input.tlsVerification, tlsVerifications)) {
      const contradictory =
        (input.transport === "http" && input.tlsVerification !== "not-applicable") ||
        (input.transport === "https" && !["verified", "unverified"].includes(input.tlsVerification)) ||
        (input.transport === "unknown" && input.tlsVerification !== "unknown");
      if (contradictory) errors.push("evidence:contradictory_transport_tls");
    }
  } catch {
    errors.push("evidence:unreadable");
  }

  return { valid: errors.length === 0, errors };
}

/** Throwing companion for callers that want a type guard at a boundary. */
export function assertConnectorReadinessEvidence(input: unknown): asserts input is ConnectorReadinessEvidence {
  const result = validateConnectorReadinessEvidence(input);
  if (!result.valid) {
    throw new TypeError("Invalid connector readiness evidence: " + result.errors.join(","));
  }
}

export function isConnectorReadinessEvidence(input: unknown): input is ConnectorReadinessEvidence {
  return validateConnectorReadinessEvidence(input).valid;
}

/**
 * Derive deterministic, fail-closed readiness.  The retry boundary is an
 * explicit caller-owned input because the approved evidence schema contains
 * no retry schedule value.  Omitting or invalidating it can never produce a
 * ready state.
 */
export function evaluateConnectorReadiness(
  input: unknown,
  context: unknown,
): ConnectorReadinessSummary {
  const validation = validateConnectorReadinessEvidence(input);
  const evidence = validation.valid ? (input as ConnectorReadinessEvidence) : null;
  const validContext = contextIsValid(context);
  const contextRecord = isRecord(context) ? context : null;
  const evaluatedAt = validContext ? context.evaluatedAt : isIsoDate(contextRecord?.evaluatedAt) ? contextRecord.evaluatedAt : "";
  const evidenceCollectedThrough = evidence?.evidenceCollectedThrough ?? (isRecord(input) && isIsoDate(input.evidenceCollectedThrough) ? input.evidenceCollectedThrough : "");
  const reviewedAt = evidence?.reviewedAt ?? (isRecord(input) && isIsoDate(input.reviewedAt) ? input.reviewedAt : "");
  const age = evidenceCollectedThrough !== "" && evaluatedAt !== ""
    ? differenceInCalendarDays(evidenceCollectedThrough, evaluatedAt)
    : 0;
  const evidenceAgeDays = Math.max(0, age);

  const operationEvidence = evidence?.operationEvidence ?? [];
  const neutralFields = evidence?.neutralFieldClassifications ?? [];
  const budgets = evidence?.runtimeBudgets ?? [];
  const operationEnvelopeGate = evidence !== null && operationEnvelopesReviewed(operationEvidence);
  const observationGate = evidence !== null && observationsCoverMinimum(operationEvidence);
  const budgetGate = evidence !== null && observationGate && budgetEntriesComplete(budgets) &&
    budgetsCoverEligibleObservations(operationEvidence, budgets) && budgets.every((budget) =>
    isSafePositiveInteger(budget.maxRows) &&
    isSafePositiveInteger(budget.maxResponseBytes) &&
    isSafePositiveInteger(budget.requestTimeoutMs) &&
    isSafePositiveInteger(budget.parseTimeoutMs) &&
    isSafePositiveInteger(budget.totalComponentTimeoutMs),
  );
  const retryBoundaryGate =
    validContext &&
    budgetGate &&
    budgets.every((budget) => budget.totalComponentTimeoutMs < context.nextRetryBoundaryMs);
  const transportGate = evidence !== null && transportSecurityReady(evidence);
  const ownershipGate = evidence !== null && validContext &&
    isSafeRoleAlias(evidence.ownership.storeMappingOwnerRole) &&
    isSafeRoleAlias(evidence.ownership.allowlistOwnerRole) &&
    isSafeRoleAlias(evidence.ownership.alertOwnerRole) &&
    evidence.ownership.alertChannelCategory !== "unknown" &&
    [
      evidence.ownership.storeMappingOwnerRole,
      evidence.ownership.allowlistOwnerRole,
      evidence.ownership.alertOwnerRole,
    ].every((role) => context.approvedOwnerRoleAliases.includes(role));
  const expectedCollectedThrough = evidence === null ? null : expectedEvidenceCollectedThrough(operationEvidence);
  const freshnessGate = evidence !== null && validContext && expectedCollectedThrough !== null &&
    evidence.evidenceCollectedThrough === expectedCollectedThrough &&
    evidenceAgeDays <= MAX_EVIDENCE_AGE_DAYS &&
    age >= 0;
  const dateOrderingGate = evidence !== null && validContext &&
    isBeforeOrEqual(evidence.evidenceCollectedThrough, evidence.reviewedAt) &&
    isBeforeOrEqual(evidence.reviewedAt, context.evaluatedAt);

  const gateResults: Record<(typeof connectorReadinessGateNames)[number], boolean> = {
    evidence_structure: validation.valid,
    operation_completeness: validation.valid && operationEntriesComplete(operationEvidence),
    operation_envelope_review: operationEnvelopeGate,
    neutral_field_completeness: validation.valid && fieldEntriesComplete(neutralFields),
    observation_coverage: observationGate,
    runtime_budgets: budgetGate,
    retry_boundary: retryBoundaryGate,
    transport_security: transportGate,
    rate_limit_posture: evidence !== null && evidence.rateLimitKnowledge !== "unknown",
    ownership: ownershipGate,
    privacy_review: evidence !== null && evidence.privacyReviewPassed === true,
    evidence_freshness: freshnessGate,
    date_ordering: dateOrderingGate,
  };

  const completedGates = connectorReadinessGateNames.filter((gate) => gateResults[gate]);
  const missingGates = connectorReadinessGateNames.filter((gate) => !gateResults[gate]);

  return {
    state: missingGates.length === 0 ? "ready_for_connector_implementation" : "not_ready",
    evidenceCollectedThrough,
    reviewedAt,
    evaluatedAt,
    evidenceAgeDays,
    completedGates,
    missingGates,
  };
}
