-- Only safe before ownership transitions have been recorded.
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM ops.store_ownership_transition LIMIT 1) THEN
        RAISE EXCEPTION 'Ownership history contains data; rollback requires manual reconciliation';
    END IF;
END $$;

DROP FUNCTION IF EXISTS ops.store_was_company_during(UUID, DATE, DATE);
DROP FUNCTION IF EXISTS ops.store_type_as_of(UUID, DATE);
DROP TABLE IF EXISTS ops.store_ownership_transition;
