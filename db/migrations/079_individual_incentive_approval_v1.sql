-- Opt-in permission on one company-scoped Report Viewer assignment; no automatic grants.
ALTER TABLE ops.user_role_assignment
    ADD COLUMN IF NOT EXISTS incentive_approval BOOLEAN NOT NULL DEFAULT FALSE;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'user_role_assignment_incentive_company_check'
          AND conrelid = 'ops.user_role_assignment'::regclass
    ) THEN
        ALTER TABLE ops.user_role_assignment
            ADD CONSTRAINT user_role_assignment_incentive_company_check
            CHECK (NOT incentive_approval OR (scope_type = 'company' AND company_id IS NOT NULL));
    END IF;
END
$$;
