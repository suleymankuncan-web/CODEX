import { Module } from "@nestjs/common";
import { StoreOpsIncentiveParticipationModule } from "./store-ops-incentive-participation.module";
import { StoreOpsReturnsReadModule } from "./store-ops-returns-read.module";

/** Bounded workspace dependencies: participation decisions and seller reads. */
@Module({
  imports: [StoreOpsIncentiveParticipationModule, StoreOpsReturnsReadModule],
  exports: [StoreOpsIncentiveParticipationModule, StoreOpsReturnsReadModule],
})
export class StoreOpsIncentiveWorkspaceDataModule {}
