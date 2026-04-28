import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../src/app.module";
import { MigrationService } from "../src/shared/database/migration.service";

async function main() {
  const logger = new Logger("MigrationCli");
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn", "log"],
  });

  try {
    const migrationService = app.get(MigrationService);
    const result = await migrationService.runMigrations(process.cwd());
    logger.log(JSON.stringify({ event: "migration.completed", ...result }));
  } catch (error) {
    logger.error(
      JSON.stringify({
        errorMessage: error instanceof Error ? error.message : String(error),
        event: "migration.failed",
      }),
    );
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void main();
