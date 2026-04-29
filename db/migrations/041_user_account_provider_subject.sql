ALTER TABLE ops.user_account
    ADD COLUMN IF NOT EXISTS provider_subject TEXT,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_account_auth_provider_subject
    ON ops.user_account (auth_provider, provider_subject)
    WHERE provider_subject IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_account_employee_active
    ON ops.user_account (employee_id, is_active);
