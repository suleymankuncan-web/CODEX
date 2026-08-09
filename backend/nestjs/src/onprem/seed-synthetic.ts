import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { SyntheticSeedModule } from "./synthetic-seed.module";
import { SyntheticSeedService } from "./synthetic-seed.service";

async function bootstrap(): Promise<void> {
  const logger = new Logger("SyntheticSeedCli");
  const context = await NestFactory.createApplicationContext(SyntheticSeedModule, {
    logger: ["error", "warn", "log"],
  });

  try {
    const result = await context.get(SyntheticSeedService).run(process.cwd());
    logger.log(JSON.stringify({ event: "onprem.synthetic_seed.completed", ...result }));
  } catch {
    logger.error(JSON.stringify({ event: "onprem.synthetic_seed.failed" }));
    process.exitCode = 1;
  } finally {
    await context.close();
  }
}

void bootstrap();
