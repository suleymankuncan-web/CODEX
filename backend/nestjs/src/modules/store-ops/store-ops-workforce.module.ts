import { Module } from "@nestjs/common";
import { StoreOpsPersonnelCorrectionModule } from "./store-ops-personnel-correction.module";
import { WorkforceService } from "./application/workforce.service";
import { StoreOpsRepository } from "./infrastructure/store-ops.repository";
import { WorkforceRequestRepository } from "./infrastructure/workforce-request.repository";
import { WorkforceController } from "./web/workforce.controller";
import { StoreOpsWorkforceWorkspaceReadModule } from "./store-ops-workforce-workspace-read.module";
import { NoPositiveSalesAlertService } from "./application/no-positive-sales-alert.service";
import { NoPositiveSalesAlertMailer } from "./infrastructure/no-positive-sales-alert.mailer";
import { NoPositiveSalesAlertRepository } from "./infrastructure/no-positive-sales-alert.repository";

@Module({
  imports: [StoreOpsWorkforceWorkspaceReadModule, StoreOpsPersonnelCorrectionModule],
  controllers: [WorkforceController],
  providers: [
    WorkforceService,
    StoreOpsRepository,
    WorkforceRequestRepository,
    NoPositiveSalesAlertService,
    NoPositiveSalesAlertMailer,
    NoPositiveSalesAlertRepository,
  ],
  exports: [WorkforceService],
})
export class StoreOpsWorkforceModule {}
