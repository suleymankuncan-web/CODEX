SET LOCAL lock_timeout = '5000ms';
SET LOCAL statement_timeout = '30000ms';

CREATE TABLE IF NOT EXISTS ops.photo_media_purge_manifest (
    photo_media_purge_manifest_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source TEXT NOT NULL,
    status TEXT NOT NULL,
    manifest_digest CHAR(64) NOT NULL,
    candidate_count INTEGER NOT NULL,
    candidate_bytes BIGINT NOT NULL,
    reason TEXT NOT NULL,
    created_by_user_id UUID REFERENCES ops.user_account(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    execution_attempt_count INTEGER NOT NULL DEFAULT 0,
    execution_lease_token UUID,
    execution_lease_expires_at TIMESTAMPTZ,
    executed_at TIMESTAMPTZ,
    last_failure_reason TEXT,
    CONSTRAINT ck_photo_media_purge_manifest_source CHECK (source IN ('manual', 'scheduled')),
    CONSTRAINT ck_photo_media_purge_manifest_status CHECK (
        status IN ('previewed', 'executing', 'completed', 'retryable_failure', 'expired')
    ),
    CONSTRAINT ck_photo_media_purge_manifest_digest CHECK (manifest_digest ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_photo_media_purge_manifest_counts CHECK (
        candidate_count >= 0 AND candidate_bytes >= 0 AND execution_attempt_count >= 0
    ),
    CONSTRAINT ck_photo_media_purge_manifest_reason CHECK (
        reason IN ('manual_retention_cleanup', 'scheduled_retention_cleanup')
    ),
    CONSTRAINT ck_photo_media_purge_manifest_expiry CHECK (expires_at > created_at),
    CONSTRAINT ck_photo_media_purge_manifest_lease CHECK (
        (execution_lease_token IS NULL) = (execution_lease_expires_at IS NULL)
    ),
    CONSTRAINT ck_photo_media_purge_manifest_status_shape CHECK (
        (status = 'executing') = (execution_lease_token IS NOT NULL)
        AND (status = 'completed') = (executed_at IS NOT NULL)
    ),
    CONSTRAINT ck_photo_media_purge_manifest_failure CHECK (
        last_failure_reason IS NULL OR last_failure_reason IN ('provider_delete_failed')
    )
);

CREATE TABLE IF NOT EXISTS ops.photo_media_purge_manifest_item (
    photo_media_purge_manifest_id UUID NOT NULL
        REFERENCES ops.photo_media_purge_manifest(photo_media_purge_manifest_id),
    item_no INTEGER NOT NULL,
    media_asset_id UUID NOT NULL,
    company_id UUID NOT NULL,
    asset_state TEXT NOT NULL,
    canonical_sha256 CHAR(64) NOT NULL,
    accounted_provider_bytes BIGINT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    retention_policy_id UUID NOT NULL,
    retention_policy_version INTEGER NOT NULL,
    eligibility_digest CHAR(64) NOT NULL,
    PRIMARY KEY (photo_media_purge_manifest_id, item_no),
    UNIQUE (photo_media_purge_manifest_id, media_asset_id),
    CONSTRAINT fk_photo_media_purge_manifest_item_asset
        FOREIGN KEY (media_asset_id, company_id)
        REFERENCES ops.media_asset(media_asset_id, company_id),
    CONSTRAINT fk_photo_media_purge_manifest_item_policy
        FOREIGN KEY (retention_policy_id, company_id)
        REFERENCES ops.evidence_retention_policy(retention_policy_id, company_id),
    CONSTRAINT ck_photo_media_purge_manifest_item_no CHECK (item_no > 0),
    CONSTRAINT ck_photo_media_purge_manifest_item_state CHECK (asset_state = 'ready'),
    CONSTRAINT ck_photo_media_purge_manifest_item_hashes CHECK (
        canonical_sha256 ~ '^[0-9a-f]{64}$'
        AND eligibility_digest ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT ck_photo_media_purge_manifest_item_counts CHECK (
        accounted_provider_bytes >= 0 AND retention_policy_version > 0
    )
);

ALTER TABLE ops.media_asset
    ADD COLUMN IF NOT EXISTS purge_manifest_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_media_asset_purge_manifest'
          AND conrelid = 'ops.media_asset'::regclass
    ) THEN
        ALTER TABLE ops.media_asset
            ADD CONSTRAINT fk_media_asset_purge_manifest
            FOREIGN KEY (purge_manifest_id)
            REFERENCES ops.photo_media_purge_manifest(photo_media_purge_manifest_id);
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_media_asset_purge_manifest
    ON ops.media_asset(purge_manifest_id)
    WHERE purge_manifest_id IS NOT NULL;

CREATE OR REPLACE FUNCTION ops.guard_media_attachment_ready_lock()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE asset_state TEXT;
BEGIN
    SELECT state INTO asset_state
      FROM ops.media_asset
     WHERE media_asset_id = NEW.media_asset_id
       AND company_id = NEW.company_id
     FOR UPDATE;
    IF asset_state IS NULL OR asset_state IN ('purge_pending', 'deleted_tombstone') THEN
        RAISE EXCEPTION 'Media attachment requires a locked non-purge asset.'
            USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_checklist_media_ready_lock ON ops.checklist_response_media;
CREATE TRIGGER trg_checklist_media_ready_lock
    BEFORE INSERT ON ops.checklist_response_media
    FOR EACH ROW EXECUTE FUNCTION ops.guard_media_attachment_ready_lock();
DROP TRIGGER IF EXISTS trg_action_media_ready_lock ON ops.store_action_plan_evidence;
CREATE TRIGGER trg_action_media_ready_lock
    BEFORE INSERT ON ops.store_action_plan_evidence
    FOR EACH ROW EXECUTE FUNCTION ops.guard_media_attachment_ready_lock();
DROP TRIGGER IF EXISTS trg_reference_media_ready_lock ON ops.visual_reference_item_asset;
CREATE TRIGGER trg_reference_media_ready_lock
    BEFORE INSERT ON ops.visual_reference_item_asset
    FOR EACH ROW EXECUTE FUNCTION ops.guard_media_attachment_ready_lock();
DROP TRIGGER IF EXISTS trg_submission_media_ready_lock ON ops.visual_campaign_submission_media;
CREATE TRIGGER trg_submission_media_ready_lock
    BEFORE INSERT ON ops.visual_campaign_submission_media
    FOR EACH ROW EXECUTE FUNCTION ops.guard_media_attachment_ready_lock();

CREATE INDEX IF NOT EXISTS idx_photo_media_purge_manifest_status_expiry
    ON ops.photo_media_purge_manifest(status, expires_at, created_at);
CREATE INDEX IF NOT EXISTS idx_photo_media_purge_manifest_item_asset
    ON ops.photo_media_purge_manifest_item(media_asset_id, photo_media_purge_manifest_id);

CREATE OR REPLACE FUNCTION ops.guard_photo_media_purge_manifest_item_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Photo media purge manifest items are immutable.' USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS trg_photo_media_purge_manifest_item_immutable
    ON ops.photo_media_purge_manifest_item;
CREATE TRIGGER trg_photo_media_purge_manifest_item_immutable
    BEFORE UPDATE OR DELETE ON ops.photo_media_purge_manifest_item
    FOR EACH ROW EXECUTE FUNCTION ops.guard_photo_media_purge_manifest_item_immutable();

CREATE OR REPLACE FUNCTION ops.guard_photo_media_purge_manifest_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Photo media purge manifests cannot be deleted.' USING ERRCODE = '55000';
    END IF;
    IF NEW.photo_media_purge_manifest_id IS DISTINCT FROM OLD.photo_media_purge_manifest_id
       OR NEW.source IS DISTINCT FROM OLD.source
       OR NEW.manifest_digest IS DISTINCT FROM OLD.manifest_digest
       OR NEW.candidate_count IS DISTINCT FROM OLD.candidate_count
       OR NEW.candidate_bytes IS DISTINCT FROM OLD.candidate_bytes
       OR NEW.reason IS DISTINCT FROM OLD.reason
       OR NEW.created_by_user_id IS DISTINCT FROM OLD.created_by_user_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
    THEN
        RAISE EXCEPTION 'Photo media purge manifest identity is immutable.' USING ERRCODE = '55000';
    END IF;
    IF NOT (
        (OLD.status = 'previewed' AND NEW.status IN ('executing', 'expired'))
        OR (OLD.status = 'retryable_failure' AND NEW.status IN ('executing', 'expired'))
        OR (OLD.status = 'executing' AND NEW.status IN ('completed', 'retryable_failure'))
        OR (OLD.status = 'executing' AND NEW.status = 'executing'
            AND OLD.execution_lease_expires_at <= NOW())
        OR (OLD.status = 'executing' AND NEW.status = 'expired'
            AND OLD.execution_lease_expires_at <= NOW())
    ) THEN
        RAISE EXCEPTION 'Photo media purge manifest transition is invalid.' USING ERRCODE = '55000';
    END IF;
    IF NEW.execution_attempt_count < OLD.execution_attempt_count
       OR NEW.execution_attempt_count > OLD.execution_attempt_count + 1
       OR (NEW.status = 'executing'
           AND NEW.execution_attempt_count <> OLD.execution_attempt_count + 1)
       OR (NEW.status <> 'executing'
           AND NEW.execution_attempt_count <> OLD.execution_attempt_count)
    THEN
        RAISE EXCEPTION 'Photo media purge manifest attempt count is invalid.' USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_photo_media_purge_manifest_guard ON ops.photo_media_purge_manifest;
CREATE TRIGGER trg_photo_media_purge_manifest_guard
    BEFORE UPDATE OR DELETE ON ops.photo_media_purge_manifest
    FOR EACH ROW EXECUTE FUNCTION ops.guard_photo_media_purge_manifest_update();

ALTER TABLE audit.photo_media_reconciliation_run
    ADD COLUMN IF NOT EXISTS dangling_link_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS stuck_upload_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS stuck_purge_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS protected_expiry_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS tombstone_residue_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE audit.photo_media_reconciliation_run
    DROP CONSTRAINT IF EXISTS ck_photo_media_reconciliation_lifecycle_counts;
ALTER TABLE audit.photo_media_reconciliation_run
    ADD CONSTRAINT ck_photo_media_reconciliation_lifecycle_counts CHECK (
        dangling_link_count >= 0 AND stuck_upload_count >= 0 AND stuck_purge_count >= 0
        AND protected_expiry_count >= 0 AND tombstone_residue_count >= 0
    );

ALTER TABLE audit.photo_evidence_event DROP CONSTRAINT IF EXISTS ck_photo_evidence_event_entity;
ALTER TABLE audit.photo_evidence_event ADD CONSTRAINT ck_photo_evidence_event_entity CHECK (entity_name IN (
    'media_asset', 'checklist_response_media', 'store_action_solution_attempt',
    'visual_reference_set', 'visual_campaign_assignment', 'visual_campaign_submission',
    'visual_comparison_run', 'visual_comparison_review', 'evidence_retention_policy',
    'evidence_access', 'photo_media_purge_manifest'
));
ALTER TABLE audit.photo_evidence_event DROP CONSTRAINT IF EXISTS ck_photo_evidence_event_state_before;
ALTER TABLE audit.photo_evidence_event ADD CONSTRAINT ck_photo_evidence_event_state_before CHECK (
    state_before IS NULL OR state_before IN (
        'initiated', 'uploaded', 'quarantined', 'accepted', 'canonicalized', 'ready', 'rejected',
        'expired', 'purge_pending', 'deleted_tombstone', 'draft', 'scheduled', 'open', 'closed',
        'retired', 'not_submitted', 'review_pending', 'correction_requested', 'completed',
        'solution_review_pending', 'correction_required', 'in_progress', 'on_time', 'missed',
        'exempt', 'withdrawn', 'operational_hold', 'queued', 'processing', 'abstained',
        'failed_retryable', 'failed_terminal', 'human_reviewed', 'approve', 'reject', 'accept',
        'override', 'request_recapture', 'previewed', 'executing', 'retryable_failure'
    )
);
ALTER TABLE audit.photo_evidence_event DROP CONSTRAINT IF EXISTS ck_photo_evidence_event_state_after;
ALTER TABLE audit.photo_evidence_event ADD CONSTRAINT ck_photo_evidence_event_state_after CHECK (
    state_after IS NULL OR state_after IN (
        'initiated', 'uploaded', 'quarantined', 'accepted', 'canonicalized', 'ready', 'rejected',
        'expired', 'purge_pending', 'deleted_tombstone', 'draft', 'scheduled', 'open', 'closed',
        'retired', 'not_submitted', 'review_pending', 'correction_requested', 'completed',
        'solution_review_pending', 'correction_required', 'in_progress', 'on_time', 'missed',
        'exempt', 'withdrawn', 'operational_hold', 'queued', 'processing', 'abstained',
        'failed_retryable', 'failed_terminal', 'human_reviewed', 'approve', 'reject', 'accept',
        'override', 'request_recapture', 'previewed', 'executing', 'retryable_failure'
    )
);
ALTER TABLE audit.photo_evidence_event DROP CONSTRAINT IF EXISTS ck_photo_evidence_event_reason;
ALTER TABLE audit.photo_evidence_event ADD CONSTRAINT ck_photo_evidence_event_reason CHECK (
    reason_code IS NULL OR reason_code IN (
        'user_requested', 'policy_required', 'safety_rejection', 'quota_exceeded',
        'authorization_denied', 'retention_expired', 'legal_hold', 'operational_hold',
        'workflow_hold', 'ai_review_hold', 'deadline_elapsed', 'exempted',
        'correction_requested', 'provider_failure', 'schema_failure', 'safety_failure',
        'superseded', 'governed_cleanup'
    )
);

COMMENT ON TABLE ops.photo_media_purge_manifest IS
    'Sanitized digest-bound retention preview and execution receipt; contains no object keys or media payload.';
COMMENT ON TABLE ops.photo_media_purge_manifest_item IS
    'Immutable sanitized retention eligibility snapshots; contains no object keys or media payload.';
