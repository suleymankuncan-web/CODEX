import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const workspaceRoot = join(import.meta.dirname, "..");
const smokeSqlPath = join(
  workspaceRoot,
  "db",
  "preflight",
  "region-weekly-visit-plan-v1-smoke.sql",
);
const containerName =
  process.env.MIGRATION_SMOKE_POSTGRES_CONTAINER ?? "store-ops-live-postgres";
const databaseName =
  process.env.MIGRATION_SMOKE_DB_NAME ?? "store_ops_fresh_migration_smoke";
const databaseUser = process.env.MIGRATION_SMOKE_DB_USER ?? "postgres";

if (process.env.NODE_ENV === "production") {
  fail("Weekly visit plan schema smoke is local-only.");
}
if (!/^store_ops_fresh_migration_smoke(_[a-z0-9_]+)?$/.test(databaseName)) {
  fail("Weekly visit plan schema smoke requires the disposable migration smoke database.");
}

runNpm(["run", "smoke:migration:fresh-db"]);

const smokeSql = readFileSync(smokeSqlPath, "utf8");
const smokeOutput = runCapture(
  "docker",
  [
    "exec",
    "-i",
    containerName,
    "psql",
    "-X",
    "-qAt",
    "-v",
    "ON_ERROR_STOP=1",
    "-U",
    databaseUser,
    "-d",
    databaseName,
  ],
  smokeSql,
);

const receiptLine = smokeOutput
  .split(/\r?\n/)
  .map((line) => line.trim())
  .find((line) => line.startsWith("{") && line.includes("region_weekly_visit_plan_schema_smoke.completed"));
if (!receiptLine) {
  fail("Weekly visit plan rollback-only smoke did not emit its sanitized receipt.");
}

const receipt = JSON.parse(receiptLine);
if (
  receipt.event !== "region_weekly_visit_plan_schema_smoke.completed" ||
  receipt.different_day_repeat !== true ||
  receipt.negative_constraints !== "passed" ||
  receipt.rolled_back !== true
) {
  fail("Weekly visit plan rollback-only smoke receipt was not exact.");
}

const residualRows = Number(
  runCapture(
    "docker",
    [
      "exec",
      containerName,
      "psql",
      "-X",
      "-qAt",
      "-U",
      databaseUser,
      "-d",
      databaseName,
      "-c",
      "SELECT count(*) FROM ops.company WHERE company_code = 'VISIT_SMOKE';",
    ],
  ).trim(),
);
if (residualRows !== 0) {
  fail("Weekly visit plan rollback-only smoke left fixture rows behind.");
}

console.log(
  JSON.stringify({
    event: "region_weekly_visit_plan_schema_verification.completed",
    freshMigration: "passed",
    negativeConstraints: "passed",
    residualFixtureRows: residualRows,
    rollback: "verified",
  }),
);

function runNpm(args) {
  if (process.platform === "win32") {
    run("cmd.exe", ["/d", "/s", "/c", ["npm.cmd", ...args].join(" ")]);
    return;
  }
  run("npm", args);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: workspaceRoot,
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) fail(`Failed to start ${command}: ${result.error.message}`);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function runCapture(command, args, input) {
  const result = spawnSync(command, args, {
    cwd: workspaceRoot,
    encoding: "utf8",
    input,
  });
  if (result.error) fail(`Failed to start ${command}: ${result.error.message}`);
  if (result.status !== 0) fail(result.stderr || `${command} exited with status ${result.status}`);
  return result.stdout;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

