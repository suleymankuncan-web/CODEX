BEGIN;

-- Safe only before V2 lifecycle rows exist. After use, disable the V2 runtime
-- controls and preserve pending data for the operational queue.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM ops.store_action_plan
        WHERE resolution_workflow_version = 2
           OR status IN ('solution_review_pending', 'correction_required')
           OR current_solution_attempt_id IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'store_action_photo_review_v2_rows_exist';
    END IF;
    IF EXISTS (SELECT 1 FROM ops.store_action_solution_upload_intent) THEN
        RAISE EXCEPTION 'store_action_photo_review_v2_upload_intents_exist';
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_store_action_solution_upload_intent_immutable
    ON ops.store_action_solution_upload_intent;
DROP TABLE IF EXISTS ops.store_action_solution_upload_intent;
DROP INDEX IF EXISTS ops.idx_store_action_plan_solution_review_queue;
DROP INDEX IF EXISTS ops.idx_store_action_plan_active_source_unique;

ALTER TABLE ops.store_action_plan
    DROP CONSTRAINT IF EXISTS ck_store_action_plan_resolution_workflow_version,
    DROP CONSTRAINT IF EXISTS store_action_plan_status_check;
ALTER TABLE ops.store_action_plan
    ADD CONSTRAINT store_action_plan_status_check CHECK (
        status IN ('open', 'in_progress', 'blocked', 'closed', 'cancelled')
    );

CREATE UNIQUE INDEX idx_store_action_plan_active_source_unique
    ON ops.store_action_plan (store_id, source_type, source_id)
    WHERE status IN ('open', 'in_progress', 'blocked');

ALTER TABLE ops.store_action_plan
    DROP COLUMN IF EXISTS resolution_workflow_version;

DELETE FROM audit.schema_migration
WHERE migration_name = '065_store_action_photo_review_v2.sql';

COMMIT;
