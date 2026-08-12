import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("checklist photo media storage recovery schema", () => {
  const root = join(__dirname, "../../../../..");
  const migration = readFileSync(
    join(root, "db/migrations/063_checklist_photo_media_storage_recovery_v1.sql"),
    "utf8",
  );
  const schema = readFileSync(join(root, "db/schema.sql"), "utf8");
  const smoke = readFileSync(
    join(root, "db/preflight/checklist-photo-media-storage-recovery-v1-smoke.sql"),
    "utf8",
  );
  const rollback = readFileSync(
    join(root, "db/preflight/checklist-photo-media-storage-recovery-v1-rollback.sql"),
    "utf8",
  );
  const maintenanceScript = readFileSync(
    join(root, "backend/nestjs/scripts/photo-media-maintenance.ts"),
    "utf8",
  );
  const uploadController = readFileSync(
    join(root, "backend/nestjs/src/modules/store-ops/web/photo-media-storage.controller.ts"),
    "utf8",
  );
  const assetInitiationRepository = readFileSync(
    join(root, "backend/nestjs/src/modules/store-ops/infrastructure/photo-media-asset-initiation.repository.ts"),
    "utf8",
  );
  const assetRestoreRepository = readFileSync(
    join(root, "backend/nestjs/src/modules/store-ops/infrastructure/photo-media-asset-restore.repository.ts"),
    "utf8",
  );
  const retentionMigration = readFileSync(
    join(root, "db/migrations/067_photo_media_retention_operations_v1.sql"),
    "utf8",
  );
  const retentionRollback = readFileSync(
    join(root, "db/rollback/067_photo_media_retention_operations_v1.rollback.sql"),
    "utf8",
  );
  const providerNeutralMigration = readFileSync(
    join(root, "db/migrations/068_photo_media_provider_neutral_storage_v1.sql"),
    "utf8",
  );
  const providerNeutralRollback = readFileSync(
    join(root, "db/rollback/068_photo_media_provider_neutral_storage_v1.rollback.sql"),
    "utf8",
  );
  const versionPersistenceMigration = readFileSync(
    join(root, "db/migrations/069_photo_media_opaque_version_ids_v1.sql"),
    "utf8",
  );
  const versionPersistenceRollback = readFileSync(
    join(root, "db/rollback/069_photo_media_opaque_version_ids_v1.rollback.sql"),
    "utf8",
  );
  const assetStorageIdentityMigration = readFileSync(
    join(root, "db/migrations/070_photo_media_asset_storage_identity_v1.sql"),
    "utf8",
  );
  const assetStorageIdentityRollback = readFileSync(
    join(root, "db/rollback/070_photo_media_asset_storage_identity_v1.rollback.sql"),
    "utf8",
  );

  it.each([migration, schema])("requires a verified recovery replica before ready", (sql) => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS ops\.media_asset_replica/);
    expect(sql).toMatch(/replica_role IN \('primary', 'recovery'\)/);
    expect(sql).toMatch(/replica_state IN \('pending', 'copying', 'verified', 'failed', 'deleted_tombstone'\)/);
    expect(sql).toMatch(/guard_media_asset_ready_recovery/);
    expect(sql).toMatch(/replica_role = 'recovery'/);
    expect(sql).toMatch(/replica_state = 'verified'/);
    expect(sql).toMatch(/canonical_sha256/);
  });

  it("keeps private opaque replica keys and immutable verified proof", () => {
    expect(migration).toMatch(/ck_media_asset_replica_object_key_private/);
    expect(migration).toMatch(/guard_verified_media_asset_replica/);
    expect(migration).toMatch(/Verified media asset replica proof is immutable/);
  });

  it.each([migration, schema])("stores sanitized immutable reconciliation receipts", (sql) => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS audit.photo_media_reconciliation_run");
    expect(sql).toContain("manifest_digest CHAR(64) NOT NULL");
    expect(sql).toContain("trg_photo_media_reconciliation_run_append_only");
    expect(sql).not.toMatch(/photo_media_reconciliation_run[\s\S]{0,800}object_key/i);
  });

  it("proves disposable forward invariants and refuses unsafe rollback", () => {
    expect(smoke).toContain("recovery_required_before_ready was not enforced");
    expect(smoke).toContain("verified_replica_immutable was not enforced");
    expect(smoke).toContain("reconciliation_receipt_append_only was not enforced");
    expect(smoke).toContain("ROLLBACK;");
    expect(rollback).toContain("Pre-use rollback refused");
    expect(rollback).toContain("photo_media_reconciliation_run");
    expect(rollback).toContain("063_checklist_photo_media_storage_recovery_v1.sql");
  });

  it("runs governed retention and retryable cleanup before fail-closed reconciliation", () => {
    const reconciliation = maintenanceScript.indexOf("maintenance.reconcile()");
    expect(maintenanceScript.indexOf("cleanupReadyRawDisposals")).toBeLessThan(reconciliation);
    expect(maintenanceScript.indexOf("cleanupStalePartials")).toBeLessThan(reconciliation);
    expect(maintenanceScript.indexOf("previewRetentionPurge")).toBeLessThan(reconciliation);
    expect(maintenanceScript.indexOf("executeRetentionPurge")).toBeLessThan(reconciliation);
    expect(maintenanceScript).not.toContain("cleanupExpired");
  });

  it("acquires the process buffer guard before route-scoped multipart parsing", () => {
    const guard = uploadController.indexOf("new PhotoMediaUploadBufferGuardInterceptor()");
    const multipart = uploadController.indexOf("FileInterceptor(\"file\"");
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(multipart);
  });

  it("pins derived artifacts to the versioned derived retention period", () => {
    expect(assetInitiationRepository).toContain("derived_retention_days");
    expect(assetInitiationRepository).toContain('input.classification === "derived_artifact"');
    expect(assetRestoreRepository).toContain("ma.classification = 'derived_artifact'");
    expect(assetRestoreRepository).toContain("THEN policy.derived_retention_days");
  });

  it.each([retentionMigration, schema])(
    "serializes every workflow attachment against purge ownership",
    (sql) => {
      expect(sql).toContain("purge_manifest_id UUID");
      expect(sql).toContain("guard_media_attachment_ready_lock");
      expect(sql).toContain("FOR UPDATE");
      expect(sql).toContain("trg_checklist_media_ready_lock");
      expect(sql).toContain("trg_action_media_ready_lock");
      expect(sql).toContain("trg_reference_media_ready_lock");
      expect(sql).toContain("trg_submission_media_ready_lock");
    },
  );

  it.each([retentionMigration, schema])(
    "expires an executing purge only after its execution lease expires",
    (sql) => {
      expect(sql).toMatch(
        /\(OLD\.status = 'executing' AND NEW\.status = 'expired'\r?\n\s+AND OLD\.execution_lease_expires_at <= NOW\(\)\)/,
      );
      expect(sql).not.toContain(
        "OLD.execution_lease_expires_at <= NOW() OR OLD.expires_at <= NOW()",
      );
    },
  );

  it("keeps the new attachment lock gate inside guarded pre-use rollback", () => {
    expect(retentionRollback).toContain("DROP FUNCTION IF EXISTS ops.guard_media_attachment_ready_lock()");
    expect(retentionRollback).toContain("DROP COLUMN IF EXISTS purge_manifest_id");
  });

  it("continues reconciliation and restore after a sanitized retention failure", () => {
    expect(maintenanceScript).toContain("completed_with_retention_failure");
    expect(maintenanceScript).toContain('reason: "retention_cleanup_failed"');
    expect(maintenanceScript.indexOf("maintenance.reconcile()"))
      .toBeGreaterThan(maintenanceScript.indexOf("retention_cleanup_failed"));
  });

  it("preserves historical R2 replicas while allowing only the selected local adapter pair", () => {
    expect(providerNeutralMigration).toContain("photo-media-v1");
    expect(providerNeutralMigration).toContain("photo-media-r2-eu-quota");
    expect(providerNeutralMigration).toContain("Provider-neutral usage scope migration conflict");
    expect(providerNeutralMigration).toMatch(/provider_adapter_id = 'r2'[\s\S]+jurisdiction = 'eu'/);
    expect(providerNeutralMigration).toMatch(/provider_adapter_id = 'seaweedfs'[\s\S]+jurisdiction = 'onprem'/);
    expect(providerNeutralMigration).not.toMatch(/UPDATE ops\.media_asset_replica/);
    expect(providerNeutralRollback).toContain("Pre-use rollback refused");
    expect(providerNeutralRollback).toContain("provider_adapter_id = 'seaweedfs'");
    expect(schema).toContain("CHECK (usage_scope = 'photo-media-v1')");
    expect(schema).toContain("provider_adapter_id = 'r2' AND jurisdiction = 'eu'");
    expect(schema).toContain("provider_adapter_id = 'seaweedfs' AND jurisdiction = 'onprem'");
    expect(smoke).toContain("provider_neutral_usage_scope was not enforced");
    expect(smoke).toContain("invalid_provider_pair was not rejected");
  });

  it("persists provider-neutral opaque object versions without a canonical duplicate", () => {
    for (const sql of [versionPersistenceMigration, schema]) {
      expect(sql).toContain("raw_object_version_id");
      expect(sql).toContain("thumbnail_object_version_id");
      expect(sql).toContain("object_version_id");
      expect(sql).toMatch(/octet_length\([^)]*version_id/i);
      expect(sql).toMatch(/btrim\([^)]*version_id/);
      expect(sql).toContain("1024");
      expect(sql).toMatch(/cntrl|\\x00|C0|ASCII|control/i);
    }
    expect(versionPersistenceMigration).not.toMatch(/canonical_object_version_id/i);
    expect(versionPersistenceRollback).toContain("Pre-use rollback refused");
    expect(versionPersistenceRollback).toContain("DROP COLUMN IF EXISTS object_version_id");
    expect(versionPersistenceMigration).toContain("NEW.object_version_id IS NOT DISTINCT FROM OLD.object_version_id");
  });

  it("binds every media asset to an allowed provider identity before provider I/O", () => {
    expect(assetStorageIdentityMigration).toContain("ADD COLUMN IF NOT EXISTS provider_adapter_id");
    expect(assetStorageIdentityMigration).toContain("ADD COLUMN IF NOT EXISTS jurisdiction");
    expect(assetStorageIdentityMigration).toContain("SET provider_adapter_id = 'r2'");
    expect(assetStorageIdentityMigration).toContain("SET NOT NULL");
    expect(assetStorageIdentityMigration).toMatch(/provider_adapter_id = 'r2'[\s\S]+jurisdiction = 'eu'/);
    expect(assetStorageIdentityMigration).toMatch(/provider_adapter_id = 'seaweedfs'[\s\S]+jurisdiction = 'onprem'/);
    expect(assetStorageIdentityRollback).toContain("Pre-use rollback refused after local storage identity use");
    expect(assetStorageIdentityRollback).toContain("DROP COLUMN IF EXISTS provider_adapter_id");
    expect(schema).toContain("provider_adapter_id TEXT NOT NULL");
    expect(schema).toContain("jurisdiction TEXT NOT NULL");
  });
});
