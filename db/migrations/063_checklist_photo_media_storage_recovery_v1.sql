SET search_path TO ops, audit, public;
SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TABLE ops.media_asset
    ADD COLUMN IF NOT EXISTS declared_upload_byte_count BIGINT,
    ADD COLUMN IF NOT EXISTS thumbnail_byte_count BIGINT,
    ADD COLUMN IF NOT EXISTS quota_reserved_bytes BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS quota_reserved_class_a INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS quota_reserved_class_b INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS accounted_provider_bytes BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cleanup_lease_token UUID,
    ADD COLUMN IF NOT EXISTS cleanup_lease_expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cleanup_origin_state TEXT,
    ADD COLUMN IF NOT EXISTS storage_attempt_id UUID,
    ADD COLUMN IF NOT EXISTS processing_lease_token UUID,
    ADD COLUMN IF NOT EXISTS processing_lease_expires_at TIMESTAMPTZ;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_media_asset_storage_accounting'
    ) THEN
        ALTER TABLE ops.media_asset
            ADD CONSTRAINT ck_media_asset_storage_accounting CHECK (
                (declared_upload_byte_count IS NULL OR declared_upload_byte_count > 0)
                AND (thumbnail_byte_count IS NULL OR thumbnail_byte_count > 0)
                AND quota_reserved_bytes >= 0
                AND quota_reserved_class_a >= 0
                AND quota_reserved_class_b >= 0
                AND accounted_provider_bytes >= 0
                AND (
                    (cleanup_lease_token IS NULL AND cleanup_lease_expires_at IS NULL)
                    OR (cleanup_lease_token IS NOT NULL AND cleanup_lease_expires_at IS NOT NULL AND cleanup_origin_state IS NOT NULL)
                )
                AND (
                    (processing_lease_token IS NULL AND processing_lease_expires_at IS NULL)
                    OR (processing_lease_token IS NOT NULL AND processing_lease_expires_at IS NOT NULL)
                )
            );
    END IF;
END;
$$;

ALTER TABLE ops.media_asset DROP CONSTRAINT IF EXISTS ck_media_asset_ready;
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
        AND retention_policy_id IS NOT NULL
        AND retention_policy_version IS NOT NULL
        AND expires_at IS NOT NULL
        AND finalized_at IS NOT NULL
        AND storage_attempt_id IS NOT NULL
    ));

CREATE INDEX IF NOT EXISTS idx_media_asset_raw_disposal_retry
    ON ops.media_asset (updated_at, media_asset_id)
    WHERE state = 'ready' AND raw_disposed_at IS NULL;

CREATE TABLE IF NOT EXISTS ops.photo_media_usage_state (
    usage_scope TEXT PRIMARY KEY,
    provider_visible_bytes BIGINT NOT NULL DEFAULT 0,
    operation_month DATE NOT NULL,
    class_a_operations BIGINT NOT NULL DEFAULT 0,
    class_b_operations BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_photo_media_usage_scope CHECK (usage_scope = 'r2-eu'),
    CONSTRAINT ck_photo_media_usage_bytes CHECK (provider_visible_bytes >= 0),
    CONSTRAINT ck_photo_media_usage_operations CHECK (
        class_a_operations >= 0 AND class_b_operations >= 0
    ),
    CONSTRAINT ck_photo_media_usage_month CHECK (
        operation_month = date_trunc('month', operation_month)::date
    )
);

CREATE TABLE IF NOT EXISTS ops.photo_media_daily_usage (
    usage_date DATE NOT NULL,
    subject_kind TEXT NOT NULL,
    subject_id UUID NOT NULL,
    uploaded_bytes BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (usage_date, subject_kind, subject_id),
    CONSTRAINT ck_photo_media_daily_usage_kind CHECK (subject_kind IN ('user', 'store')),
    CONSTRAINT ck_photo_media_daily_usage_bytes CHECK (uploaded_bytes >= 0)
);

CREATE TABLE IF NOT EXISTS ops.media_asset_replica (
    media_asset_replica_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    media_asset_id UUID NOT NULL,
    company_id UUID NOT NULL,
    replica_role TEXT NOT NULL,
    provider_adapter_id TEXT NOT NULL,
    jurisdiction TEXT NOT NULL,
    bucket_alias TEXT NOT NULL,
    object_key TEXT NOT NULL,
    replica_generation INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    replica_state TEXT NOT NULL DEFAULT 'pending',
    content_sha256 CHAR(64),
    byte_count BIGINT,
    copy_started_at TIMESTAMPTZ,
    verified_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    failure_reason_code TEXT,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_media_asset_replica_role_generation UNIQUE (media_asset_id, replica_role, replica_generation),
    CONSTRAINT uq_media_asset_replica_object UNIQUE (provider_adapter_id, jurisdiction, bucket_alias, object_key),
    CONSTRAINT uq_media_asset_replica_company UNIQUE (media_asset_replica_id, company_id),
    CONSTRAINT fk_media_asset_replica_asset FOREIGN KEY (media_asset_id, company_id)
        REFERENCES ops.media_asset(media_asset_id, company_id),
    CONSTRAINT ck_media_asset_replica_role CHECK (replica_role IN ('primary', 'recovery')),
    CONSTRAINT ck_media_asset_replica_generation CHECK (replica_generation > 0),
    CONSTRAINT ck_media_asset_replica_provider CHECK (provider_adapter_id = 'r2'),
    CONSTRAINT ck_media_asset_replica_jurisdiction CHECK (jurisdiction = 'eu'),
    CONSTRAINT ck_media_asset_replica_bucket_role CHECK (
        (replica_role = 'primary' AND bucket_alias = 'primary')
        OR (replica_role = 'recovery' AND bucket_alias = 'recovery')
    ),
    CONSTRAINT ck_media_asset_replica_state CHECK (
        replica_state IN ('pending', 'copying', 'verified', 'failed', 'deleted_tombstone')
    ),
    CONSTRAINT ck_media_asset_replica_object_key_private CHECK (
        object_key = btrim(object_key)
        AND length(object_key) > 0
        AND object_key ~ '^[A-Za-z0-9][A-Za-z0-9._/-]*$'
        AND object_key !~ '(^|/)\.\.?(/|$)'
        AND object_key !~ '//'
        AND object_key !~* '^(https?:|s3:|r2:|data:|file:)'
    ),
    CONSTRAINT ck_media_asset_replica_hash CHECK (
        content_sha256 IS NULL OR content_sha256 ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT ck_media_asset_replica_byte_count CHECK (byte_count IS NULL OR byte_count > 0),
    CONSTRAINT ck_media_asset_replica_verified CHECK (
        replica_state <> 'verified'
        OR (
            content_sha256 IS NOT NULL
            AND byte_count IS NOT NULL
            AND copy_started_at IS NOT NULL
            AND verified_at IS NOT NULL
            AND failed_at IS NULL
            AND failure_reason_code IS NULL
            AND deleted_at IS NULL
        )
    ),
    CONSTRAINT ck_media_asset_replica_failed CHECK (
        replica_state <> 'failed'
        OR (failed_at IS NOT NULL AND length(btrim(failure_reason_code)) > 0)
    ),
    CONSTRAINT ck_media_asset_replica_deleted CHECK (
        replica_state <> 'deleted_tombstone'
        OR (deleted_at IS NOT NULL AND content_sha256 IS NOT NULL AND byte_count IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_media_asset_replica_reconciliation
    ON ops.media_asset_replica (replica_role, replica_state, updated_at, media_asset_id);

CREATE INDEX IF NOT EXISTS idx_media_asset_replica_asset
    ON ops.media_asset_replica (media_asset_id, replica_role, replica_state);

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_asset_replica_one_active_role
    ON ops.media_asset_replica (media_asset_id, replica_role)
    WHERE is_active;

CREATE TABLE IF NOT EXISTS audit.photo_media_storage_event (
    photo_media_storage_event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor_user_id UUID REFERENCES ops.user_account(user_id),
    event_type TEXT NOT NULL,
    media_asset_id UUID,
    media_asset_replica_id UUID,
    company_id UUID NOT NULL,
    correlation_id TEXT NOT NULL,
    reason_code TEXT,
    content_sha256 CHAR(64),
    byte_count BIGINT,
    manifest_digest CHAR(64),
    CONSTRAINT fk_photo_media_storage_event_asset FOREIGN KEY (media_asset_id, company_id)
        REFERENCES ops.media_asset(media_asset_id, company_id),
    CONSTRAINT fk_photo_media_storage_event_replica FOREIGN KEY (media_asset_replica_id, company_id)
        REFERENCES ops.media_asset_replica(media_asset_replica_id, company_id),
    CONSTRAINT ck_photo_media_storage_event_type CHECK (event_type IN (
        'checklist_photo_evidence.storage.primary_verified',
        'checklist_photo_evidence.storage.recovery_copy_started',
        'checklist_photo_evidence.storage.recovery_verified',
        'checklist_photo_evidence.storage.recovery_failed',
        'checklist_photo_evidence.storage.provider_failed',
        'checklist_photo_evidence.storage.quarantined',
        'checklist_photo_evidence.storage.reconciliation_detected',
        'checklist_photo_evidence.storage.restore_started',
        'checklist_photo_evidence.storage.restore_verified',
        'checklist_photo_evidence.storage.restore_failed',
        'checklist_photo_evidence.storage.restore_skipped',
        'checklist_photo_evidence.storage.raw_disposed',
        'checklist_photo_evidence.storage.cleanup_deleted',
        'checklist_photo_evidence.storage.cleanup_failed',
        'checklist_photo_evidence.storage.quota_denied'
    )),
    CONSTRAINT ck_photo_media_storage_event_reason CHECK (
        reason_code IS NULL OR reason_code IN (
            'copy_failed', 'hash_mismatch', 'size_mismatch', 'primary_missing',
            'recovery_missing', 'database_row_missing', 'storage_hard_limit',
            'class_a_hard_limit', 'class_b_hard_limit', 'partial_expired',
            'governed_cleanup', 'manual_restore', 'provider_delete_failed',
            'quarantine_disposed', 'scanner_unsafe', 'scanner_unavailable',
            'provider_write_failed', 'raw_finalized', 'primary_healthy'
        )
    ),
    CONSTRAINT ck_photo_media_storage_event_hash CHECK (
        content_sha256 IS NULL OR content_sha256 ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT ck_photo_media_storage_event_byte_count CHECK (byte_count IS NULL OR byte_count > 0),
    CONSTRAINT ck_photo_media_storage_event_manifest CHECK (
        manifest_digest IS NULL OR manifest_digest ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT ck_photo_media_storage_event_correlation CHECK (length(btrim(correlation_id)) > 0),
    CONSTRAINT ck_photo_media_storage_event_asset_presence CHECK (
        (event_type = 'checklist_photo_evidence.storage.quota_denied' AND media_asset_id IS NULL)
        OR (event_type <> 'checklist_photo_evidence.storage.quota_denied' AND media_asset_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_photo_media_storage_event_asset
    ON audit.photo_media_storage_event (media_asset_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS audit.photo_media_reconciliation_run (
    photo_media_reconciliation_run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expected_asset_count INTEGER NOT NULL,
    missing_object_count INTEGER NOT NULL,
    mismatch_object_count INTEGER NOT NULL,
    orphan_primary_count INTEGER NOT NULL,
    orphan_recovery_count INTEGER NOT NULL,
    manifest_digest CHAR(64) NOT NULL,
    CONSTRAINT ck_photo_media_reconciliation_counts CHECK (
        expected_asset_count >= 0
        AND missing_object_count >= 0
        AND mismatch_object_count >= 0
        AND orphan_primary_count >= 0
        AND orphan_recovery_count >= 0
    ),
    CONSTRAINT ck_photo_media_reconciliation_digest CHECK (
        manifest_digest ~ '^[0-9a-f]{64}$'
    )
);

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

CREATE OR REPLACE FUNCTION ops.guard_media_asset_ready_recovery()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    verified_roles INTEGER;
BEGIN
    IF NEW.state = 'ready' THEN
        SELECT COUNT(DISTINCT mar.replica_role)
        INTO verified_roles
        FROM ops.media_asset_replica mar
        WHERE mar.media_asset_id = NEW.media_asset_id
          AND mar.company_id = NEW.company_id
          AND mar.replica_role IN ('primary', 'recovery')
          AND mar.is_active
          AND mar.replica_state = 'verified'
          AND mar.content_sha256 = NEW.canonical_sha256
          AND mar.byte_count = NEW.byte_count
          AND (mar.replica_role <> 'primary' OR mar.object_key = NEW.canonical_object_key);

        IF verified_roles <> 2 THEN
            RAISE EXCEPTION 'Media asset requires verified primary and recovery replicas before ready.'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_media_asset_ready_recovery ON ops.media_asset;
CREATE TRIGGER trg_media_asset_ready_recovery
    BEFORE INSERT OR UPDATE OF state, company_id, canonical_object_key, canonical_sha256, byte_count ON ops.media_asset
    FOR EACH ROW EXECUTE FUNCTION ops.guard_media_asset_ready_recovery();

CREATE OR REPLACE FUNCTION ops.guard_media_asset_cleanup_lease_holds()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.cleanup_lease_token IS NOT NULL
       AND OLD.cleanup_lease_expires_at > NOW()
       AND (
           NEW.legal_hold IS DISTINCT FROM OLD.legal_hold
           OR NEW.operational_hold IS DISTINCT FROM OLD.operational_hold
           OR NEW.active_workflow_hold IS DISTINCT FROM OLD.active_workflow_hold
           OR NEW.ai_review_hold IS DISTINCT FROM OLD.ai_review_hold
           OR NEW.raw_security_hold IS DISTINCT FROM OLD.raw_security_hold
       )
    THEN
        RAISE EXCEPTION 'Media asset holds cannot change during an active storage lease.'
            USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_media_asset_cleanup_lease_holds ON ops.media_asset;
CREATE TRIGGER trg_media_asset_cleanup_lease_holds
    BEFORE UPDATE OF legal_hold, operational_hold, active_workflow_hold, ai_review_hold, raw_security_hold
    ON ops.media_asset
    FOR EACH ROW EXECUTE FUNCTION ops.guard_media_asset_cleanup_lease_holds();

DROP TRIGGER IF EXISTS trg_photo_media_storage_event_append_only ON audit.photo_media_storage_event;
CREATE TRIGGER trg_photo_media_storage_event_append_only
    BEFORE UPDATE OR DELETE ON audit.photo_media_storage_event
    FOR EACH ROW EXECUTE FUNCTION audit.guard_photo_evidence_event_append_only();

DROP TRIGGER IF EXISTS trg_photo_media_reconciliation_run_append_only ON audit.photo_media_reconciliation_run;
CREATE TRIGGER trg_photo_media_reconciliation_run_append_only
    BEFORE UPDATE OR DELETE ON audit.photo_media_reconciliation_run
    FOR EACH ROW EXECUTE FUNCTION audit.guard_photo_evidence_event_append_only();

COMMENT ON TABLE ops.media_asset_replica IS 'Provider-neutral primary/recovery copy proof; verified rows are immutable except governed deletion tombstones.';
COMMENT ON TABLE audit.photo_media_storage_event IS 'Sanitized append-only media storage, recovery, reconciliation, quota, and cleanup audit.';
COMMENT ON TABLE audit.photo_media_reconciliation_run IS 'Sanitized append-only object inventory reconciliation receipts; object keys are never stored here.';
