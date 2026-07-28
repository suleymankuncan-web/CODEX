import { Body, Controller, Delete, Get, Header, Param, ParseEnumPipe, ParseFilePipeBuilder, ParseUUIDPipe, Patch, Post, Req, StreamableFile, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBody, ApiConsumes, ApiCreatedResponse, ApiOkResponse } from "@nestjs/swagger";
import type { SchemaObject } from "@nestjs/swagger/dist/interfaces/open-api-spec.interface";
import { AuthenticatedUser } from "../../auth/auth-context.service";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import {
  RequireActionScope,
  RequireScope,
} from "../../auth/decorators/scope.decorator";
import { ChecklistService } from "../application/checklist.service";
import { AcknowledgeChecklistInstanceDto } from "./dto/acknowledge-checklist-instance.dto";
import { MobileChecklistInstanceParamsDto } from "./dto/mobile-checklist-instance-params.dto";
import { SaveMobileChecklistResponseDto } from "./dto/save-mobile-checklist-response.dto";
import { StartMobileChecklistInstanceDto } from "./dto/start-mobile-checklist-instance.dto";
import {
  LinkChecklistItemEvidenceDto,
  UnlinkChecklistItemEvidenceDto,
} from "./dto/checklist-item-evidence.dto";
import { PhotoMediaReadDto } from "./dto/photo-media-storage.dto";
import { PhotoMediaUploadBufferGuardInterceptor } from "./photo-media-upload-buffer-guard.interceptor";

const checklistEvidenceProjectionSchema: SchemaObject = {
  type: "object",
  required: ["checklistInstanceId", "templateItemId", "evidenceVersion", "evidencePolicy", "maxEvidenceCount", "evidence", "idempotent"],
  properties: {
    checklistInstanceId: { type: "string", format: "uuid" },
    templateItemId: { type: "string", format: "uuid" },
    evidenceVersion: { type: "integer", minimum: 0 },
    evidencePolicy: { type: "string", enum: ["none", "optional", "required"] },
    maxEvidenceCount: { type: "integer", minimum: 0 },
    idempotent: { type: "boolean" },
    evidence: {
      type: "array",
      items: {
        type: "object",
        required: ["mediaAssetId", "displayOrder", "captureSource", "thumbnailAvailable"],
        properties: {
          mediaAssetId: { type: "string", format: "uuid" },
          displayOrder: { type: "integer", minimum: 0 },
          captureSource: { type: "string", enum: ["camera", "gallery", "system_generated"] },
          thumbnailAvailable: { type: "boolean" },
        },
      },
    },
  },
};

const checklistEvidenceCommandResponseSchema: SchemaObject = {
  type: "object",
  required: ["command", "data"],
  properties: {
    command: {
      type: "object",
      required: ["status", "message"],
      properties: { status: { type: "string" }, message: { type: "string" } },
    },
    data: {
      type: "object",
      required: ["evidence"],
      properties: { evidence: checklistEvidenceProjectionSchema },
    },
  },
};

@Controller("mobile/checklists")
export class MobileChecklistController {
  constructor(private readonly checklistService: ChecklistService) {}

  @Get("today")
  @RequireScope("authenticated")
  @RequireRoles("REGION_MANAGER", "STORE_MANAGER", "VISUAL_MERCHANDISER", "SUPER_ADMIN")
  async getToday(
    @Req()
    request: {
      user: AuthenticatedUser;
    },
  ) {
    return this.checklistService.getMobileChecklistToday({
      actorUserId: request.user.userId,
      actorScope: request.user.scope,
      actorRoleCodes: request.user.roleCodes,
      actorActionScope: request.user.actionScope,
    });
  }

  @Post("instances")
  @RequireScope("authenticated")
  @RequireActionScope("store")
  @RequireRoles("REGION_MANAGER", "VISUAL_MERCHANDISER", "SUPER_ADMIN")
  async startInstance(
    @Req()
    request: {
      user: AuthenticatedUser;
    },
    @Body() body: StartMobileChecklistInstanceDto,
  ) {
    return this.checklistService.startMobileChecklistInstance({
      checklistTemplateId: body.checklistTemplateId,
      storeId: body.storeId,
      actorUserId: request.user.userId,
      actorRoleCodes: request.user.roleCodes,
      actorActionScope: request.user.actionScope,
    });
  }

  @Patch("instances/:checklistInstanceId/responses")
  @RequireScope("authenticated")
  @RequireRoles("REGION_MANAGER", "VISUAL_MERCHANDISER", "SUPER_ADMIN")
  async saveResponse(
    @Param() params: MobileChecklistInstanceParamsDto,
    @Req()
    request: {
      user: AuthenticatedUser;
    },
    @Body() body: SaveMobileChecklistResponseDto,
  ) {
    return this.checklistService.saveMobileChecklistResponse({
      checklistInstanceId: params.checklistInstanceId,
      templateItemId: body.templateItemId,
      scoreValue: body.scoreValue,
      commentText: body.commentText,
      actorUserId: request.user.userId,
      actorRoleCodes: request.user.roleCodes,
      actorActionScope: request.user.actionScope,
    });
  }

  @Post("instances/:checklistInstanceId/complete")
  @RequireScope("authenticated")
  @RequireRoles("REGION_MANAGER", "VISUAL_MERCHANDISER", "SUPER_ADMIN")
  async completeInstance(
    @Param() params: MobileChecklistInstanceParamsDto,
    @Req()
    request: {
      user: AuthenticatedUser;
    },
  ) {
    return this.checklistService.completeMobileChecklistInstance({
      checklistInstanceId: params.checklistInstanceId,
      actorUserId: request.user.userId,
      actorRoleCodes: request.user.roleCodes,
      actorActionScope: request.user.actionScope,
    });
  }

  @Post("instances/:checklistInstanceId/items/:templateItemId/evidence")
  @ApiCreatedResponse({ schema: checklistEvidenceCommandResponseSchema })
  @RequireScope("authenticated")
  @RequireRoles("REGION_MANAGER", "VISUAL_MERCHANDISER", "SUPER_ADMIN")
  async linkEvidence(
    @Param("checklistInstanceId", new ParseUUIDPipe()) checklistInstanceId: string,
    @Param("templateItemId", new ParseUUIDPipe()) templateItemId: string,
    @Req() request: { user: AuthenticatedUser },
    @Body() body: LinkChecklistItemEvidenceDto,
  ) {
    return this.checklistService.linkMobileChecklistItemEvidence({
      checklistInstanceId,
      templateItemId,
      mediaAssetId: body.mediaAssetId,
      expectedEvidenceVersion: body.expectedEvidenceVersion,
      idempotencyKey: body.idempotencyKey,
      actorUserId: request.user.userId,
      actorRoleCodes: request.user.roleCodes,
      actorActionScope: request.user.actionScope,
    });
  }

  @Post("instances/:checklistInstanceId/items/:templateItemId/evidence/uploads")
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["file"],
      properties: { file: { type: "string", format: "binary" } },
    },
  })
  @ApiCreatedResponse({
    schema: {
      type: "object",
      required: ["mediaAssetId", "state"],
      properties: {
        mediaAssetId: { type: "string", format: "uuid" },
        state: { type: "string", enum: ["uploaded"] },
      },
    },
  })
  @RequireScope("authenticated")
  @RequireRoles("REGION_MANAGER", "VISUAL_MERCHANDISER", "SUPER_ADMIN")
  @UseInterceptors(new PhotoMediaUploadBufferGuardInterceptor(), FileInterceptor("file", {
    limits: { fileSize: 15 * 1024 * 1024, files: 1, fields: 0 },
  }))
  async uploadApprovedSyntheticEvidence(
    @Param("checklistInstanceId", new ParseUUIDPipe()) checklistInstanceId: string,
    @Param("templateItemId", new ParseUUIDPipe()) templateItemId: string,
    @Req() request: { user: AuthenticatedUser },
    @UploadedFile(new ParseFilePipeBuilder()
      .addFileTypeValidator({ fileType: /^(image\/jpeg|image\/png|image\/webp)$/ })
      .addMaxSizeValidator({ maxSize: 15 * 1024 * 1024 })
      .build({ fileIsRequired: true }))
    file: { buffer: Buffer; mimetype: string; size: number },
  ) {
    return this.checklistService.uploadApprovedSyntheticMobileChecklistItemEvidence({
      checklistInstanceId,
      templateItemId,
      actorUserId: request.user.userId,
      actorRoleCodes: request.user.roleCodes,
      actorScope: request.user.scope,
      actorActionScope: request.user.actionScope,
      contentType: file.mimetype,
      contentLength: file.size,
      contentBody: file.buffer,
    });
  }

  @Post("instances/:checklistInstanceId/items/:templateItemId/evidence/uploads/:mediaAssetId/finalize")
  @ApiCreatedResponse({
    schema: {
      type: "object",
      required: ["mediaAssetId", "state", "rawDisposal"],
      properties: {
        mediaAssetId: { type: "string", format: "uuid" },
        state: { type: "string", enum: ["ready"] },
        rawDisposal: { type: "string", enum: ["verified", "pending"] },
      },
    },
  })
  @RequireScope("authenticated")
  @RequireRoles("REGION_MANAGER", "VISUAL_MERCHANDISER", "SUPER_ADMIN")
  async finalizeApprovedSyntheticEvidence(
    @Param("checklistInstanceId", new ParseUUIDPipe()) checklistInstanceId: string,
    @Param("templateItemId", new ParseUUIDPipe()) templateItemId: string,
    @Param("mediaAssetId", new ParseUUIDPipe()) mediaAssetId: string,
    @Req() request: { user: AuthenticatedUser },
  ) {
    return this.checklistService.finalizeApprovedSyntheticMobileChecklistItemEvidence({
      checklistInstanceId,
      templateItemId,
      mediaAssetId,
      actorUserId: request.user.userId,
      actorRoleCodes: request.user.roleCodes,
      actorScope: request.user.scope,
      actorActionScope: request.user.actionScope,
    });
  }

  @Delete("instances/:checklistInstanceId/items/:templateItemId/evidence/:mediaAssetId")
  @ApiOkResponse({ schema: checklistEvidenceCommandResponseSchema })
  @RequireScope("authenticated")
  @RequireRoles("REGION_MANAGER", "VISUAL_MERCHANDISER", "SUPER_ADMIN")
  async unlinkEvidence(
    @Param("checklistInstanceId", new ParseUUIDPipe()) checklistInstanceId: string,
    @Param("templateItemId", new ParseUUIDPipe()) templateItemId: string,
    @Param("mediaAssetId", new ParseUUIDPipe()) mediaAssetId: string,
    @Req() request: { user: AuthenticatedUser },
    @Body() body: UnlinkChecklistItemEvidenceDto,
  ) {
    return this.checklistService.unlinkMobileChecklistItemEvidence({
      checklistInstanceId,
      templateItemId,
      mediaAssetId,
      reason: body.reason,
      expectedEvidenceVersion: body.expectedEvidenceVersion,
      idempotencyKey: body.idempotencyKey,
      actorUserId: request.user.userId,
      actorRoleCodes: request.user.roleCodes,
      actorActionScope: request.user.actionScope,
    });
  }

  @Post("instances/:checklistInstanceId/items/:templateItemId/evidence/:mediaAssetId/read-url")
  @ApiCreatedResponse({
    schema: {
      type: "object",
      required: ["url", "expiresInSeconds"],
      properties: {
        url: { type: "string", format: "uri" },
        expiresInSeconds: { type: "integer", minimum: 1 },
      },
    },
  })
  @RequireScope("authenticated")
  @RequireRoles("REGION_MANAGER", "VISUAL_MERCHANDISER", "SUPER_ADMIN")
  async readEvidence(
    @Param("checklistInstanceId", new ParseUUIDPipe()) checklistInstanceId: string,
    @Param("templateItemId", new ParseUUIDPipe()) templateItemId: string,
    @Param("mediaAssetId", new ParseUUIDPipe()) mediaAssetId: string,
    @Req() request: { user: AuthenticatedUser },
    @Body() body: PhotoMediaReadDto,
  ) {
    return this.checklistService.readMobileChecklistItemEvidence({
      checklistInstanceId,
      templateItemId,
      mediaAssetId,
      variant: body.variant,
      actorUserId: request.user.userId,
      actorRoleCodes: request.user.roleCodes,
      actorScope: request.user.scope,
      actorActionScope: request.user.actionScope,
    });
  }

  @Get("instances/:checklistInstanceId/items/:templateItemId/evidence/:mediaAssetId/content/:variant")
  @ApiOkResponse({
    content: { "image/webp": { schema: { type: "string", format: "binary" } } },
  })
  @Header("Cache-Control", "private, no-store")
  @RequireScope("authenticated")
  @RequireRoles("REGION_MANAGER", "VISUAL_MERCHANDISER", "SUPER_ADMIN")
  async readEvidenceContent(
    @Param("checklistInstanceId", new ParseUUIDPipe()) checklistInstanceId: string,
    @Param("templateItemId", new ParseUUIDPipe()) templateItemId: string,
    @Param("mediaAssetId", new ParseUUIDPipe()) mediaAssetId: string,
    @Param("variant", new ParseEnumPipe(["canonical", "thumbnail"]))
    variant: "canonical" | "thumbnail",
    @Req() request: { user: AuthenticatedUser },
  ) {
    const content = await this.checklistService.readMobileChecklistItemEvidenceContent({
      checklistInstanceId,
      templateItemId,
      mediaAssetId,
      variant,
      actorUserId: request.user.userId,
      actorRoleCodes: request.user.roleCodes,
      actorScope: request.user.scope,
      actorActionScope: request.user.actionScope,
    });
    return new StreamableFile(content.body, { type: content.contentType });
  }

  @Post("instances/:checklistInstanceId/acknowledge")
  @RequireScope("authenticated")
  @RequireRoles("STORE_MANAGER", "SUPER_ADMIN")
  async acknowledge(
    @Param() params: MobileChecklistInstanceParamsDto,
    @Req()
    request: {
      user: AuthenticatedUser;
    },
    @Body() body: AcknowledgeChecklistInstanceDto,
  ) {
    return this.checklistService.acknowledgeChecklist({
      checklistInstanceId: params.checklistInstanceId,
      actorUserId: request.user.userId,
      actorActionScope: request.user.actionScope,
      acknowledgementNote: body.acknowledgementNote,
    });
  }
}
