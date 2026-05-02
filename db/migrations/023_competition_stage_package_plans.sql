CREATE TABLE IF NOT EXISTS ops.competition_stage_package_plan (
    competition_stage_package_plan_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competition_id UUID NOT NULL REFERENCES ops.competition(competition_id) ON DELETE CASCADE,
    package_code TEXT NOT NULL,
    plan_name TEXT NOT NULL,
    plan_status TEXT NOT NULL DEFAULT 'draft',
    stage_drafts_json JSONB NOT NULL,
    created_by_user_id TEXT NOT NULL,
    updated_by_user_id TEXT NOT NULL,
    executed_by_user_id TEXT,
    executed_at TIMESTAMPTZ,
    created_stage_ids UUID[] NOT NULL DEFAULT ARRAY[]::uuid[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (package_code IN ('league_then_final')),
    CHECK (plan_status IN ('draft', 'executed', 'cancelled')),
    CHECK (jsonb_typeof(stage_drafts_json) = 'array')
);

CREATE INDEX IF NOT EXISTS competition_stage_package_plan_competition_idx
    ON ops.competition_stage_package_plan (competition_id, plan_status, updated_at DESC);
