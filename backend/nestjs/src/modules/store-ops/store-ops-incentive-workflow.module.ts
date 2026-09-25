import { Module } from "@nestjs/common";
import { SalesTargetIncentiveRegionWorkflowService } from "./application/sales-target-incentive-region-workflow.service";
import { StoreOpsIncentivePackageDataModule } from "./store-ops-incentive-package-data.module";
import { StoreOpsIncentiveProjectionModule } from "./store-ops-incentive-projection.module";

@Module({
  imports: [
    StoreOpsIncentivePackageDataModule,
    StoreOpsIncentiveProjectionModule,
  ],
  providers: [SalesTargetIncentiveRegionWorkflowService],
  exports: [SalesTargetIncentiveRegionWorkflowService],
})
export class StoreOpsIncentiveWorkflowModule {}
