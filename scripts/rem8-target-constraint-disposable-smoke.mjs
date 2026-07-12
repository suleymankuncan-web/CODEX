import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const workspaceRoot = join(import.meta.dirname, "..");
const backendDir = join(workspaceRoot, "backend", "nestjs");
const containerName = "store-ops-rem8-postgres17";
const sourceDatabase = "store_ops_rem8_target_rehearsal_source";
const restoreDatabase = "store_ops_rem8_target_rehearsal_restore";
const dumpPath = "/tmp/store_ops_rem8_target_rehearsal.dump";
const port = "54339";
const user = "postgres";
const syntheticScaleRows = 5000;
const dbc5MigrationName = "060_target_distribution_duplicate_employee_constraint_v1.sql";
let createdContainer = false;

assertLocalOnly();
assertContainerAbsent();

try {
  run("docker", [
    "run", "--name", containerName,
    "-e", "POSTGRES_HOST_AUTH_METHOD=trust",
    "-p", `127.0.0.1:${port}:5432`,
    "-d", "postgres:17",
  ]);
  createdContainer = true;
  waitForPostgres();
  createDatabase(sourceDatabase);

  const sourceUrl = databaseUrl(sourceDatabase);
  const migrationCommand = npmRun(["run", "db:migrate"]);
  run(migrationCommand.command, migrationCommand.args, {
    cwd: backendDir,
    env: { ...process.env, DATABASE_URL: sourceUrl, NODE_ENV: "test" },
  });
  rollbackToReviewedPreConstraintState(sourceDatabase);
  seedSyntheticSource();
  const sourceAggregate = readAggregate(sourceDatabase);
  const sourceAggregateDigest = digestAggregate(sourceAggregate);
  if (sourceAggregate.serverMajor !== 17
    || sourceAggregate.targetRows !== syntheticScaleRows + 1) {
    fail("Synthetic PostgreSQL 17 source did not reach the required scale envelope.");
  }

  run("docker", [
    "exec", containerName, "pg_dump", "-U", user, "-Fc", "-d", sourceDatabase,
    "-f", dumpPath,
  ]);
  const dumpDigest = runCapture("docker", [
    "exec", containerName, "sha256sum", dumpPath,
  ]).trim().split(/\s+/)[0];
  if (!/^[a-f0-9]{64}$/.test(dumpDigest)) fail("Disposable dump digest was unavailable.");

  createDatabase(restoreDatabase);
  run("docker", [
    "exec", containerName, "pg_restore", "-U", user, "--no-owner", "--no-privileges",
    "-d", restoreDatabase, dumpPath,
  ]);
  const restoreAggregate = readAggregate(restoreDatabase);
  const restoreAggregateDigest = digestAggregate(restoreAggregate);
  if (sourceAggregateDigest !== restoreAggregateDigest) {
    fail("Disposable source and restored aggregate digests differ.");
  }

  const reviewedCommit = runCapture("git", ["rev-parse", "HEAD"], { cwd: workspaceRoot }).trim();
  if (!/^[a-f0-9]{40}$/.test(reviewedCommit)) fail("Reviewed commit could not be resolved.");
  const observer = tsNodeRun(["scripts/rem8-target-constraint-observation.ts"]);
  const observationResult = runCaptureResult(observer.command, observer.args, {
    cwd: backendDir,
    env: {
      ...process.env,
      DATABASE_INVARIANT_PREFLIGHT_ACK: "read-only-approved",
      DATABASE_INVARIANT_PREFLIGHT_TARGET: "disposable",
      DATABASE_URL: databaseUrl(restoreDatabase),
      NODE_ENV: "test",
      REM8_TARGET_OBSERVATION_REVIEWED_COMMIT: reviewedCommit,
    },
  });
  if (observationResult.error) fail(`Failed to start disposable observation: ${observationResult.error.message}`);
  if (observationResult.status !== 0) {
    fail(observationResult.stderr.trim() || "REM-8 disposable observation failed.");
  }
  const observationReceipt = JSON.parse(observationResult.stdout);
  if (observationReceipt.event !== "rem8_target_constraint.observation_completed"
    || observationReceipt.targetClass !== "disposable"
    || observationReceipt.queryResult?.state !== "eligible_for_disposable_rehearsal") {
    fail("REM-8 disposable observation returned an ineligible receipt.");
  }
  const runner = tsNodeRun(["scripts/rem8-target-constraint-disposable-rehearsal.ts"]);
  const result = runCaptureResult(runner.command, runner.args, {
    cwd: backendDir,
    env: {
      ...process.env,
      DATABASE_INVARIANT_PREFLIGHT_ACK: "read-only-approved",
      DATABASE_INVARIANT_PREFLIGHT_TARGET: "disposable",
      DATABASE_URL: databaseUrl(restoreDatabase),
      NODE_ENV: "test",
      REM8_REHEARSAL_DUMP_DIGEST: dumpDigest,
      REM8_REHEARSAL_RESTORE_AGGREGATE_DIGEST: restoreAggregateDigest,
      REM8_REHEARSAL_REVIEWED_COMMIT: reviewedCommit,
      REM8_REHEARSAL_SOURCE_AGGREGATE_DIGEST: sourceAggregateDigest,
      REM8_REHEARSAL_SYNTHETIC_SCALE_ROWS: String(syntheticScaleRows),
    },
  });
  if (result.status !== 0) fail(result.stderr.trim() || "REM-8 disposable runner failed.");
  const receipt = JSON.parse(result.stdout);
  if (receipt.event !== "rem8_target_constraint.disposable_rehearsal_completed"
    || receipt.cleanupVerified !== true
    || receipt.constraintValidated !== true
    || receipt.writerFailures !== 0) {
    fail("REM-8 disposable runner returned an incomplete receipt.");
  }
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
} finally {
  cleanup();
}

function rollbackToReviewedPreConstraintState(database) {
  const rollback = readFileSync(join(
    workspaceRoot,
    "db",
    "constraint-packages",
    "rem8-target-duplicate-v1",
    "rollback.sql",
  ), "utf8");
  runWithInput("docker", [
    "exec", "-i", containerName, "psql", "-v", "ON_ERROR_STOP=1", "-U", user,
    "-d", database,
  ], `BEGIN;\n${rollback}\nDELETE FROM audit.schema_migration WHERE migration_name = '${dbc5MigrationName}';\nCOMMIT;\n`);
  const residue = queryScalar(database, `
    SELECT
      pg_catalog.to_regprocedure('ops.target_distribution_employee_ids_unique_v1(jsonb)') IS NOT NULL,
      EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint
        WHERE conname = 'ck_target_distribution_employee_ids_unique_v1'
      ),
      EXISTS (
        SELECT 1 FROM audit.schema_migration WHERE migration_name = '${dbc5MigrationName}'
      );
  `);
  if (residue !== "f\tf\tf") {
    fail("REM-8 pre-constraint rollback left DB-C5 residue in the disposable source.");
  }
}

function seedSyntheticSource() {
  const sql = `
    INSERT INTO ops.company (company_id, company_code, company_name)
    VALUES ('10000000-0000-4000-8000-000000000008', 'REM8', 'REM8 Synthetic Company');

    INSERT INTO ops.region (region_id, company_id, region_code, region_name)
    VALUES ('20000000-0000-4000-8000-000000000008',
      '10000000-0000-4000-8000-000000000008', 'REM8', 'REM8 Synthetic Region');

    INSERT INTO ops.store (store_id, company_id, region_id, store_code, store_name, store_type)
    VALUES ('30000000-0000-4000-8000-000000000008',
      '10000000-0000-4000-8000-000000000008',
      '20000000-0000-4000-8000-000000000008',
      'REM8', 'REM8 Synthetic Store', 'company');

    INSERT INTO ops.target_distribution_request
      (company_id, region_id, store_id, request_month, target_label, total_target_value,
       allocation_count, allocation_json, submitted_by_user_id)
    SELECT
      '10000000-0000-4000-8000-000000000008',
      '20000000-0000-4000-8000-000000000008',
      '30000000-0000-4000-8000-000000000008',
      DATE '2098-01-01',
      'rem8_synthetic_scale_' || series.item,
      1, 1,
      pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
        'employeeId', '00000000-0000-4000-8000-' || pg_catalog.lpad(series.item::text, 12, '0')
      )),
      'rem8-disposable-rehearsal'
    FROM pg_catalog.generate_series(1, ${syntheticScaleRows}) AS series(item);

    INSERT INTO ops.target_distribution_request
      (company_id, region_id, store_id, request_month, target_label, total_target_value,
       allocation_count, request_status, allocation_json, submitted_by_user_id)
    VALUES (
      '10000000-0000-4000-8000-000000000008',
      '20000000-0000-4000-8000-000000000008',
      '30000000-0000-4000-8000-000000000008',
      DATE '2098-01-01', 'rem8_synthetic_pilot_empty', 1, 0, 'approved', '[]'::jsonb,
      'rem8-disposable-rehearsal'
    );
  `;
  runWithInput("docker", [
    "exec", "-i", containerName, "psql", "-v", "ON_ERROR_STOP=1", "-U", user,
    "-d", sourceDatabase,
  ], sql);
}

function readAggregate(database) {
  const output = queryScalar(database, `
    SELECT
      (SELECT count(*) FROM audit.schema_migration WHERE status = 'succeeded'),
      (SELECT pg_catalog.jsonb_object_agg(item.schemaname, item.table_count ORDER BY item.schemaname)
       FROM (
         SELECT schemaname, count(*)::integer AS table_count
         FROM pg_catalog.pg_tables
         WHERE schemaname IN ('audit', 'ops', 'rpt', 'stg')
         GROUP BY schemaname
       ) AS item),
      current_setting('server_version_num')::integer / 10000,
      (SELECT count(*) FROM ops.target_distribution_request);
  `);
  const [migrationCount, schemaTableCounts, serverMajor, targetRows] = output.split("\t");
  const aggregate = {
    migrationCount: Number(migrationCount),
    schemaTableCounts: JSON.parse(schemaTableCounts),
    serverMajor: Number(serverMajor),
    targetRows: Number(targetRows),
  };
  if (!Number.isSafeInteger(aggregate.migrationCount) || aggregate.migrationCount <= 0
    || !Number.isSafeInteger(aggregate.targetRows) || aggregate.targetRows <= 0) {
    fail("Disposable aggregate was invalid.");
  }
  return aggregate;
}

function digestAggregate(value) {
  return createHash("sha256").update(JSON.stringify({
    migrationCount: value.migrationCount,
    schemaTableCounts: Object.fromEntries(Object.entries(value.schemaTableCounts).sort()),
    serverMajor: value.serverMajor,
    targetRows: value.targetRows,
  })).digest("hex");
}

function queryScalar(database, sql) {
  return runCapture("docker", [
    "exec", containerName, "psql", "-U", user, "-d", database,
    "-At", "-F", "\t", "-v", "ON_ERROR_STOP=1", "-c", sql,
  ]).trim();
}

function createDatabase(database) {
  run("docker", ["exec", containerName, "createdb", "-U", user, database]);
}

function cleanup() {
  if (!createdContainer) return;
  for (const database of [restoreDatabase, sourceDatabase]) {
    runBestEffort("docker", [
      "exec", containerName, "psql", "-U", user, "-d", "postgres", "-At", "-c",
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${database}' AND pid <> pg_backend_pid();`,
    ]);
    runBestEffort("docker", ["exec", containerName, "dropdb", "-U", user, "--if-exists", database]);
  }
  runBestEffort("docker", ["exec", containerName, "rm", "-f", dumpPath]);
  runBestEffort("docker", ["rm", "-f", containerName]);
  const stillPresent = spawnSync("docker", ["inspect", containerName], { stdio: "ignore" }).status === 0;
  if (stillPresent) fail("Disposable PostgreSQL 17 container cleanup was not verified.");
}

function assertLocalOnly() {
  if ((process.env.NODE_ENV ?? "").trim().toLowerCase() === "production") {
    fail("REM-8 disposable smoke refuses NODE_ENV=production.");
  }
  for (const database of [sourceDatabase, restoreDatabase]) {
    if (!/^store_ops_rem8_target_rehearsal_[a-z0-9_]+$/.test(database)) {
      fail("REM-8 disposable database name is unsafe.");
    }
  }
}

function assertContainerAbsent() {
  if (spawnSync("docker", ["inspect", containerName], { stdio: "ignore" }).status === 0) {
    fail(`Container ${containerName} already exists; refusing to replace unknown state.`);
  }
}

function waitForPostgres() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const result = spawnSync("docker", [
      "exec", containerName, "pg_isready", "-U", user, "-d", "postgres",
    ], { stdio: "ignore" });
    if (result.status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
  }
  fail("Timed out waiting for disposable PostgreSQL 17.");
}

function databaseUrl(database) {
  const scheme = "postgres" + "://";
  return `${scheme}${user}@127.0.0.1:${port}/${database}`;
}

function npmRun(args) {
  return process.platform === "win32"
    ? { command: "cmd.exe", args: ["/d", "/s", "/c", ["npm.cmd", ...args].join(" ")] }
    : { command: "npm", args };
}

function tsNodeRun(args) {
  return process.platform === "win32"
    ? {
        command: "cmd.exe",
        args: ["/d", "/s", "/c", ["node_modules\\.bin\\ts-node.cmd", ...args].join(" ")],
      }
    : { command: "./node_modules/.bin/ts-node", args };
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? workspaceRoot,
    env: options.env ?? process.env,
    stdio: "inherit",
  });
  if (result.error) fail(`Failed to start ${command}: ${result.error.message}`);
  if (result.status !== 0) fail(`${command} exited with status ${result.status ?? 1}.`);
}

function runWithInput(command, args, input) {
  const result = spawnSync(command, args, {
    cwd: workspaceRoot,
    input,
    encoding: "utf8",
    stdio: ["pipe", "inherit", "inherit"],
  });
  if (result.error) fail(`Failed to start ${command}: ${result.error.message}`);
  if (result.status !== 0) fail(`${command} exited with status ${result.status ?? 1}.`);
}

function runCapture(command, args, options = {}) {
  const result = runCaptureResult(command, args, options);
  if (result.error) fail(`Failed to start ${command}: ${result.error.message}`);
  if (result.status !== 0) fail(result.stderr.trim() || `${command} exited with status ${result.status}.`);
  return result.stdout;
}

function runCaptureResult(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: options.cwd ?? workspaceRoot,
    env: options.env ?? process.env,
    encoding: "utf8",
  });
}

function runBestEffort(command, args) {
  spawnSync(command, args, { cwd: workspaceRoot, stdio: "ignore" });
}

function fail(message) {
  throw new Error(message);
}
