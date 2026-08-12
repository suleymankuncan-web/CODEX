BEGIN;

SET LOCAL lock_timeout = '5000ms';
SET LOCAL statement_timeout = '30000ms';

SELECT pg_advisory_xact_lock(hashtextextended('hr-axis:onprem:migrations:v1', 0));
SELECT pg_advisory_xact_lock(hashtext('photo-media-asset-storage-identity-v1')::bigint);

LOCK TABLE audit.schema_migration IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE ops.media_asset IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM audit.schema_migration
        WHERE migration_name = '070_photo_media_asset_storage_identity_v1.sql'
          AND status = 'succeeded'
    ) THEN
        RAISE EXCEPTION 'Storage identity migration history is not succeeded; rollback refused.'
            USING ERRCODE = '55000';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM ops.media_asset
        WHERE provider_adapter_id = 'seaweedfs'
           OR jurisdiction = 'onprem'
    ) THEN
        RAISE EXCEPTION 'Pre-use rollback refused after local storage identity use.'
            USING ERRCODE = '55000';
    END IF;
END;
$$;

COMMENT ON COLUMN ops.media_asset.provider_adapter_id IS NULL;
COMMENT ON COLUMN ops.media_asset.jurisdiction IS NULL;

ALTER TABLE ops.media_asset
    DROP CONSTRAINT IF EXISTS ck_media_asset_storage_provider_jurisdiction,
    DROP COLUMN IF EXISTS provider_adapter_id,
    DROP COLUMN IF EXISTS jurisdiction;

DELETE FROM audit.schema_migration
WHERE migration_name = '070_photo_media_asset_storage_identity_v1.sql';

COMMIT;
