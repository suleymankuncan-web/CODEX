SET LOCAL lock_timeout = '5000ms';
SET LOCAL statement_timeout = '30000ms';

CREATE TABLE IF NOT EXISTS ops.company_daily_kpi_component_outcome (
    component_outcome_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_source_id UUID NOT NULL REFERENCES stg.integration_source(integration_source_id),
    business_date DATE NOT NULL,
    operation TEXT NOT NULL,
    status TEXT NOT NULL,
    aggregate_count INTEGER NOT NULL,
    retry_count INTEGER NOT NULL,
    safe_reason_code TEXT,
    sanitized_set_digest CHAR(64),
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_company_daily_kpi_component_identity
        UNIQUE (integration_source_id, business_date, operation),
    CONSTRAINT uq_company_daily_kpi_component_fact_identity
        UNIQUE (component_outcome_id, business_date, operation),
    CONSTRAINT ck_company_daily_kpi_component_operation
        CHECK (operation IN ('sales', 'footfall', 'gsm')),
    CONSTRAINT ck_company_daily_kpi_component_status
        CHECK (status IN ('succeeded', 'failed', 'missed')),
    CONSTRAINT ck_company_daily_kpi_component_counts
        CHECK (aggregate_count >= 0 AND retry_count >= 0),
    CONSTRAINT ck_company_daily_kpi_component_reason
        CHECK (safe_reason_code IS NULL OR safe_reason_code ~ '^[a-z0-9_]{1,64}$'),
    CONSTRAINT ck_company_daily_kpi_component_digest
        CHECK (sanitized_set_digest IS NULL OR sanitized_set_digest ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_company_daily_kpi_component_outcome_shape CHECK (
        (
            status = 'succeeded'
            AND sanitized_set_digest IS NOT NULL
        )
        OR (
            status IN ('failed', 'missed')
            AND aggregate_count = 0
            AND sanitized_set_digest IS NULL
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_company_daily_kpi_component_range
    ON ops.company_daily_kpi_component_outcome (
        integration_source_id,
        operation,
        business_date
    );

CREATE TABLE IF NOT EXISTS ops.company_daily_kpi_employee_sales (
    employee_sales_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_outcome_id UUID NOT NULL,
    business_date DATE NOT NULL,
    operation TEXT NOT NULL DEFAULT 'sales',
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    employee_id UUID NOT NULL REFERENCES ops.employee(employee_id),
    sale_invoice_count INTEGER NOT NULL,
    return_invoice_count INTEGER NOT NULL,
    sale_quantity NUMERIC(38,12) NOT NULL,
    signed_return_quantity NUMERIC(38,12) NOT NULL,
    net_quantity NUMERIC(38,12) NOT NULL,
    sale_amount_try NUMERIC(38,12) NOT NULL,
    signed_return_amount_try NUMERIC(38,12) NOT NULL,
    net_amount_try NUMERIC(38,12) NOT NULL,
    currency_code CHAR(3) NOT NULL DEFAULT 'TRY',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_company_daily_kpi_employee_sales_grain
        UNIQUE (component_outcome_id, business_date, store_id, employee_id),
    CONSTRAINT fk_company_daily_kpi_employee_sales_component
        FOREIGN KEY (component_outcome_id, business_date, operation)
        REFERENCES ops.company_daily_kpi_component_outcome (
            component_outcome_id,
            business_date,
            operation
        ) ON DELETE CASCADE,
    CONSTRAINT ck_company_daily_kpi_employee_sales_operation CHECK (operation = 'sales'),
    CONSTRAINT ck_company_daily_kpi_employee_sales_counts
        CHECK (sale_invoice_count >= 0 AND return_invoice_count >= 0),
    CONSTRAINT ck_company_daily_kpi_employee_sales_signs
        CHECK (
            sale_quantity >= 0
            AND signed_return_quantity <= 0
            AND sale_amount_try >= 0
            AND signed_return_amount_try <= 0
        ),
    CONSTRAINT ck_company_daily_kpi_employee_sales_quantity_net
        CHECK (net_quantity = sale_quantity + signed_return_quantity),
    CONSTRAINT ck_company_daily_kpi_employee_sales_amount_net
        CHECK (net_amount_try = sale_amount_try + signed_return_amount_try),
    CONSTRAINT ck_company_daily_kpi_employee_sales_currency CHECK (currency_code = 'TRY')
);

CREATE INDEX IF NOT EXISTS idx_company_daily_kpi_employee_sales_store_day
    ON ops.company_daily_kpi_employee_sales (store_id, business_date);

CREATE INDEX IF NOT EXISTS idx_company_daily_kpi_employee_sales_employee_day
    ON ops.company_daily_kpi_employee_sales (employee_id, business_date);

CREATE TABLE IF NOT EXISTS ops.company_daily_kpi_store_sales (
    store_sales_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_outcome_id UUID NOT NULL,
    business_date DATE NOT NULL,
    operation TEXT NOT NULL DEFAULT 'sales',
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    sale_invoice_count INTEGER NOT NULL,
    return_invoice_count INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_company_daily_kpi_store_sales_grain
        UNIQUE (component_outcome_id, business_date, store_id),
    CONSTRAINT fk_company_daily_kpi_store_sales_component
        FOREIGN KEY (component_outcome_id, business_date, operation)
        REFERENCES ops.company_daily_kpi_component_outcome (
            component_outcome_id,
            business_date,
            operation
        ) ON DELETE CASCADE,
    CONSTRAINT ck_company_daily_kpi_store_sales_operation CHECK (operation = 'sales'),
    CONSTRAINT ck_company_daily_kpi_store_sales_counts
        CHECK (sale_invoice_count >= 0 AND return_invoice_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_company_daily_kpi_store_sales_store_day
    ON ops.company_daily_kpi_store_sales (store_id, business_date);

CREATE TABLE IF NOT EXISTS ops.company_daily_kpi_store_footfall (
    store_footfall_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_outcome_id UUID NOT NULL,
    business_date DATE NOT NULL,
    operation TEXT NOT NULL DEFAULT 'footfall',
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    footfall BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_company_daily_kpi_store_footfall_grain
        UNIQUE (component_outcome_id, business_date, store_id),
    CONSTRAINT fk_company_daily_kpi_store_footfall_component
        FOREIGN KEY (component_outcome_id, business_date, operation)
        REFERENCES ops.company_daily_kpi_component_outcome (
            component_outcome_id,
            business_date,
            operation
        ) ON DELETE CASCADE,
    CONSTRAINT ck_company_daily_kpi_store_footfall_operation CHECK (operation = 'footfall'),
    CONSTRAINT ck_company_daily_kpi_store_footfall_value CHECK (footfall >= 0)
);

CREATE INDEX IF NOT EXISTS idx_company_daily_kpi_store_footfall_store_day
    ON ops.company_daily_kpi_store_footfall (store_id, business_date);

CREATE TABLE IF NOT EXISTS ops.company_daily_kpi_store_gsm (
    store_gsm_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_outcome_id UUID NOT NULL,
    business_date DATE NOT NULL,
    operation TEXT NOT NULL DEFAULT 'gsm',
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    yes_customer_count BIGINT NOT NULL,
    total_customer_count BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_company_daily_kpi_store_gsm_grain
        UNIQUE (component_outcome_id, business_date, store_id),
    CONSTRAINT fk_company_daily_kpi_store_gsm_component
        FOREIGN KEY (component_outcome_id, business_date, operation)
        REFERENCES ops.company_daily_kpi_component_outcome (
            component_outcome_id,
            business_date,
            operation
        ) ON DELETE CASCADE,
    CONSTRAINT ck_company_daily_kpi_store_gsm_operation CHECK (operation = 'gsm'),
    CONSTRAINT ck_company_daily_kpi_store_gsm_counts
        CHECK (
            yes_customer_count >= 0
            AND total_customer_count >= 0
            AND yes_customer_count <= total_customer_count
        )
);

CREATE INDEX IF NOT EXISTS idx_company_daily_kpi_store_gsm_store_day
    ON ops.company_daily_kpi_store_gsm (store_id, business_date);
