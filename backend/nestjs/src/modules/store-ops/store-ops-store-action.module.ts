import { Module } from "@nestjs/common";
import { StoreActionPhotoReviewService } from "./application/store-action-photo-review.service";
import { StoreActionPlanService } from "./application/store-action-plan.service";
import { StoreActionPhotoReviewRepository } from "./infrastructure/store-action-photo-review.repository";
import { StoreActionPlanRepository } from "./infrastructure/store-action-plan.repository";
import { StoreOpsRepository } from "./infrastructure/store-ops.repository";
import { StoreOpsPhotoMediaModule } from "./store-ops-photo-media.module";
import { StoreActionPlanController } from "./web/store-action-plan.controller";

@Module({
  imports: [StoreOpsPhotoMediaModule],
  controllers: [StoreActionPlanController],
  providers: [
    StoreActionPlanService,
    StoreActionPlanRepository,
    StoreActionPhotoReviewService,
    StoreActionPhotoReviewRepository,
    StoreOpsRepository,
  ],
  exports: [StoreActionPlanService, StoreActionPlanRepository],
})
export class StoreOpsStoreActionModule {}
