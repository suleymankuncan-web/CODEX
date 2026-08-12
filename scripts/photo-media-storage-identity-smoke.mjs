import { readFileSync } from "node:fs";
import { join } from "node:path";

export function verifyPhotoMediaStorageIdentity(input) {
  const rollbackSql = readFileSync(join(
    import.meta.dirname,
    "..",
    "db",
    "rollback",
    "070_photo_media_asset_storage_identity_v1.rollback.sql",
  ), "utf8");
  const state = () => input.queryScalar(`
    SELECT CASE WHEN
      (SELECT column_default FROM information_schema.columns
        WHERE table_schema = 'ops' AND table_name = 'media_asset' AND column_name = 'provider_adapter_id') = '''r2''::text'
      AND (SELECT column_default FROM information_schema.columns
        WHERE table_schema = 'ops' AND table_name = 'media_asset' AND column_name = 'jurisdiction') = '''eu''::text'
      AND EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'ops.media_asset'::regclass
          AND conname = 'ck_media_asset_storage_provider_jurisdiction'
      )
      AND EXISTS (
        SELECT 1 FROM audit.schema_migration
        WHERE migration_name = '070_photo_media_asset_storage_identity_v1.sql' AND status = 'succeeded'
      )
    THEN 'passed' ELSE 'failed' END;
  `);
  if (state() !== "passed") throw new Error("Photo media asset storage identity schema/default contract is incomplete.");
  input.runPsql(rollbackSql);
  const preUseRollback = input.queryScalar(`
    SELECT CASE WHEN
      NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'ops' AND table_name = 'media_asset'
          AND column_name IN ('provider_adapter_id', 'jurisdiction')
      )
      AND NOT EXISTS (
        SELECT 1 FROM audit.schema_migration
        WHERE migration_name = '070_photo_media_asset_storage_identity_v1.sql'
      )
    THEN 'verified' ELSE 'failed' END;
  `);
  if (preUseRollback !== "verified") throw new Error("Photo media asset storage identity pre-use rollback was incomplete.");
  input.runBackendMigration();
  if (state() !== "passed") throw new Error("Photo media asset storage identity migration did not reapply cleanly.");

  const fixture = {
    companyId: "86000000-0000-4000-8000-000000000001",
    userId: "86000000-0000-4000-8000-000000000002",
    mediaAssetId: "86000000-0000-4000-8000-000000000003",
  };
  input.runPsql(`
    INSERT INTO ops.company (company_id, company_code, company_name)
    VALUES ('${fixture.companyId}', 'ONP4_STORAGE_IDENTITY', 'Synthetic local storage identity guard');
    INSERT INTO ops.user_account (user_id, username, email)
    VALUES ('${fixture.userId}', 'onp4-storage-identity', 'onp4-storage-identity@example.invalid');
    INSERT INTO ops.media_asset (
      media_asset_id, company_id, classification, state, provider_adapter_id, jurisdiction,
      capture_source, raw_object_key, uploaded_by_user_id
    ) VALUES (
      '${fixture.mediaAssetId}', '${fixture.companyId}', 'checklist_evidence', 'initiated',
      'seaweedfs', 'onprem', 'system_generated',
      'transient/companies/${fixture.companyId}/media/${fixture.mediaAssetId}/raw', '${fixture.userId}'
    );
  `);
  input.expectPsqlFailure(rollbackSql, "Pre-use rollback refused after local storage identity use.");
  const usedRollbackRefusal = input.queryScalar(`
    SELECT CASE WHEN
      (SELECT provider_adapter_id || '/' || jurisdiction FROM ops.media_asset
        WHERE media_asset_id = '${fixture.mediaAssetId}') = 'seaweedfs/onprem'
      AND EXISTS (
        SELECT 1 FROM audit.schema_migration
        WHERE migration_name = '070_photo_media_asset_storage_identity_v1.sql' AND status = 'succeeded'
      )
    THEN 'verified' ELSE 'failed' END;
  `);
  if (usedRollbackRefusal !== "verified") throw new Error("Photo media asset storage identity used rollback refusal changed state.");
  input.runPsql(`
    DELETE FROM ops.media_asset WHERE media_asset_id = '${fixture.mediaAssetId}';
    DELETE FROM ops.user_account WHERE user_id = '${fixture.userId}';
    DELETE FROM ops.company WHERE company_id = '${fixture.companyId}';
  `);
  return {
    localProviderStorageIdentity: "passed",
    localProviderStorageIdentityPreUseRollback: preUseRollback,
    localProviderStorageIdentityUsedRollbackRefusal: usedRollbackRefusal,
  };
}
