import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const workspaceRoot = join(import.meta.dirname, "..");
const backendDir = join(workspaceRoot, "backend", "nestjs");
const composeFile = "infra/docker-compose.live-e2e.yml";

const containerName =
  process.env.MIGRATION_SMOKE_POSTGRES_CONTAINER ?? "store-ops-live-postgres";
const databaseName =
  process.env.MIGRATION_SMOKE_DB_NAME ?? "store_ops_fresh_migration_smoke";
const databaseHost = process.env.MIGRATION_SMOKE_DB_HOST ?? "localhost";
const databasePort = process.env.MIGRATION_SMOKE_DB_PORT ?? "54329";
const databaseUser = process.env.MIGRATION_SMOKE_DB_USER ?? "postgres";
const databasePassword = process.env.MIGRATION_SMOKE_DB_PASSWORD ?? "postgres";

assertNonProduction();
assertLocalHost(databaseHost);
assertSafeDatabaseName(databaseName);

run("docker", ["compose", "-f", composeFile, "up", "-d", "postgres"], {
  cwd: workspaceRoot,
});
waitForHealthyContainer(containerName);

run("docker", [
  "exec",
  containerName,
  "dropdb",
  "-U",
  databaseUser,
  "--if-exists",
  databaseName,
]);
run("docker", ["exec", containerName, "createdb", "-U", databaseUser, databaseName]);

const databaseUrl = `postgres://${databaseUser}:${databasePassword}@${databaseHost}:${databasePort}/${databaseName}`;
const migrationCommand = npmRun(["run", "db:migrate"]);
run(migrationCommand.command, migrationCommand.args, {
  cwd: backendDir,
  env: {
    ...process.env,
    DATABASE_URL: databaseUrl,
  },
});

const migrationFileCount = readdirSync(join(workspaceRoot, "db", "migrations")).filter(
  (file) => file.endsWith(".sql"),
).length;
const migrationRows = Number(
  queryScalar("select count(*) from audit.schema_migration;"),
);
const succeededRows = Number(
  queryScalar("select count(*) from audit.schema_migration where status='succeeded';"),
);
const failedRows = Number(
  queryScalar("select count(*) from audit.schema_migration where status='failed';"),
);
const schemaTableCounts = parseSchemaCounts(
  queryScalar(`
    select schemaname || '=' || count(*)
    from pg_tables
    where schemaname in ('ops','stg','rpt','audit')
    group by schemaname
    order by schemaname;
  `),
);

if (migrationRows !== migrationFileCount) {
  fail(
    `Expected ${migrationFileCount} migration rows, got ${migrationRows}. Fresh DB migration smoke failed.`,
  );
}

if (succeededRows !== migrationFileCount || failedRows !== 0) {
  fail(
    `Expected all migrations succeeded and failed=0, got succeeded=${succeededRows}, failed=${failedRows}.`,
  );
}

for (const schemaName of ["audit", "ops", "rpt", "stg"]) {
  if (!schemaTableCounts[schemaName] || schemaTableCounts[schemaName] <= 0) {
    fail(`Expected schema ${schemaName} to have restored tables.`);
  }
}

console.log(
  JSON.stringify(
    {
      databaseName,
      event: "migration_fresh_db_smoke.completed",
      failedRows,
      migrationFileCount,
      migrationRows,
      schemaTableCounts,
      succeededRows,
    },
    null,
    2,
  ),
);

function assertNonProduction() {
  if (process.env.NODE_ENV === "production") {
    fail("Migration fresh DB smoke is local-only and refuses NODE_ENV=production.");
  }
}

function assertLocalHost(host) {
  if (!["localhost", "127.0.0.1"].includes(host)) {
    fail(`Migration fresh DB smoke requires a local host, got ${host}.`);
  }
}

function assertSafeDatabaseName(name) {
  if (!/^store_ops_fresh_migration_smoke(_[a-z0-9_]+)?$/.test(name)) {
    fail(
      `Unsafe smoke database name ${name}. Use store_ops_fresh_migration_smoke or a suffixed disposable name.`,
    );
  }
}

function waitForHealthyContainer(name) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const status = runCapture("docker", [
      "inspect",
      "--format",
      "{{.State.Health.Status}}",
      name,
    ]).trim();
    if (status === "healthy") {
      return;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1_000);
  }

  fail(`Timed out waiting for ${name} to become healthy.`);
}

function queryScalar(sql) {
  return runCapture("docker", [
    "exec",
    containerName,
    "psql",
    "-U",
    databaseUser,
    "-d",
    databaseName,
    "-At",
    "-c",
    sql,
  ]).trim();
}

function parseSchemaCounts(output) {
  return Object.fromEntries(
    output
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const [schemaName, count] = line.split("=");
        return [schemaName, Number(count)];
      }),
  );
}

function npmRun(args) {
  if (process.platform === "win32") {
    return {
      args: ["/d", "/s", "/c", ["npm.cmd", ...args].join(" ")],
      command: "cmd.exe",
    };
  }

  return { args, command: "npm" };
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? workspaceRoot,
    env: options.env ?? process.env,
    stdio: "inherit",
  });

  if (result.error) {
    fail(`Failed to start ${command}: ${result.error.message}`);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function runCapture(command, args) {
  const result = spawnSync(command, args, {
    cwd: workspaceRoot,
    encoding: "utf8",
  });

  if (result.error) {
    fail(`Failed to start ${command}: ${result.error.message}`);
  }

  if (result.status !== 0) {
    fail(result.stderr || `${command} exited with status ${result.status}`);
  }

  return result.stdout;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
