CREATE TABLE IF NOT EXISTS ops.personnel_correction_request (
    request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    region_id UUID NOT NULL REFERENCES ops.region(region_id),
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    employee_id UUID NOT NULL REFERENCES ops.employee(employee_id),
    assignment_id UUID NOT NULL REFERENCES ops.employee_assignment_history(assignment_id),
    employee_revision TIMESTAMPTZ NOT NULL,
    assignment_revision TIMESTAMPTZ NOT NULL,
    previous_values JSONB NOT NULL CHECK (jsonb_typeof(previous_values) = 'object'),
    proposed_values JSONB NOT NULL CHECK (jsonb_typeof(proposed_values) = 'object'),
    request_reason TEXT NOT NULL CHECK (length(btrim(request_reason)) BETWEEN 1 AND 500),
    request_status TEXT NOT NULL DEFAULT 'pending_hr_approval'
        CHECK (request_status IN ('pending_hr_approval', 'approved', 'rejected')),
    submitted_by_user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    reviewed_by_user_id UUID REFERENCES ops.user_account(user_id),
    review_note TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK ((request_status = 'pending_hr_approval' AND reviewed_at IS NULL AND reviewed_by_user_id IS NULL)
        OR (request_status <> 'pending_hr_approval' AND reviewed_at IS NOT NULL AND reviewed_by_user_id IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS personnel_correction_pending_employee
    ON ops.personnel_correction_request(employee_id) WHERE request_status = 'pending_hr_approval';
CREATE INDEX IF NOT EXISTS personnel_correction_company_status
    ON ops.personnel_correction_request(company_id, request_status, created_at DESC);
CREATE INDEX IF NOT EXISTS personnel_correction_store_status
    ON ops.personnel_correction_request(store_id, request_status, created_at DESC);
