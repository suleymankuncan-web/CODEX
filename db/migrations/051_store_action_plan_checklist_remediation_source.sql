DO $$
DECLARE
    source_type_constraint_name TEXT;
BEGIN
    SELECT constraint_candidate.conname
    INTO source_type_constraint_name
    FROM pg_constraint constraint_candidate
    INNER JOIN pg_class table_candidate
        ON table_candidate.oid = constraint_candidate.conrelid
    INNER JOIN pg_namespace schema_candidate
        ON schema_candidate.oid = table_candidate.relnamespace
    WHERE schema_candidate.nspname = 'ops'
      AND table_candidate.relname = 'store_action_plan'
      AND constraint_candidate.contype = 'c'
      AND pg_get_constraintdef(constraint_candidate.oid) LIKE '%source_type%'
    ORDER BY constraint_candidate.conname
    LIMIT 1;

    IF source_type_constraint_name IS NOT NULL THEN
        EXECUTE format(
            'ALTER TABLE ops.store_action_plan DROP CONSTRAINT %I',
            source_type_constraint_name
        );
    END IF;
END $$;

ALTER TABLE ops.store_action_plan
    ADD CONSTRAINT store_action_plan_source_type_check
    CHECK (source_type IN ('kpi_exception', 'checklist_remediation'));
