ALTER TABLE ops.user_account
  ADD COLUMN IF NOT EXISTS deactivation_reason TEXT,
  ADD COLUMN IF NOT EXISTS deactivated_by_user_id UUID REFERENCES ops.user_account(user_id);

CREATE INDEX IF NOT EXISTS idx_user_account_active_employee
  ON ops.user_account (is_active, employee_id);
