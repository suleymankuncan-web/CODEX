import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { OnPremMigrationRunnerService } from "./migration-runner.service";
import { OnPremMigrationModule } from "./migration.module";

async function bootstrap(): Promise<void> {
  const logger = new Logger("OnPremMigrationCli");
  const context = await NestFactory.createApplicationContext(OnPremMigrationModule, {
    logger: ["error", "warn", "log"],
  });

  try {
    const result = await context.get(OnPremMigrationRunnerService).run(process.cwd());
    logger.log(JSON.stringify({ event: "onprem.migration.completed", ...result }));
  } catch {
    logger.error(JSON.stringify({ event: "onprem.migration.failed" }));
    process.exitCode = 1;
  } finally {
    await context.close();
  }
}

void bootstrap();
