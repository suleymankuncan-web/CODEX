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
});
