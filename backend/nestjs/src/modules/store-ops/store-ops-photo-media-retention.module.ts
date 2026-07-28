import { Module } from "@nestjs/common";
import { PHOTO_MEDIA_RETENTION_REPOSITORY } from "./application/photo-media-maintenance.service";
import { PhotoMediaRetentionRepository } from "./infrastructure/photo-media-retention.repository";

@Module({
  providers: [
    PhotoMediaRetentionRepository,
    { provide: PHOTO_MEDIA_RETENTION_REPOSITORY, useExisting: PhotoMediaRetentionRepository },
  ],
  exports: [PHOTO_MEDIA_RETENTION_REPOSITORY],
})
export class StoreOpsPhotoMediaRetentionModule {}
