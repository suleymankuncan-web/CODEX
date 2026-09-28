-- Operator prerequisite: pause ownership-transition and incentive-close writers.
BEGIN;
SET LOCAL lock_timeout = '5000ms';
SET LOCAL statement_timeout = '30000ms';

LOCK TABLE ops.store_ownership_transition, ops.store, ops.sales_target_incentive_close_run
    IN ACCESS EXCLUSIVE MODE;

DROP TRIGGER IF EXISTS trg_incentive_close_ownership_revision_guard ON ops.sales_target_incentive_close_run;
DROP TRIGGER IF EXISTS trg_store_type_direct_update_guard ON ops.store;
DROP TRIGGER IF EXISTS trg_store_ownership_transition_truncate_guard ON ops.store_ownership_transition;
DROP TRIGGER IF EXISTS trg_store_ownership_transition_immutable ON ops.store_ownership_transition;
DROP TRIGGER IF EXISTS trg_store_ownership_transition_commit_guard ON ops.store_ownership_transition;
DROP TRIGGER IF EXISTS trg_store_ownership_transition_close_guard ON ops.store_ownership_transition;

DROP FUNCTION IF EXISTS ops.guard_incentive_close_ownership_revision_v1();
DROP FUNCTION IF EXISTS ops.guard_store_type_direct_update_v1();
DROP FUNCTION IF EXISTS ops.prevent_store_ownership_transition_mutation_v1();
DROP FUNCTION IF EXISTS ops.verify_store_ownership_transition_commit_v1();
DROP FUNCTION IF EXISTS ops.guard_store_ownership_transition_v1();
DROP FUNCTION IF EXISTS ops.store_ownership_revision_v1(UUID);

DELETE FROM audit.schema_migration
WHERE migration_name = '089_store_ownership_close_concurrency_v1.sql';
COMMIT;
