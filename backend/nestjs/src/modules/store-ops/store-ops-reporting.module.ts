import { Module } from "@nestjs/common";
import { OrgController } from "./web/org.controller";
import { WorkforceController } from "./web/workforce.controller";
import { SnapshotController } from "./web/snapshot.controller";
import { ReportingController } from "./web/reporting.controller";
import { OrgService } from "./application/org.service";
import { WorkforceService } from "./application/workforce.service";
import { SnapshotService } from "./application/snapshot.service";
import { RankingService } from "./application/ranking.service";
import { ReportingService } from "./application/reporting.service";
import { ClosedRankingService } from "./application/closed-ranking.service";
import { LiveMonthlyLeaderboardService } from "./application/live-monthly-leaderboard.service";
import { StoreOpsRepository } from "./infrastructure/store-ops.repository";
import { WorkforceRequestRepository } from "./infrastructure/workforce-request.repository";
import { ClosedRankingRepository } from "./infrastructure/closed-ranking.repository";
import { RankingReportingReadRepository } from "./infrastructure/ranking-reporting-read.repository";
import { ReportingRepository } from "./infrastructure/reporting.repository";
import { StoreScoreReportingReadRepository } from "./infrastructure/store-score-reporting-read.repository";
import { SnapshotReportingReadRepository } from "./infrastructure/snapshot-reporting-read.repository";
import { StorePerformanceReportingReadRepository } from "./infrastructure/store-performance-reporting-read.repository";
import { SnapshotOperationsRepository } from "./infrastructure/snapshot-operations.repository";
import { SnapshotRunCommandRepository } from "./infrastructure/snapshot-run-command.repository";
import { KpiConfigRepository } from "./infrastructure/kpi-config.repository";

const reportingProviders = [
  OrgService,
  WorkforceService,
  SnapshotService,
  RankingService,
  ReportingService,
  ClosedRankingService,
  LiveMonthlyLeaderboardService,
  StoreOpsRepository,
  WorkforceRequestRepository,
  KpiConfigRepository,
  ClosedRankingRepository,
  RankingReportingReadRepository,
  ReportingRepository,
  StoreScoreReportingReadRepository,
  SnapshotReportingReadRepository,
  StorePerformanceReportingReadRepository,
  SnapshotOperationsRepository,
  SnapshotRunCommandRepository,
];

@Module({
  controllers: [
    OrgController,
    WorkforceController,
    SnapshotController,
    ReportingController,
  ],
  providers: reportingProviders,
  exports: [
    OrgService,
    WorkforceService,
    SnapshotService,
    RankingService,
    ReportingService,
    ClosedRankingService,
    LiveMonthlyLeaderboardService,
    SnapshotOperationsRepository,
  ],
})
export class StoreOpsReportingModule {}
