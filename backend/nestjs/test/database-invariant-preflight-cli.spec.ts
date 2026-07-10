import { spawnSync } from "node:child_process";
import { join } from "node:path";

describe("database invariant preflight CLI boundary", () => {
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
