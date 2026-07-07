import { Module } from "@nestjs/common";
import { StoreMonthlyReportPackageService } from "./application/store-monthly-report-package.service";
import { StoreMonthlyReportPackageRepository } from "./infrastructure/store-monthly-report-package.repository";
import { StoreOpsRankingModule } from "./store-ops-ranking.module";
import { StoreMonthlyReportPackageController } from "./web/store-monthly-report-package.controller";

@Module({
  imports: [StoreOpsRankingModule],
  controllers: [StoreMonthlyReportPackageController],
  providers: [StoreMonthlyReportPackageService, StoreMonthlyReportPackageRepository],
})
export class StoreOpsReportPackageReadModule {}
