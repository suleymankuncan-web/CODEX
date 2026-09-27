SET LOCAL lock_timeout = '5000ms';
SET LOCAL statement_timeout = '30000ms';

-- A return from a person absent from master data belongs to the store's
-- already-recorded total, but must not create an employee or assignment.
CREATE TABLE IF NOT EXISTS ops.company_daily_kpi_unmapped_personnel_sales (
    unmapped_personnel_sales_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_outcome_id UUID NOT NULL,
    business_date DATE NOT NULL,
    operation TEXT NOT NULL DEFAULT 'sales',
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    personnel_code TEXT NOT NULL,
    sale_invoice_count INTEGER NOT NULL,
    return_invoice_count INTEGER NOT NULL,
    sale_quantity NUMERIC(38,12) NOT NULL,
    signed_return_quantity NUMERIC(38,12) NOT NULL,
    net_quantity NUMERIC(38,12) NOT NULL,
    sale_amount_try NUMERIC(38,12) NOT NULL,
    signed_return_amount_try NUMERIC(38,12) NOT NULL,
    net_amount_try NUMERIC(38,12) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_company_daily_kpi_unmapped_personnel_sales_grain
        UNIQUE (component_outcome_id, business_date, store_id, personnel_code),
    CONSTRAINT fk_company_daily_kpi_unmapped_personnel_sales_component
        FOREIGN KEY (component_outcome_id, business_date, operation)
        REFERENCES ops.company_daily_kpi_component_outcome (
            component_outcome_id, business_date, operation
        ) ON DELETE CASCADE,
    CONSTRAINT ck_company_daily_kpi_unmapped_personnel_sales_operation CHECK (operation = 'sales'),
    CONSTRAINT ck_company_daily_kpi_unmapped_personnel_sales_code
        CHECK (length(btrim(personnel_code)) BETWEEN 1 AND 80),
    CONSTRAINT ck_company_daily_kpi_unmapped_personnel_sales_counts
        CHECK (sale_invoice_count >= 0 AND return_invoice_count >= 0),
    CONSTRAINT ck_company_daily_kpi_unmapped_personnel_sales_signs
        CHECK (sale_quantity >= 0 AND signed_return_quantity <= 0
            AND sale_amount_try >= 0 AND signed_return_amount_try <= 0),
    CONSTRAINT ck_company_daily_kpi_unmapped_personnel_sales_quantity_net
        CHECK (net_quantity = sale_quantity + signed_return_quantity),
    CONSTRAINT ck_company_daily_kpi_unmapped_personnel_sales_amount_net
        CHECK (net_amount_try = sale_amount_try + signed_return_amount_try)
);

CREATE INDEX IF NOT EXISTS idx_company_daily_kpi_unmapped_personnel_sales_store_day
    ON ops.company_daily_kpi_unmapped_personnel_sales (store_id, business_date);
