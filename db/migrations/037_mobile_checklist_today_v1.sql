ALTER TABLE ops.checklist_template
    ADD COLUMN IF NOT EXISTS template_type TEXT NOT NULL DEFAULT 'BM_STORE_VISIT';

ALTER TABLE ops.checklist_template
    DROP CONSTRAINT IF EXISTS checklist_template_template_code_key;

ALTER TABLE ops.checklist_template
    ADD CONSTRAINT checklist_template_code_version_unique UNIQUE (template_code, version_no);

ALTER TABLE ops.checklist_instance
    ADD COLUMN IF NOT EXISTS started_by_user_id TEXT,
    ADD COLUMN IF NOT EXISTS completed_by_user_id TEXT,
    ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

ALTER TABLE ops.checklist_instance
    DROP CONSTRAINT IF EXISTS checklist_instance_status_check;

-- Legacy rows can be validated after data audit/cleanup; new writes are still enforced.
ALTER TABLE ops.checklist_instance
    ADD CONSTRAINT checklist_instance_status_check
    CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')) NOT VALID;

CREATE INDEX IF NOT EXISTS idx_checklist_instance_mobile_today
    ON ops.checklist_instance (store_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_checklist_instance_monthly_completed
    ON ops.checklist_instance (store_id, checklist_template_id, completed_at DESC)
    WHERE status = 'completed';

COMMENT ON COLUMN ops.checklist_template.template_type IS 'Checklist template type such as BM_STORE_VISIT. One checklist engine supports multiple future types.';
COMMENT ON COLUMN ops.checklist_instance.locked_at IS 'Set when a checklist instance is completed and no longer accepts response changes.';
