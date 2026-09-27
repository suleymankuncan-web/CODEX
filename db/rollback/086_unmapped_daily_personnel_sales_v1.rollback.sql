DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM ops.company_daily_kpi_unmapped_personnel_sales) THEN
        RAISE EXCEPTION 'Preserve unmapped personnel return facts; rollback must not delete a populated table';
    END IF;
END $$;
DROP TABLE IF EXISTS ops.company_daily_kpi_unmapped_personnel_sales;
