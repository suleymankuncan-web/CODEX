import { spawnSync } from "node:child_process";
import { join } from "node:path";

const databaseScheme = "postgres" + "://";
const stagingUrl = `${databaseScheme}fixture:fixture_secret@staging.example/staging_db`;

describe("DB-C5 TARGET apply CLI boundary", () => {
  // Trace: FR-01, FR-08; NFR-01..03; AC-01, AC-04; EC-02, EC-08, EC-10.
  it.each([
    { expectedError: "staging_ddl_approval_missing", overrides: {} },
    {
      expectedError: "database_url_missing",
      overrides: approvalEnvironment(),
    },
    {
      expectedError: "reviewed_commit_missing",
      overrides: {
        ...approvalEnvironment(),
        DATABASE_INVARIANT_PREFLIGHT_EXPECTED_DATABASE: "staging_db",
        DATABASE_INVARIANT_PREFLIGHT_EXPECTED_HOST: "staging.example",
        DATABASE_URL: stagingUrl,
      },
    },
    {
      expectedError: "production_refused",
      overrides: { ...approvalEnvironment(), NODE_ENV: " Production " },
    },
  ])("refuses $expectedError before connecting and leaks no secret", ({ expectedError, overrides }) => {
    const result = runCli(overrides);
    const output = `${result.stdout}${result.stderr}`;
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(JSON.parse(result.stderr)).toMatchObject({
      error: expectedError,
      event: "dbc5_target_constraint.apply_failed",
      stagingDdlExecuted: false,
      targetClass: "staging",
    });
    expect(output).not.toContain(databaseScheme);
    expect(output).not.toContain("fixture_secret");
    expect(output).not.toContain("staging_db");
  });
});

function approvalEnvironment() {
  return {
    DATABASE_INVARIANT_PREFLIGHT_ACK: "staging-ddl-approved",
    DATABASE_INVARIANT_PREFLIGHT_TARGET: "staging",
    DBC5_TARGET_CONSTRAINT_STAGING_APPROVED: "true",
  };
}

function runCli(overrides: Partial<Record<string, string>>) {
  const env = { ...process.env };
  for (const name of [
    "DATABASE_INVARIANT_PREFLIGHT_ACK",
    "DATABASE_INVARIANT_PREFLIGHT_EXPECTED_DATABASE",
    "DATABASE_INVARIANT_PREFLIGHT_EXPECTED_HOST",
    "DATABASE_INVARIANT_PREFLIGHT_TARGET",
    "DATABASE_URL",
    "DBC5_TARGET_CONSTRAINT_REVIEWED_COMMIT",
    "DBC5_TARGET_CONSTRAINT_STAGING_APPROVED",
    "DB_SSL_CA",
    "DB_SSL_MODE",
  ]) delete env[name];
  env.NODE_ENV = "test";
  Object.assign(env, overrides);
  return spawnSync(
    process.execPath,
    ["-r", "ts-node/register", join(process.cwd(), "scripts", "dbc5-target-constraint-apply.ts")],
    { cwd: process.cwd(), encoding: "utf8", env },
  );
}
