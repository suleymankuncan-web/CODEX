BEGIN;
SET LOCAL lock_timeout = '5000ms';
SET LOCAL statement_timeout = '30000ms';
DO $rollback_guard$
BEGIN
    IF to_regclass('ops.user_permission_assignment') IS NOT NULL THEN
        EXECUTE 'LOCK TABLE ops.user_permission_assignment IN ACCESS EXCLUSIVE MODE';
        IF EXISTS (SELECT 1 FROM ops.user_permission_assignment) THEN
            RAISE EXCEPTION 'Migration 092 cannot be rolled back after user capability grants exist';
        END IF;
    END IF;
END;
$rollback_guard$;
DROP TRIGGER IF EXISTS trg_role_permission_capability_guard ON ops.role_permission;
DROP TRIGGER IF EXISTS trg_super_role_assignment_capability_guard ON ops.user_role_assignment;
DROP TRIGGER IF EXISTS trg_legacy_incentive_approval_guard ON ops.user_role_assignment;
DROP FUNCTION IF EXISTS ops.guard_role_permission_capability_v1();
DROP FUNCTION IF EXISTS ops.guard_super_role_assignment_capabilities_v1();
DROP FUNCTION IF EXISTS ops.guard_legacy_incentive_approval_v1();
DROP TABLE IF EXISTS ops.user_permission_assignment;
DROP FUNCTION IF EXISTS ops.guard_user_permission_revocation_v1();
DROP FUNCTION IF EXISTS ops.guard_user_permission_assignment_v1();
DELETE FROM ops.permission WHERE permission_code = ANY(ARRAY[
    'INCENTIVE_SALES_DIRECTOR_APPROVAL','INCENTIVE_HR_APPROVAL',
    'INCENTIVE_GENERAL_MANAGER_APPROVAL','INCENTIVE_PAYROLL_DELIVERY'
]::text[]);
DELETE FROM audit.schema_migration WHERE migration_name = '092_user_permission_assignment_v1.sql';
COMMIT;
