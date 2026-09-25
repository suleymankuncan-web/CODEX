ALTER TABLE ops.user_account
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'ops.user_account'::regclass
      AND conname = 'user_account_profile_names_pair_check'
  ) THEN
    ALTER TABLE ops.user_account
      ADD CONSTRAINT user_account_profile_names_pair_check
      CHECK (
        (first_name IS NULL AND last_name IS NULL)
        OR (
          NULLIF(BTRIM(first_name), '') IS NOT NULL
          AND NULLIF(BTRIM(last_name), '') IS NOT NULL
        )
      );
  END IF;
END $$;
