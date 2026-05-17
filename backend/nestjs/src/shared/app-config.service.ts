import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService) {}

  private readString(key: string, fallback: string): string {
    const value = this.configService.get<string>(key);

    if (!value || value === "undefined" || value === "null") {
      return fallback;
    }

    return value;
  }

  private readOptionalString(key: string): string | undefined {
    const value = this.configService.get<string>(key);

    if (!value || value === "undefined" || value === "null") {
      return undefined;
    }

    return value;
  }

  private readPositiveNumber(key: string, fallback: string): number {
    const value = Number(this.readString(key, fallback));

    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`${key} must be a positive number`);
    }

    return value;
  }

  private readRequiredProductionNumber(key: string, fallback: string): number {
    const value = this.readOptionalString(key);

    if (this.isProduction && !value) {
      throw new Error(`${key} must be configured in production`);
    }

    return this.readPositiveNumber(key, fallback);
  }

  private readNonNegativeInteger(key: string, fallback: string): number {
    const value = Number(this.readString(key, fallback));

    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`${key} must be a non-negative integer`);
    }

    return value;
  }

  private readRequiredProductionNonNegativeInteger(
    key: string,
    fallback: string,
  ): number {
    const value = this.readOptionalString(key);

    if (this.isProduction && !value) {
      throw new Error(`${key} must be configured in production`);
    }

    return this.readNonNegativeInteger(key, fallback);
  }

  private requireProductionHttpsUrl(
    key: string,
    value: string | undefined,
  ): string | undefined {
    if (!value || !this.isProduction) {
      return value;
    }

    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      throw new Error(`${key} must be a valid URL in production`);
    }

    if (parsed.protocol !== "https:") {
      throw new Error(`${key} must use https in production`);
    }

    return value;
  }

  private requireProductionSameOriginPath(key: string, value: string): string {
    if (!this.isProduction) {
      return value;
    }

    if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
      throw new Error(`${key} must be a same-origin path in production`);
    }

    return value;
  }

  get port(): number {
    return Number(
      this.readOptionalString("APP_PORT") ??
        this.readOptionalString("PORT") ??
        "3000",
    );
  }

  get appName(): string {
    return this.readString("APP_NAME", "store-ops-backend");
  }

  get authMode(): string {
    const fallback = this.isProduction ? "jwt" : "mock";
    const value = this.readString("AUTH_MODE", fallback);

    if (this.isProduction && value === "mock") {
      throw new Error("AUTH_MODE=mock is not allowed in production");
    }

    return value;
  }

  get authProviderKey(): string {
    return this.readString("AUTH_PROVIDER_KEY", "oidc");
  }

  get allowMockAuth(): boolean {
    if (this.isProduction) {
      return false;
    }

    const value = this.configService.get<string>("ALLOW_MOCK_AUTH");
    return value === "true" || value !== "false";
  }

  get httpMigrationEndpointEnabled(): boolean {
    if (this.isProduction) {
      return false;
    }

    return this.readString("MIGRATIONS_HTTP_ENABLED", "true") !== "false";
  }

  get corsAllowedOrigins(): string[] {
    const value = this.readOptionalString("CORS_ALLOWED_ORIGINS");

    if (this.isProduction && !value) {
      throw new Error("CORS_ALLOWED_ORIGINS must be configured in production");
    }

    const origins = (value ?? "http://localhost:5173")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);

    if (this.isProduction) {
      for (const origin of origins) {
        if (origin === "*") {
          throw new Error("CORS_ALLOWED_ORIGINS must use explicit https origins in production");
        }

        let parsed: URL;
        try {
          parsed = new URL(origin);
        } catch {
          throw new Error("CORS_ALLOWED_ORIGINS must use explicit https origins in production");
        }

        if (parsed.protocol !== "https:") {
          throw new Error("CORS_ALLOWED_ORIGINS must use explicit https origins in production");
        }
      }
    }

    return origins;
  }

  get rateLimitWindowMs(): number {
    return this.readRequiredProductionNumber("RATE_LIMIT_WINDOW_MS", "60000");
  }

  get rateLimitMax(): number {
    return this.readRequiredProductionNumber("RATE_LIMIT_MAX", "120");
  }

  get trustProxyHops(): number {
    return this.readRequiredProductionNonNegativeInteger("TRUST_PROXY_HOPS", "0");
  }

  get logLevel(): string {
    const value = this.readString("LOG_LEVEL", "info");
    const allowedValues = new Set(["error", "warn", "info", "debug", "verbose"]);

    if (!allowedValues.has(value)) {
      throw new Error("LOG_LEVEL must be one of error, warn, info, debug, verbose");
    }

    return value;
  }

  get errorTrackingDsn(): string | undefined {
    return this.requireProductionHttpsUrl(
      "ERROR_TRACKING_DSN",
      this.readOptionalString("ERROR_TRACKING_DSN"),
    );
  }

  get errorTrackingEnvironment(): string {
    return this.readString(
      "ERROR_TRACKING_ENVIRONMENT",
      this.isProduction ? "production" : "development",
    );
  }

  get errorTrackingRelease(): string | undefined {
    return this.readOptionalString("ERROR_TRACKING_RELEASE");
  }

  get readinessProfile(): string {
    const value = this.readString("READINESS_PROFILE", "controlled-pilot");
    const allowedValues = new Set(["controlled-pilot", "broad-production"]);

    if (!allowedValues.has(value)) {
      throw new Error(
        "READINESS_PROFILE must be one of controlled-pilot, broad-production",
      );
    }

    return value;
  }

  get isProduction(): boolean {
    return this.readString("NODE_ENV", "development") === "production";
  }

  get databaseUrl(): string {
    return this.readString(
      "DATABASE_URL",
      "postgres://postgres:postgres@localhost:5432/store_ops",
    );
  }

  get dbPoolMax(): number {
    return Number(this.readString("DB_POOL_MAX", "20"));
  }

  get dbSslMode(): string {
    return this.readString("DB_SSL_MODE", "disable");
  }

  get jwtAudience(): string {
    return this.readString("JWT_AUDIENCE", "store-ops-api");
  }

  get jwtIssuer(): string {
    return this.readString("JWT_ISSUER", "store-ops-auth");
  }

  get jwtSecret(): string {
    const value = this.readOptionalString("JWT_SECRET");

    if (
      this.isProduction &&
      !this.jwtJwksUrl &&
      (!value || value === "change-me")
    ) {
      throw new Error(
        "JWT_SECRET must be configured when JWT_JWKS_URL is not set in production",
      );
    }

    return value ?? "change-me";
  }

  get jwtJwksUrl(): string | undefined {
    const value = this.configService.get<string>("JWT_JWKS_URL");
    if (!value || value === "undefined" || value === "null") {
      return undefined;
    }
    return this.requireProductionHttpsUrl("JWT_JWKS_URL", value);
  }

  get authAuthorizationUrl(): string | undefined {
    const value = this.configService.get<string>("AUTH_AUTHORIZATION_URL");
    if (!value || value === "undefined" || value === "null") {
      return undefined;
    }
    return this.requireProductionHttpsUrl("AUTH_AUTHORIZATION_URL", value);
  }

  get authClientId(): string | undefined {
    const value = this.configService.get<string>("AUTH_CLIENT_ID");
    if (!value || value === "undefined" || value === "null") {
      return undefined;
    }
    return value;
  }

  get authScope(): string {
    return this.readString("AUTH_SCOPE", "openid profile email");
  }

  get authResponseType(): string {
    const value = this.readString("AUTH_RESPONSE_TYPE", "code");

    if (this.isProduction && value !== "code") {
      throw new Error("AUTH_RESPONSE_TYPE=code is required in production");
    }

    return value;
  }

  get authTokenUrl(): string | undefined {
    const value = this.configService.get<string>("AUTH_TOKEN_URL");
    if (!value || value === "undefined" || value === "null") {
      return undefined;
    }
    return this.requireProductionHttpsUrl("AUTH_TOKEN_URL", value);
  }

  get authAudienceOverride(): string | undefined {
    const value = this.configService.get<string>("AUTH_AUDIENCE_OVERRIDE");
    if (!value || value === "undefined" || value === "null") {
      return undefined;
    }
    return value;
  }

  get authCallbackPath(): string {
    return this.requireProductionSameOriginPath(
      "AUTH_CALLBACK_PATH",
      this.readString("AUTH_CALLBACK_PATH", "/auth/callback"),
    );
  }

  get authLogoutUrl(): string | undefined {
    const value = this.configService.get<string>("AUTH_LOGOUT_URL");
    if (!value || value === "undefined" || value === "null") {
      return undefined;
    }
    return this.requireProductionHttpsUrl("AUTH_LOGOUT_URL", value);
  }

  get authPostLogoutRedirectPath(): string {
    return this.requireProductionSameOriginPath(
      "AUTH_POST_LOGOUT_REDIRECT_PATH",
      this.readString("AUTH_POST_LOGOUT_REDIRECT_PATH", "/auth/login"),
    );
  }

  get queueBackend(): string {
    return this.readString("QUEUE_BACKEND", "in-memory");
  }

  get redisUrl(): string {
    return this.readString("REDIS_URL", "redis://localhost:6379");
  }

  get importQueueName(): string {
    return this.readString("QUEUE_IMPORT_NAME", "store-ops-import");
  }

  get snapshotQueueName(): string {
    return this.readString("QUEUE_SNAPSHOT_NAME", "store-ops-snapshot");
  }

  get dailyClosureAutomationEnabled(): boolean {
    return this.readString("DAILY_CLOSURE_AUTOMATION_ENABLED", "false") === "true";
  }

  get dailyClosurePollMinutes(): number {
    return Number(this.readString("DAILY_CLOSURE_POLL_MINUTES", "15"));
  }

  get dailyClosureActorUserId(): string {
    return this.readString(
      "DAILY_CLOSURE_ACTOR_USER_ID",
      "00000000-0000-0000-0000-000000000998",
    );
  }
}
