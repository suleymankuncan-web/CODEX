import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import { CompetitionService } from "../application/competition.service";
import { CreateCompetitionDto } from "./dto/create-competition.dto";
import { CreateCompetitionStageDto } from "./dto/create-competition-stage.dto";
import { CreateCompetitionTeamTemplateDto } from "./dto/create-competition-team-template.dto";
import { FinalizeCompetitionStageDto } from "./dto/finalize-competition-stage.dto";
import { ListCompetitionsQueryDto } from "./dto/list-competitions.query";

type CompetitionRequest = {
  user: {
    userId: string;
    scope: {
      companyIds: string[];
      regionIds: string[];
      storeIds: string[];
    };
  };
};

@Controller("competitions")
export class CompetitionController {
  constructor(private readonly competitionService: CompetitionService) {}

  @Get()
  @RequireRoles(
    "SUPER_ADMIN",
    "HR_ADMIN",
    "REPORT_VIEWER",
    "REGION_MANAGER",
    "STORE_MANAGER",
    "STORE_PERSONNEL",
  )
  async listCompetitions(
    @Req() request: CompetitionRequest,
    @Query() query: ListCompetitionsQueryDto,
  ) {
    return this.competitionService.listCompetitions({
      actorScope: request.user.scope,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Get("team-templates")
  @RequireRoles("SUPER_ADMIN", "HR_ADMIN")
  async listTeamTemplates() {
    return this.competitionService.listTeamTemplates();
  }

  @Get(":competitionId")
  @RequireRoles(
    "SUPER_ADMIN",
    "HR_ADMIN",
    "REPORT_VIEWER",
    "REGION_MANAGER",
    "STORE_MANAGER",
    "STORE_PERSONNEL",
  )
  async getCompetition(
    @Req() request: CompetitionRequest,
    @Param("competitionId") competitionId: string,
  ) {
    return this.competitionService.getCompetitionDetail({
      competitionId,
      actorScope: request.user.scope,
      includeStoreDetails: true,
    });
  }

  @Post()
  @RequireRoles("SUPER_ADMIN", "HR_ADMIN")
  async createCompetition(
    @Req() request: CompetitionRequest,
    @Body() body: CreateCompetitionDto,
  ) {
    return this.competitionService.createCompetition({
      actorUserId: request.user.userId,
      ...body,
    });
  }

  @Post("team-templates")
  @RequireRoles("SUPER_ADMIN", "HR_ADMIN")
  async createTeamTemplate(
    @Req() request: CompetitionRequest,
    @Body() body: CreateCompetitionTeamTemplateDto,
  ) {
    return this.competitionService.createTeamTemplate({
      actorUserId: request.user.userId,
      ...body,
    });
  }

  @Post(":competitionId/stages")
  @RequireRoles("SUPER_ADMIN", "HR_ADMIN")
  async createStage(
    @Req() request: CompetitionRequest,
    @Param("competitionId") competitionId: string,
    @Body() body: CreateCompetitionStageDto,
  ) {
    return this.competitionService.createStage({
      actorUserId: request.user.userId,
      competitionId,
      ...body,
    });
  }

  @Post("stages/:stageId/recalculate")
  @RequireRoles("SUPER_ADMIN", "HR_ADMIN")
  async recalculateStage(
    @Req() request: CompetitionRequest,
    @Param("stageId") stageId: string,
  ) {
    return this.competitionService.recalculateStage({
      actorUserId: request.user.userId,
      stageId,
    });
  }

  @Patch("stages/:stageId/finalize")
  @RequireRoles("SUPER_ADMIN", "HR_ADMIN")
  async finalizeStage(
    @Req() request: CompetitionRequest,
    @Param("stageId") stageId: string,
    @Body() body: FinalizeCompetitionStageDto,
  ) {
    return this.competitionService.finalizeStage({
      actorUserId: request.user.userId,
      stageId,
      allowOverride: body.allowOverride,
      overrideJustification: body.overrideJustification,
    });
  }
}
