import { Module } from "@nestjs/common";
import { PersonnelCorrectionRepository } from "./infrastructure/personnel-correction.repository";
import { PersonnelCorrectionController } from "./web/personnel-correction.controller";
import { WorkforceService } from "./application/workforce.service";
import { StoreOpsRepository } from "./infrastructure/store-ops.repository";
import { WorkforceRequestRepository } from "./infrastructure/workforce-request.repository";
import { WorkforceController } from "./web/workforce.controller";
import { StoreOpsWorkforceWorkspaceReadModule } from "./store-ops-workforce-workspace-read.module";

@Module({
  imports: [StoreOpsWorkforceWorkspaceReadModule],
  controllers: [WorkforceController, PersonnelCorrectionController],
  providers: [
    PersonnelCorrectionRepository,
    WorkforceService,
    StoreOpsRepository,
    WorkforceRequestRepository,
  ],
  exports: [WorkforceService],
})
export class StoreOpsWorkforceModule {}
