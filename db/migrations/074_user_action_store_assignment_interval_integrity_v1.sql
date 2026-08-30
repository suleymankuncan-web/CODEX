SET LOCAL lock_timeout = '5000ms';
SET LOCAL statement_timeout = '30000ms';

LOCK TABLE ops.user_action_store_assignment IN SHARE MODE;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM ops.user_action_store_assignment left_assignment
        INNER JOIN ops.user_action_store_assignment right_assignment
            ON left_assignment.user_action_store_assignment_id
                < right_assignment.user_action_store_assignment_id
           AND left_assignment.user_id = right_assignment.user_id
           AND left_assignment.store_id = right_assignment.store_id
           AND tstzrange(
                left_assignment.start_at,
                left_assignment.end_at,
                '[)'
           ) && tstzrange(
                right_assignment.start_at,
                right_assignment.end_at,
                '[)'
           )
    ) THEN
        RAISE EXCEPTION
            'Cannot enforce user action store assignment interval integrity: overlapping intervals exist.'
            USING ERRCODE = '23514';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'ops'
          AND tablename = 'user_action_store_assignment'
          AND indexname = 'uq_user_action_store_assignment_active'
    ) THEN
        RAISE EXCEPTION
            'Cannot enforce user action store assignment interval integrity: legacy active index is missing.'
            USING ERRCODE = '42704';
    END IF;
END;
$$;

CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
DECLARE
    existing_constraint_kind "char";
    existing_constraint_definition TEXT;
BEGIN
    SELECT con.contype, pg_get_constraintdef(con.oid)
      INTO existing_constraint_kind, existing_constraint_definition
      FROM pg_constraint con
     WHERE con.conrelid = 'ops.user_action_store_assignment'::regclass
       AND con.conname = 'ex_user_action_store_assignment_no_overlap_v1';

    IF existing_constraint_kind IS NULL THEN
        ALTER TABLE ops.user_action_store_assignment
            ADD CONSTRAINT ex_user_action_store_assignment_no_overlap_v1
            EXCLUDE USING gist (
                user_id WITH =,
                store_id WITH =,
                tstzrange(start_at, end_at, '[)') WITH &&
            );
    ELSIF existing_constraint_kind <> 'x'
       OR regexp_replace(
            regexp_replace(existing_constraint_definition, '::text', '', 'g'),
            '\\s+',
            ' ',
            'g'
          ) <> 'EXCLUDE USING gist (user_id WITH =, store_id WITH =, tstzrange(start_at, end_at, ''[)'') WITH &&)' THEN
        RAISE EXCEPTION
            'Cannot enforce user action store assignment interval integrity: constraint identity conflicts.'
            USING ERRCODE = '42710';
    END IF;
END;
$$;
