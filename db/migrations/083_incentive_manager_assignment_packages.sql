-- Keep previously submitted region packages intact as historical evidence.
-- New packages are owned by the assigned manager; region_id remains only on
-- historical packages and on each store's geographic snapshot.
ALTER TABLE ops.sales_target_incentive_region_package
    ADD COLUMN IF NOT EXISTS package_scope TEXT NOT NULL DEFAULT 'legacy_region',
    ADD COLUMN IF NOT EXISTS manager_user_id UUID REFERENCES ops.user_account(user_id);

ALTER TABLE ops.sales_target_incentive_region_package
    ALTER COLUMN region_id DROP NOT NULL;

ALTER TABLE ops.sales_target_incentive_region_package
    ADD CONSTRAINT sti_package_scope_owner_check
    CHECK (
        (package_scope = 'legacy_region' AND region_id IS NOT NULL AND manager_user_id IS NULL)
        OR (package_scope = 'manager_assignment' AND region_id IS NULL AND manager_user_id IS NOT NULL)
    );

DROP INDEX IF EXISTS ops.idx_sti_region_package_region_period;

CREATE UNIQUE INDEX idx_sti_legacy_region_package_period
    ON ops.sales_target_incentive_region_package (region_id, period_key)
    WHERE package_scope = 'legacy_region';

CREATE UNIQUE INDEX idx_sti_manager_package_company_period
    ON ops.sales_target_incentive_region_package (company_id, period_key, manager_user_id)
    WHERE package_scope = 'manager_assignment';

CREATE INDEX idx_sti_manager_package_owner_period
    ON ops.sales_target_incentive_region_package (manager_user_id, period_key)
    WHERE package_scope = 'manager_assignment';

COMMENT ON COLUMN ops.sales_target_incentive_region_package.package_scope IS
    'Legacy region submissions remain immutable history; new packages use manager assignments.';
COMMENT ON COLUMN ops.sales_target_incentive_region_package.manager_user_id IS
    'Owner of an assignment-scoped incentive package, independent of store region_id.';
