import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const workspaceRoot = join(import.meta.dirname, "..");
const packageJson = JSON.parse(readFileSync(join(workspaceRoot, "package.json"), "utf8"));
const runner = readFileSync(
  join(workspaceRoot, "scripts", "checklist-photo-evidence-schema-smoke.mjs"),
  "utf8",
);
const fixture = readFileSync(
  join(workspaceRoot, "db", "preflight", "checklist-photo-evidence-foundation-v1-smoke.sql"),
  "utf8",
);
const rollback = readFileSync(
  join(workspaceRoot, "db", "preflight", "checklist-photo-evidence-foundation-v1-rollback.sql"),
  "utf8",
);
const itemEvidenceRollback = readFileSync(
  join(workspaceRoot, "db", "preflight", "checklist-item-evidence-pr4-v1-rollback.sql"),
  "utf8",
);
const providerNeutralStorageMigration = readFileSync(
  join(
    workspaceRoot,
    "db",
    "migrations",
    "068_photo_media_provider_neutral_storage_v1.sql",
  ),
  "utf8",
);
const providerNeutralStorageRollback = readFileSync(
  join(
    workspaceRoot,
    "db",
    "rollback",
    "068_photo_media_provider_neutral_storage_v1.rollback.sql",
  ),
  "utf8",
);
const versionPersistenceMigration = readFileSync(
  join(
    workspaceRoot,
    "db",
    "migrations",
    "069_photo_media_opaque_version_ids_v1.sql",
  ),
  "utf8",
);
const versionPersistenceRollback = readFileSync(
  join(
    workspaceRoot,
    "db",
    "rollback",
    "069_photo_media_opaque_version_ids_v1.rollback.sql",
  ),
  "utf8",
);
const storageRecoverySmoke = readFileSync(
  join(
    workspaceRoot,
    "db",
    "preflight",
    "checklist-photo-media-storage-recovery-v1-smoke.sql",
  ),
  "utf8",
);

test("photo evidence schema isolates provider-use proof from clean rollback verification", () => {
  assert.equal(
    packageJson.scripts["smoke:photo-evidence-schema"],
    "node scripts/checklist-photo-evidence-schema-smoke.mjs",
  );
  assert.match(runner, /smoke:migration:fresh-db/);
  assert.match(runner, /ON_ERROR_STOP=1/);
  assert.match(runner, /residualFixtureRows/);
  assert.match(runner, /preUseRollback/);
  assert.match(runner, /forwardReapply/);
  assert.match(runner, /checklist-item-evidence-pr4-v1-rollback\.sql/);
  assert.match(runner, /064_checklist_item_evidence_v1\.sql/);
  assert.match(runner, /068_photo_media_provider_neutral_storage_v1\.rollback\.sql/);
  assert.match(runner, /069_photo_media_opaque_version_ids_v1\.rollback\.sql/);
  assert.match(runner, /068_photo_media_provider_neutral_storage_v1\.sql/);
  assert.match(runner, /providerNeutralStorageIdentity/);
  assert.match(runner, /providerNeutralHistoricalFixture/);
  assert.match(runner, /providerNeutralHistoricalState/);
  assert.match(runner, /providerNeutralPreUseRollback/);
  assert.match(runner, /providerNeutralHistoricalScope/);
  assert.match(runner, /providerNeutralHistoricalCounters/);
  assert.match(runner, /providerNeutralHistoricalReplica/);
  assert.match(runner, /providerNeutralUsedRollbackRefusal/);
  assert.match(runner, /versionPersistenceFixture/);
  assert.match(runner, /versionPersistenceRoundtrip/);
  assert.match(runner, /versionPersistenceImmutable/);
  assert.match(runner, /versionPersistencePreUseRollback/);
  assert.match(runner, /versionPersistenceConcurrency/);
  assert.match(runner, /versionPersistenceHistoryGuards/);
  assert.match(runner, /versionPersistenceHistorySnapshot/);
  assert.match(runner, /versionPersistenceRollbackRestoration/);
  assert.match(runner, /localProviderVersionCompleteness/);
  assert.equal(
    (runner.match(/runPsql\(readFileSync\(providerNeutralStorageRollbackSqlPath/g) ?? []).length,
    2,
  );
  const providerNeutralRollbackIndexes = [
    ...runner.matchAll(/runPsql\(readFileSync\(providerNeutralStorageRollbackSqlPath/g),
  ].map((match) => match.index ?? -1);
  assert.equal(providerNeutralRollbackIndexes.length, 2);
  const freshDbCommandIndexes = [...runner.matchAll(/runNpm\(\["run", "smoke:migration:fresh-db"\]\);/g)]
    .map((match) => match.index ?? -1);
  assert.equal(freshDbCommandIndexes.length, 2);
  assert.doesNotMatch(runner, /DELETE\s+FROM\s+ops\.media_asset_replica/i);
  const historicalFixtureIndex = runner.indexOf("const providerNeutralHistoricalFixture");
  const localRollbackRefusalIndex = runner.indexOf(
    "Pre-use rollback refused after local storage provider use.",
  );
  assert.ok(
    freshDbCommandIndexes[0] < historicalFixtureIndex
      && historicalFixtureIndex < localRollbackRefusalIndex
      && localRollbackRefusalIndex < freshDbCommandIndexes[1],
  );
  assert.ok(
    runner.indexOf("runPsql(readFileSync(providerNeutralStorageRollbackSqlPath")
      < runner.indexOf("const providerNeutralHistoricalFixture"),
  );
  assert.ok(
    freshDbCommandIndexes[1]
      < providerNeutralRollbackIndexes[1]
      && providerNeutralRollbackIndexes[1]
        < runner.indexOf("const providerNeutralPreUseRollback"),
  );
  assert.ok(
    runner.indexOf("providerNeutralPreUseRollback")
      < runner.indexOf("const rollbackResidual"),
  );
});

test("photo evidence schema verification is local-only, synthetic, and rollback-bound", () => {
  assert.match(runner, /NODE_ENV === "production"/);
  assert.match(runner, /store_ops_fresh_migration_smoke/);
  assert.match(fixture, /BEGIN;/);
  assert.match(fixture, /ROLLBACK;/);
  assert.doesNotMatch(fixture, /\b(COMMIT|TRUNCATE|DROP)\b/i);
  assert.match(fixture, /tenant_scope_rejected/);
  assert.match(fixture, /private_object_key_rejected/);
  assert.match(fixture, /tenant_constraint_catalog_complete/);
  assert.match(fixture, /leading-space/);
  assert.match(fixture, /path-traversal/);
  assert.match(fixture, /immutable_history_rejected/);
  assert.match(fixture, /retention_history_immutable/);
  assert.match(fixture, /pre_completion_unlink_allowed/);
  assert.match(fixture, /completion_lock_enforced/);
  assert.match(fixture, /post_completion_unlink_rejected/);
  assert.match(fixture, /residual_marker/);
  assert.match(rollback, /foundation_row_count <> 0/);
  assert.match(rollback, /062_checklist_photo_evidence_foundation_v1\.sql/);
  assert.match(rollback, /DROP COLUMN IF EXISTS current_solution_attempt_id/);
  assert.match(itemEvidenceRollback, /rollback refused after feature use/);
  assert.match(itemEvidenceRollback, /ops\.checklist_item_evidence_upload_intent/);
  assert.match(itemEvidenceRollback, /DROP CONSTRAINT IF EXISTS ck_photo_evidence_event_type/);
  assert.match(runner, /checklist_item_evidence_pr4_smoke\.completed/);
});

test("photo media provider-neutral migration preserves historical R2 and fails closed", () => {
  assert.match(providerNeutralStorageMigration, /photo-media-v1/);
  assert.match(providerNeutralStorageMigration, /r2-eu/);
  assert.match(providerNeutralStorageMigration, /provider_adapter_id = 'r2'/);
  assert.match(providerNeutralStorageMigration, /provider_adapter_id = 'seaweedfs'/);
  assert.doesNotMatch(
    providerNeutralStorageMigration,
    /UPDATE\s+ops\.media_asset_replica/i,
  );
  assert.match(
    providerNeutralStorageRollback,
    /rollback refused after local storage provider use/i,
  );
  assert.match(providerNeutralStorageRollback, /photo-media-v1/);
  assert.match(providerNeutralStorageRollback, /r2-eu/);
});

test("photo media provider-neutral rollback keeps locks, refusal, and DDL atomic", () => {
  const sql = providerNeutralStorageRollback.trim();
  const beginIndex = sql.indexOf("BEGIN;");
  const commitIndex = sql.lastIndexOf("COMMIT;");

  assert.match(sql, /^BEGIN;\r?\n/);
  assert.match(sql, /COMMIT;$/);
  assert.equal((sql.match(/\bBEGIN;/g) ?? []).length, 1);
  assert.equal((sql.match(/\bCOMMIT;/g) ?? []).length, 1);
  assert.ok(commitIndex > beginIndex);

  for (const marker of [
    "SET LOCAL lock_timeout",
    "SET LOCAL statement_timeout",
    "SELECT pg_advisory_xact_lock",
    "Pre-use rollback refused after local storage provider use.",
    "ALTER TABLE ops.media_asset_replica",
    "ALTER TABLE ops.photo_media_usage_state",
    "UPDATE ops.photo_media_usage_state",
    "COMMENT ON COLUMN ops.photo_media_usage_state.usage_scope",
    "DELETE FROM audit.schema_migration",
  ]) {
    const firstIndex = sql.indexOf(marker);
    const lastIndex = sql.lastIndexOf(marker);
    assert.ok(firstIndex > beginIndex, `${marker} appears before BEGIN`);
    assert.ok(lastIndex < commitIndex, `${marker} appears after COMMIT`);
  }
});

test("photo media opaque version persistence keeps nullable legacy identity and atomic pre-use rollback", () => {
  assert.match(versionPersistenceMigration, /raw_object_version_id TEXT/);
  assert.match(versionPersistenceMigration, /thumbnail_object_version_id TEXT/);
  assert.match(versionPersistenceMigration, /object_version_id TEXT/);
  assert.match(versionPersistenceMigration, /SET LOCAL lock_timeout/);
  assert.match(versionPersistenceMigration, /pg_advisory_xact_lock/);
  assert.match(versionPersistenceMigration, /octet_length\([^)]*version_id/);
  assert.match(versionPersistenceMigration, /\[\[:cntrl:\]\]/);
  assert.match(versionPersistenceMigration, /NEW\.object_version_id IS NOT DISTINCT FROM OLD\.object_version_id/);
  assert.doesNotMatch(versionPersistenceMigration, /canonical_object_version_id/);
  assert.match(versionPersistenceRollback, /BEGIN;/);
  assert.match(versionPersistenceRollback, /COMMIT;/);
  assert.match(versionPersistenceRollback, /SET LOCAL lock_timeout/);
  assert.match(versionPersistenceRollback, /pg_advisory_xact_lock/);
  assert.match(versionPersistenceRollback, /hashtextextended\('hr-axis:onprem:migrations:v1', 0\)/);
  assert.match(versionPersistenceRollback, /status = 'succeeded'/);
  assert.match(versionPersistenceRollback, /Pre-use rollback refused after opaque media version identity use/);
  assert.match(versionPersistenceRollback, /DROP COLUMN IF EXISTS raw_object_version_id/);
  assert.match(versionPersistenceRollback, /DROP COLUMN IF EXISTS thumbnail_object_version_id/);
  assert.match(versionPersistenceRollback, /DROP COLUMN IF EXISTS object_version_id/);
  assert.match(versionPersistenceRollback, /DELETE FROM audit\.schema_migration/);
});

test("photo media opaque version rollback locks version tables before its pre-use scan", () => {
  const beginIndex = versionPersistenceRollback.indexOf("BEGIN;");
  const canonicalLockIndex = versionPersistenceRollback.indexOf(
    "SELECT pg_advisory_xact_lock(hashtextextended('hr-axis:onprem:migrations:v1', 0));",
  );
  const migrationLockIndex = versionPersistenceRollback.indexOf(
    "SELECT pg_advisory_xact_lock(hashtext('photo-media-opaque-version-ids-v1')::bigint);",
  );
  const lockIndex = versionPersistenceRollback.indexOf(
    "LOCK TABLE ops.media_asset, ops.media_asset_replica IN SHARE ROW EXCLUSIVE MODE;",
  );
  const historyLockIndex = versionPersistenceRollback.indexOf(
    "LOCK TABLE audit.schema_migration IN SHARE ROW EXCLUSIVE MODE;",
  );
  const historyStatusIndex = versionPersistenceRollback.indexOf("status = 'succeeded'");
  const preUseScanIndex = versionPersistenceRollback.indexOf("raw_object_version_id IS NOT NULL");
  assert.ok(beginIndex >= 0, "rollback must begin a transaction");
  assert.ok(canonicalLockIndex > beginIndex, "canonical migration lock must be transactional");
  assert.ok(migrationLockIndex > canonicalLockIndex, "migration lock must follow the canonical lock");
  assert.ok(historyLockIndex > migrationLockIndex, "history lock must follow advisory locks");
  assert.ok(lockIndex > migrationLockIndex, "table lock must follow advisory locks");
  assert.ok(historyStatusIndex > historyLockIndex, "history status must be read under the history lock");
  assert.ok(preUseScanIndex > lockIndex, "table lock must precede the pre-use scan");
});

test("photo media recovery failed replicas satisfy the failed-state contract before provider checks", () => {
  assert.match(
    storageRecoverySmoke,
    /replica_generation, is_active, replica_state,\s+failed_at, failure_reason_code/s,
  );
  assert.match(
    storageRecoverySmoke,
    /'primary', 'r2', 'onprem'[\s\S]*?2, FALSE, 'failed', NOW\(\), 'synthetic-invalid-provider-pair'/,
  );
  assert.match(
    storageRecoverySmoke,
    /'primary', 'seaweedfs', 'onprem'[\s\S]*?2, FALSE, 'failed', NOW\(\), 'synthetic-local-provider-use'/,
  );
  assert.equal(
    (storageRecoverySmoke.match(/'failed', NOW\(\), 'synthetic-/g) ?? []).length,
    2,
  );
});
