import { Module } from "@nestjs/common";
import { SalesTargetIncentiveRegionWorkflowService } from "./application/sales-target-incentive-region-workflow.service";
import { StoreOpsIncentiveApprovalModule } from "./store-ops-incentive-approval.module";
import { StoreOpsIncentiveProjectionModule } from "./store-ops-incentive-projection.module";

@Module({
  imports: [
    StoreOpsIncentiveApprovalModule,
    StoreOpsIncentiveProjectionModule,
  ],
  providers: [SalesTargetIncentiveRegionWorkflowService],
  exports: [SalesTargetIncentiveRegionWorkflowService],
})
export class StoreOpsIncentiveWorkflowModule {}
