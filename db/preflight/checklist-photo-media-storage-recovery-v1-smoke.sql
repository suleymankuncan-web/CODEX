BEGIN;

INSERT INTO ops.company (company_id, company_code, company_name)
VALUES ('11000000-0000-4000-8000-000000000001', 'PHOTO_STORAGE_SMOKE', 'Synthetic Photo Storage Smoke');

INSERT INTO ops.region (region_id, company_id, region_code, region_name)
VALUES (
    '21000000-0000-4000-8000-000000000001',
    '11000000-0000-4000-8000-000000000001',
    'PHOTO_STORAGE_REGION',
    'Synthetic Region'
);

INSERT INTO ops.store (store_id, company_id, region_id, store_code, store_name, store_type)
VALUES (
    '31000000-0000-4000-8000-000000000001',
    '11000000-0000-4000-8000-000000000001',
    '21000000-0000-4000-8000-000000000001',
    'PHOTO_STORAGE_STORE',
    'Synthetic Store',
    'company'
);

INSERT INTO ops.user_account (user_id, username, email)
VALUES (
    '41000000-0000-4000-8000-000000000001',
    'photo-storage-smoke',
    'photo-storage-smoke@example.invalid'
);

INSERT INTO ops.evidence_retention_policy (
    retention_policy_id, company_id, version_no, evidence_retention_days,
    reference_retention_days, derived_retention_days, effective_from, created_by_user_id
) VALUES (
    '71000000-0000-4000-8000-000000000001',
    '11000000-0000-4000-8000-000000000001',
    1, 365, 365, 30, NOW(),
    '41000000-0000-4000-8000-000000000001'
);

INSERT INTO ops.media_asset (
    media_asset_id, company_id, region_id, store_id, classification, state,
    capture_source, raw_object_key, canonical_object_key, thumbnail_object_key,
    detected_mime_type, byte_count, thumbnail_byte_count, width_px, height_px,
    original_sha256, canonical_sha256, uploaded_by_user_id, uploaded_at,
    accepted_at, canonicalized_at, metadata_stripped_at, safety_scanned_at,
    raw_disposed_at, retention_policy_id, retention_policy_version, expires_at,
    finalized_at, accounted_provider_bytes, storage_attempt_id
) VALUES (
    '51000000-0000-4000-8000-000000000001',
    '11000000-0000-4000-8000-000000000001',
    '21000000-0000-4000-8000-000000000001',
    '31000000-0000-4000-8000-000000000001',
    'checklist_evidence', 'canonicalized', 'system_generated',
    'companies/11000000-0000-4000-8000-000000000001/media/51000000-0000-4000-8000-000000000001/raw',
    'companies/11000000-0000-4000-8000-000000000001/media/51000000-0000-4000-8000-000000000001/canonical.webp',
    'companies/11000000-0000-4000-8000-000000000001/media/51000000-0000-4000-8000-000000000001/thumbnail.webp',
    'image/webp', 100, 20, 100, 100, repeat('a', 64), repeat('b', 64),
    '41000000-0000-4000-8000-000000000001', NOW(), NOW(), NOW(), NOW(), NOW(), NOW(),
    '71000000-0000-4000-8000-000000000001', 1, NOW() + INTERVAL '365 days', NOW(), 220,
    '61000000-0000-4000-8000-000000000001'
);

DO $$
BEGIN
    BEGIN
        UPDATE ops.media_asset
        SET state = 'ready'
        WHERE media_asset_id = '51000000-0000-4000-8000-000000000001';
        RAISE EXCEPTION 'recovery_required_before_ready was not enforced';
    EXCEPTION
        WHEN check_violation THEN NULL;
    END;
END;
$$;

INSERT INTO ops.media_asset_replica (
    media_asset_id, company_id, replica_role, provider_adapter_id, jurisdiction,
    bucket_alias, object_key, replica_state, content_sha256, byte_count,
    copy_started_at, verified_at
) VALUES
(
    '51000000-0000-4000-8000-000000000001',
    '11000000-0000-4000-8000-000000000001',
    'primary', 'r2', 'eu', 'primary',
    'companies/11000000-0000-4000-8000-000000000001/media/51000000-0000-4000-8000-000000000001/canonical.webp',
    'verified', repeat('b', 64), 100, NOW(), NOW()
),
(
    '51000000-0000-4000-8000-000000000001',
    '11000000-0000-4000-8000-000000000001',
    'recovery', 'r2', 'eu', 'recovery',
    'companies/11000000-0000-4000-8000-000000000001/media/51000000-0000-4000-8000-000000000001/canonical.webp',
    'verified', repeat('b', 64), 100, NOW(), NOW()
);

UPDATE ops.media_asset
SET state = 'ready'
WHERE media_asset_id = '51000000-0000-4000-8000-000000000001';

DO $$
BEGIN
    BEGIN
        UPDATE ops.media_asset
        SET canonical_sha256 = repeat('d', 64)
        WHERE media_asset_id = '51000000-0000-4000-8000-000000000001';
        RAISE EXCEPTION 'post_ready_hash_mutation was not rejected';
    EXCEPTION
        WHEN check_violation THEN NULL;
    END;

    BEGIN
        UPDATE ops.media_asset
        SET canonical_object_key = 'locked/companies/tampered/canonical.webp'
        WHERE media_asset_id = '51000000-0000-4000-8000-000000000001';
        RAISE EXCEPTION 'post_ready_key_mutation was not rejected';
    EXCEPTION
        WHEN check_violation THEN NULL;
    END;
END;
$$;

UPDATE ops.media_asset
SET cleanup_origin_state = 'raw_disposal',
    cleanup_lease_token = '62000000-0000-4000-8000-000000000001',
    cleanup_lease_expires_at = NOW() + INTERVAL '15 minutes'
WHERE media_asset_id = '51000000-0000-4000-8000-000000000001';

DO $$
BEGIN
    BEGIN
        UPDATE ops.media_asset
        SET legal_hold = TRUE
        WHERE media_asset_id = '51000000-0000-4000-8000-000000000001';
        RAISE EXCEPTION 'active_cleanup_lease_hold_mutation was not rejected';
    EXCEPTION
        WHEN object_not_in_prerequisite_state THEN NULL;
    END;
END;
$$;

DO $$
BEGIN
    BEGIN
        UPDATE ops.media_asset_replica
        SET object_key = 'companies/tampered/canonical.webp'
        WHERE media_asset_id = '51000000-0000-4000-8000-000000000001'
          AND replica_role = 'recovery';
        RAISE EXCEPTION 'verified_replica_immutable was not enforced';
    EXCEPTION
        WHEN object_not_in_prerequisite_state THEN NULL;
    END;
END;
$$;

INSERT INTO audit.photo_media_reconciliation_run (
    expected_asset_count, missing_object_count, mismatch_object_count,
    orphan_primary_count, orphan_recovery_count, manifest_digest
) VALUES (1, 0, 0, 0, 0, repeat('c', 64));

DO $$
BEGIN
    BEGIN
        UPDATE audit.photo_media_reconciliation_run SET missing_object_count = 1;
        RAISE EXCEPTION 'reconciliation_receipt_append_only was not enforced';
    EXCEPTION
        WHEN object_not_in_prerequisite_state THEN NULL;
    END;
END;
$$;

SELECT json_build_object(
    'event', 'checklist_photo_media_storage_recovery_smoke.completed',
    'recovery_required_before_ready', true,
    'post_ready_identity_immutable', true,
    'active_cleanup_lease_hold_immutable', true,
    'verified_replica_immutable', true,
    'reconciliation_receipt_append_only', true,
    'rolled_back', true
)::text;

ROLLBACK;
