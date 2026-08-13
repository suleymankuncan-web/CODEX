import { Module } from "@nestjs/common";
import { OnPremDatabaseModule } from "./onprem-database.module";
import { OnPremMigrationStatusService } from "./migration-status.service";

@Module({
  imports: [OnPremDatabaseModule],
  providers: [OnPremMigrationStatusService],
  exports: [OnPremMigrationStatusService],
})
export class OnPremMigrationStatusModule {}
