DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM ops.no_positive_sales_alert_delivery) THEN
        RAISE EXCEPTION 'Preserve no-sale alert delivery audit; rollback must not delete populated table';
    END IF;
END $$;
DROP TABLE IF EXISTS ops.no_positive_sales_alert_delivery;
