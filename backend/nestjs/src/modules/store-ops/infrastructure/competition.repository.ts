import { BadRequestException, Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";
import {
  Competition,
  CompetitionBaseDetail,
  CompetitionStage,
  CompetitionStageFinalizationState,
  CompetitionStagePackagePlan,
  CompetitionStagePackagePlanAuditEvent,
  CompetitionStoreContribution,
  CompetitionTeamTemplate,
  CompetitionWarning,
  ApproveCompetitionStagePackagePlanInput,
  CancelCompetitionStagePackagePlanInput,
  CloneCompetitionStagePackagePlanInput,
  CloneCompetitionTeamTemplateInput,
  CreateCompetitionStagePackageInput,
  CreateCompetitionStagePackagePlanInput,
  CreateCompetitionStageInput,
  CreateCompetitionTeamTemplateInput,
  DeactivateCompetitionTeamTemplateInput,
  ExecuteCompetitionStagePackagePlanInput,
  RecalculateCompetitionStageInput,
  RejectCompetitionStagePackagePlanInput,
  SubmitCompetitionStagePackagePlanInput,
  UpdateCompetitionStagePackagePlanInput,
  UpdateCompetitionTeamTemplateInput,
} from "../application/competition.contract";
import {
  COMPETITION_STAGE_PACKAGE_PLAN_TRANSITIONS,
  canApplyCompetitionStagePackagePlanTransition,
  type CompetitionStagePackagePlanTransitionPolicy,
} from "../application/competition-stage-package-plan-transition.policy";
import { writeCompetitionAudit } from "./competition.repository.audit";
import { type Queryable } from "./competition.repository.db";
import { CompetitionReadRepository } from "./competition-read.repository";
import { CompetitionStagePackagePlanExecutionCommandRepository } from "./competition-stage-package-plan-execution-command.repository";
import { CompetitionStagePackagePlanReviewCommandRepository } from "./competition-stage-package-plan-review-command.repository";
import { CompetitionStagePackagePlanReadRepository } from "./competition-stage-package-plan-read.repository";
import { stagePackagePlanReturningClause } from "./competition-stage-package-plan-write-sql";
import { CompetitionTeamTemplateCommandRepository } from "./competition-team-template-command.repository";
import { CompetitionTeamTemplateReadRepository } from "./competition-team-template-read.repository";
import {
  buildStageAdvancementRule,
  mapCompetition,
  mapStage,
  mapStagePackagePlan,
  mapStoreAccessContexts,
  mapWarning,
  type CompetitionAccessContextRow,
  type CompetitionRow,
  type CompetitionStagePackagePlanRow,
  type CompetitionStageRow,
  type CompetitionTeamTemplateStoreRow,
  type CompetitionWarningRow,
  type StoreAccessContext,
} from "./competition.repository.mapper";

@Injectable()
export class CompetitionRepository {
  private readonly competitionReadRepository: CompetitionReadRepository;
  private readonly stagePackagePlanExecutionCommandRepository: CompetitionStagePackagePlanExecutionCommandRepository;
  private readonly stagePackagePlanReviewCommandRepository =
    new CompetitionStagePackagePlanReviewCommandRepository();
  private readonly stagePackagePlanReadRepository: CompetitionStagePackagePlanReadRepository;
  private readonly teamTemplateReadRepository: CompetitionTeamTemplateReadRepository;
  private readonly teamTemplateCommandRepository: CompetitionTeamTemplateCommandRepository;

  constructor(private readonly databaseService: DatabaseService) {
    this.competitionReadRepository = new CompetitionReadRepository(databaseService);
    this.stagePackagePlanExecutionCommandRepository =
      new CompetitionStagePackagePlanExecutionCommandRepository(databaseService);
    this.stagePackagePlanReadRepository =
      new CompetitionStagePackagePlanReadRepository(databaseService);
    this.teamTemplateReadRepository =
      new CompetitionTeamTemplateReadRepository(databaseService);
    this.teamTemplateCommandRepository =
      new CompetitionTeamTemplateCommandRepository(databaseService);
  }

  private hasReadScope(input: {
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
  }) {
    return (
      input.companyIds.length > 0 ||
      input.regionIds.length > 0 ||
      input.storeIds.length > 0
    );
  }

  async listStoreAccessContexts(storeIds: string[]): Promise<StoreAccessContext[]> {
    if (storeIds.length === 0) {
      return [];
    }

    const result = await this.databaseService.query<{
      store_id: string;
      company_id: string;
      region_id: string;
    }>(
      `
        SELECT store_id, company_id, region_id
        FROM ops.store
        WHERE store_id = ANY($1::uuid[])
      `,
      [storeIds],
    );

    return result.rows.map((row) => ({
      storeId: row.store_id,
      companyId: row.company_id,
      regionId: row.region_id,
    }));
  }

  async getCompetitionAccessContext(competitionId: string): Promise<{
    competitionId: string;
    ownerUserId: string;
    stores: StoreAccessContext[];
  } | null> {
    const result = await this.databaseService.query<CompetitionAccessContextRow>(
      `
        SELECT
          competition.competition_id,
          competition.owner_user_id,
          store.store_id,
          store.company_id,
          store.region_id
        FROM ops.competition competition
        LEFT JOIN ops.competition_stage stage
          ON stage.competition_id = competition.competition_id
        LEFT JOIN ops.competition_team team
          ON team.competition_stage_id = stage.competition_stage_id
        LEFT JOIN ops.competition_team_store team_store
          ON team_store.competition_team_id = team.competition_team_id
        LEFT JOIN ops.store store
          ON store.store_id = team_store.store_id
        WHERE competition.competition_id = $1::uuid
      `,
      [competitionId],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return {
      competitionId: result.rows[0].competition_id,
      ownerUserId: result.rows[0].owner_user_id,
      stores: mapStoreAccessContexts(result.rows),
    };
  }

  async getCompetitionIdForStage(stageId: string): Promise<string | null> {
    const result = await this.databaseService.query<{ competition_id: string }>(
      `
        SELECT competition_id
        FROM ops.competition_stage
        WHERE competition_stage_id = $1::uuid
      `,
      [stageId],
    );

    return result.rows[0]?.competition_id ?? null;
  }

  async getTeamTemplateAccessContext(templateId: string): Promise<{
    templateId: string;
    stores: StoreAccessContext[];
  } | null> {
    const result = await this.databaseService.query<CompetitionTeamTemplateStoreRow>(
      `
        SELECT
          template.competition_team_template_id,
          template.template_code,
          template.template_name,
          template.description,
          template.is_active,
          store.store_id,
          store.store_code,
          store.store_name,
          store.company_id,
          store.region_id
        FROM ops.competition_team_template template
        LEFT JOIN ops.competition_team_template_store template_store
          ON template_store.competition_team_template_id = template.competition_team_template_id
        LEFT JOIN ops.store store
          ON store.store_id = template_store.store_id
        WHERE template.competition_team_template_id = $1::uuid
      `,
      [templateId],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return {
      templateId: result.rows[0].competition_team_template_id,
      stores: mapStoreAccessContexts(result.rows),
    };
  }

  async getStagePackagePlanForAccess(
    planId: string,
  ): Promise<CompetitionStagePackagePlan | null> {
    const result = await this.databaseService.query<CompetitionStagePackagePlanRow>(
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
      `,
      [planId],
    );

    return result.rows[0] ? mapStagePackagePlan(result.rows[0]) : null;
  }

  async listCompetitions(input: {
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
    actorUserId?: string;
    limit: number;
    offset: number;
  }): Promise<Competition[]> {
    return this.competitionReadRepository.listCompetitions(input);
  }

  async getCompetitionDetail(input: {
    competitionId: string;
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
    actorUserId?: string;
  }): Promise<CompetitionBaseDetail | null> {
    return this.competitionReadRepository.getCompetitionDetail(input);
  }

  async listStoreContributionsForCompetition(input: {
    competitionId: string;
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
  }): Promise<CompetitionStoreContribution[]> {
    return this.competitionReadRepository.listStoreContributionsForCompetition(input);
  }

  async listTeamTemplates(input: {
    activeOnly?: boolean;
    companyIds?: string[];
    regionIds?: string[];
    storeIds?: string[];
  } = {}): Promise<CompetitionTeamTemplate[]> {
    return this.teamTemplateReadRepository.listTeamTemplates(input);
  }

  async createCompetition(input: {
    actorUserId: string;
    ownerUserId: string;
    competitionCode: string;
    competitionName: string;
    description?: string;
    competitionType: "region_challenge" | "region_league" | "campaign";
    startsOn: string;
    endsOn: string;
  }): Promise<Competition> {
    return this.databaseService.withTransaction(async (client) => {
      const result = await client.query<CompetitionRow>(
        `
          INSERT INTO ops.competition (
            competition_code,
            competition_name,
            description,
            competition_type,
            lifecycle_state,
            owner_user_id,
            starts_on,
            ends_on
          )
          VALUES ($1, $2, $3, $4, 'draft', $5, $6::date, $7::date)
          RETURNING
            competition_id,
            competition_code,
            competition_name,
            description,
            competition_type,
            lifecycle_state,
            starts_on,
            ends_on
        `,
        [
          input.competitionCode,
          input.competitionName,
          input.description ?? null,
          input.competitionType,
          input.ownerUserId,
          input.startsOn,
          input.endsOn,
        ],
      );

      const row = result.rows[0];
      await writeCompetitionAudit(client, {
        actorUserId: input.actorUserId,
        eventType: "competition.created",
        entityName: "ops.competition",
        entityId: row.competition_id,
        metadata: {
          competitionCode: input.competitionCode,
          competitionType: input.competitionType,
          startsOn: input.startsOn,
          endsOn: input.endsOn,
        },
      });

      return mapCompetition(row);
    });
  }

  async createTeamTemplate(
    input: CreateCompetitionTeamTemplateInput,
  ): Promise<CompetitionTeamTemplate> {
    return this.teamTemplateCommandRepository.createTeamTemplate(input);
  }

  async deactivateTeamTemplate(
    input: DeactivateCompetitionTeamTemplateInput,
  ): Promise<CompetitionTeamTemplate> {
    return this.teamTemplateCommandRepository.deactivateTeamTemplate(input);
  }

  async updateTeamTemplate(
    input: UpdateCompetitionTeamTemplateInput,
  ): Promise<CompetitionTeamTemplate> {
    return this.teamTemplateCommandRepository.updateTeamTemplate(input);
  }

  async cloneTeamTemplate(
    input: CloneCompetitionTeamTemplateInput,
  ): Promise<CompetitionTeamTemplate> {
    return this.teamTemplateCommandRepository.cloneTeamTemplate(input);
  }

  async createStageWithTeams(input: CreateCompetitionStageInput): Promise<CompetitionStage> {
    return this.databaseService.withTransaction(async (client) => {
      return this.insertStageWithTeams(client, input);
    });
  }

  async createStagePackage(
    input: CreateCompetitionStagePackageInput,
  ): Promise<CompetitionStage[]> {
    return this.databaseService.withTransaction(async (client) => {
      const stages: CompetitionStage[] = [];

      for (const stageInput of input.stages) {
        const stage = await this.insertStageWithTeams(client, {
          actorUserId: input.actorUserId,
          competitionId: input.competitionId,
          ...stageInput,
        });

        stages.push(stage);
      }

      await writeCompetitionAudit(client, {
        actorUserId: input.actorUserId,
        eventType: "competition_stage_package.created",
        entityName: "ops.competition",
        entityId: input.competitionId,
        metadata: {
          competitionId: input.competitionId,
          packageCode: input.packageCode,
          stageCount: stages.length,
          stageCodes: stages.map((stage) => stage.stageCode),
        },
      });

      return stages;
    });
  }

  async listStagePackagePlans(input: {
    competitionId: string;
  }): Promise<CompetitionStagePackagePlan[]> {
    return this.stagePackagePlanReadRepository.listStagePackagePlans(input);
  }

  async createStagePackagePlan(
    input: CreateCompetitionStagePackagePlanInput,
  ): Promise<CompetitionStagePackagePlan> {
    const transition = COMPETITION_STAGE_PACKAGE_PLAN_TRANSITIONS.saveDraft;

    return this.databaseService.withTransaction(async (client) => {
      const result = await client.query<CompetitionStagePackagePlanRow>(
        `
          INSERT INTO ops.competition_stage_package_plan (
            competition_id,
            package_code,
            plan_name,
            plan_status,
            stage_drafts_json,
            created_by_user_id,
            updated_by_user_id
          )
          VALUES ($1::uuid, $2, $3, $4, $5::jsonb, $6, $6)
          ${stagePackagePlanReturningClause}
        `,
        [
          input.competitionId,
          input.packageCode,
          input.planName,
          transition.targetStatus,
          JSON.stringify(input.stages),
          input.actorUserId,
        ],
      );

      const row = result.rows[0];

      await this.writeStagePackagePlanAudit(client, {
        actorUserId: input.actorUserId,
        transition,
        entityId: row.competition_stage_package_plan_id,
        metadata: {
          competitionId: input.competitionId,
          packageCode: input.packageCode,
          planName: input.planName,
          stageCount: input.stages.length,
          stageCodes: input.stages.map((stage) => stage.stageCode),
        },
      });

      return mapStagePackagePlan(row);
    });
  }

  async updateStagePackagePlan(
    input: UpdateCompetitionStagePackagePlanInput,
  ): Promise<CompetitionStagePackagePlan> {
    const transition = COMPETITION_STAGE_PACKAGE_PLAN_TRANSITIONS.updateDraft;

    return this.databaseService.withTransaction(async (client) => {
      const planRow = await this.getStagePackagePlanForUpdate(client, input.planId);

      this.assertStagePackagePlanTransition(
        planRow,
        transition,
        "Stage package plan is not editable",
      );

      const result = await client.query<CompetitionStagePackagePlanRow>(
        `
          UPDATE ops.competition_stage_package_plan
          SET
            package_code = $2,
            plan_name = $3,
            stage_drafts_json = $4::jsonb,
            updated_by_user_id = $5,
            updated_at = NOW()
          WHERE competition_stage_package_plan_id = $1::uuid
          ${stagePackagePlanReturningClause}
        `,
        [
          input.planId,
          input.packageCode,
          input.planName,
          JSON.stringify(input.stages),
          input.actorUserId,
        ],
      );

      const plan = mapStagePackagePlan(result.rows[0]);

      await this.writeStagePackagePlanAudit(client, {
        actorUserId: input.actorUserId,
        transition,
        entityId: input.planId,
        metadata: {
          competitionId: plan.competitionId,
          packageCode: input.packageCode,
          planName: input.planName,
          changedFields: ["package_code", "plan_name", "stage_drafts_json"],
          stageCount: input.stages.length,
          stageCodes: input.stages.map((stage) => stage.stageCode),
          stageNames: input.stages.map((stage) => stage.stageName),
        },
      });

      return plan;
    });
  }

  async submitStagePackagePlan(
    input: SubmitCompetitionStagePackagePlanInput,
  ): Promise<CompetitionStagePackagePlan> {
    const transition = COMPETITION_STAGE_PACKAGE_PLAN_TRANSITIONS.submit;

    return this.databaseService.withTransaction(async (client) => {
      const planRow = await this.getStagePackagePlanForUpdate(client, input.planId);

      this.assertStagePackagePlanTransition(
        planRow,
        transition,
        "Stage package plan is not submittable",
      );

      const result = await client.query<CompetitionStagePackagePlanRow>(
        `
          UPDATE ops.competition_stage_package_plan
          SET
            plan_status = $2,
            submitted_by_user_id = $3,
            submitted_at = NOW(),
            updated_by_user_id = $3,
            updated_at = NOW()
          WHERE competition_stage_package_plan_id = $1::uuid
          ${stagePackagePlanReturningClause}
        `,
        [input.planId, transition.targetStatus, input.actorUserId],
      );

      const plan = mapStagePackagePlan(result.rows[0]);

      await this.writeStagePackagePlanAudit(client, {
        actorUserId: input.actorUserId,
        transition,
        entityId: input.planId,
        metadata: {
          competitionId: plan.competitionId,
          packageCode: plan.packageCode,
          planName: plan.planName,
        },
      });

      return plan;
    });
  }

  async approveStagePackagePlan(
    input: ApproveCompetitionStagePackagePlanInput,
  ): Promise<CompetitionStagePackagePlan> {
    const transition = COMPETITION_STAGE_PACKAGE_PLAN_TRANSITIONS.approve;

    return this.databaseService.withTransaction(async (client) => {
      const planRow = await this.getStagePackagePlanForUpdate(client, input.planId);

      this.assertStagePackagePlanTransition(
        planRow,
        transition,
        "Stage package plan is not reviewable",
      );

      return this.stagePackagePlanReviewCommandRepository.reviewStagePackagePlan({
        client,
        planId: input.planId,
        actorUserId: input.actorUserId,
        reviewNote: input.reviewNote,
        transition,
      });
    });
  }

  async rejectStagePackagePlan(
    input: RejectCompetitionStagePackagePlanInput,
  ): Promise<CompetitionStagePackagePlan> {
    const transition = COMPETITION_STAGE_PACKAGE_PLAN_TRANSITIONS.reject;

    return this.databaseService.withTransaction(async (client) => {
      const planRow = await this.getStagePackagePlanForUpdate(client, input.planId);

      this.assertStagePackagePlanTransition(
        planRow,
        transition,
        "Stage package plan is not reviewable",
      );

      return this.stagePackagePlanReviewCommandRepository.reviewStagePackagePlan({
        client,
        planId: input.planId,
        actorUserId: input.actorUserId,
        reviewNote: input.reviewNote,
        transition,
      });
    });
  }

  async cloneStagePackagePlan(
    input: CloneCompetitionStagePackagePlanInput,
  ): Promise<CompetitionStagePackagePlan> {
    const sourceTransition =
      COMPETITION_STAGE_PACKAGE_PLAN_TRANSITIONS.cloneSourceToDraft;
    const draftTransition =
      COMPETITION_STAGE_PACKAGE_PLAN_TRANSITIONS.cloneDraftFromReturned;

    return this.databaseService.withTransaction(async (client) => {
      const sourceRow = await this.getStagePackagePlanForUpdate(
        client,
        input.sourcePlanId,
      );

      this.assertStagePackagePlanTransition(
        sourceRow,
        sourceTransition,
        "Stage package plan is not cloneable",
      );

      const sourcePlan = mapStagePackagePlan(sourceRow);
      const clonedPlanName = `${sourcePlan.planName} revision`;
      const result = await client.query<CompetitionStagePackagePlanRow>(
        `
          INSERT INTO ops.competition_stage_package_plan (
            competition_id,
            package_code,
            plan_name,
            plan_status,
            stage_drafts_json,
            created_by_user_id,
            updated_by_user_id
          )
          VALUES ($1::uuid, $2, $3, $4, $5::jsonb, $6, $6)
          ${stagePackagePlanReturningClause}
        `,
        [
          sourcePlan.competitionId,
          sourcePlan.packageCode,
          clonedPlanName,
          draftTransition.targetStatus,
          JSON.stringify(sourcePlan.stageDrafts),
          input.actorUserId,
        ],
      );

      const clonedPlan = mapStagePackagePlan(result.rows[0]);

      await this.writeStagePackagePlanAudit(client, {
        actorUserId: input.actorUserId,
        transition: sourceTransition,
        entityId: sourcePlan.planId,
        metadata: {
          competitionId: sourcePlan.competitionId,
          packageCode: sourcePlan.packageCode,
          planName: sourcePlan.planName,
          clonedPlanId: clonedPlan.planId,
          clonedPlanName: clonedPlan.planName,
        },
      });

      await this.writeStagePackagePlanAudit(client, {
        actorUserId: input.actorUserId,
        transition: draftTransition,
        entityId: clonedPlan.planId,
        metadata: {
          sourcePlanId: sourcePlan.planId,
          sourcePlanName: sourcePlan.planName,
          competitionId: clonedPlan.competitionId,
          packageCode: clonedPlan.packageCode,
          planName: clonedPlan.planName,
          stageCount: clonedPlan.stageDrafts.length,
          stageCodes: clonedPlan.stageDrafts.map((stage) => stage.stageCode),
        },
      });

      return clonedPlan;
    });
  }

  async executeStagePackagePlan(
    input: ExecuteCompetitionStagePackagePlanInput,
  ): Promise<{ plan: CompetitionStagePackagePlan; stages: CompetitionStage[] }> {
    return this.stagePackagePlanExecutionCommandRepository.executeStagePackagePlan(
      input,
    );
  }

  async cancelStagePackagePlan(
    input: CancelCompetitionStagePackagePlanInput,
  ): Promise<CompetitionStagePackagePlan> {
    const transition = COMPETITION_STAGE_PACKAGE_PLAN_TRANSITIONS.cancel;

    return this.databaseService.withTransaction(async (client) => {
      const planRow = await this.getStagePackagePlanForUpdate(client, input.planId);
      this.assertStagePackagePlanTransition(
        planRow,
        transition,
        "Stage package plan is not cancellable",
      );

      const result = await client.query<CompetitionStagePackagePlanRow>(
        `
          UPDATE ops.competition_stage_package_plan
          SET
            plan_status = $2,
            updated_by_user_id = $3,
            updated_at = NOW()
          WHERE competition_stage_package_plan_id = $1::uuid
          ${stagePackagePlanReturningClause}
        `,
        [input.planId, transition.targetStatus, input.actorUserId],
      );

      const plan = mapStagePackagePlan(result.rows[0]);

      await this.writeStagePackagePlanAudit(client, {
        actorUserId: input.actorUserId,
        transition,
        entityId: input.planId,
        metadata: {
          competitionId: plan.competitionId,
          packageCode: plan.packageCode,
          planName: plan.planName,
        },
      });

      return plan;
    });
  }

  async listStagePackagePlanAudit(input: {
    planId: string;
  }): Promise<CompetitionStagePackagePlanAuditEvent[]> {
    return this.stagePackagePlanReadRepository.listStagePackagePlanAudit(input);
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

  async recalculateStage(input: RecalculateCompetitionStageInput) {
    return this.databaseService.withTransaction(async (client) => {
      await client.query(
        `
          DELETE FROM rpt.competition_stage_warning
          WHERE competition_stage_id = $1::uuid
        `,
        [input.stageId],
      );
      await client.query(
        `
          DELETE FROM rpt.competition_stage_score_snapshot
          WHERE competition_stage_id = $1::uuid
        `,
        [input.stageId],
      );
      await client.query(
        `
          DELETE FROM rpt.competition_stage_store_score_snapshot
          WHERE competition_stage_id = $1::uuid
        `,
        [input.stageId],
      );

      const storeSnapshotResult = await client.query(
        `
          WITH stage_scope AS (
              SELECT
                  stage.competition_stage_id,
                  stage.starts_on,
                  stage.ends_on
              FROM ops.competition_stage stage
              WHERE stage.competition_stage_id = $1::uuid
          ),
          closed_days AS (
              SELECT
                  run.snapshot_run_id,
                  run.period_start AS snapshot_date
              FROM rpt.snapshot_run run
              INNER JOIN stage_scope stage
                  ON run.period_start BETWEEN stage.starts_on AND stage.ends_on
              WHERE run.snapshot_type = 'daily'
                AND run.run_status = 'completed'
                AND run.period_start = run.period_end
          ),
          team_stores AS (
              SELECT
                  team.competition_team_id,
                  team_store.store_id
              FROM ops.competition_team team
              INNER JOIN ops.competition_team_store team_store
                  ON team_store.competition_team_id = team.competition_team_id
              WHERE team.competition_stage_id = $1::uuid
          ),
          metric_weights AS (
              SELECT *
              FROM (VALUES
                  ('TARGET_ACHIEVEMENT', 35::numeric),
                  ('CR', 20::numeric),
                  ('ATV', 15::numeric),
                  ('UPT', 15::numeric),
                  ('BM_CHECKLIST', 5::numeric),
                  ('VM_CHECKLIST', 5::numeric), ('GSM_ONAY', 5::numeric)
              ) AS weights(kpi_code, weight_percent)
          ),
          store_day_matrix AS (
              SELECT
                  team_stores.competition_team_id,
                  team_stores.store_id,
                  closed_days.snapshot_run_id,
                  closed_days.snapshot_date
              FROM team_stores
              CROSS JOIN closed_days
          ),
          metric_values AS (
              SELECT
                  matrix.competition_team_id,
                  matrix.store_id,
                  matrix.snapshot_date,
                  weights.kpi_code,
                  weights.weight_percent,
                  snapshot.actual_value,
                  snapshot.achievement_rate
              FROM store_day_matrix matrix
              CROSS JOIN metric_weights weights
              LEFT JOIN ops.kpi_definition definition
                  ON definition.kpi_code = weights.kpi_code
              LEFT JOIN rpt.store_kpi_snapshot snapshot
                  ON snapshot.store_id = matrix.store_id
                 AND snapshot.kpi_id = definition.kpi_id
                 AND (
                      (weights.kpi_code IN ('TARGET_ACHIEVEMENT', 'CR', 'ATV', 'UPT')
                       AND snapshot.snapshot_run_id = matrix.snapshot_run_id
                       AND snapshot.period_start = matrix.snapshot_date
                       AND snapshot.period_end = matrix.snapshot_date)
                      OR
                      (weights.kpi_code IN ('BM_CHECKLIST', 'VM_CHECKLIST', 'GSM_ONAY')
                       AND snapshot.period_start <= matrix.snapshot_date
                       AND snapshot.period_end >= matrix.snapshot_date)
                 )
          ),
          store_scores AS (
              SELECT
                  competition_team_id,
                  store_id,
                  snapshot_date,
                  SUM(
                      CASE
                          WHEN actual_value IS NULL AND achievement_rate IS NULL THEN 0
                          WHEN achievement_rate IS NOT NULL THEN achievement_rate * 100 * weight_percent / 100
                          ELSE actual_value * weight_percent / 100
                      END
                  ) AS score_value,
                  SUM(CASE WHEN actual_value IS NULL AND achievement_rate IS NULL THEN 0 ELSE weight_percent END) AS reported_weight_percent,
                  ARRAY_AGG(kpi_code ORDER BY kpi_code) FILTER (
                      WHERE actual_value IS NULL AND achievement_rate IS NULL
                  ) AS missing_kpi_codes,
                  COUNT(*) FILTER (
                      WHERE kpi_code IN ('TARGET_ACHIEVEMENT', 'CR', 'ATV', 'UPT')
                        AND (actual_value IS NOT NULL OR achievement_rate IS NOT NULL)
                  ) > 0 AS has_daily_data
              FROM metric_values
              GROUP BY competition_team_id, store_id, snapshot_date
          )
          INSERT INTO rpt.competition_stage_store_score_snapshot (
              competition_stage_id,
              competition_team_id,
              store_id,
              snapshot_date,
              score_value,
              reported_weight_percent,
              expected_weight_percent,
              has_daily_data,
              missing_kpi_codes
          )
          SELECT
              $1::uuid,
              competition_team_id,
              store_id,
              snapshot_date,
              CASE WHEN has_daily_data THEN score_value ELSE NULL END,
              reported_weight_percent,
              100,
              has_daily_data,
              COALESCE(missing_kpi_codes, ARRAY[]::text[])
          FROM store_scores
        `,
        [input.stageId],
      );

      const warningResult = await client.query(
        `
          INSERT INTO rpt.competition_stage_warning (
              competition_stage_id,
              competition_team_id,
              store_id,
              warning_code,
              warning_level,
              period_start,
              period_end,
              message
          )
          SELECT
              store_score.competition_stage_id,
              store_score.competition_team_id,
              store_score.store_id,
              warning.warning_code,
              CASE WHEN warning.warning_code = 'missing_daily_store_data' THEN 'blocker' ELSE 'warning' END,
              store_score.snapshot_date,
              store_score.snapshot_date,
              warning.warning_code || ' for store ' || store.store_code || ' on ' || store_score.snapshot_date::text
          FROM rpt.competition_stage_store_score_snapshot store_score
          INNER JOIN ops.store store
              ON store.store_id = store_score.store_id
          CROSS JOIN LATERAL unnest(
              ARRAY[
                  CASE WHEN store_score.has_daily_data = FALSE THEN 'missing_daily_store_data' END,
                  CASE WHEN 'BM_CHECKLIST' = ANY(store_score.missing_kpi_codes) THEN 'missing_bm_checklist' END,
                  CASE WHEN 'VM_CHECKLIST' = ANY(store_score.missing_kpi_codes) THEN 'missing_vm_checklist' END
              ]::text[]
          ) AS warning(warning_code)
          WHERE store_score.competition_stage_id = $1::uuid
            AND warning.warning_code IS NOT NULL
        `,
        [input.stageId],
      );

      const teamSnapshotResult = await client.query(
        `
          WITH team_scores AS (
              SELECT
                  competition_stage_id,
                  competition_team_id,
                  snapshot_date,
                  AVG(score_value) FILTER (WHERE score_value IS NOT NULL) AS score_value,
                  COUNT(*) FILTER (WHERE score_value IS NOT NULL) AS valid_store_count,
                  COUNT(*) AS total_store_count
              FROM rpt.competition_stage_store_score_snapshot
              WHERE competition_stage_id = $1::uuid
              GROUP BY competition_stage_id, competition_team_id, snapshot_date
          ),
          ranked AS (
              SELECT
                  *,
                  CASE
                      WHEN score_value IS NULL THEN NULL
                      ELSE DENSE_RANK() OVER (PARTITION BY competition_stage_id, snapshot_date ORDER BY score_value DESC)
                  END AS rank_position,
                  COUNT(*) OVER (PARTITION BY competition_stage_id, snapshot_date) AS ranking_population
              FROM team_scores
          )
          INSERT INTO rpt.competition_stage_score_snapshot (
              competition_stage_id,
              competition_team_id,
              snapshot_date,
              score_value,
              valid_store_count,
              total_store_count,
              coverage_rate,
              rank_position,
              ranking_population
          )
          SELECT
              competition_stage_id,
              competition_team_id,
              snapshot_date,
              score_value,
              valid_store_count,
              total_store_count,
              CASE WHEN total_store_count = 0 THEN 0 ELSE valid_store_count::numeric / total_store_count::numeric END,
              rank_position,
              ranking_population
          FROM ranked
        `,
        [input.stageId],
      );

      await writeCompetitionAudit(client, {
        actorUserId: input.actorUserId,
        eventType: "competition_stage.recalculated",
        entityName: "ops.competition_stage",
        entityId: input.stageId,
        metadata: {
          storeSnapshotRows: storeSnapshotResult.rowCount ?? 0,
          warningRows: warningResult.rowCount ?? 0,
          teamSnapshotRows: teamSnapshotResult.rowCount ?? 0,
        },
      });

      return {
        stageId: input.stageId,
        storeSnapshotRows: storeSnapshotResult.rowCount ?? 0,
        warningRows: warningResult.rowCount ?? 0,
        teamSnapshotRows: teamSnapshotResult.rowCount ?? 0,
      };
    });
  }

  async listOpenWarnings(stageId: string): Promise<CompetitionWarning[]> {
    const result = await this.databaseService.query<CompetitionWarningRow>(
      `
        SELECT
          competition_stage_warning_id,
          competition_stage_id,
          competition_team_id,
          store_id,
          warning_code,
          warning_level,
          period_start,
          period_end,
          message,
          resolved_at
        FROM rpt.competition_stage_warning
        WHERE competition_stage_id = $1::uuid
          AND resolved_at IS NULL
        ORDER BY warning_level DESC, warning_code ASC, period_start ASC
      `,
      [stageId],
    );

    return result.rows.map(mapWarning);
  }

  async finalizeStage(input: {
    stageId: string;
    actorUserId: string;
    finalizationState: CompetitionStageFinalizationState;
    finalizationNote: string | null;
    unresolvedWarningCount: number;
  }): Promise<CompetitionStage> {
    return this.databaseService.withTransaction(async (client) => {
      const result = await client.query<CompetitionStageRow>(
        `
          UPDATE ops.competition_stage
          SET
            lifecycle_state = 'finalized',
            finalized_by_user_id = $2,
            finalized_at = NOW(),
            finalization_state = $3,
            finalization_note = $4,
            updated_at = NOW()
          WHERE competition_stage_id = $1::uuid
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
          input.stageId,
          input.actorUserId,
          input.finalizationState,
          input.finalizationNote,
        ],
      );

      const stage = result.rows[0];
      await writeCompetitionAudit(client, {
        actorUserId: input.actorUserId,
        eventType: "competition_stage.finalized",
        entityName: "ops.competition_stage",
        entityId: input.stageId,
        metadata: {
          finalizationState: input.finalizationState,
          finalizationNote: input.finalizationNote,
          unresolvedWarningCount: input.unresolvedWarningCount,
        },
      });

      return mapStage(stage);
    });
  }

}
