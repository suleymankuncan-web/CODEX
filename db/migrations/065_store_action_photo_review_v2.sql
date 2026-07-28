-- PR-5: Store Action photographic remediation review lifecycle.
-- Additive to V1. Existing terminal rows remain untouched.

ALTER TABLE ops.store_action_plan
    ADD COLUMN IF NOT EXISTS resolution_workflow_version SMALLINT NOT NULL DEFAULT 1;

ALTER TABLE ops.store_action_plan
    DROP CONSTRAINT IF EXISTS ck_store_action_plan_resolution_workflow_version;
ALTER TABLE ops.store_action_plan
    ADD CONSTRAINT ck_store_action_plan_resolution_workflow_version
    CHECK (resolution_workflow_version IN (1, 2));

ALTER TABLE ops.store_action_plan
    DROP CONSTRAINT IF EXISTS store_action_plan_status_check;

ALTER TABLE ops.store_action_plan
    ADD CONSTRAINT store_action_plan_status_check CHECK (
        status IN (
            'open', 'in_progress', 'blocked',
            'solution_review_pending', 'correction_required',
            'closed', 'cancelled'
        )
    );

DROP INDEX IF EXISTS ops.idx_store_action_plan_active_source_unique;
CREATE UNIQUE INDEX idx_store_action_plan_active_source_unique
    ON ops.store_action_plan (store_id, source_type, source_id)
    WHERE status IN (
        'open', 'in_progress', 'blocked',
        'solution_review_pending', 'correction_required'
    );

CREATE INDEX IF NOT EXISTS idx_store_action_plan_solution_review_queue
    ON ops.store_action_plan (region_id, updated_at, store_action_plan_id)
    WHERE status = 'solution_review_pending';

CREATE TABLE IF NOT EXISTS ops.store_action_solution_upload_intent (
    store_action_solution_upload_intent_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_action_plan_id UUID NOT NULL,
    media_asset_id UUID NOT NULL,
    company_id UUID NOT NULL,
    region_id UUID NOT NULL,
    store_id UUID NOT NULL,
    initiated_by_user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_store_action_solution_upload_intent_asset UNIQUE (media_asset_id),
    CONSTRAINT fk_store_action_solution_upload_intent_plan
      FOREIGN KEY (store_action_plan_id, company_id, region_id, store_id)
      REFERENCES ops.store_action_plan(store_action_plan_id, company_id, region_id, store_id),
    CONSTRAINT fk_store_action_solution_upload_intent_asset
      FOREIGN KEY (media_asset_id, company_id, store_id)
      REFERENCES ops.media_asset(media_asset_id, company_id, store_id)
);

DROP TRIGGER IF EXISTS trg_store_action_solution_upload_intent_immutable
    ON ops.store_action_solution_upload_intent;
CREATE TRIGGER trg_store_action_solution_upload_intent_immutable
    BEFORE UPDATE OR DELETE ON ops.store_action_solution_upload_intent
    FOR EACH ROW EXECUTE FUNCTION ops.guard_checklist_photo_evidence_immutable();

COMMENT ON COLUMN ops.store_action_plan.photo_evidence_version IS
    'CAS version for Store Action solution submission and Region Manager review commands.';
