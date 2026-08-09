import { Module } from "@nestjs/common";
import { OnPremDatabaseModule } from "./onprem-database.module";
import { OnPremMigrationRunnerService } from "./migration-runner.service";

@Module({
  imports: [OnPremDatabaseModule],
  providers: [OnPremMigrationRunnerService],
  exports: [OnPremMigrationRunnerService],
})
export class OnPremMigrationModule {}
