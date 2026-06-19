import { Module } from "@nestjs/common";
import { SalesTargetIncentiveAdminPackageWorkflowService } from "./application/sales-target-incentive-admin-package-workflow.service";
import { StoreOpsIncentiveAdminPackageReadModule } from "./store-ops-incentive-admin-package-read.module";
import { StoreOpsIncentiveApprovalModule } from "./store-ops-incentive-approval.module";

@Module({
  imports: [
    StoreOpsIncentiveAdminPackageReadModule,
    StoreOpsIncentiveApprovalModule,
  ],
  providers: [SalesTargetIncentiveAdminPackageWorkflowService],
  exports: [SalesTargetIncentiveAdminPackageWorkflowService],
})
export class StoreOpsIncentiveAdminPackageWorkflowModule {}
