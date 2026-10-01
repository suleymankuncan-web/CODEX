BEGIN;

ALTER TABLE ops.user_account ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;
ALTER TABLE ops.identity_lifecycle_job DROP CONSTRAINT IF EXISTS identity_lifecycle_job_operation_check;
ALTER TABLE ops.identity_lifecycle_job ADD CONSTRAINT identity_lifecycle_job_operation_check
    CHECK (operation IN ('provision', 'enable', 'disable', 'update_profile', 'password_link'));

CREATE TABLE IF NOT EXISTS ops.account_security_snapshot (
    user_id UUID PRIMARY KEY REFERENCES ops.user_account(user_id) ON DELETE CASCADE,
    provider_subject TEXT NOT NULL,
    email TEXT NOT NULL,
    password_state TEXT NOT NULL DEFAULT 'unknown' CHECK (password_state IN ('unknown', 'absent', 'present')),
    password_set_at TIMESTAMPTZ,
    observed_at TIMESTAMPTZ,
    observation_id UUID,
    lease_until TIMESTAMPTZ,
    next_observation_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ops.password_link_request (
    request_id UUID PRIMARY KEY,
    request_sequence BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
    user_id UUID NOT NULL REFERENCES ops.user_account(user_id) ON DELETE CASCADE,
    job_id UUID NOT NULL UNIQUE REFERENCES ops.identity_lifecycle_job(identity_lifecycle_job_id),
    provider_subject TEXT NOT NULL,
    email TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('setup', 'reset')),
    state TEXT NOT NULL DEFAULT 'queued' CHECK (state IN ('queued', 'sending', 'sent', 'failed', 'unconfirmed', 'completed')),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    send_started_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    tracking_expires_at TIMESTAMPTZ,
    baseline_state TEXT CHECK (baseline_state IN ('unknown', 'absent', 'present')),
    baseline_password_set_at TIMESTAMPTZ,
    completed_observed_at TIMESTAMPTZ,
    verified_password_set_at TIMESTAMPTZ,
    error_code TEXT CHECK (error_code IS NULL OR error_code IN ('account_changed', 'provider_rejected', 'send_unconfirmed', 'observation_unavailable'))
);
CREATE INDEX IF NOT EXISTS idx_password_link_request_user
    ON ops.password_link_request (user_id, request_sequence DESC);
CREATE INDEX IF NOT EXISTS idx_account_security_observation
    ON ops.account_security_snapshot (next_observation_at, lease_until);

COMMIT;
