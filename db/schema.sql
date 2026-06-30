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
    kpi_import_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    timezone TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ops_store_store_type_allowed_check CHECK (store_type IN ('company', 'franchise', 'operator')),
    CONSTRAINT ops_store_status_allowed_check CHECK (status IN ('active', 'inactive', 'closed'))
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (end_date IS NULL OR end_date >= start_date),
    CHECK (fte_ratio > 0 AND fte_ratio <= 1.00)
);

CREATE TABLE ops.seller_code_request (
    seller_code_request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    region_id UUID NOT NULL REFERENCES ops.region(region_id),
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    store_type TEXT NOT NULL,
    employee_id UUID REFERENCES ops.employee(employee_id),
    request_type TEXT NOT NULL,
    request_status TEXT NOT NULL DEFAULT 'pending_hr_approval',
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    national_id_hash TEXT NOT NULL,
    national_id_last4 TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    requested_hire_date DATE NOT NULL,
    requested_position_id UUID NOT NULL REFERENCES ops.position(position_id),
    employment_type TEXT NOT NULL,
    requested_seller_code TEXT,
    approved_seller_code TEXT,
    last_reference_seller_code TEXT,
    request_reason TEXT,
    submitted_by_user_id TEXT NOT NULL,
    reviewed_by_user_id TEXT,
    reviewed_at TIMESTAMPTZ,
    review_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT seller_code_request_store_type_check CHECK (store_type IN ('company', 'franchise', 'operator')),
    CONSTRAINT seller_code_request_type_check CHECK (request_type IN ('create_code')),
    CONSTRAINT seller_code_request_status_check CHECK (request_status IN ('pending_hr_approval', 'approved', 'rejected')),
    CONSTRAINT seller_code_request_employment_type_check CHECK (employment_type IN ('full_time', 'part_time', 'temporary')),
    CONSTRAINT seller_code_request_review_check CHECK (
        (request_status = 'pending_hr_approval' AND reviewed_at IS NULL)
        OR (request_status <> 'pending_hr_approval' AND reviewed_at IS NOT NULL)
    )
);

CREATE INDEX idx_seller_code_request_store_status
    ON ops.seller_code_request (store_id, request_status, created_at DESC);

CREATE INDEX idx_seller_code_request_company_status
    ON ops.seller_code_request (company_id, request_status, created_at DESC);

CREATE UNIQUE INDEX idx_seller_code_request_approved_code_unique
    ON ops.seller_code_request (UPPER(approved_seller_code))
    WHERE approved_seller_code IS NOT NULL AND request_status = 'approved';

CREATE TABLE ops.employee_offboarding_request (
    offboarding_request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    region_id UUID NOT NULL REFERENCES ops.region(region_id),
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    employee_id UUID NOT NULL REFERENCES ops.employee(employee_id),
    request_status TEXT NOT NULL DEFAULT 'pending_hr_approval',
    requested_termination_date DATE NOT NULL,
    termination_reason TEXT NOT NULL,
    request_reason TEXT,
    submitted_by_user_id TEXT NOT NULL,
    reviewed_by_user_id TEXT,
    reviewed_at TIMESTAMPTZ,
    review_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT employee_offboarding_request_status_check CHECK (request_status IN ('pending_hr_approval', 'approved', 'rejected')),
    CONSTRAINT employee_offboarding_request_review_check CHECK (
        (request_status = 'pending_hr_approval' AND reviewed_at IS NULL)
        OR (request_status <> 'pending_hr_approval' AND reviewed_at IS NOT NULL)
    )
);

CREATE INDEX idx_employee_offboarding_request_store_status
    ON ops.employee_offboarding_request (store_id, request_status, created_at DESC);

CREATE INDEX idx_employee_offboarding_request_company_status
    ON ops.employee_offboarding_request (company_id, request_status, created_at DESC);

CREATE UNIQUE INDEX idx_employee_offboarding_request_pending_employee
    ON ops.employee_offboarding_request (employee_id)
    WHERE request_status = 'pending_hr_approval';

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
    provider_subject TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deactivation_reason TEXT,
    deactivated_by_user_id UUID REFERENCES ops.user_account(user_id),
    deactivated_at TIMESTAMPTZ
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

CREATE TABLE IF NOT EXISTS ops.mobile_device_session (
    mobile_device_session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    provider_subject TEXT NOT NULL,
    device_id_hash TEXT NOT NULL,
    platform TEXT NOT NULL,
    device_name TEXT,
    app_version TEXT,
    os_version TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    revoked_by_user_id UUID REFERENCES ops.user_account(user_id),
    revocation_reason TEXT,
    CHECK (platform IN ('ios', 'android')),
    CHECK (status IN ('active', 'revoked', 'expired')),
    CHECK (status <> 'revoked' OR revoked_at IS NOT NULL)
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

CREATE TABLE ops.personnel_target_reference (
    personnel_target_reference_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_request_id UUID NOT NULL REFERENCES ops.target_distribution_request(target_distribution_request_id),
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    region_id UUID NOT NULL REFERENCES ops.region(region_id),
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    employee_id UUID NOT NULL REFERENCES ops.employee(employee_id),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    target_value NUMERIC(18,4) NOT NULL CHECK (target_value > 0),
    target_type TEXT NOT NULL DEFAULT 'monthly_sales_target',
    status TEXT NOT NULL DEFAULT 'approved',
    approved_by_user_id TEXT NOT NULL,
    approved_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    supersedes_target_reference_id UUID REFERENCES ops.personnel_target_reference(personnel_target_reference_id),
    CHECK (period_end >= period_start),
    CHECK (status IN ('approved', 'superseded', 'voided_future'))
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
    template_code TEXT NOT NULL,
    template_type TEXT NOT NULL DEFAULT 'BM_STORE_VISIT',
    template_name TEXT NOT NULL,
    category TEXT NOT NULL,
    version_no INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_by UUID NOT NULL REFERENCES ops.user_account(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT checklist_template_code_version_unique UNIQUE (template_code, version_no),
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
    started_by_user_id TEXT,
    completed_by_user_id TEXT,
    planned_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    locked_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'planned',
    total_score NUMERIC(12,2),
    compliance_rate NUMERIC(7,4),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled'))
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

CREATE TABLE IF NOT EXISTS ops.checklist_acknowledgement (
    checklist_acknowledgement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checklist_instance_id UUID NOT NULL REFERENCES ops.checklist_instance(checklist_instance_id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    acknowledged_by_user_id TEXT NOT NULL,
    acknowledgement_note TEXT,
    acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (checklist_instance_id)
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
    achievement_rate NUMERIC(18,6),
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
    company_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
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

CREATE TABLE ops.store_action_plan (
    store_action_plan_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    region_id UUID NOT NULL REFERENCES ops.region(region_id),
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    owner_user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    created_by_user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    source_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    source_deep_link TEXT,
    source_snapshot_run_id UUID REFERENCES rpt.snapshot_run(snapshot_run_id),
    source_kpi_id UUID REFERENCES ops.kpi_definition(kpi_id),
    title TEXT NOT NULL,
    summary TEXT,
    priority TEXT NOT NULL DEFAULT 'medium',
    status TEXT NOT NULL DEFAULT 'open',
    due_on DATE NOT NULL,
    resolution_note TEXT,
    closed_by_user_id UUID REFERENCES ops.user_account(user_id),
    closed_at TIMESTAMPTZ,
    cancel_reason TEXT,
    cancelled_by_user_id UUID REFERENCES ops.user_account(user_id),
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT store_action_plan_source_type_check CHECK (source_type IN ('kpi_exception', 'checklist_remediation')),
    CHECK (priority IN ('high', 'medium', 'low')),
    CHECK (status IN ('open', 'in_progress', 'blocked', 'closed', 'cancelled')),
    CHECK (status <> 'closed' OR (closed_at IS NOT NULL AND resolution_note IS NOT NULL)),
    CHECK (status <> 'cancelled' OR (cancelled_at IS NOT NULL AND cancel_reason IS NOT NULL))
);

CREATE TABLE ops.pilot_feedback (
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

CREATE TABLE IF NOT EXISTS ops.sales_target_incentive_rule_version (
    sales_target_incentive_rule_version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_version_code TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'active',
    effective_from DATE NOT NULL,
    period_timezone TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    bracket_boundary_policy TEXT NOT NULL DEFAULT 'lower_inclusive_upper_exclusive',
    round_before_lookup BOOLEAN NOT NULL DEFAULT FALSE,
    raw_amount_minimum_scale INTEGER NOT NULL DEFAULT 6,
    payable_amount_scale INTEGER NOT NULL DEFAULT 2,
    sub_kurus_policy TEXT NOT NULL DEFAULT 'truncate_toward_zero',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    retired_at TIMESTAMPTZ,
    CHECK (status IN ('active', 'retired')),
    CHECK (bracket_boundary_policy = 'lower_inclusive_upper_exclusive'),
    CHECK (round_before_lookup = FALSE),
    CHECK (raw_amount_minimum_scale >= 6),
    CHECK (payable_amount_scale = 2),
    CHECK (sub_kurus_policy = 'truncate_toward_zero')
);

CREATE TABLE IF NOT EXISTS ops.sales_target_incentive_rate_bracket (
    sales_target_incentive_rate_bracket_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_version_id UUID NOT NULL REFERENCES ops.sales_target_incentive_rule_version(sales_target_incentive_rule_version_id),
    rate_table_version TEXT NOT NULL,
    audience TEXT NOT NULL,
    min_achievement_pct NUMERIC(12,4),
    max_achievement_pct NUMERIC(12,4),
    rate NUMERIC(10,4) NOT NULL,
    display_label TEXT NOT NULL,
    sort_order INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (audience IN ('manager', 'personnel')),
    CHECK (min_achievement_pct IS NOT NULL OR max_achievement_pct IS NOT NULL),
    CHECK (min_achievement_pct IS NULL OR min_achievement_pct >= 0),
    CHECK (min_achievement_pct IS NULL OR max_achievement_pct IS NULL OR max_achievement_pct > min_achievement_pct),
    CHECK (rate >= 0)
);

CREATE TABLE IF NOT EXISTS ops.sales_target_incentive_projection (
    sales_target_incentive_projection_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    region_id UUID NOT NULL REFERENCES ops.region(region_id),
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    period_key CHAR(7) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    period_timezone TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    store_type TEXT NOT NULL DEFAULT 'company',
    rule_version_id UUID NOT NULL REFERENCES ops.sales_target_incentive_rule_version(sales_target_incentive_rule_version_id),
    manager_rate_table_version TEXT NOT NULL,
    personnel_rate_table_version TEXT NOT NULL,
    calculation_status TEXT NOT NULL DEFAULT 'no_source',
    blocked_reason TEXT,
    store_target_request_id UUID REFERENCES ops.target_distribution_request(target_distribution_request_id),
    store_target_amount NUMERIC(18,4),
    store_net_sales_amount NUMERIC(18,4),
    store_achievement_pct NUMERIC(18,6),
    store_gate_passed BOOLEAN NOT NULL DEFAULT FALSE,
    manager_rate_bracket_id UUID REFERENCES ops.sales_target_incentive_rate_bracket(sales_target_incentive_rate_bracket_id),
    manager_rate NUMERIC(10,4),
    manager_raw_earned_amount NUMERIC(20,10),
    manager_payable_amount NUMERIC(18,2),
    source_import_batch_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
    source_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    projected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (period_key ~ '^[0-9]{4}-[0-9]{2}$'),
    CHECK (period_end >= period_start),
    CHECK (period_timezone = 'Europe/Istanbul'),
    CHECK (store_type = 'company'),
    CHECK (calculation_status IN ('projected', 'no_source', 'blocked', 'closed')),
    CHECK (calculation_status <> 'blocked' OR blocked_reason IS NOT NULL),
    CHECK (store_target_amount IS NULL OR store_target_amount > 0),
    CHECK (manager_rate IS NULL OR manager_rate >= 0)
);

CREATE TABLE IF NOT EXISTS ops.sales_target_incentive_projection_row (
    sales_target_incentive_projection_row_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    projection_id UUID NOT NULL REFERENCES ops.sales_target_incentive_projection(sales_target_incentive_projection_id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES ops.employee(employee_id),
    user_id UUID REFERENCES ops.user_account(user_id),
    assignment_id UUID REFERENCES ops.employee_assignment_history(assignment_id),
    position_id UUID REFERENCES ops.position(position_id),
    position_code TEXT NOT NULL,
    normalized_from_position_code TEXT,
    participant_type TEXT NOT NULL,
    calculation_status TEXT NOT NULL DEFAULT 'no_source',
    blocked_reason TEXT,
    personnel_target_reference_id UUID REFERENCES ops.personnel_target_reference(personnel_target_reference_id),
    personnel_target_amount NUMERIC(18,4),
    personnel_positive_sales_amount NUMERIC(18,4),
    personnel_achievement_pct NUMERIC(18,6),
    personal_rate_before_gate NUMERIC(10,4),
    applied_rate_bracket_id UUID REFERENCES ops.sales_target_incentive_rate_bracket(sales_target_incentive_rate_bracket_id),
    applied_rate NUMERIC(10,4),
    raw_earned_amount NUMERIC(20,10) NOT NULL DEFAULT 0,
    payable_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    source_import_batch_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
    source_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (position_code IN ('STORE_MANAGER', 'ASSISTANT_MANAGER', 'SENIOR_SALES_CONSULTANT', 'SALES_ASSOCIATE')),
    CHECK (normalized_from_position_code IS NULL OR normalized_from_position_code = 'SHIFT_LEAD'),
    CHECK (participant_type IN ('store_manager', 'personnel')),
    CHECK (calculation_status IN ('projected', 'no_source', 'blocked')),
    CHECK (calculation_status <> 'blocked' OR blocked_reason IS NOT NULL),
    CHECK (personnel_target_amount IS NULL OR personnel_target_amount > 0),
    CHECK (personnel_positive_sales_amount IS NULL OR personnel_positive_sales_amount >= 0),
    CHECK (applied_rate IS NULL OR applied_rate >= 0)
);

CREATE TABLE IF NOT EXISTS ops.sales_target_incentive_close_run (
    sales_target_incentive_close_run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    period_key CHAR(7) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    period_timezone TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    close_cutoff_at TIMESTAMPTZ NOT NULL,
    rule_version_id UUID NOT NULL REFERENCES ops.sales_target_incentive_rule_version(sales_target_incentive_rule_version_id),
    status TEXT NOT NULL DEFAULT 'queued',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failed_reason TEXT,
    created_by_user_id UUID REFERENCES ops.user_account(user_id),
    source_import_batch_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
    source_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (period_key ~ '^[0-9]{4}-[0-9]{2}$'),
    CHECK (period_end >= period_start),
    CHECK (period_timezone = 'Europe/Istanbul'),
    CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
    CHECK (status <> 'succeeded' OR completed_at IS NOT NULL),
    CHECK (status <> 'failed' OR failed_reason IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS rpt.sales_target_incentive_rule_snapshot (
    sales_target_incentive_rule_snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    close_run_id UUID NOT NULL REFERENCES ops.sales_target_incentive_close_run(sales_target_incentive_close_run_id) ON DELETE CASCADE,
    rule_version_id UUID NOT NULL REFERENCES ops.sales_target_incentive_rule_version(sales_target_incentive_rule_version_id),
    rule_version_code TEXT NOT NULL,
    rate_table_versions TEXT[] NOT NULL,
    period_key CHAR(7) NOT NULL,
    period_timezone TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    close_cutoff_at TIMESTAMPTZ NOT NULL,
    rate_brackets_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (period_key ~ '^[0-9]{4}-[0-9]{2}$'),
    CHECK (period_timezone = 'Europe/Istanbul')
);

CREATE TABLE IF NOT EXISTS rpt.sales_target_incentive_assignment_snapshot (
    sales_target_incentive_assignment_snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    close_run_id UUID NOT NULL REFERENCES ops.sales_target_incentive_close_run(sales_target_incentive_close_run_id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    region_id UUID NOT NULL REFERENCES ops.region(region_id),
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    employee_id UUID NOT NULL REFERENCES ops.employee(employee_id),
    user_id UUID REFERENCES ops.user_account(user_id),
    source_assignment_id UUID REFERENCES ops.employee_assignment_history(assignment_id),
    position_id UUID REFERENCES ops.position(position_id),
    position_code TEXT NOT NULL,
    normalized_from_position_code TEXT,
    period_key CHAR(7) NOT NULL,
    period_timezone TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    assignment_started_on DATE NOT NULL,
    assignment_ended_on DATE,
    source_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (position_code IN ('STORE_MANAGER', 'ASSISTANT_MANAGER', 'SENIOR_SALES_CONSULTANT', 'SALES_ASSOCIATE')),
    CHECK (normalized_from_position_code IS NULL OR normalized_from_position_code = 'SHIFT_LEAD'),
    CHECK (period_key ~ '^[0-9]{4}-[0-9]{2}$'),
    CHECK (period_timezone = 'Europe/Istanbul'),
    CHECK (assignment_ended_on IS NULL OR assignment_ended_on >= assignment_started_on)
);

CREATE TABLE IF NOT EXISTS rpt.sales_target_incentive_final_snapshot (
    sales_target_incentive_final_snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    close_run_id UUID NOT NULL REFERENCES ops.sales_target_incentive_close_run(sales_target_incentive_close_run_id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    region_id UUID NOT NULL REFERENCES ops.region(region_id),
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    period_key CHAR(7) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    period_timezone TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    close_cutoff_at TIMESTAMPTZ NOT NULL,
    store_type TEXT NOT NULL DEFAULT 'company',
    rule_version_id UUID NOT NULL REFERENCES ops.sales_target_incentive_rule_version(sales_target_incentive_rule_version_id),
    rule_version_code TEXT NOT NULL,
    manager_rate_table_version TEXT NOT NULL,
    personnel_rate_table_version TEXT NOT NULL,
    store_target_request_id UUID REFERENCES ops.target_distribution_request(target_distribution_request_id),
    store_target_amount NUMERIC(18,4),
    store_net_sales_amount NUMERIC(18,4),
    store_achievement_pct NUMERIC(18,6),
    store_gate_passed BOOLEAN NOT NULL DEFAULT FALSE,
    source_import_batch_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
    source_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (period_key ~ '^[0-9]{4}-[0-9]{2}$'),
    CHECK (period_end >= period_start),
    CHECK (period_timezone = 'Europe/Istanbul'),
    CHECK (store_type = 'company')
);

CREATE TABLE IF NOT EXISTS rpt.sales_target_incentive_final_row (
    sales_target_incentive_final_row_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    final_snapshot_id UUID NOT NULL REFERENCES rpt.sales_target_incentive_final_snapshot(sales_target_incentive_final_snapshot_id) ON DELETE CASCADE,
    assignment_snapshot_id UUID REFERENCES rpt.sales_target_incentive_assignment_snapshot(sales_target_incentive_assignment_snapshot_id),
    employee_id UUID NOT NULL REFERENCES ops.employee(employee_id),
    user_id UUID REFERENCES ops.user_account(user_id),
    participant_type TEXT NOT NULL,
    position_code TEXT NOT NULL,
    normalized_from_position_code TEXT,
    rate_table_version TEXT NOT NULL,
    target_reference_id UUID REFERENCES ops.personnel_target_reference(personnel_target_reference_id),
    target_amount NUMERIC(18,4),
    actual_sales_amount NUMERIC(18,4),
    achievement_pct NUMERIC(18,6),
    applied_rate_bracket_id UUID REFERENCES ops.sales_target_incentive_rate_bracket(sales_target_incentive_rate_bracket_id),
    applied_rate NUMERIC(10,4),
    raw_earned_amount NUMERIC(20,10) NOT NULL DEFAULT 0,
    payable_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    correction_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    adjustment_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    final_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    calculation_status TEXT NOT NULL DEFAULT 'finalized',
    source_import_batch_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
    source_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (participant_type IN ('store_manager', 'personnel')),
    CHECK (position_code IN ('STORE_MANAGER', 'ASSISTANT_MANAGER', 'SENIOR_SALES_CONSULTANT', 'SALES_ASSOCIATE')),
    CHECK (normalized_from_position_code IS NULL OR normalized_from_position_code = 'SHIFT_LEAD'),
    CHECK (target_amount IS NULL OR target_amount > 0),
    CHECK (actual_sales_amount IS NULL OR actual_sales_amount >= 0),
    CHECK (applied_rate IS NULL OR applied_rate >= 0),
    CHECK (calculation_status IN ('finalized', 'corrected', 'adjusted'))
);

CREATE TABLE IF NOT EXISTS ops.sales_target_incentive_adjustment (
    sales_target_incentive_adjustment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    region_id UUID NOT NULL REFERENCES ops.region(region_id),
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    employee_id UUID REFERENCES ops.employee(employee_id),
    projection_row_id UUID REFERENCES ops.sales_target_incentive_projection_row(sales_target_incentive_projection_row_id),
    final_row_id UUID REFERENCES rpt.sales_target_incentive_final_row(sales_target_incentive_final_row_id),
    rule_version_id UUID NOT NULL REFERENCES ops.sales_target_incentive_rule_version(sales_target_incentive_rule_version_id),
    period_key CHAR(7) NOT NULL,
    period_timezone TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    adjustment_scope TEXT NOT NULL,
    adjustment_type TEXT NOT NULL,
    adjustment_amount NUMERIC(18,2) NOT NULL,
    before_amount NUMERIC(18,2),
    after_amount NUMERIC(18,2),
    reason_code TEXT NOT NULL,
    reason_note TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    created_by_user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    approved_by_user_id UUID REFERENCES ops.user_account(user_id),
    approved_at TIMESTAMPTZ,
    evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (period_key ~ '^[0-9]{4}-[0-9]{2}$'),
    CHECK (period_timezone = 'Europe/Istanbul'),
    CHECK (adjustment_scope IN ('projection', 'final_snapshot')),
    CHECK (adjustment_type IN ('correction', 'manual_adjustment')),
    CHECK (adjustment_amount <> 0),
    CHECK (status IN ('draft', 'approved', 'voided')),
    CHECK (status <> 'approved' OR (approved_by_user_id IS NOT NULL AND approved_at IS NOT NULL)),
    CHECK (
        (adjustment_scope = 'projection' AND projection_row_id IS NOT NULL AND final_row_id IS NULL)
        OR (adjustment_scope = 'final_snapshot' AND projection_row_id IS NULL AND final_row_id IS NOT NULL)
    )
);

CREATE TABLE IF NOT EXISTS ops.sales_target_incentive_store_review (
    sales_target_incentive_store_review_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    region_id UUID NOT NULL REFERENCES ops.region(region_id),
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    final_snapshot_id UUID NOT NULL REFERENCES rpt.sales_target_incentive_final_snapshot(sales_target_incentive_final_snapshot_id),
    period_key CHAR(7) NOT NULL,
    period_timezone TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    review_status TEXT NOT NULL DEFAULT 'pending_review',
    reviewed_by_user_id UUID REFERENCES ops.user_account(user_id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (period_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    CHECK (period_timezone = 'Europe/Istanbul'),
    CHECK (review_status IN ('pending_review', 'reviewed')),
    CHECK (
        (review_status = 'pending_review' AND reviewed_by_user_id IS NULL AND reviewed_at IS NULL)
        OR (review_status = 'reviewed' AND reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL)
    )
);

CREATE TABLE IF NOT EXISTS ops.sales_target_incentive_region_package (
    sales_target_incentive_region_package_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    region_id UUID NOT NULL REFERENCES ops.region(region_id),
    period_key CHAR(7) NOT NULL,
    period_timezone TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    package_status TEXT NOT NULL DEFAULT 'submitted',
    submitted_by_user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    submission_note TEXT,
    reviewed_by_user_id UUID REFERENCES ops.user_account(user_id),
    reviewed_at TIMESTAMPTZ,
    review_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (period_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    CHECK (period_timezone = 'Europe/Istanbul'),
    CHECK (package_status IN ('submitted', 'admin_approved', 'admin_returned')),
    CHECK (package_status <> 'admin_approved' OR (reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL)),
    CHECK (package_status <> 'admin_returned' OR (reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL AND NULLIF(BTRIM(review_note), '') IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS ops.sales_target_incentive_region_package_store (
    sales_target_incentive_region_package_store_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region_package_id UUID NOT NULL REFERENCES ops.sales_target_incentive_region_package(sales_target_incentive_region_package_id) ON DELETE CASCADE,
    store_review_id UUID NOT NULL REFERENCES ops.sales_target_incentive_store_review(sales_target_incentive_store_review_id),
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    region_id UUID NOT NULL REFERENCES ops.region(region_id),
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    final_snapshot_id UUID NOT NULL REFERENCES rpt.sales_target_incentive_final_snapshot(sales_target_incentive_final_snapshot_id),
    period_key CHAR(7) NOT NULL,
    reviewed_by_user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    reviewed_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (period_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);

CREATE TABLE IF NOT EXISTS ops.sales_target_incentive_region_correction (
    sales_target_incentive_region_correction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region_package_id UUID REFERENCES ops.sales_target_incentive_region_package(sales_target_incentive_region_package_id) ON DELETE SET NULL,
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    region_id UUID NOT NULL REFERENCES ops.region(region_id),
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    employee_id UUID NOT NULL REFERENCES ops.employee(employee_id),
    participant_type TEXT NOT NULL,
    target_scope TEXT NOT NULL DEFAULT 'final_snapshot',
    final_row_id UUID NOT NULL REFERENCES rpt.sales_target_incentive_final_row(sales_target_incentive_final_row_id),
    period_key CHAR(7) NOT NULL,
    period_timezone TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    before_amount NUMERIC(18,2) NOT NULL,
    final_amount NUMERIC(18,2) NOT NULL,
    adjustment_amount NUMERIC(18,2) GENERATED ALWAYS AS (final_amount - before_amount) STORED,
    reason_note TEXT NOT NULL,
    correction_status TEXT NOT NULL DEFAULT 'draft',
    created_by_user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    submitted_by_user_id UUID REFERENCES ops.user_account(user_id),
    submitted_at TIMESTAMPTZ,
    reviewed_by_user_id UUID REFERENCES ops.user_account(user_id),
    reviewed_at TIMESTAMPTZ,
    review_note TEXT,
    approved_adjustment_id UUID REFERENCES ops.sales_target_incentive_adjustment(sales_target_incentive_adjustment_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (period_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
    CHECK (period_timezone = 'Europe/Istanbul'),
    CHECK (participant_type IN ('store_manager', 'personnel')),
    CHECK (target_scope = 'final_snapshot'),
    CHECK (final_amount <> before_amount),
    CHECK (NULLIF(BTRIM(reason_note), '') IS NOT NULL),
    CHECK (correction_status IN ('draft', 'submitted', 'admin_approved', 'admin_returned', 'voided')),
    CHECK (correction_status <> 'submitted' OR (region_package_id IS NOT NULL AND submitted_by_user_id IS NOT NULL AND submitted_at IS NOT NULL)),
    CHECK (correction_status <> 'admin_approved' OR (region_package_id IS NOT NULL AND submitted_by_user_id IS NOT NULL AND submitted_at IS NOT NULL AND reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL AND approved_adjustment_id IS NOT NULL)),
    CHECK (correction_status <> 'admin_returned' OR (reviewed_by_user_id IS NOT NULL AND reviewed_at IS NOT NULL AND NULLIF(BTRIM(review_note), '') IS NOT NULL)),
    CHECK (correction_status <> 'voided' OR approved_adjustment_id IS NULL)
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
    achievement_rate NUMERIC(18,6),
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
    personnel_target_reference_id UUID REFERENCES ops.personnel_target_reference(personnel_target_reference_id),
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
    company_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
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
    ON stg.import_batch (integration_source_id, entity_type, source_batch_id, company_ids)
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

CREATE TABLE IF NOT EXISTS stg.master_data_bootstrap_batch (
    master_data_bootstrap_batch_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    bootstrap_entity TEXT NOT NULL,
    source_label TEXT NOT NULL,
    file_reference TEXT,
    uploaded_by_user_id TEXT NOT NULL,
    batch_status TEXT NOT NULL DEFAULT 'uploaded',
    row_count INTEGER NOT NULL DEFAULT 0 CHECK (row_count >= 0),
    valid_count INTEGER NOT NULL DEFAULT 0 CHECK (valid_count >= 0),
    needs_review_count INTEGER NOT NULL DEFAULT 0 CHECK (needs_review_count >= 0),
    invalid_count INTEGER NOT NULL DEFAULT 0 CHECK (invalid_count >= 0),
    promoted_count INTEGER NOT NULL DEFAULT 0 CHECK (promoted_count >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    validated_at TIMESTAMPTZ,
    promoted_at TIMESTAMPTZ,
    CHECK (bootstrap_entity IN ('store', 'personnel')),
    CHECK (batch_status IN ('uploaded', 'validated', 'ready_to_promote', 'promoted', 'rejected'))
);

CREATE TABLE IF NOT EXISTS stg.master_data_bootstrap_row (
    master_data_bootstrap_row_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    master_data_bootstrap_batch_id UUID NOT NULL REFERENCES stg.master_data_bootstrap_batch(master_data_bootstrap_batch_id) ON DELETE CASCADE,
    row_number INTEGER NOT NULL CHECK (row_number > 0),
    row_hash TEXT NOT NULL,
    source_store_code TEXT,
    source_employee_code TEXT,
    raw_payload_json JSONB NOT NULL,
    normalized_payload_json JSONB NOT NULL DEFAULT '{}'::JSONB,
    validation_status TEXT NOT NULL DEFAULT 'pending',
    issue_code TEXT,
    issue_message TEXT,
    resolved_company_id UUID REFERENCES ops.company(company_id),
    resolved_region_id UUID REFERENCES ops.region(region_id),
    resolved_store_id UUID REFERENCES ops.store(store_id),
    resolved_employee_id UUID REFERENCES ops.employee(employee_id),
    resolved_position_id UUID REFERENCES ops.position(position_id),
    promoted_entity_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (validation_status IN ('pending', 'valid', 'needs_review', 'invalid', 'promoted')),
    CHECK (validation_status NOT IN ('needs_review', 'invalid') OR issue_code IS NOT NULL)
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

CREATE TABLE IF NOT EXISTS audit.schema_migration (
    migration_name TEXT PRIMARY KEY,
    migration_checksum TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
    attempt_count INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    duration_ms INTEGER,
    applied_by TEXT NOT NULL DEFAULT CURRENT_USER,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_assignment_employee_dates
    ON ops.employee_assignment_history (employee_id, start_date, end_date);

CREATE INDEX idx_assignment_store_dates
    ON ops.employee_assignment_history (store_id, start_date, end_date);

CREATE INDEX idx_user_role_scope
    ON ops.user_role_assignment (user_id, scope_type, company_id, region_id, store_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_role_assignment_active_scope
    ON ops.user_role_assignment (
        user_id,
        role_id,
        scope_type,
        COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid),
        COALESCE(region_id, '00000000-0000-0000-0000-000000000000'::uuid),
        COALESCE(store_id, '00000000-0000-0000-0000-000000000000'::uuid)
    )
    WHERE end_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_account_auth_provider_subject
    ON ops.user_account (auth_provider, provider_subject)
    WHERE provider_subject IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_account_employee_active
    ON ops.user_account (employee_id, is_active);

CREATE INDEX IF NOT EXISTS idx_user_account_active_employee
    ON ops.user_account (is_active, employee_id);

CREATE INDEX idx_user_action_store_assignment_user_dates
    ON ops.user_action_store_assignment (user_id, start_at, end_at);

CREATE INDEX idx_user_action_store_assignment_store_dates
    ON ops.user_action_store_assignment (store_id, start_at, end_at);

CREATE UNIQUE INDEX uq_user_action_store_assignment_active
    ON ops.user_action_store_assignment (user_id, store_id)
    WHERE end_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_mobile_device_session_user_status
    ON ops.mobile_device_session (user_id, status, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_mobile_device_session_active_lookup
    ON ops.mobile_device_session (mobile_device_session_id, user_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mobile_device_session_active_device
    ON ops.mobile_device_session (user_id, device_id_hash)
    WHERE status = 'active';

CREATE INDEX idx_target_distribution_request_scope_status
    ON ops.target_distribution_request (company_id, region_id, store_id, request_status, request_month);

CREATE INDEX IF NOT EXISTS idx_personnel_target_reference_employee_period
    ON ops.personnel_target_reference (employee_id, period_start, period_end, status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_personnel_target_reference_active_unique
    ON ops.personnel_target_reference (employee_id, period_start, period_end, target_type)
    WHERE status = 'approved';

CREATE INDEX IF NOT EXISTS idx_store_action_plan_store_status_due
    ON ops.store_action_plan (store_id, status, due_on);

CREATE INDEX IF NOT EXISTS idx_store_action_plan_owner_status_due
    ON ops.store_action_plan (owner_user_id, status, due_on);

CREATE INDEX IF NOT EXISTS idx_store_action_plan_scope_status_due
    ON ops.store_action_plan (company_id, region_id, status, due_on);

CREATE UNIQUE INDEX IF NOT EXISTS idx_store_action_plan_active_source_unique
    ON ops.store_action_plan (store_id, source_type, source_id)
    WHERE status IN ('open', 'in_progress', 'blocked');

CREATE INDEX IF NOT EXISTS idx_pilot_feedback_status_created
    ON ops.pilot_feedback (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pilot_feedback_classification_created
    ON ops.pilot_feedback (classification, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pilot_feedback_actor_created
    ON ops.pilot_feedback (actor_user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_target_incentive_rate_bracket_unique
    ON ops.sales_target_incentive_rate_bracket (rule_version_id, rate_table_version, audience, sort_order);

CREATE INDEX IF NOT EXISTS idx_sales_target_incentive_rate_bracket_lookup
    ON ops.sales_target_incentive_rate_bracket (rule_version_id, audience, min_achievement_pct, max_achievement_pct);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_target_incentive_projection_store_period_unique
    ON ops.sales_target_incentive_projection (store_id, period_key);

CREATE INDEX IF NOT EXISTS idx_sales_target_incentive_projection_scope_period
    ON ops.sales_target_incentive_projection (company_id, region_id, period_key, calculation_status);

CREATE INDEX IF NOT EXISTS idx_sales_target_incentive_projection_row_employee
    ON ops.sales_target_incentive_projection_row (employee_id, calculation_status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_target_incentive_projection_row_unique
    ON ops.sales_target_incentive_projection_row (projection_id, employee_id, participant_type);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_target_incentive_close_run_company_period_cutoff
    ON ops.sales_target_incentive_close_run (company_id, period_key, close_cutoff_at);

CREATE INDEX IF NOT EXISTS idx_sales_target_incentive_close_run_status
    ON ops.sales_target_incentive_close_run (status, period_key, close_cutoff_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_target_incentive_rule_snapshot_run
    ON rpt.sales_target_incentive_rule_snapshot (close_run_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_target_incentive_assignment_snapshot_employee
    ON rpt.sales_target_incentive_assignment_snapshot (close_run_id, employee_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_target_incentive_final_snapshot_store
    ON rpt.sales_target_incentive_final_snapshot (close_run_id, store_id);

CREATE INDEX IF NOT EXISTS idx_sales_target_incentive_final_snapshot_scope
    ON rpt.sales_target_incentive_final_snapshot (company_id, region_id, period_key);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_target_incentive_final_row_employee
    ON rpt.sales_target_incentive_final_row (final_snapshot_id, employee_id, participant_type);

CREATE INDEX IF NOT EXISTS idx_sales_target_incentive_adjustment_scope_status
    ON ops.sales_target_incentive_adjustment (company_id, region_id, store_id, period_key, status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sti_store_review_store_period
    ON ops.sales_target_incentive_store_review (store_id, period_key);

CREATE INDEX IF NOT EXISTS idx_sti_store_review_region_period_status
    ON ops.sales_target_incentive_store_review (region_id, period_key, review_status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sti_region_package_region_period
    ON ops.sales_target_incentive_region_package (region_id, period_key);

CREATE INDEX IF NOT EXISTS idx_sti_region_package_company_period_status
    ON ops.sales_target_incentive_region_package (company_id, period_key, package_status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sti_region_package_store_unique
    ON ops.sales_target_incentive_region_package_store (region_package_id, store_id);

CREATE INDEX IF NOT EXISTS idx_sti_region_package_store_scope
    ON ops.sales_target_incentive_region_package_store (region_id, period_key, store_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sti_region_correction_open_unique
    ON ops.sales_target_incentive_region_correction (store_id, employee_id, participant_type, period_key)
    WHERE correction_status IN ('draft', 'submitted', 'admin_returned');

CREATE INDEX IF NOT EXISTS idx_sti_region_correction_package_status
    ON ops.sales_target_incentive_region_correction (region_package_id, correction_status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sti_region_correction_approved_adjustment
    ON ops.sales_target_incentive_region_correction (approved_adjustment_id)
    WHERE approved_adjustment_id IS NOT NULL;

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

CREATE INDEX IF NOT EXISTS idx_checklist_instance_mobile_today
    ON ops.checklist_instance (store_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_checklist_instance_monthly_completed
    ON ops.checklist_instance (store_id, checklist_template_id, completed_at DESC)
    WHERE status = 'completed';

CREATE INDEX IF NOT EXISTS idx_checklist_acknowledgement_store_acknowledged_at
    ON ops.checklist_acknowledgement (store_id, acknowledged_at DESC);

CREATE INDEX idx_kpi_actual_scope_period
    ON ops.kpi_actual (kpi_id, scope_type, company_id, region_id, store_id, employee_id, period_start, period_end);

CREATE INDEX idx_norm_plan_scope_period
    ON ops.workforce_norm_plan (company_id, region_id, store_id, position_id, period_start, period_end);

CREATE INDEX idx_turnover_event_scope_date
    ON ops.turnover_event (company_id, region_id, store_id, event_date);

CREATE INDEX idx_import_batch_source_status
    ON stg.import_batch (integration_source_id, status, started_at);

CREATE INDEX idx_import_batch_company_ids
    ON stg.import_batch USING GIN (company_ids);

CREATE INDEX kpi_raw_row_hash_idx
    ON stg.kpi_raw (row_hash)
    WHERE row_hash IS NOT NULL;

CREATE INDEX kpi_raw_reference_idx
    ON stg.kpi_raw (raw_row_reference)
    WHERE raw_row_reference IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_master_data_bootstrap_row_hash
    ON stg.master_data_bootstrap_row (master_data_bootstrap_batch_id, row_hash);

CREATE INDEX IF NOT EXISTS idx_master_data_bootstrap_batch_status
    ON stg.master_data_bootstrap_batch (company_id, bootstrap_entity, batch_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_master_data_bootstrap_row_review
    ON stg.master_data_bootstrap_row (master_data_bootstrap_batch_id, validation_status, row_number);

CREATE UNIQUE INDEX uq_import_batch_idempotency_key
    ON stg.import_batch (idempotency_key, company_ids)
    WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX uq_snapshot_run_idempotency_key
    ON rpt.snapshot_run (idempotency_key, company_ids)
    WHERE idempotency_key IS NOT NULL;

CREATE INDEX idx_snapshot_run_company_ids
    ON rpt.snapshot_run USING GIN (company_ids);

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

CREATE INDEX IF NOT EXISTS idx_schema_migration_status
    ON audit.schema_migration (status, started_at DESC);

CREATE OR REPLACE FUNCTION ops.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_store_touch_updated_at ON ops.store;
CREATE TRIGGER trg_store_touch_updated_at
    BEFORE UPDATE ON ops.store
    FOR EACH ROW EXECUTE FUNCTION ops.touch_updated_at();

DROP TRIGGER IF EXISTS trg_employee_touch_updated_at ON ops.employee;
CREATE TRIGGER trg_employee_touch_updated_at
    BEFORE UPDATE ON ops.employee
    FOR EACH ROW EXECUTE FUNCTION ops.touch_updated_at();

DROP TRIGGER IF EXISTS trg_employee_assignment_history_touch_updated_at ON ops.employee_assignment_history;
CREATE TRIGGER trg_employee_assignment_history_touch_updated_at
    BEFORE UPDATE ON ops.employee_assignment_history
    FOR EACH ROW EXECUTE FUNCTION ops.touch_updated_at();

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

DROP TRIGGER IF EXISTS trg_sales_target_incentive_final_snapshot_immutable ON rpt.sales_target_incentive_final_snapshot;
CREATE TRIGGER trg_sales_target_incentive_final_snapshot_immutable
    BEFORE UPDATE OR DELETE ON rpt.sales_target_incentive_final_snapshot
    FOR EACH ROW EXECUTE FUNCTION rpt.prevent_snapshot_mutation();

DROP TRIGGER IF EXISTS trg_sales_target_incentive_final_row_immutable ON rpt.sales_target_incentive_final_row;
CREATE TRIGGER trg_sales_target_incentive_final_row_immutable
    BEFORE UPDATE OR DELETE ON rpt.sales_target_incentive_final_row
    FOR EACH ROW EXECUTE FUNCTION rpt.prevent_snapshot_mutation();

DROP TRIGGER IF EXISTS trg_sales_target_incentive_rule_snapshot_immutable ON rpt.sales_target_incentive_rule_snapshot;
CREATE TRIGGER trg_sales_target_incentive_rule_snapshot_immutable
    BEFORE UPDATE OR DELETE ON rpt.sales_target_incentive_rule_snapshot
    FOR EACH ROW EXECUTE FUNCTION rpt.prevent_snapshot_mutation();

DROP TRIGGER IF EXISTS trg_sales_target_incentive_assignment_snapshot_immutable ON rpt.sales_target_incentive_assignment_snapshot;
CREATE TRIGGER trg_sales_target_incentive_assignment_snapshot_immutable
    BEFORE UPDATE OR DELETE ON rpt.sales_target_incentive_assignment_snapshot
    FOR EACH ROW EXECUTE FUNCTION rpt.prevent_snapshot_mutation();

COMMENT ON SCHEMA ops IS 'Operational tables for organization, workforce, checklist and KPI transactions.';
COMMENT ON SCHEMA rpt IS 'Immutable snapshot reporting tables.';
COMMENT ON SCHEMA stg IS 'Staging area for external integrations before operational load.';
COMMENT ON SCHEMA audit IS 'Audit and traceability tables for critical events.';

COMMENT ON TABLE ops.employee_assignment_history IS 'Time-aware employee to store/position assignment history. Core source for active headcount and turnover calculations.';
COMMENT ON TABLE ops.user_role_assignment IS 'RBAC assignments with scope-limited visibility at company, region or store level.';
COMMENT ON TABLE ops.user_action_store_assignment IS 'Store-level action grants kept separate from role read scope so regional or audit users can read broadly but act only on assigned stores.';
COMMENT ON TABLE ops.mobile_device_session IS 'Mobile device session registry for active/revoked app sessions. Refresh tokens remain IdP-owned in V1.';
COMMENT ON TABLE ops.target_distribution_request IS 'Store-level target distribution requests that are submitted by store managers and approved by region-level oversight.';
COMMENT ON TABLE ops.personnel_target_reference IS 'Approved personnel target references promoted from region-approved target distribution requests for scoring.';
COMMENT ON TABLE ops.store_action_plan IS 'Store-owned follow-up plans created from approved Store Action candidate sources.';
COMMENT ON TABLE ops.pilot_feedback IS 'Controlled pilot feedback intake for classifying P0/P1/P2/P3 findings without changing pilot go/no-go semantics.';
COMMENT ON TABLE ops.feed_post IS 'Scoped operational announcements and challenge posts. Challenge posts announce focus windows but do not calculate scores.';
COMMENT ON TABLE ops.checklist_acknowledgement IS 'Store acknowledgement evidence for completed checklist instances.';
COMMENT ON TABLE ops.kpi_score_profile_config IS 'Data-driven KPI scoring configuration for store/personnel score profiles, ownership matrix and grading bands.';
COMMENT ON TABLE ops.kpi_config_version IS 'Immutable published KPI score configuration versions used to anchor reporting snapshots.';
COMMENT ON TABLE ops.workforce_norm_plan IS 'Approved planned headcount and FTE targets used for norm vs actual workforce comparison.';
COMMENT ON TABLE ops.sales_target_incentive_rule_version IS 'Versioned sales-target incentive calculation contract. Display labels are not calculation boundaries.';
COMMENT ON TABLE ops.sales_target_incentive_rate_bracket IS 'Exact lower-inclusive and upper-exclusive incentive rate brackets for manager and personnel formulas.';
COMMENT ON TABLE ops.sales_target_incentive_projection IS 'Mutable current-period company-store incentive projection with source evidence pointers only.';
COMMENT ON TABLE ops.sales_target_incentive_projection_row IS 'Mutable current-period eligible employee incentive projection rows. Cashier and non-company stores are excluded before persistence.';
COMMENT ON TABLE ops.sales_target_incentive_close_run IS 'Incentive period close workflow record with the rule version and source cutoff used for final snapshots.';
COMMENT ON TABLE ops.sales_target_incentive_adjustment IS 'Audited admin corrections and manual adjustments for incentive projections or final rows.';
COMMENT ON TABLE ops.sales_target_incentive_store_review IS 'Region manager store-level incentive review marks for a closed final snapshot period.';
COMMENT ON TABLE ops.sales_target_incentive_region_package IS 'Submitted region manager incentive approval package for a period and region.';
COMMENT ON TABLE ops.sales_target_incentive_region_package_store IS 'Immutable submitted store set snapshot for a region manager incentive package.';
COMMENT ON TABLE ops.sales_target_incentive_region_correction IS 'Region manager draft/submitted incentive corrections, converted to payable adjustments only after admin approval.';
COMMENT ON TABLE rpt.sales_target_incentive_rule_snapshot IS 'Immutable snapshot of the incentive rule/rate table used by a close run.';
COMMENT ON TABLE rpt.sales_target_incentive_assignment_snapshot IS 'Immutable close-time employee assignment snapshot used by incentive finalization.';
COMMENT ON TABLE rpt.sales_target_incentive_final_snapshot IS 'Immutable store-level incentive close snapshot with rule version, cutoff and source evidence pointers.';
COMMENT ON TABLE rpt.sales_target_incentive_final_row IS 'Immutable employee-level incentive close row; later corrections are recorded through ops.sales_target_incentive_adjustment.';
COMMENT ON TABLE rpt.snapshot_run IS 'Parent record for every immutable reporting snapshot generation run.';
COMMENT ON TABLE stg.import_batch IS 'Tracks lifecycle of each external data import batch.';
COMMENT ON TABLE stg.master_data_bootstrap_batch IS 'Controlled store/personnel master-data bootstrap batches. Rows must be reviewed before live promotion.';
COMMENT ON TABLE stg.master_data_bootstrap_row IS 'Raw and normalized master-data bootstrap rows with validation state, resolution evidence, and future promotion trace.';
COMMENT ON TABLE audit.event_log IS 'Mandatory audit trail for critical business operations.';
COMMENT ON TABLE audit.schema_migration IS 'Tracks SQL migration execution, checksums, status, and failure evidence.';
