// Trace: FR-03, FR-06..10; NFR-01, NFR-05; AC-01, AC-03..05; EC-01, EC-08.
export const reconciliationFamilies = ["TARGET-02", "ORG-02", "ORG-04", "ASSIGN-01"] as const;
export type ReconciliationFamily = typeof reconciliationFamilies[number];

export const terminalStates = [
  "eligible_zero",
  "preserved_excluded",
  "blocked",
  "not_applicable",
] as const;
export type TerminalState = typeof terminalStates[number];

export const constraintEligibilities = ["eligible_after_rem8", "excluded", "blocked"] as const;
export type ConstraintEligibility = typeof constraintEligibilities[number];

export const nextGates = ["rem_8", "authoritative_row_evidence", "none"] as const;
export type NextGate = typeof nextGates[number];

export const reconciliationReasons = [
  "target_zero_locked_preserve_application_enforced",
  "target_prerequisite_missing",
  "authoritative_row_evidence_absent",
] as const;
export type ReconciliationReason = typeof reconciliationReasons[number];

export const decisionRefs = {
  "ASSIGN-01": [
    "D-ASSIGN-DATES=inclusive_end_next_primary_start_following_day",
    "D-ASSIGN-WINNER=approved_effective_dated_rotation_lifecycle_source",
  ],
  "ORG-02": [
    "D-ORG-AUTHORITY/ORG-02=store_master_active_assignment_history_closed",
    "D-ASSIGN-WINNER=approved_effective_dated_rotation_lifecycle_source",
  ],
  "ORG-04": [
    "D-ORG-HISTORY/ORG-04=kpi_period_end_manager_canonical",
    "D-ORG-HISTORY/ORG-04=supersede_active_future_preserve_closed",
  ],
  "TARGET-02": [
    "D-INVARIANT-DEFINITION/TARGET-02=valid_under_revised_semantics",
    "D-TARGET-COUNT/TARGET-02=preserve",
    "D-TARGET-DUPLICATE=reject_app_and_db",
  ],
} as const satisfies Record<ReconciliationFamily, readonly string[]>;

export const invariantV1Checks = [
  ["ASSIGN-01", "assignment"],
  ["AUTH-01", "authorization"],
  ["AUTH-02", "authorization"],
  ["KEY-01", "candidate_key"],
  ["ORG-01", "organization"],
  ["ORG-02", "organization"],
  ["ORG-03", "organization"],
  ["ORG-04", "organization"],
  ["TARGET-01", "target"],
  ["TARGET-02", "target"],
  ["TARGET-03", "target"],
] as const;
