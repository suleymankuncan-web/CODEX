UPDATE ops.store
SET store_type = 'company'
WHERE store_type NOT IN ('company', 'franchise', 'operator');

ALTER TABLE ops.store
    DROP CONSTRAINT IF EXISTS ops_store_store_type_allowed_check;

ALTER TABLE ops.store
    ADD CONSTRAINT ops_store_store_type_allowed_check
    CHECK (store_type IN ('company', 'franchise', 'operator'));

ALTER TABLE ops.store
    DROP CONSTRAINT IF EXISTS ops_store_status_allowed_check;

ALTER TABLE ops.store
    ADD CONSTRAINT ops_store_status_allowed_check
    CHECK (status IN ('active', 'inactive', 'closed'));
