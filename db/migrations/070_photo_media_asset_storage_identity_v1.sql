SET LOCAL lock_timeout = '5000ms';
SET LOCAL statement_timeout = '30000ms';

SELECT pg_advisory_xact_lock(hashtext('photo-media-asset-storage-identity-v1')::bigint);

ALTER TABLE ops.media_asset
    ADD COLUMN IF NOT EXISTS provider_adapter_id TEXT DEFAULT 'r2',
    ADD COLUMN IF NOT EXISTS jurisdiction TEXT DEFAULT 'eu';

ALTER TABLE ops.media_asset
    ALTER COLUMN provider_adapter_id SET DEFAULT 'r2',
    ALTER COLUMN jurisdiction SET DEFAULT 'eu';

UPDATE ops.media_asset
SET provider_adapter_id = 'r2',
    jurisdiction = 'eu',
    updated_at = NOW()
WHERE provider_adapter_id IS NULL
  AND jurisdiction IS NULL;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM ops.media_asset
        WHERE provider_adapter_id IS NULL
           OR jurisdiction IS NULL
           OR NOT (
               (provider_adapter_id = 'r2' AND jurisdiction = 'eu')
               OR (provider_adapter_id = 'seaweedfs' AND jurisdiction = 'onprem')
           )
    ) THEN
        RAISE EXCEPTION 'Photo media asset storage identity backfill is incomplete or invalid.'
            USING ERRCODE = '55000';
    END IF;
END;
$$;

ALTER TABLE ops.media_asset
    ALTER COLUMN provider_adapter_id SET NOT NULL,
    ALTER COLUMN jurisdiction SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ck_media_asset_storage_provider_jurisdiction'
          AND conrelid = 'ops.media_asset'::regclass
    ) THEN
        ALTER TABLE ops.media_asset
            ADD CONSTRAINT ck_media_asset_storage_provider_jurisdiction CHECK (
                (provider_adapter_id = 'r2' AND jurisdiction = 'eu')
                OR (provider_adapter_id = 'seaweedfs' AND jurisdiction = 'onprem')
            );
    END IF;
END;
$$;

COMMENT ON COLUMN ops.media_asset.provider_adapter_id IS
    'Storage adapter identity captured before provider I/O; historical rows are backfilled to r2.';
COMMENT ON COLUMN ops.media_asset.jurisdiction IS
    'Storage jurisdiction captured with the adapter identity; historical rows are backfilled to eu.';
