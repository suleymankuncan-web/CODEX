import {
  Body, Controller, HttpCode, HttpStatus, Param, ParseFilePipeBuilder, ParseUUIDPipe, Post, Req,
  UploadedFile, UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBadRequestResponse, ApiConflictResponse, ApiForbiddenResponse,
  ApiNotFoundResponse, ApiOkResponse, ApiServiceUnavailableResponse,
} from "@nestjs/swagger";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import { RequireScope } from "../../auth/decorators/scope.decorator";
import { PhotoMediaStorageService } from "../application/photo-media-storage.service";
import { PhotoMediaUploadBufferGuardInterceptor } from "./photo-media-upload-buffer-guard.interceptor";
import {
  InitiateSyntheticPhotoMediaUploadDto,
  DisposeSyntheticPhotoMediaQuarantineDto,
  PhotoMediaMaintenanceBatchDto,
  PhotoMediaRetentionExecuteDto,
  PhotoMediaRetentionPreviewDto,
  PhotoMediaReadDto,
} from "./dto/photo-media-storage.dto";
import { PhotoMediaMaintenanceService } from "../application/photo-media-maintenance.service";

type PhotoMediaRequestUser = {
  userId: string;
  roleCodes: string[];
  scope: { companyIds: string[]; regionIds: string[]; storeIds: string[] };
  actionScope: { assignedStoreIds: string[] };
};

const standardErrorSchema = (statusCode: number, errorCodes: string[]) => ({
  type: "object",
  additionalProperties: false,
  required: ["correlationId", "statusCode", "errorCode", "message", "path", "timestamp"],
  properties: {
    correlationId: { type: "string" },
    statusCode: { type: "integer", enum: [statusCode] },
    errorCode: { type: "string", enum: errorCodes },
    message: { oneOf: [
      { type: "string" },
      { type: "array", items: { type: "string" } },
    ] },
    path: { type: "string" },
    timestamp: { type: "string", format: "date-time" },
  },
});

const retentionBadRequestSchema = standardErrorSchema(HttpStatus.BAD_REQUEST, [
  "VALIDATION_ERROR", "manifest_digest_mismatch", "manifest_reason_invalid",
]);
const retentionForbiddenSchema = standardErrorSchema(HttpStatus.FORBIDDEN, ["FORBIDDEN"]);
const retentionNotFoundSchema = standardErrorSchema(HttpStatus.NOT_FOUND, ["manifest_not_found"]);
const retentionConflictSchema = standardErrorSchema(HttpStatus.CONFLICT, [
  "manifest_expired", "manifest_not_executable", "manifest_stale", "asset_held",
]);
const retentionUnavailableSchema = standardErrorSchema(HttpStatus.SERVICE_UNAVAILABLE, [
  "cleanup_disabled", "provider_delete_failed", "SERVICE_UNAVAILABLE",
]);

@Controller("internal/photo-media")
@RequireScope("authenticated")
@RequireRoles("SUPER_ADMIN")
export class PhotoMediaStorageController {
  constructor(
    private readonly service: PhotoMediaStorageService,
    private readonly maintenance: PhotoMediaMaintenanceService,
  ) {}

  @Post("uploads/initiate")
  @UseInterceptors(new PhotoMediaUploadBufferGuardInterceptor(), FileInterceptor("file", {
    limits: { fileSize: 15 * 1024 * 1024, files: 1, fields: 2 },
  }))
  initiate(
    @Req() request: { user: PhotoMediaRequestUser },
    @Body() body: InitiateSyntheticPhotoMediaUploadDto,
    @UploadedFile(new ParseFilePipeBuilder()
      .addFileTypeValidator({ fileType: /^(image\/jpeg|image\/png|image\/webp)$/ })
      .addMaxSizeValidator({ maxSize: 15 * 1024 * 1024 })
      .build({ fileIsRequired: true }))
    file: { buffer: Buffer; mimetype: string; size: number },
  ) {
    return this.service.initiateSyntheticUpload({
      actorUserId: request.user.userId,
      actorRoleCodes: request.user.roleCodes,
      actorScope: request.user.scope,
      storeId: body.storeId,
      contentType: file.mimetype,
      contentLength: file.size,
      contentBody: file.buffer,
      syntheticFixtureAttestation: body.syntheticFixtureAttestation,
    });
  }

  @Post("uploads/:mediaAssetId/quarantine/dispose")
  disposeQuarantine(
    @Req() request: { user: PhotoMediaRequestUser },
    @Param("mediaAssetId", new ParseUUIDPipe()) mediaAssetId: string,
    @Body() body: DisposeSyntheticPhotoMediaQuarantineDto,
  ) {
    return this.service.disposeSyntheticQuarantine({
      mediaAssetId,
      actorUserId: request.user.userId,
      actorRoleCodes: request.user.roleCodes,
      confirmed: body.confirmed,
    });
  }

  @Post("uploads/:mediaAssetId/finalize")
  finalize(
    @Req() request: { user: PhotoMediaRequestUser },
    @Param("mediaAssetId", new ParseUUIDPipe()) mediaAssetId: string,
  ) {
    return this.service.finalizeSyntheticUpload({
      mediaAssetId,
      actorUserId: request.user.userId,
      actorActionScope: request.user.actionScope,
      actorRoleCodes: request.user.roleCodes,
      actorScope: request.user.scope,
    });
  }

  @Post("assets/:mediaAssetId/read-url")
  readUrl(
    @Req() request: { user: PhotoMediaRequestUser },
    @Param("mediaAssetId", new ParseUUIDPipe()) mediaAssetId: string,
    @Body() body: PhotoMediaReadDto,
  ) {
    return this.service.createSignedRead({
      mediaAssetId,
      actorUserId: request.user.userId,
      actorScope: request.user.scope,
      variant: body.variant,
    });
  }

  @Post("maintenance/reconcile")
  reconcile(@Req() request: { user: PhotoMediaRequestUser }) {
    return this.maintenance.reconcile(request.user.scope);
  }

  @Post("maintenance/restore-rehearsal")
  restoreRehearsal() {
    return this.maintenance.rehearseRestore();
  }

  @Post("maintenance/assets/:mediaAssetId/restore")
  restoreAsset(
    @Req() request: { user: PhotoMediaRequestUser },
    @Param("mediaAssetId", new ParseUUIDPipe()) mediaAssetId: string,
  ) {
    return this.maintenance.restoreAsset({ mediaAssetId, actorUserId: request.user.userId });
  }

  @Post("maintenance/retention/preview")
  @HttpCode(HttpStatus.OK)
  @ApiBadRequestResponse({ schema: retentionBadRequestSchema })
  @ApiConflictResponse({ schema: retentionConflictSchema })
  @ApiForbiddenResponse({ schema: retentionForbiddenSchema })
  @ApiServiceUnavailableResponse({ schema: retentionUnavailableSchema })
  @ApiOkResponse({ schema: {
    type: "object",
    required: ["manifestId", "manifestDigest", "candidateCount", "candidateBytes", "expiresAt", "status"],
    properties: {
      manifestId: { type: "string", format: "uuid" },
      manifestDigest: { type: "string", pattern: "^[a-f0-9]{64}$" },
      candidateCount: { type: "integer", minimum: 0 },
      candidateBytes: { type: "integer", minimum: 0 },
      expiresAt: { type: "string", format: "date-time" },
      status: { type: "string", enum: ["previewed"] },
    },
  } })
  previewRetention(
    @Req() request: { user: PhotoMediaRequestUser },
    @Body() body: PhotoMediaRetentionPreviewDto,
  ) {
    return this.maintenance.previewRetentionPurge({
      limit: body.limit,
      reason: body.reason,
      source: "manual",
      actorUserId: request.user.userId,
      actorScope: request.user.scope,
    });
  }

  @Post("maintenance/retention/execute")
  @HttpCode(HttpStatus.OK)
  @ApiBadRequestResponse({ schema: retentionBadRequestSchema })
  @ApiForbiddenResponse({ schema: retentionForbiddenSchema })
  @ApiNotFoundResponse({ schema: retentionNotFoundSchema })
  @ApiConflictResponse({ schema: retentionConflictSchema })
  @ApiServiceUnavailableResponse({ schema: retentionUnavailableSchema })
  @ApiOkResponse({ schema: {
    type: "object",
    required: ["manifestId", "manifestDigest", "claimedCount", "deletedCount", "status"],
    properties: {
      manifestId: { type: "string", format: "uuid" },
      manifestDigest: { type: "string", pattern: "^[a-f0-9]{64}$" },
      claimedCount: { type: "integer", minimum: 0 },
      deletedCount: { type: "integer", minimum: 0 },
      status: { type: "string", enum: ["completed"] },
    },
  } })
  executeRetention(
    @Req() request: { user: PhotoMediaRequestUser },
    @Body() body: PhotoMediaRetentionExecuteDto,
  ) {
    return this.maintenance.executeRetentionPurge({
      manifestId: body.manifestId,
      manifestDigest: body.manifestDigest,
      actorUserId: request.user.userId,
      actorScope: request.user.scope,
    });
  }

  @Post("maintenance/retention/usage")
  @HttpCode(HttpStatus.OK)
  @ApiForbiddenResponse({ schema: retentionForbiddenSchema })
  @ApiServiceUnavailableResponse({ schema: retentionUnavailableSchema })
  @ApiOkResponse({ schema: {
    type: "object",
    required: [
      "current", "recentGrowthBytes", "projectedThirtyDayBytes",
      "classifications", "lifecycle", "alerts",
    ],
    properties: {
      current: {
        type: "object", additionalProperties: false,
        required: ["bytes", "classAOperations", "classBOperations"], properties: {
        bytes: { type: "integer", minimum: 0 },
        classAOperations: { type: "integer", minimum: 0 },
        classBOperations: { type: "integer", minimum: 0 },
      } },
      recentGrowthBytes: { type: "integer", minimum: 0 },
      projectedThirtyDayBytes: { type: "integer", minimum: 0 },
      classifications: { type: "array", items: {
        type: "object", additionalProperties: false,
        required: ["classification", "assetCount", "bytes"],
        properties: {
          classification: {
            type: "string", enum: [
              "checklist_evidence", "action_evidence", "vm_reference",
              "vm_campaign_evidence", "derived_artifact",
            ],
          },
          assetCount: { type: "integer", minimum: 0 },
          bytes: { type: "integer", minimum: 0 },
        },
      } },
      lifecycle: {
        type: "object", additionalProperties: false,
        required: [
          "purgeEligibleCount", "protectedExpiredCount", "stuckUploadCount",
          "stuckPurgeCount", "cleanupFailureCount",
        ],
        properties: {
          purgeEligibleCount: { type: "integer", minimum: 0 },
          protectedExpiredCount: { type: "integer", minimum: 0 },
          stuckUploadCount: { type: "integer", minimum: 0 },
          stuckPurgeCount: { type: "integer", minimum: 0 },
          cleanupFailureCount: { type: "integer", minimum: 0 },
        },
      },
      alerts: { type: "array", items: {
        type: "object", additionalProperties: false,
        required: ["dimension", "used", "limit", "state"],
        properties: {
          dimension: { type: "string", enum: ["bytes", "class_a", "class_b"] },
          used: { type: "integer", minimum: 0 },
          limit: { type: "integer", minimum: 1 },
          state: { type: "string", enum: ["normal", "warning", "critical", "limit_reached"] },
        },
      } },
    },
  } })
  retentionUsage(@Req() request: { user: PhotoMediaRequestUser }) {
    return this.maintenance.getRetentionUsage(request.user.scope);
  }

  @Post("maintenance/cleanup-partials")
  cleanupPartials(@Body() body: PhotoMediaMaintenanceBatchDto) {
    return this.maintenance.cleanupStalePartials(body.limit);
  }

  @Post("maintenance/cleanup-ready-raw")
  cleanupReadyRaw(
    @Req() request: { user: PhotoMediaRequestUser },
    @Body() body: PhotoMediaMaintenanceBatchDto,
  ) {
    return this.maintenance.cleanupReadyRawDisposals(body.limit, request.user.userId);
  }
}
