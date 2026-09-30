import { Module } from "@nestjs/common";
import { SalesTargetIncentiveWorkspaceReadService } from "./application/sales-target-incentive-workspace-read.service";
import { SalesTargetIncentiveCorrectionRepository } from "./infrastructure/sales-target-incentive-correction.repository";
import { SalesTargetIncentiveWorkspaceReadRepository } from "./infrastructure/sales-target-incentive-workspace-read.repository";
import { StoreOpsIncentiveParticipationModule } from "./store-ops-incentive-participation.module";
import { SalesTargetIncentiveWorkspaceController } from "./web/sales-target-incentive-workspace.controller";

@Module({
  imports: [StoreOpsIncentiveParticipationModule],
  controllers: [SalesTargetIncentiveWorkspaceController],
  providers: [
    SalesTargetIncentiveCorrectionRepository,
    SalesTargetIncentiveWorkspaceReadRepository,
    SalesTargetIncentiveWorkspaceReadService,
  ],
})
export class StoreOpsIncentiveWorkspaceModule {}
