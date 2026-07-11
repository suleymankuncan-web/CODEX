import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { buildDatabaseInvariantPreflightPoolConfig } from "../scripts/database-invariant-preflight-config";

describe("database invariant preflight CLI boundary", () => {
  it("builds a verified one-connection staging pool and strips URL SSL overrides", () => {
    const result = buildDatabaseInvariantPreflightPoolConfig(
      "staging",
      "postgres://user:secret@staging.example/store_ops_staging?sslmode=disable&application_name=dg2",
      {
        DB_SSL_CA: "test-supabase-ca",
        DB_SSL_MODE: "verify-full",
      },
    );

    expect(result.max).toBe(1);
    expect(result.ssl).toEqual({
      ca: "test-supabase-ca",
      rejectUnauthorized: true,
    });
    const connectionString = new URL(String(result.connectionString));
    expect(connectionString.searchParams.has("sslmode")).toBe(false);
    expect(connectionString.searchParams.get("application_name")).toBe("dg2");
  });

  it.each([
    {
      expectedError: "invalid_target_class",
      overrides: {},
    },
    {
      expectedError: "approval_missing",
      overrides: {
        DATABASE_INVARIANT_PREFLIGHT_TARGET: "disposable",
        DATABASE_URL: "postgres://user:secret@remote.example/store_ops_production",
      },
    },
    {
      expectedError: "non_disposable_target_refused",
      overrides: {
        DATABASE_INVARIANT_PREFLIGHT_ACK: "read-only-approved",
        DATABASE_INVARIANT_PREFLIGHT_TARGET: "disposable",
        DATABASE_URL: "postgres://user:secret@remote.example/store_ops_live",
      },
    },
    {
      expectedError: "production_refused",
      overrides: {
        DATABASE_INVARIANT_PREFLIGHT_ACK: "read-only-approved",
        DATABASE_INVARIANT_PREFLIGHT_TARGET: "disposable",
        DATABASE_URL: "postgres://user:secret@localhost/store_ops_fresh_migration_smoke_preflight",
        NODE_ENV: " Production ",
      },
    },
    {
      expectedError: "staging_target_identity_mismatch",
      overrides: {
        DATABASE_INVARIANT_PREFLIGHT_ACK: "read-only-approved",
        DATABASE_INVARIANT_PREFLIGHT_EXPECTED_DATABASE: "store_ops_staging",
        DATABASE_INVARIANT_PREFLIGHT_EXPECTED_HOST: "different.example",
        DATABASE_INVARIANT_PREFLIGHT_STAGING_APPROVED: "true",
        DATABASE_INVARIANT_PREFLIGHT_TARGET: "staging",
        DATABASE_URL: "postgres://user:secret@staging.example/store_ops_staging",
      },
    },
    {
      expectedError: "staging_verify_full_required",
      overrides: stagingTlsOverrides(),
    },
    {
      expectedError: "staging_verify_full_required",
      overrides: stagingTlsOverrides({ DB_SSL_MODE: "require" }),
    },
    {
      expectedError: "staging_verify_full_required",
      overrides: stagingTlsOverrides({ DB_SSL_MODE: "disable" }),
    },
    {
      expectedError: "invalid_database_ssl_mode",
      overrides: stagingTlsOverrides({ DB_SSL_MODE: "unknown" }),
    },
    {
      expectedError: "staging_ssl_ca_missing",
      overrides: stagingTlsOverrides({ DB_SSL_MODE: "verify-full" }),
    },
  ])("refuses $expectedError before connecting and redacts the URL", ({ expectedError, overrides }) => {
    const result = runCli(overrides);
    const output = `${result.stdout}${result.stderr}`;

    expect(result.status).toBe(1);
    expect(JSON.parse(result.stderr)).toMatchObject({
      error: expectedError,
      event: "database_invariant_preflight.failed",
    });
    expect(output).not.toContain("postgres://");
    expect(output).not.toContain("secret");
    expect(result.stdout).toBe("");
  });
});

function runCli(overrides: Partial<Record<string, string>>) {
  const env = { ...process.env };
  for (const name of [
    "DATABASE_INVARIANT_PREFLIGHT_ACK",
    "DATABASE_INVARIANT_PREFLIGHT_EXPECTED_DATABASE",
    "DATABASE_INVARIANT_PREFLIGHT_EXPECTED_HOST",
    "DATABASE_INVARIANT_PREFLIGHT_STAGING_APPROVED",
    "DATABASE_INVARIANT_PREFLIGHT_TARGET",
    "DATABASE_URL",
    "DB_SSL_CA",
    "DB_SSL_MODE",
  ]) {
    delete env[name];
  }
  env.NODE_ENV = "test";
  Object.assign(env, overrides);

  return spawnSync(
    process.execPath,
    ["-r", "ts-node/register", join(process.cwd(), "scripts", "database-invariant-preflight.ts")],
    { cwd: process.cwd(), encoding: "utf8", env },
  );
}

function stagingTlsOverrides(overrides: Partial<Record<string, string>> = {}) {
  return {
    DATABASE_INVARIANT_PREFLIGHT_ACK: "read-only-approved",
    DATABASE_INVARIANT_PREFLIGHT_EXPECTED_DATABASE: "store_ops_staging",
    DATABASE_INVARIANT_PREFLIGHT_EXPECTED_HOST: "staging.example",
    DATABASE_INVARIANT_PREFLIGHT_STAGING_APPROVED: "true",
    DATABASE_INVARIANT_PREFLIGHT_TARGET: "staging",
    DATABASE_URL: "postgres://user:secret@staging.example/store_ops_staging",
    ...overrides,
  };
}
