import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool, type PoolClient } from "pg";
import {
  assertConnectionBoundary,
  type CheckRow,
  type TargetClass,
} from "./database-invariant-preflight-core";
import { buildDatabaseInvariantPreflightPoolConfig } from "./database-invariant-preflight-config";
import { assertSanitizedDiagnosticJson, sha256Hex } from "./staging-remediation-diagnostic-contract";
import { validateInvariantV2QueryResult } from "./staging-remediation-invariant-v2-contract";
import {
  buildReconciliationAuthorityResult,
  buildReconciliationResult,
  createReconciliationReceipt,
} from "./staging-remediation-reconciliation-contract";
import { verifyTargetDuplicateApplicationContract } from "./staging-remediation-reconciliation-source-contract";

const requiredAcknowledgement = "read-only-approved";
const allowedTargetClasses = new Set<TargetClass>(["disposable", "staging"]);
const root = join(__dirname, "..", "..", "..");
const invariantV1QueryPath = join(root, "db", "preflight", "database-invariant-preflight-v1.sql");
const invariantV2QueryPath = join(root, "db", "preflight", "staging-remediation-invariant-v2.sql");
const classifierQueryPath = join(
  root,
  "db",
  "preflight",
  "staging-remediation-row-authority-classifier-v1.sql",
);
const applicationSourcePath = join(
  __dirname,
  "..",
  "src",
  "modules",
  "store-ops",
  "application",
  "target-distribution.service.ts",
);
const applicationSpecPath = applicationSourcePath.replace(/\.ts$/, ".spec.ts");
const runnerFiles = [
  join(__dirname, "staging-remediation-reconciliation.ts"),
  join(__dirname, "staging-remediation-reconciliation-contract.ts"),
  join(__dirname, "staging-remediation-reconciliation-allowlists.ts"),
  join(__dirname, "staging-remediation-reconciliation-source-contract.ts"),
  join(__dirname, "staging-remediation-row-authority-classifier-contract.ts"),
  join(__dirname, "staging-remediation-row-authority-classifier-allowlists.ts"),
  join(__dirname, "staging-remediation-invariant-v2-contract.ts"),
  join(__dirname, "staging-remediation-invariant-v2-allowlists.ts"),
  join(__dirname, "staging-remediation-diagnostic-contract.ts"),
];

// Trace: FR-01..13; NFR-01..07; AC-01..08; EC-01..12.
async function main() {
  const targetClass = readTargetClass();
  assertExecutionBoundary(targetClass);
  const connectionString = readRequiredSecret();
  assertConnectionBoundary(targetClass, connectionString, {
    database: process.env.DATABASE_INVARIANT_PREFLIGHT_EXPECTED_DATABASE,
    host: process.env.DATABASE_INVARIANT_PREFLIGHT_EXPECTED_HOST,
  });
  const reviewedCommit = readReviewedCommit();
  const invariantV1Query = readFileSync(invariantV1QueryPath, "utf8");
  const invariantV2Query = readFileSync(invariantV2QueryPath, "utf8");
  const classifierQuery = readFileSync(classifierQueryPath, "utf8");
  [invariantV1Query, invariantV2Query, classifierQuery].forEach(assertStaticReadOnlySql);
  const applicationProof = verifyTargetDuplicateApplicationContract(
    readFileSync(applicationSourcePath, "utf8"),
    readFileSync(applicationSpecPath, "utf8"),
  );
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

    const invariantV1 = await client.query<CheckRow>(invariantV1Query);
    const invariantV2Rows = await client.query<{ invariant: unknown }>(invariantV2Query);
    const invariantV2 = validateInvariantV2QueryResult(invariantV2Rows.rows[0]?.invariant);
    const classifierRows = await client.query<{ authority_classifier: unknown }>(classifierQuery);
    const authority = buildReconciliationAuthorityResult(
      classifierRows.rows[0]?.authority_classifier,
      invariantV2,
    );
    const queryResult = buildReconciliationResult(
      invariantV1.rows,
      invariantV2,
      authority,
      applicationProof.sourceDigest,
      {
        authorityClassifierV1: sha256Hex(classifierQuery),
        invariantV1: sha256Hex(invariantV1Query),
        invariantV2: sha256Hex(invariantV2Query),
      },
    );
    const receipt = createReconciliationReceipt({
      certificateVerified: targetClass === "staging",
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
    if (queryResult.families.some((family) => family.state === "blocked")) process.exitCode = 2;
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch(() => undefined);
      client.release();
    }
    await pool.end().catch(() => undefined);
    writeSafeFailure(error, targetClass);
  }
}

export function assertStaticReadOnlySql(sql: string) {
  const withoutComments = sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\r\n]*/g, " ");
  if (!/^\s*(?:WITH\b|SELECT\b)/i.test(withoutComments)
    || /\b(?:INSERT|UPDATE|DELETE|MERGE|ALTER|CREATE|DROP|TRUNCATE|GRANT|REVOKE|COPY|CALL|DO)\b/i.test(withoutComments)) {
    throw new Error("non_read_only_sql_refused");
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
  const value = process.env.STAGING_REMEDIATION_RECONCILIATION_REVIEWED_COMMIT
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
    event: "staging_remediation_reconciliation.failed",
    targetClass,
  })}\n`);
  process.exitCode = 1;
}

function classifySafeError(error: unknown) {
  const allowed = new Set([
    "application_contract_missing",
    "application_contract_test_missing",
    "approval_missing",
    "certificate_verification_failed",
    "database_url_missing",
    "invalid_database_protocol",
    "invalid_database_ssl_mode",
    "invalid_database_url",
    "invalid_target_class",
    "non_disposable_target_refused",
    "non_read_only_sql_refused",
    "production_refused",
    "production_target_refused",
    "read_only_not_enforced",
    "repeatable_read_not_enforced",
    "reviewed_commit_missing",
    "sanitization_failed",
    "snapshot_observation_mismatch",
    "source_contract_version_change_required",
    "staging_approval_missing",
    "staging_ssl_ca_missing",
    "staging_target_identity_mismatch",
    "staging_target_identity_missing",
    "staging_verify_full_required",
    "v1_v2_reconciliation_mismatch",
    "v2_authority_reconciliation_mismatch",
  ]);
  return error instanceof Error && allowed.has(error.message)
    ? error.message
    : "staging_remediation_reconciliation_failed";
}

void main().catch((error) => writeSafeFailure(error, "unresolved"));
