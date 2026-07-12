import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { Pool, type PoolClient } from "pg";
import { assertSanitizedDiagnosticJson, sha256Hex } from "./staging-remediation-diagnostic-contract";
import { loadRem8TargetConstraintPackage } from "./rem8-target-constraint-package-contract";
import { createRem8RehearsalReceipt } from "./rem8-target-constraint-rehearsal-contract";

const expectedDatabasePattern = /^store_ops_rem8_target_rehearsal_[a-z0-9_]+$/;
const expectedSqlStates = { constraint: "23514", lockTimeout: "55P03" } as const;
const runnerFiles = [
  join(__dirname, "rem8-target-constraint-disposable-rehearsal.ts"),
  join(__dirname, "rem8-target-constraint-package-contract.ts"),
  join(__dirname, "rem8-target-constraint-rehearsal-contract.ts"),
  join(__dirname, "staging-remediation-diagnostic-contract.ts"),
];

type Aggregate = {
  migrationCount: number;
  schemaTableCounts: Record<string, number>;
  serverMajor: number;
  targetRows: number;
};

// Trace: FR-11..17; NFR-02..06, NFR-09; AC-04..08; EC-11..15.
async function main() {
  assertExecutionBoundary();
  const connectionString = readConnectionString();
  const reviewedCommit = readReviewedCommit();
  const dumpDigest = readDigest("REM8_REHEARSAL_DUMP_DIGEST");
  const sourceAggregateDigest = readDigest("REM8_REHEARSAL_SOURCE_AGGREGATE_DIGEST");
  const expectedRestoreAggregateDigest = readDigest("REM8_REHEARSAL_RESTORE_AGGREGATE_DIGEST");
  const syntheticScaleRows = readPositiveInteger("REM8_REHEARSAL_SYNTHETIC_SCALE_ROWS");
  const candidate = loadRem8TargetConstraintPackage();
  const pool = new Pool({ connectionString, max: 8, ssl: false });

  try {
    const aggregate = await readAggregate(pool);
    if (aggregate.serverMajor !== 17) throw new Error("postgres_17_required");
    if (aggregate.targetRows < syntheticScaleRows) throw new Error("synthetic_scale_missing");
    const restoreAggregateDigest = digestAggregate(aggregate);
    if (restoreAggregateDigest !== expectedRestoreAggregateDigest
      || restoreAggregateDigest !== sourceAggregateDigest) {
      throw new Error("restore_aggregate_mismatch");
    }
    await assertArtifactsAbsent(pool);

    await pool.query(candidate.sql.createFunction);
    await proveCandidateFunctionSemantics(pool);
    const failureValidationSqlState = await proveExistingDuplicateValidationFailure(
      pool,
      candidate.sql.addConstraint,
      candidate.sql.validateConstraint,
    );
    const lockTimeoutSqlState = await proveAddConstraintLockTimeout(
      pool,
      candidate.sql.addConstraint,
    );
    const addStarted = performance.now();
    await pool.query(candidate.sql.addConstraint);
    const addConstraintMs = performance.now() - addStarted;
    const duplicateWriteRejected = await proveDuplicateNewWriteRejected(pool);
    await proveCompatibleWrites(pool);
    const writer = await startCompatibleWriter(pool);
    await writer.ready;
    const validateStarted = performance.now();
    await pool.query(candidate.sql.validateConstraint);
    const validateConstraintMs = performance.now() - validateStarted;
    const writerResult = await writer.completed;
    const constraintValidated = await isConstraintValidated(pool);
    const rollbackStarted = performance.now();
    await pool.query(candidate.sql.rollback);
    const rollbackMs = performance.now() - rollbackStarted;
    const cleanupVerified = await proveCleanupAndOrdinaryWriter(pool);

    const receipt = createRem8RehearsalReceipt({
      addConstraintMs,
      cleanupVerified: cleanupVerified as true,
      constraintValidated: constraintValidated as true,
      dumpDigest,
      duplicateWriteRejected: duplicateWriteRejected as true,
      failureValidationSqlState,
      indexStrategy: candidate.indexStrategy,
      lockTimeoutSqlState,
      migrationCount: aggregate.migrationCount,
      packageDigests: candidate.digests,
      representativeness: "schema_writer_and_scale_contract_only",
      restoreAggregateDigest,
      restoreSourceClass: "synthetic_migrated_fixture",
      restoredTargetRows: aggregate.targetRows,
      reviewedCommit,
      rollbackMs,
      runnerDigest: digestRunnerFiles(),
      sourceAggregateDigest,
      syntheticScaleRows,
      validateConstraintMs,
      writerAttempts: writerResult.attempts,
      writerFailures: writerResult.failures as 0,
      writerSuccesses: writerResult.successes,
    });
    const serialized = `${JSON.stringify(receipt, null, 2)}\n`;
    assertSanitizedDiagnosticJson(serialized);
    process.stdout.write(serialized);
  } catch (error) {
    await bestEffortRollback(pool, candidate.sql.rollback);
    writeSafeFailure(error);
  } finally {
    await pool.end().catch(() => undefined);
  }
}

async function proveCandidateFunctionSemantics(pool: Pool) {
  const result = await pool.query<{
    case_duplicate: boolean;
    empty_array: boolean;
    malformed_entries: boolean;
    non_array: boolean;
    unique_array: boolean;
  }>(`
    SELECT
      ops.target_distribution_employee_ids_unique_v1(
        '[{"employeeId":"ABC"},{"employeeId":"abc"}]'::jsonb
      ) AS case_duplicate,
      ops.target_distribution_employee_ids_unique_v1('[]'::jsonb) AS empty_array,
      ops.target_distribution_employee_ids_unique_v1(
        '[1,{"other":"value"},{"employeeId":42}]'::jsonb
      ) AS malformed_entries,
      ops.target_distribution_employee_ids_unique_v1('{}'::jsonb) AS non_array,
      ops.target_distribution_employee_ids_unique_v1(
        '[{"employeeId":"ABC"},{"employeeId":"DEF"}]'::jsonb
      ) AS unique_array
  `);
  const row = result.rows[0];
  if (!row || row.case_duplicate !== false || row.empty_array !== true
    || row.malformed_entries !== true || row.non_array !== true || row.unique_array !== true) {
    throw new Error("candidate_semantics_failed");
  }
}

async function proveExistingDuplicateValidationFailure(
  pool: Pool,
  addConstraintSql: string,
  validateConstraintSql: string,
) {
  await pool.query(`
    INSERT INTO ops.target_distribution_request
      (company_id, region_id, store_id, request_month, target_label, total_target_value,
       allocation_count, allocation_json, submitted_by_user_id)
    SELECT company_id, region_id, store_id, DATE '2099-01-01',
      'rem8_synthetic_existing_duplicate', 2, 2,
      '[{"employeeId":"00000000-0000-4000-8000-999999999999"},
        {"employeeId":"00000000-0000-4000-8000-999999999999"}]'::jsonb,
      'rem8-disposable-rehearsal'
    FROM ops.target_distribution_request
    ORDER BY target_distribution_request_id
    LIMIT 1
  `);
  await pool.query(addConstraintSql);
  const state = await captureSqlState(pool, validateConstraintSql);
  if (state !== expectedSqlStates.constraint) throw new Error("failure_validation_not_proven");
  if (await isConstraintValidated(pool)) throw new Error("failed_constraint_marked_valid");
  await pool.query(`
    ALTER TABLE ops.target_distribution_request
      DROP CONSTRAINT ck_target_distribution_employee_ids_unique_v1
  `);
  await pool.query(`
    DELETE FROM ops.target_distribution_request
    WHERE target_label = 'rem8_synthetic_existing_duplicate'
      AND submitted_by_user_id = 'rem8-disposable-rehearsal'
  `);
  return expectedSqlStates.constraint;
}

async function proveAddConstraintLockTimeout(pool: Pool, addConstraintSql: string) {
  const blocker = await pool.connect();
  const contender = await pool.connect();
  try {
    await blocker.query("BEGIN");
    await blocker.query(`
      UPDATE ops.target_distribution_request
      SET updated_at = updated_at
      WHERE target_distribution_request_id = (
        SELECT target_distribution_request_id
        FROM ops.target_distribution_request
        ORDER BY target_distribution_request_id
        LIMIT 1
      )
    `);
    await contender.query("BEGIN");
    await contender.query("SET LOCAL lock_timeout = '250ms'");
    const state = await captureSqlState(contender, addConstraintSql);
    await contender.query("ROLLBACK");
    await blocker.query("ROLLBACK");
    if (state !== expectedSqlStates.lockTimeout) throw new Error("lock_timeout_not_proven");
    if (await constraintExists(pool)) throw new Error("lock_timeout_left_partial_constraint");
    return expectedSqlStates.lockTimeout;
  } finally {
    await contender.query("ROLLBACK").catch(() => undefined);
    await blocker.query("ROLLBACK").catch(() => undefined);
    contender.release();
    blocker.release();
  }
}

async function proveDuplicateNewWriteRejected(pool: Pool) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const state = await captureSqlState(client, `
      INSERT INTO ops.target_distribution_request
        (company_id, region_id, store_id, request_month, target_label, total_target_value,
         allocation_count, allocation_json, submitted_by_user_id)
      SELECT company_id, region_id, store_id, DATE '2099-01-01',
        'rem8_synthetic_new_duplicate', 2, 2,
        '[{"employeeId":"00000000-0000-4000-8000-888888888888"},
          {"employeeId":"00000000-0000-4000-8000-888888888888"}]'::jsonb,
        'rem8-disposable-rehearsal'
      FROM ops.target_distribution_request
      ORDER BY target_distribution_request_id
      LIMIT 1
    `);
    await client.query("ROLLBACK");
    if (state !== expectedSqlStates.constraint) throw new Error("duplicate_write_not_rejected");
    return true;
  } finally {
    await client.query("ROLLBACK").catch(() => undefined);
    client.release();
  }
}

async function proveCompatibleWrites(pool: Pool) {
  await pool.query(`
    INSERT INTO ops.target_distribution_request
      (company_id, region_id, store_id, request_month, target_label, total_target_value,
       allocation_count, allocation_json, submitted_by_user_id)
    SELECT company_id, region_id, store_id, DATE '2099-02-01',
      'rem8_synthetic_compatible_ordinary', 1, 1,
      '[{"employeeId":"00000000-0000-4000-8000-777777777777"}]'::jsonb,
      'rem8-disposable-rehearsal'
    FROM ops.target_distribution_request
    ORDER BY target_distribution_request_id
    LIMIT 1
  `);
  await pool.query(`
    UPDATE ops.target_distribution_request
    SET updated_at = updated_at
    WHERE target_label = 'rem8_synthetic_pilot_empty'
      AND allocation_json = '[]'::jsonb
  `);
}

function startCompatibleWriter(pool: Pool) {
  let signalFirstWrite: (() => void) | undefined;
  const firstWrite = new Promise<void>((resolve) => { signalFirstWrite = resolve; });
  const completed = (async () => {
    const client = await pool.connect();
    let attempts = 0;
    let successes = 0;
    let failures = 0;
    try {
      for (let index = 0; index < 20; index += 1) {
        attempts += 1;
        try {
          await client.query("BEGIN");
          await client.query(`
            UPDATE ops.target_distribution_request
            SET updated_at = updated_at
            WHERE target_distribution_request_id = (
              SELECT target_distribution_request_id
              FROM ops.target_distribution_request
              WHERE target_label LIKE 'rem8_synthetic_scale_%'
              ORDER BY target_distribution_request_id
              LIMIT 1
            )
          `);
          if (index === 0) {
            signalFirstWrite?.();
            await client.query("SELECT pg_sleep(0.1)");
          }
          await client.query("COMMIT");
          successes += 1;
        } catch {
          failures += 1;
          await client.query("ROLLBACK").catch(() => undefined);
        }
      }
      return { attempts, failures, successes };
    } finally {
      client.release();
    }
  })();
  return {
    completed,
    ready: firstWrite,
  };
}

async function proveCleanupAndOrdinaryWriter(pool: Pool) {
  if (await constraintExists(pool) || await functionExists(pool)) return false;
  await pool.query(`
    INSERT INTO ops.target_distribution_request
      (company_id, region_id, store_id, request_month, target_label, total_target_value,
       allocation_count, allocation_json, submitted_by_user_id)
    SELECT company_id, region_id, store_id, DATE '2099-03-01',
      'rem8_synthetic_post_rollback_writer', 1, 1,
      '[{"employeeId":"00000000-0000-4000-8000-666666666666"}]'::jsonb,
      'rem8-disposable-rehearsal'
    FROM ops.target_distribution_request
    ORDER BY target_distribution_request_id
    LIMIT 1
  `);
  return true;
}

async function readAggregate(pool: Pool): Promise<Aggregate> {
  const result = await pool.query<{
    migration_count: string;
    schema_table_counts: Record<string, number>;
    server_major: string;
    target_rows: string;
  }>(`
    SELECT
      (SELECT count(*)::text FROM audit.schema_migration WHERE status = 'succeeded') AS migration_count,
      (SELECT pg_catalog.jsonb_object_agg(item.schemaname, item.table_count ORDER BY item.schemaname)
       FROM (
         SELECT schemaname, count(*)::integer AS table_count
         FROM pg_catalog.pg_tables
         WHERE schemaname IN ('audit', 'ops', 'rpt', 'stg')
         GROUP BY schemaname
       ) AS item) AS schema_table_counts,
      current_setting('server_version_num')::integer / 10000 AS server_major,
      (SELECT count(*)::text FROM ops.target_distribution_request) AS target_rows
  `);
  const row = result.rows[0];
  if (!row) throw new Error("restore_aggregate_missing");
  return {
    migrationCount: Number(row.migration_count),
    schemaTableCounts: row.schema_table_counts,
    serverMajor: Number(row.server_major),
    targetRows: Number(row.target_rows),
  };
}

function digestAggregate(value: Aggregate) {
  return createHash("sha256").update(JSON.stringify({
    migrationCount: value.migrationCount,
    schemaTableCounts: Object.fromEntries(Object.entries(value.schemaTableCounts).sort()),
    serverMajor: value.serverMajor,
    targetRows: value.targetRows,
  })).digest("hex");
}

async function captureSqlState(client: Pool | PoolClient, sql: string) {
  try {
    await client.query(sql);
    return "00000";
  } catch (error) {
    return typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";
  }
}

async function assertArtifactsAbsent(pool: Pool) {
  if (await constraintExists(pool) || await functionExists(pool)) {
    throw new Error("candidate_artifact_already_present");
  }
}

async function constraintExists(pool: Pool) {
  const result = await pool.query<{ exists: boolean }>(`
    SELECT EXISTS (
      SELECT 1 FROM pg_catalog.pg_constraint
      WHERE conrelid = 'ops.target_distribution_request'::regclass
        AND conname = 'ck_target_distribution_employee_ids_unique_v1'
    ) AS exists
  `);
  return result.rows[0]?.exists === true;
}

async function isConstraintValidated(pool: Pool) {
  const result = await pool.query<{ validated: boolean }>(`
    SELECT convalidated AS validated
    FROM pg_catalog.pg_constraint
    WHERE conrelid = 'ops.target_distribution_request'::regclass
      AND conname = 'ck_target_distribution_employee_ids_unique_v1'
  `);
  return result.rows[0]?.validated === true;
}

async function functionExists(pool: Pool) {
  const result = await pool.query<{ exists: boolean }>(`
    SELECT to_regprocedure('ops.target_distribution_employee_ids_unique_v1(jsonb)') IS NOT NULL AS exists
  `);
  return result.rows[0]?.exists === true;
}

async function bestEffortRollback(pool: Pool, rollbackSql: string) {
  await pool.query(rollbackSql).catch(async () => {
    await pool.query(`
      ALTER TABLE ops.target_distribution_request
        DROP CONSTRAINT IF EXISTS ck_target_distribution_employee_ids_unique_v1;
      DROP FUNCTION IF EXISTS ops.target_distribution_employee_ids_unique_v1(JSONB);
    `).catch(() => undefined);
  });
}

function assertExecutionBoundary() {
  if ((process.env.NODE_ENV ?? "").trim().toLowerCase() === "production") {
    throw new Error("production_refused");
  }
  if (process.env.DATABASE_INVARIANT_PREFLIGHT_TARGET !== "disposable"
    || process.env.DATABASE_INVARIANT_PREFLIGHT_ACK !== "read-only-approved") {
    throw new Error("disposable_approval_missing");
  }
}

function readConnectionString() {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("database_url_missing");
  const parsed = new URL(value);
  const database = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)
    || !["localhost", "127.0.0.1"].includes(parsed.hostname)
    || !expectedDatabasePattern.test(database)) {
    throw new Error("non_disposable_target_refused");
  }
  return value;
}

function readReviewedCommit() {
  const value = process.env.REM8_REHEARSAL_REVIEWED_COMMIT?.trim().toLowerCase();
  if (!value || !/^[a-f0-9]{40}$/.test(value)) throw new Error("reviewed_commit_missing");
  return value;
}

function readDigest(name: string) {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value || !/^[a-f0-9]{64}$/.test(value)) throw new Error("rehearsal_digest_missing");
  return value;
}

function readPositiveInteger(name: string) {
  const value = Number(process.env[name]);
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error("rehearsal_scale_missing");
  return value;
}

function digestRunnerFiles() {
  return sha256Hex(runnerFiles
    .map((path) => `${path.split(/[\\/]/).at(-1)}\0${readFileSync(path, "utf8")}`)
    .join("\0"));
}

function writeSafeFailure(error: unknown) {
  const allowed = new Set([
    "candidate_artifact_already_present", "database_url_missing", "disposable_approval_missing",
    "candidate_semantics_failed",
    "duplicate_write_not_rejected", "failed_constraint_marked_valid", "failure_validation_not_proven",
    "lock_timeout_left_partial_constraint", "lock_timeout_not_proven", "non_disposable_target_refused",
    "postgres_17_required", "production_refused", "rehearsal_digest_missing", "rehearsal_scale_missing",
    "restore_aggregate_mismatch", "restore_aggregate_missing", "reviewed_commit_missing",
    "synthetic_scale_missing",
  ]);
  const message = error instanceof Error && allowed.has(error.message)
    ? error.message
    : "rem8_target_constraint_rehearsal_failed";
  process.stderr.write(`${JSON.stringify({
    error: message,
    event: "rem8_target_constraint.disposable_rehearsal_failed",
    targetClass: "disposable",
  })}\n`);
  process.exitCode = 1;
}

void main().catch(writeSafeFailure);
