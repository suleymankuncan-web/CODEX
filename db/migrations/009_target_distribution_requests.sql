CREATE TABLE IF NOT EXISTS ops.target_distribution_request (
    target_distribution_request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    region_id UUID NOT NULL REFERENCES ops.region(region_id),
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    request_month DATE NOT NULL,
    target_label TEXT NOT NULL,
    total_target_value NUMERIC(18,4) NOT NULL,
    allocation_count INTEGER NOT NULL DEFAULT 0,
    request_status TEXT NOT NULL DEFAULT 'pending_region_approval',
    request_reason TEXT,
    allocation_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    submitted_by_user_id TEXT NOT NULL,
    approved_by_user_id TEXT,
    approved_at TIMESTAMPTZ,
    approval_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_target_distribution_request_scope_status
    ON ops.target_distribution_request (company_id, region_id, store_id, request_status, request_month);

COMMENT ON TABLE ops.target_distribution_request IS 'Store-level target distribution requests that are submitted by store managers and approved by region-level oversight.';
