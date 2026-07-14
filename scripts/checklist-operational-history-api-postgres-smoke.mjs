import { spawnSync } from "node:child_process";
import { join } from "node:path";

const workspaceRoot = join(import.meta.dirname, "..");
const backendRoot = join(workspaceRoot, "backend", "nestjs");
const host = process.env.MIGRATION_SMOKE_DB_HOST ?? "localhost";
const port = process.env.MIGRATION_SMOKE_DB_PORT ?? "54329";
const user = process.env.MIGRATION_SMOKE_DB_USER ?? "postgres";
const password = process.env.MIGRATION_SMOKE_DB_PASSWORD ?? "postgres";
const database = process.env.MIGRATION_SMOKE_DB_NAME ?? "store_ops_fresh_migration_smoke_operational_history_api";

if (process.env.NODE_ENV === "production") fail("Operational history API smoke is local-only");
if (!/^store_ops_fresh_migration_smoke(_[a-z0-9_]+)?$/.test(database)) fail("Unsafe disposable database name");
if (!["localhost", "127.0.0.1"].includes(host)) fail("Operational history API smoke requires localhost");

runNpm(workspaceRoot, ["run", "smoke:migration:fresh-db"], { MIGRATION_SMOKE_DB_NAME: database });
runNpm(backendRoot, ["exec", "ts-node", "scripts/checklist-operational-history-api-postgres-smoke.ts"], {
  DATABASE_URL: `postgres://${user}:${password}@${host}:${port}/${database}`,
});

function runNpm(cwd, args, extraEnv) {
  const command = process.platform === "win32" ? "cmd.exe" : "npm";
  const commandArgs = process.platform === "win32"
    ? ["/d", "/s", "/c", ["npm.cmd", ...args].join(" ")]
    : args;
  const result = spawnSync(command, commandArgs, {
    cwd,
    env: { ...process.env, ...extraEnv },
    stdio: "inherit",
  });
  if (result.error) fail(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
