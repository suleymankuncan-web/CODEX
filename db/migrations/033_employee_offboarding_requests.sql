CREATE TABLE IF NOT EXISTS ops.employee_offboarding_request (
    offboarding_request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    region_id UUID NOT NULL REFERENCES ops.region(region_id),
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    employee_id UUID NOT NULL REFERENCES ops.employee(employee_id),
    request_status TEXT NOT NULL DEFAULT 'pending_hr_approval',
    requested_termination_date DATE NOT NULL,
    termination_reason TEXT NOT NULL,
    request_reason TEXT,
    submitted_by_user_id TEXT NOT NULL,
    reviewed_by_user_id TEXT,
    reviewed_at TIMESTAMPTZ,
    review_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT employee_offboarding_request_status_check CHECK (request_status IN ('pending_hr_approval', 'approved', 'rejected')),
    CONSTRAINT employee_offboarding_request_review_check CHECK (
        (request_status = 'pending_hr_approval' AND reviewed_at IS NULL)
        OR (request_status <> 'pending_hr_approval' AND reviewed_at IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_employee_offboarding_request_store_status
    ON ops.employee_offboarding_request (store_id, request_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_employee_offboarding_request_company_status
    ON ops.employee_offboarding_request (company_id, request_status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_offboarding_request_pending_employee
    ON ops.employee_offboarding_request (employee_id)
    WHERE request_status = 'pending_hr_approval';
