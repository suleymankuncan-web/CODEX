import { Module } from "@nestjs/common";
import { StoreOpsIncentiveAdminPackageReadModule } from "./store-ops-incentive-admin-package-read.module";
import { StoreOpsIncentiveApprovalModule } from "./store-ops-incentive-approval.module";
import { StoreOpsIncentiveManagerPackageModule } from "./store-ops-incentive-manager-package.module";

@Module({
  imports: [
    StoreOpsIncentiveAdminPackageReadModule,
    StoreOpsIncentiveApprovalModule,
    StoreOpsIncentiveManagerPackageModule,
  ],
  exports: [
    StoreOpsIncentiveAdminPackageReadModule,
    StoreOpsIncentiveApprovalModule,
    StoreOpsIncentiveManagerPackageModule,
  ],
})
export class StoreOpsIncentivePackageDataModule {}
