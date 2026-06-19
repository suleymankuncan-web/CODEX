import { Module } from "@nestjs/common";
import { SalesTargetIncentiveApiService } from "./application/sales-target-incentive-api.service";
import { SalesTargetIncentiveCloseRepository } from "./infrastructure/sales-target-incentive-close.repository";
import { SalesTargetIncentiveCorrectionRepository } from "./infrastructure/sales-target-incentive-correction.repository";
import { StoreOpsIncentiveApprovalModule } from "./store-ops-incentive-approval.module";
import { StoreOpsIncentiveProjectionModule } from "./store-ops-incentive-projection.module";
import { StoreOpsIncentiveWorkflowModule } from "./store-ops-incentive-workflow.module";
import { AdminSalesTargetIncentiveController } from "./web/admin-sales-target-incentive.controller";
import { StoreSalesTargetIncentiveController } from "./web/store-sales-target-incentive.controller";

@Module({
  imports: [
    StoreOpsIncentiveApprovalModule,
    StoreOpsIncentiveProjectionModule,
    StoreOpsIncentiveWorkflowModule,
  ],
  controllers: [
    StoreSalesTargetIncentiveController,
    AdminSalesTargetIncentiveController,
  ],
  providers: [
    SalesTargetIncentiveApiService,
    SalesTargetIncentiveCorrectionRepository,
    SalesTargetIncentiveCloseRepository,
  ],
  exports: [SalesTargetIncentiveApiService],
})
export class StoreOpsIncentiveModule {}
