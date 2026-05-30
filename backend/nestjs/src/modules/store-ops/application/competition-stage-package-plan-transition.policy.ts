import type { CompetitionStagePackagePlanStatus } from "./competition.contract";

export const COMPETITION_STAGE_PACKAGE_PLAN_STATUS = {
  draft: "draft",
  submitted: "submitted",
  approved: "approved",
  rejected: "rejected",
  executed: "executed",
  cancelled: "cancelled",
} as const satisfies Record<string, CompetitionStagePackagePlanStatus>;

export type CompetitionStagePackagePlanTransitionPolicy = {
  sourceStatus?: CompetitionStagePackagePlanStatus;
  targetStatus: CompetitionStagePackagePlanStatus;
  auditEventType: string;
  entityName: "ops.competition_stage_package_plan";
};

const entityName = "ops.competition_stage_package_plan";

export const COMPETITION_STAGE_PACKAGE_PLAN_TRANSITIONS = {
  saveDraft: {
    targetStatus: COMPETITION_STAGE_PACKAGE_PLAN_STATUS.draft,
    auditEventType: "competition_stage_package_plan.saved",
    entityName,
  },
  updateDraft: {
    sourceStatus: COMPETITION_STAGE_PACKAGE_PLAN_STATUS.draft,
    targetStatus: COMPETITION_STAGE_PACKAGE_PLAN_STATUS.draft,
    auditEventType: "competition_stage_package_plan.updated",
    entityName,
  },
  submit: {
    sourceStatus: COMPETITION_STAGE_PACKAGE_PLAN_STATUS.draft,
    targetStatus: COMPETITION_STAGE_PACKAGE_PLAN_STATUS.submitted,
    auditEventType: "competition_stage_package_plan.submitted",
    entityName,
  },
  approve: {
    sourceStatus: COMPETITION_STAGE_PACKAGE_PLAN_STATUS.submitted,
    targetStatus: COMPETITION_STAGE_PACKAGE_PLAN_STATUS.approved,
    auditEventType: "competition_stage_package_plan.approved",
    entityName,
  },
  reject: {
    sourceStatus: COMPETITION_STAGE_PACKAGE_PLAN_STATUS.submitted,
    targetStatus: COMPETITION_STAGE_PACKAGE_PLAN_STATUS.rejected,
    auditEventType: "competition_stage_package_plan.rejected",
    entityName,
  },
  cloneSourceToDraft: {
    sourceStatus: COMPETITION_STAGE_PACKAGE_PLAN_STATUS.rejected,
    targetStatus: COMPETITION_STAGE_PACKAGE_PLAN_STATUS.draft,
    auditEventType: "competition_stage_package_plan.cloned_to_draft",
    entityName,
  },
  cloneDraftFromReturned: {
    targetStatus: COMPETITION_STAGE_PACKAGE_PLAN_STATUS.draft,
    auditEventType: "competition_stage_package_plan.cloned_from_returned",
    entityName,
  },
  execute: {
    sourceStatus: COMPETITION_STAGE_PACKAGE_PLAN_STATUS.approved,
    targetStatus: COMPETITION_STAGE_PACKAGE_PLAN_STATUS.executed,
    auditEventType: "competition_stage_package_plan.executed",
    entityName,
  },
  cancel: {
    sourceStatus: COMPETITION_STAGE_PACKAGE_PLAN_STATUS.draft,
    targetStatus: COMPETITION_STAGE_PACKAGE_PLAN_STATUS.cancelled,
    auditEventType: "competition_stage_package_plan.cancelled",
    entityName,
  },
} as const satisfies Record<
  string,
  CompetitionStagePackagePlanTransitionPolicy
>;

export function canApplyCompetitionStagePackagePlanTransition(
  currentStatus: string,
  transition: CompetitionStagePackagePlanTransitionPolicy,
) {
  return !transition.sourceStatus || currentStatus === transition.sourceStatus;
}
