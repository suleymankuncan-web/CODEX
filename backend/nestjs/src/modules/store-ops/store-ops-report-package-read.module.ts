import { Module } from "@nestjs/common";
import { StoreOpsReportWorkbookModule } from "./store-ops-report-workbook.module";
import { StoreMonthlyReportPackageController } from "./web/store-monthly-report-package.controller";

@Module({
  imports: [StoreOpsReportWorkbookModule],
  controllers: [StoreMonthlyReportPackageController],
  providers: [],
})
export class StoreOpsReportPackageReadModule {}
