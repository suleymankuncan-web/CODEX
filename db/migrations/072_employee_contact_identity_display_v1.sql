ALTER TABLE ops.employee
    ADD COLUMN IF NOT EXISTS national_id_last4 TEXT,
    ADD COLUMN IF NOT EXISTS phone_number TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'employee_national_id_last4_format_check'
          AND conrelid = 'ops.employee'::regclass
    ) THEN
        ALTER TABLE ops.employee
            ADD CONSTRAINT employee_national_id_last4_format_check
            CHECK (national_id_last4 IS NULL OR national_id_last4 ~ '^[0-9]{4}$');
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'employee_phone_number_format_check'
          AND conrelid = 'ops.employee'::regclass
    ) THEN
        ALTER TABLE ops.employee
            ADD CONSTRAINT employee_phone_number_format_check
            CHECK (phone_number IS NULL OR phone_number ~ '^[0-9+() -]{10,20}$');
    END IF;
END
$$;

COMMENT ON COLUMN ops.employee.national_id_last4 IS
    'Display-only suffix for masked national identity. Raw national identity is never stored.';
COMMENT ON COLUMN ops.employee.phone_number IS
    'Personnel contact phone captured by authorized workforce administration flows.';

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM ops.employee
        WHERE national_id_hash IS NOT NULL
        GROUP BY company_id, national_id_hash
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Cannot enforce employee national identity uniqueness: duplicate company/hash rows exist';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM ops.employee
        WHERE NULLIF(BTRIM(external_employee_ref), '') IS NOT NULL
        GROUP BY company_id, UPPER(BTRIM(external_employee_ref))
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Cannot enforce employee reference uniqueness: duplicate company/reference rows exist';
    END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_employee_company_national_id_hash
    ON ops.employee (company_id, national_id_hash)
    WHERE national_id_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_employee_company_external_ref
    ON ops.employee (company_id, UPPER(BTRIM(external_employee_ref)))
    WHERE NULLIF(BTRIM(external_employee_ref), '') IS NOT NULL;
