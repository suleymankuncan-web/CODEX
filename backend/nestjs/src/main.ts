import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { AppConfigService } from "./shared/app-config.service";
import { configureHttpSecurity } from "./shared/http/configure-http-security";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(AppConfigService);

  configureHttpSecurity(app, config);

  await app.listen(config.port);
}

void bootstrap();
