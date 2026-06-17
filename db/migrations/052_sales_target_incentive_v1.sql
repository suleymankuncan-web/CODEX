CREATE TABLE IF NOT EXISTS ops.sales_target_incentive_rule_version (
    sales_target_incentive_rule_version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_version_code TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active',
    effective_from DATE NOT NULL,
    period_timezone TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    bracket_boundary_policy TEXT NOT NULL DEFAULT 'lower_inclusive_upper_exclusive',
    round_before_lookup BOOLEAN NOT NULL DEFAULT FALSE,
    raw_amount_minimum_scale INTEGER NOT NULL DEFAULT 6,
    payable_amount_scale INTEGER NOT NULL DEFAULT 2,
    sub_kurus_policy TEXT NOT NULL DEFAULT 'truncate_toward_zero',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    retired_at TIMESTAMPTZ,
    CHECK (status IN ('active', 'retired')),
    CHECK (bracket_boundary_policy = 'lower_inclusive_upper_exclusive'),
    CHECK (round_before_lookup = FALSE),
    CHECK (raw_amount_minimum_scale >= 6),
    CHECK (payable_amount_scale = 2),
    CHECK (sub_kurus_policy = 'truncate_toward_zero')
);

CREATE TABLE IF NOT EXISTS ops.sales_target_incentive_rate_bracket (
    sales_target_incentive_rate_bracket_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_version_id UUID NOT NULL REFERENCES ops.sales_target_incentive_rule_version(sales_target_incentive_rule_version_id),
    rate_table_version TEXT NOT NULL,
    audience TEXT NOT NULL,
    min_achievement_pct NUMERIC(12,4),
    max_achievement_pct NUMERIC(12,4),
    rate NUMERIC(10,4) NOT NULL,
    display_label TEXT NOT NULL,
    sort_order INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (audience IN ('manager', 'personnel')),
    CHECK (min_achievement_pct IS NOT NULL OR max_achievement_pct IS NOT NULL),
    CHECK (min_achievement_pct IS NULL OR min_achievement_pct >= 0),
    CHECK (min_achievement_pct IS NULL OR max_achievement_pct IS NULL OR max_achievement_pct > min_achievement_pct),
    CHECK (rate >= 0)
);

CREATE TABLE IF NOT EXISTS ops.sales_target_incentive_projection (
    sales_target_incentive_projection_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    region_id UUID NOT NULL REFERENCES ops.region(region_id),
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    period_key CHAR(7) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    period_timezone TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    store_type TEXT NOT NULL DEFAULT 'company',
    rule_version_id UUID NOT NULL REFERENCES ops.sales_target_incentive_rule_version(sales_target_incentive_rule_version_id),
    manager_rate_table_version TEXT NOT NULL,
    personnel_rate_table_version TEXT NOT NULL,
    calculation_status TEXT NOT NULL DEFAULT 'no_source',
    blocked_reason TEXT,
    store_target_request_id UUID REFERENCES ops.target_distribution_request(target_distribution_request_id),
    store_target_amount NUMERIC(18,4),
    store_net_sales_amount NUMERIC(18,4),
    store_achievement_pct NUMERIC(18,6),
    store_gate_passed BOOLEAN NOT NULL DEFAULT FALSE,
    manager_rate_bracket_id UUID REFERENCES ops.sales_target_incentive_rate_bracket(sales_target_incentive_rate_bracket_id),
    manager_rate NUMERIC(10,4),
    manager_raw_earned_amount NUMERIC(20,10),
    manager_payable_amount NUMERIC(18,2),
    source_import_batch_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
    source_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    projected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (period_key ~ '^[0-9]{4}-[0-9]{2}$'),
    CHECK (period_end >= period_start),
    CHECK (period_timezone = 'Europe/Istanbul'),
    CHECK (store_type = 'company'),
    CHECK (calculation_status IN ('projected', 'no_source', 'blocked', 'closed')),
    CHECK (calculation_status NOT IN ('blocked', 'no_source') OR blocked_reason IS NOT NULL),
    CHECK (store_target_amount IS NULL OR store_target_amount > 0),
    CHECK (manager_rate IS NULL OR manager_rate >= 0)
);

CREATE TABLE IF NOT EXISTS ops.sales_target_incentive_projection_row (
    sales_target_incentive_projection_row_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    projection_id UUID NOT NULL REFERENCES ops.sales_target_incentive_projection(sales_target_incentive_projection_id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES ops.employee(employee_id),
    user_id UUID REFERENCES ops.user_account(user_id),
    assignment_id UUID REFERENCES ops.employee_assignment_history(assignment_id),
    position_id UUID REFERENCES ops.position(position_id),
    position_code TEXT NOT NULL,
    normalized_from_position_code TEXT,
    participant_type TEXT NOT NULL,
    calculation_status TEXT NOT NULL DEFAULT 'no_source',
    blocked_reason TEXT,
    personnel_target_reference_id UUID REFERENCES ops.personnel_target_reference(personnel_target_reference_id),
    personnel_target_amount NUMERIC(18,4),
    personnel_positive_sales_amount NUMERIC(18,4),
    personnel_achievement_pct NUMERIC(18,6),
    personal_rate_before_gate NUMERIC(10,4),
    applied_rate_bracket_id UUID REFERENCES ops.sales_target_incentive_rate_bracket(sales_target_incentive_rate_bracket_id),
    applied_rate NUMERIC(10,4),
    raw_earned_amount NUMERIC(20,10) NOT NULL DEFAULT 0,
    payable_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    source_import_batch_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
    source_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (position_code IN ('STORE_MANAGER', 'ASSISTANT_MANAGER', 'SENIOR_SALES_CONSULTANT', 'SALES_ASSOCIATE')),
    CHECK (normalized_from_position_code IS NULL OR normalized_from_position_code = 'SHIFT_LEAD'),
    CHECK (participant_type IN ('store_manager', 'personnel')),
    CHECK (calculation_status IN ('projected', 'no_source', 'blocked')),
    CHECK (calculation_status NOT IN ('blocked', 'no_source') OR blocked_reason IS NOT NULL),
    CHECK (personnel_target_amount IS NULL OR personnel_target_amount > 0),
    CHECK (personnel_positive_sales_amount IS NULL OR personnel_positive_sales_amount >= 0),
    CHECK (applied_rate IS NULL OR applied_rate >= 0)
);

CREATE TABLE IF NOT EXISTS ops.sales_target_incentive_close_run (
    sales_target_incentive_close_run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    period_key CHAR(7) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    period_timezone TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    close_cutoff_at TIMESTAMPTZ NOT NULL,
    rule_version_id UUID NOT NULL REFERENCES ops.sales_target_incentive_rule_version(sales_target_incentive_rule_version_id),
    status TEXT NOT NULL DEFAULT 'queued',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failed_reason TEXT,
    created_by_user_id UUID REFERENCES ops.user_account(user_id),
    source_import_batch_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
    source_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (period_key ~ '^[0-9]{4}-[0-9]{2}$'),
    CHECK (period_end >= period_start),
    CHECK (period_timezone = 'Europe/Istanbul'),
    CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
    CHECK (status <> 'succeeded' OR completed_at IS NOT NULL),
    CHECK (status <> 'failed' OR failed_reason IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS rpt.sales_target_incentive_rule_snapshot (
    sales_target_incentive_rule_snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    close_run_id UUID NOT NULL REFERENCES ops.sales_target_incentive_close_run(sales_target_incentive_close_run_id) ON DELETE CASCADE,
    rule_version_id UUID NOT NULL REFERENCES ops.sales_target_incentive_rule_version(sales_target_incentive_rule_version_id),
    rule_version_code TEXT NOT NULL,
    rate_table_versions TEXT[] NOT NULL,
    period_key CHAR(7) NOT NULL,
    period_timezone TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    close_cutoff_at TIMESTAMPTZ NOT NULL,
    rate_brackets_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (period_key ~ '^[0-9]{4}-[0-9]{2}$'),
    CHECK (period_timezone = 'Europe/Istanbul')
);

CREATE TABLE IF NOT EXISTS rpt.sales_target_incentive_assignment_snapshot (
    sales_target_incentive_assignment_snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    close_run_id UUID NOT NULL REFERENCES ops.sales_target_incentive_close_run(sales_target_incentive_close_run_id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    region_id UUID NOT NULL REFERENCES ops.region(region_id),
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    employee_id UUID NOT NULL REFERENCES ops.employee(employee_id),
    user_id UUID REFERENCES ops.user_account(user_id),
    source_assignment_id UUID REFERENCES ops.employee_assignment_history(assignment_id),
    position_id UUID REFERENCES ops.position(position_id),
    position_code TEXT NOT NULL,
    normalized_from_position_code TEXT,
    period_key CHAR(7) NOT NULL,
    period_timezone TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    assignment_started_on DATE NOT NULL,
    assignment_ended_on DATE,
    source_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (position_code IN ('STORE_MANAGER', 'ASSISTANT_MANAGER', 'SENIOR_SALES_CONSULTANT', 'SALES_ASSOCIATE')),
    CHECK (normalized_from_position_code IS NULL OR normalized_from_position_code = 'SHIFT_LEAD'),
    CHECK (period_key ~ '^[0-9]{4}-[0-9]{2}$'),
    CHECK (period_timezone = 'Europe/Istanbul'),
    CHECK (assignment_ended_on IS NULL OR assignment_ended_on >= assignment_started_on)
);

CREATE TABLE IF NOT EXISTS rpt.sales_target_incentive_final_snapshot (
    sales_target_incentive_final_snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    close_run_id UUID NOT NULL REFERENCES ops.sales_target_incentive_close_run(sales_target_incentive_close_run_id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    region_id UUID NOT NULL REFERENCES ops.region(region_id),
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    period_key CHAR(7) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    period_timezone TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    close_cutoff_at TIMESTAMPTZ NOT NULL,
    store_type TEXT NOT NULL DEFAULT 'company',
    rule_version_id UUID NOT NULL REFERENCES ops.sales_target_incentive_rule_version(sales_target_incentive_rule_version_id),
    rule_version_code TEXT NOT NULL,
    manager_rate_table_version TEXT NOT NULL,
    personnel_rate_table_version TEXT NOT NULL,
    store_target_request_id UUID REFERENCES ops.target_distribution_request(target_distribution_request_id),
    store_target_amount NUMERIC(18,4),
    store_net_sales_amount NUMERIC(18,4),
    store_achievement_pct NUMERIC(18,6),
    store_gate_passed BOOLEAN NOT NULL DEFAULT FALSE,
    source_import_batch_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
    source_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (period_key ~ '^[0-9]{4}-[0-9]{2}$'),
    CHECK (period_end >= period_start),
    CHECK (period_timezone = 'Europe/Istanbul'),
    CHECK (store_type = 'company')
);

CREATE TABLE IF NOT EXISTS rpt.sales_target_incentive_final_row (
    sales_target_incentive_final_row_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    final_snapshot_id UUID NOT NULL REFERENCES rpt.sales_target_incentive_final_snapshot(sales_target_incentive_final_snapshot_id) ON DELETE CASCADE,
    assignment_snapshot_id UUID REFERENCES rpt.sales_target_incentive_assignment_snapshot(sales_target_incentive_assignment_snapshot_id),
    employee_id UUID NOT NULL REFERENCES ops.employee(employee_id),
    user_id UUID REFERENCES ops.user_account(user_id),
    participant_type TEXT NOT NULL,
    position_code TEXT NOT NULL,
    normalized_from_position_code TEXT,
    rate_table_version TEXT NOT NULL,
    target_reference_id UUID REFERENCES ops.personnel_target_reference(personnel_target_reference_id),
    target_amount NUMERIC(18,4),
    actual_sales_amount NUMERIC(18,4),
    achievement_pct NUMERIC(18,6),
    applied_rate_bracket_id UUID REFERENCES ops.sales_target_incentive_rate_bracket(sales_target_incentive_rate_bracket_id),
    applied_rate NUMERIC(10,4),
    raw_earned_amount NUMERIC(20,10) NOT NULL DEFAULT 0,
    payable_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    correction_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    adjustment_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    final_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    calculation_status TEXT NOT NULL DEFAULT 'finalized',
    source_import_batch_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
    source_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (participant_type IN ('store_manager', 'personnel')),
    CHECK (position_code IN ('STORE_MANAGER', 'ASSISTANT_MANAGER', 'SENIOR_SALES_CONSULTANT', 'SALES_ASSOCIATE')),
    CHECK (normalized_from_position_code IS NULL OR normalized_from_position_code = 'SHIFT_LEAD'),
    CHECK (target_amount IS NULL OR target_amount > 0),
    CHECK (actual_sales_amount IS NULL OR actual_sales_amount >= 0),
    CHECK (applied_rate IS NULL OR applied_rate >= 0),
    CHECK (calculation_status IN ('finalized', 'corrected', 'adjusted'))
);

CREATE TABLE IF NOT EXISTS ops.sales_target_incentive_adjustment (
    sales_target_incentive_adjustment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    region_id UUID NOT NULL REFERENCES ops.region(region_id),
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    employee_id UUID REFERENCES ops.employee(employee_id),
    projection_row_id UUID REFERENCES ops.sales_target_incentive_projection_row(sales_target_incentive_projection_row_id),
    final_row_id UUID REFERENCES rpt.sales_target_incentive_final_row(sales_target_incentive_final_row_id),
    rule_version_id UUID NOT NULL REFERENCES ops.sales_target_incentive_rule_version(sales_target_incentive_rule_version_id),
    period_key CHAR(7) NOT NULL,
    period_timezone TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    adjustment_scope TEXT NOT NULL,
    adjustment_type TEXT NOT NULL,
    adjustment_amount NUMERIC(18,2) NOT NULL,
    before_amount NUMERIC(18,2),
    after_amount NUMERIC(18,2),
    reason_code TEXT NOT NULL,
    reason_note TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    created_by_user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    approved_by_user_id UUID REFERENCES ops.user_account(user_id),
    approved_at TIMESTAMPTZ,
    evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (period_key ~ '^[0-9]{4}-[0-9]{2}$'),
    CHECK (period_timezone = 'Europe/Istanbul'),
    CHECK (adjustment_scope IN ('projection', 'final_snapshot')),
    CHECK (adjustment_type IN ('correction', 'manual_adjustment')),
    CHECK (adjustment_amount <> 0),
    CHECK (status IN ('draft', 'approved', 'voided')),
    CHECK (status <> 'approved' OR (approved_by_user_id IS NOT NULL AND approved_at IS NOT NULL)),
    CHECK (
        (adjustment_scope = 'projection' AND projection_row_id IS NOT NULL AND final_row_id IS NULL)
        OR (adjustment_scope = 'final_snapshot' AND final_row_id IS NOT NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_target_incentive_rate_bracket_unique
    ON ops.sales_target_incentive_rate_bracket (rule_version_id, rate_table_version, audience, sort_order);

CREATE INDEX IF NOT EXISTS idx_sales_target_incentive_rate_bracket_lookup
    ON ops.sales_target_incentive_rate_bracket (rule_version_id, audience, min_achievement_pct, max_achievement_pct);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_target_incentive_projection_store_period_unique
    ON ops.sales_target_incentive_projection (store_id, period_key);

CREATE INDEX IF NOT EXISTS idx_sales_target_incentive_projection_scope_period
    ON ops.sales_target_incentive_projection (company_id, region_id, period_key, calculation_status);

CREATE INDEX IF NOT EXISTS idx_sales_target_incentive_projection_row_employee
    ON ops.sales_target_incentive_projection_row (employee_id, calculation_status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_target_incentive_projection_row_unique
    ON ops.sales_target_incentive_projection_row (projection_id, employee_id, participant_type);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_target_incentive_close_run_company_period_cutoff
    ON ops.sales_target_incentive_close_run (company_id, period_key, close_cutoff_at);

CREATE INDEX IF NOT EXISTS idx_sales_target_incentive_close_run_status
    ON ops.sales_target_incentive_close_run (status, period_key, close_cutoff_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_target_incentive_rule_snapshot_run
    ON rpt.sales_target_incentive_rule_snapshot (close_run_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_target_incentive_assignment_snapshot_employee
    ON rpt.sales_target_incentive_assignment_snapshot (close_run_id, employee_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_target_incentive_final_snapshot_store
    ON rpt.sales_target_incentive_final_snapshot (close_run_id, store_id);

CREATE INDEX IF NOT EXISTS idx_sales_target_incentive_final_snapshot_scope
    ON rpt.sales_target_incentive_final_snapshot (company_id, region_id, period_key);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_target_incentive_final_row_employee
    ON rpt.sales_target_incentive_final_row (final_snapshot_id, employee_id, participant_type);

CREATE INDEX IF NOT EXISTS idx_sales_target_incentive_adjustment_scope_status
    ON ops.sales_target_incentive_adjustment (company_id, region_id, store_id, period_key, status);

WITH rule AS (
    INSERT INTO ops.sales_target_incentive_rule_version (
        sales_target_incentive_rule_version_id,
        rule_version_code,
        status,
        effective_from,
        period_timezone,
        bracket_boundary_policy,
        round_before_lookup,
        raw_amount_minimum_scale,
        payable_amount_scale,
        sub_kurus_policy
    )
    VALUES (
        '81000000-0000-0000-0000-000000000001',
        'sales-target-incentive-v1.0.0',
        'active',
        DATE '2026-01-01',
        'Europe/Istanbul',
        'lower_inclusive_upper_exclusive',
        FALSE,
        6,
        2,
        'truncate_toward_zero'
    )
    ON CONFLICT (rule_version_code) DO UPDATE
    SET
        status = EXCLUDED.status,
        effective_from = EXCLUDED.effective_from,
        period_timezone = EXCLUDED.period_timezone,
        bracket_boundary_policy = EXCLUDED.bracket_boundary_policy,
        round_before_lookup = EXCLUDED.round_before_lookup,
        raw_amount_minimum_scale = EXCLUDED.raw_amount_minimum_scale,
        payable_amount_scale = EXCLUDED.payable_amount_scale,
        sub_kurus_policy = EXCLUDED.sub_kurus_policy
    RETURNING sales_target_incentive_rule_version_id AS rule_version_id
)
INSERT INTO ops.sales_target_incentive_rate_bracket (
    rule_version_id,
    rate_table_version,
    audience,
    min_achievement_pct,
    max_achievement_pct,
    rate,
    display_label,
    sort_order
)
SELECT
    bracket.rule_version_id,
    bracket.rate_table_version,
    bracket.audience,
    bracket.min_achievement_pct,
    bracket.max_achievement_pct,
    bracket.rate,
    bracket.display_label,
    bracket.sort_order
FROM rule
CROSS JOIN LATERAL (VALUES
    (rule.rule_version_id, 'manager-sales-target-v1.0.0', 'manager', NULL, 80.0000, 0.0000, '< 80.0000%', 10),
    (rule.rule_version_id, 'manager-sales-target-v1.0.0', 'manager', 80.0000, 85.0000, 0.0020, '>= 80.0000% and < 85.0000%', 20),
    (rule.rule_version_id, 'manager-sales-target-v1.0.0', 'manager', 85.0000, 90.0000, 0.0030, '>= 85.0000% and < 90.0000%', 30),
    (rule.rule_version_id, 'manager-sales-target-v1.0.0', 'manager', 90.0000, 95.0000, 0.0040, '>= 90.0000% and < 95.0000%', 40),
    (rule.rule_version_id, 'manager-sales-target-v1.0.0', 'manager', 95.0000, 100.0000, 0.0050, '>= 95.0000% and < 100.0000%', 50),
    (rule.rule_version_id, 'manager-sales-target-v1.0.0', 'manager', 100.0000, 110.0000, 0.0070, '>= 100.0000% and < 110.0000%', 60),
    (rule.rule_version_id, 'manager-sales-target-v1.0.0', 'manager', 110.0000, NULL, 0.0100, '>= 110.0000%', 70),
    (rule.rule_version_id, 'personnel-sales-target-v1.0.0', 'personnel', NULL, 80.0000, 0.0000, '< 80.0000%', 10),
    (rule.rule_version_id, 'personnel-sales-target-v1.0.0', 'personnel', 80.0000, 85.0000, 0.0050, '>= 80.0000% and < 85.0000%', 20),
    (rule.rule_version_id, 'personnel-sales-target-v1.0.0', 'personnel', 85.0000, 90.0000, 0.0050, '>= 85.0000% and < 90.0000%', 30),
    (rule.rule_version_id, 'personnel-sales-target-v1.0.0', 'personnel', 90.0000, 95.0000, 0.0065, '>= 90.0000% and < 95.0000%', 40),
    (rule.rule_version_id, 'personnel-sales-target-v1.0.0', 'personnel', 95.0000, 100.0000, 0.0075, '>= 95.0000% and < 100.0000%', 50),
    (rule.rule_version_id, 'personnel-sales-target-v1.0.0', 'personnel', 100.0000, 110.0000, 0.0150, '>= 100.0000% and < 110.0000%', 60),
    (rule.rule_version_id, 'personnel-sales-target-v1.0.0', 'personnel', 110.0000, NULL, 0.0165, '>= 110.0000%', 70)
) AS bracket(
    rule_version_id,
    rate_table_version,
    audience,
    min_achievement_pct,
    max_achievement_pct,
    rate,
    display_label,
    sort_order
)
ON CONFLICT (rule_version_id, rate_table_version, audience, sort_order) DO UPDATE
SET
    min_achievement_pct = EXCLUDED.min_achievement_pct,
    max_achievement_pct = EXCLUDED.max_achievement_pct,
    rate = EXCLUDED.rate,
    display_label = EXCLUDED.display_label,
    sort_order = EXCLUDED.sort_order;

DROP TRIGGER IF EXISTS trg_sales_target_incentive_final_snapshot_immutable ON rpt.sales_target_incentive_final_snapshot;
CREATE TRIGGER trg_sales_target_incentive_final_snapshot_immutable
    BEFORE UPDATE OR DELETE ON rpt.sales_target_incentive_final_snapshot
    FOR EACH ROW EXECUTE FUNCTION rpt.prevent_snapshot_mutation();

DROP TRIGGER IF EXISTS trg_sales_target_incentive_final_row_immutable ON rpt.sales_target_incentive_final_row;
CREATE TRIGGER trg_sales_target_incentive_final_row_immutable
    BEFORE UPDATE OR DELETE ON rpt.sales_target_incentive_final_row
    FOR EACH ROW EXECUTE FUNCTION rpt.prevent_snapshot_mutation();

DROP TRIGGER IF EXISTS trg_sales_target_incentive_rule_snapshot_immutable ON rpt.sales_target_incentive_rule_snapshot;
CREATE TRIGGER trg_sales_target_incentive_rule_snapshot_immutable
    BEFORE UPDATE OR DELETE ON rpt.sales_target_incentive_rule_snapshot
    FOR EACH ROW EXECUTE FUNCTION rpt.prevent_snapshot_mutation();

DROP TRIGGER IF EXISTS trg_sales_target_incentive_assignment_snapshot_immutable ON rpt.sales_target_incentive_assignment_snapshot;
CREATE TRIGGER trg_sales_target_incentive_assignment_snapshot_immutable
    BEFORE UPDATE OR DELETE ON rpt.sales_target_incentive_assignment_snapshot
    FOR EACH ROW EXECUTE FUNCTION rpt.prevent_snapshot_mutation();

COMMENT ON TABLE ops.sales_target_incentive_rule_version IS 'Versioned sales-target incentive calculation contract. Display labels are not calculation boundaries.';
COMMENT ON TABLE ops.sales_target_incentive_rate_bracket IS 'Exact lower-inclusive and upper-exclusive incentive rate brackets for manager and personnel formulas.';
COMMENT ON TABLE ops.sales_target_incentive_projection IS 'Mutable current-period company-store incentive projection with source evidence pointers only.';
COMMENT ON TABLE ops.sales_target_incentive_projection_row IS 'Mutable current-period eligible employee incentive projection rows. Cashier and non-company stores are excluded before persistence.';
COMMENT ON TABLE ops.sales_target_incentive_close_run IS 'Incentive period close workflow record with the rule version and source cutoff used for final snapshots.';
COMMENT ON TABLE ops.sales_target_incentive_adjustment IS 'Audited admin corrections and manual adjustments for incentive projections or final rows.';
COMMENT ON TABLE rpt.sales_target_incentive_rule_snapshot IS 'Immutable snapshot of the incentive rule/rate table used by a close run.';
COMMENT ON TABLE rpt.sales_target_incentive_assignment_snapshot IS 'Immutable close-time employee assignment snapshot used by incentive finalization.';
COMMENT ON TABLE rpt.sales_target_incentive_final_snapshot IS 'Immutable store-level incentive close snapshot with rule version, cutoff and source evidence pointers.';
COMMENT ON TABLE rpt.sales_target_incentive_final_row IS 'Immutable employee-level incentive close row; later corrections are recorded through ops.sales_target_incentive_adjustment.';
