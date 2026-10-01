import { Module } from "@nestjs/common";
import { RankingReportingReadRepository } from "./infrastructure/ranking-reporting-read.repository";
import { StoreMonthlyReportPackageService } from "./application/store-monthly-report-package.service";
import { StoreMonthlyReportPackageRepository } from "./infrastructure/store-monthly-report-package.repository";
import { StoreOpsRankingModule } from "./store-ops-ranking.module";

// One workbook ownership shared by the unchanged monthly API and mail polling.
@Module({imports:[StoreOpsRankingModule],providers:[StoreMonthlyReportPackageService,StoreMonthlyReportPackageRepository,RankingReportingReadRepository],exports:[StoreMonthlyReportPackageService]})
export class StoreOpsReportWorkbookModule {}
