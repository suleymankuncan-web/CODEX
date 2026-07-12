import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool, type PoolClient } from "pg";
import { assertConnectionBoundary, type TargetClass } from "./database-invariant-preflight-core";
import { buildDatabaseInvariantPreflightPoolConfig } from "./database-invariant-preflight-config";
import { sha256Hex } from "./staging-remediation-diagnostic-contract";
import {
  assertSanitizedAuthorityClassifierJson,
  buildAuthorityClassifierResult,
  createAuthorityClassifierReceipt,
} from "./staging-remediation-row-authority-classifier-contract";
import { validateInvariantV2QueryResult } from "./staging-remediation-invariant-v2-contract";

const requiredAcknowledgement = "read-only-approved";
const allowedTargetClasses = new Set<TargetClass>(["disposable", "staging"]);
const invariantV2QueryPath = join(
  __dirname, "..", "..", "..", "db", "preflight", "staging-remediation-invariant-v2.sql",
);
const classifierQueryPath = join(
  __dirname, "..", "..", "..", "db", "preflight", "staging-remediation-row-authority-classifier-v1.sql",
);
const runnerFiles = [
  join(__dirname, "staging-remediation-row-authority-classifier.ts"),
  join(__dirname, "staging-remediation-row-authority-classifier-contract.ts"),
  join(__dirname, "staging-remediation-row-authority-classifier-allowlists.ts"),
  join(__dirname, "staging-remediation-invariant-v2-contract.ts"),
  join(__dirname, "staging-remediation-invariant-v2-allowlists.ts"),
  join(__dirname, "staging-remediation-diagnostic-contract.ts"),
];

// Trace: FR-01..14; NFR-01..07; AC-01..08; EC-01..14.
async function main() {
  const targetClass = readTargetClass();
  assertExecutionBoundary(targetClass);
  const connectionString = readRequiredSecret();
  assertConnectionBoundary(targetClass, connectionString, {
    database: process.env.DATABASE_INVARIANT_PREFLIGHT_EXPECTED_DATABASE,
    host: process.env.DATABASE_INVARIANT_PREFLIGHT_EXPECTED_HOST,
  });
  const reviewedCommit = readReviewedCommit();
  const invariantV2Query = readFileSync(invariantV2QueryPath, "utf8");
  const classifierQuery = readFileSync(classifierQueryPath, "utf8");
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

    const invariantResult = await client.query<{ invariant: unknown }>(invariantV2Query);
    const invariantV2 = validateInvariantV2QueryResult(invariantResult.rows[0]?.invariant);
    const classifierResult = await client.query<{ authority_classifier: unknown }>(classifierQuery);
    const queryResult = buildAuthorityClassifierResult(
      classifierResult.rows[0]?.authority_classifier,
      invariantV2,
    );
    const receipt = createAuthorityClassifierReceipt({
      certificateVerified: targetClass === "staging",
      classifierQueryDigest: sha256Hex(classifierQuery),
      invariantV2QueryDigest: sha256Hex(invariantV2Query),
      queryResult,
      reviewedCommit,
      runnerDigest: digestRunnerFiles(),
      targetClass,
      targetFingerprint: fingerprintTarget(targetClass, connectionString),
      tlsMode: targetClass === "staging" ? "verify-full" : "disable",
    });
    const serialized = `${JSON.stringify(receipt, null, 2)}\n`;
    assertSanitizedAuthorityClassifierJson(serialized);

    await client.query("ROLLBACK");
    client.release();
    client = null;
    await pool.end();
    process.stdout.write(serialized);
    if (queryResult.overall.checkHitCount > 0) process.exitCode = 2;
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
  const value = process.env.STAGING_REMEDIATION_AUTHORITY_CLASSIFIER_REVIEWED_COMMIT
    ?.trim().toLowerCase();
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
    event: "staging_remediation_row_authority_classifier.failed",
    targetClass,
  })}\n`);
  process.exitCode = 1;
}

function classifySafeError(error: unknown) {
  const allowed = new Set([
    "approval_missing",
    "certificate_verification_failed",
    "database_url_missing",
    "dishonest_authority_family_total",
    "dishonest_authority_overall_total",
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
    "source_contract_version_change_required",
    "staging_approval_missing",
    "staging_ssl_ca_missing",
    "staging_target_identity_mismatch",
    "staging_target_identity_missing",
    "staging_verify_full_required",
    "target_classifier_bucket_forbidden",
    "v2_authority_reconciliation_mismatch",
  ]);
  return error instanceof Error && allowed.has(error.message)
    ? error.message
    : "staging_remediation_row_authority_classifier_failed";
}

void main().catch((error) => writeSafeFailure(error, "unresolved"));
