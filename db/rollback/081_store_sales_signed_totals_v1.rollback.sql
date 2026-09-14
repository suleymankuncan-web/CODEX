BEGIN;

ALTER TABLE ops.company_daily_kpi_store_sales
    DROP CONSTRAINT IF EXISTS ck_company_daily_kpi_store_sales_signed_totals,
    DROP COLUMN IF EXISTS net_amount_try,
    DROP COLUMN IF EXISTS signed_return_amount_try,
    DROP COLUMN IF EXISTS sale_amount_try,
    DROP COLUMN IF EXISTS net_quantity,
    DROP COLUMN IF EXISTS signed_return_quantity,
    DROP COLUMN IF EXISTS sale_quantity;

DELETE FROM audit.schema_migration
WHERE version = '081_store_sales_signed_totals_v1';

COMMIT;
