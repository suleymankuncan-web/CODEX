import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const workspaceRoot = join(import.meta.dirname, "..");
const backendDir = join(workspaceRoot, "backend", "nestjs");
const containerName = "store-ops-dbc5-postgres17";
const databaseName = "store_ops_dbc5_target_smoke_v1";
const migrationName = "060_target_distribution_duplicate_employee_constraint_v1.sql";
const port = "54349";
const user = "postgres";
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
  run("docker", ["exec", containerName, "createdb", "-U", user, databaseName]);
  const migrationCommand = npmRun(["run", "db:migrate"]);
  run(migrationCommand.command, migrationCommand.args, {
    cwd: backendDir,
    env: { ...process.env, DATABASE_URL: databaseUrl(), NODE_ENV: "test" },
  });

  seedCompatibleCases();
  proveCaseVariantDuplicateRejected();
  const catalog = readCatalogProof();
  if (catalog.serverMajor !== 17 || catalog.migrationCount !== 60
    || catalog.migrationSucceeded !== true || catalog.constraintValidated !== true
    || catalog.functionExact !== true || catalog.constraintExact !== true
    || catalog.relatedIndexCount !== 0 || catalog.compatibleRows !== 5) {
    fail("DB-C5 disposable catalog or compatibility proof was incomplete.");
  }

  rollbackReviewedPackage();
  const residue = readRollbackProof();
  if (residue.constraintPresent || residue.functionPresent || residue.migrationPresent
    || residue.compatibleRows !== 5) {
    fail("DB-C5 disposable rollback left reviewed artifact residue or changed data.");
  }

  process.stdout.write(`${JSON.stringify({
    caseVariantDuplicateSqlState: "23514",
    cleanupVerified: true,
    compatibleCases: [
      "unique_array",
      "pilot_empty",
      "separate_request_a",
      "separate_request_b",
      "malformed_shape_policy",
    ],
    event: "dbc5_target_constraint.disposable_smoke_completed",
    migrationCount: catalog.migrationCount,
    noIndexCreated: catalog.relatedIndexCount === 0,
    postgresqlMajor: catalog.serverMajor,
    rollbackVerified: true,
  }, null, 2)}\n`);
} finally {
  cleanup();
}

function seedCompatibleCases() {
  executeSql(`
    INSERT INTO ops.company (company_id, company_code, company_name)
    VALUES ('10000000-0000-4000-8000-000000000005', 'DBC5', 'DBC5 Fixture Company');

    INSERT INTO ops.region (region_id, company_id, region_code, region_name)
    VALUES ('20000000-0000-4000-8000-000000000005',
      '10000000-0000-4000-8000-000000000005', 'DBC5', 'DBC5 Fixture Region');

    INSERT INTO ops.store (store_id, company_id, region_id, store_code, store_name, store_type)
    VALUES ('30000000-0000-4000-8000-000000000005',
      '10000000-0000-4000-8000-000000000005',
      '20000000-0000-4000-8000-000000000005',
      'DBC5', 'DBC5 Fixture Store', 'company');

    INSERT INTO ops.target_distribution_request
      (company_id, region_id, store_id, request_month, target_label, total_target_value,
       allocation_count, request_status, allocation_json, submitted_by_user_id)
    VALUES
      ('10000000-0000-4000-8000-000000000005',
       '20000000-0000-4000-8000-000000000005',
       '30000000-0000-4000-8000-000000000005', DATE '2097-01-01',
       'unique_array', 2, 2, 'submitted',
       '[{"employeeId":"alpha"},{"employeeId":"beta"}]'::jsonb, 'dbc5-disposable-smoke'),
      ('10000000-0000-4000-8000-000000000005',
       '20000000-0000-4000-8000-000000000005',
       '30000000-0000-4000-8000-000000000005', DATE '2097-01-01',
       'pilot_empty', 0, 0, 'approved', '[]'::jsonb, 'dbc5-disposable-smoke'),
      ('10000000-0000-4000-8000-000000000005',
       '20000000-0000-4000-8000-000000000005',
       '30000000-0000-4000-8000-000000000005', DATE '2097-01-01',
       'separate_request_a', 1, 1, 'submitted',
       '[{"employeeId":"shared"}]'::jsonb, 'dbc5-disposable-smoke'),
      ('10000000-0000-4000-8000-000000000005',
       '20000000-0000-4000-8000-000000000005',
       '30000000-0000-4000-8000-000000000005', DATE '2097-01-01',
       'separate_request_b', 1, 1, 'submitted',
       '[{"employeeId":"shared"}]'::jsonb, 'dbc5-disposable-smoke'),
      ('10000000-0000-4000-8000-000000000005',
       '20000000-0000-4000-8000-000000000005',
       '30000000-0000-4000-8000-000000000005', DATE '2097-01-01',
       'malformed_shape_policy', 1, 1, 'submitted',
       '[{"employeeId":42}]'::jsonb, 'dbc5-disposable-smoke');
  `);
}

function proveCaseVariantDuplicateRejected() {
  executeSql(`
    DO $block$
    BEGIN
      BEGIN
        INSERT INTO ops.target_distribution_request
          (company_id, region_id, store_id, request_month, target_label, total_target_value,
           allocation_count, allocation_json, submitted_by_user_id)
        VALUES (
          '10000000-0000-4000-8000-000000000005',
          '20000000-0000-4000-8000-000000000005',
          '30000000-0000-4000-8000-000000000005', DATE '2097-01-01',
          'case_variant_duplicate', 2, 2,
          '[{"employeeId":"employee-a"},{"employeeId":"EMPLOYEE-A"}]'::jsonb,
          'dbc5-disposable-smoke'
        );
        RAISE EXCEPTION 'case_variant_duplicate_was_accepted';
      EXCEPTION WHEN check_violation THEN
        IF SQLSTATE <> '23514' THEN RAISE; END IF;
      END;
    END
    $block$;
  `);
}

function readCatalogProof() {
  const values = queryScalar(`
    SELECT
      current_setting('server_version_num')::integer / 10000,
      (SELECT count(*) FROM audit.schema_migration WHERE status = 'succeeded'),
      EXISTS (
        SELECT 1 FROM audit.schema_migration
        WHERE migration_name = '${migrationName}' AND status = 'succeeded'
      ),
      EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint
        WHERE conname = 'ck_target_distribution_employee_ids_unique_v1'
          AND convalidated
      ),
      EXISTS (
        SELECT 1 FROM pg_catalog.pg_proc
        WHERE oid = pg_catalog.to_regprocedure(
          'ops.target_distribution_employee_ids_unique_v1(jsonb)'
        ) AND provolatile = 'i' AND proisstrict AND proparallel = 's'
          AND proconfig @> ARRAY['search_path=pg_catalog']
      ),
      EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint
        WHERE conname = 'ck_target_distribution_employee_ids_unique_v1'
          AND pg_catalog.pg_get_constraintdef(oid, true)
            = 'CHECK (ops.target_distribution_employee_ids_unique_v1(allocation_json))'
      ),
      (SELECT count(*) FROM pg_catalog.pg_indexes
       WHERE schemaname = 'ops'
         AND indexdef ILIKE '%target_distribution_employee_ids_unique_v1%'),
      (SELECT count(*) FROM ops.target_distribution_request
       WHERE submitted_by_user_id = 'dbc5-disposable-smoke');
  `).split("\t");
  return {
    serverMajor: Number(values[0]), migrationCount: Number(values[1]),
    migrationSucceeded: values[2] === "t", constraintValidated: values[3] === "t",
    functionExact: values[4] === "t", constraintExact: values[5] === "t",
    relatedIndexCount: Number(values[6]), compatibleRows: Number(values[7]),
  };
}

function rollbackReviewedPackage() {
  const rollback = readFileSync(join(
    workspaceRoot,
    "db",
    "constraint-packages",
    "rem8-target-duplicate-v1",
    "rollback.sql",
  ), "utf8");
  executeSql(`BEGIN;\n${rollback}\nDELETE FROM audit.schema_migration WHERE migration_name = '${migrationName}';\nCOMMIT;`);
}

function readRollbackProof() {
  const values = queryScalar(`
    SELECT
      EXISTS (SELECT 1 FROM pg_catalog.pg_constraint
              WHERE conname = 'ck_target_distribution_employee_ids_unique_v1'),
      pg_catalog.to_regprocedure('ops.target_distribution_employee_ids_unique_v1(jsonb)') IS NOT NULL,
      EXISTS (SELECT 1 FROM audit.schema_migration WHERE migration_name = '${migrationName}'),
      (SELECT count(*) FROM ops.target_distribution_request
       WHERE submitted_by_user_id = 'dbc5-disposable-smoke');
  `).split("\t");
  return {
    constraintPresent: values[0] === "t",
    functionPresent: values[1] === "t",
    migrationPresent: values[2] === "t",
    compatibleRows: Number(values[3]),
  };
}

function executeSql(sql) {
  const result = spawnSync("docker", [
    "exec", "-i", containerName, "psql", "-v", "ON_ERROR_STOP=1", "-U", user,
    "-d", databaseName,
  ], { cwd: workspaceRoot, input: sql, encoding: "utf8" });
  if (result.error) fail(`Failed to start disposable psql: ${result.error.message}`);
  if (result.status !== 0) fail(result.stderr.trim() || "Disposable SQL failed.");
}

function queryScalar(sql) {
  const result = spawnSync("docker", [
    "exec", containerName, "psql", "-U", user, "-d", databaseName,
    "-At", "-F", "\t", "-v", "ON_ERROR_STOP=1", "-c", sql,
  ], { cwd: workspaceRoot, encoding: "utf8" });
  if (result.error) fail(`Failed to start disposable query: ${result.error.message}`);
  if (result.status !== 0) fail(result.stderr.trim() || "Disposable query failed.");
  return result.stdout.trim();
}

function cleanup() {
  if (!createdContainer) return;
  runBestEffort("docker", [
    "exec", containerName, "psql", "-U", user, "-d", "postgres", "-At", "-c",
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${databaseName}' AND pid <> pg_backend_pid();`,
  ]);
  runBestEffort("docker", ["exec", containerName, "dropdb", "-U", user, "--if-exists", databaseName]);
  runBestEffort("docker", ["rm", "-f", containerName]);
  if (spawnSync("docker", ["inspect", containerName], { stdio: "ignore" }).status === 0) {
    fail("DB-C5 disposable PostgreSQL 17 cleanup was not verified.");
  }
}

function assertLocalOnly() {
  if ((process.env.NODE_ENV ?? "").trim().toLowerCase() === "production") {
    fail("DB-C5 disposable smoke refuses NODE_ENV=production.");
  }
  if (!/^store_ops_dbc5_target_smoke_[a-z0-9_]+$/.test(databaseName)) {
    fail("DB-C5 disposable database name is unsafe.");
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
    if (spawnSync("docker", [
      "exec", containerName, "pg_isready", "-U", user, "-d", "postgres",
    ], { stdio: "ignore" }).status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
  }
  fail("Timed out waiting for DB-C5 disposable PostgreSQL 17.");
}

function databaseUrl() {
  const scheme = "postgres" + "://";
  return `${scheme}${user}@127.0.0.1:${port}/${databaseName}`;
}

function npmRun(args) {
  return process.platform === "win32"
    ? { command: "cmd.exe", args: ["/d", "/s", "/c", ["npm.cmd", ...args].join(" ")] }
    : { command: "npm", args };
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

function runBestEffort(command, args) {
  spawnSync(command, args, { cwd: workspaceRoot, stdio: "ignore" });
}

function fail(message) {
  throw new Error(message);
}
