import { Module } from "@nestjs/common";
import { VmReferenceManagementService } from "./application/vm-reference-management.service";
import { VmCampaignSettlementWorkerService } from "./application/vm-campaign-settlement-worker.service";
import { VmReferenceManagementRepository } from "./infrastructure/vm-reference-management.repository";
import { VmCampaignLifecycleRepository } from "./infrastructure/vm-campaign-lifecycle.repository";
import { StoreOpsPhotoMediaModule } from "./store-ops-photo-media.module";
import {
  VmReferenceManagementController,
} from "./web/vm-reference-management.controller";
import { VmCampaignController } from "./web/vm-campaign.controller";
import { VisualComparisonAdvisoryController } from "./web/visual-comparison-advisory.controller";
import { VisualComparisonAdvisoryService } from "./application/visual-comparison-advisory.service";
import { VisualComparisonAdvisoryRepository } from "./infrastructure/visual-comparison-advisory.repository";

@Module({
  imports: [StoreOpsPhotoMediaModule],
  controllers: [VmReferenceManagementController, VmCampaignController, VisualComparisonAdvisoryController],
  providers: [VmReferenceManagementService, VmReferenceManagementRepository, VmCampaignLifecycleRepository, VmCampaignSettlementWorkerService, VisualComparisonAdvisoryService, VisualComparisonAdvisoryRepository],
  exports: [VmReferenceManagementService],
})
export class StoreOpsVmReferenceModule {}
