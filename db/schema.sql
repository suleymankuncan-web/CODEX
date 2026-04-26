CREATE SCHEMA IF NOT EXISTS ops;
CREATE SCHEMA IF NOT EXISTS rpt;
CREATE SCHEMA IF NOT EXISTS stg;
CREATE SCHEMA IF NOT EXISTS audit;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION rpt.prevent_snapshot_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Snapshot tables are immutable. Operation % is not allowed on %.%', TG_OP, TG_TABLE_SCHEMA, TG_TABLE_NAME;
END;
$$;

CREATE TABLE ops.company (
    company_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_code TEXT NOT NULL UNIQUE,
    company_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ops.region (
    region_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    region_code TEXT NOT NULL,
    region_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, region_code)
);

CREATE TABLE ops.store (
    store_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    region_id UUID NOT NULL REFERENCES ops.region(region_id),
    store_code TEXT NOT NULL UNIQUE,
    store_name TEXT NOT NULL,
    store_type TEXT NOT NULL,
    open_date DATE,
    close_date DATE,
    status TEXT NOT NULL DEFAULT 'active',
    timezone TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ops.position (
    position_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    position_code TEXT NOT NULL,
    position_name TEXT NOT NULL,
    job_family TEXT,
    is_managerial BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (company_id, position_code)
);

CREATE TABLE ops.employee (
    employee_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    external_employee_ref TEXT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    national_id_hash TEXT,
    hire_date DATE NOT NULL,
    termination_date DATE,
    employment_status TEXT NOT NULL DEFAULT 'active',
    employment_type TEXT NOT NULL,
    birth_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ops.employee_assignment_history (
    assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES ops.employee(employee_id),
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    region_id UUID NOT NULL REFERENCES ops.region(region_id),
    position_id UUID NOT NULL REFERENCES ops.position(position_id),
    manager_employee_id UUID REFERENCES ops.employee(employee_id),
    start_date DATE NOT NULL,
    end_date DATE,
    is_primary_assignment BOOLEAN NOT NULL DEFAULT TRUE,
    fte_ratio NUMERIC(5,2) NOT NULL DEFAULT 1.00,
    assignment_status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (end_date IS NULL OR end_date >= start_date),
    CHECK (fte_ratio > 0 AND fte_ratio <= 1.00)
);

CREATE TABLE ops.role (
    role_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_code TEXT NOT NULL UNIQUE,
    role_name TEXT NOT NULL,
    role_scope_type TEXT NOT NULL,
    description TEXT,
    is_system_role BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ops.permission (
    permission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    permission_code TEXT NOT NULL UNIQUE,
    resource_name TEXT NOT NULL,
    action_name TEXT NOT NULL,
    description TEXT
);

CREATE TABLE ops.role_permission (
    role_id UUID NOT NULL REFERENCES ops.role(role_id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES ops.permission(permission_id) ON DELETE CASCADE,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE ops.user_account (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES ops.employee(employee_id),
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    auth_provider TEXT NOT NULL DEFAULT 'local',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ops.user_role_assignment (
    user_role_assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    role_id UUID NOT NULL REFERENCES ops.role(role_id),
    scope_type TEXT NOT NULL,
    company_id UUID REFERENCES ops.company(company_id),
    region_id UUID REFERENCES ops.region(region_id),
    store_id UUID REFERENCES ops.store(store_id),
    start_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (end_at IS NULL OR end_at >= start_at)
);

CREATE TABLE ops.user_action_store_assignment (
    user_action_store_assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    start_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (end_at IS NULL OR end_at >= start_at)
);

CREATE TABLE ops.target_distribution_request (
    target_distribution_request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    region_id UUID NOT NULL REFERENCES ops.region(region_id),
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    request_month DATE NOT NULL,
    target_label TEXT NOT NULL,
    total_target_value NUMERIC(18,4) NOT NULL,
    allocation_count INTEGER NOT NULL DEFAULT 0,
    request_status TEXT NOT NULL DEFAULT 'pending_region_approval',
    request_reason TEXT,
    allocation_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    submitted_by_user_id TEXT NOT NULL,
    approved_by_user_id TEXT,
    approved_at TIMESTAMPTZ,
    approval_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ops.competition (
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

CREATE TABLE ops.competition_stage (
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

CREATE TABLE ops.competition_stage_package_plan (
    competition_stage_package_plan_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competition_id UUID NOT NULL REFERENCES ops.competition(competition_id) ON DELETE CASCADE,
    package_code TEXT NOT NULL,
    plan_name TEXT NOT NULL,
    plan_status TEXT NOT NULL DEFAULT 'draft',
    stage_drafts_json JSONB NOT NULL,
    created_by_user_id TEXT NOT NULL,
    updated_by_user_id TEXT NOT NULL,
    submitted_by_user_id TEXT,
    submitted_at TIMESTAMPTZ,
    reviewed_by_user_id TEXT,
    reviewed_at TIMESTAMPTZ,
    review_note TEXT,
    executed_by_user_id TEXT,
    executed_at TIMESTAMPTZ,
    created_stage_ids UUID[] NOT NULL DEFAULT ARRAY[]::uuid[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (package_code IN ('league_then_final')),
    CHECK (plan_status IN ('draft', 'submitted', 'approved', 'rejected', 'executed', 'cancelled')),
    CHECK (jsonb_typeof(stage_drafts_json) = 'array')
);

CREATE TABLE ops.feed_post (
    feed_post_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    link_label TEXT,
    link_url TEXT,
    visibility_scope_type TEXT NOT NULL,
    visibility_scope_ids UUID[] NOT NULL DEFAULT ARRAY[]::uuid[],
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    publish_status TEXT NOT NULL DEFAULT 'draft',
    published_at TIMESTAMPTZ,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    metric_code TEXT,
    metric_label TEXT,
    challenge_starts_on DATE,
    challenge_ends_on DATE,
    target_route TEXT,
    created_by_user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    updated_by_user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (post_type IN ('announcement', 'challenge')),
    CHECK (visibility_scope_type IN ('company', 'region', 'store')),
    CHECK (publish_status IN ('draft', 'published', 'archived')),
    CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at >= starts_at),
    CHECK (challenge_ends_on IS NULL OR challenge_starts_on IS NULL OR challenge_ends_on >= challenge_starts_on)
);

CREATE TABLE ops.competition_team_template (
    competition_team_template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_code TEXT NOT NULL UNIQUE,
    template_name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ops.competition_team_template_store (
    competition_team_template_id UUID NOT NULL REFERENCES ops.competition_team_template(competition_team_template_id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (competition_team_template_id, store_id)
);

CREATE TABLE ops.competition_team (
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

CREATE TABLE ops.competition_team_store (
    competition_team_id UUID NOT NULL REFERENCES ops.competition_team(competition_team_id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    added_manually BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (competition_team_id, store_id)
);

CREATE TABLE ops.checklist_template (
    checklist_template_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    template_code TEXT NOT NULL UNIQUE,
    template_name TEXT NOT NULL,
    category TEXT NOT NULL,
    version_no INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_by UUID NOT NULL REFERENCES ops.user_account(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE TABLE ops.checklist_template_item (
    template_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checklist_template_id UUID NOT NULL REFERENCES ops.checklist_template(checklist_template_id) ON DELETE CASCADE,
    section_name TEXT NOT NULL,
    item_no INTEGER NOT NULL,
    item_text TEXT NOT NULL,
    response_type TEXT NOT NULL,
    is_mandatory BOOLEAN NOT NULL DEFAULT TRUE,
    weight NUMERIC(8,2) NOT NULL DEFAULT 1,
    max_score NUMERIC(10,2) NOT NULL DEFAULT 1,
    expected_value TEXT,
    UNIQUE (checklist_template_id, item_no)
);

CREATE TABLE ops.checklist_instance (
    checklist_instance_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checklist_template_id UUID NOT NULL REFERENCES ops.checklist_template(checklist_template_id),
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    assigned_employee_id UUID REFERENCES ops.employee(employee_id),
    auditor_employee_id UUID REFERENCES ops.employee(employee_id),
    planned_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'planned',
    total_score NUMERIC(12,2),
    compliance_rate NUMERIC(7,4),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ops.checklist_response (
    response_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checklist_instance_id UUID NOT NULL REFERENCES ops.checklist_instance(checklist_instance_id) ON DELETE CASCADE,
    template_item_id UUID NOT NULL REFERENCES ops.checklist_template_item(template_item_id),
    response_value TEXT,
    score_value NUMERIC(10,2),
    is_non_compliant BOOLEAN NOT NULL DEFAULT FALSE,
    comment_text TEXT,
    responded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (checklist_instance_id, template_item_id)
);

CREATE TABLE ops.kpi_definition (
    kpi_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kpi_code TEXT NOT NULL UNIQUE,
    kpi_name TEXT NOT NULL,
    metric_type TEXT NOT NULL,
    unit_type TEXT NOT NULL,
    aggregation_type TEXT NOT NULL,
    scope_type TEXT NOT NULL,
    formula_definition TEXT,
    target_direction TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ops.kpi_target (
    kpi_target_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kpi_id UUID NOT NULL REFERENCES ops.kpi_definition(kpi_id),
    scope_type TEXT NOT NULL,
    company_id UUID REFERENCES ops.company(company_id),
    region_id UUID REFERENCES ops.region(region_id),
    store_id UUID REFERENCES ops.store(store_id),
    position_id UUID REFERENCES ops.position(position_id),
    period_type TEXT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    target_value NUMERIC(18,4) NOT NULL,
    threshold_green NUMERIC(18,4),
    threshold_yellow NUMERIC(18,4),
    threshold_red NUMERIC(18,4),
    CHECK (period_end >= period_start)
);

CREATE TABLE ops.kpi_actual (
    kpi_actual_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kpi_id UUID NOT NULL REFERENCES ops.kpi_definition(kpi_id),
    scope_type TEXT NOT NULL,
    company_id UUID REFERENCES ops.company(company_id),
    region_id UUID REFERENCES ops.region(region_id),
    store_id UUID REFERENCES ops.store(store_id),
    employee_id UUID REFERENCES ops.employee(employee_id),
    period_type TEXT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    actual_value NUMERIC(18,4) NOT NULL,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source_batch_id TEXT,
    source_payload_hash TEXT,
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source_type TEXT NOT NULL,
    CHECK (period_end >= period_start)
);

CREATE UNIQUE INDEX kpi_actual_store_live_unique_idx
    ON ops.kpi_actual (kpi_id, store_id, period_type, period_start, period_end)
    WHERE scope_type = 'store' AND store_id IS NOT NULL;

CREATE UNIQUE INDEX kpi_actual_employee_live_unique_idx
    ON ops.kpi_actual (kpi_id, employee_id, period_type, period_start, period_end)
    WHERE scope_type = 'employee' AND employee_id IS NOT NULL;

CREATE TABLE ops.kpi_score_profile_config (
    config_key TEXT PRIMARY KEY,
    config_payload JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ops.kpi_config_version (
    kpi_config_version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_no INTEGER NOT NULL,
    lifecycle_state TEXT NOT NULL DEFAULT 'published',
    effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_to TIMESTAMPTZ,
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_by UUID REFERENCES ops.user_account(user_id),
    change_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    config_payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (version_no),
    CHECK (lifecycle_state IN ('published', 'retired')),
    CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE TABLE ops.performance_review_period (
    review_period_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    period_name TEXT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    CHECK (period_end >= period_start)
);

CREATE TABLE ops.employee_performance_review (
    employee_review_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_period_id UUID NOT NULL REFERENCES ops.performance_review_period(review_period_id),
    employee_id UUID NOT NULL REFERENCES ops.employee(employee_id),
    reviewer_employee_id UUID REFERENCES ops.employee(employee_id),
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    overall_score NUMERIC(10,2),
    rating_code TEXT,
    kpi_score NUMERIC(10,2),
    behavior_score NUMERIC(10,2),
    finalized_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'draft',
    UNIQUE (review_period_id, employee_id)
);

CREATE TABLE ops.workforce_norm_plan (
    norm_plan_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    region_id UUID REFERENCES ops.region(region_id),
    store_id UUID REFERENCES ops.store(store_id),
    position_id UUID NOT NULL REFERENCES ops.position(position_id),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    planned_headcount NUMERIC(10,2) NOT NULL,
    planned_fte NUMERIC(10,2) NOT NULL,
    approved_by UUID REFERENCES ops.user_account(user_id),
    approved_at TIMESTAMPTZ,
    CHECK (period_end >= period_start)
);

CREATE TABLE ops.turnover_event (
    turnover_event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES ops.employee(employee_id),
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    region_id UUID NOT NULL REFERENCES ops.region(region_id),
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    event_date DATE NOT NULL,
    event_type TEXT NOT NULL,
    is_regrettable BOOLEAN NOT NULL DEFAULT FALSE,
    termination_reason_code TEXT,
    source_assignment_id UUID REFERENCES ops.employee_assignment_history(assignment_id)
);

CREATE TABLE rpt.snapshot_run (
    snapshot_run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_date DATE NOT NULL,
    snapshot_type TEXT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    run_status TEXT NOT NULL DEFAULT 'queued',
    idempotency_key TEXT,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    failure_reason TEXT,
    rerun_of_snapshot_run_id UUID REFERENCES rpt.snapshot_run(snapshot_run_id),
    generated_by TEXT NOT NULL,
    source_batch_no TEXT,
    kpi_config_version_id UUID REFERENCES ops.kpi_config_version(kpi_config_version_id),
    CHECK (period_end >= period_start)
);

CREATE TABLE rpt.store_workforce_snapshot (
    snapshot_run_id UUID NOT NULL REFERENCES rpt.snapshot_run(snapshot_run_id),
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    position_id UUID NOT NULL REFERENCES ops.position(position_id),
    active_headcount NUMERIC(10,2) NOT NULL,
    active_fte NUMERIC(10,2) NOT NULL,
    planned_headcount NUMERIC(10,2) NOT NULL,
    planned_fte NUMERIC(10,2) NOT NULL,
    gap_headcount NUMERIC(10,2) NOT NULL,
    gap_fte NUMERIC(10,2) NOT NULL,
    PRIMARY KEY (snapshot_run_id, store_id, position_id)
);

CREATE TABLE rpt.store_kpi_snapshot (
    snapshot_run_id UUID NOT NULL REFERENCES rpt.snapshot_run(snapshot_run_id),
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    kpi_id UUID NOT NULL REFERENCES ops.kpi_definition(kpi_id),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    target_value NUMERIC(18,4),
    actual_value NUMERIC(18,4),
    achievement_rate NUMERIC(18,4),
    status_band TEXT,
    PRIMARY KEY (snapshot_run_id, store_id, kpi_id)
);

CREATE TABLE rpt.store_checklist_snapshot (
    snapshot_run_id UUID NOT NULL REFERENCES rpt.snapshot_run(snapshot_run_id),
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    checklist_template_id UUID NOT NULL REFERENCES ops.checklist_template(checklist_template_id),
    audit_count INTEGER NOT NULL,
    avg_score NUMERIC(12,2),
    compliance_rate NUMERIC(7,4),
    critical_issue_count INTEGER NOT NULL,
    PRIMARY KEY (snapshot_run_id, store_id, checklist_template_id)
);

CREATE TABLE rpt.turnover_snapshot (
    snapshot_run_id UUID NOT NULL REFERENCES rpt.snapshot_run(snapshot_run_id),
    scope_type TEXT NOT NULL,
    company_id UUID REFERENCES ops.company(company_id),
    region_id UUID REFERENCES ops.region(region_id),
    store_id UUID REFERENCES ops.store(store_id),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    opening_headcount NUMERIC(10,2) NOT NULL,
    closing_headcount NUMERIC(10,2) NOT NULL,
    avg_headcount NUMERIC(10,2) NOT NULL,
    leaver_count INTEGER NOT NULL,
    turnover_rate NUMERIC(10,4) NOT NULL,
    PRIMARY KEY (snapshot_run_id, scope_type, company_id, region_id, store_id)
);

CREATE TABLE rpt.employee_kpi_snapshot (
    snapshot_run_id UUID NOT NULL REFERENCES rpt.snapshot_run(snapshot_run_id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES ops.employee(employee_id),
    store_id UUID REFERENCES ops.store(store_id),
    kpi_id UUID NOT NULL REFERENCES ops.kpi_definition(kpi_id),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    actual_value NUMERIC(18,4) NOT NULL,
    PRIMARY KEY (snapshot_run_id, employee_id, kpi_id)
);

CREATE TABLE rpt.employee_performance_snapshot (
    snapshot_run_id UUID NOT NULL REFERENCES rpt.snapshot_run(snapshot_run_id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES ops.employee(employee_id),
    store_id UUID REFERENCES ops.store(store_id),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    score_value NUMERIC(18,4) NOT NULL,
    matched_metrics INTEGER NOT NULL,
    total_metrics INTEGER NOT NULL,
    turkey_rank INTEGER,
    turkey_population INTEGER NOT NULL,
    store_rank INTEGER,
    store_population INTEGER NOT NULL,
    PRIMARY KEY (snapshot_run_id, employee_id)
);

CREATE TABLE rpt.competition_stage_store_score_snapshot (
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

CREATE TABLE rpt.competition_stage_score_snapshot (
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

CREATE TABLE rpt.competition_stage_warning (
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

CREATE TABLE stg.integration_source (
    integration_source_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_code TEXT NOT NULL,
    source_name TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    source_system TEXT NOT NULL DEFAULT 'manual',
    state_model TEXT NOT NULL DEFAULT 'latest_state',
    poll_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    poll_interval_minutes INTEGER NOT NULL DEFAULT 30,
    poll_window_start_local TIME NOT NULL DEFAULT TIME '10:30',
    poll_window_end_local TIME NOT NULL DEFAULT TIME '00:00',
    poll_timezone TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (source_code, entity_type)
);

CREATE TABLE stg.import_batch (
    import_batch_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_source_id UUID NOT NULL REFERENCES stg.integration_source(integration_source_id),
    entity_type TEXT NOT NULL,
    idempotency_key TEXT,
    source_batch_id TEXT,
    source_payload_hash TEXT,
    source_captured_at TIMESTAMPTZ,
    source_window_started_at TIMESTAMPTZ,
    source_window_ended_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'pending',
    raw_file_name TEXT,
    record_count INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_retried_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX import_batch_source_batch_unique_idx
    ON stg.import_batch (integration_source_id, entity_type, source_batch_id)
    WHERE source_batch_id IS NOT NULL;

CREATE TABLE stg.employee_raw (
    stg_employee_raw_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_batch_id UUID NOT NULL REFERENCES stg.import_batch(import_batch_id) ON DELETE CASCADE,
    source_employee_id TEXT NOT NULL,
    payload_json JSONB NOT NULL,
    normalized_status TEXT NOT NULL DEFAULT 'pending',
    validation_error TEXT,
    processed_flag BOOLEAN NOT NULL DEFAULT FALSE,
    processed_at TIMESTAMPTZ
);

CREATE TABLE stg.store_raw (
    stg_store_raw_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_batch_id UUID NOT NULL REFERENCES stg.import_batch(import_batch_id) ON DELETE CASCADE,
    source_store_id TEXT NOT NULL,
    payload_json JSONB NOT NULL,
    normalized_status TEXT NOT NULL DEFAULT 'pending',
    validation_error TEXT,
    processed_flag BOOLEAN NOT NULL DEFAULT FALSE,
    processed_at TIMESTAMPTZ
);

CREATE TABLE stg.kpi_raw (
    stg_kpi_raw_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_batch_id UUID NOT NULL REFERENCES stg.import_batch(import_batch_id) ON DELETE CASCADE,
    source_metric_id TEXT NOT NULL,
    store_external_ref TEXT NOT NULL,
    employee_external_ref TEXT,
    period_start DATE,
    period_end DATE,
    row_hash TEXT,
    raw_row_reference TEXT,
    payload_json JSONB NOT NULL,
    normalized_status TEXT NOT NULL DEFAULT 'pending',
    validation_error TEXT,
    processed_flag BOOLEAN NOT NULL DEFAULT FALSE,
    processed_at TIMESTAMPTZ
);

CREATE TABLE stg.assignment_raw (
    stg_assignment_raw_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_batch_id UUID NOT NULL REFERENCES stg.import_batch(import_batch_id) ON DELETE CASCADE,
    source_assignment_id TEXT NOT NULL,
    source_employee_id TEXT,
    source_store_id TEXT,
    source_position_id TEXT,
    payload_json JSONB NOT NULL,
    normalized_status TEXT NOT NULL DEFAULT 'pending',
    validation_error TEXT,
    processed_flag BOOLEAN NOT NULL DEFAULT FALSE,
    processed_at TIMESTAMPTZ
);

CREATE TABLE stg.position_raw (
    stg_position_raw_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_batch_id UUID NOT NULL REFERENCES stg.import_batch(import_batch_id) ON DELETE CASCADE,
    source_position_id TEXT NOT NULL,
    payload_json JSONB NOT NULL,
    normalized_status TEXT NOT NULL DEFAULT 'pending',
    validation_error TEXT,
    processed_flag BOOLEAN NOT NULL DEFAULT FALSE,
    processed_at TIMESTAMPTZ
);

CREATE TABLE stg.company_raw (
    stg_company_raw_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_batch_id UUID NOT NULL REFERENCES stg.import_batch(import_batch_id) ON DELETE CASCADE,
    source_company_id TEXT NOT NULL,
    payload_json JSONB NOT NULL,
    normalized_status TEXT NOT NULL DEFAULT 'pending',
    validation_error TEXT,
    processed_flag BOOLEAN NOT NULL DEFAULT FALSE,
    processed_at TIMESTAMPTZ
);

CREATE TABLE stg.region_raw (
    stg_region_raw_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_batch_id UUID NOT NULL REFERENCES stg.import_batch(import_batch_id) ON DELETE CASCADE,
    source_region_id TEXT NOT NULL,
    source_company_id TEXT,
    payload_json JSONB NOT NULL,
    normalized_status TEXT NOT NULL DEFAULT 'pending',
    validation_error TEXT,
    processed_flag BOOLEAN NOT NULL DEFAULT FALSE,
    processed_at TIMESTAMPTZ
);

CREATE TABLE stg.external_id_map (
    external_id_map_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_source_id UUID NOT NULL REFERENCES stg.integration_source(integration_source_id),
    entity_type TEXT NOT NULL,
    external_id TEXT NOT NULL,
    internal_id UUID NOT NULL,
    internal_table_name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (integration_source_id, entity_type, external_id)
);

CREATE TABLE audit.event_log (
    event_log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor_user_id UUID REFERENCES ops.user_account(user_id),
    event_type TEXT NOT NULL,
    entity_name TEXT NOT NULL,
    entity_id UUID,
    scope_type TEXT NOT NULL,
    company_id UUID REFERENCES ops.company(company_id),
    region_id UUID REFERENCES ops.region(region_id),
    store_id UUID REFERENCES ops.store(store_id),
    request_id TEXT,
    ip_address INET,
    metadata_json JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE TABLE audit.entity_change_log (
    change_log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor_user_id UUID REFERENCES ops.user_account(user_id),
    entity_name TEXT NOT NULL,
    entity_id UUID NOT NULL,
    change_type TEXT NOT NULL,
    before_json JSONB,
    after_json JSONB
);

CREATE INDEX idx_assignment_employee_dates
    ON ops.employee_assignment_history (employee_id, start_date, end_date);

CREATE INDEX idx_assignment_store_dates
    ON ops.employee_assignment_history (store_id, start_date, end_date);

CREATE INDEX idx_user_role_scope
    ON ops.user_role_assignment (user_id, scope_type, company_id, region_id, store_id);

CREATE INDEX idx_user_action_store_assignment_user_dates
    ON ops.user_action_store_assignment (user_id, start_at, end_at);

CREATE INDEX idx_user_action_store_assignment_store_dates
    ON ops.user_action_store_assignment (store_id, start_at, end_at);

CREATE UNIQUE INDEX uq_user_action_store_assignment_active
    ON ops.user_action_store_assignment (user_id, store_id)
    WHERE end_at IS NULL;

CREATE INDEX idx_target_distribution_request_scope_status
    ON ops.target_distribution_request (company_id, region_id, store_id, request_status, request_month);

CREATE INDEX competition_stage_competition_state_idx
    ON ops.competition_stage (competition_id, lifecycle_state, starts_on, ends_on);

CREATE INDEX competition_stage_package_plan_competition_idx
    ON ops.competition_stage_package_plan (competition_id, plan_status, updated_at DESC);

CREATE INDEX feed_post_status_window_idx
    ON ops.feed_post (publish_status, is_pinned DESC, published_at DESC, updated_at DESC);

CREATE INDEX feed_post_scope_ids_idx
    ON ops.feed_post USING GIN (visibility_scope_ids);

CREATE INDEX competition_team_stage_idx
    ON ops.competition_team (competition_stage_id, team_order);

CREATE INDEX competition_team_store_store_idx
    ON ops.competition_team_store (store_id, competition_team_id);

CREATE INDEX idx_checklist_instance_store_status
    ON ops.checklist_instance (store_id, status, planned_at);

CREATE INDEX idx_kpi_actual_scope_period
    ON ops.kpi_actual (kpi_id, scope_type, company_id, region_id, store_id, employee_id, period_start, period_end);

CREATE INDEX idx_norm_plan_scope_period
    ON ops.workforce_norm_plan (company_id, region_id, store_id, position_id, period_start, period_end);

CREATE INDEX idx_turnover_event_scope_date
    ON ops.turnover_event (company_id, region_id, store_id, event_date);

CREATE INDEX idx_import_batch_source_status
    ON stg.import_batch (integration_source_id, status, started_at);

CREATE INDEX kpi_raw_row_hash_idx
    ON stg.kpi_raw (row_hash)
    WHERE row_hash IS NOT NULL;

CREATE INDEX kpi_raw_reference_idx
    ON stg.kpi_raw (raw_row_reference)
    WHERE raw_row_reference IS NOT NULL;

CREATE UNIQUE INDEX uq_import_batch_idempotency_key
    ON stg.import_batch (idempotency_key)
    WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX uq_snapshot_run_idempotency_key
    ON rpt.snapshot_run (idempotency_key)
    WHERE idempotency_key IS NOT NULL;

CREATE INDEX idx_snapshot_run_status_date
    ON rpt.snapshot_run (run_status, snapshot_date, generated_at);

CREATE INDEX snapshot_run_kpi_config_version_idx
    ON rpt.snapshot_run (kpi_config_version_id);

CREATE INDEX IF NOT EXISTS snapshot_run_closed_daily_period_idx
    ON rpt.snapshot_run (period_start, period_end, generated_at DESC)
    WHERE snapshot_type = 'daily' AND run_status = 'completed';

CREATE INDEX employee_performance_snapshot_run_store_idx
    ON rpt.employee_performance_snapshot (snapshot_run_id, store_id, score_value DESC);

CREATE INDEX IF NOT EXISTS employee_performance_snapshot_run_score_idx
    ON rpt.employee_performance_snapshot (snapshot_run_id, score_value DESC, employee_id);

CREATE INDEX IF NOT EXISTS employee_performance_snapshot_run_store_score_idx
    ON rpt.employee_performance_snapshot (snapshot_run_id, store_id, score_value DESC, employee_id);

CREATE INDEX employee_kpi_snapshot_run_employee_idx
    ON rpt.employee_kpi_snapshot (snapshot_run_id, employee_id, kpi_id);

CREATE INDEX IF NOT EXISTS employee_kpi_snapshot_run_metric_value_idx
    ON rpt.employee_kpi_snapshot (snapshot_run_id, kpi_id, actual_value DESC, employee_id);

CREATE INDEX IF NOT EXISTS employee_kpi_snapshot_run_store_metric_value_idx
    ON rpt.employee_kpi_snapshot (snapshot_run_id, store_id, kpi_id, actual_value DESC, employee_id);

CREATE INDEX competition_stage_store_score_date_idx
    ON rpt.competition_stage_store_score_snapshot (competition_stage_id, snapshot_date, score_value DESC);

CREATE INDEX competition_stage_score_rank_idx
    ON rpt.competition_stage_score_snapshot (competition_stage_id, snapshot_date, rank_position);

CREATE INDEX competition_stage_warning_open_idx
    ON rpt.competition_stage_warning (competition_stage_id, warning_code, warning_level)
    WHERE resolved_at IS NULL;

CREATE INDEX idx_event_log_entity_date
    ON audit.event_log (entity_name, entity_id, occurred_at);

CREATE INDEX idx_event_log_scope_date
    ON audit.event_log (scope_type, company_id, region_id, store_id, occurred_at);

CREATE TRIGGER trg_store_workforce_snapshot_immutable
    BEFORE UPDATE OR DELETE ON rpt.store_workforce_snapshot
    FOR EACH ROW EXECUTE FUNCTION rpt.prevent_snapshot_mutation();

CREATE TRIGGER trg_store_kpi_snapshot_immutable
    BEFORE UPDATE OR DELETE ON rpt.store_kpi_snapshot
    FOR EACH ROW EXECUTE FUNCTION rpt.prevent_snapshot_mutation();

CREATE TRIGGER trg_store_checklist_snapshot_immutable
    BEFORE UPDATE OR DELETE ON rpt.store_checklist_snapshot
    FOR EACH ROW EXECUTE FUNCTION rpt.prevent_snapshot_mutation();

CREATE TRIGGER trg_turnover_snapshot_immutable
    BEFORE UPDATE OR DELETE ON rpt.turnover_snapshot
    FOR EACH ROW EXECUTE FUNCTION rpt.prevent_snapshot_mutation();

CREATE TRIGGER trg_employee_kpi_snapshot_immutable
    BEFORE UPDATE OR DELETE ON rpt.employee_kpi_snapshot
    FOR EACH ROW EXECUTE FUNCTION rpt.prevent_snapshot_mutation();

CREATE TRIGGER trg_employee_performance_snapshot_immutable
    BEFORE UPDATE OR DELETE ON rpt.employee_performance_snapshot
    FOR EACH ROW EXECUTE FUNCTION rpt.prevent_snapshot_mutation();

COMMENT ON SCHEMA ops IS 'Operational tables for organization, workforce, checklist and KPI transactions.';
COMMENT ON SCHEMA rpt IS 'Immutable snapshot reporting tables.';
COMMENT ON SCHEMA stg IS 'Staging area for external integrations before operational load.';
COMMENT ON SCHEMA audit IS 'Audit and traceability tables for critical events.';

COMMENT ON TABLE ops.employee_assignment_history IS 'Time-aware employee to store/position assignment history. Core source for active headcount and turnover calculations.';
COMMENT ON TABLE ops.user_role_assignment IS 'RBAC assignments with scope-limited visibility at company, region or store level.';
COMMENT ON TABLE ops.user_action_store_assignment IS 'Store-level action grants kept separate from role read scope so regional or audit users can read broadly but act only on assigned stores.';
COMMENT ON TABLE ops.target_distribution_request IS 'Store-level target distribution requests that are submitted by store managers and approved by region-level oversight.';
COMMENT ON TABLE ops.feed_post IS 'Scoped operational announcements and challenge posts. Challenge posts announce focus windows but do not calculate scores.';
COMMENT ON TABLE ops.kpi_score_profile_config IS 'Data-driven KPI scoring configuration for store/personnel score profiles, ownership matrix and grading bands.';
COMMENT ON TABLE ops.kpi_config_version IS 'Immutable published KPI score configuration versions used to anchor reporting snapshots.';
COMMENT ON TABLE ops.workforce_norm_plan IS 'Approved planned headcount and FTE targets used for norm vs actual workforce comparison.';
COMMENT ON TABLE rpt.snapshot_run IS 'Parent record for every immutable reporting snapshot generation run.';
COMMENT ON TABLE stg.import_batch IS 'Tracks lifecycle of each external data import batch.';
COMMENT ON TABLE audit.event_log IS 'Mandatory audit trail for critical business operations.';
