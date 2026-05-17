import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { WorkerModule } from "./worker.module";
import {
  ObservabilityService,
  resolveNestLogLevels,
} from "./shared/observability/observability.service";

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: resolveNestLogLevels(process.env.LOG_LEVEL),
  });
  const logger = new Logger("WorkerBootstrap");
  const observabilityService = app.get(ObservabilityService);

  observabilityService.installProcessHandlers();
  observabilityService.logStartupState("worker");

  const shutdown = async (signal: string) => {
    logger.log(`Received ${signal}, shutting down worker context`);
    await app.close();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  logger.log("BullMQ worker context started");
}

void bootstrap();
