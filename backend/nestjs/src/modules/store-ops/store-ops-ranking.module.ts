import { Module } from "@nestjs/common";
import { StoreOpsRankingCacheModule } from "./store-ops-ranking-cache.module";
import { ClosedRankingService } from "./application/closed-ranking.service";
import { LiveMonthlyLeaderboardService } from "./application/live-monthly-leaderboard.service";
import { RankingService } from "./application/ranking.service";
import { ClosedRankingRepository } from "./infrastructure/closed-ranking.repository";
import { KpiConfigRepository } from "./infrastructure/kpi-config.repository";
import { RankingReportingReadRepository } from "./infrastructure/ranking-reporting-read.repository";
import { ReportingRepository } from "./infrastructure/reporting.repository";
import { StorePerformanceReportingReadRepository } from "./infrastructure/store-performance-reporting-read.repository";

@Module({
  imports: [StoreOpsRankingCacheModule],
  providers: [
    RankingService,
    ClosedRankingService,
    LiveMonthlyLeaderboardService,
    ReportingRepository,
    KpiConfigRepository,
    ClosedRankingRepository,
    RankingReportingReadRepository,
    StorePerformanceReportingReadRepository,
  ],
  exports: [
    RankingService,
    ClosedRankingService,
    LiveMonthlyLeaderboardService,
  ],
})
export class StoreOpsRankingModule {}
