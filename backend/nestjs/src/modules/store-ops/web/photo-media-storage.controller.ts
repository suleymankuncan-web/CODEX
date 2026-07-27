import {
  Body, Controller, Param, ParseFilePipeBuilder, ParseUUIDPipe, Post, Req,
  UploadedFile, UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { RequireRoles } from "../../auth/decorators/roles.decorator";
import { RequireScope } from "../../auth/decorators/scope.decorator";
import { PhotoMediaStorageService } from "../application/photo-media-storage.service";
import { PhotoMediaUploadBufferGuardInterceptor } from "./photo-media-upload-buffer-guard.interceptor";
import {
  InitiateSyntheticPhotoMediaUploadDto,
  DisposeSyntheticPhotoMediaQuarantineDto,
  PhotoMediaMaintenanceBatchDto,
  PhotoMediaReadDto,
} from "./dto/photo-media-storage.dto";
import { PhotoMediaMaintenanceService } from "../application/photo-media-maintenance.service";

type PhotoMediaRequestUser = {
  userId: string;
  roleCodes: string[];
  scope: { companyIds: string[]; regionIds: string[]; storeIds: string[] };
  actionScope: { assignedStoreIds: string[] };
};

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
  reconcile() {
    return this.maintenance.reconcile();
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

  @Post("maintenance/cleanup-expired")
  cleanupExpired(@Body() body: PhotoMediaMaintenanceBatchDto) {
    return this.maintenance.cleanupExpired(body.limit);
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
