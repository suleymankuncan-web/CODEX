CREATE TABLE IF NOT EXISTS ops.checklist_acknowledgement (
    checklist_acknowledgement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checklist_instance_id UUID NOT NULL REFERENCES ops.checklist_instance(checklist_instance_id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    acknowledged_by_user_id TEXT NOT NULL,
    acknowledgement_note TEXT,
    acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (checklist_instance_id)
);

CREATE INDEX IF NOT EXISTS idx_checklist_acknowledgement_store_acknowledged_at
    ON ops.checklist_acknowledgement (store_id, acknowledged_at DESC);
