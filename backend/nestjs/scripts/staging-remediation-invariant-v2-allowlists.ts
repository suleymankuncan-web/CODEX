// Trace: FR-DEC-08; NFR-02, NFR-03; AC-04, AC-05, AC-11; EC-01, EC-04, EC-05, EC-08.
export const invariantV2Families = ["ASSIGN-01", "ORG-02", "ORG-04", "TARGET-02"] as const;
export type InvariantV2Family = typeof invariantV2Families[number];

export const invariantV2Codes = [
  "assignment.exactly_one_open_primary",
  "assignment.lifecycle_region",
  "assignment.primary_ranges_non_overlapping",
  "norm.lifecycle_manager",
  "org.kpi_period_end_manager",
  "org.scope_hierarchy",
  "target.ordinary_count_matches_json",
  "target.pilot_count_matches_approved_references",
] as const;
export type InvariantV2Code = typeof invariantV2Codes[number];

export const invariantV2ReasonCodes = [
  "assignment.active_lifecycle_invalid",
  "assignment.active_region_store_mismatch",
  "assignment.employee_company_store_company",
  "assignment.open_primary_missing",
  "assignment.open_primary_multiple",
  "assignment.primary_same_day_handoff",
  "assignment.primary_strict_overlap",
  "assignment.position_company_store_company",
  "assignment.region_company_store_company",
  "kpi.period_end_manager_ambiguous",
  "kpi.period_end_manager_missing",
  "kpi.region_period_end_manager_mismatch",
  "norm.active_manager_ambiguous",
  "norm.active_manager_missing",
  "norm.active_region_manager_mismatch",
  "norm.future_manager_ambiguous",
  "norm.future_manager_missing",
  "norm.future_region_manager_mismatch",
  "org.bootstrap_resolved_company_batch_company",
  "org.scope_company_region",
  "org.scope_company_store",
  "org.scope_region_store",
  "target.ordinary_count_json_mismatch",
  "target.pilot_approved_reference_duplicate",
  "target.pilot_count_approved_reference_mismatch",
] as const;
export type InvariantV2ReasonCode = typeof invariantV2ReasonCodes[number];

export const invariantV2SourceTables = [
  "audit.event_log",
  "ops.employee_assignment_history",
  "ops.employee_offboarding_request",
  "ops.kpi_actual",
  "ops.kpi_target",
  "ops.personnel_target_reference",
  "ops.sales_target_incentive_adjustment",
  "ops.sales_target_incentive_projection",
  "ops.sales_target_incentive_region_correction",
  "ops.sales_target_incentive_region_package",
  "ops.sales_target_incentive_region_package_store",
  "ops.sales_target_incentive_store_review",
  "ops.seller_code_request",
  "ops.store_action_plan",
  "ops.target_distribution_request",
  "ops.turnover_event",
  "ops.user_action_store_assignment",
  "ops.user_role_assignment",
  "ops.workforce_norm_plan",
  "rpt.sales_target_incentive_assignment_snapshot",
  "rpt.sales_target_incentive_final_snapshot",
  "rpt.turnover_snapshot",
  "stg.master_data_bootstrap_row",
] as const;
export type InvariantV2SourceTable = typeof invariantV2SourceTables[number];

export function familyForInvariant(code: InvariantV2Code): InvariantV2Family {
  if (code.startsWith("target.")) return "TARGET-02";
  if (code.startsWith("org.") || code.startsWith("norm.")) return "ORG-04";
  if (code === "assignment.lifecycle_region") return "ORG-02";
  return "ASSIGN-01";
}

export function reasonBelongsToInvariant(code: InvariantV2Code, reason: InvariantV2ReasonCode) {
  switch (code) {
    case "assignment.exactly_one_open_primary":
      return reason === "assignment.open_primary_missing" || reason === "assignment.open_primary_multiple";
    case "assignment.lifecycle_region":
      return reason === "assignment.active_lifecycle_invalid"
        || reason === "assignment.active_region_store_mismatch"
        || reason === "assignment.employee_company_store_company"
        || reason === "assignment.position_company_store_company"
        || reason === "assignment.region_company_store_company";
    case "assignment.primary_ranges_non_overlapping":
      return reason === "assignment.primary_same_day_handoff" || reason === "assignment.primary_strict_overlap";
    case "norm.lifecycle_manager":
      return reason.startsWith("norm.")
        || reason === "org.scope_company_region"
        || reason === "org.scope_company_store";
    case "org.kpi_period_end_manager":
      return reason.startsWith("kpi.")
        || reason === "org.scope_company_region"
        || reason === "org.scope_company_store";
    case "org.scope_hierarchy":
      return reason.startsWith("org.");
    case "target.ordinary_count_matches_json":
      return reason === "target.ordinary_count_json_mismatch";
    case "target.pilot_count_matches_approved_references":
      return reason === "target.pilot_approved_reference_duplicate"
        || reason === "target.pilot_count_approved_reference_mismatch";
  }
}

export function sourceBelongsToInvariant(code: InvariantV2Code, source: InvariantV2SourceTable) {
  switch (code) {
    case "assignment.exactly_one_open_primary":
    case "assignment.lifecycle_region":
    case "assignment.primary_ranges_non_overlapping":
      return source === "ops.employee_assignment_history";
    case "norm.lifecycle_manager":
      return source === "ops.workforce_norm_plan";
    case "org.kpi_period_end_manager":
      return source === "ops.kpi_actual";
    case "org.scope_hierarchy":
      return source !== "ops.user_action_store_assignment" && source !== "ops.user_role_assignment";
    case "target.ordinary_count_matches_json":
      return source === "ops.target_distribution_request";
    case "target.pilot_count_matches_approved_references":
      return source === "ops.personnel_target_reference";
  }
}
