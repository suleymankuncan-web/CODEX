import { INestApplication, ValidationPipe } from "@nestjs/common";
import { AppConfigService } from "../app-config.service";
import { createCorsAllowlistMiddleware } from "./cors-allowlist.middleware";
import { createRateLimitMiddleware } from "./rate-limit.middleware";
import { StandardErrorFilter } from "./standard-error.filter";

export function configureHttpSecurity(
  app: INestApplication,
  config: Pick<
    AppConfigService,
    "corsAllowedOrigins" | "rateLimitMax" | "rateLimitWindowMs"
  >,
): void {
  app.setGlobalPrefix("api");
  app.use(createCorsAllowlistMiddleware(config.corsAllowedOrigins));
  app.use(
    createRateLimitMiddleware({
      max: config.rateLimitMax,
      windowMs: config.rateLimitWindowMs,
    }),
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new StandardErrorFilter());
}
