BEGIN;

DO $$
DECLARE
    foundation_row_count BIGINT;
BEGIN
    SELECT
        (SELECT count(*) FROM ops.evidence_retention_policy)
        + (SELECT count(*) FROM ops.media_asset)
        + (SELECT count(*) FROM ops.checklist_response_media)
        + (SELECT count(*) FROM ops.store_action_solution_attempt)
        + (SELECT count(*) FROM ops.store_action_plan_evidence)
        + (SELECT count(*) FROM ops.store_action_solution_review)
        + (SELECT count(*) FROM ops.visual_reference_set)
        + (SELECT count(*) FROM ops.visual_campaign_submission)
        + (SELECT count(*) FROM ops.visual_comparison_run)
        + (SELECT count(*) FROM audit.photo_evidence_event)
    INTO foundation_row_count;

    IF foundation_row_count <> 0 THEN
        RAISE EXCEPTION 'Pre-use rollback refused because photo-evidence foundation rows exist.';
    END IF;
END;
$$;

DROP TABLE IF EXISTS audit.photo_evidence_event;
DROP TABLE IF EXISTS ops.visual_comparison_review;
DROP TABLE IF EXISTS ops.visual_comparison_run;
DROP TABLE IF EXISTS ops.visual_campaign_submission_media;
DROP TABLE IF EXISTS ops.visual_reference_item_asset;
DROP TABLE IF EXISTS ops.visual_reference_item;
DROP TABLE IF EXISTS ops.visual_campaign_submission;
DROP TABLE IF EXISTS ops.visual_campaign_assignment_outcome;
DROP TABLE IF EXISTS ops.visual_campaign_assignment;
DROP TABLE IF EXISTS ops.visual_campaign_revision;
DROP TABLE IF EXISTS ops.visual_reference_draft_item_asset;
DROP TABLE IF EXISTS ops.visual_reference_draft_item;
DROP TABLE IF EXISTS ops.visual_reference_set;
DROP TABLE IF EXISTS ops.store_action_solution_review;
DROP TABLE IF EXISTS ops.store_action_plan_evidence;

ALTER TABLE ops.store_action_plan
    DROP CONSTRAINT IF EXISTS fk_store_action_plan_current_solution_attempt;

ALTER TABLE ops.store_action_plan
    DROP COLUMN IF EXISTS current_solution_attempt_id,
    DROP COLUMN IF EXISTS photo_evidence_version;

DROP TABLE IF EXISTS ops.store_action_solution_attempt;
DROP TABLE IF EXISTS ops.checklist_response_media;
DROP TABLE IF EXISTS ops.media_asset;
DROP TABLE IF EXISTS ops.evidence_retention_policy;

DROP FUNCTION IF EXISTS ops.guard_checklist_response_media_lifecycle();
DROP FUNCTION IF EXISTS ops.guard_checklist_photo_evidence_immutable();
DROP FUNCTION IF EXISTS audit.guard_photo_evidence_event_append_only();

DROP INDEX IF EXISTS ops.idx_store_action_plan_scope_identity;
DROP INDEX IF EXISTS ops.idx_checklist_response_item_identity;
DROP INDEX IF EXISTS ops.idx_checklist_response_instance_identity;
DROP INDEX IF EXISTS ops.idx_checklist_instance_store_identity;
DROP INDEX IF EXISTS ops.idx_checklist_template_item_template_identity;
DROP INDEX IF EXISTS ops.idx_checklist_template_company_identity;
DROP INDEX IF EXISTS ops.idx_store_company_region_identity;
DROP INDEX IF EXISTS ops.idx_region_company_identity;

DELETE FROM audit.schema_migration
WHERE migration_name = '062_checklist_photo_evidence_foundation_v1.sql';

COMMIT;
