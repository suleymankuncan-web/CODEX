BEGIN;

DO $$
DECLARE
    runtime_row_count BIGINT;
BEGIN
    SELECT
        (SELECT count(*) FROM ops.media_asset_replica)
        + (SELECT count(*) FROM ops.photo_media_usage_state)
        + (SELECT count(*) FROM ops.photo_media_daily_usage)
        + (SELECT count(*) FROM audit.photo_media_storage_event)
        + (SELECT count(*) FROM audit.photo_media_reconciliation_run)
        + (SELECT count(*) FROM ops.media_asset WHERE
            declared_upload_byte_count IS NOT NULL
            OR thumbnail_byte_count IS NOT NULL
            OR quota_reserved_bytes <> 0
            OR quota_reserved_class_a <> 0
            OR quota_reserved_class_b <> 0
            OR accounted_provider_bytes <> 0
            OR cleanup_lease_token IS NOT NULL
            OR cleanup_lease_expires_at IS NOT NULL
            OR cleanup_origin_state IS NOT NULL
            OR storage_attempt_id IS NOT NULL
            OR processing_lease_token IS NOT NULL
            OR processing_lease_expires_at IS NOT NULL)
    INTO runtime_row_count;

    IF runtime_row_count <> 0 THEN
        RAISE EXCEPTION 'Pre-use rollback refused because photo-media storage runtime rows exist.';
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_media_asset_ready_recovery ON ops.media_asset;
DROP TRIGGER IF EXISTS trg_media_asset_cleanup_lease_holds ON ops.media_asset;
DROP TRIGGER IF EXISTS trg_media_asset_replica_verified_immutable ON ops.media_asset_replica;
DROP TRIGGER IF EXISTS trg_photo_media_storage_event_append_only ON audit.photo_media_storage_event;
DROP TRIGGER IF EXISTS trg_photo_media_reconciliation_run_append_only ON audit.photo_media_reconciliation_run;

DROP TABLE IF EXISTS audit.photo_media_reconciliation_run;
DROP TABLE IF EXISTS audit.photo_media_storage_event;
DROP TABLE IF EXISTS ops.media_asset_replica;
DROP TABLE IF EXISTS ops.photo_media_usage_state;
DROP TABLE IF EXISTS ops.photo_media_daily_usage;

DROP FUNCTION IF EXISTS ops.guard_media_asset_ready_recovery();
DROP FUNCTION IF EXISTS ops.guard_verified_media_asset_replica();
DROP FUNCTION IF EXISTS ops.guard_media_asset_cleanup_lease_holds();

DROP INDEX IF EXISTS ops.idx_media_asset_raw_disposal_retry;

ALTER TABLE ops.media_asset DROP CONSTRAINT IF EXISTS ck_media_asset_ready;

ALTER TABLE ops.media_asset
    DROP CONSTRAINT IF EXISTS ck_media_asset_storage_accounting,
    DROP COLUMN IF EXISTS declared_upload_byte_count,
    DROP COLUMN IF EXISTS thumbnail_byte_count,
    DROP COLUMN IF EXISTS quota_reserved_bytes,
    DROP COLUMN IF EXISTS quota_reserved_class_a,
    DROP COLUMN IF EXISTS quota_reserved_class_b,
    DROP COLUMN IF EXISTS accounted_provider_bytes,
    DROP COLUMN IF EXISTS cleanup_lease_token,
    DROP COLUMN IF EXISTS cleanup_lease_expires_at,
    DROP COLUMN IF EXISTS cleanup_origin_state,
    DROP COLUMN IF EXISTS storage_attempt_id,
    DROP COLUMN IF EXISTS processing_lease_token,
    DROP COLUMN IF EXISTS processing_lease_expires_at;

ALTER TABLE ops.media_asset
    ADD CONSTRAINT ck_media_asset_ready CHECK (state <> 'ready' OR (
        canonical_object_key IS NOT NULL
        AND thumbnail_object_key IS NOT NULL
        AND detected_mime_type IS NOT NULL
        AND byte_count IS NOT NULL
        AND width_px IS NOT NULL
        AND height_px IS NOT NULL
        AND original_sha256 IS NOT NULL
        AND canonical_sha256 IS NOT NULL
        AND metadata_stripped_at IS NOT NULL
        AND safety_scanned_at IS NOT NULL
        AND raw_disposed_at IS NOT NULL
        AND retention_policy_id IS NOT NULL
        AND retention_policy_version IS NOT NULL
        AND expires_at IS NOT NULL
        AND finalized_at IS NOT NULL
    ));

DELETE FROM audit.schema_migration
WHERE migration_name = '063_checklist_photo_media_storage_recovery_v1.sql';

COMMIT;
