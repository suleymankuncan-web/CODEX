CREATE TABLE IF NOT EXISTS ops.store_action_plan (
    store_action_plan_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    region_id UUID NOT NULL REFERENCES ops.region(region_id),
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    owner_user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    created_by_user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    source_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    source_deep_link TEXT,
    source_snapshot_run_id UUID REFERENCES rpt.snapshot_run(snapshot_run_id),
    source_kpi_id UUID REFERENCES ops.kpi_definition(kpi_id),
    title TEXT NOT NULL,
    summary TEXT,
    priority TEXT NOT NULL DEFAULT 'medium',
    status TEXT NOT NULL DEFAULT 'open',
    due_on DATE NOT NULL,
    resolution_note TEXT,
    closed_by_user_id UUID REFERENCES ops.user_account(user_id),
    closed_at TIMESTAMPTZ,
    cancel_reason TEXT,
    cancelled_by_user_id UUID REFERENCES ops.user_account(user_id),
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (source_type IN ('kpi_exception')),
    CHECK (priority IN ('high', 'medium', 'low')),
    CHECK (status IN ('open', 'in_progress', 'blocked', 'closed', 'cancelled')),
    CHECK (status <> 'closed' OR (closed_at IS NOT NULL AND resolution_note IS NOT NULL)),
    CHECK (status <> 'cancelled' OR (cancelled_at IS NOT NULL AND cancel_reason IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_store_action_plan_store_status_due
    ON ops.store_action_plan (store_id, status, due_on);

CREATE INDEX IF NOT EXISTS idx_store_action_plan_owner_status_due
    ON ops.store_action_plan (owner_user_id, status, due_on);

CREATE INDEX IF NOT EXISTS idx_store_action_plan_scope_status_due
    ON ops.store_action_plan (company_id, region_id, status, due_on);

CREATE UNIQUE INDEX IF NOT EXISTS idx_store_action_plan_active_source_unique
    ON ops.store_action_plan (store_id, source_type, source_id)
    WHERE status IN ('open', 'in_progress', 'blocked');

COMMENT ON TABLE ops.store_action_plan IS 'Store-owned follow-up plans created from approved Store Action candidate sources.';
