import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool, type PoolClient } from "pg";
import { assertConnectionBoundary, type TargetClass } from "./database-invariant-preflight-core";
import { buildDatabaseInvariantPreflightPoolConfig } from "./database-invariant-preflight-config";
import { sha256Hex } from "./staging-remediation-diagnostic-contract";
import {
  assertSanitizedInvariantV2Json,
  createInvariantV2Receipt,
  validateInvariantV2QueryResult,
} from "./staging-remediation-invariant-v2-contract";

const requiredAcknowledgement = "read-only-approved";
const allowedTargetClasses = new Set<TargetClass>(["disposable", "staging"]);
const queryPath = join(__dirname, "..", "..", "..", "db", "preflight", "staging-remediation-invariant-v2.sql");
const runnerFiles = [
  join(__dirname, "staging-remediation-invariant-v2.ts"),
  join(__dirname, "staging-remediation-invariant-v2-contract.ts"),
  join(__dirname, "staging-remediation-invariant-v2-allowlists.ts"),
  join(__dirname, "staging-remediation-diagnostic-contract.ts"),
];

// Trace: FR-DIAG-08, FR-DIAG-09, FR-DIAG-11, FR-DEC-08; NFR-01..04; AC-01, AC-11, AC-12.
async function main() {
  const targetClass = readTargetClass();
  assertExecutionBoundary(targetClass);
  const connectionString = readRequiredSecret();
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
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await client.query("SET LOCAL statement_timeout = '30000ms'");
    const isolation = await client.query<{ transaction_isolation: string }>("SHOW transaction_isolation");
    const readOnly = await client.query<{ transaction_read_only: string }>("SHOW transaction_read_only");
    if (normalizeIsolation(isolation.rows[0]?.transaction_isolation) !== "repeatable_read") {
      throw new Error("repeatable_read_not_enforced");
    }
    if (readOnly.rows[0]?.transaction_read_only !== "on") throw new Error("read_only_not_enforced");

    const result = await client.query<{ invariant: unknown }>(query);
    const queryResult = validateInvariantV2QueryResult(result.rows[0]?.invariant);
    const receipt = createInvariantV2Receipt({
      certificateVerified: targetClass === "staging",
      queryDigest: sha256Hex(query),
      queryResult,
      reviewedCommit,
      runnerDigest: digestRunnerFiles(),
      targetClass,
      targetFingerprint: fingerprintTarget(targetClass, connectionString),
      tlsMode: targetClass === "staging" ? "verify-full" : "disable",
    });
    const serialized = `${JSON.stringify(receipt, null, 2)}\n`;
    assertSanitizedInvariantV2Json(serialized);

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

function readTargetClass(): TargetClass {
  const value = process.env.DATABASE_INVARIANT_PREFLIGHT_TARGET;
  if (!value || !allowedTargetClasses.has(value as TargetClass)) throw new Error("invalid_target_class");
  return value as TargetClass;
}

function assertExecutionBoundary(targetClass: TargetClass) {
  if ((process.env.NODE_ENV ?? "").trim().toLowerCase() === "production") throw new Error("production_refused");
  if (process.env.DATABASE_INVARIANT_PREFLIGHT_ACK !== requiredAcknowledgement) {
    throw new Error("approval_missing");
  }
  if (targetClass === "staging" && process.env.DATABASE_INVARIANT_PREFLIGHT_STAGING_APPROVED !== "true") {
    throw new Error("staging_approval_missing");
  }
}

function readRequiredSecret() {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("database_url_missing");
  return value;
}

function readReviewedCommit() {
  const value = process.env.STAGING_REMEDIATION_INVARIANT_V2_REVIEWED_COMMIT?.trim().toLowerCase();
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

function writeSafeFailure(error: unknown, targetClass: TargetClass | "unresolved") {
  process.stderr.write(`${JSON.stringify({
    error: classifySafeError(error),
    event: "staging_remediation_invariant_v2.failed",
    targetClass,
  })}\n`);
  process.exitCode = 1;
}

function classifySafeError(error: unknown) {
  const allowed = new Set([
    "approval_missing",
    "certificate_verification_failed",
    "database_url_missing",
    "dishonest_family_total",
    "dishonest_overall_total",
    "dishonest_v1_bridge",
    "dishonest_v2_bridge",
    "incomplete_family_catalog",
    "invalid_database_protocol",
    "invalid_database_ssl_mode",
    "invalid_database_url",
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
    : "staging_remediation_invariant_v2_failed";
}

void main().catch((error) => writeSafeFailure(error, "unresolved"));
