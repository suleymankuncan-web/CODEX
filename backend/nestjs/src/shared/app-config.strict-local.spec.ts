import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AppConfigService } from "./app-config.service";
import { STRICT_LOCAL_KEYCLOAK_JWKS_URL } from "./secret-file-config";

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

function createStrictLocalCookieValues() {
  const directory = mkdtempSync(join(tmpdir(), "hr-axis-local-cookie-bundle-"));
  const secretPath = join(directory, "browser-session-secret");
  writeFileSync(secretPath, "0123456789abcdef0123456789ABCDEF", {
    encoding: "utf8",
    mode: 0o600,
  });
  chmodSync(secretPath, 0o600);

  const { JWT_SECRET_FILE: _jwtSecretFile, ...values } = createStrictLocalValues();
  return {
    ...values,
    BROWSER_SESSION_COOKIE_ENABLED: "true",
    BROWSER_SESSION_SECRET_FILE: secretPath,
  };
}

function createStrictLocalJwksValues(overrides: Record<string, string | undefined> = {}) {
  const values = createStrictLocalCookieValues();
  return {
    ...values,
    AUTH_AUTHORIZATION_URL:
      "https://hr-axis.example.invalid/realms/store-ops/protocol/openid-connect/auth",
    AUTH_CLIENT_ID: "store-ops-admin-web",
    AUTH_LOGOUT_URL:
      "https://hr-axis.example.invalid/realms/store-ops/protocol/openid-connect/logout",
    AUTH_MODE: "jwt",
    AUTH_TOKEN_URL:
      "https://hr-axis.example.invalid/realms/store-ops/protocol/openid-connect/token",
    JWT_ISSUER: "https://hr-axis.example.invalid/realms/store-ops",
    JWT_JWKS_URL: STRICT_LOCAL_KEYCLOAK_JWKS_URL,
    ...overrides,
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

  it("allows the DB-only identity binder only with a file-backed subject manifest", () => {
    const directory = mkdtempSync(join(tmpdir(), "hr-axis-keycloak-subjects-"));
    const manifestPath = join(directory, "subjects.v1.json");
    writeFileSync(
      manifestPath,
      JSON.stringify({ schemaVersion: "onprem-keycloak-subjects-v1" }),
      { encoding: "utf8", mode: 0o600 },
    );
    chmodSync(manifestPath, 0o600);
    const {
      JWT_SECRET_FILE: _jwtSecretFile,
      QUEUE_BACKEND: _queueBackend,
      REDIS_URL_FILE: _redisUrlFile,
      ...databaseOnlyValues
    } = createStrictLocalValues();

    const config = createConfig({
      ...databaseOnlyValues,
      HR_AXIS_PROCESS_ROLE: "identity-binder",
      KEYCLOAK_SYNTHETIC_SUBJECT_MANIFEST_FILE: manifestPath,
      NODE_ENV: "production",
    });

    expect(config.keycloakSyntheticSubjectManifest).toContain(
      "onprem-keycloak-subjects-v1",
    );
    expect(() =>
      createConfig({
        ...databaseOnlyValues,
        HR_AXIS_PROCESS_ROLE: "identity-binder",
        NODE_ENV: "production",
      }),
    ).toThrow(
      "KEYCLOAK_SYNTHETIC_SUBJECT_MANIFEST_FILE is required when HR_AXIS_STRICT_LOCAL=true",
    );
  });

  it("rejects an unknown process role", () => {
    expect(() =>
      createConfig({
        ...createStrictLocalValues(),
        HR_AXIS_PROCESS_ROLE: "maintenance",
      }),
    ).toThrow(
      "HR_AXIS_PROCESS_ROLE must be runtime, migrator, synthetic-seed, or identity-binder",
    );
  });

  it.each([
    ["ERROR_TRACKING_DSN", "https://telemetry.example.invalid/1"],
    ["AUTH_CLIENT_SECRET", "external-client-secret"],
    ["QWEN_API_KEY", "synthetic-provider-key"],
    ["VISUAL_COMPARISON_WORKER_ENABLED", "true"],
    ["PHOTO_MEDIA_STORAGE_ENABLED", "true"],
    ["PHOTO_MEDIA_PRIMARY_ENDPOINT", "https://storage.example.invalid"],
    ["JWT_JWKS_URL", "http://keycloak:8080/realms/other/protocol/openid-connect/certs"],
    ["JWT_ISSUER", "http://keycloak:8080/realms/store-ops"],
    ["AUTH_AUTHORIZATION_URL", "http://keycloak:8080/realms/store-ops/protocol/openid-connect/auth"],
    ["AUTH_TOKEN_URL", "http://keycloak:8080/realms/store-ops/protocol/openid-connect/token"],
    ["AUTH_LOGOUT_URL", "http://keycloak:8080/realms/store-ops/protocol/openid-connect/logout"],
  ])("rejects external provider configuration %s", (key, value) => {
    expect(() => createConfig({ ...createStrictLocalValues(), [key]: value })).toThrow(
      (key.startsWith("AUTH_") || key.startsWith("JWT_")) &&
        key !== "AUTH_CLIENT_SECRET"
        ? "strict-local mode"
        : "External provider configuration is not allowed when HR_AXIS_STRICT_LOCAL=true",
    );
  });

  it("allows HTTPS OIDC metadata with the exact internal Keycloak JWKS exception", () => {
    const config = createConfig(createStrictLocalJwksValues());

    expect(config.jwtJwksUrl).toBe(STRICT_LOCAL_KEYCLOAK_JWKS_URL);
    expect(config.jwtIssuer).toBe("https://hr-axis.example.invalid/realms/store-ops");
    expect(() => config.jwtSecret).toThrow(
      "JWT_SECRET is not used when JWT_JWKS_URL is configured in strict-local mode",
    );
  });

  it.each([
    ["JWT_JWKS_URL", "https://hr-axis.example.invalid/realms/store-ops/protocol/openid-connect/certs"],
    ["JWT_JWKS_URL", "https://hr-axis.example.invalid/.well-known/jwks.json"],
    ["JWT_JWKS_URL", `${STRICT_LOCAL_KEYCLOAK_JWKS_URL}/`],
    ["JWT_JWKS_URL", `${STRICT_LOCAL_KEYCLOAK_JWKS_URL}?realm=store-ops`],
    ["AUTH_TOKEN_URL", "https://hr-axis.example.invalid/realms/store-ops/protocol/openid-connect/userinfo"],
    ["JWT_ISSUER", "https://hr-axis.example.invalid/realms/store-ops#fragment"],
  ])("rejects strict-local OIDC near-matches %s", (key, value) => {
    expect(() => createConfig({ ...createStrictLocalValues(), [key]: value })).toThrow(
      "strict-local mode",
    );
  });

  it.each([
    "JWT_ISSUER",
    "AUTH_AUTHORIZATION_URL",
    "AUTH_TOKEN_URL",
    "AUTH_LOGOUT_URL",
    "AUTH_CLIENT_ID",
  ] as const)("requires the exact internal JWKS URL when %s is configured", (key) => {
    expect(() =>
      createConfig({
        ...createStrictLocalValues(),
        [key]: key === "AUTH_CLIENT_ID" ? "store-ops-admin-web" : "https://hr-axis.example.invalid/metadata",
      }),
    ).toThrow("ONP-3 OIDC metadata requires the exact internal Keycloak JWKS URL in strict-local mode");
  });

  it("treats a normalized undefined JWKS value as unset for the JWT secret file requirement", () => {
    const { JWT_SECRET_FILE: _jwtSecretFile, ...values } = createStrictLocalValues();

    expect(() => createConfig({ ...values, JWT_JWKS_URL: "undefined" })).toThrow(
      "JWT_SECRET_FILE is required when HR_AXIS_STRICT_LOCAL=true",
    );
  });

  it.each([
    "JWT_ISSUER",
    "AUTH_AUTHORIZATION_URL",
    "AUTH_TOKEN_URL",
    "AUTH_LOGOUT_URL",
    "AUTH_CLIENT_ID",
  ] as const)("requires %s when the internal JWKS URL is configured", (key) => {
    const values = createStrictLocalJwksValues();
    delete (values as Record<string, string | undefined>)[key];

    expect(() => createConfig(values)).toThrow(`${key} is required when the internal Keycloak JWKS URL is configured`);
  });

  it.each([
    ["AUTH_MODE", "oidc", "AUTH_MODE=jwt is required"],
    [
      "BROWSER_SESSION_COOKIE_ENABLED",
      "false",
      "BROWSER_SESSION_COOKIE_ENABLED=true is required",
    ],
    ["JWT_SECRET_FILE", "forbidden-jwt-file", "JWT_SECRET and JWT_SECRET_FILE are not allowed"],
  ] as const)("rejects incoherent internal JWKS bundle setting %s", (key, value, message) => {
    expect(() => createConfig(createStrictLocalJwksValues({ [key]: value }))).toThrow(message);
  });

  it.each([
    [
      "JWT_ISSUER",
      "https://hr-axis.example.invalid/other",
      "JWT_ISSUER must be https://<host>/realms/store-ops",
    ],
    [
      "AUTH_AUTHORIZATION_URL",
      "https://other.example.invalid/realms/store-ops/protocol/openid-connect/auth",
      "must share the issuer origin",
    ],
    [
      "AUTH_TOKEN_URL",
      "https://hr-axis.example.invalid:8443/realms/store-ops/protocol/openid-connect/token",
      "must share the issuer origin",
    ],
    [
      "AUTH_LOGOUT_URL",
      "https://hr-axis.example.invalid/realms/store-ops/protocol/openid-connect/userinfo",
      "valid HTTPS OIDC URL",
    ],
    [
      "JWT_ISSUER",
      "https://user:pass@hr-axis.example.invalid/realms/store-ops",
      "valid HTTPS OIDC URL",
    ],
  ] as const)("rejects incoherent internal JWKS URL bundle %s", (key, value, message) => {
    expect(() => createConfig(createStrictLocalJwksValues({ [key]: value }))).toThrow(message);
  });

  it("requires a file-backed browser-session secret in strict-local mode", () => {
    const directory = mkdtempSync(join(tmpdir(), "hr-axis-local-cookie-"));
    const secretPath = join(directory, "browser-session-secret");
    writeFileSync(secretPath, "0123456789abcdef0123456789ABCDEF", {
      encoding: "utf8",
      mode: 0o600,
    });
    chmodSync(secretPath, 0o600);

    const config = createConfig({
      ...createStrictLocalValues(),
      BROWSER_SESSION_COOKIE_ENABLED: "true",
      BROWSER_SESSION_SECRET_FILE: secretPath,
    });

    expect(config.browserSessionSecret).toBe("0123456789abcdef0123456789ABCDEF");
    expect(() =>
      createConfig({
        ...createStrictLocalValues(),
        BROWSER_SESSION_COOKIE_ENABLED: "true",
      }),
    ).toThrow("BROWSER_SESSION_SECRET_FILE is required when HR_AXIS_STRICT_LOCAL=true");
    expect(() =>
      createConfig({
        ...createStrictLocalValues(),
        BROWSER_SESSION_COOKIE_ENABLED: "true",
        BROWSER_SESSION_SECRET: "0123456789abcdef0123456789ABCDEF",
      }),
    ).toThrow("Plaintext sensitive settings are not allowed when HR_AXIS_STRICT_LOCAL=true");
  });
});
