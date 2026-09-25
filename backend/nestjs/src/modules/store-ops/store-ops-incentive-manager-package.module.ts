import { Module } from "@nestjs/common";
import { SalesTargetIncentiveManagerPackageReadRepository } from "./infrastructure/sales-target-incentive-manager-package-read.repository";
import { SalesTargetIncentiveManagerPackageRepository } from "./infrastructure/sales-target-incentive-manager-package.repository";

@Module({
  providers: [SalesTargetIncentiveManagerPackageRepository, SalesTargetIncentiveManagerPackageReadRepository],
  exports: [SalesTargetIncentiveManagerPackageRepository, SalesTargetIncentiveManagerPackageReadRepository],
})
export class StoreOpsIncentiveManagerPackageModule {}
