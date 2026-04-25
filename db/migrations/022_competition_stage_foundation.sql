INSERT INTO ops.role (role_id, role_code, role_name, role_scope_type, description, is_system_role)
VALUES
    ('60000000-0000-0000-0000-000000000009', 'HR_ADMIN', 'HR Admin', 'company', 'Manages HR owned competitions and score review workflows', TRUE)
ON CONFLICT (role_code) DO UPDATE
SET
    role_name = EXCLUDED.role_name,
    role_scope_type = EXCLUDED.role_scope_type,
    description = EXCLUDED.description,
    is_system_role = EXCLUDED.is_system_role;

INSERT INTO ops.permission (permission_id, permission_code, resource_name, action_name, description)
VALUES
    ('70000000-0000-0000-0000-000000000013', 'competition.read', 'competition', 'read', 'Read competition standings and stage results'),
    ('70000000-0000-0000-0000-000000000014', 'competition.manage', 'competition', 'manage', 'Create, recalculate, and finalize competitions')
ON CONFLICT (permission_code) DO UPDATE
SET
    resource_name = EXCLUDED.resource_name,
    action_name = EXCLUDED.action_name,
    description = EXCLUDED.description;

WITH grants(role_code, permission_code) AS (
    VALUES
        ('SUPER_ADMIN', 'competition.read'),
        ('SUPER_ADMIN', 'competition.manage'),
        ('HR_ADMIN', 'competition.read'),
        ('HR_ADMIN', 'competition.manage'),
        ('REPORT_VIEWER', 'competition.read'),
        ('REGION_MANAGER', 'competition.read'),
        ('STORE_MANAGER', 'competition.read'),
        ('STORE_PERSONNEL', 'competition.read')
)
INSERT INTO ops.role_permission (role_id, permission_id)
SELECT role.role_id, permission.permission_id
FROM grants
INNER JOIN ops.role role
    ON role.role_code = grants.role_code
INNER JOIN ops.permission permission
    ON permission.permission_code = grants.permission_code
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS ops.competition (
    competition_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competition_code TEXT NOT NULL UNIQUE,
    competition_name TEXT NOT NULL,
    description TEXT,
    competition_type TEXT NOT NULL,
    lifecycle_state TEXT NOT NULL DEFAULT 'draft',
    owner_user_id TEXT NOT NULL,
    starts_on DATE NOT NULL,
    ends_on DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (competition_type IN ('region_challenge', 'region_league', 'campaign')),
    CHECK (lifecycle_state IN ('draft', 'published', 'active', 'completed', 'cancelled')),
    CHECK (ends_on >= starts_on)
);

CREATE TABLE IF NOT EXISTS ops.competition_stage (
    competition_stage_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competition_id UUID NOT NULL REFERENCES ops.competition(competition_id) ON DELETE CASCADE,
    stage_code TEXT NOT NULL,
    stage_name TEXT NOT NULL,
    stage_order INTEGER NOT NULL,
    stage_type TEXT NOT NULL,
    starts_on DATE NOT NULL,
    ends_on DATE NOT NULL,
    lifecycle_state TEXT NOT NULL DEFAULT 'draft',
    score_rule TEXT NOT NULL DEFAULT 'average_daily_store_score',
    advancement_rule_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    finalized_by_user_id TEXT,
    finalized_at TIMESTAMPTZ,
    finalization_state TEXT,
    finalization_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (competition_id, stage_code),
    UNIQUE (competition_id, stage_order),
    CHECK (stage_type IN ('qualifier', 'league', 'quarter_final', 'semi_final', 'final', 'custom')),
    CHECK (lifecycle_state IN ('draft', 'scheduled', 'active', 'awaiting_review', 'finalized', 'cancelled')),
    CHECK (score_rule = 'average_daily_store_score'),
    CHECK (finalization_state IS NULL OR finalization_state IN ('clean', 'warnings_present', 'overridden')),
    CHECK (ends_on >= starts_on)
);

CREATE TABLE IF NOT EXISTS ops.competition_team_template (
    competition_team_template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_code TEXT NOT NULL UNIQUE,
    template_name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ops.competition_team_template_store (
    competition_team_template_id UUID NOT NULL REFERENCES ops.competition_team_template(competition_team_template_id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (competition_team_template_id, store_id)
);

CREATE TABLE IF NOT EXISTS ops.competition_team (
    competition_team_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competition_stage_id UUID NOT NULL REFERENCES ops.competition_stage(competition_stage_id) ON DELETE CASCADE,
    source_template_id UUID REFERENCES ops.competition_team_template(competition_team_template_id),
    team_code TEXT NOT NULL,
    team_name TEXT NOT NULL,
    team_order INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (competition_stage_id, team_code)
);

CREATE TABLE IF NOT EXISTS ops.competition_team_store (
    competition_team_id UUID NOT NULL REFERENCES ops.competition_team(competition_team_id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    added_manually BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (competition_team_id, store_id)
);

CREATE TABLE IF NOT EXISTS rpt.competition_stage_store_score_snapshot (
    competition_stage_id UUID NOT NULL REFERENCES ops.competition_stage(competition_stage_id) ON DELETE CASCADE,
    competition_team_id UUID NOT NULL REFERENCES ops.competition_team(competition_team_id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    snapshot_date DATE NOT NULL,
    score_value NUMERIC(18,4),
    reported_weight_percent NUMERIC(8,4) NOT NULL DEFAULT 0,
    expected_weight_percent NUMERIC(8,4) NOT NULL DEFAULT 100,
    has_daily_data BOOLEAN NOT NULL DEFAULT FALSE,
    missing_kpi_codes TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (competition_stage_id, competition_team_id, store_id, snapshot_date)
);

CREATE TABLE IF NOT EXISTS rpt.competition_stage_score_snapshot (
    competition_stage_id UUID NOT NULL REFERENCES ops.competition_stage(competition_stage_id) ON DELETE CASCADE,
    competition_team_id UUID NOT NULL REFERENCES ops.competition_team(competition_team_id) ON DELETE CASCADE,
    snapshot_date DATE NOT NULL,
    score_value NUMERIC(18,4),
    valid_store_count INTEGER NOT NULL DEFAULT 0,
    total_store_count INTEGER NOT NULL DEFAULT 0,
    coverage_rate NUMERIC(8,4) NOT NULL DEFAULT 0,
    rank_position INTEGER,
    ranking_population INTEGER NOT NULL DEFAULT 0,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (competition_stage_id, competition_team_id, snapshot_date)
);

CREATE TABLE IF NOT EXISTS rpt.competition_stage_warning (
    competition_stage_warning_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competition_stage_id UUID NOT NULL REFERENCES ops.competition_stage(competition_stage_id) ON DELETE CASCADE,
    competition_team_id UUID REFERENCES ops.competition_team(competition_team_id) ON DELETE CASCADE,
    store_id UUID REFERENCES ops.store(store_id),
    warning_code TEXT NOT NULL,
    warning_level TEXT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    message TEXT NOT NULL,
    resolved_at TIMESTAMPTZ,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (warning_code IN ('missing_daily_store_data', 'missing_bm_checklist', 'missing_vm_checklist')),
    CHECK (warning_level IN ('info', 'warning', 'blocker')),
    CHECK (period_end >= period_start)
);

CREATE INDEX IF NOT EXISTS competition_stage_competition_state_idx
    ON ops.competition_stage (competition_id, lifecycle_state, starts_on, ends_on);

CREATE INDEX IF NOT EXISTS competition_team_stage_idx
    ON ops.competition_team (competition_stage_id, team_order);

CREATE INDEX IF NOT EXISTS competition_team_store_store_idx
    ON ops.competition_team_store (store_id, competition_team_id);

CREATE INDEX IF NOT EXISTS competition_stage_store_score_date_idx
    ON rpt.competition_stage_store_score_snapshot (competition_stage_id, snapshot_date, score_value DESC);

CREATE INDEX IF NOT EXISTS competition_stage_score_rank_idx
    ON rpt.competition_stage_score_snapshot (competition_stage_id, snapshot_date, rank_position);

CREATE INDEX IF NOT EXISTS competition_stage_warning_open_idx
    ON rpt.competition_stage_warning (competition_stage_id, warning_code, warning_level)
    WHERE resolved_at IS NULL;
