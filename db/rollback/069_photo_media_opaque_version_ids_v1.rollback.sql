BEGIN;

SET LOCAL lock_timeout = '5000ms';
SET LOCAL statement_timeout = '30000ms';

SELECT pg_advisory_xact_lock(hashtextextended('hr-axis:onprem:migrations:v1', 0));
SELECT pg_advisory_xact_lock(hashtext('photo-media-opaque-version-ids-v1')::bigint);

LOCK TABLE audit.schema_migration IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE ops.media_asset, ops.media_asset_replica IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM audit.schema_migration
        WHERE migration_name = '069_photo_media_opaque_version_ids_v1.sql'
          AND status = 'succeeded'
    ) THEN
        RAISE EXCEPTION 'Opaque version migration history is not succeeded; rollback refused.'
            USING ERRCODE = '55000';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM ops.media_asset
        WHERE raw_object_version_id IS NOT NULL
           OR thumbnail_object_version_id IS NOT NULL
    ) OR EXISTS (
        SELECT 1
        FROM ops.media_asset_replica
        WHERE object_version_id IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'Pre-use rollback refused after opaque media version identity use.'
            USING ERRCODE = '55000';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION ops.guard_verified_media_asset_replica()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Verified media asset replica proof is immutable; delete is not allowed.'
            USING ERRCODE = '55000';
    END IF;

    IF OLD.replica_state = 'verified' THEN
        IF OLD.is_active AND NOT NEW.is_active
           AND NEW.replica_state = OLD.replica_state
           AND NEW.media_asset_id = OLD.media_asset_id
           AND NEW.company_id = OLD.company_id
           AND NEW.replica_role = OLD.replica_role
           AND NEW.replica_generation = OLD.replica_generation
           AND NEW.provider_adapter_id = OLD.provider_adapter_id
           AND NEW.jurisdiction = OLD.jurisdiction
           AND NEW.bucket_alias = OLD.bucket_alias
           AND NEW.object_key = OLD.object_key
           AND NEW.content_sha256 = OLD.content_sha256
           AND NEW.byte_count = OLD.byte_count
           AND NEW.copy_started_at = OLD.copy_started_at
           AND NEW.verified_at = OLD.verified_at
           AND NEW.failed_at IS NOT DISTINCT FROM OLD.failed_at
           AND NEW.failure_reason_code IS NOT DISTINCT FROM OLD.failure_reason_code
           AND NEW.deleted_at IS NOT DISTINCT FROM OLD.deleted_at
        THEN
            RETURN NEW;
        END IF;
        IF NEW.replica_state = 'deleted_tombstone' THEN
            IF NEW.media_asset_id IS DISTINCT FROM OLD.media_asset_id
                OR NEW.company_id IS DISTINCT FROM OLD.company_id
                OR NEW.replica_role IS DISTINCT FROM OLD.replica_role
                OR NEW.provider_adapter_id IS DISTINCT FROM OLD.provider_adapter_id
                OR NEW.jurisdiction IS DISTINCT FROM OLD.jurisdiction
                OR NEW.bucket_alias IS DISTINCT FROM OLD.bucket_alias
                OR NEW.object_key IS DISTINCT FROM OLD.object_key
                OR NEW.replica_generation IS DISTINCT FROM OLD.replica_generation
                OR NEW.is_active IS DISTINCT FROM OLD.is_active
                OR NEW.content_sha256 IS DISTINCT FROM OLD.content_sha256
                OR NEW.byte_count IS DISTINCT FROM OLD.byte_count
                OR NEW.copy_started_at IS DISTINCT FROM OLD.copy_started_at
                OR NEW.verified_at IS DISTINCT FROM OLD.verified_at
                OR NEW.deleted_at IS NULL
            THEN
                RAISE EXCEPTION 'Verified media asset replica proof is immutable.'
                    USING ERRCODE = '55000';
            END IF;
            RETURN NEW;
        END IF;

        RAISE EXCEPTION 'Verified media asset replica proof is immutable.'
            USING ERRCODE = '55000';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_media_asset_replica_verified_immutable ON ops.media_asset_replica;
CREATE TRIGGER trg_media_asset_replica_verified_immutable
    BEFORE UPDATE OR DELETE ON ops.media_asset_replica
    FOR EACH ROW EXECUTE FUNCTION ops.guard_verified_media_asset_replica();

COMMENT ON COLUMN ops.media_asset.raw_object_version_id IS NULL;
COMMENT ON COLUMN ops.media_asset.thumbnail_object_version_id IS NULL;
COMMENT ON COLUMN ops.media_asset_replica.object_version_id IS NULL;

ALTER TABLE ops.media_asset
    DROP CONSTRAINT IF EXISTS ck_media_asset_raw_object_version_id_private,
    DROP CONSTRAINT IF EXISTS ck_media_asset_thumbnail_object_version_id_private,
    DROP COLUMN IF EXISTS raw_object_version_id,
    DROP COLUMN IF EXISTS thumbnail_object_version_id;

ALTER TABLE ops.media_asset_replica
    DROP CONSTRAINT IF EXISTS ck_media_asset_replica_object_version_id_private,
    DROP COLUMN IF EXISTS object_version_id;

DELETE FROM audit.schema_migration
WHERE migration_name = '069_photo_media_opaque_version_ids_v1.sql';

COMMIT;
