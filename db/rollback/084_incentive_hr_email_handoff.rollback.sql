DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM ops.incentive_hr_delivery) THEN
        RAISE EXCEPTION 'Preserve HR delivery audit receipts; rollback must not delete a populated table';
    END IF;
END $$;
DROP TABLE IF EXISTS ops.incentive_hr_delivery;
