import { Module } from "@nestjs/common";
import { ReportingService } from "./application/reporting.service";
import { StoreMonthlyReportPackageService } from "./application/store-monthly-report-package.service";
import { ClosedRankingRepository } from "./infrastructure/closed-ranking.repository";
import { KpiConfigRepository } from "./infrastructure/kpi-config.repository";
import { RankingReportingReadRepository } from "./infrastructure/ranking-reporting-read.repository";
import { ReportingRepository } from "./infrastructure/reporting.repository";
import { SnapshotReportingReadRepository } from "./infrastructure/snapshot-reporting-read.repository";
import { StorePerformanceReportingReadRepository } from "./infrastructure/store-performance-reporting-read.repository";
import { StoreMonthlyReportPackageRepository } from "./infrastructure/store-monthly-report-package.repository";
import { StoreScoreReportingReadRepository } from "./infrastructure/store-score-reporting-read.repository";
import { ReportingController } from "./web/reporting.controller";
import { StoreOpsRankingModule } from "./store-ops-ranking.module";

@Module({
  imports: [StoreOpsRankingModule],
  controllers: [ReportingController],
  providers: [
    ReportingService,
    StoreMonthlyReportPackageService,
    ReportingRepository,
    StoreMonthlyReportPackageRepository,
    KpiConfigRepository,
    StoreScoreReportingReadRepository,
    ClosedRankingRepository,
    SnapshotReportingReadRepository,
    StorePerformanceReportingReadRepository,
    RankingReportingReadRepository,
  ],
  exports: [ReportingService],
})
export class StoreOpsReportingReadModule {}
