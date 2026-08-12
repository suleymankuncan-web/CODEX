import {
  Body, Controller, Get, Header, Param, ParseEnumPipe, ParseFilePipeBuilder, Post, Query, Req,
  StreamableFile, UploadedFile, UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { AuthenticatedUser } from "../../auth/auth-context.service";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import { RequireScope } from "../../auth/decorators/scope.decorator";
import { VmReferenceManagementService } from "../application/vm-reference-management.service";
import { PhotoMediaUploadBufferGuardInterceptor } from "./photo-media-upload-buffer-guard.interceptor";
import { PhotoMediaReadDto, VmCampaignPhotoUploadDto } from "./dto/photo-media-storage.dto";
import { SubmitVmCampaignDto, VmCampaignListQueryDto } from "./dto/vm-reference-management.dto";

type Request = { user: AuthenticatedUser };

@Controller("mobile/visual-campaigns")
@RequireScope("authenticated")
@RequireRoles("STORE_MANAGER")
export class VmCampaignController {
  constructor(private readonly service: VmReferenceManagementService) {}

  @Get()
  list(@Req() request: Request, @Query() query: VmCampaignListQueryDto) {
    return this.service.listStoreAssignments({ ...actor(request.user), ...query });
  }

  @Post(":assignmentId/items/:referenceItemId/uploads")
  @UseInterceptors(new PhotoMediaUploadBufferGuardInterceptor(), FileInterceptor("file", {
    limits: { fileSize: 15 * 1024 * 1024, files: 1, fields: 2 },
  }))
  upload(@Req() request: Request, @Param("assignmentId") assignmentId: string,
    @Param("referenceItemId") referenceItemId: string,
    @Body() body: VmCampaignPhotoUploadDto,
    @UploadedFile(new ParseFilePipeBuilder()
      .addFileTypeValidator({ fileType: /^(image\/jpeg|image\/png|image\/webp)$/ })
      .addMaxSizeValidator({ maxSize: 15 * 1024 * 1024 })
      .build({ fileIsRequired: true })) file: { buffer: Buffer; mimetype: string; size: number }) {
    return this.service.uploadCampaignEvidence({ ...actor(request.user), assignmentId,
      referenceItemId, contentType: file.mimetype, contentLength: file.size,
      contentBody: file.buffer, captureSource: body.captureSource,
      contentPolicyAttestation: body.contentPolicyAttestation });
  }

  @Post(":assignmentId/items/:referenceItemId/reference-read-url")
  readReference(@Req() request: Request, @Param("assignmentId") assignmentId: string,
    @Param("referenceItemId") referenceItemId: string, @Body() body: PhotoMediaReadDto) {
    return this.service.readStoreReference({ ...actor(request.user), assignmentId,
      referenceItemId, variant: body.variant });
  }

  @Get(":assignmentId/items/:referenceItemId/reference-content/:variant")
  @Header("Cache-Control", "private, no-store")
  async readReferenceContent(@Req() request: Request,
    @Param("assignmentId") assignmentId: string,
    @Param("referenceItemId") referenceItemId: string,
    @Param("variant", new ParseEnumPipe({ canonical: "canonical", thumbnail: "thumbnail" }))
    variant: "canonical" | "thumbnail") {
    const content = await this.service.readStoreReferenceContent({ ...actor(request.user),
      assignmentId, referenceItemId, variant });
    return new StreamableFile(content.body, { type: content.contentType });
  }

  @Post(":assignmentId/items/:referenceItemId/uploads/:mediaAssetId/finalize")
  finalize(@Req() request: Request, @Param("assignmentId") assignmentId: string,
    @Param("referenceItemId") referenceItemId: string,
    @Param("mediaAssetId") mediaAssetId: string) {
    return this.service.finalizeCampaignEvidence({ ...actor(request.user),
      assignmentId, referenceItemId, mediaAssetId });
  }

  @Post(":assignmentId/submissions")
  submit(@Req() request: Request, @Param("assignmentId") assignmentId: string,
    @Body() body: SubmitVmCampaignDto) {
    return this.service.submit({ ...actor(request.user), assignmentId, ...body });
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
