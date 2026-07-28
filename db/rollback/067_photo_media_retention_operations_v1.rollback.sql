SET LOCAL lock_timeout = '5000ms';
SET LOCAL statement_timeout = '30000ms';

DO $$
DECLARE applied_at TIMESTAMPTZ;
BEGIN
    SELECT COALESCE(MAX(finished_at), '-infinity'::timestamptz)
      INTO applied_at
      FROM audit.schema_migration
     WHERE migration_name = '067_photo_media_retention_operations_v1.sql';
    IF EXISTS (SELECT 1 FROM ops.photo_media_purge_manifest LIMIT 1)
       OR EXISTS (
          SELECT 1 FROM audit.photo_media_reconciliation_run
           WHERE occurred_at > applied_at
       )
    THEN
        RAISE EXCEPTION 'Migration 067 rollback refused after retention operations use.'
            USING ERRCODE = '55000';
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_photo_media_purge_manifest_item_immutable ON ops.photo_media_purge_manifest_item;
DROP TRIGGER IF EXISTS trg_photo_media_purge_manifest_guard ON ops.photo_media_purge_manifest;
DROP FUNCTION IF EXISTS ops.guard_photo_media_purge_manifest_item_immutable();
DROP FUNCTION IF EXISTS ops.guard_photo_media_purge_manifest_update();
DROP TRIGGER IF EXISTS trg_checklist_media_ready_lock ON ops.checklist_response_media;
DROP TRIGGER IF EXISTS trg_action_media_ready_lock ON ops.store_action_plan_evidence;
DROP TRIGGER IF EXISTS trg_reference_media_ready_lock ON ops.visual_reference_item_asset;
DROP TRIGGER IF EXISTS trg_submission_media_ready_lock ON ops.visual_campaign_submission_media;
DROP FUNCTION IF EXISTS ops.guard_media_attachment_ready_lock();
DROP TABLE IF EXISTS ops.photo_media_purge_manifest_item;
ALTER TABLE ops.media_asset DROP CONSTRAINT IF EXISTS fk_media_asset_purge_manifest;
DROP INDEX IF EXISTS ops.idx_media_asset_purge_manifest;
ALTER TABLE ops.media_asset DROP COLUMN IF EXISTS purge_manifest_id;
DROP TABLE IF EXISTS ops.photo_media_purge_manifest;

ALTER TABLE audit.photo_media_reconciliation_run
    DROP CONSTRAINT IF EXISTS ck_photo_media_reconciliation_lifecycle_counts,
    DROP COLUMN IF EXISTS tombstone_residue_count,
    DROP COLUMN IF EXISTS protected_expiry_count,
    DROP COLUMN IF EXISTS stuck_purge_count,
    DROP COLUMN IF EXISTS stuck_upload_count,
    DROP COLUMN IF EXISTS dangling_link_count;

ALTER TABLE audit.photo_evidence_event DROP CONSTRAINT IF EXISTS ck_photo_evidence_event_entity;
ALTER TABLE audit.photo_evidence_event ADD CONSTRAINT ck_photo_evidence_event_entity CHECK (entity_name IN (
    'media_asset', 'checklist_response_media', 'store_action_solution_attempt',
    'visual_reference_set', 'visual_campaign_assignment', 'visual_campaign_submission',
    'visual_comparison_run', 'visual_comparison_review', 'evidence_retention_policy', 'evidence_access'
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
        'override', 'request_recapture'
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
        'override', 'request_recapture'
    )
);
ALTER TABLE audit.photo_evidence_event DROP CONSTRAINT IF EXISTS ck_photo_evidence_event_reason;
ALTER TABLE audit.photo_evidence_event ADD CONSTRAINT ck_photo_evidence_event_reason CHECK (
    reason_code IS NULL OR reason_code IN (
        'user_requested', 'policy_required', 'safety_rejection', 'quota_exceeded',
        'authorization_denied', 'retention_expired', 'legal_hold', 'operational_hold',
        'workflow_hold', 'ai_review_hold', 'deadline_elapsed', 'exempted',
        'correction_requested', 'provider_failure', 'schema_failure', 'safety_failure', 'superseded'
    )
);

DELETE FROM audit.schema_migration
WHERE migration_name = '067_photo_media_retention_operations_v1.sql';
