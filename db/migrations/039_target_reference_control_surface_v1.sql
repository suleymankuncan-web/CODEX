CREATE TABLE IF NOT EXISTS ops.personnel_target_reference (
    personnel_target_reference_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_request_id UUID NOT NULL REFERENCES ops.target_distribution_request(target_distribution_request_id),
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    region_id UUID NOT NULL REFERENCES ops.region(region_id),
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    employee_id UUID NOT NULL REFERENCES ops.employee(employee_id),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    target_value NUMERIC(18,4) NOT NULL CHECK (target_value > 0),
    target_type TEXT NOT NULL DEFAULT 'monthly_sales_target',
    status TEXT NOT NULL DEFAULT 'approved',
    approved_by_user_id TEXT NOT NULL,
    approved_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    supersedes_target_reference_id UUID REFERENCES ops.personnel_target_reference(personnel_target_reference_id),
    CHECK (period_end >= period_start),
    CHECK (status IN ('approved', 'superseded', 'voided_future'))
);

CREATE INDEX IF NOT EXISTS idx_personnel_target_reference_employee_period
    ON ops.personnel_target_reference (employee_id, period_start, period_end, status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_personnel_target_reference_active_unique
    ON ops.personnel_target_reference (employee_id, period_start, period_end, target_type)
    WHERE status = 'approved';

ALTER TABLE rpt.employee_kpi_snapshot
    ADD COLUMN IF NOT EXISTS personnel_target_reference_id UUID REFERENCES ops.personnel_target_reference(personnel_target_reference_id);

COMMENT ON TABLE ops.personnel_target_reference IS 'Approved personnel target references promoted from region-approved target distribution requests for scoring.';
