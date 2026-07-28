BEGIN;

DO $$
DECLARE manifest_id UUID;
        active_lease_manifest_id UUID;
BEGIN
    INSERT INTO ops.photo_media_purge_manifest (
        source, status, manifest_digest, candidate_count, candidate_bytes,
        reason, expires_at
    ) VALUES (
        'manual', 'previewed', repeat('a', 64), 0, 0,
        'manual_retention_cleanup', NOW() + INTERVAL '30 minutes'
    ) RETURNING photo_media_purge_manifest_id INTO manifest_id;

    BEGIN
        UPDATE ops.photo_media_purge_manifest
           SET manifest_digest = repeat('b', 64)
         WHERE photo_media_purge_manifest_id = manifest_id;
        RAISE EXCEPTION 'manifest_identity_immutable was not enforced';
    EXCEPTION WHEN SQLSTATE '55000' THEN NULL;
    END;

    INSERT INTO ops.photo_media_purge_manifest (
        source, status, manifest_digest, candidate_count, candidate_bytes,
        reason, created_at, expires_at
    ) VALUES (
        'manual', 'previewed', repeat('c', 64), 0, 0,
        'manual_retention_cleanup', NOW() - INTERVAL '2 seconds', NOW() - INTERVAL '1 second'
    ) RETURNING photo_media_purge_manifest_id INTO active_lease_manifest_id;
    UPDATE ops.photo_media_purge_manifest
       SET status = 'executing', execution_attempt_count = 1,
           execution_lease_token = gen_random_uuid(),
           execution_lease_expires_at = NOW() + INTERVAL '30 minutes'
     WHERE photo_media_purge_manifest_id = active_lease_manifest_id;
    BEGIN
        UPDATE ops.photo_media_purge_manifest
           SET status = 'expired', execution_lease_token = NULL,
               execution_lease_expires_at = NULL
         WHERE photo_media_purge_manifest_id = active_lease_manifest_id;
        RAISE EXCEPTION 'active_execution_lease_expiry_guard was not enforced';
    EXCEPTION WHEN SQLSTATE '55000' THEN NULL;
    END;

    UPDATE ops.photo_media_purge_manifest
       SET status = 'executing', execution_attempt_count = 1,
           execution_lease_token = gen_random_uuid(),
           execution_lease_expires_at = NOW() - INTERVAL '1 second'
     WHERE photo_media_purge_manifest_id = manifest_id;
    UPDATE ops.photo_media_purge_manifest
       SET status = 'executing', execution_attempt_count = 2,
           execution_lease_token = gen_random_uuid(),
           execution_lease_expires_at = NOW() + INTERVAL '30 minutes'
     WHERE photo_media_purge_manifest_id = manifest_id;

    BEGIN
        DELETE FROM ops.photo_media_purge_manifest
         WHERE photo_media_purge_manifest_id = manifest_id;
        RAISE EXCEPTION 'manifest_delete_refused was not enforced';
    EXCEPTION WHEN SQLSTATE '55000' THEN NULL;
    END;

    BEGIN
        UPDATE ops.photo_media_purge_manifest
           SET status = 'previewed',
               execution_lease_token = NULL,
               execution_lease_expires_at = NULL
         WHERE photo_media_purge_manifest_id = manifest_id;
        RAISE EXCEPTION 'manifest_transition_guard was not enforced';
    EXCEPTION WHEN SQLSTATE '55000' THEN NULL;
    END;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'audit'
           AND table_name = 'photo_media_reconciliation_run'
           AND column_name = 'tombstone_residue_count'
    ) THEN
        RAISE EXCEPTION 'lifecycle_reconciliation_contract is missing';
    END IF;
END;
$$;

SELECT json_build_object(
    'event', 'photo_media_retention_operations_smoke.completed',
    'manifest_identity_immutable', true,
    'manifest_delete_refused', true,
    'manifest_transition_guard', true,
    'expired_execution_reclaim', true,
    'active_execution_lease_expiry_guard', true,
    'lifecycle_reconciliation_contract', true,
    'rolled_back', true
)::text;

ROLLBACK;
