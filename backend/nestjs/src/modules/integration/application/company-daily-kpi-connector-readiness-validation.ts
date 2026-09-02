import {
  EVIDENCE_PATH,
  DAY_MS,
  alertChannelCategories,
  authCategories,
  evidenceKeys,
  expectedNeutralFields,
  failureStatusClasses,
  hasExactKeys,
  isArray,
  isBeforeOrEqual,
  isIsoDate,
  isOneOf,
  isRecord,
  isSafeNonNegativeInteger,
  isSafePositiveInteger,
  isSafeRoleAlias,
  neutralFieldClassificationKeys,
  neutralFieldPresences,
  neutralFieldTypes,
  observationKeys,
  operationEvidenceKeys,
  ownershipKeys,
  pushEnumError,
  rateLimitKnowledgeValues,
  runtimeBudgetKeys,
  safeReasonCodes,
  sourceOperationAliases,
  transportCategories,
  tlsVerifications,
} from "./company-daily-kpi-connector-readiness-contract";
import type {
  ConnectorReadinessEvaluationContext,
  ConnectorReadinessEvidence,
  ConnectorReadinessValidationResult,
  NeutralFieldClassification,
  OperationRuntimeBudget,
  SanitizedOperationEvidence,
  SanitizedOperationObservation,
  SanitizedOwnershipEvidence,
  SourceOperationAlias,
} from "./company-daily-kpi-connector-readiness-contract";

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

export function isEligibleObservation(value: SanitizedOperationObservation): boolean {
  return value.statusClass === "2xx" && (value.parseOutcome === "accepted" || value.parseOutcome === "empty");
}

export function latestEligibleObservationDate(evidence: SanitizedOperationEvidence): string | null {
  const dates = evidence.observations
    .filter(isEligibleObservation)
    .map((observation) => observation.observationDate)
    .filter(isIsoDate);
  return dates.length === 0 ? null : [...dates].sort().at(-1) ?? null;
}

export function expectedEvidenceCollectedThrough(
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

export function operationEntriesComplete(operationEvidence: readonly SanitizedOperationEvidence[]): boolean {
  return (
    operationEvidence.length === sourceOperationAliases.length &&
    new Set(operationEvidence.map((entry) => entry.operation)).size === sourceOperationAliases.length &&
    sourceOperationAliases.every((operation) => operationEvidence.some((entry) => entry.operation === operation))
  );
}

export function fieldEntriesComplete(classifications: readonly NeutralFieldClassification[]): boolean {
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

export function budgetEntriesComplete(budgets: readonly OperationRuntimeBudget[]): boolean {
  return (
    budgets.length === sourceOperationAliases.length &&
    new Set(budgets.map((budget) => budget.operation)).size === sourceOperationAliases.length &&
    sourceOperationAliases.every((operation) => budgets.some((budget) => budget.operation === operation))
  );
}

export function budgetsCoverEligibleObservations(
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

export function operationEnvelopesReviewed(operationEvidence: readonly SanitizedOperationEvidence[]): boolean {
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

export function observationsCoverMinimum(operationEvidence: readonly SanitizedOperationEvidence[]): boolean {
  return operationEntriesComplete(operationEvidence) && operationEvidence.every((entry) =>
    new Set(entry.observations.filter(isEligibleObservation).map((observation) => observation.observationDate)).size >= 3,
  );
}

export function transportSecurityReady(evidence: ConnectorReadinessEvidence): boolean {
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

export function contextIsValid(value: unknown): value is ConnectorReadinessEvaluationContext {
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

export function differenceInCalendarDays(earlier: string, later: string): number {
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
