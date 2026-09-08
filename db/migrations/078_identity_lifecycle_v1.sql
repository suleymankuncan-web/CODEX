ALTER TABLE ops.seller_code_request
  ADD COLUMN IF NOT EXISTS requested_username TEXT,
  ADD COLUMN IF NOT EXISTS requested_email TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'seller_code_request_identity_check'
      AND conrelid = 'ops.seller_code_request'::regclass
  ) THEN
    ALTER TABLE ops.seller_code_request
      ADD CONSTRAINT seller_code_request_identity_check CHECK (
        (requested_username IS NULL AND requested_email IS NULL)
        OR (NULLIF(BTRIM(requested_username), '') IS NOT NULL AND NULLIF(BTRIM(requested_email), '') IS NOT NULL)
      );
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_seller_code_request_open_username_unique
  ON ops.seller_code_request (LOWER(requested_username))
  WHERE requested_username IS NOT NULL AND request_status IN ('pending_hr_approval', 'approved');

CREATE UNIQUE INDEX IF NOT EXISTS idx_seller_code_request_open_email_unique
  ON ops.seller_code_request (LOWER(requested_email))
  WHERE requested_email IS NOT NULL AND request_status IN ('pending_hr_approval', 'approved');

CREATE TABLE IF NOT EXISTS ops.identity_lifecycle_job (
  identity_lifecycle_job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES ops.user_account(user_id) ON DELETE CASCADE,
  operation TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  idempotency_key TEXT NOT NULL UNIQUE,
  requested_by_user_id TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  claimed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT identity_lifecycle_job_operation_check CHECK (operation IN ('provision', 'enable', 'disable')),
  CONSTRAINT identity_lifecycle_job_status_check CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  CONSTRAINT identity_lifecycle_job_attempts_check CHECK (attempts >= 0)
);

CREATE INDEX IF NOT EXISTS idx_identity_lifecycle_job_dispatch
  ON ops.identity_lifecycle_job (status, available_at, created_at)
  WHERE status IN ('pending', 'processing');

CREATE UNIQUE INDEX IF NOT EXISTS idx_identity_lifecycle_job_user_active_operation
  ON ops.identity_lifecycle_job (user_id, operation)
  WHERE status IN ('pending', 'processing');
