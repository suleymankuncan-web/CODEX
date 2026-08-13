import "reflect-metadata";
import type { INestApplicationContext } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { OnPremMigrationStatusModule } from "./migration-status.module";
import { OnPremMigrationStatusService } from "./migration-status.service";

async function bootstrap(): Promise<void> {
  let context: INestApplicationContext | undefined;
  try {
    context = await NestFactory.createApplicationContext(OnPremMigrationStatusModule, {
      logger: false,
    });
    const result = await context
      .get(OnPremMigrationStatusService)
      .getStatus(process.cwd());
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch {
    process.stderr.write("migration-status: failed\n");
    process.exitCode = 1;
  } finally {
    await context?.close();
  }
}

void bootstrap();
