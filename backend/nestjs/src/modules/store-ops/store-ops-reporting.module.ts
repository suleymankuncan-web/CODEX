import { Module } from "@nestjs/common";
import { StoreOpsOrgModule } from "./store-ops-org.module";
import { StoreOpsRankingModule } from "./store-ops-ranking.module";
import { StoreOpsReportingReadModule } from "./store-ops-reporting-read.module";
import { StoreOpsSnapshotModule } from "./store-ops-snapshot.module";
import { StoreOpsWorkforceModule } from "./store-ops-workforce.module";

@Module({
  imports: [
    StoreOpsOrgModule,
    StoreOpsWorkforceModule,
    StoreOpsSnapshotModule,
    StoreOpsRankingModule,
    StoreOpsReportingReadModule,
  ],
  controllers: [],
  providers: [],
  exports: [
    StoreOpsOrgModule,
    StoreOpsWorkforceModule,
    StoreOpsSnapshotModule,
    StoreOpsRankingModule,
    StoreOpsReportingReadModule,
  ],
})
export class StoreOpsReportingModule {}
