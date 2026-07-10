import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool, type PoolClient } from "pg";
import {
  assertConnectionBoundary,
  classifySafeError,
  mapCheckResult,
  resolveDecision,
  type CheckRow,
  type TargetClass,
} from "./database-invariant-preflight-core";

const requiredAcknowledgement = "read-only-approved";
const allowedTargetClasses = new Set<TargetClass>(["disposable", "staging"]);

async function main() {
  const targetClass = readTargetClass();
  assertExecutionBoundary(targetClass);
  const connectionString = readRequiredSecret("DATABASE_URL");
  assertConnectionBoundary(targetClass, connectionString, {
    database: process.env.DATABASE_INVARIANT_PREFLIGHT_EXPECTED_DATABASE,
    host: process.env.DATABASE_INVARIANT_PREFLIGHT_EXPECTED_HOST,
  });
  const query = readFileSync(
    join(__dirname, "..", "..", "..", "db", "preflight", "database-invariant-preflight-v1.sql"),
    "utf8",
  );
  const pool = new Pool({
    connectionString,
    max: 1,
    ssl: process.env.DB_SSL_MODE === "require" ? { rejectUnauthorized: false } : false,
  });
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();
    await client.query("BEGIN READ ONLY");
    await client.query("SET LOCAL statement_timeout = '30000ms'");
    const readOnly = await client.query<{ transaction_read_only: string }>(
      "SHOW transaction_read_only",
    );
    if (readOnly.rows[0]?.transaction_read_only !== "on") {
      throw new Error("read_only_not_enforced");
    }

    const candidateKeys = await readCandidateKeyMetadata(client);
    const checks = await client.query<CheckRow>(query);
    const provider = await readProviderMetadata(client);
    const results = checks.rows.map((row) => mapCheckResult(row, { candidateKeys, targetClass }));
    const violationCount = results.reduce((total, result) => total + result.violationCount, 0);
    const decision = resolveDecision(targetClass, violationCount);

    process.stdout.write(`${JSON.stringify({
      candidateKeys,
      decision,
      event: "database_invariant_preflight.completed",
      liveEvidence: targetClass === "staging" ? "safe_target_run" : "blocked_live_evidence",
      provider,
      results,
      targetClass,
      transactionReadOnly: true,
      violationCount,
    }, null, 2)}\n`);

    await client.query("ROLLBACK");
    client.release();
    client = null;
    await pool.end();

    if (violationCount > 0) process.exitCode = 2;
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch(() => undefined);
      client.release();
    }
    await pool.end().catch(() => undefined);
    process.stderr.write(`${JSON.stringify({
      error: classifySafeError(error),
      event: "database_invariant_preflight.failed",
      targetClass,
    })}\n`);
    process.exitCode = 1;
  }
}

function readTargetClass(): TargetClass {
  const value = process.env.DATABASE_INVARIANT_PREFLIGHT_TARGET;
  if (!value || !allowedTargetClasses.has(value as TargetClass)) {
    throw new Error("invalid_target_class");
  }
  return value as TargetClass;
}

function assertExecutionBoundary(targetClass: TargetClass) {
  if (process.env.NODE_ENV === "production") throw new Error("production_refused");
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

async function readProviderMetadata(client: PoolClient) {
  const version = await client.query<{ server_version_num: string; server_version: string }>(`
    SELECT
      current_setting('server_version_num') AS server_version_num,
      current_setting('server_version') AS server_version
  `);
  const extensions = await client.query<{ extname: string }>(`
    SELECT extname
    FROM pg_extension
    WHERE extname IN ('timescaledb', 'plv8', 'plcoffee', 'plls', 'pgjwt')
    ORDER BY extname
  `);
  return {
    deprecatedExtensionsPresent: extensions.rows.map((row) => row.extname),
    serverVersion: version.rows[0]?.server_version ?? "unknown",
    serverVersionNum: version.rows[0]?.server_version_num ?? "unknown",
  };
}

async function readCandidateKeyMetadata(client: PoolClient) {
  const result = await client.query<{
    region_composite_unique: boolean;
    store_composite_unique: boolean;
  }>(`
    SELECT
      EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'ops.region'::regclass
          AND contype = 'u'
          AND pg_get_constraintdef(oid) = 'UNIQUE (region_id, company_id)'
      ) AS region_composite_unique,
      EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'ops.store'::regclass
          AND contype = 'u'
          AND pg_get_constraintdef(oid) = 'UNIQUE (store_id, company_id, region_id)'
      ) AS store_composite_unique
  `);
  return {
    regionCompositeUniquePresent: result.rows[0]?.region_composite_unique ?? false,
    storeCompositeUniquePresent: result.rows[0]?.store_composite_unique ?? false,
  };
}

void main().catch((error) => {
  process.stderr.write(`${JSON.stringify({
    error: classifySafeError(error),
    event: "database_invariant_preflight.failed",
    targetClass: "unresolved",
  })}\n`);
  process.exitCode = 1;
});
