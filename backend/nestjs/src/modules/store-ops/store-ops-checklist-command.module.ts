import { Module } from "@nestjs/common";
import { ChecklistCommandReadService } from "./application/checklist-command-read.service";
import { ChecklistCommandReadRepository } from "./infrastructure/checklist-command-read.repository";
import { ChecklistCommandController } from "./web/checklist-command.controller";

@Module({
  controllers: [ChecklistCommandController],
  providers: [ChecklistCommandReadService, ChecklistCommandReadRepository],
})
export class StoreOpsChecklistCommandModule {}
