import { Module } from "@nestjs/common";
import { SalesTargetIncentiveApiService } from "./application/sales-target-incentive-api.service";
import { SalesTargetIncentiveAutoCloseWorkerService } from "./application/sales-target-incentive-auto-close-worker.service";
import { SalesTargetIncentiveCloseRepository } from "./infrastructure/sales-target-incentive-close.repository";
import { SalesTargetIncentiveCorrectionRepository } from "./infrastructure/sales-target-incentive-correction.repository";
import { StoreOpsIncentiveAdminPackageWorkflowModule } from "./store-ops-incentive-admin-package-workflow.module";
import { StoreOpsIncentiveApprovalModule } from "./store-ops-incentive-approval.module";
import { StoreOpsIncentiveProjectionModule } from "./store-ops-incentive-projection.module";
import { StoreOpsIncentiveWorkflowModule } from "./store-ops-incentive-workflow.module";
import { StoreOpsIncentiveWorkspaceModule } from "./store-ops-incentive-workspace.module";
import { StoreOpsIncentiveFinalApprovalModule } from "./store-ops-incentive-final-approval.module";
import { StoreOpsIncentiveHrHandoffModule } from "./store-ops-incentive-hr-handoff.module";
import { AdminSalesTargetIncentiveController } from "./web/admin-sales-target-incentive.controller";
import { StoreSalesTargetIncentiveController } from "./web/store-sales-target-incentive.controller";

@Module({
  imports: [
    StoreOpsIncentiveAdminPackageWorkflowModule,
    StoreOpsIncentiveApprovalModule,
    StoreOpsIncentiveProjectionModule,
    StoreOpsIncentiveWorkflowModule,
    StoreOpsIncentiveWorkspaceModule,
    StoreOpsIncentiveFinalApprovalModule,
    StoreOpsIncentiveHrHandoffModule,
  ],
  controllers: [
    StoreSalesTargetIncentiveController,
    AdminSalesTargetIncentiveController,
  ],
  providers: [
    SalesTargetIncentiveApiService,
    SalesTargetIncentiveAutoCloseWorkerService,
    SalesTargetIncentiveCorrectionRepository,
    SalesTargetIncentiveCloseRepository,
  ],
  exports: [SalesTargetIncentiveApiService],
})
export class StoreOpsIncentiveModule {}
