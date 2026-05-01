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

  it("uses oidc as the default auth provider key for JWT user mapping", () => {
    const config = createConfig({
      NODE_ENV: "development",
    });

    expect(config.authProviderKey).toBe("oidc");
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
});
