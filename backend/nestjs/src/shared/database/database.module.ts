import { Global, Module } from "@nestjs/common";
import { Pool } from "pg";
import { AppConfigService } from "../app-config.service";
import { PG_POOL } from "./database.constants";
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
        new Pool({
          connectionString: config.databaseUrl,
          max: config.dbPoolMax,
          ssl: config.dbSslMode === "require" ? { rejectUnauthorized: false } : false,
        }),
    },
    DatabaseService,
    MigrationService,
  ],
  exports: [PG_POOL, DatabaseService, MigrationService],
})
export class DatabaseModule {}
