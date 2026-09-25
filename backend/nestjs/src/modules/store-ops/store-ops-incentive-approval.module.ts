import { Module } from "@nestjs/common";
import { SalesTargetIncentiveApprovalRepository } from "./infrastructure/sales-target-incentive-approval.repository";

@Module({
  providers: [SalesTargetIncentiveApprovalRepository],
  exports: [SalesTargetIncentiveApprovalRepository],
})
export class StoreOpsIncentiveApprovalModule {}
