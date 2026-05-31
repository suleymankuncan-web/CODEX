import { BadRequestException } from "@nestjs/common";
import {
  CompetitionStage,
  CompetitionStagePackagePlan,
  CreateCompetitionStageInput,
  ExecuteCompetitionStagePackagePlanInput,
} from "../application/competition.contract";
import {
  COMPETITION_STAGE_PACKAGE_PLAN_TRANSITIONS,
  canApplyCompetitionStagePackagePlanTransition,
  type CompetitionStagePackagePlanTransitionPolicy,
} from "../application/competition-stage-package-plan-transition.policy";
import { DatabaseService } from "../../../shared/database/database.service";
import { writeCompetitionAudit } from "./competition.repository.audit";
import { type Queryable } from "./competition.repository.db";
import {
  buildStageAdvancementRule,
  mapStage,
  mapStagePackagePlan,
  type CompetitionStagePackagePlanRow,
  type CompetitionStageRow,
} from "./competition.repository.mapper";
import { stagePackagePlanReturningClause } from "./competition-stage-package-plan-write-sql";

export class CompetitionStagePackagePlanExecutionCommandRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async executeStagePackagePlan(
    input: ExecuteCompetitionStagePackagePlanInput,
  ): Promise<{ plan: CompetitionStagePackagePlan; stages: CompetitionStage[] }> {
    const transition = COMPETITION_STAGE_PACKAGE_PLAN_TRANSITIONS.execute;

    return this.databaseService.withTransaction(async (client) => {
      const planRow = await this.getStagePackagePlanForUpdate(client, input.planId);
      this.assertStagePackagePlanTransition(
        planRow,
        transition,
        "Stage package plan is not executable",
      );

      const stageDrafts = mapStagePackagePlan(planRow).stageDrafts;
      const stages: CompetitionStage[] = [];

      for (const stageInput of stageDrafts) {
        const stage = await this.insertStageWithTeams(client, {
          actorUserId: input.actorUserId,
          competitionId: planRow.competition_id,
          ...stageInput,
        });

        stages.push(stage);
      }

      const createdStageIds = stages.map((stage) => stage.competitionStageId);
      const executedPlanResult = await client.query<CompetitionStagePackagePlanRow>(
        `
          UPDATE ops.competition_stage_package_plan
          SET
            plan_status = $2,
            executed_by_user_id = $3,
            executed_at = NOW(),
            updated_by_user_id = $3,
            updated_at = NOW(),
            created_stage_ids = $4::uuid[]
          WHERE competition_stage_package_plan_id = $1::uuid
          ${stagePackagePlanReturningClause}
        `,
        [input.planId, transition.targetStatus, input.actorUserId, createdStageIds],
      );

      const executedPlan = mapStagePackagePlan(executedPlanResult.rows[0]);

      await this.writeStagePackagePlanAudit(client, {
        actorUserId: input.actorUserId,
        transition,
        entityId: input.planId,
        metadata: {
          competitionId: executedPlan.competitionId,
          packageCode: executedPlan.packageCode,
          planName: executedPlan.planName,
          stageCount: stages.length,
          createdStageIds,
        },
      });

      return { plan: executedPlan, stages };
    });
  }

  private assertStagePackagePlanTransition(
    planRow: CompetitionStagePackagePlanRow,
    transition: CompetitionStagePackagePlanTransitionPolicy,
    message: string,
  ) {
    if (!canApplyCompetitionStagePackagePlanTransition(planRow.plan_status, transition)) {
      throw new BadRequestException(message);
    }
  }

  private async getStagePackagePlanForUpdate(
    client: Queryable,
    planId: string,
  ): Promise<CompetitionStagePackagePlanRow> {
    const planResult = await client.query<CompetitionStagePackagePlanRow>(
      `
        SELECT
          competition_stage_package_plan_id,
          competition_id,
          package_code,
          plan_name,
          plan_status,
          stage_drafts_json,
          created_stage_ids,
          submitted_by_user_id,
          submitted_at,
          reviewed_by_user_id,
          reviewed_at,
          review_note,
          created_at,
          updated_at,
          executed_at
        FROM ops.competition_stage_package_plan
        WHERE competition_stage_package_plan_id = $1::uuid
        FOR UPDATE
      `,
      [planId],
    );

    const planRow = planResult.rows[0];
    if (!planRow) {
      throw new BadRequestException("Stage package plan not found");
    }

    return planRow;
  }

  private async writeStagePackagePlanAudit(
    client: Queryable,
    input: {
      actorUserId: string;
      transition: CompetitionStagePackagePlanTransitionPolicy;
      entityId: string;
      metadata: Record<string, unknown>;
    },
  ) {
    await writeCompetitionAudit(client, {
      actorUserId: input.actorUserId,
      eventType: input.transition.auditEventType,
      entityName: input.transition.entityName,
      entityId: input.entityId,
      metadata: input.metadata,
    });
  }

  private async insertStageWithTeams(
    client: Queryable,
    input: CreateCompetitionStageInput,
  ): Promise<CompetitionStage> {
    const stageResult = await client.query<CompetitionStageRow>(
      `
        INSERT INTO ops.competition_stage (
          competition_id,
          stage_code,
          stage_name,
          stage_order,
          stage_type,
          starts_on,
          ends_on,
          lifecycle_state,
          advancement_rule_json
        )
        VALUES ($1::uuid, $2, $3, $4::int, $5, $6::date, $7::date, 'active', $8::jsonb)
        RETURNING
          competition_stage_id,
          competition_id,
          stage_code,
          stage_name,
          stage_order,
          stage_type,
          starts_on,
          ends_on,
          lifecycle_state,
          finalization_state
      `,
      [
        input.competitionId,
        input.stageCode,
        input.stageName,
        input.stageOrder,
        input.stageType,
        input.startsOn,
        input.endsOn,
        JSON.stringify(buildStageAdvancementRule(input.stagePresetCode)),
      ],
    );

    const stage = stageResult.rows[0];

    for (let index = 0; index < input.teams.length; index += 1) {
      const team = input.teams[index];
      const teamResult = await client.query<{ competition_team_id: string }>(
        `
          INSERT INTO ops.competition_team (
            competition_stage_id,
            source_template_id,
            team_code,
            team_name,
            team_order
          )
          VALUES ($1::uuid, $2::uuid, $3, $4, $5::int)
          RETURNING competition_team_id
        `,
        [
          stage.competition_stage_id,
          team.sourceTemplateId ?? null,
          team.teamCode,
          team.teamName,
          index + 1,
        ],
      );

      await client.query(
        `
          INSERT INTO ops.competition_team_store (
            competition_team_id,
            store_id,
            added_manually
          )
          SELECT $1::uuid, unnest($2::uuid[]), TRUE
          ON CONFLICT DO NOTHING
        `,
        [teamResult.rows[0].competition_team_id, team.storeIds],
      );
    }

    await writeCompetitionAudit(client, {
      actorUserId: input.actorUserId,
      eventType: "competition_stage.created",
      entityName: "ops.competition_stage",
      entityId: stage.competition_stage_id,
      metadata: {
        competitionId: input.competitionId,
        stageCode: input.stageCode,
        stagePresetCode: input.stagePresetCode ?? null,
        teamCount: input.teams.length,
        storeCount: input.teams.reduce((sum, team) => sum + team.storeIds.length, 0),
      },
    });

    return mapStage(stage);
  }
}
