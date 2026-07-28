SET LOCAL lock_timeout = '5000ms';
SET LOCAL statement_timeout = '30000ms';

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM ops.visual_reference_set LIMIT 1)
       OR EXISTS (SELECT 1 FROM ops.visual_reference_version LIMIT 1)
       OR EXISTS (SELECT 1 FROM ops.visual_campaign_revision_store LIMIT 1)
       OR EXISTS (SELECT 1 FROM ops.visual_reference_upload_intent LIMIT 1)
       OR EXISTS (SELECT 1 FROM ops.visual_campaign_submission_upload_intent LIMIT 1)
       OR EXISTS (SELECT 1 FROM ops.visual_campaign_command_receipt LIMIT 1)
       OR EXISTS (SELECT 1 FROM ops.checklist_instance_item_visual_reference LIMIT 1)
       OR EXISTS (
          SELECT 1 FROM ops.media_asset
          WHERE classification IN ('vm_reference', 'vm_campaign_evidence')
       )
       OR EXISTS (
          SELECT 1 FROM ops.role_permission role_permission
          INNER JOIN ops.role role ON role.role_id = role_permission.role_id
          INNER JOIN ops.permission permission
            ON permission.permission_id = role_permission.permission_id
          WHERE permission.permission_code IN (
            'VM_REFERENCE_PUBLISHER', 'VM_VISUAL_REVIEWER',
            'VM_CAMPAIGN_WINDOW_AUTHORITY', 'VM_CAMPAIGN_SCOPE_AUTHORITY',
            'VM_CAMPAIGN_EMERGENCY_AUTHORITY'
          )
            AND role.role_code <> permission.permission_code
       )
       OR EXISTS (
          SELECT 1 FROM ops.user_role_assignment assignment
          INNER JOIN ops.role role ON role.role_id = assignment.role_id
          WHERE role.role_code IN (
            'VM_REFERENCE_PUBLISHER', 'VM_VISUAL_REVIEWER',
            'VM_CAMPAIGN_WINDOW_AUTHORITY', 'VM_CAMPAIGN_SCOPE_AUTHORITY',
            'VM_CAMPAIGN_EMERGENCY_AUTHORITY'
          )
       )
       OR EXISTS (
          SELECT 1 FROM audit.photo_evidence_event
          WHERE visual_reference_version_id IS NOT NULL OR campaign_revision_id IS NOT NULL
       )
    THEN
        RAISE EXCEPTION 'Migration 066 rollback refused after VM reference management use.'
            USING ERRCODE = '55000';
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_checklist_instance_pin_visual_references ON ops.checklist_instance;
DROP FUNCTION IF EXISTS ops.pin_checklist_instance_visual_references();
DROP TABLE IF EXISTS ops.checklist_instance_item_visual_reference;
DROP TABLE IF EXISTS ops.visual_campaign_command_receipt;
DROP TABLE IF EXISTS ops.visual_campaign_submission_upload_intent;
DROP TABLE IF EXISTS ops.visual_reference_upload_intent;
DROP TABLE IF EXISTS ops.visual_campaign_revision_store;

ALTER TABLE ops.visual_campaign_assignment
    DROP CONSTRAINT IF EXISTS ck_visual_campaign_assignment_hold_reconciliation,
    DROP COLUMN IF EXISTS hold_reconciled_at;

ALTER TABLE audit.photo_evidence_event
    DROP COLUMN IF EXISTS assignment_snapshot_sha256,
    DROP COLUMN IF EXISTS idempotency_key,
    DROP COLUMN IF EXISTS command_digest,
    DROP COLUMN IF EXISTS campaign_revision_id,
    DROP COLUMN IF EXISTS visual_reference_version_id;

DROP INDEX IF EXISTS ops.idx_visual_campaign_submission_media_asset_unique;
ALTER TABLE ops.visual_campaign_submission DROP COLUMN IF EXISTS payload_sha256;
ALTER TABLE ops.visual_reference_item
    DROP COLUMN IF EXISTS required_evidence_count,
    DROP COLUMN IF EXISTS visual_reference_version_id;
ALTER TABLE ops.visual_campaign_revision
    DROP COLUMN IF EXISTS command_digest,
    DROP COLUMN IF EXISTS visual_reference_version_id;
DROP TABLE IF EXISTS ops.visual_reference_version;
ALTER TABLE ops.visual_reference_draft_item DROP COLUMN IF EXISTS required_evidence_count;
ALTER TABLE ops.visual_reference_set
    DROP COLUMN IF EXISTS draft_optimistic_version,
    DROP COLUMN IF EXISTS instructions;

ALTER TABLE ops.media_asset DROP CONSTRAINT IF EXISTS ck_media_asset_classification;
ALTER TABLE ops.media_asset ADD CONSTRAINT ck_media_asset_classification CHECK (
    classification IN ('checklist_evidence', 'action_evidence', 'vm_reference', 'derived_artifact')
);

DELETE FROM ops.role_permission role_permission
USING ops.role role, ops.permission permission
WHERE role_permission.role_id = role.role_id
  AND role_permission.permission_id = permission.permission_id
  AND role.role_code IN (
    'VM_REFERENCE_PUBLISHER', 'VM_VISUAL_REVIEWER',
    'VM_CAMPAIGN_WINDOW_AUTHORITY', 'VM_CAMPAIGN_SCOPE_AUTHORITY',
    'VM_CAMPAIGN_EMERGENCY_AUTHORITY'
  )
  AND permission.permission_code IN (
    'VM_REFERENCE_PUBLISHER', 'VM_VISUAL_REVIEWER',
    'VM_CAMPAIGN_WINDOW_AUTHORITY', 'VM_CAMPAIGN_SCOPE_AUTHORITY',
    'VM_CAMPAIGN_EMERGENCY_AUTHORITY'
  );
DELETE FROM ops.role WHERE role_code IN (
    'VM_REFERENCE_PUBLISHER', 'VM_VISUAL_REVIEWER',
    'VM_CAMPAIGN_WINDOW_AUTHORITY', 'VM_CAMPAIGN_SCOPE_AUTHORITY',
    'VM_CAMPAIGN_EMERGENCY_AUTHORITY'
);
DELETE FROM ops.permission WHERE permission_code IN (
    'VM_REFERENCE_PUBLISHER', 'VM_VISUAL_REVIEWER',
    'VM_CAMPAIGN_WINDOW_AUTHORITY', 'VM_CAMPAIGN_SCOPE_AUTHORITY',
    'VM_CAMPAIGN_EMERGENCY_AUTHORITY'
);

DELETE FROM audit.schema_migration
WHERE migration_name = '066_vm_reference_management_v1.sql';
