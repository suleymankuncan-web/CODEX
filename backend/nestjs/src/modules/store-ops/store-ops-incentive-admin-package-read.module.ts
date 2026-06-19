import { Module } from "@nestjs/common";
import { SalesTargetIncentiveAdminPackageReadRepository } from "./infrastructure/sales-target-incentive-admin-package-read.repository";

@Module({
  providers: [SalesTargetIncentiveAdminPackageReadRepository],
  exports: [SalesTargetIncentiveAdminPackageReadRepository],
})
export class StoreOpsIncentiveAdminPackageReadModule {}
