import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool, type PoolClient } from "pg";
import { assertConnectionBoundary, type TargetClass } from "./database-invariant-preflight-core";
import { buildDatabaseInvariantPreflightPoolConfig } from "./database-invariant-preflight-config";
import { assertSanitizedDiagnosticJson, sha256Hex } from "./staging-remediation-diagnostic-contract";
import { validateInvariantV2QueryResult } from "./staging-remediation-invariant-v2-contract";
import { validateReconciliationReceipt } from "./staging-remediation-reconciliation-contract";
import { loadRem8TargetConstraintPackage } from "./rem8-target-constraint-package-contract";
import {
  buildRem8Observation,
  createRem8ObservationReceipt,
  type Rem8ObservationPlan,
} from "./rem8-target-constraint-observation-contract";

const requiredAcknowledgement = "read-only-approved";
const allowedTargetClasses = new Set<TargetClass>(["disposable", "staging"]);
const root = join(__dirname, "..", "..", "..");
const observationQueryPath = join(
  root, "db", "preflight", "rem8-target-constraint-observation-v1.sql",
);
const planQueryPath = join(root, "db", "preflight", "rem8-target-constraint-plan-v1.sql");
const invariantV2QueryPath = join(
  root, "db", "preflight", "staging-remediation-invariant-v2.sql",
);
const rem7ReceiptPath = join(
  root,
  "docs",
  "evidence",
  "readiness",
  "2026-07-12-staging-remediation-reconciliation-v1.json",
);
const runnerFiles = [
  join(__dirname, "rem8-target-constraint-observation.ts"),
  join(__dirname, "rem8-target-constraint-observation-contract.ts"),
  join(__dirname, "rem8-target-constraint-package-contract.ts"),
  join(__dirname, "staging-remediation-invariant-v2-contract.ts"),
  join(__dirname, "staging-remediation-invariant-v2-allowlists.ts"),
  join(__dirname, "staging-remediation-reconciliation-contract.ts"),
  join(__dirname, "staging-remediation-reconciliation-allowlists.ts"),
  join(__dirname, "staging-remediation-diagnostic-contract.ts"),
];

// Trace: FR-05..10; NFR-01..04, NFR-08; AC-02, AC-03; EC-05..10, EC-16..18.
async function main() {
  const targetClass = readTargetClass();
  assertExecutionBoundary(targetClass);
  const connectionString = readRequiredSecret();
  assertRem8ConnectionBoundary(targetClass, connectionString);
  const reviewedCommit = readReviewedCommit();
  const observationQuery = readFileSync(observationQueryPath, "utf8");
  const planQuery = readFileSync(planQueryPath, "utf8");
  const invariantV2Query = readFileSync(invariantV2QueryPath, "utf8");
  [observationQuery, planQuery, invariantV2Query].forEach(assertStaticReadOnlySql);
  const rem7Receipt = validateReconciliationReceipt(
    JSON.parse(readFileSync(rem7ReceiptPath, "utf8")),
  );
  const targetFamily = rem7Receipt.queryResult.families.find(
    (family) => family.family === "TARGET-02",
  );
  if (targetFamily?.state !== "eligible_zero") throw new Error("rem7_target_not_eligible");
  const candidate = loadRem8TargetConstraintPackage();
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

    const v2Rows = await client.query<{ invariant: unknown }>(invariantV2Query);
    const invariantV2 = validateInvariantV2QueryResult(v2Rows.rows[0]?.invariant);
    const targetHits = invariantV2.familyTotals.find(
      (family) => family.family === "TARGET-02",
    )?.hitCount;
    if (targetHits === undefined) throw new Error("active_target_v2_total_missing");
    const observationRows = await client.query<{ observation: unknown }>(observationQuery);
    const explainRows = await client.query<Record<string, unknown>>(
      `EXPLAIN (FORMAT JSON, ANALYZE FALSE, BUFFERS FALSE) ${planQuery}`,
    );
    const plan = parseSanitizedPlan(explainRows.rows[0]?.["QUERY PLAN"]);
    const queryResult = buildRem8Observation(
      observationRows.rows[0]?.observation,
      targetHits,
      plan,
      rem7Receipt.receiptDigest,
      candidate.digests,
    );
    const receipt = createRem8ObservationReceipt({
      certificateVerified: targetClass === "staging",
      invariantV2QueryDigest: sha256Hex(invariantV2Query),
      observationQueryDigest: sha256Hex(observationQuery),
      planQueryDigest: sha256Hex(planQuery),
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
    if (queryResult.state === "blocked") process.exitCode = 2;
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch(() => undefined);
      client.release();
    }
    await pool.end().catch(() => undefined);
    writeSafeFailure(error, targetClass);
  }
}

export function parseSanitizedPlan(value: unknown): Rem8ObservationPlan {
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
  if (typeof plan["Node Type"] !== "string") throw new Error("observation_plan_schema_mismatch");
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

export function assertStaticReadOnlySql(sql: string) {
  const withoutComments = sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\r\n]*/g, " ");
  if (!/^\s*(?:WITH\b|SELECT\b)/i.test(withoutComments)
    || /\b(?:INSERT|UPDATE|DELETE|MERGE|ALTER|CREATE|DROP|TRUNCATE|GRANT|REVOKE|COPY|CALL|DO)\b/i.test(withoutComments)) {
    throw new Error("non_read_only_sql_refused");
  }
}

function assertRem8ConnectionBoundary(targetClass: TargetClass, connectionString: string) {
  if (targetClass === "staging") {
    assertConnectionBoundary(targetClass, connectionString, {
      database: process.env.DATABASE_INVARIANT_PREFLIGHT_EXPECTED_DATABASE,
      host: process.env.DATABASE_INVARIANT_PREFLIGHT_EXPECTED_HOST,
    });
    return;
  }
  let parsed: URL;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw new Error("invalid_database_url");
  }
  const database = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
  if (!(["postgres:", "postgresql:"] as string[]).includes(parsed.protocol)) {
    throw new Error("invalid_database_protocol");
  }
  if (!(parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")
    || !/^store_ops_rem8_target_rehearsal_[a-z0-9_]+$/.test(database)) {
    throw new Error("non_disposable_target_refused");
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
  const value = process.env.REM8_TARGET_OBSERVATION_REVIEWED_COMMIT?.trim().toLowerCase();
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
    event: "rem8_target_constraint.observation_failed",
    targetClass,
  })}\n`);
  process.exitCode = 1;
}

function classifySafeError(error: unknown) {
  const allowed = new Set([
    "active_target_v2_total_missing",
    "approval_missing",
    "certificate_verification_failed",
    "database_url_missing",
    "invalid_database_protocol",
    "invalid_database_ssl_mode",
    "invalid_database_url",
    "invalid_target_class",
    "non_disposable_target_refused",
    "non_read_only_sql_refused",
    "observation_plan_schema_mismatch",
    "production_refused",
    "production_target_refused",
    "read_only_not_enforced",
    "rem7_target_not_eligible",
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
    : "rem8_target_constraint_observation_failed";
}

void main().catch((error) => writeSafeFailure(error, "unresolved"));
