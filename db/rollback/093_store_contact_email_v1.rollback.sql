BEGIN;
SET LOCAL lock_timeout = '5000ms';
SET LOCAL statement_timeout = '30000ms';
DO $rollback_guard$
BEGIN
    IF to_regclass('ops.store_contact_email') IS NOT NULL THEN
        EXECUTE 'LOCK TABLE ops.store_contact_email IN ACCESS EXCLUSIVE MODE';
        IF EXISTS (SELECT 1 FROM ops.store_contact_email) THEN
            RAISE EXCEPTION 'Migration 093 cannot be rolled back after store contact emails exist';
        END IF;
    END IF;
END;
$rollback_guard$;
DROP TABLE IF EXISTS ops.store_contact_email;
DROP INDEX IF EXISTS stg.idx_external_id_map_internal_entity_active;
DROP FUNCTION IF EXISTS ops.guard_store_contact_email_company_v1();
DROP FUNCTION IF EXISTS ops.verify_store_contact_email_primary_v1();
DELETE FROM audit.schema_migration WHERE migration_name = '093_store_contact_email_v1.sql';
COMMIT;
