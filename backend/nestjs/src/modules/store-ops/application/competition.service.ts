import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { buildCommandResponse, buildListResponse } from "../../../shared/http/response-builders";
import { CompetitionRepository } from "../infrastructure/competition.repository";
import {
  CompetitionActorAccess,
  CompetitionDetail,
  CompetitionScope,
  CancelCompetitionStagePackagePlanInput,
  CloneCompetitionStagePackagePlanInput,
  CloneCompetitionTeamTemplateInput,
  CreateCompetitionInput,
  CreateCompetitionStagePackageInput,
  CreateCompetitionStagePackagePlanInput,
  CreateCompetitionStageInput,
  CreateCompetitionTeamTemplateInput,
  DeactivateCompetitionTeamTemplateInput,
  ExecuteCompetitionStagePackagePlanInput,
  FinalizeCompetitionStageInput,
  ApproveCompetitionStagePackagePlanInput,
  RecalculateCompetitionStageInput,
  RejectCompetitionStagePackagePlanInput,
  SubmitCompetitionStagePackagePlanInput,
  UpdateCompetitionStagePackagePlanInput,
  UpdateCompetitionTeamTemplateInput,
} from "./competition.contract";

@Injectable()
export class CompetitionService {
  constructor(private readonly competitionRepository: CompetitionRepository) {}

  async listCompetitions(input: {
    actorUserId?: string;
    actorScope: CompetitionScope;
    actorActionScope?: {
      assignedStoreIds: string[];
    };
    actorRoleCodes?: string[];
    limit?: number;
    offset?: number;
  }) {
    const limit = input.limit ?? 50;
    const offset = input.offset ?? 0;
    const readScope = resolveCompetitionReadScope(input);
    const items = await this.competitionRepository.listCompetitions({
      companyIds: readScope.companyIds,
      regionIds: readScope.regionIds,
      storeIds: readScope.storeIds,
      actorUserId: input.actorUserId,
      limit,
      offset,
    });

    return buildListResponse(items, {
      total: items.length,
      limit,
      offset,
    });
  }

  async listTeamTemplates(input: { activeOnly?: boolean } & CompetitionActorAccess = {}) {
    const enforceScope = this.shouldEnforceAdminScope(input);
    const items = await this.competitionRepository.listTeamTemplates({
      activeOnly: input.activeOnly ?? true,
      ...(enforceScope
        ? {
            companyIds: input.actorScope?.companyIds ?? [],
            regionIds: input.actorScope?.regionIds ?? [],
            storeIds: input.actorScope?.storeIds ?? [],
          }
        : {}),
    });

    return buildListResponse(items, {
      total: items.length,
      limit: items.length,
      offset: 0,
    });
  }

  async listStagePackagePlans(
    input: { competitionId: string; actorUserId?: string } & CompetitionActorAccess,
  ) {
    await this.assertCompetitionAdminAccess(input);
    const items = await this.competitionRepository.listStagePackagePlans({
      competitionId: input.competitionId,
    });

    return buildListResponse(items, {
      total: items.length,
      limit: items.length,
      offset: 0,
    });
  }

  async getCompetitionDetail(input: {
    competitionId: string;
    actorUserId?: string;
    actorScope: CompetitionScope;
    actorActionScope?: {
      assignedStoreIds: string[];
    };
    actorRoleCodes?: string[];
    includeStoreDetails?: boolean;
  }): Promise<CompetitionDetail> {
    const readScope = resolveCompetitionReadScope(input);
    const detail = await this.competitionRepository.getCompetitionDetail({
      competitionId: input.competitionId,
      companyIds: readScope.companyIds,
      regionIds: readScope.regionIds,
      storeIds: readScope.storeIds,
      actorUserId: input.actorUserId,
    });

    if (!detail) {
      throw new BadRequestException("Competition not found or outside read scope");
    }

    const storeContributions =
      await this.competitionRepository.listStoreContributionsForCompetition({
        competitionId: input.competitionId,
        companyIds: readScope.companyIds,
        regionIds: readScope.regionIds,
        storeIds: readScope.storeIds,
      });

    const teams = input.includeStoreDetails
      ? detail.teams.map((team) => ({
          ...team,
          stores: team.stores.filter((store) =>
            isStoreVisibleToScope(store, readScope),
          ),
        }))
      : detail.teams;

    if (input.includeStoreDetails) {
      return {
        ...detail,
        teams,
        storeContributions,
      };
    }

    return {
      ...detail,
      storeContributions,
    };
  }

  async createCompetition(input: CreateCompetitionInput) {
    if (input.endsOn < input.startsOn) {
      throw new BadRequestException("Competition end date must be on or after start date");
    }

    const competition = await this.competitionRepository.createCompetition({
      ...input,
      ownerUserId: input.actorUserId,
    });

    return buildCommandResponse({
      status: "created",
      message: "Competition draft created",
      data: { competition },
    });
  }

  async createTeamTemplate(input: CreateCompetitionTeamTemplateInput) {
    const uniqueStoreIds = [...new Set(input.storeIds)];

    if (uniqueStoreIds.length === 0) {
      throw new BadRequestException("Team template must include at least one store");
    }

    await this.assertStoresWithinAdminScope({
      ...input,
      storeIds: uniqueStoreIds,
    });

    const template = await this.competitionRepository.createTeamTemplate({
      ...input,
      storeIds: uniqueStoreIds,
    });

    return buildCommandResponse({
      status: "created",
      message: "Competition team template created",
      data: { template },
    });
  }

  async deactivateTeamTemplate(input: DeactivateCompetitionTeamTemplateInput) {
    await this.assertTeamTemplateAdminAccess(input);
    const template = await this.competitionRepository.deactivateTeamTemplate(input);

    return buildCommandResponse({
      status: "deactivated",
      message: "Competition team template deactivated",
      data: { template },
    });
  }

  async updateTeamTemplate(input: UpdateCompetitionTeamTemplateInput) {
    const uniqueStoreIds = [...new Set(input.storeIds)];

    if (uniqueStoreIds.length === 0) {
      throw new BadRequestException("Team template must include at least one store");
    }

    await this.assertTeamTemplateAdminAccess(input);
    await this.assertStoresWithinAdminScope({
      ...input,
      storeIds: uniqueStoreIds,
    });

    const template = await this.competitionRepository.updateTeamTemplate({
      ...input,
      storeIds: uniqueStoreIds,
    });

    return buildCommandResponse({
      status: "updated",
      message: "Competition team template updated",
      data: { template },
    });
  }

  async cloneTeamTemplate(input: CloneCompetitionTeamTemplateInput) {
    await this.assertTeamTemplateAdminAccess({
      ...input,
      templateId: input.sourceTemplateId,
    });
    const template = await this.competitionRepository.cloneTeamTemplate(input);

    return buildCommandResponse({
      status: "created",
      message: "Competition team template cloned",
      data: { template },
    });
  }

  async createStage(input: CreateCompetitionStageInput) {
    assertValidStageDraft(input);
    await this.assertCompetitionAdminAccess(input);
    await this.assertStageDraftsWithinAdminScope(input);

    const stage = await this.competitionRepository.createStageWithTeams(input);

    return buildCommandResponse({
      status: "created",
      message: "Competition stage created",
      data: { stage },
    });
  }

  async createStagePackage(input: CreateCompetitionStagePackageInput) {
    assertValidStagePackageDraft(input);
    await this.assertCompetitionAdminAccess(input);
    await this.assertStageDraftsWithinAdminScope(input);

    const stages = await this.competitionRepository.createStagePackage(input);

    return buildCommandResponse({
      status: "created",
      message: "Competition stage package created",
      data: { stages },
    });
  }

  async createStagePackagePlan(input: CreateCompetitionStagePackagePlanInput) {
    assertValidStagePackageDraft(input);
    await this.assertCompetitionAdminAccess(input);
    await this.assertStageDraftsWithinAdminScope(input);

    const plan = await this.competitionRepository.createStagePackagePlan(input);

    return buildCommandResponse({
      status: "created",
      message: "Competition stage package plan saved",
      data: { plan },
    });
  }

  async updateStagePackagePlan(input: UpdateCompetitionStagePackagePlanInput) {
    assertValidStagePackageDraft(input);
    await this.assertStagePackagePlanAdminAccess(input);
    await this.assertStageDraftsWithinAdminScope(input);

    const plan = await this.competitionRepository.updateStagePackagePlan(input);

    return buildCommandResponse({
      status: "updated",
      message: "Competition stage package plan updated",
      data: { plan },
    });
  }

  async submitStagePackagePlan(input: SubmitCompetitionStagePackagePlanInput) {
    await this.assertStagePackagePlanAdminAccess(input);
    const plan = await this.competitionRepository.submitStagePackagePlan(input);

    return buildCommandResponse({
      status: "submitted",
      message: "Competition stage package plan submitted for review",
      data: { plan },
    });
  }

  async approveStagePackagePlan(input: ApproveCompetitionStagePackagePlanInput) {
    await this.assertStagePackagePlanAdminAccess(input);
    const plan = await this.competitionRepository.approveStagePackagePlan(input);

    return buildCommandResponse({
      status: "approved",
      message: "Competition stage package plan approved",
      data: { plan },
    });
  }

  async rejectStagePackagePlan(input: RejectCompetitionStagePackagePlanInput) {
    await this.assertStagePackagePlanAdminAccess(input);
    const plan = await this.competitionRepository.rejectStagePackagePlan(input);

    return buildCommandResponse({
      status: "rejected",
      message: "Competition stage package plan rejected",
      data: { plan },
    });
  }

  async cloneStagePackagePlan(input: CloneCompetitionStagePackagePlanInput) {
    await this.assertStagePackagePlanAdminAccess({
      ...input,
      planId: input.sourcePlanId,
    });
    const plan = await this.competitionRepository.cloneStagePackagePlan(input);

    return buildCommandResponse({
      status: "created",
      message: "Competition stage package plan cloned as draft",
      data: { plan },
    });
  }

  async executeStagePackagePlan(input: ExecuteCompetitionStagePackagePlanInput) {
    await this.assertStagePackagePlanAdminAccess(input);
    const result = await this.competitionRepository.executeStagePackagePlan(input);

    return buildCommandResponse({
      status: "executed",
      message: "Competition stage package plan executed",
      data: result,
    });
  }

  async cancelStagePackagePlan(input: CancelCompetitionStagePackagePlanInput) {
    await this.assertStagePackagePlanAdminAccess(input);
    const plan = await this.competitionRepository.cancelStagePackagePlan(input);

    return buildCommandResponse({
      status: "cancelled",
      message: "Competition stage package plan cancelled",
      data: { plan },
    });
  }

  async listStagePackagePlanAudit(
    input: { planId: string; actorUserId?: string } & CompetitionActorAccess,
  ) {
    await this.assertStagePackagePlanAdminAccess(input);
    const items = await this.competitionRepository.listStagePackagePlanAudit({
      planId: input.planId,
    });

    return buildListResponse(items, {
      total: items.length,
      limit: items.length,
      offset: 0,
    });
  }

  async recalculateStage(input: RecalculateCompetitionStageInput) {
    await this.assertStageAdminAccess(input);
    const result = await this.competitionRepository.recalculateStage(input);

    return buildCommandResponse({
      status: "recalculated",
      message: "Competition stage scores recalculated from closed store facts",
      data: result,
    });
  }

  async finalizeStage(input: FinalizeCompetitionStageInput) {
    await this.assertStageAdminAccess(input);
    const warnings = await this.competitionRepository.listOpenWarnings(input.stageId);
    const hasWarnings = warnings.length > 0;
    const trimmedJustification = input.overrideJustification?.trim() ?? "";

    if (hasWarnings && (!input.allowOverride || trimmedJustification.length < 12)) {
      throw new BadRequestException(
        "Finalization with open warnings requires a written override justification",
      );
    }

    const finalizationState = hasWarnings ? "overridden" : "clean";
    const stage = await this.competitionRepository.finalizeStage({
      stageId: input.stageId,
      actorUserId: input.actorUserId,
      finalizationState,
      finalizationNote: hasWarnings ? trimmedJustification : null,
      unresolvedWarningCount: warnings.length,
    });

    return buildCommandResponse({
      status: "finalized",
      message: hasWarnings
        ? "Competition stage finalized with audited override"
        : "Competition stage finalized cleanly",
      data: { stage, unresolvedWarnings: warnings },
    });
  }

  private shouldEnforceAdminScope(input: CompetitionActorAccess) {
    return Boolean(input.actorRoleCodes?.length) &&
      !input.actorRoleCodes?.includes("SUPER_ADMIN");
  }

  private async assertCompetitionAdminAccess(input: {
    competitionId: string;
    actorUserId?: string;
  } & CompetitionActorAccess) {
    if (!this.shouldEnforceAdminScope(input)) {
      return;
    }

    const context = await this.competitionRepository.getCompetitionAccessContext(
      input.competitionId,
    );

    if (!context) {
      throw new BadRequestException("Competition not found");
    }

    if (context.stores.length === 0) {
      if (!input.actorUserId || context.ownerUserId !== input.actorUserId) {
        throw new ForbiddenException("Competition is outside actor company scope");
      }

      return;
    }

    this.assertStoreContextsWithinAdminScope(input, context.stores);
  }

  private async assertStageAdminAccess(input: {
    stageId: string;
    actorUserId?: string;
  } & CompetitionActorAccess) {
    if (!this.shouldEnforceAdminScope(input)) {
      return;
    }

    const competitionId = await this.competitionRepository.getCompetitionIdForStage(
      input.stageId,
    );

    if (!competitionId) {
      throw new BadRequestException("Competition stage not found");
    }

    await this.assertCompetitionAdminAccess({
      ...input,
      competitionId,
    });
  }

  private async assertTeamTemplateAdminAccess(input: {
    templateId: string;
  } & CompetitionActorAccess) {
    if (!this.shouldEnforceAdminScope(input)) {
      return;
    }

    const context = await this.competitionRepository.getTeamTemplateAccessContext(
      input.templateId,
    );

    if (!context) {
      throw new BadRequestException("Competition team template not found");
    }

    if (context.stores.length === 0) {
      throw new ForbiddenException("Competition team template is outside actor company scope");
    }

    this.assertStoreContextsWithinAdminScope(input, context.stores);
  }

  private async assertStagePackagePlanAdminAccess(input: {
    planId: string;
    actorUserId?: string;
  } & CompetitionActorAccess) {
    if (!this.shouldEnforceAdminScope(input)) {
      return;
    }

    const plan = await this.competitionRepository.getStagePackagePlanForAccess(
      input.planId,
    );

    if (!plan) {
      throw new BadRequestException("Stage package plan not found");
    }

    await this.assertCompetitionAdminAccess({
      ...input,
      competitionId: plan.competitionId,
    });
    await this.assertStoresWithinAdminScope({
      ...input,
      storeIds: collectStageDraftStoreIds(plan.stageDrafts),
    });
  }

  private async assertStageDraftsWithinAdminScope(input: (
    | Pick<CreateCompetitionStageInput, "teams">
    | Pick<CreateCompetitionStagePackageInput, "stages">
  ) & CompetitionActorAccess) {
    await this.assertStoresWithinAdminScope({
      ...input,
      storeIds: "stages" in input
        ? collectStageDraftStoreIds(input.stages)
        : input.teams.flatMap((team) => team.storeIds),
    });
  }

  private async assertStoresWithinAdminScope(input: {
    storeIds: string[];
  } & CompetitionActorAccess) {
    if (!this.shouldEnforceAdminScope(input)) {
      return;
    }

    const uniqueStoreIds = [...new Set(input.storeIds)];

    if (uniqueStoreIds.length === 0) {
      return;
    }

    const stores = await this.competitionRepository.listStoreAccessContexts(
      uniqueStoreIds,
    );

    if (stores.length !== uniqueStoreIds.length) {
      throw new BadRequestException("Competition store scope contains an unknown store");
    }

    this.assertStoreContextsWithinAdminScope(input, stores);
  }

  private assertStoreContextsWithinAdminScope(
    input: CompetitionActorAccess,
    stores: Array<{ companyId: string; regionId: string; storeId: string }>,
  ) {
    const scope = input.actorScope ?? { companyIds: [], regionIds: [], storeIds: [] };
    const hasOutOfScopeStore = stores.some(
      (store) => !isStoreVisibleToScope(store, scope),
    );

    if (hasOutOfScopeStore) {
      throw new ForbiddenException("Competition store selection is outside actor company scope");
    }
  }
}

function isStoreVisibleToScope(
  store: { storeId: string; companyId: string; regionId: string },
  scope: CompetitionScope,
) {
  return (
    scope.companyIds.includes(store.companyId) ||
    scope.storeIds.includes(store.storeId) ||
    scope.regionIds.includes(store.regionId)
  );
}

function collectStageDraftStoreIds(
  stages: Array<{ teams: Array<{ storeIds: string[] }> }>,
) {
  return stages.flatMap((stage) =>
    stage.teams.flatMap((team) => team.storeIds),
  );
}

function resolveCompetitionReadScope(input: {
  actorScope: CompetitionScope;
  actorActionScope?: {
    assignedStoreIds: string[];
  };
  actorRoleCodes?: string[];
}): CompetitionScope {
  const canUseBroadReadScope = (input.actorRoleCodes ?? []).some((roleCode) =>
    ["HR_ADMIN", "REGION_MANAGER", "REPORT_VIEWER", "SUPER_ADMIN"].includes(roleCode),
  );
  const storeIds = input.actorActionScope?.assignedStoreIds.length
    ? input.actorActionScope.assignedStoreIds
    : input.actorScope.storeIds;

  if (!canUseBroadReadScope) {
    return {
      companyIds: [],
      regionIds: [],
      storeIds,
    };
  }

  return input.actorScope;
}

function assertValidStagePackageDraft(input: Pick<CreateCompetitionStagePackageInput, "stages">) {
  if (input.stages.length < 2) {
    throw new BadRequestException("Stage package must include at least two stages");
  }

  const stageCodes = input.stages.map((stage) => stage.stageCode);
  const uniqueStageCodes = new Set(stageCodes);

  if (uniqueStageCodes.size !== stageCodes.length) {
    throw new BadRequestException("Stage package must not include duplicate stage codes");
  }

  for (const stage of input.stages) {
    assertValidStageDraft(stage);
  }
}

function assertValidStageDraft(input: Pick<CreateCompetitionStageInput, "startsOn" | "endsOn" | "teams">) {
  if (input.endsOn < input.startsOn) {
    throw new BadRequestException("Stage end date must be on or after start date");
  }

  if (input.teams.length < 2) {
    throw new BadRequestException("At least two teams are required for a competition stage");
  }

  for (const team of input.teams) {
    if (team.storeIds.length === 0) {
      throw new BadRequestException(`Team ${team.teamCode} must include at least one store`);
    }
  }
}
