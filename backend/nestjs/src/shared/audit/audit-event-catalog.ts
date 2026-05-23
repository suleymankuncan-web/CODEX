export type AuditStreamReadiness = "feature_audit" | "global_feed_candidate";

export type AuditEventCatalogEntry = {
  eventType: string;
  entityName: string;
  ownerModule: string;
  auditStreamReadiness: AuditStreamReadiness;
  description: string;
};

export const AUDIT_EVENT_CATALOG = [
  auditEvent("user_role_assignment.created", "ops.user_role_assignment", "auth", "User role assignment was granted."),
  auditEvent("user_role_assignment.deactivated", "ops.user_role_assignment", "auth", "User role assignment was deactivated."),
  auditEvent(
    "user_action_store_assignment.created",
    "ops.user_action_store_assignment",
    "auth",
    "User store action assignment was granted.",
  ),
  auditEvent(
    "user_action_store_assignment.deactivated",
    "ops.user_action_store_assignment",
    "auth",
    "User store action assignment was deactivated.",
  ),
  auditEvent("user_account.created", "ops.user_account", "auth", "User account was created."),
  auditEvent("user_account.deactivated", "ops.user_account", "auth", "User account was deactivated."),
  auditEvent("user_account.reactivated", "ops.user_account", "auth", "User account was reactivated."),
  auditEvent(
    "pilot_user_binding.created",
    "ops.user_account",
    "auth",
    "Pilot user account, role, and store scope binding was created.",
  ),
  auditEvent("role_permission.granted", "ops.role", "auth", "Role permission was granted."),
  auditEvent("role_permission.revoked", "ops.role", "auth", "Role permission was revoked."),
  auditEvent(
    "mobile_device_session.created",
    "ops.mobile_device_session",
    "auth",
    "Mobile app device session was registered.",
  ),
  auditEvent(
    "mobile_device_session.revoked",
    "ops.mobile_device_session",
    "auth",
    "Mobile app device session was revoked.",
  ),

  auditEvent("import_batch.created", "stg.import_batch", "integration", "Import batch was created."),
  auditEvent("import_batch.started", "stg.import_batch", "integration", "Import batch materialization started."),
  auditEvent("import_batch.retried", "stg.import_batch", "integration", "Import batch retry was requested."),
  auditEvent(
    "external_id_mapping.approved",
    "stg.external_id_map",
    "integration",
    "External source identity mapping was approved.",
  ),
  auditEvent(
    "store_master_data.updated",
    "ops.store",
    "integration",
    "Store master data was updated.",
  ),
  auditEvent(
    "personnel_master_data.updated",
    "ops.employee",
    "integration",
    "Personnel master data and active assignment were updated.",
  ),
  auditEvent("integration_source.created", "stg.integration_source", "integration", "Integration source was created."),
  auditEvent(
    "integration_source.deactivated",
    "stg.integration_source",
    "integration",
    "Integration source was deactivated.",
  ),
  auditEvent(
    "integration_source.reactivated",
    "stg.integration_source",
    "integration",
    "Integration source was reactivated.",
  ),
  auditEvent(
    "integration_source.schedule_updated",
    "stg.integration_source",
    "integration",
    "Integration source schedule was updated.",
  ),

  auditEvent("checklist_instance.created", "ops.checklist_instance", "store_ops", "Checklist instance was created."),
  auditEvent(
    "checklist_instance.completed",
    "ops.checklist_instance",
    "store_ops",
    "Checklist instance was completed.",
  ),
  auditEvent(
    "checklist_instance.acknowledged",
    "ops.checklist_instance",
    "store_ops",
    "Checklist instance was acknowledged.",
  ),
  auditEvent("checklist_response.upserted", "ops.checklist_response", "store_ops", "Checklist response was upserted."),
  auditEvent(
    "target_distribution_request.created",
    "ops.target_distribution_request",
    "store_ops",
    "Target distribution request was created.",
  ),
  auditEvent(
    "target_distribution_request.approved",
    "ops.target_distribution_request",
    "store_ops",
    "Target distribution request was approved.",
  ),
  auditEvent(
    "seller_code_request.created",
    "ops.seller_code_request",
    "store_ops",
    "Seller code request was submitted.",
  ),
  auditEvent(
    "seller_code_request.approved",
    "ops.seller_code_request",
    "store_ops",
    "Seller code request was approved.",
  ),
  auditEvent(
    "seller_code_request.rejected",
    "ops.seller_code_request",
    "store_ops",
    "Seller code request was returned to the store.",
  ),
  auditEvent(
    "seller_code_request.resubmitted",
    "ops.seller_code_request",
    "store_ops",
    "Seller code request was edited and resubmitted.",
  ),
  auditEvent(
    "employee_offboarding_request.created",
    "ops.employee_offboarding_request",
    "store_ops",
    "Employee offboarding request was submitted.",
  ),
  auditEvent(
    "employee_offboarding_request.approved",
    "ops.employee_offboarding_request",
    "store_ops",
    "Employee offboarding request was approved.",
  ),
  auditEvent(
    "employee_offboarding_request.rejected",
    "ops.employee_offboarding_request",
    "store_ops",
    "Employee offboarding request was returned to the store.",
  ),
  auditEvent(
    "employee_offboarding_request.resubmitted",
    "ops.employee_offboarding_request",
    "store_ops",
    "Employee offboarding request was edited and resubmitted.",
  ),
  auditEvent(
    "store_action_plan.created",
    "ops.store_action_plan",
    "store_ops",
    "Store action plan was created.",
    "feature_audit",
  ),
  auditEvent(
    "store_action_plan.status_updated",
    "ops.store_action_plan",
    "store_ops",
    "Store action plan status was updated.",
    "feature_audit",
  ),
  auditEvent(
    "store_action_plan.closed",
    "ops.store_action_plan",
    "store_ops",
    "Store action plan was closed with resolution evidence.",
    "feature_audit",
  ),
  auditEvent(
    "store_action_plan.cancelled",
    "ops.store_action_plan",
    "store_ops",
    "Store action plan was cancelled.",
    "feature_audit",
  ),
  auditEvent(
    "pilot_feedback.created",
    "ops.pilot_feedback",
    "store_ops",
    "Controlled pilot feedback was recorded.",
    "feature_audit",
  ),
  auditEvent(
    "pilot_feedback.classified",
    "ops.pilot_feedback",
    "store_ops",
    "Controlled pilot feedback was classified for pilot readiness triage.",
    "feature_audit",
  ),

  auditEvent("competition.created", "ops.competition", "competition", "Competition was created."),
  auditEvent("competition_stage.created", "ops.competition_stage", "competition", "Competition stage was created."),
  auditEvent(
    "competition_stage.recalculated",
    "ops.competition_stage",
    "competition",
    "Competition stage was recalculated.",
  ),
  auditEvent("competition_stage.finalized", "ops.competition_stage", "competition", "Competition stage was finalized."),
  auditEvent(
    "competition_stage_package.created",
    "ops.competition",
    "competition",
    "Competition stage package was created.",
  ),
  auditEvent(
    "competition_team_template.created",
    "ops.competition_team_template",
    "competition",
    "Competition team template was created.",
  ),
  auditEvent(
    "competition_team_template.updated",
    "ops.competition_team_template",
    "competition",
    "Competition team template was updated.",
  ),
  auditEvent(
    "competition_team_template.deactivated",
    "ops.competition_team_template",
    "competition",
    "Competition team template was deactivated.",
  ),
  auditEvent(
    "competition_team_template.cloned",
    "ops.competition_team_template",
    "competition",
    "Competition team template was cloned.",
  ),
  auditEvent(
    "competition_stage_package_plan.saved",
    "ops.competition_stage_package_plan",
    "competition",
    "Competition package plan draft was saved.",
  ),
  auditEvent(
    "competition_stage_package_plan.updated",
    "ops.competition_stage_package_plan",
    "competition",
    "Competition package plan draft was updated.",
  ),
  auditEvent(
    "competition_stage_package_plan.submitted",
    "ops.competition_stage_package_plan",
    "competition",
    "Competition package plan was submitted.",
  ),
  auditEvent(
    "competition_stage_package_plan.approved",
    "ops.competition_stage_package_plan",
    "competition",
    "Competition package plan was approved.",
  ),
  auditEvent(
    "competition_stage_package_plan.rejected",
    "ops.competition_stage_package_plan",
    "competition",
    "Competition package plan was returned.",
  ),
  auditEvent(
    "competition_stage_package_plan.cloned_to_draft",
    "ops.competition_stage_package_plan",
    "competition",
    "Returned competition package plan was cloned from source.",
  ),
  auditEvent(
    "competition_stage_package_plan.cloned_from_returned",
    "ops.competition_stage_package_plan",
    "competition",
    "New competition package plan draft was cloned from a returned plan.",
  ),
  auditEvent(
    "competition_stage_package_plan.executed",
    "ops.competition_stage_package_plan",
    "competition",
    "Competition package plan was executed.",
  ),
  auditEvent(
    "competition_stage_package_plan.cancelled",
    "ops.competition_stage_package_plan",
    "competition",
    "Competition package plan draft was cancelled.",
  ),

  auditEvent("feed_post.created", "ops.feed_post", "feed", "Feed post draft was created."),
  auditEvent("feed_post.updated", "ops.feed_post", "feed", "Feed post draft was updated."),
  auditEvent("feed_post.scope_changed", "ops.feed_post", "feed", "Feed post visibility scope was changed."),
  auditEvent("feed_post.published", "ops.feed_post", "feed", "Feed post was published."),
  auditEvent("feed_post.pinned", "ops.feed_post", "feed", "Feed post was pinned."),
  auditEvent("feed_post.unpinned", "ops.feed_post", "feed", "Feed post was unpinned."),
  auditEvent("feed_post.archived", "ops.feed_post", "feed", "Feed post was archived."),

  auditEvent("kpi_config.updated", "ops.kpi_score_profile_config", "kpi_config", "KPI config was updated."),
  auditEvent("kpi_config.draft_saved", "ops.kpi_score_profile_config", "kpi_config", "KPI config draft was saved."),
  auditEvent("kpi_config.published", "ops.kpi_score_profile_config", "kpi_config", "KPI config was published."),

  auditEvent("snapshot_run.created", "rpt.snapshot_run", "snapshot", "Snapshot run was created."),
  auditEvent("snapshot_run.rerun_requested", "rpt.snapshot_run", "snapshot", "Snapshot rerun was requested."),
  auditEvent("snapshot_run.started", "rpt.snapshot_run", "snapshot", "Snapshot run started."),
  auditEvent("snapshot_run.completed", "rpt.snapshot_run", "snapshot", "Snapshot run completed."),
  auditEvent("snapshot_run.failed", "rpt.snapshot_run", "snapshot", "Snapshot run failed."),
] as const satisfies readonly AuditEventCatalogEntry[];

export type AuditEventType = (typeof AUDIT_EVENT_CATALOG)[number]["eventType"];

export function getAuditEventCatalogEntry(eventType: string) {
  return AUDIT_EVENT_CATALOG.find((entry) => entry.eventType === eventType) ?? null;
}

function auditEvent(
  eventType: string,
  entityName: string,
  ownerModule: string,
  description: string,
  auditStreamReadiness: AuditStreamReadiness = "global_feed_candidate",
): AuditEventCatalogEntry {
  return {
    eventType,
    entityName,
    ownerModule,
    auditStreamReadiness,
    description,
  };
}
