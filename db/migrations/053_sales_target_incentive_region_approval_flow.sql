CREATE TABLE IF NOT EXISTS ops.sales_target_incentive_store_review (
    sales_target_incentive_store_review_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    region_id UUID NOT NULL REFERENCES ops.region(region_id),
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    final_snapshot_id UUID NOT NULL REFERENCES rpt.sales_target_incentive_final_snapshot(sales_target_incentive_final_snapshot_id),
    period_key CHAR(7) NOT NULL,
    period_timezone TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    review_status TEXT NOT NULL DEFAULT 'pending_review',
    reviewed_by_user_id UUID REFERENCES ops.user_account(user_id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (period_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    CHECK (period_timezone = 'Europe/Istanbul'),
    CHECK (review_status IN ('pending_review', 'reviewed')),
    CHECK (
        (review_status = 'pending_review' AND reviewed_by_user_id IS NULL AND reviewed_at IS NULL)
        OR (review_status = 'reviewed' AND reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL)
    )
);

CREATE TABLE IF NOT EXISTS ops.sales_target_incentive_region_package (
    sales_target_incentive_region_package_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    region_id UUID NOT NULL REFERENCES ops.region(region_id),
    period_key CHAR(7) NOT NULL,
    period_timezone TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    package_status TEXT NOT NULL DEFAULT 'submitted',
    submitted_by_user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    submission_note TEXT,
    reviewed_by_user_id UUID REFERENCES ops.user_account(user_id),
    reviewed_at TIMESTAMPTZ,
    review_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (period_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    CHECK (period_timezone = 'Europe/Istanbul'),
    CHECK (package_status IN ('submitted', 'admin_approved', 'admin_returned')),
    CHECK (package_status <> 'admin_approved' OR (reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL)),
    CHECK (package_status <> 'admin_returned' OR (reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL AND NULLIF(BTRIM(review_note), '') IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS ops.sales_target_incentive_region_package_store (
    sales_target_incentive_region_package_store_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region_package_id UUID NOT NULL REFERENCES ops.sales_target_incentive_region_package(sales_target_incentive_region_package_id) ON DELETE CASCADE,
    store_review_id UUID NOT NULL REFERENCES ops.sales_target_incentive_store_review(sales_target_incentive_store_review_id),
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    region_id UUID NOT NULL REFERENCES ops.region(region_id),
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    final_snapshot_id UUID NOT NULL REFERENCES rpt.sales_target_incentive_final_snapshot(sales_target_incentive_final_snapshot_id),
    period_key CHAR(7) NOT NULL,
    reviewed_by_user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    reviewed_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (period_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);

CREATE TABLE IF NOT EXISTS ops.sales_target_incentive_region_correction (
    sales_target_incentive_region_correction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region_package_id UUID REFERENCES ops.sales_target_incentive_region_package(sales_target_incentive_region_package_id) ON DELETE SET NULL,
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    region_id UUID NOT NULL REFERENCES ops.region(region_id),
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    employee_id UUID NOT NULL REFERENCES ops.employee(employee_id),
    participant_type TEXT NOT NULL,
    target_scope TEXT NOT NULL DEFAULT 'final_snapshot',
    final_row_id UUID NOT NULL REFERENCES rpt.sales_target_incentive_final_row(sales_target_incentive_final_row_id),
    period_key CHAR(7) NOT NULL,
    period_timezone TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    before_amount NUMERIC(18,2) NOT NULL,
    final_amount NUMERIC(18,2) NOT NULL,
    adjustment_amount NUMERIC(18,2) GENERATED ALWAYS AS (final_amount - before_amount) STORED,
    reason_note TEXT NOT NULL,
    correction_status TEXT NOT NULL DEFAULT 'draft',
    created_by_user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    submitted_by_user_id UUID REFERENCES ops.user_account(user_id),
    submitted_at TIMESTAMPTZ,
    reviewed_by_user_id UUID REFERENCES ops.user_account(user_id),
    reviewed_at TIMESTAMPTZ,
    review_note TEXT,
    approved_adjustment_id UUID REFERENCES ops.sales_target_incentive_adjustment(sales_target_incentive_adjustment_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (period_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    CHECK (period_timezone = 'Europe/Istanbul'),
    CHECK (participant_type IN ('store_manager', 'personnel')),
    CHECK (target_scope = 'final_snapshot'),
    CHECK (final_amount <> before_amount),
    CHECK (NULLIF(BTRIM(reason_note), '') IS NOT NULL),
    CHECK (correction_status IN ('draft', 'submitted', 'admin_approved', 'admin_returned', 'voided')),
    CHECK (correction_status <> 'submitted' OR (region_package_id IS NOT NULL AND submitted_by_user_id IS NOT NULL AND submitted_at IS NOT NULL)),
    CHECK (correction_status <> 'admin_approved' OR (region_package_id IS NOT NULL AND submitted_by_user_id IS NOT NULL AND submitted_at IS NOT NULL AND reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL AND approved_adjustment_id IS NOT NULL)),
    CHECK (correction_status <> 'admin_returned' OR (reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL AND NULLIF(BTRIM(review_note), '') IS NOT NULL)),
    CHECK (correction_status <> 'voided' OR approved_adjustment_id IS NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sti_store_review_store_period
    ON ops.sales_target_incentive_store_review (store_id, period_key);

CREATE INDEX IF NOT EXISTS idx_sti_store_review_region_period_status
    ON ops.sales_target_incentive_store_review (region_id, period_key, review_status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sti_region_package_region_period
    ON ops.sales_target_incentive_region_package (region_id, period_key);

CREATE INDEX IF NOT EXISTS idx_sti_region_package_company_period_status
    ON ops.sales_target_incentive_region_package (company_id, period_key, package_status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sti_region_package_store_unique
    ON ops.sales_target_incentive_region_package_store (region_package_id, store_id);

CREATE INDEX IF NOT EXISTS idx_sti_region_package_store_scope
    ON ops.sales_target_incentive_region_package_store (region_id, period_key, store_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sti_region_correction_open_unique
    ON ops.sales_target_incentive_region_correction (store_id, employee_id, participant_type, period_key)
    WHERE correction_status IN ('draft', 'submitted', 'admin_returned');

CREATE INDEX IF NOT EXISTS idx_sti_region_correction_package_status
    ON ops.sales_target_incentive_region_correction (region_package_id, correction_status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sti_region_correction_approved_adjustment
    ON ops.sales_target_incentive_region_correction (approved_adjustment_id)
    WHERE approved_adjustment_id IS NOT NULL;

COMMENT ON TABLE ops.sales_target_incentive_store_review IS 'Region manager store-level incentive review marks for a closed final snapshot period.';
COMMENT ON TABLE ops.sales_target_incentive_region_package IS 'Submitted region manager incentive approval package for a period and region.';
COMMENT ON TABLE ops.sales_target_incentive_region_package_store IS 'Immutable submitted store set snapshot for a region manager incentive package.';
COMMENT ON TABLE ops.sales_target_incentive_region_correction IS 'Region manager draft/submitted incentive corrections, converted to payable adjustments only after admin approval.';
