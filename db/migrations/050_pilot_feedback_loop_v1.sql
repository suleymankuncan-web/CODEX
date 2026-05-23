CREATE TABLE IF NOT EXISTS ops.pilot_feedback (
    pilot_feedback_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    actor_role_codes TEXT[] NOT NULL DEFAULT '{}'::text[],
    feedback_type TEXT NOT NULL,
    severity_suggestion TEXT NOT NULL,
    route_path TEXT NOT NULL,
    page_title TEXT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new',
    classification TEXT,
    classified_by_user_id UUID REFERENCES ops.user_account(user_id),
    classified_at TIMESTAMPTZ,
    classification_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (feedback_type IN ('bug', 'friction', 'idea', 'data_quality', 'other')),
    CHECK (severity_suggestion IN ('p0', 'p1', 'p2', 'p3')),
    CHECK (status IN ('new', 'triaged', 'parked', 'resolved')),
    CHECK (classification IS NULL OR classification IN ('p0_stop', 'p1_pilot_blocker', 'p2_pilot_friction', 'p3_backlog')),
    CHECK (status <> 'triaged' OR classification IS NOT NULL),
    CHECK (classified_at IS NULL OR classified_by_user_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_pilot_feedback_status_created
    ON ops.pilot_feedback (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pilot_feedback_classification_created
    ON ops.pilot_feedback (classification, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pilot_feedback_actor_created
    ON ops.pilot_feedback (actor_user_id, created_at DESC);

COMMENT ON TABLE ops.pilot_feedback IS 'Controlled pilot feedback intake for classifying P0/P1/P2/P3 findings without changing pilot go/no-go semantics.';
