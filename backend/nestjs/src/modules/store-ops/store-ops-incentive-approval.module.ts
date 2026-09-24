import { Module } from "@nestjs/common";
import { SalesTargetIncentiveApprovalRepository } from "./infrastructure/sales-target-incentive-approval.repository";
import { SalesTargetIncentiveManagerPackageRepository } from "./infrastructure/sales-target-incentive-manager-package.repository";

@Module({
  providers: [SalesTargetIncentiveApprovalRepository, SalesTargetIncentiveManagerPackageRepository],
  exports: [SalesTargetIncentiveApprovalRepository, SalesTargetIncentiveManagerPackageRepository],
})
export class StoreOpsIncentiveApprovalModule {}
