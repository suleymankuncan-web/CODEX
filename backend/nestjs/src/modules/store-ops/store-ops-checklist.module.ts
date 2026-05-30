import { Module } from "@nestjs/common";
import { AdminChecklistTemplateController } from "./web/admin-checklist-template.controller";
import { ChecklistController } from "./web/checklist.controller";
import { MobileChecklistController } from "./web/mobile-checklist.controller";
import { ChecklistService } from "./application/checklist.service";
import { ChecklistAcknowledgementRepository } from "./infrastructure/checklist-acknowledgement.repository";
import { ChecklistRepository } from "./infrastructure/checklist.repository";
import { StoreOpsRepository } from "./infrastructure/store-ops.repository";

@Module({
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
