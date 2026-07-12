import { spawnSync } from "node:child_process";
import { join } from "node:path";

const databaseScheme = "postgres" + "://";
const disposableUrl =
  `${databaseScheme}fixture_user:fixture_secret@localhost:54329/store_ops_rem8_target_rehearsal_fixture`;

describe("REM-8 TARGET observation CLI boundary", () => {
  // Trace: FR-05, FR-09, FR-10; NFR-01..03, NFR-08; AC-03; EC-16..18.
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
        DATABASE_URL: `${databaseScheme}fixture:secret@staging.example/staging_db`,
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
  ])("refuses $expectedError before connecting and leaks no secret", ({ expectedError, overrides }) => {
    const result = runCli(overrides);
    const output = `${result.stdout}${result.stderr}`;
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stderr)).toMatchObject({
      error: expectedError,
      event: "rem8_target_constraint.observation_failed",
    });
    expect(result.stdout).toBe("");
    expect(output).not.toContain(databaseScheme);
    expect(output).not.toContain("fixture_secret");
    expect(output).not.toContain("staging_db");
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
    "REM8_TARGET_OBSERVATION_REVIEWED_COMMIT",
  ]) delete env[name];
  env.NODE_ENV = "test";
  Object.assign(env, overrides);
  return spawnSync(
    process.execPath,
    ["-r", "ts-node/register", join(process.cwd(), "scripts", "rem8-target-constraint-observation.ts")],
    { cwd: process.cwd(), encoding: "utf8", env },
  );
}
