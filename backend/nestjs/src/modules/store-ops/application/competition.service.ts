import { BadRequestException, Injectable } from "@nestjs/common";
import { buildCommandResponse, buildListResponse } from "../../../shared/http/response-builders";
import { CompetitionRepository } from "../infrastructure/competition.repository";
import {
  CompetitionDetail,
  CompetitionScope,
  CloneCompetitionTeamTemplateInput,
  CreateCompetitionInput,
  CreateCompetitionStagePackageInput,
  CreateCompetitionStagePackagePlanInput,
  CreateCompetitionStageInput,
  CreateCompetitionTeamTemplateInput,
  DeactivateCompetitionTeamTemplateInput,
  ExecuteCompetitionStagePackagePlanInput,
  FinalizeCompetitionStageInput,
  RecalculateCompetitionStageInput,
  UpdateCompetitionTeamTemplateInput,
} from "./competition.contract";

@Injectable()
export class CompetitionService {
  constructor(private readonly competitionRepository: CompetitionRepository) {}

  async listCompetitions(input: {
    actorScope: CompetitionScope;
    limit?: number;
    offset?: number;
  }) {
    const limit = input.limit ?? 50;
    const offset = input.offset ?? 0;
    const items = await this.competitionRepository.listCompetitions({
      companyIds: input.actorScope.companyIds,
      regionIds: input.actorScope.regionIds,
      storeIds: input.actorScope.storeIds,
      limit,
      offset,
    });

    return buildListResponse(items, {
      total: items.length,
      limit,
      offset,
    });
  }

  async listTeamTemplates(input: { activeOnly?: boolean } = {}) {
    const items = await this.competitionRepository.listTeamTemplates({
      activeOnly: input.activeOnly ?? true,
    });

    return buildListResponse(items, {
      total: items.length,
      limit: items.length,
      offset: 0,
    });
  }

  async listStagePackagePlans(input: { competitionId: string }) {
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
    actorScope: CompetitionScope;
    includeStoreDetails?: boolean;
  }): Promise<CompetitionDetail> {
    const detail = await this.competitionRepository.getCompetitionDetail({
      competitionId: input.competitionId,
      companyIds: input.actorScope.companyIds,
      regionIds: input.actorScope.regionIds,
      storeIds: input.actorScope.storeIds,
    });

    if (!detail) {
      throw new BadRequestException("Competition not found or outside read scope");
    }

    const storeContributions =
      await this.competitionRepository.listStoreContributionsForCompetition({
        competitionId: input.competitionId,
        companyIds: input.actorScope.companyIds,
        regionIds: input.actorScope.regionIds,
        storeIds: input.actorScope.storeIds,
      });

    const teams = input.includeStoreDetails
      ? detail.teams.map((team) => ({
          ...team,
          stores: team.stores.filter((store) =>
            isStoreVisibleToScope(store, input.actorScope),
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
    const template = await this.competitionRepository.cloneTeamTemplate(input);

    return buildCommandResponse({
      status: "created",
      message: "Competition team template cloned",
      data: { template },
    });
  }

  async createStage(input: CreateCompetitionStageInput) {
    assertValidStageDraft(input);

    const stage = await this.competitionRepository.createStageWithTeams(input);

    return buildCommandResponse({
      status: "created",
      message: "Competition stage created",
      data: { stage },
    });
  }

  async createStagePackage(input: CreateCompetitionStagePackageInput) {
    assertValidStagePackageDraft(input);

    const stages = await this.competitionRepository.createStagePackage(input);

    return buildCommandResponse({
      status: "created",
      message: "Competition stage package created",
      data: { stages },
    });
  }

  async createStagePackagePlan(input: CreateCompetitionStagePackagePlanInput) {
    assertValidStagePackageDraft(input);

    const plan = await this.competitionRepository.createStagePackagePlan(input);

    return buildCommandResponse({
      status: "created",
      message: "Competition stage package plan saved",
      data: { plan },
    });
  }

  async executeStagePackagePlan(input: ExecuteCompetitionStagePackagePlanInput) {
    const result = await this.competitionRepository.executeStagePackagePlan(input);

    return buildCommandResponse({
      status: "executed",
      message: "Competition stage package plan executed",
      data: result,
    });
  }

  async recalculateStage(input: RecalculateCompetitionStageInput) {
    const result = await this.competitionRepository.recalculateStage(input);

    return buildCommandResponse({
      status: "recalculated",
      message: "Competition stage scores recalculated from closed store facts",
      data: result,
    });
  }

  async finalizeStage(input: FinalizeCompetitionStageInput) {
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
}

function isStoreVisibleToScope(
  store: { storeId: string; regionId: string },
  scope: CompetitionScope,
) {
  return (
    scope.companyIds.length > 0 ||
    scope.storeIds.includes(store.storeId) ||
    scope.regionIds.includes(store.regionId)
  );
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
