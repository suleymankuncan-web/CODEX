import { AppConfigService } from "./app-config.service";

function createConfig(values: Record<string, string | undefined>) {
  return new AppConfigService({
    get: (key: string) => values[key],
  } as never);
}

describe("AppConfigService", () => {
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
});
