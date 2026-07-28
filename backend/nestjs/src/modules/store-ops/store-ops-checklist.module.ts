import { Module } from "@nestjs/common";
import { AdminChecklistTemplateController } from "./web/admin-checklist-template.controller";
import { ChecklistController } from "./web/checklist.controller";
import { MobileChecklistController } from "./web/mobile-checklist.controller";
import { ChecklistService } from "./application/checklist.service";
import { ChecklistAcknowledgementRepository } from "./infrastructure/checklist-acknowledgement.repository";
import { ChecklistRepository } from "./infrastructure/checklist.repository";
import { StoreOpsRepository } from "./infrastructure/store-ops.repository";
import { StoreOpsStoreActionModule } from "./store-ops-store-action.module";
import { StoreOpsChecklistCommandModule } from "./store-ops-checklist-command.module";
import { StoreOpsChecklistVisitPlanModule } from "./store-ops-checklist-visit-plan.module";
import { StoreOpsChecklistHistoryModule } from "./store-ops-checklist-history.module";
import { StoreOpsPhotoMediaModule } from "./store-ops-photo-media.module";

@Module({
  imports: [
    StoreOpsStoreActionModule,
    StoreOpsChecklistCommandModule,
    StoreOpsChecklistVisitPlanModule,
    StoreOpsChecklistHistoryModule,
    StoreOpsPhotoMediaModule,
  ],
  controllers: [
    ChecklistController,
    AdminChecklistTemplateController,
    MobileChecklistController,
  ],
  providers: [
    ChecklistService,
    StoreOpsRepository,
    ChecklistRepository,
    ChecklistAcknowledgementRepository,
  ],
  exports: [ChecklistService],
})
export class StoreOpsChecklistModule {}
