BEGIN;

SET LOCAL lock_timeout = '5000ms';
SET LOCAL statement_timeout = '30000ms';

LOCK TABLE ops.company_daily_kpi_component_outcome IN ACCESS EXCLUSIVE MODE;
LOCK TABLE ops.company_daily_kpi_employee_sales IN ACCESS EXCLUSIVE MODE;
LOCK TABLE ops.company_daily_kpi_store_sales IN ACCESS EXCLUSIVE MODE;
LOCK TABLE ops.company_daily_kpi_store_footfall IN ACCESS EXCLUSIVE MODE;
LOCK TABLE ops.company_daily_kpi_store_gsm IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM ops.company_daily_kpi_component_outcome)
       OR EXISTS (SELECT 1 FROM ops.company_daily_kpi_employee_sales)
       OR EXISTS (SELECT 1 FROM ops.company_daily_kpi_store_sales)
       OR EXISTS (SELECT 1 FROM ops.company_daily_kpi_store_footfall)
       OR EXISTS (SELECT 1 FROM ops.company_daily_kpi_store_gsm) THEN
        RAISE EXCEPTION
            'Cannot roll back company daily KPI component storage: typed facts exist.'
            USING ERRCODE = '55000';
    END IF;
END;
$$;

DROP TABLE ops.company_daily_kpi_store_gsm;
DROP TABLE ops.company_daily_kpi_store_footfall;
DROP TABLE ops.company_daily_kpi_store_sales;
DROP TABLE ops.company_daily_kpi_employee_sales;
DROP TABLE ops.company_daily_kpi_component_outcome;

DELETE FROM audit.schema_migration
WHERE migration_name = '075_company_daily_kpi_component_storage_v1.sql';

COMMIT;
