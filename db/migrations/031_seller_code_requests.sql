CREATE TABLE IF NOT EXISTS ops.seller_code_request (
    seller_code_request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    region_id UUID NOT NULL REFERENCES ops.region(region_id),
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    store_type TEXT NOT NULL,
    employee_id UUID REFERENCES ops.employee(employee_id),
    request_type TEXT NOT NULL,
    request_status TEXT NOT NULL DEFAULT 'pending_hr_approval',
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    national_id_hash TEXT NOT NULL,
    national_id_last4 TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    requested_hire_date DATE NOT NULL,
    requested_position_id UUID NOT NULL REFERENCES ops.position(position_id),
    employment_type TEXT NOT NULL,
    requested_seller_code TEXT,
    approved_seller_code TEXT,
    last_reference_seller_code TEXT,
    request_reason TEXT,
    submitted_by_user_id TEXT NOT NULL,
    reviewed_by_user_id TEXT,
    reviewed_at TIMESTAMPTZ,
    review_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT seller_code_request_store_type_check CHECK (store_type IN ('company', 'franchise', 'operator')),
    CONSTRAINT seller_code_request_type_check CHECK (request_type IN ('create_code')),
    CONSTRAINT seller_code_request_status_check CHECK (request_status IN ('pending_hr_approval', 'approved', 'rejected')),
    CONSTRAINT seller_code_request_employment_type_check CHECK (employment_type IN ('full_time', 'part_time', 'temporary')),
    CONSTRAINT seller_code_request_review_check CHECK (
        (request_status = 'pending_hr_approval' AND reviewed_at IS NULL)
        OR (request_status <> 'pending_hr_approval' AND reviewed_at IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_seller_code_request_store_status
    ON ops.seller_code_request (store_id, request_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_seller_code_request_company_status
    ON ops.seller_code_request (company_id, request_status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_seller_code_request_approved_code_unique
    ON ops.seller_code_request (UPPER(approved_seller_code))
    WHERE approved_seller_code IS NOT NULL AND request_status = 'approved';
