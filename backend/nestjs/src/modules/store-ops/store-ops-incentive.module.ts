import { Module } from "@nestjs/common";
import { SalesTargetIncentiveApiService } from "./application/sales-target-incentive-api.service";
import { SalesTargetIncentiveCalculatorService } from "./application/sales-target-incentive-calculator.service";
import { SalesTargetIncentiveReadModelService } from "./application/sales-target-incentive-read-model.service";
import { SalesTargetIncentiveCloseRepository } from "./infrastructure/sales-target-incentive-close.repository";
import { SalesTargetIncentiveCorrectionRepository } from "./infrastructure/sales-target-incentive-correction.repository";
import { SalesTargetIncentiveReadRepository } from "./infrastructure/sales-target-incentive-read.repository";
import { StoreOpsIncentiveApprovalModule } from "./store-ops-incentive-approval.module";
import { AdminSalesTargetIncentiveController } from "./web/admin-sales-target-incentive.controller";
import { StoreSalesTargetIncentiveController } from "./web/store-sales-target-incentive.controller";

@Module({
  imports: [StoreOpsIncentiveApprovalModule],
  controllers: [
    StoreSalesTargetIncentiveController,
    AdminSalesTargetIncentiveController,
  ],
  providers: [
    SalesTargetIncentiveApiService,
    SalesTargetIncentiveReadModelService,
    SalesTargetIncentiveCalculatorService,
    SalesTargetIncentiveReadRepository,
    SalesTargetIncentiveCorrectionRepository,
    SalesTargetIncentiveCloseRepository,
  ],
  exports: [SalesTargetIncentiveApiService],
})
export class StoreOpsIncentiveModule {}
