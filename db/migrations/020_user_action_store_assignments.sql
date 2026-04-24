CREATE TABLE IF NOT EXISTS ops.user_action_store_assignment (
    user_action_store_assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    start_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (end_at IS NULL OR end_at >= start_at)
);

CREATE INDEX IF NOT EXISTS idx_user_action_store_assignment_user_dates
    ON ops.user_action_store_assignment (user_id, start_at, end_at);

CREATE INDEX IF NOT EXISTS idx_user_action_store_assignment_store_dates
    ON ops.user_action_store_assignment (store_id, start_at, end_at);

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_action_store_assignment_active
    ON ops.user_action_store_assignment (user_id, store_id)
    WHERE end_at IS NULL;

COMMENT ON TABLE ops.user_action_store_assignment IS 'Store-level action grants kept separate from role read scope so regional or audit users can read broadly but act only on assigned stores.';
