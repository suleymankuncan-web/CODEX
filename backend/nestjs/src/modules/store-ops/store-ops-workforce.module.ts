import { Module } from "@nestjs/common";
import { StoreOpsPersonnelCorrectionModule } from "./store-ops-personnel-correction.module";
import { WorkforceService } from "./application/workforce.service";
import { StoreOpsRepository } from "./infrastructure/store-ops.repository";
import { WorkforceRequestRepository } from "./infrastructure/workforce-request.repository";
import { WorkforceController } from "./web/workforce.controller";
import { StoreOpsWorkforceWorkspaceReadModule } from "./store-ops-workforce-workspace-read.module";

@Module({
  imports: [StoreOpsWorkforceWorkspaceReadModule, StoreOpsPersonnelCorrectionModule],
  controllers: [WorkforceController],
  providers: [
    WorkforceService,
    StoreOpsRepository,
    WorkforceRequestRepository,
  ],
  exports: [WorkforceService],
})
export class StoreOpsWorkforceModule {}
