import {
  Body, Controller, Get, Param, ParseFilePipeBuilder, Post, Query, Req,
  UploadedFile, UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { AuthenticatedUser } from "../../auth/auth-context.service";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import { RequireScope } from "../../auth/decorators/scope.decorator";
import { VmReferenceManagementService } from "../application/vm-reference-management.service";
import { PhotoMediaUploadBufferGuardInterceptor } from "./photo-media-upload-buffer-guard.interceptor";
import {
  ChangeVmAssignmentStateDto, CreateVmReferenceDraftDto, PublishVmReferenceDto,
  RetireVmReferenceDto, ReviseVmCampaignDto,
  UpsertVmReferenceItemDto, VmReferenceListQueryDto,
} from "./dto/vm-reference-management.dto";

type Request = { user: AuthenticatedUser };

@Controller("visual-merchandising/references")
@RequireScope("authenticated")
@RequireRoles("VISUAL_MERCHANDISER")
export class VmReferenceManagementController {
  constructor(private readonly service: VmReferenceManagementService) {}

  @Get()
  list(@Req() request: Request, @Query() query: VmReferenceListQueryDto) {
    return this.service.listPublisherReferences({ ...actor(request.user), ...query });
  }

  @Get("options")
  options(@Req() request: Request, @Query("companyId") companyId: string) {
    return this.service.listPublisherOptions({ ...actor(request.user), companyId });
  }

  @Get("campaigns")
  reviewerCampaigns(@Req() request: Request, @Query() query: VmReferenceListQueryDto) {
    return this.service.listReviewerCampaigns({ ...actor(request.user), ...query });
  }

  @Get("managed-campaigns")
  managedCampaigns(@Req() request: Request, @Query() query: VmReferenceListQueryDto) {
    return this.service.listPublisherCampaigns({ ...actor(request.user), ...query });
  }

  @Post()
  create(@Req() request: Request, @Body() body: CreateVmReferenceDraftDto) {
    return this.service.createDraft({ ...actor(request.user), ...body });
  }

  @Post(":referenceSetId/draft/items/:templateItemId")
  upsertItem(@Req() request: Request, @Param("referenceSetId") referenceSetId: string,
    @Param("templateItemId") templateItemId: string, @Body() body: UpsertVmReferenceItemDto) {
    return this.service.upsertDraftItem({ ...actor(request.user), ...body,
      referenceSetId, templateItemId });
  }

  @Post(":referenceSetId/draft/items/:draftItemId/uploads")
  @UseInterceptors(new PhotoMediaUploadBufferGuardInterceptor(), FileInterceptor("file", {
    limits: { fileSize: 15 * 1024 * 1024, files: 1, fields: 1 },
  }))
  upload(@Req() request: Request, @Param("referenceSetId") referenceSetId: string,
    @Param("draftItemId") draftItemId: string, @Query("companyId") companyId: string,
    @UploadedFile(new ParseFilePipeBuilder()
      .addFileTypeValidator({ fileType: /^(image\/jpeg|image\/png|image\/webp)$/ })
      .addMaxSizeValidator({ maxSize: 15 * 1024 * 1024 })
      .build({ fileIsRequired: true })) file: { buffer: Buffer; mimetype: string; size: number }) {
    return this.service.uploadReference({ ...actor(request.user), companyId,
      referenceSetId, draftItemId, contentType: file.mimetype,
      contentLength: file.size, contentBody: file.buffer });
  }

  @Post(":referenceSetId/draft/items/:draftItemId/uploads/:mediaAssetId/finalize")
  finalize(@Req() request: Request, @Param("referenceSetId") referenceSetId: string,
    @Param("draftItemId") draftItemId: string, @Param("mediaAssetId") mediaAssetId: string,
    @Query("companyId") companyId: string) {
    return this.service.finalizeReference({ ...actor(request.user), companyId,
      referenceSetId, draftItemId, mediaAssetId });
  }

  @Post(":referenceSetId/publish")
  publish(@Req() request: Request, @Param("referenceSetId") referenceSetId: string,
    @Body() body: PublishVmReferenceDto) {
    return this.service.publish({ ...actor(request.user), referenceSetId, ...body });
  }

  @Post(":referenceSetId/revisions")
  revise(@Req() request: Request, @Param("referenceSetId") referenceSetId: string,
    @Body() body: ReviseVmCampaignDto) {
    return this.service.reviseCampaign({ ...actor(request.user), referenceSetId, ...body });
  }

  @Post(":referenceSetId/assignments/:assignmentId/commands")
  changeAssignmentState(@Req() request: Request,
    @Param("referenceSetId") referenceSetId: string,
    @Param("assignmentId") assignmentId: string,
    @Body() body: ChangeVmAssignmentStateDto) {
    return this.service.changeAssignmentState({ ...actor(request.user), referenceSetId,
      assignmentId, ...body });
  }

  @Post(":referenceSetId/retire")
  retire(@Req() request: Request, @Param("referenceSetId") referenceSetId: string,
    @Body() body: RetireVmReferenceDto) {
    return this.service.retireReference({ ...actor(request.user), referenceSetId, ...body });
  }
}

function actor(user: AuthenticatedUser) {
  return {
    actorUserId: user.userId,
    actorRoleCodes: user.roleCodes,
    actorScope: user.scope,
    actorActionScope: user.actionScope,
    actorPermissionScopes: user.permissionScopes,
  };
}
