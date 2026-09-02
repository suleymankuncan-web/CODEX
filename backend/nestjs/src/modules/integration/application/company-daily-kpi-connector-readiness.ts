/**
 * Public, provider-neutral evidence for the company daily KPI connector.
 *
 * This facade intentionally has no I/O.  It validates only sanitized metadata
 * and derives a closed readiness summary.  A ready summary permits a
 * separately reviewed implementation proposal; it never means that a
 * connector, scheduler, credential, or source is active.
 */

import {
  MAX_EVIDENCE_AGE_DAYS,
  connectorReadinessGateNames,
  isBeforeOrEqual,
  isIsoDate,
  isRecord,
  isSafePositiveInteger,
  isSafeRoleAlias,
} from "./company-daily-kpi-connector-readiness-contract";
import {
  budgetEntriesComplete,
  budgetsCoverEligibleObservations,
  contextIsValid,
  differenceInCalendarDays,
  expectedEvidenceCollectedThrough,
  fieldEntriesComplete,
  observationsCoverMinimum,
  operationEntriesComplete,
  operationEnvelopesReviewed,
  transportSecurityReady,
  validateConnectorReadinessEvidence as validateEvidence,
} from "./company-daily-kpi-connector-readiness-validation";
import type {
  ConnectorReadinessEvidence,
  ConnectorReadinessSummary,
} from "./company-daily-kpi-connector-readiness-contract";

export {
  alertChannelCategories,
  authCategories,
  connectorReadinessGateNames,
  failureStatusClasses,
  footfallNeutralFieldAliases,
  gsmNeutralFieldAliases,
  neutralFieldPresences,
  neutralFieldTypes,
  rateLimitKnowledgeValues,
  safeReasonCodes,
  salesNeutralFieldAliases,
  sourceOperationAliases,
  storeDirectoryNeutralFieldAliases,
  tlsVerifications,
  transportCategories,
} from "./company-daily-kpi-connector-readiness-contract";
export type {
  AlertChannelCategory,
  AuthCategory,
  ConnectorReadinessEvaluationContext,
  ConnectorReadinessEvidence,
  ConnectorReadinessSummary,
  ConnectorReadinessValidationResult,
  FailureStatusClass,
  FootfallNeutralFieldAlias,
  GsmNeutralFieldAlias,
  NeutralFieldClassification,
  NeutralFieldPresence,
  NeutralFieldRule,
  NeutralFieldType,
  OperationRuntimeBudget,
  RateLimitKnowledge,
  ReadinessState,
  SafeReasonCode,
  SalesNeutralFieldAlias,
  SanitizedOperationEvidence,
  SanitizedOperationObservation,
  SanitizedOwnershipEvidence,
  SourceOperationAlias,
  StoreDirectoryNeutralFieldAlias,
  TlsVerification,
  TransportCategory,
} from "./company-daily-kpi-connector-readiness-contract";
export { validateConnectorReadinessEvidence } from "./company-daily-kpi-connector-readiness-validation";

/** Throwing companion for callers that want a type guard at a boundary. */
export function assertConnectorReadinessEvidence(input: unknown): asserts input is ConnectorReadinessEvidence {
  const result = validateEvidence(input);
  if (!result.valid) {
    throw new TypeError("Invalid connector readiness evidence: " + result.errors.join(","));
  }
}

export function isConnectorReadinessEvidence(input: unknown): input is ConnectorReadinessEvidence {
  return validateEvidence(input).valid;
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
  const validation = validateEvidence(input);
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
