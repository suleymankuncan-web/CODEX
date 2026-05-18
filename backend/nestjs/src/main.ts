import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { AppConfigService } from "./shared/app-config.service";
import { configureHttpSecurity } from "./shared/http/configure-http-security";
import {
  ObservabilityService,
  resolveNestLogLevels,
} from "./shared/observability/observability.service";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(AppConfigService);
  const observabilityService = app.get(ObservabilityService);

  app.useLogger(resolveNestLogLevels(config.logLevel));

  observabilityService.installProcessHandlers();
  observabilityService.logStartupState("api");

  configureHttpSecurity(app, config, observabilityService);

  await app.listen(config.port);
}

void bootstrap();
