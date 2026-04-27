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

  get port(): number {
    return Number(this.readString("APP_PORT", "3000"));
  }

  get appName(): string {
    return this.readString("APP_NAME", "store-ops-backend");
  }

  get authMode(): string {
    const fallback = this.isProduction ? "jwt" : "mock";
    return this.readString("AUTH_MODE", fallback);
  }

  get allowMockAuth(): boolean {
    const value = this.configService.get<string>("ALLOW_MOCK_AUTH");
    return value === "true" || (!this.isProduction && value !== "false");
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
    return value;
  }

  get authAuthorizationUrl(): string | undefined {
    const value = this.configService.get<string>("AUTH_AUTHORIZATION_URL");
    if (!value || value === "undefined" || value === "null") {
      return undefined;
    }
    return value;
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
    return this.readString("AUTH_RESPONSE_TYPE", "code");
  }

  get authTokenUrl(): string | undefined {
    const value = this.configService.get<string>("AUTH_TOKEN_URL");
    if (!value || value === "undefined" || value === "null") {
      return undefined;
    }
    return value;
  }

  get authAudienceOverride(): string | undefined {
    const value = this.configService.get<string>("AUTH_AUDIENCE_OVERRIDE");
    if (!value || value === "undefined" || value === "null") {
      return undefined;
    }
    return value;
  }

  get authCallbackPath(): string {
    return this.readString("AUTH_CALLBACK_PATH", "/auth/callback");
  }

  get authLogoutUrl(): string | undefined {
    const value = this.configService.get<string>("AUTH_LOGOUT_URL");
    if (!value || value === "undefined" || value === "null") {
      return undefined;
    }
    return value;
  }

  get authPostLogoutRedirectPath(): string {
    return this.readString("AUTH_POST_LOGOUT_REDIRECT_PATH", "/auth/login");
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
