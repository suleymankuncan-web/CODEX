import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AppConfigService } from "./app-config.service";

function createConfig(values: Record<string, string | undefined>) {
  return new AppConfigService({
    get: (key: string) => values[key],
  } as never);
}

function createStrictLocalValues() {
  const directory = mkdtempSync(join(tmpdir(), "hr-axis-local-config-"));
  const writeSecret = (name: string, value: string) => {
    const filePath = join(directory, name);
    writeFileSync(filePath, value, { encoding: "utf8", mode: 0o600 });
    chmodSync(filePath, 0o600);
    return filePath;
  };

  return {
    DB_SSL_CA_FILE: writeSecret(
      "database-ca",
      "-----BEGIN CERTIFICATE-----\nsynthetic-ca\n-----END CERTIFICATE-----",
    ),
    DATABASE_URL_FILE: writeSecret(
      "database-url",
      "postgres://runtime:synthetic@database.example.invalid/hr_axis",
    ),
    DB_SSL_MODE: "verify-full",
    HR_AXIS_DATA_CLASS: "synthetic",
    HR_AXIS_STRICT_LOCAL: "true",
    JWT_SECRET_FILE: writeSecret("jwt-secret", "synthetic-jwt-secret-value"),
    QUEUE_BACKEND: "bullmq",
    REDIS_URL_FILE: writeSecret(
      "redis-url",
      "redis://:synthetic@redis.example.invalid:6379",
    ),
  };
}

describe("AppConfigService strict-local", () => {
  it("loads database, CA, Redis, and JWT settings only from files", () => {
    const config = createConfig(createStrictLocalValues());

    expect(config.isStrictLocal).toBe(true);
    expect(config.dataClass).toBe("synthetic");
    expect(config.databaseUrl).toContain("database.example.invalid");
    expect(config.dbSslCa).toContain("synthetic-ca");
    expect(config.redisUrl).toContain("redis.example.invalid");
    expect(config.jwtSecret).toBe("synthetic-jwt-secret-value");
  });

  it("requires synthetic data and file-backed sensitive settings", () => {
    expect(() =>
      createConfig({
        HR_AXIS_DATA_CLASS: "company",
        HR_AXIS_STRICT_LOCAL: "true",
      }),
    ).toThrow("HR_AXIS_DATA_CLASS=synthetic is required when HR_AXIS_STRICT_LOCAL=true");

    expect(() =>
      createConfig({
        DATABASE_URL: "postgres://plaintext.example.invalid/hr_axis",
        HR_AXIS_DATA_CLASS: "synthetic",
        HR_AXIS_STRICT_LOCAL: "true",
      }),
    ).toThrow("Plaintext sensitive settings are not allowed when HR_AXIS_STRICT_LOCAL=true");

    const { JWT_SECRET_FILE: _jwtSecretFile, ...withoutJwtSecretFile } =
      createStrictLocalValues();
    expect(() => createConfig(withoutJwtSecretFile)).toThrow(
      "JWT_SECRET_FILE is required when HR_AXIS_STRICT_LOCAL=true",
    );
  });

  it.each(["migrator", "synthetic-seed"] as const)(
    "allows the DB-only %s process to omit runtime JWT, Redis, and queue settings",
    (processRole) => {
      const {
        JWT_SECRET_FILE: _jwtSecretFile,
        QUEUE_BACKEND: _queueBackend,
        REDIS_URL_FILE: _redisUrlFile,
        ...databaseOnlyValues
      } = createStrictLocalValues();

      const config = createConfig({
        ...databaseOnlyValues,
        HR_AXIS_PROCESS_ROLE: processRole,
        NODE_ENV: "production",
      });

      expect(config.databaseUrl).toContain("database.example.invalid");
      expect(config.dbSslMode).toBe("verify-full");
    },
  );

  it("rejects an unknown process role", () => {
    expect(() =>
      createConfig({
        ...createStrictLocalValues(),
        HR_AXIS_PROCESS_ROLE: "maintenance",
      }),
    ).toThrow("HR_AXIS_PROCESS_ROLE must be runtime, migrator, or synthetic-seed");
  });

  it.each([
    ["ERROR_TRACKING_DSN", "https://telemetry.example.invalid/1"],
    ["QWEN_API_KEY", "synthetic-provider-key"],
    ["VISUAL_COMPARISON_WORKER_ENABLED", "true"],
    ["PHOTO_MEDIA_STORAGE_ENABLED", "true"],
    ["PHOTO_MEDIA_PRIMARY_ENDPOINT", "https://storage.example.invalid"],
    ["JWT_JWKS_URL", "https://identity.example.invalid/.well-known/jwks.json"],
    ["JWT_ISSUER", "https://identity.example.invalid/realms/hr-axis"],
    ["AUTH_AUTHORIZATION_URL", "https://identity.example.invalid/authorize"],
    ["AUTH_TOKEN_URL", "https://identity.example.invalid/token"],
    ["AUTH_LOGOUT_URL", "https://identity.example.invalid/logout"],
    ["AUTH_CLIENT_ID", "onprem-client-before-onp3"],
    ["BROWSER_SESSION_COOKIE_ENABLED", "true"],
  ])("rejects external provider configuration %s", (key, value) => {
    expect(() => createConfig({ ...createStrictLocalValues(), [key]: value })).toThrow(
      "External provider configuration is not allowed when HR_AXIS_STRICT_LOCAL=true",
    );
  });
});
