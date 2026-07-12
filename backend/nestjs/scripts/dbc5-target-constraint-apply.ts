import { NestFactory } from "@nestjs/core";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Pool, type PoolClient } from "pg";
import { AppModule } from "../src/app.module";
import { MigrationService } from "../src/shared/database/migration.service";
import { assertConnectionBoundary } from "./database-invariant-preflight-core";
import { buildDatabaseInvariantPreflightPoolConfig } from "./database-invariant-preflight-config";
import {
  assertSanitizedDiagnosticJson,
  sha256Hex,
} from "./staging-remediation-diagnostic-contract";
import { validateInvariantV2QueryResult } from "./staging-remediation-invariant-v2-contract";
import {
  buildRem8Observation,
  type Rem8ObservationPlan,
  validateRem8ObservationReceipt,
} from "./rem8-target-constraint-observation-contract";
import {
  validateRem8RehearsalReceipt,
} from "./rem8-target-constraint-rehearsal-contract";
import { loadRem8TargetConstraintPackage } from "./rem8-target-constraint-package-contract";
import {
  DBC5_MIGRATION_NAME,
  createDbc5ApplyReceipt,
  createDualCandidateDigests,
  validateDbc5Prerequisites,
} from "./dbc5-target-constraint-apply-contract";

const root = join(__dirname, "..", "..", "..");
const migrationsRoot = join(root, "db", "migrations");
const migrationPath = join(migrationsRoot, DBC5_MIGRATION_NAME);
const schemaPath = join(root, "db", "schema.sql");
const observationPath = join(root, "db", "preflight", "rem8-target-constraint-observation-v1.sql");
const planPath = join(root, "db", "preflight", "rem8-target-constraint-plan-v1.sql");
const invariantV2Path = join(root, "db", "preflight", "staging-remediation-invariant-v2.sql");
const observationReceiptPath = join(
  root, "docs", "evidence", "readiness",
  "2026-07-12-staging-rem8-target-constraint-observation-v1.json",
);
const rehearsalReceiptPath = join(
  root, "docs", "evidence", "readiness",
  "2026-07-12-staging-rem8-target-constraint-disposable-rehearsal-v1.json",
);
const runnerFiles = [
  join(__dirname, "dbc5-target-constraint-apply.ts"),
  join(__dirname, "dbc5-target-constraint-apply-contract.ts"),
  join(__dirname, "rem8-target-constraint-observation-contract.ts"),
  join(__dirname, "rem8-target-constraint-rehearsal-contract.ts"),
  join(__dirname, "rem8-target-constraint-package-contract.ts"),
  migrationPath,
  observationPath,
  planPath,
  invariantV2Path,
];

type MigrationAuditRow = {
  migration_checksum: string;
  migration_name: string;
  status: "running" | "succeeded" | "failed";
};

type MigrationPreparation = {
  checksumStyles: { gitLf: number; windowsCrlf: number };
  temporaryRoot: string;
};

type PreflightProof = {
  checksumStyles: { gitLf: number; windowsCrlf: number };
  lockBuckets: number;
  over30sTransactions: 0;
  targetLiveRows: number;
  temporaryRoot: string;
  transactionIsolation: "repeatable_read";
  transactionReadOnly: true;
};

// Trace: FR-01..08, FR-11; NFR-01..08; AC-01..04, AC-07; EC-01..08, EC-10.
async function main() {
  assertExecutionBoundary();
  const connectionString = readRequiredSecret();
  assertConnectionBoundary("staging", connectionString, {
    database: process.env.DATABASE_INVARIANT_PREFLIGHT_EXPECTED_DATABASE,
    host: process.env.DATABASE_INVARIANT_PREFLIGHT_EXPECTED_HOST,
  });
  const reviewedCommit = readReviewedCommit();
  const candidate = loadRem8TargetConstraintPackage();
  const dualDigests = createDualCandidateDigests(candidate.sql);
  const observationReceipt = validateRem8ObservationReceipt(
    JSON.parse(readFileSync(observationReceiptPath, "utf8")),
  );
  const rehearsalReceipt = validateRem8RehearsalReceipt(
    JSON.parse(readFileSync(rehearsalReceiptPath, "utf8")),
  );
  validateDbc5Prerequisites(observationReceipt, rehearsalReceipt, dualDigests);
  const poolConfig = buildDatabaseInvariantPreflightPoolConfig("staging", connectionString);
  let ddlAttempted = false;
  let temporaryRoot: string | null = null;

  try {
    const preflight = await runPreflight(poolConfig, candidate.digests, observationReceipt);
    temporaryRoot = preflight.temporaryRoot;
    const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
    let migrationResult;
    try {
      ddlAttempted = true;
      migrationResult = await app.get(MigrationService).runMigrations(temporaryRoot);
    } finally {
      await app.close();
    }
    if (migrationResult.applied.length !== 1
      || migrationResult.applied[0] !== DBC5_MIGRATION_NAME
      || migrationResult.skipped.length !== 59
      || migrationResult.failed.length !== 0) {
      throw new Error("migration_result_mismatch");
    }
    const postflight = await runPostflight(
      poolConfig,
      sha256Hex(lf(readFileSync(migrationPath, "utf8"))),
    );
    const receipt = createDbc5ApplyReceipt({
      candidateDigests: dualDigests,
      certificateVerified: true,
      evidenceReceipts: {
        observation: observationReceipt.receiptDigest,
        rehearsal: rehearsalReceipt.receiptDigest,
      },
      migration: {
        appliedCount: 1,
        checksum: postflight.migrationChecksum,
        checksumStyles: preflight.checksumStyles,
        failedCount: 0,
        name: DBC5_MIGRATION_NAME,
        skippedCount: 59,
      },
      postflight: {
        activeTargetV2Hits: 0,
        constraintState: "present_valid_exact",
        functionState: "present_immutable_exact",
        indexStrategy: "not_applicable_no_index_candidate",
        migrationState: "succeeded_exact",
        transactionReadOnly: postflight.transactionReadOnly,
      },
      preflight: {
        lockBuckets: preflight.lockBuckets,
        over30sTransactions: 0,
        state: "eligible",
        targetLiveRows: preflight.targetLiveRows,
        transactionIsolation: preflight.transactionIsolation,
        transactionReadOnly: preflight.transactionReadOnly,
      },
      reviewedCommit,
      runnerDigest: digestRunnerFiles(),
      targetFingerprint: fingerprintTarget(connectionString),
    });
    const serialized = `${JSON.stringify(receipt, null, 2)}\n`;
    assertSanitizedDiagnosticJson(serialized);
    process.stdout.write(serialized);
  } catch (error) {
    writeSafeFailure(error, ddlAttempted);
  } finally {
    if (temporaryRoot) rmSync(temporaryRoot, { force: true, recursive: true });
  }
}

async function runPreflight(
  poolConfig: ReturnType<typeof buildDatabaseInvariantPreflightPoolConfig>,
  packageDigests: ReturnType<typeof loadRem8TargetConstraintPackage>["digests"],
  observationReceipt: ReturnType<typeof validateRem8ObservationReceipt>,
): Promise<PreflightProof> {
  const pool = new Pool(poolConfig);
  let client: PoolClient | null = null;
  let migrationPreparation: MigrationPreparation | null = null;
  try {
    client = await pool.connect();
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await client.query("SET LOCAL statement_timeout = '30000ms'");
    const isolation = await client.query<{ transaction_isolation: string }>(
      "SHOW transaction_isolation",
    );
    const readOnly = await client.query<{ transaction_read_only: string }>(
      "SHOW transaction_read_only",
    );
    if (normalizeIsolation(isolation.rows[0]?.transaction_isolation) !== "repeatable_read") {
      throw new Error("repeatable_read_not_enforced");
    }
    if (readOnly.rows[0]?.transaction_read_only !== "on") {
      throw new Error("read_only_not_enforced");
    }
    const audit = await client.query<MigrationAuditRow>(`
      SELECT migration_name, migration_checksum, status
      FROM audit.schema_migration
      ORDER BY migration_name ASC
    `);
    migrationPreparation = preparePortableMigrationTree(audit.rows);
    const observationSql = readFileSync(observationPath, "utf8");
    const planSql = readFileSync(planPath, "utf8");
    const invariantSql = readFileSync(invariantV2Path, "utf8");
    const v2 = validateInvariantV2QueryResult(
      (await client.query<{ invariant: unknown }>(invariantSql)).rows[0]?.invariant,
    );
    const activeTargetV2Hits = v2.familyTotals.find(
      (family) => family.family === "TARGET-02",
    )?.hitCount;
    if (activeTargetV2Hits === undefined) throw new Error("active_target_v2_total_missing");
    const rawObservation = (await client.query<{ observation: unknown }>(observationSql))
      .rows[0]?.observation;
    const rawPlan = (await client.query<Record<string, unknown>>(
      `EXPLAIN (FORMAT JSON, ANALYZE FALSE, BUFFERS FALSE) ${planSql}`,
    )).rows[0]?.["QUERY PLAN"];
    const observation = buildRem8Observation(
      rawObservation,
      activeTargetV2Hits,
      parseSanitizedPlan(rawPlan),
      observationReceipt.queryResult.rem7ReceiptDigest,
      packageDigests,
    );
    if (observation.state !== "eligible_for_disposable_rehearsal"
      || observation.transactions.over30sCount !== 0
      || observation.locks.some((lock) => !lock.granted
        || ["AccessExclusiveLock", "ShareUpdateExclusiveLock"].includes(lock.mode))) {
      throw new Error("dbc5_preflight_not_eligible");
    }
    await client.query("ROLLBACK");
    client.release();
    client = null;
    await pool.end();
    return {
      checksumStyles: migrationPreparation.checksumStyles,
      lockBuckets: observation.locks.length,
      over30sTransactions: 0,
      targetLiveRows: observation.targetTable.liveRows,
      temporaryRoot: migrationPreparation.temporaryRoot,
      transactionIsolation: "repeatable_read",
      transactionReadOnly: true,
    };
  } catch (error) {
    if (migrationPreparation) {
      rmSync(migrationPreparation.temporaryRoot, { force: true, recursive: true });
    }
    if (client) {
      await client.query("ROLLBACK").catch(() => undefined);
      client.release();
    }
    await pool.end().catch(() => undefined);
    throw error;
  }
}

function preparePortableMigrationTree(rows: MigrationAuditRow[]): MigrationPreparation {
  const files = readdirSync(migrationsRoot).filter((file) => file.endsWith(".sql")).sort();
  if (files.length !== 60 || files.at(-1) !== DBC5_MIGRATION_NAME) {
    throw new Error("migration_file_set_mismatch");
  }
  const rowsByName = new Map(rows.map((row) => [row.migration_name, row]));
  if (rows.length !== 59 || rows.some((row) => row.status !== "succeeded")
    || rowsByName.has(DBC5_MIGRATION_NAME)) {
    throw new Error("migration_audit_state_mismatch");
  }
  const temporaryRoot = mkdtempSync(join(tmpdir(), "hr-axis-dbc5-migrations-"));
  try {
    const tempDb = join(temporaryRoot, "db");
    const tempMigrations = join(tempDb, "migrations");
    mkdirSync(tempMigrations, { recursive: true });
    writeFileSync(join(tempDb, "schema.sql"), lf(readFileSync(schemaPath, "utf8")), "utf8");
    let gitLf = 0;
    let windowsCrlf = 0;
    for (const file of files) {
      const raw = readFileSync(join(migrationsRoot, file), "utf8");
      if (file === DBC5_MIGRATION_NAME) {
        writeFileSync(join(tempMigrations, file), lf(raw), "utf8");
        continue;
      }
      const audit = rowsByName.get(file);
      if (!audit) throw new Error("migration_audit_state_mismatch");
      const gitText = lf(raw);
      const windowsText = crlf(raw);
      if (sha256Hex(gitText) === audit.migration_checksum) {
        gitLf += 1;
        writeFileSync(join(tempMigrations, file), gitText, "utf8");
      } else if (sha256Hex(windowsText) === audit.migration_checksum) {
        windowsCrlf += 1;
        writeFileSync(join(tempMigrations, file), windowsText, "utf8");
      } else {
        throw new Error("migration_checksum_mismatch");
      }
    }
    return {
      checksumStyles: { gitLf, windowsCrlf },
      temporaryRoot,
    };
  } catch (error) {
    rmSync(temporaryRoot, { force: true, recursive: true });
    throw error;
  }
}

async function runPostflight(
  poolConfig: ReturnType<typeof buildDatabaseInvariantPreflightPoolConfig>,
  expectedChecksum: string,
) {
  const pool = new Pool(poolConfig);
  let client: PoolClient | null = null;
  try {
    client = await pool.connect();
    await client.query("BEGIN READ ONLY");
    const readOnly = await client.query<{ transaction_read_only: string }>(
      "SHOW transaction_read_only",
    );
    if (readOnly.rows[0]?.transaction_read_only !== "on") {
      throw new Error("read_only_not_enforced");
    }
    const invariantSql = readFileSync(invariantV2Path, "utf8");
    const result = await client.query<{
      constraint_definition: string | null;
      constraint_validated: boolean | null;
      function_config: string[] | null;
      function_immutable: boolean;
      function_parallel_safe: boolean;
      function_strict: boolean;
      migration_checksum: string | null;
      migration_status: string | null;
      related_index_count: string;
    }>(`
      SELECT
        migration.migration_checksum,
        migration.status AS migration_status,
        constraint_state.convalidated AS constraint_validated,
        pg_catalog.pg_get_constraintdef(constraint_state.oid, true) AS constraint_definition,
        function_state.provolatile = 'i' AS function_immutable,
        function_state.proisstrict AS function_strict,
        function_state.proparallel = 's' AS function_parallel_safe,
        function_state.proconfig AS function_config,
        (SELECT count(*)::text
         FROM pg_catalog.pg_indexes
         WHERE schemaname = 'ops'
           AND indexdef ILIKE '%target_distribution_employee_ids_unique_v1%') AS related_index_count
      FROM audit.schema_migration migration
      LEFT JOIN pg_catalog.pg_constraint constraint_state
        ON constraint_state.conrelid = 'ops.target_distribution_request'::regclass
       AND constraint_state.conname = 'ck_target_distribution_employee_ids_unique_v1'
      LEFT JOIN pg_catalog.pg_proc function_state
        ON function_state.oid = pg_catalog.to_regprocedure(
          'ops.target_distribution_employee_ids_unique_v1(jsonb)'
        )
      WHERE migration.migration_name = $1
    `, [DBC5_MIGRATION_NAME]);
    const row = result.rows[0];
    if (!row || row.migration_status !== "succeeded"
      || row.migration_checksum !== expectedChecksum
      || row.constraint_validated !== true
      || row.constraint_definition
        !== "CHECK (ops.target_distribution_employee_ids_unique_v1(allocation_json))"
      || row.function_immutable !== true || row.function_strict !== true
      || row.function_parallel_safe !== true
      || row.function_config?.length !== 1
      || row.function_config[0] !== "search_path=pg_catalog"
      || row.related_index_count !== "0") {
      throw new Error("dbc5_postflight_catalog_mismatch");
    }
    const v2 = validateInvariantV2QueryResult(
      (await client.query<{ invariant: unknown }>(invariantSql)).rows[0]?.invariant,
    );
    const targetHits = v2.familyTotals.find((family) => family.family === "TARGET-02")?.hitCount;
    if (targetHits !== 0) throw new Error("dbc5_postflight_target_drift");
    await client.query("ROLLBACK");
    client.release();
    client = null;
    return { migrationChecksum: row.migration_checksum, transactionReadOnly: true as const };
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch(() => undefined);
      client.release();
      client = null;
    }
    throw error;
  } finally {
    await pool.end();
  }
}

function parseSanitizedPlan(value: unknown): Rem8ObservationPlan {
  if (!Array.isArray(value) || value.length !== 1 || !value[0]
    || typeof value[0] !== "object" || Array.isArray(value[0])) {
    throw new Error("observation_plan_schema_mismatch");
  }
  const rootPlan = (value[0] as Record<string, unknown>).Plan;
  if (!rootPlan || typeof rootPlan !== "object" || Array.isArray(rootPlan)) {
    throw new Error("observation_plan_schema_mismatch");
  }
  const nodeTypes: string[] = [];
  collectNodeTypes(rootPlan as Record<string, unknown>, nodeTypes);
  const totalCost = Number((rootPlan as Record<string, unknown>)["Total Cost"]);
  const planRows = Number((rootPlan as Record<string, unknown>)["Plan Rows"]);
  if (!Number.isFinite(totalCost) || totalCost < 0
    || !Number.isSafeInteger(planRows) || planRows < 0) {
    throw new Error("observation_plan_schema_mismatch");
  }
  return { nodeTypes: [...new Set(nodeTypes)], planRows, totalCost };
}

function collectNodeTypes(plan: Record<string, unknown>, output: string[]) {
  if (typeof plan["Node Type"] !== "string") {
    throw new Error("observation_plan_schema_mismatch");
  }
  output.push(plan["Node Type"]);
  const children = plan.Plans;
  if (children === undefined) return;
  if (!Array.isArray(children)) throw new Error("observation_plan_schema_mismatch");
  for (const child of children) {
    if (!child || typeof child !== "object" || Array.isArray(child)) {
      throw new Error("observation_plan_schema_mismatch");
    }
    collectNodeTypes(child as Record<string, unknown>, output);
  }
}

function assertExecutionBoundary() {
  if ((process.env.NODE_ENV ?? "").trim().toLowerCase() === "production") {
    throw new Error("production_refused");
  }
  if (process.env.DATABASE_INVARIANT_PREFLIGHT_TARGET !== "staging"
    || process.env.DATABASE_INVARIANT_PREFLIGHT_ACK !== "staging-ddl-approved"
    || process.env.DBC5_TARGET_CONSTRAINT_STAGING_APPROVED !== "true") {
    throw new Error("staging_ddl_approval_missing");
  }
}

function readRequiredSecret() {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("database_url_missing");
  return value;
}

function readReviewedCommit() {
  const value = process.env.DBC5_TARGET_CONSTRAINT_REVIEWED_COMMIT?.trim().toLowerCase();
  if (!value || !/^[a-f0-9]{40}$/.test(value)) throw new Error("reviewed_commit_missing");
  return value;
}

function fingerprintTarget(connectionString: string) {
  const parsed = new URL(connectionString);
  const database = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  return sha256Hex(`staging\0${parsed.hostname.toLowerCase()}\0${database}`);
}

function digestRunnerFiles() {
  return sha256Hex(runnerFiles
    .map((path) => `${path.split(/[\\/]/).at(-1)}\0${readFileSync(path, "utf8")}`)
    .join("\0"));
}

function normalizeIsolation(value: string | undefined) {
  return value?.trim().toLowerCase().replace(/\s+/g, "_");
}

function lf(value: string) { return value.replace(/\r\n?/g, "\n"); }
function crlf(value: string) { return lf(value).replace(/\n/g, "\r\n"); }

function writeSafeFailure(error: unknown, ddlAttempted = false) {
  const code = typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code ?? "") : "";
  const sqlState = code === "55P03" ? "lock_timeout"
    : code === "23514" ? "validation_violation" : null;
  const allowed = new Set([
    "active_target_v2_total_missing", "candidate_evidence_digest_mismatch",
    "database_url_missing", "dbc5_postflight_catalog_mismatch",
    "dbc5_postflight_target_drift", "dbc5_preflight_not_eligible",
    "migration_audit_state_mismatch", "migration_checksum_mismatch",
    "migration_file_set_mismatch", "migration_result_mismatch", "production_refused",
    "read_only_not_enforced", "rem8_decision_not_ready", "rem8_evidence_provenance_mismatch",
    "repeatable_read_not_enforced",
    "reviewed_commit_missing", "staging_ddl_approval_missing",
    "staging_target_identity_mismatch", "staging_target_identity_missing",
    "staging_verify_full_required",
  ]);
  const errorName = sqlState ?? (error instanceof Error && allowed.has(error.message)
    ? error.message : "dbc5_target_constraint_apply_failed");
  process.stderr.write(`${JSON.stringify({
      error: errorName,
      event: "dbc5_target_constraint.apply_failed",
      stagingDdlExecuted: ddlAttempted ? "unverified_after_attempt" : false,
    targetClass: "staging",
  })}\n`);
  process.exitCode = 1;
}

void main().catch(writeSafeFailure);
