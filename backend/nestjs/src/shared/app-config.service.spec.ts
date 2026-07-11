import { AppConfigService } from "./app-config.service";

function createConfig(values: Record<string, string | undefined>) {
  return new AppConfigService({
    get: (key: string) => values[key],
  } as never);
}

describe("AppConfigService", () => {
  it.each([
    ["DB_POOL_MAX", "0"],
    ["DB_POOL_MAX", "1.5"],
    ["DB_CONNECTION_TIMEOUT_MS", "not-a-number"],
    ["DB_IDLE_TIMEOUT_MS", "-1"],
    ["DB_QUERY_TIMEOUT_MS", "Infinity"],
    ["DB_STATEMENT_TIMEOUT_MS", "0"],
    ["DAILY_CLOSURE_POLL_MINUTES", "2.5"],
  ])("rejects invalid resilience numeric config %s=%s during construction", (key, value) => {
    expect(() => createConfig({ [key]: value })).toThrow(`${key} must be a positive integer`);
  });

  it("maps valid database timeout and scheduler polling configuration", () => {
    const config = createConfig({
      DAILY_CLOSURE_POLL_MINUTES: "30",
      DB_CONNECTION_TIMEOUT_MS: "7000",
      DB_IDLE_TIMEOUT_MS: "45000",
      DB_POOL_MAX: "8",
      DB_QUERY_TIMEOUT_MS: "95000",
      DB_STATEMENT_TIMEOUT_MS: "90000",
    });

    expect(config.dbPoolMax).toBe(8);
    expect(config.dbConnectionTimeoutMs).toBe(7000);
    expect(config.dbIdleTimeoutMs).toBe(45000);
    expect(config.dbQueryTimeoutMs).toBe(95000);
    expect(config.dbStatementTimeoutMs).toBe(90000);
    expect(config.dailyClosurePollMinutes).toBe(30);
  });

  it("rejects a client query timeout shorter than the server statement timeout", () => {
    expect(() =>
      createConfig({
        DB_QUERY_TIMEOUT_MS: "59999",
        DB_STATEMENT_TIMEOUT_MS: "60000",
      }),
    ).toThrow("DB_QUERY_TIMEOUT_MS must be greater than or equal to DB_STATEMENT_TIMEOUT_MS");
  });

  it("keeps controlled-pilot production deployable with encrypted-unverified TLS", () => {
    const config = createConfig({
      DB_SSL_MODE: "require",
      NODE_ENV: "production",
      READINESS_PROFILE: "controlled-pilot",
    });

    expect(config.dbSslMode).toBe("require");
    expect(config.databaseTransportStatus).toBe("encrypted-unverified");
  });

  it("requires verify-full and provider CA input for broad production", () => {
    expect(
      () =>
        createConfig({
          DB_SSL_MODE: "require",
          NODE_ENV: "production",
          READINESS_PROFILE: "broad-production",
        }).dbSslMode,
    ).toThrow("DB_SSL_MODE=verify-full is required when READINESS_PROFILE=broad-production");

    expect(
      () =>
        createConfig({
          DB_SSL_MODE: "verify-full",
          NODE_ENV: "production",
          READINESS_PROFILE: "broad-production",
        }).dbSslMode,
    ).toThrow("DB_SSL_CA must be configured when DB_SSL_MODE=verify-full");
  });

  it("normalizes secret-boundary CA newlines without exposing the value in status", () => {
    const config = createConfig({
      DB_SSL_CA: "-----BEGIN CERTIFICATE-----\\nprovider-ca\\n-----END CERTIFICATE-----",
      DB_SSL_MODE: "verify-full",
    });

    expect(config.dbSslCa).toContain("\nprovider-ca\n");
    expect(config.databaseTransportStatus).toBe("encrypted-verified");
    expect(config.databaseTransportStatus).not.toContain("provider-ca");
  });

  it("keeps the development JWT secret fallback for local work", () => {
    const config = createConfig({
      NODE_ENV: "development",
    });

    expect(config.jwtSecret).toBe("change-me");
  });

  it("uses platform PORT when APP_PORT is not configured", () => {
    const config = createConfig({
      PORT: "4173",
    });

    expect(config.port).toBe(4173);
  });

  it("lets APP_PORT override platform PORT", () => {
    const config = createConfig({
      APP_PORT: "3000",
      PORT: "4173",
    });

    expect(config.port).toBe(3000);
  });

  it("rejects the default JWT secret in production when JWKS is not configured", () => {
    const config = createConfig({
      NODE_ENV: "production",
    });

    expect(() => config.jwtSecret).toThrow(
      "JWT_SECRET must be configured when JWT_JWKS_URL is not set in production",
    );
  });

  it("allows production JWT secret fallback only when JWKS verification is configured", () => {
    const config = createConfig({
      NODE_ENV: "production",
      JWT_JWKS_URL: "https://idp.example.com/.well-known/jwks.json",
    });

    expect(config.jwtSecret).toBe("change-me");
  });

  it("rejects insecure production JWKS URLs", () => {
    const config = createConfig({
      NODE_ENV: "production",
      JWT_JWKS_URL: "http://idp.example.com/.well-known/jwks.json",
    });

    expect(() => config.jwtJwksUrl).toThrow("JWT_JWKS_URL must use https in production");
  });

  it("uses oidc as the default auth provider key for JWT user mapping", () => {
    const config = createConfig({
      NODE_ENV: "development",
    });

    expect(config.authProviderKey).toBe("oidc");
  });

  it("rejects mock auth mode in production", () => {
    const config = createConfig({
      ALLOW_MOCK_AUTH: "true",
      AUTH_MODE: "mock",
      NODE_ENV: "production",
    });

    expect(() => config.authMode).toThrow("AUTH_MODE=mock is not allowed in production");
    expect(config.allowMockAuth).toBe(false);
  });

  it("keeps mock auth available by default only outside production", () => {
    expect(createConfig({ NODE_ENV: "development" }).authMode).toBe("mock");
    expect(createConfig({ NODE_ENV: "development" }).allowMockAuth).toBe(true);
    expect(createConfig({ NODE_ENV: "production" }).authMode).toBe("jwt");
    expect(createConfig({ NODE_ENV: "production" }).allowMockAuth).toBe(false);
  });

  it("allows overriding the auth provider key for Clerk mapping", () => {
    const config = createConfig({
      AUTH_PROVIDER_KEY: "clerk",
      NODE_ENV: "development",
    });

    expect(config.authProviderKey).toBe("clerk");
  });

  it("allows HTTP migration endpoint by default only outside production", () => {
    expect(createConfig({ NODE_ENV: "development" }).httpMigrationEndpointEnabled).toBe(
      true,
    );
    expect(createConfig({ NODE_ENV: "production" }).httpMigrationEndpointEnabled).toBe(
      false,
    );
  });

  it("allows disabling HTTP migration endpoint explicitly outside production", () => {
    expect(
      createConfig({
        MIGRATIONS_HTTP_ENABLED: "false",
        NODE_ENV: "development",
      }).httpMigrationEndpointEnabled,
    ).toBe(false);
  });

  it("does not allow enabling HTTP migration endpoint in production", () => {
    expect(
      createConfig({
        MIGRATIONS_HTTP_ENABLED: "true",
        NODE_ENV: "production",
      }).httpMigrationEndpointEnabled,
    ).toBe(false);
  });

  it("uses localhost as the default CORS origin outside production", () => {
    const config = createConfig({
      NODE_ENV: "development",
    });

    expect(config.corsAllowedOrigins).toEqual(["http://localhost:5173"]);
  });

  it("requires database SSL in production", () => {
    expect(createConfig({ NODE_ENV: "development" }).dbSslMode).toBe("disable");

    expect(() =>
      createConfig({
        DB_SSL_MODE: "disable",
        NODE_ENV: "production",
      }).dbSslMode,
    ).toThrow("DB_SSL_MODE=require or verify-full is required in production");

    expect(
      createConfig({
        DB_SSL_MODE: "require",
        NODE_ENV: "production",
      }).dbSslMode,
    ).toBe("require");
  });

  it("rejects invalid database SSL modes", () => {
    expect(() =>
      createConfig({
        DB_SSL_MODE: "prefer",
      }).dbSslMode,
    ).toThrow("DB_SSL_MODE must be one of disable, require, verify-full");
  });

  it("parses comma-separated CORS origins", () => {
    const config = createConfig({
      CORS_ALLOWED_ORIGINS:
        "https://admin.example.com, https://store.example.com",
      NODE_ENV: "production",
      RATE_LIMIT_MAX: "200",
      RATE_LIMIT_WINDOW_MS: "60000",
    });

    expect(config.corsAllowedOrigins).toEqual([
      "https://admin.example.com",
      "https://store.example.com",
    ]);
  });

  it("rejects wildcard or non-https CORS origins in production", () => {
    expect(() =>
      createConfig({
        CORS_ALLOWED_ORIGINS: "*",
        NODE_ENV: "production",
        RATE_LIMIT_MAX: "200",
        RATE_LIMIT_WINDOW_MS: "60000",
      }).corsAllowedOrigins,
    ).toThrow("CORS_ALLOWED_ORIGINS must use explicit https origins in production");

    expect(() =>
      createConfig({
        CORS_ALLOWED_ORIGINS: "http://admin.example.com",
        NODE_ENV: "production",
        RATE_LIMIT_MAX: "200",
        RATE_LIMIT_WINDOW_MS: "60000",
      }).corsAllowedOrigins,
    ).toThrow("CORS_ALLOWED_ORIGINS must use explicit https origins in production");
  });

  it("requires explicit CORS origins in production", () => {
    const config = createConfig({
      NODE_ENV: "production",
      RATE_LIMIT_MAX: "200",
      RATE_LIMIT_WINDOW_MS: "60000",
    });

    expect(() => config.corsAllowedOrigins).toThrow(
      "CORS_ALLOWED_ORIGINS must be configured in production",
    );
  });

  it("uses local rate limit defaults outside production", () => {
    const config = createConfig({
      NODE_ENV: "development",
    });

    expect(config.rateLimitWindowMs).toBe(60000);
    expect(config.rateLimitMax).toBe(120);
    expect(config.rateLimitBackend).toBe("memory");
    expect(config.rateLimitRedisPrefix).toBe("hr-axis:rate-limit");
  });

  it("uses local upload parse guardrail defaults outside production", () => {
    const config = createConfig({
      NODE_ENV: "development",
    });

    expect(config.uploadParseMaxConcurrency).toBe(1);
    expect(config.uploadParseTimeoutMs).toBe(15000);
  });

  it("accepts explicit upload parse guardrail configuration", () => {
    const config = createConfig({
      UPLOAD_PARSE_MAX_CONCURRENCY: "2",
      UPLOAD_PARSE_TIMEOUT_MS: "30000",
    });

    expect(config.uploadParseMaxConcurrency).toBe(2);
    expect(config.uploadParseTimeoutMs).toBe(30000);
  });

  it("requires explicit upload parse guardrails for broad production readiness", () => {
    expect(() =>
      createConfig({
        NODE_ENV: "production",
        READINESS_PROFILE: "broad-production",
      }).uploadParseMaxConcurrency,
    ).toThrow(
      "UPLOAD_PARSE_MAX_CONCURRENCY must be configured when READINESS_PROFILE=broad-production",
    );

    expect(() =>
      createConfig({
        NODE_ENV: "production",
        READINESS_PROFILE: "broad-production",
        UPLOAD_PARSE_MAX_CONCURRENCY: "1",
      }).uploadParseTimeoutMs,
    ).toThrow(
      "UPLOAD_PARSE_TIMEOUT_MS must be configured when READINESS_PROFILE=broad-production",
    );

    const config = createConfig({
      NODE_ENV: "production",
      READINESS_PROFILE: "broad-production",
      UPLOAD_PARSE_MAX_CONCURRENCY: "1",
      UPLOAD_PARSE_TIMEOUT_MS: "30000",
    });

    expect(config.uploadParseMaxConcurrency).toBe(1);
    expect(config.uploadParseTimeoutMs).toBe(30000);
  });

  it("rejects invalid upload parse guardrails", () => {
    expect(() =>
      createConfig({
        UPLOAD_PARSE_MAX_CONCURRENCY: "0",
      }).uploadParseMaxConcurrency,
    ).toThrow("UPLOAD_PARSE_MAX_CONCURRENCY must be a positive integer");

    expect(() =>
      createConfig({
        UPLOAD_PARSE_TIMEOUT_MS: "100.5",
      }).uploadParseTimeoutMs,
    ).toThrow("UPLOAD_PARSE_TIMEOUT_MS must be a positive integer");
  });

  it("accepts Redis rate limiting configuration", () => {
    const config = createConfig({
      RATE_LIMIT_BACKEND: "redis",
      RATE_LIMIT_REDIS_PREFIX: "custom:rate-limit",
    });

    expect(config.rateLimitBackend).toBe("redis");
    expect(config.rateLimitRedisPrefix).toBe("custom:rate-limit");
  });

  it("requires Redis rate limiting for broad production readiness", () => {
    expect(() =>
      createConfig({
        CORS_ALLOWED_ORIGINS: "https://admin.example.com",
        NODE_ENV: "production",
        RATE_LIMIT_BACKEND: "memory",
        RATE_LIMIT_MAX: "200",
        RATE_LIMIT_WINDOW_MS: "60000",
        READINESS_PROFILE: "broad-production",
      }).rateLimitBackend,
    ).toThrow(
      "RATE_LIMIT_BACKEND=redis is required when READINESS_PROFILE=broad-production",
    );

    expect(
      createConfig({
        CORS_ALLOWED_ORIGINS: "https://admin.example.com",
        NODE_ENV: "production",
        RATE_LIMIT_BACKEND: "redis",
        RATE_LIMIT_MAX: "200",
        RATE_LIMIT_WINDOW_MS: "60000",
        READINESS_PROFILE: "broad-production",
        REDIS_URL: "redis://cache.example.internal:6379",
      }).rateLimitBackend,
    ).toBe("redis");
  });

  it("requires Redis URL when Redis rate limiting is enabled in production", () => {
    expect(() =>
      createConfig({
        CORS_ALLOWED_ORIGINS: "https://admin.example.com",
        NODE_ENV: "production",
        RATE_LIMIT_BACKEND: "redis",
        RATE_LIMIT_MAX: "200",
        RATE_LIMIT_WINDOW_MS: "60000",
      }).rateLimitBackend,
    ).toThrow(
      "REDIS_URL must be configured in production when RATE_LIMIT_BACKEND=redis",
    );
  });

  it("rejects unknown rate limit backends", () => {
    expect(() =>
      createConfig({
        RATE_LIMIT_BACKEND: "file",
      }).rateLimitBackend,
    ).toThrow("RATE_LIMIT_BACKEND must be one of memory, redis");
  });

  it("uses local queue defaults outside production", () => {
    const config = createConfig({
      NODE_ENV: "development",
    });

    expect(config.queueBackend).toBe("in-memory");
    expect(config.redisUrl).toBe("redis://localhost:6379");
    expect(config.importQueueName).toBe("store-ops-import");
    expect(config.snapshotQueueName).toBe("store-ops-snapshot");
  });

  it("accepts BullMQ queue configuration", () => {
    const config = createConfig({
      QUEUE_BACKEND: "bullmq",
      QUEUE_IMPORT_NAME: "imports",
      QUEUE_SNAPSHOT_NAME: "snapshots",
      REDIS_URL: "redis://cache.example.internal:6379",
    });

    expect(config.queueBackend).toBe("bullmq");
    expect(config.redisUrl).toBe("redis://cache.example.internal:6379");
    expect(config.importQueueName).toBe("imports");
    expect(config.snapshotQueueName).toBe("snapshots");
  });

  it("requires BullMQ for broad production queue durability", () => {
    expect(() =>
      createConfig({
        NODE_ENV: "production",
        QUEUE_BACKEND: "in-memory",
        READINESS_PROFILE: "broad-production",
      }).queueBackend,
    ).toThrow(
      "QUEUE_BACKEND=bullmq is required when READINESS_PROFILE=broad-production",
    );

    expect(
      createConfig({
        NODE_ENV: "production",
        QUEUE_BACKEND: "bullmq",
        READINESS_PROFILE: "broad-production",
        REDIS_URL: "redis://cache.example.internal:6379",
      }).queueBackend,
    ).toBe("bullmq");
  });

  it("requires Redis URL when BullMQ is enabled in production", () => {
    expect(() =>
      createConfig({
        NODE_ENV: "production",
        QUEUE_BACKEND: "bullmq",
      }).queueBackend,
    ).toThrow("REDIS_URL must be configured in production when QUEUE_BACKEND=bullmq");
  });

  it("rejects unknown queue backends", () => {
    expect(() =>
      createConfig({
        QUEUE_BACKEND: "filesystem",
      }).queueBackend,
    ).toThrow("QUEUE_BACKEND must be one of in-memory, bullmq");
  });

  it("uses no trusted proxy hops by default outside production", () => {
    const config = createConfig({
      NODE_ENV: "development",
    });

    expect(config.trustProxyHops).toBe(0);
  });

  it("requires explicit rate limit settings in production", () => {
    const config = createConfig({
      CORS_ALLOWED_ORIGINS: "https://admin.example.com",
      NODE_ENV: "production",
    });

    expect(() => config.rateLimitWindowMs).toThrow(
      "RATE_LIMIT_WINDOW_MS must be configured in production",
    );
    expect(() => config.rateLimitMax).toThrow(
      "RATE_LIMIT_MAX must be configured in production",
    );
  });

  it("requires explicit trusted proxy hops in production", () => {
    const config = createConfig({
      CORS_ALLOWED_ORIGINS: "https://admin.example.com",
      NODE_ENV: "production",
      RATE_LIMIT_MAX: "200",
      RATE_LIMIT_WINDOW_MS: "60000",
    });

    expect(() => config.trustProxyHops).toThrow(
      "TRUST_PROXY_HOPS must be configured in production",
    );
  });

  it("parses trusted proxy hops as a non-negative integer", () => {
    expect(
      createConfig({
        NODE_ENV: "production",
        TRUST_PROXY_HOPS: "0",
      }).trustProxyHops,
    ).toBe(0);
    expect(
      createConfig({
        NODE_ENV: "production",
        TRUST_PROXY_HOPS: "1",
      }).trustProxyHops,
    ).toBe(1);

    expect(() =>
      createConfig({
        NODE_ENV: "development",
        TRUST_PROXY_HOPS: "-1",
      }).trustProxyHops,
    ).toThrow("TRUST_PROXY_HOPS must be a non-negative integer");
    expect(() =>
      createConfig({
        NODE_ENV: "development",
        TRUST_PROXY_HOPS: "1.5",
      }).trustProxyHops,
    ).toThrow("TRUST_PROXY_HOPS must be a non-negative integer");
  });

  it("defaults observability settings to log-only controlled pilot mode", () => {
    const config = createConfig({
      NODE_ENV: "development",
    });

    expect(config.logLevel).toBe("info");
    expect(config.errorTrackingDsn).toBeUndefined();
    expect(config.errorTrackingEnableRequested).toBe(false);
    expect(config.errorTrackingEnabled).toBe(false);
    expect(config.errorTrackingEnvironment).toBe("development");
    expect(config.errorTrackingRelease).toBeUndefined();
    expect(config.errorTrackingSmokeEnabled).toBe(false);
    expect(config.readinessProfile).toBe("controlled-pilot");
  });

  it("accepts explicit production observability settings", () => {
    const config = createConfig({
      ERROR_TRACKING_DSN: "https://example.invalid/123",
      ERROR_TRACKING_ENABLED: "true",
      ERROR_TRACKING_ENVIRONMENT: "staging",
      ERROR_TRACKING_RELEASE: "a1b2c3d",
      ERROR_TRACKING_SMOKE: "true",
      LOG_LEVEL: "warn",
      NODE_ENV: "production",
      READINESS_PROFILE: "broad-production",
    });

    expect(config.logLevel).toBe("warn");
    expect(config.errorTrackingDsn).toBe("https://example.invalid/123");
    expect(config.errorTrackingEnableRequested).toBe(true);
    expect(config.errorTrackingEnabled).toBe(true);
    expect(config.errorTrackingEnvironment).toBe("staging");
    expect(config.errorTrackingRelease).toBe("a1b2c3d");
    expect(config.errorTrackingSmokeEnabled).toBe(false);
    expect(config.readinessProfile).toBe("broad-production");
  });

  it("allows the startup smoke only for controlled staging", () => {
    const config = createConfig({
      ERROR_TRACKING_ENVIRONMENT: "staging",
      ERROR_TRACKING_SMOKE: "true",
      READINESS_PROFILE: "controlled-pilot",
    });

    expect(config.errorTrackingSmokeEnabled).toBe(true);
  });

  it("rejects invalid observability config values", () => {
    expect(() =>
      createConfig({
        LOG_LEVEL: "chatty",
      }).logLevel,
    ).toThrow("LOG_LEVEL must be one of error, warn, info, debug, verbose");

    expect(() =>
      createConfig({
        READINESS_PROFILE: "public-launch",
      }).readinessProfile,
    ).toThrow("READINESS_PROFILE must be one of controlled-pilot, broad-production");

    expect(() =>
      createConfig({
        ERROR_TRACKING_DSN: "http://errors.example.com/123",
        NODE_ENV: "production",
      }).errorTrackingDsn,
    ).toThrow("ERROR_TRACKING_DSN must use https in production");

    expect(() =>
      createConfig({
        ERROR_TRACKING_ENABLED: "sometimes",
      }).errorTrackingEnabled,
    ).toThrow("ERROR_TRACKING_ENABLED must be true or false");

    expect(
      createConfig({
        ERROR_TRACKING_ENABLED: "true",
      }).errorTrackingEnabled,
    ).toBe(false);
    expect(
      createConfig({
        ERROR_TRACKING_ENABLED: "true",
      }).errorTrackingEnableRequested,
    ).toBe(true);
  });

  it("requires authorization code flow and https provider endpoints in production", () => {
    expect(() =>
      createConfig({
        AUTH_RESPONSE_TYPE: "token",
        NODE_ENV: "production",
      }).authResponseType,
    ).toThrow("AUTH_RESPONSE_TYPE=code is required in production");

    expect(() =>
      createConfig({
        AUTH_AUTHORIZATION_URL: "http://idp.example.com/auth",
        NODE_ENV: "production",
      }).authAuthorizationUrl,
    ).toThrow("AUTH_AUTHORIZATION_URL must use https in production");

    expect(() =>
      createConfig({
        AUTH_TOKEN_URL: "http://idp.example.com/token",
        NODE_ENV: "production",
      }).authTokenUrl,
    ).toThrow("AUTH_TOKEN_URL must use https in production");
  });

  it("requires same-origin auth callback paths in production", () => {
    expect(() =>
      createConfig({
        AUTH_CALLBACK_PATH: "https://evil.example.com/auth/callback",
        NODE_ENV: "production",
      }).authCallbackPath,
    ).toThrow("AUTH_CALLBACK_PATH must be a same-origin path in production");

    expect(() =>
      createConfig({
        AUTH_POST_LOGOUT_REDIRECT_PATH: "//evil.example.com/login",
        NODE_ENV: "production",
      }).authPostLogoutRedirectPath,
    ).toThrow("AUTH_POST_LOGOUT_REDIRECT_PATH must be a same-origin path in production");
  });

  it("keeps browser cookie sessions disabled by default", () => {
    const config = createConfig({
      NODE_ENV: "development",
    });

    expect(config.browserSessionCookieEnabled).toBe(false);
    expect(config.browserSessionCookieName).toBe("hr_axis_browser_session");
    expect(config.browserSessionCsrfCookieName).toBe("hr_axis_csrf_nonce");
    expect(config.browserSessionSecret).toBeUndefined();
    expect(config.browserSessionPreviousSecret).toBeUndefined();
    expect(config.browserSessionTtlSeconds).toBe(900);
    expect(config.browserSessionRenewalWindowSeconds).toBe(120);
    expect(config.browserSessionSameSite).toBe("lax");
    expect(config.browserSessionCookieSecure).toBe(false);
  });

  it("requires a strong browser session secret for production-like cookie sessions", () => {
    expect(() =>
      createConfig({
        AUTH_MODE: "jwt",
        BROWSER_SESSION_COOKIE_ENABLED: "true",
      }).browserSessionSecret,
    ).toThrow(
      "BROWSER_SESSION_SECRET must be configured when browser cookie sessions are enabled",
    );

    expect(() =>
      createConfig({
        AUTH_MODE: "jwt",
        BROWSER_SESSION_COOKIE_ENABLED: "true",
        BROWSER_SESSION_SECRET: "change-me-browser-session-secret-value",
      }).browserSessionSecret,
    ).toThrow("BROWSER_SESSION_SECRET must be at least 32 characters and non-default");

    expect(
      createConfig({
        AUTH_MODE: "jwt",
        BROWSER_SESSION_COOKIE_ENABLED: "true",
        BROWSER_SESSION_SECRET: "0123456789abcdef0123456789ABCDEF",
      }).browserSessionSecret,
    ).toBe("0123456789abcdef0123456789ABCDEF");
  });

  it("validates optional previous browser session secrets when configured", () => {
    expect(() =>
      createConfig({
        AUTH_MODE: "jwt",
        BROWSER_SESSION_COOKIE_ENABLED: "true",
        BROWSER_SESSION_PREVIOUS_SECRET: "placeholder-browser-session-secret",
        BROWSER_SESSION_SECRET: "0123456789abcdef0123456789ABCDEF",
      }).browserSessionPreviousSecret,
    ).toThrow(
      "BROWSER_SESSION_PREVIOUS_SECRET must be at least 32 characters and non-default",
    );

    expect(() =>
      createConfig({
        AUTH_MODE: "jwt",
        BROWSER_SESSION_COOKIE_ENABLED: "true",
        BROWSER_SESSION_PREVIOUS_SECRET: "0123456789abcdef0123456789ABCDEF",
        BROWSER_SESSION_SECRET: "0123456789abcdef0123456789ABCDEF",
      }).browserSessionPreviousSecret,
    ).toThrow(
      "BROWSER_SESSION_PREVIOUS_SECRET must differ from BROWSER_SESSION_SECRET",
    );

    expect(
      createConfig({
        AUTH_MODE: "jwt",
        BROWSER_SESSION_COOKIE_ENABLED: "true",
        BROWSER_SESSION_PREVIOUS_SECRET: "abcdef0123456789ABCDEF0123456789",
        BROWSER_SESSION_SECRET: "0123456789abcdef0123456789ABCDEF",
      }).browserSessionPreviousSecret,
    ).toBe("abcdef0123456789ABCDEF0123456789");
  });

  it("bounds browser session ttl and renewal windows", () => {
    expect(() =>
      createConfig({
        BROWSER_SESSION_COOKIE_ENABLED: "true",
        BROWSER_SESSION_TTL_SECONDS: "7200",
      }).browserSessionTtlSeconds,
    ).toThrow("BROWSER_SESSION_TTL_SECONDS cannot exceed 3600");

    expect(() =>
      createConfig({
        BROWSER_SESSION_RENEWAL_WINDOW_SECONDS: "900",
        BROWSER_SESSION_TTL_SECONDS: "900",
      }).browserSessionRenewalWindowSeconds,
    ).toThrow(
      "BROWSER_SESSION_RENEWAL_WINDOW_SECONDS must be lower than BROWSER_SESSION_TTL_SECONDS",
    );

    const config = createConfig({
      BROWSER_SESSION_RENEWAL_WINDOW_SECONDS: "300",
      BROWSER_SESSION_TTL_SECONDS: "1800",
    });

    expect(config.browserSessionTtlSeconds).toBe(1800);
    expect(config.browserSessionRenewalWindowSeconds).toBe(300);
  });

  it("validates browser session same-site and cookie enabled values", () => {
    expect(() =>
      createConfig({
        BROWSER_SESSION_COOKIE_ENABLED: "sometimes",
      }).browserSessionCookieEnabled,
    ).toThrow("BROWSER_SESSION_COOKIE_ENABLED must be true or false");

    expect(() =>
      createConfig({
        BROWSER_SESSION_SAME_SITE: "wide",
      }).browserSessionSameSite,
    ).toThrow("BROWSER_SESSION_SAME_SITE must be one of lax, strict, none");

    expect(() =>
      createConfig({
        BROWSER_SESSION_SAME_SITE: "none",
        NODE_ENV: "development",
      }).browserSessionSameSite,
    ).toThrow("BROWSER_SESSION_SAME_SITE=none requires secure cookies");

    expect(() =>
      createConfig({
        BROWSER_SESSION_COOKIE_ENABLED: "true",
        BROWSER_SESSION_SAME_SITE: "none",
        BROWSER_SESSION_SECRET: "0123456789abcdef0123456789ABCDEF",
        NODE_ENV: "production",
      }),
    ).toThrow("BROWSER_SESSION_SAME_SITE=none requires explicit owner approval");

    expect(
      createConfig({
        BROWSER_SESSION_SAME_SITE: "strict",
      }).browserSessionSameSite,
    ).toBe("strict");
  });
});
