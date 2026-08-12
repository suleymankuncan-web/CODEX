import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
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
const storeActionPhotoReviewRollbackSqlPath = join(
  workspaceRoot,
  "db",
  "rollback",
  "065_store_action_photo_review_v2.rollback.sql",
);
const vmReferenceManagementRollbackSqlPath = join(
  workspaceRoot,
  "db",
  "rollback",
  "066_vm_reference_management_v1.rollback.sql",
);
const retentionOperationsSmokeSqlPath = join(
  workspaceRoot,
  "db",
  "preflight",
  "photo-media-retention-operations-v1-smoke.sql",
);
const retentionOperationsRollbackSqlPath = join(
  workspaceRoot,
  "db",
  "rollback",
  "067_photo_media_retention_operations_v1.rollback.sql",
);
const providerNeutralStorageRollbackSqlPath = join(
  workspaceRoot,
  "db",
  "rollback",
  "068_photo_media_provider_neutral_storage_v1.rollback.sql",
);
const versionPersistenceRollbackSqlPath = join(
  workspaceRoot,
  "db",
  "rollback",
  "069_photo_media_opaque_version_ids_v1.rollback.sql",
);
const vmReferenceAuthMatrixSqlPath = join(
  workspaceRoot,
  "db",
  "preflight",
  "vm-reference-auth-matrix-v1.sql",
);
const backendDir = join(workspaceRoot, "backend", "nestjs");
const requireBackend = createRequire(import.meta.url);
const { Client: PgClient } = requireBackend(join(backendDir, "node_modules", "pg"));
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

runPsql(`
  INSERT INTO ops.company (company_id, company_code, company_name)
  VALUES ('81000000-0000-4000-8000-000000000001', 'STORE_ACTION_V2_ROLLBACK', 'Synthetic V2 rollback guard');
  INSERT INTO ops.region (region_id, company_id, region_code, region_name)
  VALUES ('82000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000001', 'V2_GUARD', 'Synthetic V2 guard');
  INSERT INTO ops.store (store_id, company_id, region_id, store_code, store_name, store_type)
  VALUES ('83000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000001',
    '82000000-0000-4000-8000-000000000001', 'V2_GUARD_STORE', 'Synthetic V2 guard store', 'company');
  INSERT INTO ops.user_account (user_id, username, email)
  VALUES ('84000000-0000-4000-8000-000000000001', 'v2-rollback-guard', 'v2-rollback-guard@example.invalid');
  INSERT INTO ops.store_action_plan (
    store_action_plan_id, company_id, region_id, store_id, owner_user_id, created_by_user_id,
    source_type, source_id, title, priority, due_on, resolution_workflow_version
  ) VALUES (
    '85000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000001',
    '82000000-0000-4000-8000-000000000001', '83000000-0000-4000-8000-000000000001',
    '84000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000001',
    'checklist_remediation', 'rollback-guard', 'Synthetic V2 guard', 'high', CURRENT_DATE, 2
  );
`);
expectPsqlFailure(
  readFileSync(storeActionPhotoReviewRollbackSqlPath, "utf8"),
  "store_action_photo_review_v2_rows_exist",
);
runPsql(`
  DELETE FROM ops.store_action_plan WHERE store_action_plan_id = '85000000-0000-4000-8000-000000000001';
  DELETE FROM ops.store WHERE store_id = '83000000-0000-4000-8000-000000000001';
  DELETE FROM ops.region WHERE region_id = '82000000-0000-4000-8000-000000000001';
  DELETE FROM ops.company WHERE company_id = '81000000-0000-4000-8000-000000000001';
  DELETE FROM ops.user_account WHERE user_id = '84000000-0000-4000-8000-000000000001';
`);
const versionPersistenceMigrationName = "069_photo_media_opaque_version_ids_v1.sql";
const versionPersistenceMigrationChecksum = queryScalar(`SELECT migration_checksum FROM audit.schema_migration WHERE migration_name = '${versionPersistenceMigrationName}';`);
if (!versionPersistenceMigrationChecksum) {
  fail("Opaque version migration checksum was not recorded before history guard smoke.");
}
const versionPersistenceColumnsPresent = "to_regclass('ops.media_asset') IS NOT NULL AND to_regclass('ops.media_asset_replica') IS NOT NULL AND (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'ops' AND table_name = 'media_asset' AND column_name IN ('raw_object_version_id', 'thumbnail_object_version_id')) = 2 AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'ops' AND table_name = 'media_asset_replica' AND column_name = 'object_version_id')";
const versionPersistenceHistoryState = (condition) => queryScalar(`SELECT CASE WHEN ${condition} AND ${versionPersistenceColumnsPresent} THEN 'passed' ELSE 'failed' END;`);
for (const status of ["running", "failed"]) {
  runPsql(`UPDATE audit.schema_migration SET status = '${status}', updated_at = NOW() WHERE migration_name = '${versionPersistenceMigrationName}';`);
  expectPsqlFailure(readFileSync(versionPersistenceRollbackSqlPath, "utf8"), "Opaque version migration history is not succeeded; rollback refused.");
  if (versionPersistenceHistoryState(`(SELECT status FROM audit.schema_migration WHERE migration_name = '${versionPersistenceMigrationName}') = '${status}'`) !== "passed") {
    fail(`Opaque version ${status} history refusal changed schema or history.`);
  }
}
runPsql(`DELETE FROM audit.schema_migration WHERE migration_name = '${versionPersistenceMigrationName}';`);
expectPsqlFailure(readFileSync(versionPersistenceRollbackSqlPath, "utf8"), "Opaque version migration history is not succeeded; rollback refused.");
if (versionPersistenceHistoryState(`NOT EXISTS (SELECT 1 FROM audit.schema_migration WHERE migration_name = '${versionPersistenceMigrationName}')`) !== "passed") {
  fail("Opaque version missing-history refusal changed schema or history.");
}
runPsql(`INSERT INTO audit.schema_migration (migration_name, migration_checksum, status, attempt_count) VALUES ('${versionPersistenceMigrationName}', '${versionPersistenceMigrationChecksum}', 'succeeded', 1);`);
const versionPersistenceHistoryGuards = "verified";
const versionPersistenceConcurrencyFixture = {
  companyId: "87000000-0000-4000-8000-000000000007",
  userId: "87000000-0000-4000-8000-000000000008",
  mediaAssetId: "87000000-0000-4000-8000-000000000009",
};
const versionPersistenceConcurrencyObjectKey =
  `companies/${versionPersistenceConcurrencyFixture.companyId}/media/${versionPersistenceConcurrencyFixture.mediaAssetId}/raw`;
runPsql(`INSERT INTO ops.company (company_id, company_code, company_name) VALUES ('${versionPersistenceConcurrencyFixture.companyId}', 'ONP4B_VERSION_CONCURRENCY', 'Synthetic opaque version rollback concurrency guard'); INSERT INTO ops.user_account (user_id, username, email) VALUES ('${versionPersistenceConcurrencyFixture.userId}', 'onp4b-version-concurrency', 'onp4b-version-concurrency@example.invalid'); INSERT INTO ops.media_asset (media_asset_id, company_id, classification, state, capture_source, raw_object_key, uploaded_by_user_id) VALUES ('${versionPersistenceConcurrencyFixture.mediaAssetId}', '${versionPersistenceConcurrencyFixture.companyId}', 'checklist_evidence', 'initiated', 'system_generated', '${versionPersistenceConcurrencyObjectKey}', '${versionPersistenceConcurrencyFixture.userId}');`);
const versionPersistenceConcurrency = await runVersionPersistenceRollbackConcurrencySmoke(
  versionPersistenceConcurrencyFixture,
);
if (versionPersistenceConcurrency !== "verified") {
  fail("Opaque version rollback did not serialize against an uncommitted version write.");
}

const versionPersistenceFixture = {
  companyId: "87000000-0000-4000-8000-000000000001",
  userId: "87000000-0000-4000-8000-000000000002",
  mediaAssetId: "87000000-0000-4000-8000-000000000003",
  primaryReplicaId: "87000000-0000-4000-8000-000000000004",
  recoveryReplicaId: "87000000-0000-4000-8000-000000000005",
};
const versionPersistenceRawObjectKey =
  `companies/${versionPersistenceFixture.companyId}/media/${versionPersistenceFixture.mediaAssetId}/raw`;
const versionPersistenceCanonicalObjectKey =
  `companies/${versionPersistenceFixture.companyId}/media/${versionPersistenceFixture.mediaAssetId}/canonical.webp`;
const versionPersistenceThumbnailObjectKey =
  `companies/${versionPersistenceFixture.companyId}/media/${versionPersistenceFixture.mediaAssetId}/thumbnail.webp`;
runPsql(`INSERT INTO ops.company (company_id, company_code, company_name) VALUES ('${versionPersistenceFixture.companyId}', 'ONP4B_VERSION_PERSISTENCE', 'Synthetic opaque version persistence guard'); INSERT INTO ops.user_account (user_id, username, email) VALUES ('${versionPersistenceFixture.userId}', 'onp4b-version-persistence', 'onp4b-version-persistence@example.invalid'); INSERT INTO ops.media_asset (media_asset_id, company_id, classification, state, capture_source, raw_object_key, raw_object_version_id, canonical_object_key, thumbnail_object_key, thumbnail_object_version_id, uploaded_by_user_id) VALUES ('${versionPersistenceFixture.mediaAssetId}', '${versionPersistenceFixture.companyId}', 'checklist_evidence', 'canonicalized', 'system_generated', '${versionPersistenceRawObjectKey}', 'raw-version-opaque-1', '${versionPersistenceCanonicalObjectKey}', '${versionPersistenceThumbnailObjectKey}', 'thumbnail-version-opaque-1', '${versionPersistenceFixture.userId}'); INSERT INTO ops.media_asset_replica (media_asset_replica_id, media_asset_id, company_id, replica_role, provider_adapter_id, jurisdiction, bucket_alias, object_key, object_version_id, replica_generation, is_active, replica_state, content_sha256, byte_count, copy_started_at, verified_at) VALUES ('${versionPersistenceFixture.primaryReplicaId}', '${versionPersistenceFixture.mediaAssetId}', '${versionPersistenceFixture.companyId}', 'primary', 'r2', 'eu', 'primary', '${versionPersistenceCanonicalObjectKey}', 'primary-version-opaque-1', 1, TRUE, 'verified', repeat('a', 64), 9, NOW(), NOW()), ('${versionPersistenceFixture.recoveryReplicaId}', '${versionPersistenceFixture.mediaAssetId}', '${versionPersistenceFixture.companyId}', 'recovery', 'r2', 'eu', 'recovery', '${versionPersistenceFixture.companyId}/media/${versionPersistenceFixture.mediaAssetId}/recovery.webp', 'recovery-version-opaque-1', 1, TRUE, 'verified', repeat('a', 64), 9, NOW(), NOW());`);
expectPsqlFailure(`UPDATE ops.media_asset SET raw_object_version_id = ' leading-space' WHERE media_asset_id = '${versionPersistenceFixture.mediaAssetId}';`, "ck_media_asset_raw_object_version_id_private");
expectPsqlFailure(`UPDATE ops.media_asset SET thumbnail_object_version_id = 'bad' || chr(1) WHERE media_asset_id = '${versionPersistenceFixture.mediaAssetId}';`, "ck_media_asset_thumbnail_object_version_id_private");
expectPsqlFailure(`INSERT INTO ops.media_asset_replica (media_asset_replica_id, media_asset_id, company_id, replica_role, provider_adapter_id, jurisdiction, bucket_alias, object_key, object_version_id, replica_generation, is_active, replica_state) VALUES ('87000000-0000-4000-8000-000000000006', '${versionPersistenceFixture.mediaAssetId}', '${versionPersistenceFixture.companyId}', 'recovery', 'r2', 'eu', 'recovery', '${versionPersistenceFixture.companyId}/media/${versionPersistenceFixture.mediaAssetId}/version-probe.webp', repeat('x', 1025), 2, FALSE, 'pending');`, "ck_media_asset_replica_object_version_id_private");
const versionPersistenceRoundtrip = queryScalar(`SELECT CASE WHEN (SELECT raw_object_version_id FROM ops.media_asset WHERE media_asset_id = '${versionPersistenceFixture.mediaAssetId}') = 'raw-version-opaque-1' AND (SELECT thumbnail_object_version_id FROM ops.media_asset WHERE media_asset_id = '${versionPersistenceFixture.mediaAssetId}') = 'thumbnail-version-opaque-1' AND (SELECT object_version_id FROM ops.media_asset_replica WHERE media_asset_replica_id = '${versionPersistenceFixture.primaryReplicaId}') = 'primary-version-opaque-1' AND (SELECT object_version_id FROM ops.media_asset_replica WHERE media_asset_replica_id = '${versionPersistenceFixture.recoveryReplicaId}') = 'recovery-version-opaque-1' THEN 'passed' ELSE 'failed' END;`);
if (versionPersistenceRoundtrip !== "passed") {
  fail("Opaque media version identities did not round-trip across raw, thumbnail, primary, and recovery rows.");
}
expectPsqlFailure(`UPDATE ops.media_asset_replica SET object_version_id = 'primary-version-mutated' WHERE media_asset_replica_id = '${versionPersistenceFixture.primaryReplicaId}';`, "Verified media asset replica proof is immutable.");
const versionPersistenceImmutable = queryScalar(`SELECT CASE WHEN (SELECT object_version_id FROM ops.media_asset_replica WHERE media_asset_replica_id = '${versionPersistenceFixture.primaryReplicaId}') = 'primary-version-opaque-1' THEN 'passed' ELSE 'failed' END;`);
if (versionPersistenceImmutable !== "passed") {
  fail("Verified replica version identity changed after an immutable update refusal.");
}
expectPsqlFailure(readFileSync(versionPersistenceRollbackSqlPath, "utf8"), "Pre-use rollback refused after opaque media version identity use.");
const versionPersistenceUsedRollbackState = queryScalar(`SELECT CASE WHEN (SELECT count(*) FROM ops.media_asset WHERE media_asset_id = '${versionPersistenceFixture.mediaAssetId}') = 1 AND (SELECT count(*) FROM ops.media_asset_replica WHERE media_asset_replica_id IN ('${versionPersistenceFixture.primaryReplicaId}', '${versionPersistenceFixture.recoveryReplicaId}')) = 2 AND EXISTS (SELECT 1 FROM audit.schema_migration WHERE migration_name = '069_photo_media_opaque_version_ids_v1.sql' AND status = 'succeeded') THEN 'passed' ELSE 'failed' END;`);
if (versionPersistenceUsedRollbackState !== "passed") {
  fail("Opaque version rollback refusal deleted fixture rows or migration history.");
}

runPsql(readFileSync(providerNeutralStorageRollbackSqlPath, "utf8"));
const providerNeutralHistoricalFixture = {
  companyId: "88000000-0000-4000-8000-000000000001",
  userId: "88000000-0000-4000-8000-000000000002",
  mediaAssetId: "88000000-0000-4000-8000-000000000003",
  replicaId: "88000000-0000-4000-8000-000000000004",
  localReplicaId: "88000000-0000-4000-8000-000000000005",
};
const providerNeutralHistoricalObjectKey =
  `companies/${providerNeutralHistoricalFixture.companyId}/media/${providerNeutralHistoricalFixture.mediaAssetId}/canonical.webp`;
runPsql(`
  INSERT INTO ops.company (company_id, company_code, company_name)
  VALUES (
    '${providerNeutralHistoricalFixture.companyId}',
    'ONP4A_PROVIDER_NEUTRAL',
    'Synthetic provider-neutral storage guard'
  );
  INSERT INTO ops.user_account (user_id, username, email)
  VALUES (
    '${providerNeutralHistoricalFixture.userId}',
    'onp4a-provider-neutral',
    'onp4a-provider-neutral@example.invalid'
  );
  INSERT INTO ops.media_asset (
    media_asset_id, company_id, classification, state, capture_source,
    raw_object_key, uploaded_by_user_id
  ) VALUES (
    '${providerNeutralHistoricalFixture.mediaAssetId}',
    '${providerNeutralHistoricalFixture.companyId}',
    'checklist_evidence',
    'canonicalized',
    'system_generated',
    'companies/${providerNeutralHistoricalFixture.companyId}/media/${providerNeutralHistoricalFixture.mediaAssetId}/raw',
    '${providerNeutralHistoricalFixture.userId}'
  );
  INSERT INTO ops.media_asset_replica (
    media_asset_replica_id, media_asset_id, company_id, replica_role,
    provider_adapter_id, jurisdiction, bucket_alias, object_key,
    replica_generation, is_active, replica_state
  ) VALUES (
    '${providerNeutralHistoricalFixture.replicaId}',
    '${providerNeutralHistoricalFixture.mediaAssetId}',
    '${providerNeutralHistoricalFixture.companyId}',
    'primary', 'r2', 'eu', 'primary',
    '${providerNeutralHistoricalObjectKey}',
    1, TRUE, 'pending'
  );
  INSERT INTO ops.photo_media_usage_state (
    usage_scope, provider_visible_bytes, operation_month,
    class_a_operations, class_b_operations
  ) VALUES ('r2-eu', 1234567, DATE '2026-08-01', 17, 29);
`);
runBackendMigration();
const providerNeutralHistoricalState = queryScalar(`
  SELECT CASE WHEN
    EXISTS (
      SELECT 1
      FROM ops.photo_media_usage_state
      WHERE usage_scope = 'photo-media-v1'
        AND provider_visible_bytes = 1234567
        AND operation_month = DATE '2026-08-01'
        AND class_a_operations = 17
        AND class_b_operations = 29
    )
    AND EXISTS (
      SELECT 1
      FROM ops.media_asset_replica
      WHERE media_asset_replica_id = '${providerNeutralHistoricalFixture.replicaId}'
        AND provider_adapter_id = 'r2'
        AND jurisdiction = 'eu'
        AND bucket_alias = 'primary'
        AND object_key = '${providerNeutralHistoricalObjectKey}'
        AND replica_generation = 1
        AND is_active = TRUE
    )
    AND (SELECT raw_object_version_id FROM ops.media_asset
      WHERE media_asset_id = '${providerNeutralHistoricalFixture.mediaAssetId}') IS NULL
    AND (SELECT thumbnail_object_version_id FROM ops.media_asset
      WHERE media_asset_id = '${providerNeutralHistoricalFixture.mediaAssetId}') IS NULL
    AND (SELECT object_version_id FROM ops.media_asset_replica
      WHERE media_asset_replica_id = '${providerNeutralHistoricalFixture.replicaId}') IS NULL
  THEN 'passed' ELSE 'failed' END;
`);
if (providerNeutralHistoricalState !== "passed") {
  fail("Provider-neutral migration changed historical R2 counters, month, or replica identity.");
}
runPsql(`
  INSERT INTO ops.media_asset_replica (
    media_asset_replica_id, media_asset_id, company_id, replica_role,
    provider_adapter_id, jurisdiction, bucket_alias, object_key,
    replica_generation, is_active, replica_state, failed_at, failure_reason_code
  ) VALUES (
    '${providerNeutralHistoricalFixture.localReplicaId}',
    '${providerNeutralHistoricalFixture.mediaAssetId}',
    '${providerNeutralHistoricalFixture.companyId}',
    'primary', 'seaweedfs', 'onprem', 'primary',
    'companies/${providerNeutralHistoricalFixture.companyId}/media/${providerNeutralHistoricalFixture.mediaAssetId}/local-smoke.webp',
    2, FALSE, 'failed', NOW(), 'synthetic-onprem-use'
  );
`);
expectPsqlFailure(
  readFileSync(providerNeutralStorageRollbackSqlPath, "utf8"),
  "Pre-use rollback refused after local storage provider use.",
);

runNpm(["run", "smoke:migration:fresh-db"]);
const versionPersistenceHistorySnapshotQuery = "SELECT COALESCE(jsonb_agg(jsonb_build_object('migration_name', migration_name, 'migration_checksum', migration_checksum, 'status', status) ORDER BY migration_name)::text, '[]') FROM audit.schema_migration WHERE migration_name <> '069_photo_media_opaque_version_ids_v1.sql';";
const versionPersistenceGuardDefinitionQuery = "SELECT pg_get_functiondef('ops.guard_verified_media_asset_replica()'::regprocedure);";
const versionPersistenceTriggerDefinitionQuery = "SELECT pg_get_triggerdef(oid, TRUE) FROM pg_trigger WHERE tgrelid = 'ops.media_asset_replica'::regclass AND tgname = 'trg_media_asset_replica_verified_immutable';";
const versionPersistenceHistorySnapshot = queryScalar(versionPersistenceHistorySnapshotQuery);
const versionPersistencePre069GuardDefinition = queryScalar(versionPersistenceGuardDefinitionQuery);
const versionPersistencePre069TriggerDefinition = queryScalar(versionPersistenceTriggerDefinitionQuery);
if (
  !versionPersistenceHistorySnapshot ||
  !versionPersistencePre069GuardDefinition.includes("object_version_id") ||
  !versionPersistencePre069TriggerDefinition
) {
  fail("Opaque version pre-069 rollback snapshots were incomplete.");
}
runPsql(readFileSync(versionPersistenceRollbackSqlPath, "utf8"));
const versionPersistenceHistorySnapshotAfterRollback = queryScalar(versionPersistenceHistorySnapshotQuery);
const versionPersistencePost069GuardDefinition = queryScalar(versionPersistenceGuardDefinitionQuery);
const versionPersistencePost069TriggerDefinition = queryScalar(versionPersistenceTriggerDefinitionQuery);
const versionPersistenceRollbackRestoration =
  versionPersistenceHistorySnapshotAfterRollback === versionPersistenceHistorySnapshot &&
  versionPersistencePre069TriggerDefinition === versionPersistencePost069TriggerDefinition &&
  !versionPersistencePost069GuardDefinition.includes("object_version_id") &&
  versionPersistencePost069GuardDefinition.includes("Verified media asset replica proof is immutable.");
if (!versionPersistenceRollbackRestoration) {
  fail("Opaque version rollback did not preserve history or restore the pre-069 replica guard.");
}
const versionPersistencePreUseRollback = queryScalar(`
  SELECT CASE WHEN
    NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'ops'
        AND table_name = 'media_asset'
        AND column_name IN ('raw_object_version_id', 'thumbnail_object_version_id')
    )
    AND NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'ops'
        AND table_name = 'media_asset_replica'
        AND column_name = 'object_version_id'
    )
    AND NOT EXISTS (
      SELECT 1 FROM audit.schema_migration
      WHERE migration_name = '069_photo_media_opaque_version_ids_v1.sql'
    )
  THEN 'passed' ELSE 'failed' END;
`);
if (versionPersistencePreUseRollback !== "passed") {
  fail("Opaque version pre-use rollback did not remove only empty version columns and history.");
}
runPsql(readFileSync(providerNeutralStorageRollbackSqlPath, "utf8"));
const providerNeutralPreUseRollback = queryScalar(`
  SELECT CASE WHEN
    to_regclass('ops.photo_media_usage_state') IS NOT NULL
    AND to_regclass('ops.media_asset_replica') IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM ops.photo_media_usage_state)
    AND NOT EXISTS (SELECT 1 FROM ops.media_asset_replica)
    AND NOT EXISTS (
      SELECT 1 FROM audit.schema_migration
      WHERE migration_name = '068_photo_media_provider_neutral_storage_v1.sql'
    )
    AND EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'ck_photo_media_usage_scope'
        AND pg_get_constraintdef(oid) LIKE '%r2-eu%'
    )
    AND EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'ck_media_asset_replica_provider'
    )
    AND EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'ck_media_asset_replica_jurisdiction'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'ck_media_asset_replica_provider_jurisdiction'
    )
  THEN 'passed' ELSE 'failed' END;
`);
if (providerNeutralPreUseRollback !== "passed") {
  fail("Provider-neutral pre-use rollback did not reset the empty disposable database.");
}
runPsql(readFileSync(retentionOperationsRollbackSqlPath, "utf8"));
runPsql(readFileSync(vmReferenceManagementRollbackSqlPath, "utf8"));
runPsql(readFileSync(storeActionPhotoReviewRollbackSqlPath, "utf8"));
runPsql(readFileSync(checklistItemEvidenceRollbackSqlPath, "utf8"));
runPsql(readFileSync(storageRollbackSqlPath, "utf8"));
runPsql(readFileSync(rollbackSqlPath, "utf8"));

const rollbackResidual = Number(
  queryScalar(`
    SELECT
      (to_regclass('ops.media_asset') IS NOT NULL)::int
      + (to_regclass('ops.media_asset_replica') IS NOT NULL)::int
      + (to_regclass('ops.store_action_solution_upload_intent') IS NOT NULL)::int
      + (to_regclass('ops.visual_reference_version') IS NOT NULL)::int
      + (to_regclass('ops.visual_campaign_command_receipt') IS NOT NULL)::int
      + (to_regclass('ops.checklist_instance_item_visual_reference') IS NOT NULL)::int
      + (to_regclass('ops.photo_media_purge_manifest') IS NOT NULL)::int
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
        ))::int
      + (EXISTS (
          SELECT 1
          FROM audit.schema_migration
          WHERE migration_name = '065_store_action_photo_review_v2.sql'
        ))::int
      + (EXISTS (
          SELECT 1
          FROM audit.schema_migration
          WHERE migration_name = '066_vm_reference_management_v1.sql'
        ))::int
      + (EXISTS (
          SELECT 1
          FROM audit.schema_migration
          WHERE migration_name = '067_photo_media_retention_operations_v1.sql'
        ))::int
      + (EXISTS (
          SELECT 1
          FROM audit.schema_migration
          WHERE migration_name = '068_photo_media_provider_neutral_storage_v1.sql'
        ))::int
      + (EXISTS (
          SELECT 1
          FROM audit.schema_migration
          WHERE migration_name = '069_photo_media_opaque_version_ids_v1.sql'
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
    AND to_regclass('ops.store_action_solution_upload_intent') IS NOT NULL
    AND to_regclass('ops.visual_reference_version') IS NOT NULL
    AND to_regclass('ops.visual_campaign_command_receipt') IS NOT NULL
    AND to_regclass('ops.checklist_instance_item_visual_reference') IS NOT NULL
    AND to_regclass('ops.photo_media_purge_manifest') IS NOT NULL
    AND to_regclass('audit.photo_media_reconciliation_run') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'ops'
        AND table_name = 'media_asset'
        AND column_name IN ('raw_object_version_id', 'thumbnail_object_version_id')
      GROUP BY table_schema, table_name
      HAVING count(*) = 2
    )
    AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'ops'
        AND table_name = 'media_asset_replica'
        AND column_name = 'object_version_id'
    )
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
    AND EXISTS (
      SELECT 1
      FROM audit.schema_migration
      WHERE migration_name = '065_store_action_photo_review_v2.sql'
        AND status = 'succeeded'
    )
    AND EXISTS (
      SELECT 1
      FROM audit.schema_migration
      WHERE migration_name = '066_vm_reference_management_v1.sql'
        AND status = 'succeeded'
    )
    AND EXISTS (
      SELECT 1
      FROM audit.schema_migration
      WHERE migration_name = '067_photo_media_retention_operations_v1.sql'
        AND status = 'succeeded'
    )
    AND EXISTS (
      SELECT 1
      FROM audit.schema_migration
      WHERE migration_name = '068_photo_media_provider_neutral_storage_v1.sql'
        AND status = 'succeeded'
    )
    AND EXISTS (
      SELECT 1
      FROM audit.schema_migration
      WHERE migration_name = '069_photo_media_opaque_version_ids_v1.sql'
        AND status = 'succeeded'
    )
  THEN 'passed' ELSE 'failed' END;
`);
if (forwardReapply !== "passed") {
  fail("Photo evidence migration did not reapply cleanly after pre-use rollback.");
}

runPsql(`
  INSERT INTO ops.company (company_id, company_code, company_name)
  VALUES ('91000000-0000-4000-8000-000000000001', 'VM_PR6_ROLLBACK', 'Synthetic PR6 rollback guard');
  INSERT INTO ops.user_account (user_id, username, email)
  VALUES ('94000000-0000-4000-8000-000000000001', 'vm-pr6-rollback', 'vm-pr6-rollback@example.invalid');
  INSERT INTO ops.visual_reference_set (
    visual_reference_set_id, company_id, reference_code, reference_name,
    instructions, created_by_user_id
  ) VALUES (
    '95000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001',
    'VM_PR6_ROLLBACK', 'Synthetic PR6 rollback guard', 'Synthetic-only guard',
    '94000000-0000-4000-8000-000000000001'
  );
`);
expectPsqlFailure(
  readFileSync(vmReferenceManagementRollbackSqlPath, "utf8"),
  "Migration 066 rollback refused after VM reference management use.",
);
runPsql(`
  DELETE FROM ops.visual_reference_set
  WHERE visual_reference_set_id = '95000000-0000-4000-8000-000000000001';
  DELETE FROM ops.user_account
  WHERE user_id = '94000000-0000-4000-8000-000000000001';
  DELETE FROM ops.company
  WHERE company_id = '91000000-0000-4000-8000-000000000001';
`);

const smokeOutput = runPsql(readFileSync(smokeSqlPath, "utf8"));
const storageSmokeOutput = runPsql(readFileSync(storageSmokeSqlPath, "utf8"));
const itemEvidenceSmokeOutput = runPsql(readFileSync(checklistItemEvidenceSmokeSqlPath, "utf8"));
const vmAuthSmokeOutput = runPsql(readFileSync(vmReferenceAuthMatrixSqlPath, "utf8"));
const retentionSmokeOutput = runPsql(readFileSync(retentionOperationsSmokeSqlPath, "utf8"));

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

const vmAuthReceiptLine = vmAuthSmokeOutput.split(/\r?\n/).map((line) => line.trim())
  .find((line) => line.startsWith("{") && line.includes("vm_reference_auth_matrix.completed"));
if (!vmAuthReceiptLine) fail("VM reference authorization matrix did not emit its sanitized receipt.");
const vmAuthReceipt = JSON.parse(vmAuthReceiptLine);
if (vmAuthReceipt.positive !== true ||
    vmAuthReceipt.inactive_actor_denied !== true ||
    vmAuthReceipt.inactive_company_denied !== true ||
    vmAuthReceipt.inactive_store_denied !== true ||
    vmAuthReceipt.missing_persona_denied !== true ||
    vmAuthReceipt.missing_capability_denied !== true ||
    vmAuthReceipt.wrong_company_denied !== true ||
    vmAuthReceipt.store_scoped_capability_denied !== true ||
    vmAuthReceipt.rolled_back !== true) {
  fail("VM reference authorization matrix receipt was not exact.");
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
  storageReceipt.provider_neutral_usage_scope !== true ||
  storageReceipt.historical_r2_identity_accepted !== true ||
  storageReceipt.local_provider_identity_accepted !== true ||
  storageReceipt.invalid_provider_pair_rejected !== true ||
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

const retentionReceiptLine = retentionSmokeOutput
  .split(/\r?\n/)
  .map((line) => line.trim())
  .find((line) => line.startsWith("{") && line.includes("photo_media_retention_operations_smoke.completed"));
if (!retentionReceiptLine) fail("Photo media retention operations smoke did not emit its sanitized receipt.");
const retentionReceipt = JSON.parse(retentionReceiptLine);
if (
  retentionReceipt.manifest_identity_immutable !== true ||
  retentionReceipt.manifest_delete_refused !== true ||
  retentionReceipt.manifest_transition_guard !== true ||
  retentionReceipt.expired_execution_reclaim !== true ||
  retentionReceipt.lifecycle_reconciliation_contract !== true ||
  retentionReceipt.rolled_back !== true
) {
  fail("Photo media retention operations smoke receipt was not exact.");
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
    providerNeutralStorageIdentity: "passed",
    providerNeutralHistoricalScope: "preserved",
    providerNeutralHistoricalCounters: "preserved",
    providerNeutralHistoricalReplica: "preserved",
    providerNeutralUsedRollbackRefusal: "verified",
    opaqueVersionPersistence: "passed",
    opaqueVersionMalformedRejected: "verified",
    opaqueVersionVerifiedImmutable: "verified",
    opaqueVersionUsedRollbackRefusal: "verified",
    opaqueVersionHistoryGuards: versionPersistenceHistoryGuards,
    opaqueVersionConcurrency: versionPersistenceConcurrency,
    localProviderVersionCompleteness: "deferred_to_next_pr",
    reconciliationReceipt: "append-only",
    preUseRollback: "verified",
    usedSchemaRollbackRefusal: "verified",
    retentionHistory: "immutable",
    residualFixtureRows,
    rollback: "verified",
    tenantIsolation: "passed",
    tenantConstraintCatalog: "passed",
    vmAuthorizationMatrix: "passed",
    retentionOperations: "passed",
  }),
);

async function runVersionPersistenceRollbackConcurrencySmoke(fixture) {
  const connection = { database: databaseName, host: databaseHost, password: databasePassword, port: Number(databasePort), user: databaseUser };
  const writer = new PgClient(connection);
  const rollback = new PgClient(connection);
  const observer = new PgClient(connection);
  let writerTransactionOpen = false;
  let rollbackPromise;

  try {
    await Promise.all([writer.connect(), rollback.connect(), observer.connect()]);
    await writer.query("BEGIN");
    writerTransactionOpen = true;
    await writer.query("UPDATE ops.media_asset SET raw_object_version_id = 'concurrent-uncommitted-version' WHERE media_asset_id = $1", [fixture.mediaAssetId]);

    rollbackPromise = rollback.query(readFileSync(versionPersistenceRollbackSqlPath, "utf8"));
    let observedLockWait = false;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const activity = await observer.query("SELECT wait_event_type FROM pg_stat_activity WHERE pid = $1", [rollback.processID]);
      if (activity.rows[0]?.wait_event_type === "Lock") {
        observedLockWait = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    if (!observedLockWait) {
      throw new Error("Rollback did not visibly wait on the writer's table lock.");
    }

    await writer.query("COMMIT");
    writerTransactionOpen = false;
    let rollbackMessage = "";
    try {
      await rollbackPromise;
    } catch (error) {
      rollbackMessage = error instanceof Error ? error.message : String(error);
    }
    if (!rollbackMessage.includes("Pre-use rollback refused after opaque media version identity use.")) {
      throw new Error("Rollback did not fail closed after the serialized version write.");
    }

    const state = await observer.query("SELECT CASE WHEN to_regclass('ops.media_asset') IS NOT NULL AND to_regclass('ops.media_asset_replica') IS NOT NULL AND (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'ops' AND table_name = 'media_asset' AND column_name IN ('raw_object_version_id', 'thumbnail_object_version_id')) = 2 AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'ops' AND table_name = 'media_asset_replica' AND column_name = 'object_version_id') AND EXISTS (SELECT 1 FROM audit.schema_migration WHERE migration_name = '069_photo_media_opaque_version_ids_v1.sql' AND status = 'succeeded') THEN 'passed' ELSE 'failed' END AS state");
    if (state.rows[0]?.state !== "passed") {
      throw new Error("Serialized rollback changed schema or migration history unexpectedly.");
    }
    return "verified";
  } finally {
    if (rollbackPromise) {
      await rollbackPromise.catch(() => undefined);
    }
    if (writerTransactionOpen) {
      await writer.query("ROLLBACK").catch(() => undefined);
    }
    await Promise.all([
      writer.end().catch(() => undefined),
      rollback.end().catch(() => undefined),
      observer.end().catch(() => undefined),
    ]);
  }
}

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

function expectPsqlFailure(input, expectedMessage) {
  const result = spawnSync(
    "docker",
    ["exec", "-i", containerName, "psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1",
      "-U", databaseUser, "-d", databaseName],
    { cwd: workspaceRoot, encoding: "utf8", input },
  );
  if (result.error) fail(`Failed to start docker: ${result.error.message}`);
  if (result.status === 0 || !result.stderr.includes(expectedMessage)) {
    fail(`Expected PostgreSQL failure ${expectedMessage} was not observed.`);
  }
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
