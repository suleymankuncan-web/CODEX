import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type QueueBackend = "in-memory" | "bullmq";
export type BrowserSessionSameSite = "lax" | "strict" | "none";
export type DatabaseSslMode = "disable" | "require" | "verify-full";
export type DatabaseTransportStatus =
  | "disabled"
  | "encrypted-unverified"
  | "encrypted-verified";

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService) {
    this.assertBrowserSessionContract();
    this.assertDatabaseNumericContract();
  }

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

  private readPositiveInteger(key: string, fallback: string): number {
    const value = Number(this.readString(key, fallback));

    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`${key} must be a positive integer`);
    }

    return value;
  }

  private readRequiredBroadProductionPositiveInteger(
    key: string,
    fallback: string,
  ): number {
    const value = this.readOptionalString(key);

    if (this.isProduction && this.readinessProfile === "broad-production" && !value) {
      throw new Error(`${key} must be configured when READINESS_PROFILE=broad-production`);
    }

    return this.readPositiveInteger(key, fallback);
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

  private readBoolean(key: string, fallback: boolean): boolean {
    const value = this.readOptionalString(key);

    if (!value) {
      return fallback;
    }

    if (value === "true") {
      return true;
    }

    if (value === "false") {
      return false;
    }

    throw new Error(`${key} must be true or false`);
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

  get rateLimitBackend(): "memory" | "redis" {
    const value = this.readString("RATE_LIMIT_BACKEND", "memory");
    const allowedValues = new Set(["memory", "redis"]);

    if (!allowedValues.has(value)) {
      throw new Error("RATE_LIMIT_BACKEND must be one of memory, redis");
    }

    if (
      this.isProduction &&
      this.readinessProfile === "broad-production" &&
      value !== "redis"
    ) {
      throw new Error(
        "RATE_LIMIT_BACKEND=redis is required when READINESS_PROFILE=broad-production",
      );
    }

    if (this.isProduction && value === "redis" && !this.readOptionalString("REDIS_URL")) {
      throw new Error("REDIS_URL must be configured in production when RATE_LIMIT_BACKEND=redis");
    }

    return value as "memory" | "redis";
  }

  get rateLimitRedisPrefix(): string {
    return this.readString("RATE_LIMIT_REDIS_PREFIX", "hr-axis:rate-limit");
  }

  get uploadParseMaxConcurrency(): number {
    return this.readRequiredBroadProductionPositiveInteger(
      "UPLOAD_PARSE_MAX_CONCURRENCY",
      "1",
    );
  }

  get uploadParseTimeoutMs(): number {
    return this.readRequiredBroadProductionPositiveInteger(
      "UPLOAD_PARSE_TIMEOUT_MS",
      "15000",
    );
  }

  get photoMediaStorageEnabled(): boolean {
    return this.readBoolean("PHOTO_MEDIA_STORAGE_ENABLED", false);
  }

  get checklistEvidenceCaptureEnabled(): boolean {
    return this.readBoolean("CHECKLIST_EVIDENCE_CAPTURE_ENABLED", false);
  }

  get checklistRequiredEvidenceEnforcementEnabled(): boolean {
    return this.readBoolean("CHECKLIST_REQUIRED_EVIDENCE_ENFORCEMENT_ENABLED", false);
  }

  get checklistEvidenceStorageHealthy(): boolean {
    return this.readBoolean("CHECKLIST_EVIDENCE_STORAGE_HEALTHY", false);
  }

  get storeActionPhotoResolutionEnabled(): boolean {
    return this.readBoolean("STORE_ACTION_PHOTO_RESOLUTION_ENABLED", false);
  }

  get regionManagerSolutionReviewEnabled(): boolean {
    return this.readBoolean("REGION_MANAGER_SOLUTION_REVIEW_ENABLED", false);
  }

  get photoMediaSyntheticFixtureSha256Allowlist(): string[] {
    const raw = this.readOptionalString("PHOTO_MEDIA_SYNTHETIC_FIXTURE_SHA256_ALLOWLIST") ?? "";
    const values = [...new Set(raw.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean))];
    if (values.length > 20 || values.some((value) => !/^[a-f0-9]{64}$/.test(value))) {
      throw new Error("PHOTO_MEDIA_SYNTHETIC_FIXTURE_SHA256_ALLOWLIST must contain at most 20 comma-separated SHA-256 digests");
    }
    return values;
  }

  get photoMediaStorageSyntheticOnly(): boolean {
    const value = this.readBoolean("PHOTO_MEDIA_SYNTHETIC_ONLY", true);
    if (this.photoMediaStorageEnabled && !value) {
      throw new Error("PR-3 photo media storage must remain synthetic-only");
    }
    return value;
  }

  get photoMediaStorageConfiguration() {
    const enabled = this.photoMediaStorageEnabled;
    const required = (key: string) => {
      const value = this.readOptionalString(key);
      if (enabled && !value) {
        throw new Error(`${key} must be configured when photo media storage is enabled`);
      }
      return value ?? "";
    };

    const configuration = {
      enabled,
      syntheticOnly: this.photoMediaStorageSyntheticOnly,
      provider: "r2" as const,
      jurisdiction: "eu" as const,
      primaryBucket: required("PHOTO_MEDIA_PRIMARY_BUCKET"),
      recoveryBucket: required("PHOTO_MEDIA_RECOVERY_BUCKET"),
      primaryEndpoint: required("PHOTO_MEDIA_PRIMARY_ENDPOINT"),
      recoveryEndpoint: required("PHOTO_MEDIA_RECOVERY_ENDPOINT"),
      publicDeliveryEnabled: false,
      aggregateBytesHardLimit: this.readPositiveInteger(
        "PHOTO_MEDIA_AGGREGATE_BYTES_HARD_LIMIT",
        String(8 * 1024 * 1024 * 1024),
      ),
      monthlyClassAHardLimit: this.readPositiveInteger(
        "PHOTO_MEDIA_MONTHLY_CLASS_A_HARD_LIMIT",
        "750000",
      ),
      monthlyClassBHardLimit: this.readPositiveInteger(
        "PHOTO_MEDIA_MONTHLY_CLASS_B_HARD_LIMIT",
        "7500000",
      ),
      signedReadTtlSeconds: this.readPositiveInteger(
        "PHOTO_MEDIA_SIGNED_READ_TTL_SECONDS",
        "120",
      ),
      lockSafetyDays: this.readPositiveInteger(
        "PHOTO_MEDIA_LOCK_SAFETY_DAYS",
        "30",
      ),
      perUserDailyBytesHardLimit: this.readPositiveInteger(
        "PHOTO_MEDIA_PER_USER_DAILY_BYTES_HARD_LIMIT",
        String(100 * 1024 * 1024),
      ),
      perStoreDailyBytesHardLimit: this.readPositiveInteger(
        "PHOTO_MEDIA_PER_STORE_DAILY_BYTES_HARD_LIMIT",
        String(250 * 1024 * 1024),
      ),
      concurrentProcessingHardLimit: this.readPositiveInteger(
        "PHOTO_MEDIA_CONCURRENT_PROCESSING_HARD_LIMIT",
        "2",
      ),
      syntheticFixtureSha256Allowlist: this.photoMediaSyntheticFixtureSha256Allowlist,
      safetyAssurance: "fixture_identity_only" as const,
    };

    if (enabled) {
      if (configuration.syntheticFixtureSha256Allowlist.length !== 1) {
        throw new Error(
          "PHOTO_MEDIA_SYNTHETIC_FIXTURE_SHA256_ALLOWLIST must contain exactly one approved synthetic fixture digest when storage is enabled",
        );
      }
      this.photoMediaPrimaryCredentials;
      this.photoMediaRecoveryCredentials;
    }
    return configuration;
  }

  get photoMediaPrimaryCredentials() {
    return this.readPhotoMediaCredentials("PRIMARY");
  }

  get photoMediaRecoveryCredentials() {
    const recovery = this.readPhotoMediaCredentials("RECOVERY");
    if (
      this.photoMediaStorageEnabled &&
      recovery.accessKeyId === this.photoMediaPrimaryCredentials.accessKeyId
    ) {
      throw new Error("Photo media primary and recovery require separate bucket-scoped credentials");
    }
    return recovery;
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

  get errorTrackingEnabled(): boolean {
    return this.errorTrackingEnableRequested && Boolean(this.errorTrackingDsn);
  }

  get errorTrackingEnableRequested(): boolean {
    return this.readBoolean("ERROR_TRACKING_ENABLED", false);
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

  get errorTrackingSmokeEnabled(): boolean {
    return (
      this.readBoolean("ERROR_TRACKING_SMOKE", false) &&
      this.errorTrackingEnvironment === "staging" &&
      this.readinessProfile === "controlled-pilot"
    );
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
    return this.readPositiveInteger("DB_POOL_MAX", "20");
  }

  get dbConnectionTimeoutMs(): number {
    return this.readPositiveInteger("DB_CONNECTION_TIMEOUT_MS", "5000");
  }

  get dbIdleTimeoutMs(): number {
    return this.readPositiveInteger("DB_IDLE_TIMEOUT_MS", "30000");
  }

  get dbQueryTimeoutMs(): number {
    return this.readPositiveInteger("DB_QUERY_TIMEOUT_MS", "65000");
  }

  get dbStatementTimeoutMs(): number {
    const value = this.readPositiveInteger("DB_STATEMENT_TIMEOUT_MS", "60000");

    if (value > this.dbQueryTimeoutMs) {
      throw new Error(
        "DB_QUERY_TIMEOUT_MS must be greater than or equal to DB_STATEMENT_TIMEOUT_MS",
      );
    }

    return value;
  }

  get dbSslMode(): DatabaseSslMode {
    const value = this.readString("DB_SSL_MODE", "disable");
    const allowedValues = new Set(["disable", "require", "verify-full"]);

    if (!allowedValues.has(value)) {
      throw new Error("DB_SSL_MODE must be one of disable, require, verify-full");
    }

    if (this.isProduction && value === "disable") {
      throw new Error("DB_SSL_MODE=require or verify-full is required in production");
    }

    if (
      this.isProduction &&
      this.readinessProfile === "broad-production" &&
      value !== "verify-full"
    ) {
      throw new Error(
        "DB_SSL_MODE=verify-full is required when READINESS_PROFILE=broad-production",
      );
    }

    if (value === "verify-full" && !this.readDatabaseSslCa()) {
      throw new Error("DB_SSL_CA must be configured when DB_SSL_MODE=verify-full");
    }

    return value as DatabaseSslMode;
  }

  get dbSslCa(): string | undefined {
    if (this.dbSslMode !== "verify-full") {
      return undefined;
    }

    return this.readDatabaseSslCa();
  }

  get databaseTransportStatus(): DatabaseTransportStatus {
    if (this.dbSslMode === "disable") {
      return "disabled";
    }

    return this.dbSslMode === "verify-full"
      ? "encrypted-verified"
      : "encrypted-unverified";
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

  get browserSessionCookieEnabled(): boolean {
    return this.readBoolean("BROWSER_SESSION_COOKIE_ENABLED", false);
  }

  get browserSessionCookieName(): string {
    return this.readString("BROWSER_SESSION_COOKIE_NAME", "hr_axis_browser_session");
  }

  get browserSessionCsrfCookieName(): string {
    return this.readString("BROWSER_SESSION_CSRF_COOKIE_NAME", "hr_axis_csrf_nonce");
  }

  get browserSessionSecret(): string | undefined {
    const value = this.readOptionalString("BROWSER_SESSION_SECRET");
    this.validateBrowserSessionSecret("BROWSER_SESSION_SECRET", value);
    return value;
  }

  get browserSessionPreviousSecret(): string | undefined {
    const value = this.readOptionalString("BROWSER_SESSION_PREVIOUS_SECRET");
    this.validateBrowserSessionSecret("BROWSER_SESSION_PREVIOUS_SECRET", value);

    if (value && this.browserSessionSecret && value === this.browserSessionSecret) {
      throw new Error(
        "BROWSER_SESSION_PREVIOUS_SECRET must differ from BROWSER_SESSION_SECRET",
      );
    }

    return value;
  }

  get browserSessionTtlSeconds(): number {
    const value = this.readPositiveInteger("BROWSER_SESSION_TTL_SECONDS", "900");

    if (this.browserSessionCookieEnabled && value > 3600) {
      throw new Error("BROWSER_SESSION_TTL_SECONDS cannot exceed 3600");
    }

    return value;
  }

  get browserSessionRenewalWindowSeconds(): number {
    const value = this.readPositiveInteger(
      "BROWSER_SESSION_RENEWAL_WINDOW_SECONDS",
      "120",
    );

    if (value >= this.browserSessionTtlSeconds) {
      throw new Error(
        "BROWSER_SESSION_RENEWAL_WINDOW_SECONDS must be lower than BROWSER_SESSION_TTL_SECONDS",
      );
    }

    return value;
  }

  get browserSessionSameSite(): BrowserSessionSameSite {
    const value = this.readString("BROWSER_SESSION_SAME_SITE", "lax").toLowerCase();
    const allowedValues = new Set(["lax", "strict", "none"]);

    if (!allowedValues.has(value)) {
      throw new Error("BROWSER_SESSION_SAME_SITE must be one of lax, strict, none");
    }

    if (value === "none" && !this.browserSessionCookieSecure) {
      throw new Error("BROWSER_SESSION_SAME_SITE=none requires secure cookies");
    }

    if (value === "none") {
      throw new Error("BROWSER_SESSION_SAME_SITE=none requires explicit owner approval");
    }

    return value as BrowserSessionSameSite;
  }

  get browserSessionCookieSecure(): boolean {
    return this.isProduction;
  }

  get queueBackend(): QueueBackend {
    const value = this.readString("QUEUE_BACKEND", "in-memory");
    const allowedValues = new Set(["in-memory", "bullmq"]);

    if (!allowedValues.has(value)) {
      throw new Error("QUEUE_BACKEND must be one of in-memory, bullmq");
    }

    if (
      this.isProduction &&
      this.readinessProfile === "broad-production" &&
      value !== "bullmq"
    ) {
      throw new Error(
        "QUEUE_BACKEND=bullmq is required when READINESS_PROFILE=broad-production",
      );
    }

    if (this.isProduction && value === "bullmq" && !this.readOptionalString("REDIS_URL")) {
      throw new Error("REDIS_URL must be configured in production when QUEUE_BACKEND=bullmq");
    }

    return value as QueueBackend;
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
    return this.readPositiveInteger("DAILY_CLOSURE_POLL_MINUTES", "15");
  }

  get dailyClosureActorUserId(): string {
    return this.readString(
      "DAILY_CLOSURE_ACTOR_USER_ID",
      "00000000-0000-0000-0000-000000000998",
    );
  }

  private get browserSessionProductionLike(): boolean {
    return this.isProduction || this.authMode === "jwt";
  }

  private assertBrowserSessionContract(): void {
    if (!this.browserSessionCookieEnabled) {
      return;
    }

    this.browserSessionSecret;
    this.browserSessionPreviousSecret;
    this.browserSessionTtlSeconds;
    this.browserSessionRenewalWindowSeconds;
    this.browserSessionSameSite;
  }

  private assertDatabaseNumericContract(): void {
    this.dbPoolMax;
    this.dbConnectionTimeoutMs;
    this.dbIdleTimeoutMs;
    this.dbStatementTimeoutMs;
    this.dailyClosurePollMinutes;
  }

  private readDatabaseSslCa(): string | undefined {
    const value = this.readOptionalString("DB_SSL_CA");

    if (!value?.trim()) {
      return undefined;
    }

    return value.replace(/\\n/g, "\n");
  }

  private readPhotoMediaCredentials(role: "PRIMARY" | "RECOVERY") {
    const accessKeyId = this.readOptionalString(`PHOTO_MEDIA_${role}_ACCESS_KEY_ID`);
    const secretAccessKey = this.readOptionalString(`PHOTO_MEDIA_${role}_SECRET_ACCESS_KEY`);
    if (this.photoMediaStorageEnabled && !accessKeyId) {
      throw new Error(`PHOTO_MEDIA_${role}_ACCESS_KEY_ID must be configured when photo media storage is enabled`);
    }
    if (this.photoMediaStorageEnabled && !secretAccessKey) {
      throw new Error(`PHOTO_MEDIA_${role}_SECRET_ACCESS_KEY must be configured when photo media storage is enabled`);
    }
    return { accessKeyId: accessKeyId ?? "", secretAccessKey: secretAccessKey ?? "" };
  }

  private validateBrowserSessionSecret(
    key: string,
    value: string | undefined,
  ): void {
    if (!this.browserSessionCookieEnabled) {
      return;
    }

    if (!this.browserSessionProductionLike) {
      return;
    }

    if (!value && key === "BROWSER_SESSION_PREVIOUS_SECRET") {
      return;
    }

    if (!value) {
      throw new Error(`${key} must be configured when browser cookie sessions are enabled`);
    }

    const normalized = value.trim();
    const lower = normalized.toLowerCase();
    const weakValues = new Set([
      "change-me",
      "changeme",
      "placeholder",
      "browser-session-secret",
      "secret",
      "test",
      "dev",
      "local",
    ]);

    if (
      normalized.length < 32 ||
      weakValues.has(lower) ||
      lower.includes("change-me") ||
      lower.includes("placeholder") ||
      /^(.)(\1)+$/.test(normalized) ||
      new Set(normalized).size < 12
    ) {
      throw new Error(`${key} must be at least 32 characters and non-default`);
    }
  }
}
