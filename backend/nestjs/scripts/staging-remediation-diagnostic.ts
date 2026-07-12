import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool, type PoolClient } from "pg";
import { assertConnectionBoundary, type TargetClass } from "./database-invariant-preflight-core";
import { buildDatabaseInvariantPreflightPoolConfig } from "./database-invariant-preflight-config";
import {
  DIAGNOSTIC_IMPACT_INVENTORY_VERSION,
  DIAGNOSTIC_TRANSACTION_CONTRACT,
  assertSanitizedDiagnosticJson,
  createDiagnosticReceipt,
  sha256Hex,
  validateDiagnosticQueryResult,
} from "./staging-remediation-diagnostic-contract";
import {
  diagnosticSourceTables,
  downstreamCodes,
  writePathCodes,
  type DiagnosticSourceTable,
} from "./staging-remediation-diagnostic-allowlists";

const requiredAcknowledgement = "read-only-approved";
const allowedTargetClasses = new Set<TargetClass>(["disposable", "staging"]);
const queryPath = join(__dirname, "..", "..", "..", "db", "preflight", "staging-remediation-diagnostic-v1.sql");
const runnerFiles = [
  join(__dirname, "staging-remediation-diagnostic.ts"),
  join(__dirname, "staging-remediation-diagnostic-contract.ts"),
  join(__dirname, "staging-remediation-diagnostic-allowlists.ts"),
];

// Trace: FR-DIAG-01..11; NFR-01..04; AC-01, AC-02; EC-01..08.
async function main() {
  const targetClass = readTargetClass();
  assertExecutionBoundary(targetClass);
  const connectionString = readRequiredSecret("DATABASE_URL");
  assertConnectionBoundary(targetClass, connectionString, {
    database: process.env.DATABASE_INVARIANT_PREFLIGHT_EXPECTED_DATABASE,
    host: process.env.DATABASE_INVARIANT_PREFLIGHT_EXPECTED_HOST,
  });
  const reviewedCommit = readReviewedCommit();
  const query = readFileSync(queryPath, "utf8");
  const pool = new Pool(buildDatabaseInvariantPreflightPoolConfig(targetClass, connectionString));
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();
    await client.query(DIAGNOSTIC_TRANSACTION_CONTRACT.begin);
    await client.query("SET LOCAL statement_timeout = '30000ms'");
    const isolation = await client.query<{ transaction_isolation: string }>(
      DIAGNOSTIC_TRANSACTION_CONTRACT.showIsolation,
    );
    const readOnly = await client.query<{ transaction_read_only: string }>(
      DIAGNOSTIC_TRANSACTION_CONTRACT.showReadOnly,
    );
    if (normalizeIsolation(isolation.rows[0]?.transaction_isolation) !== "repeatable_read") {
      throw new Error("repeatable_read_not_enforced");
    }
    if (readOnly.rows[0]?.transaction_read_only !== "on") {
      throw new Error("read_only_not_enforced");
    }

    const diagnostic = await client.query<{ diagnostic: unknown }>(query);
    const queryResult = validateDiagnosticQueryResult(diagnostic.rows[0]?.diagnostic);
    const catalog = await readCatalogImpact(client);
    const receipt = createDiagnosticReceipt({
      certificateVerified: targetClass === "staging",
      impactInventory: {
        catalog,
        downstreamCodes: [...downstreamCodes],
        inventoryDigest: "0".repeat(64),
        inventoryVersion: DIAGNOSTIC_IMPACT_INVENTORY_VERSION,
        writePathCodes: [...writePathCodes],
      },
      queryDigest: sha256Hex(query),
      queryResult,
      reviewedCommit,
      runnerDigest: digestRunnerFiles(),
      targetClass,
      targetFingerprint: fingerprintTarget(targetClass, connectionString),
      tlsMode: targetClass === "staging" ? "verify-full" : "disable",
    });
    const serialized = `${JSON.stringify(receipt, null, 2)}\n`;
    assertSanitizedDiagnosticJson(serialized);

    await client.query("ROLLBACK");
    client.release();
    client = null;
    await pool.end();
    process.stdout.write(serialized);
    if (queryResult.overallCheckHits.count > 0) process.exitCode = 2;
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch(() => undefined);
      client.release();
    }
    await pool.end().catch(() => undefined);
    writeSafeFailure(error, targetClass);
  }
}

async function readCatalogImpact(client: PoolClient) {
  const result = await client.query<{
    generated_column_count: number | string;
    source_table: string;
    trigger_count: number | string;
  }>(`
    SELECT
      expected.source_table,
      COUNT(DISTINCT attribute.attnum) FILTER (WHERE attribute.attgenerated <> '')::integer
        AS generated_column_count,
      COUNT(DISTINCT trigger.oid) FILTER (WHERE NOT trigger.tgisinternal)::integer
        AS trigger_count
    FROM unnest($1::text[]) AS expected(source_table)
    INNER JOIN pg_class relation
      ON relation.oid = expected.source_table::regclass
    LEFT JOIN pg_trigger trigger
      ON trigger.tgrelid = relation.oid
    LEFT JOIN pg_attribute attribute
      ON attribute.attrelid = relation.oid
     AND attribute.attnum > 0
     AND NOT attribute.attisdropped
    GROUP BY expected.source_table
    ORDER BY expected.source_table
  `, [[...diagnosticSourceTables]]);
  if (result.rows.length !== diagnosticSourceTables.length) {
    throw new Error("impact_inventory_incomplete");
  }
  return result.rows.map((row) => ({
    generatedColumnCount: readSafeCount(row.generated_column_count),
    sourceTable: row.source_table as DiagnosticSourceTable,
    triggerCount: readSafeCount(row.trigger_count),
  }));
}

function readTargetClass(): TargetClass {
  const value = process.env.DATABASE_INVARIANT_PREFLIGHT_TARGET;
  if (!value || !allowedTargetClasses.has(value as TargetClass)) throw new Error("invalid_target_class");
  return value as TargetClass;
}

function assertExecutionBoundary(targetClass: TargetClass) {
  if ((process.env.NODE_ENV ?? "").trim().toLowerCase() === "production") {
    throw new Error("production_refused");
  }
  if (process.env.DATABASE_INVARIANT_PREFLIGHT_ACK !== requiredAcknowledgement) {
    throw new Error("approval_missing");
  }
  if (targetClass === "staging" && process.env.DATABASE_INVARIANT_PREFLIGHT_STAGING_APPROVED !== "true") {
    throw new Error("staging_approval_missing");
  }
}

function readRequiredSecret(name: "DATABASE_URL") {
  const value = process.env[name];
  if (!value) throw new Error("database_url_missing");
  return value;
}

function readReviewedCommit() {
  const value = process.env.STAGING_REMEDIATION_DIAGNOSTIC_REVIEWED_COMMIT?.trim().toLowerCase();
  if (!value || !/^[a-f0-9]{40}$/.test(value)) throw new Error("reviewed_commit_missing");
  return value;
}

function fingerprintTarget(targetClass: TargetClass, connectionString: string) {
  const parsed = new URL(connectionString);
  const database = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  return sha256Hex(`${targetClass}\0${parsed.hostname.toLowerCase()}\0${database}`);
}

function digestRunnerFiles() {
  return sha256Hex(runnerFiles
    .map((path) => `${path.split(/[\\/]/).at(-1)}\0${readFileSync(path, "utf8")}`)
    .join("\0"));
}

function normalizeIsolation(value: string | undefined) {
  return value?.trim().toLowerCase().replace(/\s+/g, "_");
}

function readSafeCount(value: number | string) {
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 0) throw new Error("invalid_impact_count");
  return count;
}

function writeSafeFailure(error: unknown, targetClass: TargetClass | "unresolved") {
  process.stderr.write(`${JSON.stringify({
    error: classifyDiagnosticSafeError(error),
    event: "staging_remediation_diagnostic.failed",
    targetClass,
  })}\n`);
  process.exitCode = 1;
}

function classifyDiagnosticSafeError(error: unknown) {
  const allowed = new Set([
    "approval_missing",
    "certificate_verification_failed",
    "database_url_missing",
    "diagnostic_schema_mismatch",
    "dishonest_diagnostic_total",
    "impact_inventory_incomplete",
    "invalid_database_protocol",
    "invalid_database_ssl_mode",
    "invalid_database_url",
    "invalid_reviewed_commit",
    "invalid_target_class",
    "non_disposable_target_refused",
    "production_refused",
    "production_target_refused",
    "read_only_not_enforced",
    "repeatable_read_not_enforced",
    "reviewed_commit_missing",
    "sanitization_failed",
    "staging_approval_missing",
    "staging_ssl_ca_missing",
    "staging_target_identity_mismatch",
    "staging_target_identity_missing",
    "staging_verify_full_required",
  ]);
  return error instanceof Error && allowed.has(error.message)
    ? error.message
    : "staging_remediation_diagnostic_failed";
}

void main().catch((error) => writeSafeFailure(error, "unresolved"));
