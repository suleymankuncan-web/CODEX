import { Body, Controller, Get, Param, Patch, Post, Put, Query, Req } from "@nestjs/common";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import { CompetitionService } from "../application/competition.service";
import { CloneCompetitionTeamTemplateDto } from "./dto/clone-competition-team-template.dto";
import { CreateCompetitionDto } from "./dto/create-competition.dto";
import { CreateCompetitionStageDto } from "./dto/create-competition-stage.dto";
import { CreateCompetitionStagePackageDto } from "./dto/create-competition-stage-package.dto";
import { CreateCompetitionStagePackagePlanDto } from "./dto/create-competition-stage-package-plan.dto";
import { CreateCompetitionTeamTemplateDto } from "./dto/create-competition-team-template.dto";
import { FinalizeCompetitionStageDto } from "./dto/finalize-competition-stage.dto";
import { ListCompetitionTeamTemplatesQueryDto } from "./dto/list-competition-team-templates.query";
import { ListCompetitionsQueryDto } from "./dto/list-competitions.query";
import { ReviewCompetitionStagePackagePlanDto } from "./dto/review-competition-stage-package-plan.dto";
import { UpdateCompetitionStagePackagePlanDto } from "./dto/update-competition-stage-package-plan.dto";
import { UpdateCompetitionTeamTemplateDto } from "./dto/update-competition-team-template.dto";

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
  async listTeamTemplates(@Query() query: ListCompetitionTeamTemplatesQueryDto) {
    return this.competitionService.listTeamTemplates({
      activeOnly: query.activeOnly,
    });
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

  @Patch("team-templates/:templateId/deactivate")
  @RequireRoles("SUPER_ADMIN", "HR_ADMIN")
  async deactivateTeamTemplate(
    @Req() request: CompetitionRequest,
    @Param("templateId") templateId: string,
  ) {
    return this.competitionService.deactivateTeamTemplate({
      actorUserId: request.user.userId,
      templateId,
    });
  }

  @Put("team-templates/:templateId")
  @RequireRoles("SUPER_ADMIN", "HR_ADMIN")
  async updateTeamTemplate(
    @Req() request: CompetitionRequest,
    @Param("templateId") templateId: string,
    @Body() body: UpdateCompetitionTeamTemplateDto,
  ) {
    return this.competitionService.updateTeamTemplate({
      actorUserId: request.user.userId,
      templateId,
      ...body,
    });
  }

  @Post("team-templates/:templateId/clone")
  @RequireRoles("SUPER_ADMIN", "HR_ADMIN")
  async cloneTeamTemplate(
    @Req() request: CompetitionRequest,
    @Param("templateId") templateId: string,
    @Body() body: CloneCompetitionTeamTemplateDto,
  ) {
    return this.competitionService.cloneTeamTemplate({
      actorUserId: request.user.userId,
      sourceTemplateId: templateId,
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

  @Post(":competitionId/stage-packages")
  @RequireRoles("SUPER_ADMIN", "HR_ADMIN")
  async createStagePackage(
    @Req() request: CompetitionRequest,
    @Param("competitionId") competitionId: string,
    @Body() body: CreateCompetitionStagePackageDto,
  ) {
    return this.competitionService.createStagePackage({
      actorUserId: request.user.userId,
      competitionId,
      ...body,
    });
  }

  @Get(":competitionId/stage-package-plans")
  @RequireRoles("SUPER_ADMIN", "HR_ADMIN")
  async listStagePackagePlans(@Param("competitionId") competitionId: string) {
    return this.competitionService.listStagePackagePlans({
      competitionId,
    });
  }

  @Post(":competitionId/stage-package-plans")
  @RequireRoles("SUPER_ADMIN", "HR_ADMIN")
  async createStagePackagePlan(
    @Req() request: CompetitionRequest,
    @Param("competitionId") competitionId: string,
    @Body() body: CreateCompetitionStagePackagePlanDto,
  ) {
    return this.competitionService.createStagePackagePlan({
      actorUserId: request.user.userId,
      competitionId,
      ...body,
    });
  }

  @Put("stage-package-plans/:planId")
  @RequireRoles("SUPER_ADMIN", "HR_ADMIN")
  async updateStagePackagePlan(
    @Req() request: CompetitionRequest,
    @Param("planId") planId: string,
    @Body() body: UpdateCompetitionStagePackagePlanDto,
  ) {
    return this.competitionService.updateStagePackagePlan({
      actorUserId: request.user.userId,
      planId,
      ...body,
    });
  }

  @Post("stage-package-plans/:planId/execute")
  @RequireRoles("SUPER_ADMIN", "HR_ADMIN")
  async executeStagePackagePlan(
    @Req() request: CompetitionRequest,
    @Param("planId") planId: string,
  ) {
    return this.competitionService.executeStagePackagePlan({
      actorUserId: request.user.userId,
      planId,
    });
  }

  @Post("stage-package-plans/:planId/submit")
  @RequireRoles("SUPER_ADMIN", "HR_ADMIN")
  async submitStagePackagePlan(
    @Req() request: CompetitionRequest,
    @Param("planId") planId: string,
  ) {
    return this.competitionService.submitStagePackagePlan({
      actorUserId: request.user.userId,
      planId,
    });
  }

  @Post("stage-package-plans/:planId/approve")
  @RequireRoles("SUPER_ADMIN", "HR_ADMIN")
  async approveStagePackagePlan(
    @Req() request: CompetitionRequest,
    @Param("planId") planId: string,
    @Body() body: ReviewCompetitionStagePackagePlanDto,
  ) {
    return this.competitionService.approveStagePackagePlan({
      actorUserId: request.user.userId,
      planId,
      reviewNote: body.reviewNote,
    });
  }

  @Post("stage-package-plans/:planId/reject")
  @RequireRoles("SUPER_ADMIN", "HR_ADMIN")
  async rejectStagePackagePlan(
    @Req() request: CompetitionRequest,
    @Param("planId") planId: string,
    @Body() body: ReviewCompetitionStagePackagePlanDto,
  ) {
    return this.competitionService.rejectStagePackagePlan({
      actorUserId: request.user.userId,
      planId,
      reviewNote: body.reviewNote,
    });
  }

  @Patch("stage-package-plans/:planId/cancel")
  @RequireRoles("SUPER_ADMIN", "HR_ADMIN")
  async cancelStagePackagePlan(
    @Req() request: CompetitionRequest,
    @Param("planId") planId: string,
  ) {
    return this.competitionService.cancelStagePackagePlan({
      actorUserId: request.user.userId,
      planId,
    });
  }

  @Get("stage-package-plans/:planId/audit")
  @RequireRoles("SUPER_ADMIN", "HR_ADMIN")
  async listStagePackagePlanAudit(@Param("planId") planId: string) {
    return this.competitionService.listStagePackagePlanAudit({
      planId,
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
