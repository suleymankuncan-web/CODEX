import {
  COMPETITION_STAGE_PACKAGE_PLAN_STATUS,
  COMPETITION_STAGE_PACKAGE_PLAN_TRANSITIONS,
  canApplyCompetitionStagePackagePlanTransition,
} from "./competition-stage-package-plan-transition.policy";

describe("competition stage package plan transition policy", () => {
  it("keeps draft, review, execution, cancellation, and clone transitions explicit", () => {
    expect(COMPETITION_STAGE_PACKAGE_PLAN_TRANSITIONS).toMatchObject({
      saveDraft: {
        targetStatus: "draft",
        auditEventType: "competition_stage_package_plan.saved",
        entityName: "ops.competition_stage_package_plan",
      },
      updateDraft: {
        sourceStatus: "draft",
        targetStatus: "draft",
        auditEventType: "competition_stage_package_plan.updated",
        entityName: "ops.competition_stage_package_plan",
      },
      submit: {
        sourceStatus: "draft",
        targetStatus: "submitted",
        auditEventType: "competition_stage_package_plan.submitted",
        entityName: "ops.competition_stage_package_plan",
      },
      approve: {
        sourceStatus: "submitted",
        targetStatus: "approved",
        auditEventType: "competition_stage_package_plan.approved",
        entityName: "ops.competition_stage_package_plan",
      },
      reject: {
        sourceStatus: "submitted",
        targetStatus: "rejected",
        auditEventType: "competition_stage_package_plan.rejected",
        entityName: "ops.competition_stage_package_plan",
      },
      cloneSourceToDraft: {
        sourceStatus: "rejected",
        targetStatus: "draft",
        auditEventType: "competition_stage_package_plan.cloned_to_draft",
        entityName: "ops.competition_stage_package_plan",
      },
      cloneDraftFromReturned: {
        targetStatus: "draft",
        auditEventType: "competition_stage_package_plan.cloned_from_returned",
        entityName: "ops.competition_stage_package_plan",
      },
      execute: {
        sourceStatus: "approved",
        targetStatus: "executed",
        auditEventType: "competition_stage_package_plan.executed",
        entityName: "ops.competition_stage_package_plan",
      },
      cancel: {
        sourceStatus: "draft",
        targetStatus: "cancelled",
        auditEventType: "competition_stage_package_plan.cancelled",
        entityName: "ops.competition_stage_package_plan",
      },
    });
  });

  it("checks source status without changing repository exception semantics", () => {
    expect(
      canApplyCompetitionStagePackagePlanTransition(
        COMPETITION_STAGE_PACKAGE_PLAN_STATUS.draft,
        COMPETITION_STAGE_PACKAGE_PLAN_TRANSITIONS.submit,
      ),
    ).toBe(true);
    expect(
      canApplyCompetitionStagePackagePlanTransition(
        COMPETITION_STAGE_PACKAGE_PLAN_STATUS.approved,
        COMPETITION_STAGE_PACKAGE_PLAN_TRANSITIONS.submit,
      ),
    ).toBe(false);
  });
});
