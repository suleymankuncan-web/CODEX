import { INestApplication, ValidationPipe } from "@nestjs/common";
import { AppConfigService } from "../app-config.service";
import { createCorsAllowlistMiddleware } from "./cors-allowlist.middleware";
import { createRateLimitMiddleware } from "./rate-limit.middleware";
import { createSecurityHeadersMiddleware } from "./security-headers.middleware";
import { StandardErrorFilter } from "./standard-error.filter";

type HttpApplicationWithSettings = {
  set(name: string, value: number | boolean): void;
};

export function configureHttpSecurity(
  app: INestApplication,
  config: Pick<
    AppConfigService,
    "corsAllowedOrigins" | "rateLimitMax" | "rateLimitWindowMs" | "trustProxyHops"
  >,
): void {
  configureTrustProxy(app, config.trustProxyHops ?? 0);
  app.setGlobalPrefix("api");
  app.use(createSecurityHeadersMiddleware());
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

function configureTrustProxy(
  app: INestApplication,
  trustProxyHops: number,
): void {
  const httpInstance = app.getHttpAdapter().getInstance() as Partial<
    HttpApplicationWithSettings
  >;

  if (typeof httpInstance.set === "function") {
    httpInstance.set("trust proxy", trustProxyHops);
  }
}
