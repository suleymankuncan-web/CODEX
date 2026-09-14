ALTER TABLE ops.company_daily_kpi_store_sales
    ADD COLUMN IF NOT EXISTS sale_quantity NUMERIC(38,12),
    ADD COLUMN IF NOT EXISTS signed_return_quantity NUMERIC(38,12),
    ADD COLUMN IF NOT EXISTS net_quantity NUMERIC(38,12),
    ADD COLUMN IF NOT EXISTS sale_amount_try NUMERIC(38,12),
    ADD COLUMN IF NOT EXISTS signed_return_amount_try NUMERIC(38,12),
    ADD COLUMN IF NOT EXISTS net_amount_try NUMERIC(38,12);

WITH employee_totals AS (
    SELECT
        component_outcome_id,
        business_date,
        store_id,
        SUM(sale_quantity) AS sale_quantity,
        SUM(signed_return_quantity) AS signed_return_quantity,
        SUM(net_quantity) AS net_quantity,
        SUM(sale_amount_try) AS sale_amount_try,
        SUM(signed_return_amount_try) AS signed_return_amount_try,
        SUM(net_amount_try) AS net_amount_try
    FROM ops.company_daily_kpi_employee_sales
    GROUP BY component_outcome_id, business_date, store_id
)
UPDATE ops.company_daily_kpi_store_sales store_sales
SET
    sale_quantity = COALESCE(employee_totals.sale_quantity, 0),
    signed_return_quantity = COALESCE(employee_totals.signed_return_quantity, 0),
    net_quantity = COALESCE(employee_totals.net_quantity, 0),
    sale_amount_try = COALESCE(employee_totals.sale_amount_try, 0),
    signed_return_amount_try = COALESCE(employee_totals.signed_return_amount_try, 0),
    net_amount_try = COALESCE(employee_totals.net_amount_try, 0)
FROM employee_totals
WHERE employee_totals.component_outcome_id = store_sales.component_outcome_id
  AND employee_totals.business_date = store_sales.business_date
  AND employee_totals.store_id = store_sales.store_id;

UPDATE ops.company_daily_kpi_store_sales
SET
    sale_quantity = COALESCE(sale_quantity, 0),
    signed_return_quantity = COALESCE(signed_return_quantity, 0),
    net_quantity = COALESCE(net_quantity, 0),
    sale_amount_try = COALESCE(sale_amount_try, 0),
    signed_return_amount_try = COALESCE(signed_return_amount_try, 0),
    net_amount_try = COALESCE(net_amount_try, 0)
WHERE sale_quantity IS NULL
   OR signed_return_quantity IS NULL
   OR net_quantity IS NULL
   OR sale_amount_try IS NULL
   OR signed_return_amount_try IS NULL
   OR net_amount_try IS NULL;

ALTER TABLE ops.company_daily_kpi_store_sales
    ALTER COLUMN sale_quantity SET NOT NULL,
    ALTER COLUMN signed_return_quantity SET NOT NULL,
    ALTER COLUMN net_quantity SET NOT NULL,
    ALTER COLUMN sale_amount_try SET NOT NULL,
    ALTER COLUMN signed_return_amount_try SET NOT NULL,
    ALTER COLUMN net_amount_try SET NOT NULL,
    DROP CONSTRAINT IF EXISTS ck_company_daily_kpi_store_sales_signed_totals,
    ADD CONSTRAINT ck_company_daily_kpi_store_sales_signed_totals CHECK (
        sale_quantity >= 0
        AND signed_return_quantity <= 0
        AND net_quantity = sale_quantity + signed_return_quantity
        AND sale_amount_try >= 0
        AND signed_return_amount_try <= 0
        AND net_amount_try = sale_amount_try + signed_return_amount_try
    );

COMMENT ON COLUMN ops.company_daily_kpi_store_sales.net_amount_try IS
    'Store-day net sales including returns even when a return has no personnel code.';
