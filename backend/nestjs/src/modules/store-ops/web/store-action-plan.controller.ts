import { BadRequestException, Body, Controller, Get, Header, Param, Patch, Post, Query, Req, StreamableFile, UploadedFile, UseInterceptors, ParseFilePipeBuilder, ParseEnumPipe } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { AuthenticatedUser } from "../../auth/auth-context.service";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import { RequireActionScope, RequireScope } from "../../auth/decorators/scope.decorator";
import { StoreActionPlanService } from "../application/store-action-plan.service";
import { resolveReportViewerCompanyScope } from "../application/report-viewer-company-scope";
import { CancelStoreActionPlanDto } from "./dto/cancel-store-action-plan.dto";
import { CloseStoreActionPlanDto } from "./dto/close-store-action-plan.dto";
import { CreateStoreActionPlanDto } from "./dto/create-store-action-plan.dto";
import { ListStoreActionPlansQueryDto } from "./dto/list-store-action-plans.query";
import { UpdateStoreActionPlanStatusDto } from "./dto/update-store-action-plan-status.dto";
import { SubmitStoreActionSolutionDto } from "./dto/submit-store-action-solution.dto";
import { ReviewStoreActionSolutionDto } from "./dto/review-store-action-solution.dto";
import { StoreActionPhotoReviewService } from "../application/store-action-photo-review.service";
import { PhotoMediaUploadBufferGuardInterceptor } from "./photo-media-upload-buffer-guard.interceptor";

type StoreActionPlanRequest = {
  user: AuthenticatedUser;
};

@Controller("store-actions")
export class StoreActionPlanController {
  constructor(
    private readonly storeActionPlanService: StoreActionPlanService,
    private readonly photoReviewService: StoreActionPhotoReviewService,
  ) {}

  @Get("plans/:actionPlanId/photo-review")
  @RequireScope("authenticated")
  @RequireRoles("STORE_MANAGER", "REGION_MANAGER")
  getPhotoReview(@Req() request: StoreActionPlanRequest, @Param("actionPlanId") actionPlanId: string) {
    return this.photoReviewService.get({ ...actorInput(request.user), actionPlanId });
  }

  @Get("plans/:actionPlanId/evidence/:mediaAssetId/content/:variant")
  @Header("Cache-Control", "private, no-store")
  @RequireScope("authenticated")
  @RequireRoles("STORE_MANAGER", "REGION_MANAGER")
  async readSolutionEvidence(@Req() request: StoreActionPlanRequest,
    @Param("actionPlanId") actionPlanId: string, @Param("mediaAssetId") mediaAssetId: string,
    @Param("variant", new ParseEnumPipe(["canonical", "thumbnail"])) variant: "canonical" | "thumbnail") {
    const content = await this.photoReviewService.readContent({
      ...actorInput(request.user), actionPlanId, mediaAssetId, variant,
    });
    return new StreamableFile(content.body, { type: content.contentType });
  }

  @Post("plans/:actionPlanId/solution/uploads")
  @RequireScope("authenticated")
  @RequireRoles("STORE_MANAGER")
  @UseInterceptors(new PhotoMediaUploadBufferGuardInterceptor(), FileInterceptor("file", {
    limits: { fileSize: 15 * 1024 * 1024, files: 1, fields: 0 },
  }))
  uploadSolution(
    @Req() request: StoreActionPlanRequest,
    @Param("actionPlanId") actionPlanId: string,
    @UploadedFile(new ParseFilePipeBuilder()
      .addFileTypeValidator({ fileType: /^(image\/jpeg|image\/png|image\/webp)$/ })
      .addMaxSizeValidator({ maxSize: 15 * 1024 * 1024 })
      .build({ fileIsRequired: true })) file: { buffer: Buffer; mimetype: string; size: number },
  ) {
    return this.photoReviewService.upload({ ...actorInput(request.user), actionPlanId,
      contentType: file.mimetype, contentLength: file.size, contentBody: file.buffer });
  }

  @Post("plans/:actionPlanId/solution/uploads/:mediaAssetId/finalize")
  @RequireScope("authenticated")
  @RequireRoles("STORE_MANAGER")
  finalizeSolution(@Req() request: StoreActionPlanRequest, @Param("actionPlanId") actionPlanId: string,
    @Param("mediaAssetId") mediaAssetId: string) {
    return this.photoReviewService.finalize({ ...actorInput(request.user), actionPlanId, mediaAssetId });
  }

  @Post("plans/:actionPlanId/solution-attempts")
  @RequireScope("authenticated")
  @RequireRoles("STORE_MANAGER")
  submitSolution(@Req() request: StoreActionPlanRequest, @Param("actionPlanId") actionPlanId: string,
    @Body() body: SubmitStoreActionSolutionDto) {
    return this.photoReviewService.submit({ ...actorInput(request.user), actionPlanId, ...body });
  }

  @Post("plans/:actionPlanId/solution-attempts/:solutionAttemptId/review")
  @RequireScope("authenticated")
  @RequireRoles("REGION_MANAGER")
  reviewSolution(@Req() request: StoreActionPlanRequest, @Param("actionPlanId") actionPlanId: string,
    @Param("solutionAttemptId") solutionAttemptId: string, @Body() body: ReviewStoreActionSolutionDto) {
    if (body.solutionAttemptId !== solutionAttemptId) {
      throw new BadRequestException("Solution attempt path and body identities do not match");
    }
    return this.photoReviewService.review({ ...actorInput(request.user), actionPlanId, ...body });
  }

  @Get("plans")
  @RequireScope("authenticated")
  @RequireRoles("STORE_MANAGER", "SUPER_ADMIN", "REGION_MANAGER", "REPORT_VIEWER")
  async listPlans(
    @Req() request: StoreActionPlanRequest,
    @Query() query: ListStoreActionPlansQueryDto,
  ) {
    const actorReadScope = request.user.roleCodes.includes("REPORT_VIEWER")
      ? resolveReportViewerCompanyScope({
          actorRoleCodes: request.user.roleCodes,
          actorScope: request.user.scope,
          roleScopes: request.user.roleScopes,
        })
      : undefined;

    return this.storeActionPlanService.listPlans({
      actorActionScope: request.user.actionScope,
      ...(actorReadScope
        ? { actorReadScope, actorRoleCodes: request.user.roleCodes }
        : {}),
      storeId: query.storeId,
      status: query.status,
      statuses: query.statuses,
      periodStart: query.periodStart,
      periodEnd: query.periodEnd,
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Get("plans/:actionPlanId")
  @RequireScope("authenticated")
  @RequireRoles("STORE_MANAGER", "SUPER_ADMIN", "REGION_MANAGER", "REPORT_VIEWER")
  async getPlan(
    @Req() request: StoreActionPlanRequest,
    @Param("actionPlanId") actionPlanId: string,
  ) {
    const actorReadScope = request.user.roleCodes.includes("REPORT_VIEWER")
      ? resolveReportViewerCompanyScope({
          actorRoleCodes: request.user.roleCodes,
          actorScope: request.user.scope,
          roleScopes: request.user.roleScopes,
        })
      : undefined;

    return this.storeActionPlanService.getPlan({
      actorActionScope: request.user.actionScope,
      ...(actorReadScope
        ? { actorReadScope, actorRoleCodes: request.user.roleCodes }
        : {}),
      actionPlanId,
    });
  }

  @Post("plans")
  @RequireScope("authenticated")
  @RequireActionScope("store")
  @RequireRoles("STORE_MANAGER", "SUPER_ADMIN")
  async createPlan(
    @Req() request: StoreActionPlanRequest,
    @Body() body: CreateStoreActionPlanDto,
  ) {
    return this.storeActionPlanService.createPlan({
      actorUserId: request.user.userId,
      actorDisplayName: request.user.displayName ?? "Operasyon kullanıcısı",
      actorRoleLabel: actorRoleLabel(request.user.roleCodes),
      actorScope: request.user.scope,
      actorActionScope: request.user.actionScope,
      ...body,
    });
  }

  @Patch("plans/:actionPlanId/status")
  @RequireScope("authenticated")
  @RequireRoles("STORE_MANAGER", "SUPER_ADMIN")
  async updateStatus(
    @Req() request: StoreActionPlanRequest,
    @Param("actionPlanId") actionPlanId: string,
    @Body() body: UpdateStoreActionPlanStatusDto,
  ) {
    return this.storeActionPlanService.updateStatus({
      actorUserId: request.user.userId,
      actorDisplayName: request.user.displayName ?? "Operasyon kullanıcısı",
      actorRoleLabel: actorRoleLabel(request.user.roleCodes),
      actorActionScope: request.user.actionScope,
      actionPlanId,
      status: body.status,
      note: body.note,
    });
  }

  @Patch("plans/:actionPlanId/close")
  @RequireScope("authenticated")
  @RequireRoles("STORE_MANAGER", "SUPER_ADMIN")
  async closePlan(
    @Req() request: StoreActionPlanRequest,
    @Param("actionPlanId") actionPlanId: string,
    @Body() body: CloseStoreActionPlanDto,
  ) {
    return this.storeActionPlanService.closePlan({
      actorUserId: request.user.userId,
      actorDisplayName: request.user.displayName ?? "Operasyon kullanıcısı",
      actorRoleLabel: actorRoleLabel(request.user.roleCodes),
      actorActionScope: request.user.actionScope,
      actionPlanId,
      resolutionNote: body.resolutionNote,
    });
  }

  @Patch("plans/:actionPlanId/cancel")
  @RequireScope("authenticated")
  @RequireRoles("STORE_MANAGER", "SUPER_ADMIN")
  async cancelPlan(
    @Req() request: StoreActionPlanRequest,
    @Param("actionPlanId") actionPlanId: string,
    @Body() body: CancelStoreActionPlanDto,
  ) {
    return this.storeActionPlanService.cancelPlan({
      actorUserId: request.user.userId,
      actorDisplayName: request.user.displayName ?? "Operasyon kullanıcısı",
      actorRoleLabel: actorRoleLabel(request.user.roleCodes),
      actorActionScope: request.user.actionScope,
      actionPlanId,
      cancelReason: body.cancelReason,
    });
  }
}

function actorRoleLabel(roleCodes: readonly string[]) {
  const labels = roleCodes.flatMap((roleCode) => {
    if (roleCode === "STORE_MANAGER") return ["Mağaza Müdürü"];
    if (roleCode === "REGION_MANAGER") return ["Bölge Müdürü"];
    if (roleCode === "SUPER_ADMIN") return ["Sistem Yöneticisi"];
    return [];
  });
  return labels.length > 0 ? labels.join(", ") : "Operasyon kullanıcısı";
}

function actorInput(user: AuthenticatedUser) {
  return {
    actorUserId: user.userId,
    actorRoleCodes: user.roleCodes,
    actorScope: user.scope,
    actorActionScope: user.actionScope,
    actorRoleScopes: user.roleScopes,
    actorDisplayName: user.displayName ?? "Operasyon kullanıcısı",
    actorRoleLabel: actorRoleLabel(user.roleCodes),
  };
}
