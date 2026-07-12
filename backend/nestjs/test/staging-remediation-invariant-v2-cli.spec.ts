import { spawnSync } from "node:child_process";
import { join } from "node:path";

const databaseScheme = "postgres" + "://";
const disposableUrl =
  `${databaseScheme}fixture_user:fixture_secret@localhost:54329/store_ops_fresh_migration_smoke_preflight`;

// Trace: FR-DIAG-08, FR-DIAG-09, FR-DIAG-11, FR-DEC-08; NFR-01, NFR-02; AC-01, AC-11.
describe("staging remediation invariant V2 CLI boundary", () => {
  it.each([
    { expectedError: "invalid_target_class", overrides: {} },
    {
      expectedError: "approval_missing",
      overrides: { DATABASE_INVARIANT_PREFLIGHT_TARGET: "disposable", DATABASE_URL: disposableUrl },
    },
    {
      expectedError: "reviewed_commit_missing",
      overrides: {
        DATABASE_INVARIANT_PREFLIGHT_ACK: "read-only-approved",
        DATABASE_INVARIANT_PREFLIGHT_TARGET: "disposable",
        DATABASE_URL: disposableUrl,
      },
    },
    {
      expectedError: "staging_approval_missing",
      overrides: {
        DATABASE_INVARIANT_PREFLIGHT_ACK: "read-only-approved",
        DATABASE_INVARIANT_PREFLIGHT_TARGET: "staging",
        DATABASE_URL: `${databaseScheme}fixture_user:fixture_secret@staging.example/store_ops_staging`,
      },
    },
    {
      expectedError: "production_refused",
      overrides: {
        DATABASE_INVARIANT_PREFLIGHT_ACK: "read-only-approved",
        DATABASE_INVARIANT_PREFLIGHT_TARGET: "disposable",
        DATABASE_URL: disposableUrl,
        NODE_ENV: " Production ",
      },
    },
  ])("refuses $expectedError before connecting and prints no secret", ({ expectedError, overrides }) => {
    const result = runCli(overrides);
    const output = `${result.stdout}${result.stderr}`;

    expect(result.status).toBe(1);
    expect(JSON.parse(result.stderr)).toMatchObject({
      error: expectedError,
      event: "staging_remediation_invariant_v2.failed",
    });
    expect(result.stdout).toBe("");
    expect(output).not.toContain(databaseScheme);
    expect(output).not.toContain("fixture_secret");
    expect(output).not.toContain("store_ops_fresh_migration_smoke_preflight");
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
    "STAGING_REMEDIATION_INVARIANT_V2_REVIEWED_COMMIT",
  ]) delete env[name];
  env.NODE_ENV = "test";
  Object.assign(env, overrides);

  return spawnSync(
    process.execPath,
    ["-r", "ts-node/register", join(process.cwd(), "scripts", "staging-remediation-invariant-v2.ts")],
    { cwd: process.cwd(), encoding: "utf8", env },
  );
}
