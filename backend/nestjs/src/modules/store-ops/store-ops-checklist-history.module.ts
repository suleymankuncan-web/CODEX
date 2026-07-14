import { Module } from "@nestjs/common";
import { ChecklistOperationalHistoryService } from "./application/checklist-operational-history.service";
import { ChecklistOperationalHistoryRepository } from "./infrastructure/checklist-operational-history.repository";
import { ChecklistOperationalHistoryController } from "./web/checklist-operational-history.controller";

@Module({
  controllers: [ChecklistOperationalHistoryController],
  providers: [ChecklistOperationalHistoryService, ChecklistOperationalHistoryRepository],
})
export class StoreOpsChecklistHistoryModule {}
