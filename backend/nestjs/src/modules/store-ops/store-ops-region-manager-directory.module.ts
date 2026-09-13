import { Module } from "@nestjs/common";
import { RegionManagerDirectoryService } from "./application/region-manager-directory.service";
import { RankingReportingReadRepository } from "./infrastructure/ranking-reporting-read.repository";
import { RegionManagerDirectoryController } from "./web/region-manager-directory.controller";

@Module({
  controllers: [RegionManagerDirectoryController],
  providers: [RegionManagerDirectoryService, RankingReportingReadRepository],
  exports: [RegionManagerDirectoryService],
})
export class StoreOpsRegionManagerDirectoryModule {}
