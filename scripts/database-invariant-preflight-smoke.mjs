import { spawnSync } from "node:child_process";
import { join } from "node:path";

const workspaceRoot = join(import.meta.dirname, "..");
const backendDir = join(workspaceRoot, "backend", "nestjs");
const databaseName = "store_ops_fresh_migration_smoke_preflight";
const databaseHost = "localhost";
const databasePort = process.env.MIGRATION_SMOKE_DB_PORT ?? "54329";
const databaseUser = process.env.MIGRATION_SMOKE_DB_USER ?? "postgres";
const databasePassword = process.env.MIGRATION_SMOKE_DB_PASSWORD ?? "postgres";

if (process.env.NODE_ENV === "production") fail("Production execution refused.");

run(process.execPath, ["scripts/migration-fresh-db-smoke.mjs"], {
  cwd: workspaceRoot,
  env: {
    ...process.env,
    MIGRATION_SMOKE_DB_HOST: databaseHost,
    MIGRATION_SMOKE_DB_NAME: databaseName,
    MIGRATION_SMOKE_DB_PORT: databasePort,
    MIGRATION_SMOKE_DB_USER: databaseUser,
    MIGRATION_SMOKE_DB_PASSWORD: databasePassword,
  },
});

const databaseUrl = `postgres://${databaseUser}:${databasePassword}@${databaseHost}:${databasePort}/${databaseName}`;
const cleanResult = parseJson(runNpmCapture("preflight:database:invariants", {
  DATABASE_INVARIANT_PREFLIGHT_ACK: "read-only-approved",
  DATABASE_INVARIANT_PREFLIGHT_TARGET: "disposable",
  DATABASE_URL: databaseUrl,
}));

// Trace: FR-DIAG-08, FR-DIAG-11; NFR-01, NFR-04; AC-01.
const remediationDiagnostic = parseJson(runNpmCapture("diagnose:staging:remediation", {
  DATABASE_INVARIANT_PREFLIGHT_ACK: "read-only-approved",
  DATABASE_INVARIANT_PREFLIGHT_TARGET: "disposable",
  DATABASE_URL: databaseUrl,
  STAGING_REMEDIATION_DIAGNOSTIC_REVIEWED_COMMIT: "a".repeat(40),
}));
if (
  remediationDiagnostic.event !== "staging_remediation_diagnostic.completed" ||
  remediationDiagnostic.targetClass !== "disposable" ||
  remediationDiagnostic.transactionIsolation !== "repeatable_read" ||
  remediationDiagnostic.transactionReadOnly !== true ||
  remediationDiagnostic.queryResult?.overallCheckHits?.count !== 0
) {
  fail("Clean disposable remediation diagnostic did not prove its snapshot contract.");
}

// Trace: FR-DIAG-08, FR-DIAG-11, FR-DEC-08; NFR-01..04; AC-01, AC-11, AC-12.
const invariantV2 = parseJson(runNpmCapture("diagnose:staging:remediation:v2", {
  DATABASE_INVARIANT_PREFLIGHT_ACK: "read-only-approved",
  DATABASE_INVARIANT_PREFLIGHT_TARGET: "disposable",
  DATABASE_URL: databaseUrl,
  STAGING_REMEDIATION_INVARIANT_V2_REVIEWED_COMMIT: "b".repeat(40),
}));
const invariantV2ReceiptBound = /^[a-f0-9]{64}$/.test(invariantV2.receiptDigest);
const invariantV2BridgeExact = invariantV2.queryResult?.bridge?.length === 4
  && invariantV2.queryResult.bridge.every((item) => (
    item.v1HitCount === 0
    && item.v2HitCount === 0
    && item.carriedForwardCount === 0
    && item.revisedValidCount === 0
    && item.v2NewCount === 0
  ));
if (
  invariantV2.event !== "staging_remediation_invariant_v2.completed"
  || invariantV2.targetClass !== "disposable"
  || invariantV2.transactionIsolation !== "repeatable_read"
  || invariantV2.transactionReadOnly !== true
  || invariantV2.queryResult?.overallCheckHits?.count !== 0
  || !invariantV2ReceiptBound
  || !invariantV2BridgeExact
) {
  fail("Clean disposable V2 invariant did not prove its receipt and bridge contract.");
}

// Trace: FR-02, FR-03, FR-11, FR-12; NFR-01..05; AC-01, AC-02, AC-05, AC-07.
const authorityClassifier = parseJson(runNpmCapture("diagnose:staging:remediation:authority:v1", {
  DATABASE_INVARIANT_PREFLIGHT_ACK: "read-only-approved",
  DATABASE_INVARIANT_PREFLIGHT_TARGET: "disposable",
  DATABASE_URL: databaseUrl,
  STAGING_REMEDIATION_AUTHORITY_CLASSIFIER_REVIEWED_COMMIT: "c".repeat(40),
}));
if (
  authorityClassifier.event !== "staging_remediation_row_authority_classifier.completed"
  || authorityClassifier.targetClass !== "disposable"
  || authorityClassifier.transactionIsolation !== "repeatable_read"
  || authorityClassifier.transactionReadOnly !== true
  || authorityClassifier.queryResult?.overall?.checkHitCount !== 0
  || authorityClassifier.queryResult?.overall?.authorityUnitCount !== 0
  || authorityClassifier.queryResult?.sourceContracts?.[0]?.state !== "absent"
  || !/^[a-f0-9]{64}$/.test(authorityClassifier.receiptDigest)
) {
  fail("Clean disposable authority classifier did not prove its receipt and snapshot contract.");
}

const requiredCheckIds = [
  "ASSIGN-01", "AUTH-01", "AUTH-02", "KEY-01", "ORG-01", "ORG-02",
  "ORG-03", "ORG-04", "TARGET-01", "TARGET-02", "TARGET-03",
];
if (cleanResult.decision !== "clean_local" || cleanResult.liveEvidence !== "blocked_live_evidence") {
  fail("Clean disposable result crossed the live-evidence boundary.");
}
if (cleanResult.transactionReadOnly !== true || cleanResult.violationCount !== 0) {
  fail("Clean disposable result did not prove read-only zero-violation evidence.");
}
const cleanIds = cleanResult.results?.map((result) => result.checkId).sort();
if (JSON.stringify(cleanIds) !== JSON.stringify(requiredCheckIds)) {
  fail("Clean disposable result did not contain the exact required check inventory.");
}
if (cleanResult.results.some((result) => result.violationCount !== 0)) {
  fail("Freshly migrated disposable database contains invariant violations.");
}
const assignment = cleanResult.results.find((result) => result.checkId === "ASSIGN-01");
if (assignment?.classification !== "requires_business_decision") {
  fail("Clean fixture incorrectly approved unresolved assignment temporal semantics.");
}

const fixtureResult = parseJson(runNpmCapture("smoke:database:invariants:fixture", {
  DATABASE_URL: databaseUrl,
}));
if (fixtureResult.rolledBack !== true) fail("Known-violation fixture did not prove rollback.");

const authorityClassifierFixture = parseJson(runNpmCapture(
  "smoke:staging:remediation:authority:fixture",
  { DATABASE_URL: databaseUrl },
));
const authorityClassifierFixtureRolledBack = authorityClassifierFixture.rolledBack === true;
const authorityClassifierReasons = authorityClassifierFixture.reasons;
if (!authorityClassifierFixtureRolledBack) fail("Authority classifier fixture did not prove rollback.");

process.stdout.write(`${JSON.stringify({
  cleanCheckCount: cleanIds.length,
  cleanViolationCount: cleanResult.violationCount,
  authorityClassifierFixtureRolledBack,
  authorityClassifierQuerySet: authorityClassifier.queryResult.querySetVersion,
  authorityClassifierReasons,
  authorityClassifierReceiptBound: /^[a-f0-9]{64}$/.test(authorityClassifier.receiptDigest),
  event: "database_invariant_preflight.smoke_completed",
  fixtureResults: fixtureResult.results,
  fixtureRolledBack: fixtureResult.rolledBack,
  liveEvidence: cleanResult.liveEvidence,
  invariantV2BridgeExact,
  invariantV2QuerySet: invariantV2.queryResult.querySetVersion,
  invariantV2ReceiptBound,
  remediationDiagnosticQuerySet: remediationDiagnostic.queryResult.querySetVersion,
  remediationDiagnosticReceiptBound: /^[a-f0-9]{64}$/.test(remediationDiagnostic.receiptDigest),
  targetClass: "disposable",
}, null, 2)}\n`);

function runNpmCapture(script, extraEnvironment) {
  const command = npmRun(["run", "--silent", script]);
  return runCapture(command.command, command.args, {
    cwd: backendDir,
    env: { ...process.env, ...extraEnvironment },
  });
}

function npmRun(args) {
  if (process.platform === "win32") {
    return { command: "cmd.exe", args: ["/d", "/s", "/c", ["npm.cmd", ...args].join(" ")] };
  }
  return { command: "npm", args };
}

function run(command, args, options) {
  const result = spawnSync(command, args, { ...options, stdio: "inherit" });
  if (result.error) fail(`Failed to start ${command}: ${result.error.message}`);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function runCapture(command, args, options) {
  const result = spawnSync(command, args, { ...options, encoding: "utf8" });
  if (result.error) fail(`Failed to start ${command}: ${result.error.message}`);
  if (result.status !== 0) fail(result.stderr || `${command} exited with status ${result.status}`);
  return result.stdout.trim();
}

function parseJson(output) {
  try {
    return JSON.parse(output);
  } catch {
    fail("Database invariant smoke received non-JSON output.");
  }
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
