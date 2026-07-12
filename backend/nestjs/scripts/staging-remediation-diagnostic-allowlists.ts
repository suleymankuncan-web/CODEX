// Trace: FR-DIAG-01..10; NFR-02, NFR-03; AC-01, AC-02; EC-04..08.
export const remediationFamilies = [
  "ASSIGN-01",
  "ORG-02",
  "ORG-04",
  "TARGET-02",
] as const;

export type RemediationFamily = typeof remediationFamilies[number];

export const diagnosticReasonCodes = [
  "assignment.cross_scope",
  "assignment.open_ended",
  "assignment.same_day_boundary",
  "assignment.same_scope",
  "assignment.strict_multi_day",
  "org.assignment_region_store_region",
  "org.bootstrap_resolved_company_batch_company",
  "org.employee_company_store_company",
  "org.position_company_store_company",
  "org.region_company_store_company",
  "org.scope_company_region",
  "org.scope_company_store",
  "org.scope_region_store",
  "target.count_greater_than_json_length",
  "target.count_less_than_json_length",
  "target.write_source_legacy_or_unknown",
] as const;

export type DiagnosticReasonCode = typeof diagnosticReasonCodes[number];

export const diagnosticSourceTables = [
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
  "ops.workforce_norm_plan",
  "rpt.sales_target_incentive_assignment_snapshot",
  "rpt.sales_target_incentive_final_snapshot",
  "rpt.turnover_snapshot",
  "stg.master_data_bootstrap_row",
] as const;

export type DiagnosticSourceTable = typeof diagnosticSourceTables[number];

export const sourceClasses = ["audit", "operational", "reporting", "staging"] as const;
export type DiagnosticSourceClass = typeof sourceClasses[number];

export const writePathCodes = [
  "assignment.integration_materialization",
  "assignment.master_data_bootstrap",
  "assignment.pilot_roster_import",
  "assignment.workforce_lifecycle",
  "target.approval",
  "target.pilot_roster_import",
  "target.request_create",
] as const;

export const downstreamCodes = [
  "assignment.headcount_turnover_targets_reports_incentives",
  "target.personnel_target_reference",
] as const;

export function sourceClassForTable(table: DiagnosticSourceTable): DiagnosticSourceClass {
  if (table.startsWith("rpt.")) return "reporting";
  if (table.startsWith("stg.")) return "staging";
  if (table.startsWith("audit.")) return "audit";
  return "operational";
}
