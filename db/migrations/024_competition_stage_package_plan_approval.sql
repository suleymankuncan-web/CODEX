ALTER TABLE ops.competition_stage_package_plan
    ADD COLUMN IF NOT EXISTS submitted_by_user_id TEXT,
    ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reviewed_by_user_id TEXT,
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS review_note TEXT;

DO $$
DECLARE
    existing_constraint_name TEXT;
BEGIN
    SELECT constraint.conname
    INTO existing_constraint_name
    FROM pg_constraint constraint
    WHERE constraint.conrelid = 'ops.competition_stage_package_plan'::regclass
      AND constraint.contype = 'c'
      AND pg_get_constraintdef(constraint.oid) LIKE '%plan_status%'
    LIMIT 1;

    IF existing_constraint_name IS NOT NULL THEN
        EXECUTE format(
            'ALTER TABLE ops.competition_stage_package_plan DROP CONSTRAINT %I',
            existing_constraint_name
        );
    END IF;
END $$;

ALTER TABLE ops.competition_stage_package_plan
    ADD CONSTRAINT competition_stage_package_plan_status_check
    CHECK (plan_status IN ('draft', 'submitted', 'approved', 'rejected', 'executed', 'cancelled'));
