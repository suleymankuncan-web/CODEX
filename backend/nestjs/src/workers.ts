import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { WorkerModule } from "./worker.module";
import { AppConfigService } from "./shared/app-config.service";
import {
  ObservabilityService,
  resolveNestLogLevels,
} from "./shared/observability/observability.service";
import { installGracefulShutdown } from "./shared/graceful-shutdown";
import { RuntimeReadinessService } from "./onprem/runtime-readiness.service";

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  try {
    const logger = new Logger("WorkerBootstrap");
    const observabilityService = app.get(ObservabilityService);
    const config = app.get(AppConfigService);
    const runtimeReadiness = app.get(RuntimeReadinessService);

    app.useLogger(resolveNestLogLevels(config.logLevel));

    observabilityService.installProcessHandlers();
    observabilityService.logStartupState("worker");

    await runtimeReadiness.assertReady("worker");

    installGracefulShutdown({
      logger,
      resources: [{ close: () => app.close() }],
      timeoutMs: 40_000,
    });

    logger.log("BullMQ worker context started");
  } catch (error) {
    await app.close().catch(() => undefined);
    throw error;
  }
}

void bootstrap().catch(() => {
  new Logger("WorkerBootstrap").error("Worker startup failed");
  process.exit(1);
});
