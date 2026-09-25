import { Module } from "@nestjs/common";
import { StoreOpsIncentiveAdminPackageWorkflowModule } from "./store-ops-incentive-admin-package-workflow.module";
import { IncentiveFinalApprovalController } from "./web/incentive-final-approval.controller";

@Module({
  imports: [StoreOpsIncentiveAdminPackageWorkflowModule],
  controllers: [IncentiveFinalApprovalController],
})
export class StoreOpsIncentiveFinalApprovalModule {}
