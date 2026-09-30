import { Module } from "@nestjs/common";
import { StoreOpsIncentiveProjectionModule } from "./store-ops-incentive-projection.module";
import { SalesTargetIncentiveParticipationRepository } from "./infrastructure/sales-target-incentive-participation.repository";
import { SalesTargetIncentiveParticipationService } from "./application/sales-target-incentive-participation.service";

@Module({
  imports: [StoreOpsIncentiveProjectionModule],
  providers: [SalesTargetIncentiveParticipationRepository, SalesTargetIncentiveParticipationService],
  exports: [StoreOpsIncentiveProjectionModule, SalesTargetIncentiveParticipationService],
})
export class StoreOpsIncentiveParticipationModule {}
