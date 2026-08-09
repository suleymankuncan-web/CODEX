import { Module } from "@nestjs/common";
import { Pool } from "pg";
import { AppConfigService } from "../shared/app-config.service";
import { PG_POOL } from "../shared/database/database.constants";
import { buildDatabasePoolConfig } from "../shared/database/database-pool-config";
import { DatabaseService } from "../shared/database/database.service";
import { MigrationService } from "../shared/database/migration.service";
import { OnPremConfigModule } from "./onprem-config.module";

@Module({
  imports: [OnPremConfigModule],
  providers: [
    {
      provide: PG_POOL,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) =>
        new Pool(
          buildDatabasePoolConfig({
            connectionTimeoutMs: config.dbConnectionTimeoutMs,
            databaseUrl: config.databaseUrl,
            idleTimeoutMs: config.dbIdleTimeoutMs,
            poolMax: config.dbPoolMax,
            queryTimeoutMs: config.dbQueryTimeoutMs,
            sslCa: config.dbSslCa,
            sslMode: config.dbSslMode,
            statementTimeoutMs: config.dbStatementTimeoutMs,
          }),
        ),
    },
    DatabaseService,
    MigrationService,
  ],
  exports: [AppConfigService, PG_POOL, DatabaseService, MigrationService],
})
export class OnPremDatabaseModule {}
