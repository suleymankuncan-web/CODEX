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

@Module({
  imports: [StoreOpsPhotoMediaModule],
  controllers: [VmReferenceManagementController, VmCampaignController],
  providers: [VmReferenceManagementService, VmReferenceManagementRepository, VmCampaignLifecycleRepository, VmCampaignSettlementWorkerService],
  exports: [VmReferenceManagementService],
})
export class StoreOpsVmReferenceModule {}
