import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const workspaceRoot = join(import.meta.dirname, "..");
const smokeSqlPath = join(
  workspaceRoot,
  "db",
  "preflight",
  "checklist-photo-evidence-foundation-v1-smoke.sql",
);
const rollbackSqlPath = join(
  workspaceRoot,
  "db",
  "preflight",
  "checklist-photo-evidence-foundation-v1-rollback.sql",
);
const storageSmokeSqlPath = join(
  workspaceRoot,
  "db",
  "preflight",
  "checklist-photo-media-storage-recovery-v1-smoke.sql",
);
const storageRollbackSqlPath = join(
  workspaceRoot,
  "db",
  "preflight",
  "checklist-photo-media-storage-recovery-v1-rollback.sql",
);
const checklistItemEvidenceSmokeSqlPath = join(
  workspaceRoot,
  "db",
  "preflight",
  "checklist-item-evidence-pr4-v1-smoke.sql",
);
const checklistItemEvidenceRollbackSqlPath = join(
  workspaceRoot,
  "db",
  "preflight",
  "checklist-item-evidence-pr4-v1-rollback.sql",
);
const backendDir = join(workspaceRoot, "backend", "nestjs");
const containerName =
  process.env.MIGRATION_SMOKE_POSTGRES_CONTAINER ?? "store-ops-live-postgres";
const databaseName =
  process.env.MIGRATION_SMOKE_DB_NAME ?? "store_ops_fresh_migration_smoke";
const databaseUser = process.env.MIGRATION_SMOKE_DB_USER ?? "postgres";
const databaseHost = process.env.MIGRATION_SMOKE_DB_HOST ?? "localhost";
const databasePort = process.env.MIGRATION_SMOKE_DB_PORT ?? "54329";
const databasePassword = process.env.MIGRATION_SMOKE_DB_PASSWORD ?? "postgres";

if (process.env.NODE_ENV === "production") {
  fail("Photo evidence schema smoke is local-only.");
}
if (!/^store_ops_fresh_migration_smoke(_[a-z0-9_]+)?$/.test(databaseName)) {
  fail("Photo evidence schema smoke requires the disposable migration smoke database.");
}

runNpm(["run", "smoke:migration:fresh-db"]);

runPsql(readFileSync(checklistItemEvidenceRollbackSqlPath, "utf8"));
runPsql(readFileSync(storageRollbackSqlPath, "utf8"));
runPsql(readFileSync(rollbackSqlPath, "utf8"));

const rollbackResidual = Number(
  queryScalar(`
    SELECT
      (to_regclass('ops.media_asset') IS NOT NULL)::int
      + (to_regclass('ops.media_asset_replica') IS NOT NULL)::int
      + (EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'ops'
            AND table_name = 'store_action_plan'
            AND column_name = 'current_solution_attempt_id'
        ))::int
      + (EXISTS (
          SELECT 1
          FROM audit.schema_migration
          WHERE migration_name = '062_checklist_photo_evidence_foundation_v1.sql'
        ))::int
      + (EXISTS (
          SELECT 1
          FROM audit.schema_migration
          WHERE migration_name = '063_checklist_photo_media_storage_recovery_v1.sql'
        ))::int
      + (EXISTS (
          SELECT 1
          FROM audit.schema_migration
          WHERE migration_name = '064_checklist_item_evidence_v1.sql'
        ))::int;
  `),
);
if (rollbackResidual !== 0) {
  fail("Photo evidence pre-use rollback left schema or migration residue.");
}

runBackendMigration();

const forwardReapply = queryScalar(`
  SELECT CASE WHEN
    to_regclass('ops.media_asset') IS NOT NULL
    AND to_regclass('ops.visual_campaign_submission') IS NOT NULL
    AND to_regclass('ops.media_asset_replica') IS NOT NULL
    AND to_regclass('audit.photo_media_reconciliation_run') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM audit.schema_migration
      WHERE migration_name = '062_checklist_photo_evidence_foundation_v1.sql'
        AND status = 'succeeded'
    )
    AND EXISTS (
      SELECT 1
      FROM audit.schema_migration
      WHERE migration_name = '063_checklist_photo_media_storage_recovery_v1.sql'
        AND status = 'succeeded'
    )
    AND EXISTS (
      SELECT 1
      FROM audit.schema_migration
      WHERE migration_name = '064_checklist_item_evidence_v1.sql'
        AND status = 'succeeded'
    )
  THEN 'passed' ELSE 'failed' END;
`);
if (forwardReapply !== "passed") {
  fail("Photo evidence migration did not reapply cleanly after pre-use rollback.");
}

const smokeOutput = runPsql(readFileSync(smokeSqlPath, "utf8"));
const storageSmokeOutput = runPsql(readFileSync(storageSmokeSqlPath, "utf8"));
const itemEvidenceSmokeOutput = runPsql(readFileSync(checklistItemEvidenceSmokeSqlPath, "utf8"));

const receiptLine = smokeOutput
  .split(/\r?\n/)
  .map((line) => line.trim())
  .find(
    (line) =>
      line.startsWith("{") &&
      line.includes("checklist_photo_evidence_schema_smoke.completed"),
  );
if (!receiptLine) {
  fail("Photo evidence rollback-only smoke did not emit its sanitized receipt.");
}

const receipt = JSON.parse(receiptLine);
if (
  receipt.event !== "checklist_photo_evidence_schema_smoke.completed" ||
  receipt.tenant_scope_rejected !== true ||
  receipt.private_object_key_rejected !== true ||
  receipt.tenant_constraint_catalog_complete !== true ||
  receipt.immutable_history_rejected !== true ||
  receipt.retention_history_immutable !== true ||
  receipt.pre_completion_unlink_allowed !== true ||
  receipt.completion_lock_enforced !== true ||
  receipt.post_completion_unlink_rejected !== true ||
  receipt.residual_marker !== "PHOTO_EVIDENCE_SMOKE" ||
  receipt.rolled_back !== true
) {
  fail("Photo evidence rollback-only smoke receipt was not exact.");
}

const storageReceiptLine = storageSmokeOutput
  .split(/\r?\n/)
  .map((line) => line.trim())
  .find(
    (line) =>
      line.startsWith("{") &&
      line.includes("checklist_photo_media_storage_recovery_smoke.completed"),
  );
if (!storageReceiptLine) {
  fail("Photo media storage recovery smoke did not emit its sanitized receipt.");
}
const storageReceipt = JSON.parse(storageReceiptLine);
if (
  storageReceipt.event !== "checklist_photo_media_storage_recovery_smoke.completed" ||
  storageReceipt.recovery_required_before_ready !== true ||
  storageReceipt.post_ready_identity_immutable !== true ||
  storageReceipt.active_cleanup_lease_hold_immutable !== true ||
  storageReceipt.verified_replica_immutable !== true ||
  storageReceipt.reconciliation_receipt_append_only !== true ||
  storageReceipt.rolled_back !== true
) {
  fail("Photo media storage recovery smoke receipt was not exact.");
}

const itemEvidenceReceiptLine = itemEvidenceSmokeOutput
  .split(/\r?\n/)
  .map((line) => line.trim())
  .find((line) => line.startsWith("{") && line.includes("checklist_item_evidence_pr4_smoke.completed"));
if (!itemEvidenceReceiptLine) {
  fail("Checklist item evidence smoke did not emit its sanitized receipt.");
}
const itemEvidenceReceipt = JSON.parse(itemEvidenceReceiptLine);
if (
  itemEvidenceReceipt.event !== "checklist_item_evidence_pr4_smoke.completed" ||
  itemEvidenceReceipt.upload_intent !== "immutable" ||
  itemEvidenceReceipt.receipt_result !== "deterministic_sanitized" ||
  itemEvidenceReceipt.completion_event !== "typed" ||
  itemEvidenceReceipt.rolled_back !== true
) {
  fail("Checklist item evidence smoke receipt was not exact.");
}

const residualFixtureRows = Number(
  runCapture(
    "docker",
    [
      "exec",
      containerName,
      "psql",
      "-X",
      "-qAt",
      "-U",
      databaseUser,
      "-d",
      databaseName,
      "-c",
      "SELECT count(*) FROM ops.company WHERE company_code IN ('PHOTO_EVIDENCE_SMOKE', 'PHOTO_EVIDENCE_OTHER');",
    ],
  ).trim(),
);
if (residualFixtureRows !== 0) {
  fail("Photo evidence rollback-only smoke left fixture rows behind.");
}

console.log(
  JSON.stringify({
    event: "checklist_photo_evidence_schema_verification.completed",
    freshMigration: "passed",
    forwardReapply,
    immutableHistory: "passed",
    checklistEvidenceLifecycle: "passed",
    privateObjectIdentity: "passed",
    recoveryBeforeReady: "passed",
    reconciliationReceipt: "append-only",
    preUseRollback: "verified",
    retentionHistory: "immutable",
    residualFixtureRows,
    rollback: "verified",
    tenantIsolation: "passed",
    tenantConstraintCatalog: "passed",
  }),
);

function runNpm(args) {
  if (process.platform === "win32") {
    run("cmd.exe", ["/d", "/s", "/c", ["npm.cmd", ...args].join(" ")]);
    return;
  }
  run("npm", args);
}

function runBackendMigration() {
  const databaseUrl = `postgres://${databaseUser}:${databasePassword}@${databaseHost}:${databasePort}/${databaseName}`;
  const env = { ...process.env, DATABASE_URL: databaseUrl };
  if (process.platform === "win32") {
    run("cmd.exe", ["/d", "/s", "/c", "npm.cmd run db:migrate"], { cwd: backendDir, env });
    return;
  }
  run("npm", ["run", "db:migrate"], { cwd: backendDir, env });
}

function runPsql(input) {
  return runCapture(
    "docker",
    [
      "exec",
      "-i",
      containerName,
      "psql",
      "-X",
      "-qAt",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      databaseUser,
      "-d",
      databaseName,
    ],
    input,
  );
}

function queryScalar(sql) {
  return runCapture("docker", [
    "exec",
    containerName,
    "psql",
    "-X",
    "-qAt",
    "-U",
    databaseUser,
    "-d",
    databaseName,
    "-c",
    sql,
  ]).trim();
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? workspaceRoot,
    env: options.env ?? process.env,
    stdio: "inherit",
  });
  if (result.error) fail(`Failed to start ${command}: ${result.error.message}`);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function runCapture(command, args, input) {
  const result = spawnSync(command, args, {
    cwd: workspaceRoot,
    encoding: "utf8",
    input,
  });
  if (result.error) fail(`Failed to start ${command}: ${result.error.message}`);
  if (result.status !== 0) fail(result.stderr || `${command} exited with status ${result.status}`);
  return result.stdout;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
