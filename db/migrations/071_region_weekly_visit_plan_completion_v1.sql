SET LOCAL lock_timeout = '5000ms';
SET LOCAL statement_timeout = '30000ms';

CREATE TABLE IF NOT EXISTS ops.region_weekly_visit_plan_completion (
    visit_completion_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_item_id UUID NOT NULL REFERENCES ops.region_weekly_visit_plan_item(plan_item_id),
    completed_by_user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    idempotency_key UUID NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_region_weekly_visit_plan_completion_item UNIQUE (plan_item_id),
    CONSTRAINT uq_region_weekly_visit_plan_completion_idempotency UNIQUE (plan_item_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_region_weekly_visit_plan_completion_completed_at
    ON ops.region_weekly_visit_plan_completion (completed_at DESC, plan_item_id);

COMMENT ON TABLE ops.region_weekly_visit_plan_completion IS 'Immutable attendance evidence for a planned BM visit when no checklist is completed; it never changes checklist scores.';
