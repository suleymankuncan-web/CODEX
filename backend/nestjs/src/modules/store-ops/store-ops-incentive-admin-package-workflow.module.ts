import { Module } from "@nestjs/common";
import { SalesTargetIncentiveAdminPackageWorkflowService } from "./application/sales-target-incentive-admin-package-workflow.service";
import { StoreOpsIncentivePackageDataModule } from "./store-ops-incentive-package-data.module";

@Module({
  imports: [StoreOpsIncentivePackageDataModule],
  providers: [SalesTargetIncentiveAdminPackageWorkflowService],
  exports: [SalesTargetIncentiveAdminPackageWorkflowService],
})
export class StoreOpsIncentiveAdminPackageWorkflowModule {}
