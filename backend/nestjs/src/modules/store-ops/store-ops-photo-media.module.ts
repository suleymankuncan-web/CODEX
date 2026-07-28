import { Module } from "@nestjs/common";
import { AppConfigService } from "../../shared/app-config.service";
import {
  PHOTO_MEDIA_ASSET_REPOSITORY,
  PHOTO_MEDIA_IMAGE_PROCESSOR,
  PHOTO_MEDIA_PRIMARY_STORAGE,
  PHOTO_MEDIA_RECOVERY_STORAGE,
  PHOTO_MEDIA_SAFETY_SCANNER,
  PHOTO_MEDIA_STORAGE_CONFIGURATION,
  PhotoMediaStorageService,
} from "./application/photo-media-storage.service";
import { DisabledPhotoMediaObjectStorage } from "./infrastructure/disabled-photo-media-object-storage";
import { PhotoMediaAssetRepository } from "./infrastructure/photo-media-asset.repository";
import { R2PhotoMediaObjectStorage } from "./infrastructure/r2-photo-media-object-storage";
import { SharpPhotoMediaImageProcessor } from "./infrastructure/sharp-photo-media-image-processor";
import { SyntheticFixturePhotoMediaSafetyScanner } from "./infrastructure/synthetic-fixture-photo-media-safety-scanner";
import { PhotoMediaStorageController } from "./web/photo-media-storage.controller";
import { PhotoMediaMaintenanceService } from "./application/photo-media-maintenance.service";
import { StoreOpsPhotoMediaRetentionModule } from "./store-ops-photo-media-retention.module";

@Module({
  imports: [StoreOpsPhotoMediaRetentionModule],
  controllers: [PhotoMediaStorageController],
  providers: [
    PhotoMediaStorageService,
    PhotoMediaMaintenanceService,
    PhotoMediaAssetRepository,
    SharpPhotoMediaImageProcessor,
    {
      provide: PHOTO_MEDIA_STORAGE_CONFIGURATION,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => config.photoMediaStorageConfiguration,
    },
    { provide: PHOTO_MEDIA_ASSET_REPOSITORY, useExisting: PhotoMediaAssetRepository },
    { provide: PHOTO_MEDIA_IMAGE_PROCESSOR, useExisting: SharpPhotoMediaImageProcessor },
    {
      provide: PHOTO_MEDIA_SAFETY_SCANNER,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => {
        const runtime = config.photoMediaStorageConfiguration;
        return new SyntheticFixturePhotoMediaSafetyScanner(
          runtime.syntheticFixtureSha256Allowlist ?? [],
        );
      },
    },
    {
      provide: PHOTO_MEDIA_PRIMARY_STORAGE,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => {
        const runtime = config.photoMediaStorageConfiguration;
        return runtime.enabled
          ? new R2PhotoMediaObjectStorage({
              bucket: runtime.primaryBucket,
              endpoint: runtime.primaryEndpoint,
              credentials: config.photoMediaPrimaryCredentials,
            })
          : new DisabledPhotoMediaObjectStorage();
      },
    },
    {
      provide: PHOTO_MEDIA_RECOVERY_STORAGE,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => {
        const runtime = config.photoMediaStorageConfiguration;
        return runtime.enabled
          ? new R2PhotoMediaObjectStorage({
              bucket: runtime.recoveryBucket,
              endpoint: runtime.recoveryEndpoint,
              credentials: config.photoMediaRecoveryCredentials,
            })
          : new DisabledPhotoMediaObjectStorage();
      },
    },
  ],
  exports: [PhotoMediaStorageService],
})
export class StoreOpsPhotoMediaModule {}
