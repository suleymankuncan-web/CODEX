BEGIN;
SET LOCAL lock_timeout = '5000ms';
SET LOCAL statement_timeout = '30000ms';
LOCK TABLE ops.store, ops.employee, stg.external_id_map, ops.master_identity_code_reservation
    IN ACCESS EXCLUSIVE MODE;
DO $rollback_guard$
BEGIN
    IF EXISTS (
        SELECT 1 FROM ops.master_identity_code_reservation
        WHERE origin = 'runtime' OR is_current = FALSE
    ) THEN
        RAISE EXCEPTION 'Migration 090 cannot be rolled back after master identity code history is in use';
    END IF;
END;
$rollback_guard$;
DROP TRIGGER IF EXISTS trg_employee_master_identity_code_sync ON ops.employee;
DROP TRIGGER IF EXISTS trg_store_master_identity_code_sync ON ops.store;
DROP TRIGGER IF EXISTS trg_employee_master_identity_company_guard ON ops.employee;
DROP TRIGGER IF EXISTS trg_store_master_identity_company_guard ON ops.store;
DROP TRIGGER IF EXISTS trg_external_id_master_code_guard ON stg.external_id_map;
DROP FUNCTION IF EXISTS ops.sync_employee_master_identity_code_v1();
DROP FUNCTION IF EXISTS ops.sync_store_master_identity_code_v1();
DROP FUNCTION IF EXISTS ops.prevent_master_identity_company_change_v1();
DROP FUNCTION IF EXISTS ops.sync_master_identity_code_v1(UUID, TEXT, UUID, TEXT, TEXT, TEXT, TEXT[]);
DROP FUNCTION IF EXISTS ops.guard_external_id_master_code_v1();
DROP TABLE IF EXISTS ops.master_identity_code_reservation;
DROP INDEX IF EXISTS stg.idx_external_id_map_entity_normalized;
ALTER TABLE ops.employee DROP CONSTRAINT IF EXISTS ck_master_identity_employee_code_nonempty;
ALTER TABLE ops.store DROP CONSTRAINT IF EXISTS ck_master_identity_store_code_nonempty;
DROP FUNCTION IF EXISTS ops.normalize_master_external_code_v1(TEXT);
DELETE FROM audit.schema_migration WHERE migration_name = '090_master_identity_code_reservation_v1.sql';
COMMIT;
