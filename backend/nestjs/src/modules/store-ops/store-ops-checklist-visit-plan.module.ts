import { Module } from "@nestjs/common";
import { ChecklistVisitPlanService } from "./application/checklist-visit-plan.service";
import { ChecklistVisitPlanRepository } from "./infrastructure/checklist-visit-plan.repository";
import { ChecklistVisitPlanController } from "./web/checklist-visit-plan.controller";

@Module({
  controllers: [ChecklistVisitPlanController],
  providers: [ChecklistVisitPlanService, ChecklistVisitPlanRepository],
})
export class StoreOpsChecklistVisitPlanModule {}
