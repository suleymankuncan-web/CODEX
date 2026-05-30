import {
  CompetitionStagePackagePlan,
} from "../application/competition.contract";
import {
  type CompetitionStagePackagePlanTransitionPolicy,
} from "../application/competition-stage-package-plan-transition.policy";
import { writeCompetitionAudit } from "./competition.repository.audit";
import { type Queryable } from "./competition.repository.db";
import {
  mapStagePackagePlan,
  type CompetitionStagePackagePlanRow,
} from "./competition.repository.mapper";
import { stagePackagePlanReturningClause } from "./competition-stage-package-plan-write-sql";

type ReviewStagePackagePlanInput = {
  client: Queryable;
  planId: string;
  actorUserId: string;
  reviewNote?: string;
  transition: CompetitionStagePackagePlanTransitionPolicy;
};

export class CompetitionStagePackagePlanReviewCommandRepository {
  async reviewStagePackagePlan(
    input: ReviewStagePackagePlanInput,
  ): Promise<CompetitionStagePackagePlan> {
    const reviewNote = input.reviewNote?.trim() || null;
    const result = await input.client.query<CompetitionStagePackagePlanRow>(
      `
        UPDATE ops.competition_stage_package_plan
        SET
          plan_status = $2,
          reviewed_by_user_id = $3,
          review_note = $4,
          reviewed_at = NOW(),
          updated_by_user_id = $3,
          updated_at = NOW()
        WHERE competition_stage_package_plan_id = $1::uuid
        ${stagePackagePlanReturningClause}
      `,
      [
        input.planId,
        input.transition.targetStatus,
        input.actorUserId,
        reviewNote,
      ],
    );

    const plan = mapStagePackagePlan(result.rows[0]);

    await writeCompetitionAudit(input.client, {
      actorUserId: input.actorUserId,
      eventType: input.transition.auditEventType,
      entityName: input.transition.entityName,
      entityId: input.planId,
      metadata: {
        competitionId: plan.competitionId,
        packageCode: plan.packageCode,
        planName: plan.planName,
        reviewNote,
      },
    });

    return plan;
  }
}
