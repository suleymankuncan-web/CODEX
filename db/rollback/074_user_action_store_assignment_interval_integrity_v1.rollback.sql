BEGIN;

SET LOCAL lock_timeout = '5000ms';
SET LOCAL statement_timeout = '30000ms';

ALTER TABLE ops.user_action_store_assignment
    DROP CONSTRAINT IF EXISTS ex_user_action_store_assignment_no_overlap_v1;

DELETE FROM audit.schema_migration
WHERE migration_name = '074_user_action_store_assignment_interval_integrity_v1.sql';

COMMIT;
