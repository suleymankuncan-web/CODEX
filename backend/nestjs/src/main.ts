import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { AppConfigService } from "./shared/app-config.service";
import { configureHttpSecurity } from "./shared/http/configure-http-security";
import {
  ObservabilityService,
  resolveNestLogLevels,
} from "./shared/observability/observability.service";
import { RuntimeReadinessService } from "./onprem/runtime-readiness.service";
import { installGracefulShutdown } from "./shared/graceful-shutdown";
import { Logger } from "@nestjs/common";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  try {
    const config = app.get(AppConfigService);
    const observabilityService = app.get(ObservabilityService);
    const runtimeReadiness = app.get(RuntimeReadinessService);
    const logger = new Logger("ApiBootstrap");

    app.useLogger(resolveNestLogLevels(config.logLevel));

    observabilityService.installProcessHandlers();
    observabilityService.logStartupState("api");

    await runtimeReadiness.assertReady("api");

    const httpSecurityResource = configureHttpSecurity(
      app,
      config,
      observabilityService,
    );
    installGracefulShutdown({
      logger,
      resources: [
        ...(httpSecurityResource ? [httpSecurityResource] : []),
        { close: () => app.close() },
      ],
      timeoutMs: 25_000,
    });

    await app.listen(config.port);
  } catch (error) {
    await app.close().catch(() => undefined);
    throw error;
  }
}

void bootstrap().catch(() => {
  new Logger("ApiBootstrap").error("API startup failed");
  process.exit(1);
});
