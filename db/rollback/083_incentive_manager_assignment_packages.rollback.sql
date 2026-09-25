-- A rollback cannot discard submitted manager packages or their approval evidence.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM ops.sales_target_incentive_region_package
        WHERE package_scope = 'manager_assignment'
    ) THEN
        RAISE EXCEPTION 'Manager assignment packages exist; rollback requires an audited data migration';
    END IF;
END
$$;

DROP INDEX IF EXISTS ops.idx_sti_manager_package_owner_period;
DROP INDEX IF EXISTS ops.idx_sti_manager_package_company_period;
DROP INDEX IF EXISTS ops.idx_sti_legacy_region_package_period;

ALTER TABLE ops.sales_target_incentive_region_package
    DROP CONSTRAINT IF EXISTS sti_package_scope_owner_check,
    DROP COLUMN IF EXISTS manager_user_id,
    DROP COLUMN IF EXISTS package_scope;

ALTER TABLE ops.sales_target_incentive_region_package
    ALTER COLUMN region_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sti_region_package_region_period
    ON ops.sales_target_incentive_region_package (region_id, period_key);
