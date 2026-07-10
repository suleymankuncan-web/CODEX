import { Global, Module } from "@nestjs/common";
import { Pool } from "pg";
import { AppConfigService } from "../app-config.service";
import { PG_POOL } from "./database.constants";
import { buildDatabasePoolConfig } from "./database-pool-config";
import { DatabaseService } from "./database.service";
import { MigrationService } from "./migration.service";
import { MigrationsController } from "./migrations.controller";

@Global()
@Module({
  controllers: [MigrationsController],
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
  exports: [PG_POOL, DatabaseService, MigrationService],
})
export class DatabaseModule {}
