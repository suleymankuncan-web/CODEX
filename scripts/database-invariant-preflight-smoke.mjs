import { spawnSync } from "node:child_process";
import { join } from "node:path";

const workspaceRoot = join(import.meta.dirname, "..");
const backendDir = join(workspaceRoot, "backend", "nestjs");
const databaseName = "store_ops_fresh_migration_smoke_preflight";
const databaseHost = "localhost";
const databasePort = process.env.MIGRATION_SMOKE_DB_PORT ?? "54329";
const databaseUser = process.env.MIGRATION_SMOKE_DB_USER ?? "postgres";
const databasePassword = process.env.MIGRATION_SMOKE_DB_PASSWORD ?? "postgres";

if (process.env.NODE_ENV === "production") fail("Production execution refused.");

run(process.execPath, ["scripts/migration-fresh-db-smoke.mjs"], {
  cwd: workspaceRoot,
  env: {
    ...process.env,
    MIGRATION_SMOKE_DB_HOST: databaseHost,
    MIGRATION_SMOKE_DB_NAME: databaseName,
    MIGRATION_SMOKE_DB_PORT: databasePort,
    MIGRATION_SMOKE_DB_USER: databaseUser,
    MIGRATION_SMOKE_DB_PASSWORD: databasePassword,
  },
});

const databaseUrl = `postgres://${databaseUser}:${databasePassword}@${databaseHost}:${databasePort}/${databaseName}`;
const cleanResult = parseJson(runNpmCapture("preflight:database:invariants", {
  DATABASE_INVARIANT_PREFLIGHT_ACK: "read-only-approved",
  DATABASE_INVARIANT_PREFLIGHT_TARGET: "disposable",
  DATABASE_URL: databaseUrl,
}));

const requiredCheckIds = [
  "ASSIGN-01", "AUTH-01", "AUTH-02", "KEY-01", "ORG-01", "ORG-02",
  "ORG-03", "ORG-04", "TARGET-01", "TARGET-02", "TARGET-03",
];
if (cleanResult.decision !== "clean_local" || cleanResult.liveEvidence !== "blocked_live_evidence") {
  fail("Clean disposable result crossed the live-evidence boundary.");
}
if (cleanResult.transactionReadOnly !== true || cleanResult.violationCount !== 0) {
  fail("Clean disposable result did not prove read-only zero-violation evidence.");
}
const cleanIds = cleanResult.results?.map((result) => result.checkId).sort();
if (JSON.stringify(cleanIds) !== JSON.stringify(requiredCheckIds)) {
  fail("Clean disposable result did not contain the exact required check inventory.");
}
if (cleanResult.results.some((result) => result.violationCount !== 0)) {
  fail("Freshly migrated disposable database contains invariant violations.");
}
const assignment = cleanResult.results.find((result) => result.checkId === "ASSIGN-01");
if (assignment?.classification !== "requires_business_decision") {
  fail("Clean fixture incorrectly approved unresolved assignment temporal semantics.");
}

const fixtureResult = parseJson(runNpmCapture("smoke:database:invariants:fixture", {
  DATABASE_URL: databaseUrl,
}));
if (fixtureResult.rolledBack !== true) fail("Known-violation fixture did not prove rollback.");

process.stdout.write(`${JSON.stringify({
  cleanCheckCount: cleanIds.length,
  cleanViolationCount: cleanResult.violationCount,
  event: "database_invariant_preflight.smoke_completed",
  fixtureResults: fixtureResult.results,
  fixtureRolledBack: fixtureResult.rolledBack,
  liveEvidence: cleanResult.liveEvidence,
  targetClass: "disposable",
}, null, 2)}\n`);

function runNpmCapture(script, extraEnvironment) {
  const command = npmRun(["run", "--silent", script]);
  return runCapture(command.command, command.args, {
    cwd: backendDir,
    env: { ...process.env, ...extraEnvironment },
  });
}

function npmRun(args) {
  if (process.platform === "win32") {
    return { command: "cmd.exe", args: ["/d", "/s", "/c", ["npm.cmd", ...args].join(" ")] };
  }
  return { command: "npm", args };
}

function run(command, args, options) {
  const result = spawnSync(command, args, { ...options, stdio: "inherit" });
  if (result.error) fail(`Failed to start ${command}: ${result.error.message}`);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function runCapture(command, args, options) {
  const result = spawnSync(command, args, { ...options, encoding: "utf8" });
  if (result.error) fail(`Failed to start ${command}: ${result.error.message}`);
  if (result.status !== 0) fail(result.stderr || `${command} exited with status ${result.status}`);
  return result.stdout.trim();
}

function parseJson(output) {
  try {
    return JSON.parse(output);
  } catch {
    fail("Database invariant smoke received non-JSON output.");
  }
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
