SET LOCAL lock_timeout = '5000ms';
SET LOCAL statement_timeout = '30000ms';

SELECT pg_advisory_xact_lock(hashtext('photo-media-provider-neutral-v1')::bigint);
SELECT pg_advisory_xact_lock(hashtext('photo-media-r2-eu-quota')::bigint);
SELECT pg_advisory_xact_lock(hashtext('photo-media-v1-quota')::bigint);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM ops.photo_media_usage_state WHERE usage_scope = 'r2-eu'
    ) AND EXISTS (
        SELECT 1 FROM ops.photo_media_usage_state WHERE usage_scope = 'photo-media-v1'
    ) THEN
        RAISE EXCEPTION 'Provider-neutral usage scope migration conflict.'
            USING ERRCODE = '55000';
    END IF;
END;
$$;

ALTER TABLE ops.photo_media_usage_state
    DROP CONSTRAINT IF EXISTS ck_photo_media_usage_scope;

UPDATE ops.photo_media_usage_state
SET usage_scope = 'photo-media-v1', updated_at = NOW()
WHERE usage_scope = 'r2-eu';

ALTER TABLE ops.photo_media_usage_state
    ADD CONSTRAINT ck_photo_media_usage_scope
    CHECK (usage_scope = 'photo-media-v1');

ALTER TABLE ops.media_asset_replica
    DROP CONSTRAINT IF EXISTS ck_media_asset_replica_provider,
    DROP CONSTRAINT IF EXISTS ck_media_asset_replica_jurisdiction,
    DROP CONSTRAINT IF EXISTS ck_media_asset_replica_provider_jurisdiction;

ALTER TABLE ops.media_asset_replica
    ADD CONSTRAINT ck_media_asset_replica_provider_jurisdiction CHECK (
        (provider_adapter_id = 'r2' AND jurisdiction = 'eu')
        OR (provider_adapter_id = 'seaweedfs' AND jurisdiction = 'onprem')
    );

COMMENT ON COLUMN ops.photo_media_usage_state.usage_scope IS
    'Provider-neutral singleton quota scope. Historical R2 counters are retained without reset.';
COMMENT ON COLUMN ops.media_asset_replica.provider_adapter_id IS
    'Storage adapter identity; historical R2 rows remain immutable and local rows use seaweedfs.';
