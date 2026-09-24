import { Module } from "@nestjs/common";
import { SalesTargetIncentiveAdminPackageReadRepository } from "./infrastructure/sales-target-incentive-admin-package-read.repository";
import { SalesTargetIncentiveManagerPackageReadRepository } from "./infrastructure/sales-target-incentive-manager-package-read.repository";

@Module({
  providers: [SalesTargetIncentiveAdminPackageReadRepository, SalesTargetIncentiveManagerPackageReadRepository],
  exports: [SalesTargetIncentiveAdminPackageReadRepository, SalesTargetIncentiveManagerPackageReadRepository],
})
export class StoreOpsIncentiveAdminPackageReadModule {}
