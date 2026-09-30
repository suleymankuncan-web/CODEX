SET LOCAL lock_timeout = '5000ms';
SET LOCAL statement_timeout = '30000ms';

-- Coordinate every KPI writer and the private daily worker at activation.
-- Existing rows are retained. A down migration cannot restore the old grain
-- after multiple stores have been accepted; recovery must remain store-aware.
DROP INDEX IF EXISTS ops.kpi_actual_employee_live_unique_idx;
CREATE UNIQUE INDEX IF NOT EXISTS kpi_actual_employee_store_live_unique_idx
    ON ops.kpi_actual (kpi_id, employee_id, store_id, period_type, period_start, period_end)
    WHERE scope_type = 'employee' AND employee_id IS NOT NULL AND store_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS kpi_actual_employee_live_unique_idx
    ON ops.kpi_actual (kpi_id, employee_id, period_type, period_start, period_end)
    WHERE scope_type = 'employee' AND employee_id IS NOT NULL AND store_id IS NULL;

ALTER TABLE ops.company_daily_kpi_component_outcome
    ADD COLUMN IF NOT EXISTS return_attribution_version INTEGER NOT NULL DEFAULT 1
        CHECK (return_attribution_version IN (1, 2));

CREATE TABLE IF NOT EXISTS ops.company_daily_kpi_return (
    return_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_outcome_id UUID NOT NULL,
    business_date DATE NOT NULL,
    operation TEXT NOT NULL DEFAULT 'sales' CHECK (operation = 'sales'),
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    receiving_store_code TEXT NOT NULL CHECK (LENGTH(receiving_store_code) BETWEEN 1 AND 80),
    original_store_code TEXT CHECK (LENGTH(original_store_code) BETWEEN 1 AND 80),
    personnel_code TEXT CHECK (LENGTH(personnel_code) BETWEEN 1 AND 80),
    direction TEXT NOT NULL CHECK (direction IN ('received', 'external')),
    return_kind TEXT NOT NULL CHECK (return_kind IN ('same_store', 'cross_store', 'unresolved')),
    return_invoice_count INTEGER NOT NULL CHECK (return_invoice_count > 0),
    signed_return_quantity NUMERIC(38,12) NOT NULL CHECK (signed_return_quantity < 0),
    signed_return_amount_try NUMERIC(38,12) NOT NULL CHECK (signed_return_amount_try < 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_company_daily_return_component FOREIGN KEY (component_outcome_id, business_date, operation)
        REFERENCES ops.company_daily_kpi_component_outcome (component_outcome_id, business_date, operation) ON DELETE CASCADE,
    CONSTRAINT uq_company_daily_return_grain UNIQUE NULLS NOT DISTINCT
        (component_outcome_id, store_id, receiving_store_code, original_store_code, personnel_code, direction, return_kind),
    CHECK ((return_kind = 'unresolved' AND original_store_code IS NULL AND direction = 'received')
        OR (return_kind = 'same_store' AND original_store_code IS NOT NULL AND original_store_code = receiving_store_code AND direction = 'received')
        OR (return_kind = 'cross_store' AND original_store_code IS NOT NULL AND original_store_code <> receiving_store_code))
);
CREATE INDEX IF NOT EXISTS idx_company_daily_return_store_day
    ON ops.company_daily_kpi_return (store_id, business_date);
