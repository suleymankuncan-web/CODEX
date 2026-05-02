ALTER TABLE ops.seller_code_request
    ADD COLUMN IF NOT EXISTS national_id_hash TEXT,
    ADD COLUMN IF NOT EXISTS national_id_last4 TEXT,
    ADD COLUMN IF NOT EXISTS phone_number TEXT,
    ADD COLUMN IF NOT EXISTS requested_hire_date DATE;

UPDATE ops.seller_code_request
SET
    national_id_hash = COALESCE(national_id_hash, 'legacy_missing'),
    national_id_last4 = COALESCE(national_id_last4, '0000'),
    phone_number = COALESCE(phone_number, 'legacy_missing'),
    requested_hire_date = COALESCE(requested_hire_date, CURRENT_DATE);

ALTER TABLE ops.seller_code_request
    ALTER COLUMN national_id_hash SET NOT NULL,
    ALTER COLUMN national_id_last4 SET NOT NULL,
    ALTER COLUMN phone_number SET NOT NULL,
    ALTER COLUMN requested_hire_date SET NOT NULL;
