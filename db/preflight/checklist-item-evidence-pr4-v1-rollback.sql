BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM ops.checklist_template_item WHERE evidence_policy <> 'none'
  ) OR EXISTS (
    SELECT 1 FROM ops.checklist_response_media
  ) OR EXISTS (
    SELECT 1 FROM ops.photo_evidence_command_receipt
  ) OR EXISTS (
    SELECT 1 FROM ops.checklist_item_evidence_upload_intent
  ) THEN
    RAISE EXCEPTION 'checklist item evidence rollback refused after feature use';
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_published_checklist_item_evidence_policy ON ops.checklist_template_item;
DROP FUNCTION IF EXISTS ops.guard_published_checklist_item_evidence_policy();
DROP TRIGGER IF EXISTS trg_checklist_instance_item_policy_immutable ON ops.checklist_instance_item_policy;
DROP TRIGGER IF EXISTS trg_checklist_item_evidence_upload_intent_immutable ON ops.checklist_item_evidence_upload_intent;
DROP TABLE IF EXISTS ops.checklist_item_evidence_upload_intent;
DROP FUNCTION IF EXISTS ops.guard_checklist_instance_item_policy_immutable();
DROP TRIGGER IF EXISTS trg_checklist_instance_item_policy_snapshot ON ops.checklist_instance;
DROP FUNCTION IF EXISTS ops.snapshot_checklist_instance_item_policy();
DROP TABLE IF EXISTS ops.photo_evidence_command_receipt;
ALTER TABLE ops.checklist_response_media
  DROP CONSTRAINT IF EXISTS fk_checklist_response_media_instance_policy;
DROP INDEX IF EXISTS ops.uq_checklist_response_media_global_asset;
DROP TABLE IF EXISTS ops.checklist_instance_item_policy;
DROP INDEX IF EXISTS ops.idx_checklist_instance_template_identity;
ALTER TABLE ops.checklist_instance DROP COLUMN IF EXISTS evidence_version_no;
ALTER TABLE ops.checklist_template_item DROP COLUMN IF EXISTS max_evidence_count;
ALTER TABLE ops.checklist_template_item DROP COLUMN IF EXISTS evidence_policy;
ALTER TABLE audit.photo_evidence_event
  DROP CONSTRAINT IF EXISTS ck_photo_evidence_event_type;
ALTER TABLE audit.photo_evidence_event
  ADD CONSTRAINT ck_photo_evidence_event_type CHECK (event_type IN (
    'checklist_photo_evidence.media.upload_initiated', 'checklist_photo_evidence.media.uploaded',
    'checklist_photo_evidence.media.rejected', 'checklist_photo_evidence.media.quarantined',
    'checklist_photo_evidence.media.finalized', 'checklist_photo_evidence.media.viewed',
    'checklist_photo_evidence.media.downloaded', 'checklist_photo_evidence.media.redacted',
    'checklist_photo_evidence.media.expired', 'checklist_photo_evidence.media.deleted',
    'checklist_photo_evidence.media.deletion_failed', 'checklist_photo_evidence.checklist.linked',
    'checklist_photo_evidence.checklist.unlinked',
    'checklist_photo_evidence.reference.draft_created', 'checklist_photo_evidence.reference.published',
    'checklist_photo_evidence.reference.retired', 'checklist_photo_evidence.reference.superseded',
    'checklist_photo_evidence.campaign.scheduled', 'checklist_photo_evidence.campaign.opened',
    'checklist_photo_evidence.campaign.submitted', 'checklist_photo_evidence.campaign.closed',
    'checklist_photo_evidence.campaign.missed', 'checklist_photo_evidence.campaign.exempted',
    'checklist_photo_evidence.campaign.extended', 'checklist_photo_evidence.campaign.reopened',
    'checklist_photo_evidence.campaign.scope_revised', 'checklist_photo_evidence.campaign.operational_hold_recorded',
    'checklist_photo_evidence.action.solution_submitted', 'checklist_photo_evidence.action.solution_approved',
    'checklist_photo_evidence.action.solution_rejected', 'checklist_photo_evidence.action.solution_resubmitted',
    'checklist_photo_evidence.comparison.queued', 'checklist_photo_evidence.comparison.invoked',
    'checklist_photo_evidence.comparison.completed', 'checklist_photo_evidence.comparison.abstained',
    'checklist_photo_evidence.comparison.failed', 'checklist_photo_evidence.comparison.retried',
    'checklist_photo_evidence.comparison.review_accepted', 'checklist_photo_evidence.comparison.review_overridden',
    'checklist_photo_evidence.comparison.review_rejected', 'checklist_photo_evidence.comparison.recapture_requested',
    'checklist_photo_evidence.retention.policy_changed', 'checklist_photo_evidence.retention.cleanup_previewed',
    'checklist_photo_evidence.retention.cleanup_executed', 'checklist_photo_evidence.authorization.denied'
  ));
DELETE FROM audit.schema_migration
WHERE migration_name = '064_checklist_item_evidence_v1.sql';

COMMIT;
