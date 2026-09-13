CREATE SCHEMA IF NOT EXISTS ops;
CREATE SCHEMA IF NOT EXISTS rpt;
CREATE SCHEMA IF NOT EXISTS stg;
CREATE SCHEMA IF NOT EXISTS audit;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS btree_gist;

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
    email TEXT,
    national_id_hash TEXT,
    national_id_last4 TEXT,
    phone_number TEXT,
    hire_date DATE NOT NULL,
    termination_date DATE,
    employment_status TEXT NOT NULL DEFAULT 'active',
    employment_type TEXT NOT NULL,
    birth_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT employee_national_id_last4_format_check
        CHECK (national_id_last4 IS NULL OR national_id_last4 ~ '^[0-9]{4}$'),
    CONSTRAINT employee_phone_number_format_check
        CHECK (phone_number IS NULL OR phone_number ~ '^[0-9+() -]{10,20}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_employee_company_national_id_hash
    ON ops.employee (company_id, national_id_hash)
    WHERE national_id_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_employee_company_external_ref
    ON ops.employee (company_id, UPPER(BTRIM(external_employee_ref)))
    WHERE NULLIF(BTRIM(external_employee_ref), '') IS NOT NULL;

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
    requested_username TEXT,
    requested_email TEXT,
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
    CONSTRAINT seller_code_request_identity_check CHECK (
        (requested_username IS NULL AND requested_email IS NULL)
        OR (NULLIF(BTRIM(requested_username), '') IS NOT NULL AND NULLIF(BTRIM(requested_email), '') IS NOT NULL)
    ),
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

CREATE UNIQUE INDEX idx_seller_code_request_open_username_unique
    ON ops.seller_code_request (LOWER(requested_username))
    WHERE requested_username IS NOT NULL AND request_status IN ('pending_hr_approval', 'approved');

CREATE UNIQUE INDEX idx_seller_code_request_open_email_unique
    ON ops.seller_code_request (LOWER(requested_email))
    WHERE requested_email IS NOT NULL AND request_status IN ('pending_hr_approval', 'approved');

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

CREATE TABLE ops.identity_lifecycle_job (
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
    CONSTRAINT identity_lifecycle_job_operation_check CHECK (operation IN ('provision', 'enable', 'disable', 'update_profile')),
    CONSTRAINT identity_lifecycle_job_status_check CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    CONSTRAINT identity_lifecycle_job_attempts_check CHECK (attempts >= 0)
);

CREATE INDEX idx_identity_lifecycle_job_dispatch
    ON ops.identity_lifecycle_job (status, available_at, created_at)
    WHERE status IN ('pending', 'processing');

CREATE UNIQUE INDEX idx_identity_lifecycle_job_user_active_operation
    ON ops.identity_lifecycle_job (user_id, operation)
    WHERE status IN ('pending', 'processing');

CREATE TABLE ops.user_action_store_assignment (
    user_action_store_assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    start_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (end_at IS NULL OR end_at >= start_at),
    CONSTRAINT ex_user_action_store_assignment_no_overlap_v1
        EXCLUDE USING gist (
            user_id WITH =,
            store_id WITH =,
            tstzrange(start_at, end_at, '[)') WITH &&
        )
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
    approval_evidence_json JSONB,
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
    evidence_policy TEXT NOT NULL DEFAULT 'none',
    max_evidence_count INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT ck_checklist_template_item_evidence_policy
        CHECK (evidence_policy IN ('none', 'optional', 'required')),
    CONSTRAINT ck_checklist_template_item_evidence_count CHECK (
        (evidence_policy = 'none' AND max_evidence_count = 0)
        OR (evidence_policy IN ('optional', 'required') AND max_evidence_count > 0)
    ),
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
    evidence_version_no INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
    CONSTRAINT ck_checklist_instance_evidence_version CHECK (evidence_version_no >= 0)
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_store_store_region_identity
    ON ops.store (store_id, region_id);

CREATE TABLE IF NOT EXISTS ops.region_weekly_visit_plan (
    plan_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    region_id UUID NOT NULL REFERENCES ops.region(region_id),
    week_start_date DATE NOT NULL,
    visit_type TEXT NOT NULL DEFAULT 'BM_STORE_VISIT',
    timezone_name TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_region_weekly_visit_plan_scope UNIQUE (region_id, week_start_date, visit_type),
    CONSTRAINT uq_region_weekly_visit_plan_identity UNIQUE (plan_id, region_id, week_start_date, visit_type),
    CONSTRAINT ck_region_weekly_visit_plan_monday CHECK (EXTRACT(ISODOW FROM week_start_date) = 1),
    CONSTRAINT ck_region_weekly_visit_plan_bm_only CHECK (visit_type = 'BM_STORE_VISIT'),
    CONSTRAINT ck_region_weekly_visit_plan_timezone CHECK (timezone_name = 'Europe/Istanbul')
);

CREATE TABLE IF NOT EXISTS ops.region_weekly_visit_plan_revision (
    revision_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL,
    region_id UUID NOT NULL,
    week_start_date DATE NOT NULL,
    visit_type TEXT NOT NULL DEFAULT 'BM_STORE_VISIT',
    revision_no INTEGER NOT NULL,
    created_by_user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    idempotency_key UUID NOT NULL,
    request_sha256 CHAR(64) NOT NULL,
    is_current BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_region_weekly_visit_plan_revision_number UNIQUE (plan_id, revision_no),
    CONSTRAINT uq_region_weekly_visit_plan_revision_idempotency UNIQUE (plan_id, idempotency_key),
    CONSTRAINT uq_region_weekly_visit_plan_revision_identity UNIQUE (revision_id, plan_id, region_id, week_start_date, visit_type),
    CONSTRAINT fk_region_weekly_visit_plan_revision_plan FOREIGN KEY (plan_id, region_id, week_start_date, visit_type)
        REFERENCES ops.region_weekly_visit_plan(plan_id, region_id, week_start_date, visit_type),
    CONSTRAINT ck_region_weekly_visit_plan_revision_number CHECK (revision_no > 0),
    CONSTRAINT ck_region_weekly_visit_plan_revision_bm_only CHECK (visit_type = 'BM_STORE_VISIT'),
    CONSTRAINT ck_region_weekly_visit_plan_revision_digest CHECK (request_sha256 ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_region_weekly_visit_plan_revision_current
    ON ops.region_weekly_visit_plan_revision (plan_id)
    WHERE is_current;

CREATE TABLE IF NOT EXISTS ops.region_weekly_visit_plan_item (
    plan_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    revision_id UUID NOT NULL,
    plan_id UUID NOT NULL,
    region_id UUID NOT NULL,
    week_start_date DATE NOT NULL,
    store_id UUID NOT NULL,
    planned_date DATE NOT NULL,
    visit_type TEXT NOT NULL DEFAULT 'BM_STORE_VISIT',
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_region_weekly_visit_plan_item_day UNIQUE (revision_id, store_id, planned_date, visit_type),
    CONSTRAINT fk_region_weekly_visit_plan_item_revision FOREIGN KEY (revision_id, plan_id, region_id, week_start_date, visit_type)
        REFERENCES ops.region_weekly_visit_plan_revision(revision_id, plan_id, region_id, week_start_date, visit_type),
    CONSTRAINT fk_region_weekly_visit_plan_item_store_region FOREIGN KEY (store_id, region_id)
        REFERENCES ops.store(store_id, region_id),
    CONSTRAINT ck_region_weekly_visit_plan_item_weekday CHECK (planned_date BETWEEN week_start_date AND week_start_date + 5),
    CONSTRAINT ck_region_weekly_visit_plan_item_bm_only CHECK (visit_type = 'BM_STORE_VISIT'),
    CONSTRAINT ck_region_weekly_visit_plan_item_display_order CHECK (display_order >= 0)
);

CREATE TABLE IF NOT EXISTS ops.region_weekly_visit_plan_completion (
    visit_completion_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_item_id UUID NOT NULL REFERENCES ops.region_weekly_visit_plan_item(plan_item_id),
    completed_by_user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    idempotency_key UUID NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_region_weekly_visit_plan_completion_item UNIQUE (plan_item_id),
    CONSTRAINT uq_region_weekly_visit_plan_completion_idempotency UNIQUE (plan_item_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_region_weekly_visit_plan_completion_completed_at
    ON ops.region_weekly_visit_plan_completion (completed_at DESC, plan_item_id);

CREATE OR REPLACE FUNCTION ops.guard_region_weekly_visit_plan_revision_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'UPDATE'
       AND OLD.is_current
       AND NOT NEW.is_current
       AND (to_jsonb(NEW) - 'is_current') = (to_jsonb(OLD) - 'is_current') THEN
        RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Weekly visit plan revisions are append-only; operation % is not allowed.', TG_OP
        USING ERRCODE = '55000';
END;
$$;

CREATE OR REPLACE FUNCTION ops.guard_region_weekly_visit_plan_item_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Weekly visit plan revision items are immutable; operation % is not allowed.', TG_OP
        USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS trg_region_weekly_visit_plan_revision_append_only ON ops.region_weekly_visit_plan_revision;
CREATE TRIGGER trg_region_weekly_visit_plan_revision_append_only
    BEFORE UPDATE OR DELETE ON ops.region_weekly_visit_plan_revision
    FOR EACH ROW EXECUTE FUNCTION ops.guard_region_weekly_visit_plan_revision_mutation();

DROP TRIGGER IF EXISTS trg_region_weekly_visit_plan_item_immutable ON ops.region_weekly_visit_plan_item;
CREATE TRIGGER trg_region_weekly_visit_plan_item_immutable
    BEFORE UPDATE OR DELETE ON ops.region_weekly_visit_plan_item
    FOR EACH ROW EXECUTE FUNCTION ops.guard_region_weekly_visit_plan_item_mutation();

CREATE INDEX IF NOT EXISTS idx_region_weekly_visit_plan_item_revision_date
    ON ops.region_weekly_visit_plan_item (revision_id, planned_date, store_id);

CREATE INDEX IF NOT EXISTS idx_region_weekly_visit_plan_item_store_date
    ON ops.region_weekly_visit_plan_item (store_id, planned_date DESC, revision_id);

CREATE INDEX IF NOT EXISTS idx_checklist_instance_completed_visit_lookup
    ON ops.checklist_instance (store_id, completed_at DESC)
    INCLUDE (checklist_template_id, checklist_instance_id)
    WHERE status = 'completed' AND completed_at IS NOT NULL;

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

CREATE TABLE IF NOT EXISTS ops.company_daily_kpi_component_outcome (
    component_outcome_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_source_id UUID NOT NULL REFERENCES stg.integration_source(integration_source_id),
    business_date DATE NOT NULL,
    operation TEXT NOT NULL,
    status TEXT NOT NULL,
    aggregate_count INTEGER NOT NULL,
    retry_count INTEGER NOT NULL,
    safe_reason_code TEXT,
    sanitized_set_digest CHAR(64),
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_company_daily_kpi_component_identity
        UNIQUE (integration_source_id, business_date, operation),
    CONSTRAINT uq_company_daily_kpi_component_fact_identity
        UNIQUE (component_outcome_id, business_date, operation),
    CONSTRAINT ck_company_daily_kpi_component_operation
        CHECK (operation IN ('sales', 'footfall', 'gsm')),
    CONSTRAINT ck_company_daily_kpi_component_status
        CHECK (status IN ('succeeded', 'failed', 'missed')),
    CONSTRAINT ck_company_daily_kpi_component_counts
        CHECK (aggregate_count >= 0 AND retry_count >= 0),
    CONSTRAINT ck_company_daily_kpi_component_reason
        CHECK (safe_reason_code IS NULL OR safe_reason_code ~ '^[a-z0-9_]{1,64}$'),
    CONSTRAINT ck_company_daily_kpi_component_digest
        CHECK (sanitized_set_digest IS NULL OR sanitized_set_digest ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_company_daily_kpi_component_outcome_shape CHECK (
        (
            status = 'succeeded'
            AND sanitized_set_digest IS NOT NULL
        )
        OR (
            status IN ('failed', 'missed')
            AND aggregate_count = 0
            AND sanitized_set_digest IS NULL
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_company_daily_kpi_component_range
    ON ops.company_daily_kpi_component_outcome (
        integration_source_id,
        operation,
        business_date
    );

CREATE TABLE IF NOT EXISTS ops.company_daily_kpi_employee_sales (
    employee_sales_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_outcome_id UUID NOT NULL,
    business_date DATE NOT NULL,
    operation TEXT NOT NULL DEFAULT 'sales',
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    employee_id UUID NOT NULL REFERENCES ops.employee(employee_id),
    sale_invoice_count INTEGER NOT NULL,
    return_invoice_count INTEGER NOT NULL,
    sale_quantity NUMERIC(38,12) NOT NULL,
    signed_return_quantity NUMERIC(38,12) NOT NULL,
    net_quantity NUMERIC(38,12) NOT NULL,
    sale_amount_try NUMERIC(38,12) NOT NULL,
    signed_return_amount_try NUMERIC(38,12) NOT NULL,
    net_amount_try NUMERIC(38,12) NOT NULL,
    currency_code CHAR(3) NOT NULL DEFAULT 'TRY',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_company_daily_kpi_employee_sales_grain
        UNIQUE (component_outcome_id, business_date, store_id, employee_id),
    CONSTRAINT fk_company_daily_kpi_employee_sales_component
        FOREIGN KEY (component_outcome_id, business_date, operation)
        REFERENCES ops.company_daily_kpi_component_outcome (
            component_outcome_id,
            business_date,
            operation
        ) ON DELETE CASCADE,
    CONSTRAINT ck_company_daily_kpi_employee_sales_operation CHECK (operation = 'sales'),
    CONSTRAINT ck_company_daily_kpi_employee_sales_counts
        CHECK (sale_invoice_count >= 0 AND return_invoice_count >= 0),
    CONSTRAINT ck_company_daily_kpi_employee_sales_signs
        CHECK (
            sale_quantity >= 0
            AND signed_return_quantity <= 0
            AND sale_amount_try >= 0
            AND signed_return_amount_try <= 0
        ),
    CONSTRAINT ck_company_daily_kpi_employee_sales_quantity_net
        CHECK (net_quantity = sale_quantity + signed_return_quantity),
    CONSTRAINT ck_company_daily_kpi_employee_sales_amount_net
        CHECK (net_amount_try = sale_amount_try + signed_return_amount_try),
    CONSTRAINT ck_company_daily_kpi_employee_sales_currency CHECK (currency_code = 'TRY')
);

CREATE INDEX IF NOT EXISTS idx_company_daily_kpi_employee_sales_store_day
    ON ops.company_daily_kpi_employee_sales (store_id, business_date);

CREATE INDEX IF NOT EXISTS idx_company_daily_kpi_employee_sales_employee_day
    ON ops.company_daily_kpi_employee_sales (employee_id, business_date);

CREATE TABLE IF NOT EXISTS ops.company_daily_kpi_store_sales (
    store_sales_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_outcome_id UUID NOT NULL,
    business_date DATE NOT NULL,
    operation TEXT NOT NULL DEFAULT 'sales',
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    sale_invoice_count INTEGER NOT NULL,
    return_invoice_count INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_company_daily_kpi_store_sales_grain
        UNIQUE (component_outcome_id, business_date, store_id),
    CONSTRAINT fk_company_daily_kpi_store_sales_component
        FOREIGN KEY (component_outcome_id, business_date, operation)
        REFERENCES ops.company_daily_kpi_component_outcome (
            component_outcome_id,
            business_date,
            operation
        ) ON DELETE CASCADE,
    CONSTRAINT ck_company_daily_kpi_store_sales_operation CHECK (operation = 'sales'),
    CONSTRAINT ck_company_daily_kpi_store_sales_counts
        CHECK (sale_invoice_count >= 0 AND return_invoice_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_company_daily_kpi_store_sales_store_day
    ON ops.company_daily_kpi_store_sales (store_id, business_date);

CREATE TABLE IF NOT EXISTS ops.company_daily_kpi_store_footfall (
    store_footfall_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_outcome_id UUID NOT NULL,
    business_date DATE NOT NULL,
    operation TEXT NOT NULL DEFAULT 'footfall',
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    footfall BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_company_daily_kpi_store_footfall_grain
        UNIQUE (component_outcome_id, business_date, store_id),
    CONSTRAINT fk_company_daily_kpi_store_footfall_component
        FOREIGN KEY (component_outcome_id, business_date, operation)
        REFERENCES ops.company_daily_kpi_component_outcome (
            component_outcome_id,
            business_date,
            operation
        ) ON DELETE CASCADE,
    CONSTRAINT ck_company_daily_kpi_store_footfall_operation CHECK (operation = 'footfall'),
    CONSTRAINT ck_company_daily_kpi_store_footfall_value CHECK (footfall >= 0)
);

CREATE INDEX IF NOT EXISTS idx_company_daily_kpi_store_footfall_store_day
    ON ops.company_daily_kpi_store_footfall (store_id, business_date);

CREATE TABLE IF NOT EXISTS ops.company_daily_kpi_store_gsm (
    store_gsm_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_outcome_id UUID NOT NULL,
    business_date DATE NOT NULL,
    operation TEXT NOT NULL DEFAULT 'gsm',
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    yes_customer_count BIGINT NOT NULL,
    total_customer_count BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_company_daily_kpi_store_gsm_grain
        UNIQUE (component_outcome_id, business_date, store_id),
    CONSTRAINT fk_company_daily_kpi_store_gsm_component
        FOREIGN KEY (component_outcome_id, business_date, operation)
        REFERENCES ops.company_daily_kpi_component_outcome (
            component_outcome_id,
            business_date,
            operation
        ) ON DELETE CASCADE,
    CONSTRAINT ck_company_daily_kpi_store_gsm_operation CHECK (operation = 'gsm'),
    CONSTRAINT ck_company_daily_kpi_store_gsm_counts
        CHECK (
            yes_customer_count >= 0
            AND total_customer_count >= 0
            AND yes_customer_count <= total_customer_count
        )
);

CREATE INDEX IF NOT EXISTS idx_company_daily_kpi_store_gsm_store_day
    ON ops.company_daily_kpi_store_gsm (store_id, business_date);

CREATE TABLE IF NOT EXISTS ops.personnel_observation_attempt (
    source_id UUID NOT NULL REFERENCES stg.integration_source(integration_source_id),
    business_date DATE NOT NULL,
    generation BIGINT NOT NULL DEFAULT 0 CHECK (generation >= 0),
    accepted_generation BIGINT NOT NULL DEFAULT 0,
    accepted_digest CHAR(64),
    PRIMARY KEY (source_id, business_date),
    CHECK (accepted_generation >= 0 AND accepted_generation <= generation),
    CHECK ((accepted_generation = 0 AND accepted_digest IS NULL)
        OR (accepted_generation > 0 AND accepted_digest IS NOT NULL AND accepted_digest ~ '^[a-f0-9]{64}$'))
);

CREATE TABLE IF NOT EXISTS ops.personnel_observation (
    source_id UUID NOT NULL,
    business_date DATE NOT NULL,
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    personnel_code TEXT NOT NULL CHECK (
        length(personnel_code) BETWEEN 1 AND 80
        AND personnel_code = btrim(personnel_code)
    ),
    PRIMARY KEY (source_id, business_date, store_id, personnel_code),
    FOREIGN KEY (source_id, business_date)
        REFERENCES ops.personnel_observation_attempt(source_id, business_date)
);

CREATE INDEX IF NOT EXISTS ix_personnel_observation_store_date
    ON ops.personnel_observation (store_id, business_date DESC, personnel_code);

COMMENT ON TABLE ops.personnel_observation IS
    'Code-only sales observations; not employment, assignment, identity or authorization records.';

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

CREATE TABLE IF NOT EXISTS stg.roster_reconciliation_input (
    roster_reconciliation_input_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_file TEXT NOT NULL,
    source_sheet TEXT NOT NULL,
    source_period TEXT NOT NULL DEFAULT '',
    source_kind TEXT NOT NULL,
    row_number INTEGER NOT NULL,
    raw_store_name TEXT,
    raw_store_code TEXT,
    raw_employee_code TEXT,
    raw_employee_name TEXT,
    raw_position_name TEXT,
    raw_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
    normalized_store_key TEXT NOT NULL DEFAULT '',
    normalized_employee_key TEXT NOT NULL DEFAULT '',
    match_status TEXT NOT NULL DEFAULT 'pending',
    match_notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_roster_reconciliation_source_kind
      CHECK (source_kind IN ('current_roster', 'dealer_roster', 'target', 'sales_kpi')),
    CONSTRAINT chk_roster_reconciliation_match_status
      CHECK (match_status IN ('pending', 'matched', 'missing_store', 'missing_employee', 'ambiguous', 'ignored', 'review_required')),
    CONSTRAINT uq_roster_reconciliation_source_row
      UNIQUE (source_file, source_sheet, source_kind, source_period, row_number)
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

CREATE INDEX IF NOT EXISTS idx_roster_reconciliation_period_kind
    ON stg.roster_reconciliation_input (source_period, source_kind);

CREATE INDEX IF NOT EXISTS idx_roster_reconciliation_store_key
    ON stg.roster_reconciliation_input (normalized_store_key);

CREATE INDEX IF NOT EXISTS idx_roster_reconciliation_employee_key
    ON stg.roster_reconciliation_input (normalized_employee_key);

CREATE INDEX IF NOT EXISTS idx_roster_reconciliation_status
    ON stg.roster_reconciliation_input (match_status);

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
COMMENT ON COLUMN ops.target_distribution_request.approval_evidence_json IS 'Stores original and final target approval evidence for adjusted approvals without changing approved target references.';
COMMENT ON TABLE ops.personnel_target_reference IS 'Approved personnel target references promoted from region-approved target distribution requests for scoring.';
COMMENT ON TABLE ops.store_action_plan IS 'Store-owned follow-up plans created from approved Store Action candidate sources.';
COMMENT ON TABLE ops.pilot_feedback IS 'Controlled pilot feedback intake for classifying P0/P1/P2/P3 findings without changing pilot go/no-go semantics.';
COMMENT ON TABLE ops.feed_post IS 'Scoped operational announcements and challenge posts. Challenge posts announce focus windows but do not calculate scores.';
COMMENT ON TABLE ops.checklist_acknowledgement IS 'Store acknowledgement evidence for completed checklist instances.';
COMMENT ON TABLE ops.region_weekly_visit_plan IS 'Region-owned Monday-to-Saturday BM visit planning aggregate; ownership survives manager rotation.';
COMMENT ON TABLE ops.region_weekly_visit_plan_revision IS 'Complete versioned weekly plan snapshots with actor, idempotency, and canonical request digest evidence.';
COMMENT ON TABLE ops.region_weekly_visit_plan_item IS 'Store and local-date entries for one weekly plan revision. Operational state is derived from real checklist execution.';
COMMENT ON TABLE ops.region_weekly_visit_plan_completion IS 'Immutable attendance evidence for a planned BM visit when no checklist is completed; it never changes checklist scores.';
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
COMMENT ON TABLE stg.roster_reconciliation_input IS 'Pilot-only staging analysis table for roster, target, and sales/KPI reconciliation dry-runs. Product tables must not read from this table.';
COMMENT ON TABLE audit.event_log IS 'Mandatory audit trail for critical business operations.';
COMMENT ON TABLE audit.schema_migration IS 'Tracks SQL migration execution, checksums, status, and failure evidence.';
CREATE UNIQUE INDEX IF NOT EXISTS idx_region_company_identity
    ON ops.region (region_id, company_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_store_company_region_identity
    ON ops.store (store_id, company_id, region_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_checklist_template_company_identity
    ON ops.checklist_template (checklist_template_id, company_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_checklist_template_item_template_identity
    ON ops.checklist_template_item (template_item_id, checklist_template_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_checklist_instance_store_identity
    ON ops.checklist_instance (checklist_instance_id, store_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_checklist_response_instance_identity
    ON ops.checklist_response (response_id, checklist_instance_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_checklist_response_item_identity
    ON ops.checklist_response (response_id, checklist_instance_id, template_item_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_store_action_plan_scope_identity
    ON ops.store_action_plan (store_action_plan_id, company_id, region_id, store_id);

CREATE TABLE IF NOT EXISTS ops.evidence_retention_policy (
    retention_policy_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    version_no INTEGER NOT NULL,
    evidence_retention_days INTEGER NOT NULL,
    reference_retention_days INTEGER NOT NULL,
    derived_retention_days INTEGER NOT NULL,
    effective_from TIMESTAMPTZ NOT NULL,
    effective_to TIMESTAMPTZ,
    created_by_user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_evidence_retention_policy_version UNIQUE (company_id, version_no),
    CONSTRAINT uq_evidence_retention_policy_company UNIQUE (retention_policy_id, company_id),
    CONSTRAINT uq_evidence_retention_policy_exact UNIQUE (retention_policy_id, company_id, version_no),
    CONSTRAINT ck_evidence_retention_policy_version CHECK (version_no > 0),
    CONSTRAINT ck_evidence_retention_policy_days CHECK (
        evidence_retention_days > 0
        AND reference_retention_days > 0
        AND derived_retention_days > 0
    ),
    CONSTRAINT ck_evidence_retention_policy_window CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE TABLE IF NOT EXISTS ops.media_asset (
    media_asset_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    region_id UUID,
    store_id UUID,
    classification TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'initiated',
    provider_adapter_id TEXT NOT NULL DEFAULT 'r2',
    jurisdiction TEXT NOT NULL DEFAULT 'eu',
    capture_source TEXT NOT NULL,
    raw_object_key TEXT NOT NULL,
    raw_object_version_id TEXT,
    canonical_object_key TEXT,
    thumbnail_object_key TEXT,
    thumbnail_object_version_id TEXT,
    detected_mime_type TEXT,
    byte_count BIGINT,
    width_px INTEGER,
    height_px INTEGER,
    original_sha256 CHAR(64),
    canonical_sha256 CHAR(64),
    uploaded_by_user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    uploaded_at TIMESTAMPTZ,
    quarantined_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    canonicalized_at TIMESTAMPTZ,
    finalized_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    rejection_reason TEXT,
    metadata_stripped_at TIMESTAMPTZ,
    safety_scanned_at TIMESTAMPTZ,
    raw_disposed_at TIMESTAMPTZ,
    raw_security_hold BOOLEAN NOT NULL DEFAULT FALSE,
    retention_policy_id UUID,
    retention_policy_version INTEGER,
    expires_at TIMESTAMPTZ,
    legal_hold BOOLEAN NOT NULL DEFAULT FALSE,
    operational_hold BOOLEAN NOT NULL DEFAULT FALSE,
    active_workflow_hold BOOLEAN NOT NULL DEFAULT FALSE,
    ai_review_hold BOOLEAN NOT NULL DEFAULT FALSE,
    expired_at TIMESTAMPTZ,
    purge_pending_at TIMESTAMPTZ,
    purge_manifest_id UUID,
    deleted_at TIMESTAMPTZ,
    deletion_reason TEXT,
    tombstone_sha256 CHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_media_asset_company UNIQUE (media_asset_id, company_id),
    CONSTRAINT uq_media_asset_store UNIQUE (media_asset_id, company_id, store_id),
    CONSTRAINT uq_media_asset_raw_object UNIQUE (raw_object_key),
    CONSTRAINT fk_media_asset_region_company FOREIGN KEY (region_id, company_id)
        REFERENCES ops.region(region_id, company_id),
    CONSTRAINT fk_media_asset_store_scope FOREIGN KEY (store_id, company_id, region_id)
        REFERENCES ops.store(store_id, company_id, region_id),
    CONSTRAINT fk_media_asset_retention_policy FOREIGN KEY (retention_policy_id, company_id, retention_policy_version)
        REFERENCES ops.evidence_retention_policy(retention_policy_id, company_id, version_no),
    CONSTRAINT ck_media_asset_scope CHECK (store_id IS NULL OR region_id IS NOT NULL),
    CONSTRAINT ck_media_asset_classification CHECK (
        classification IN ('checklist_evidence', 'action_evidence', 'vm_reference', 'derived_artifact')
    ),
    CONSTRAINT ck_media_asset_state CHECK (
        state IN ('initiated', 'uploaded', 'quarantined', 'accepted', 'canonicalized', 'ready', 'rejected', 'expired', 'purge_pending', 'deleted_tombstone')
    ),
    CONSTRAINT ck_media_asset_capture_source CHECK (capture_source IN ('camera', 'gallery', 'system_generated')),
    CONSTRAINT ck_media_asset_storage_provider_jurisdiction CHECK (
        (provider_adapter_id = 'r2' AND jurisdiction = 'eu')
        OR (provider_adapter_id = 'seaweedfs' AND jurisdiction = 'onprem')
    ),
    CONSTRAINT ck_media_asset_raw_key_private CHECK (
        raw_object_key = btrim(raw_object_key)
        AND length(raw_object_key) > 0
        AND raw_object_key ~ '^[A-Za-z0-9][A-Za-z0-9._/-]*$'
        AND raw_object_key !~ '(^|/)\.\.?(/|$)'
        AND raw_object_key !~ '//'
    ),
    CONSTRAINT ck_media_asset_raw_object_version_id_private CHECK (
        raw_object_version_id IS NULL OR (
            raw_object_version_id = btrim(raw_object_version_id)
            AND octet_length(raw_object_version_id) > 0
            AND octet_length(raw_object_version_id) <= 1024
            AND raw_object_version_id !~ '[[:cntrl:]]'
        )
    ),
    CONSTRAINT ck_media_asset_canonical_key_private CHECK (canonical_object_key IS NULL OR (
        canonical_object_key = btrim(canonical_object_key)
        AND length(canonical_object_key) > 0
        AND canonical_object_key ~ '^[A-Za-z0-9][A-Za-z0-9._/-]*$'
        AND canonical_object_key !~ '(^|/)\.\.?(/|$)'
        AND canonical_object_key !~ '//'
    )),
    CONSTRAINT ck_media_asset_thumbnail_key_private CHECK (thumbnail_object_key IS NULL OR (
        thumbnail_object_key = btrim(thumbnail_object_key)
        AND length(thumbnail_object_key) > 0
        AND thumbnail_object_key ~ '^[A-Za-z0-9][A-Za-z0-9._/-]*$'
        AND thumbnail_object_key !~ '(^|/)\.\.?(/|$)'
        AND thumbnail_object_key !~ '//'
    )),
    CONSTRAINT ck_media_asset_thumbnail_object_version_id_private CHECK (
        thumbnail_object_version_id IS NULL OR (
            thumbnail_object_version_id = btrim(thumbnail_object_version_id)
            AND octet_length(thumbnail_object_version_id) > 0
            AND octet_length(thumbnail_object_version_id) <= 1024
            AND thumbnail_object_version_id !~ '[[:cntrl:]]'
        )
    ),
    CONSTRAINT ck_media_asset_byte_count CHECK (byte_count IS NULL OR byte_count > 0),
    CONSTRAINT ck_media_asset_dimensions CHECK (
        (width_px IS NULL AND height_px IS NULL)
        OR (width_px > 0 AND height_px > 0)
    ),
    CONSTRAINT ck_media_asset_original_hash CHECK (original_sha256 IS NULL OR original_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_media_asset_canonical_hash CHECK (canonical_sha256 IS NULL OR canonical_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_media_asset_tombstone_hash CHECK (tombstone_sha256 IS NULL OR tombstone_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_media_asset_ready CHECK (state <> 'ready' OR (
        canonical_object_key IS NOT NULL
        AND thumbnail_object_key IS NOT NULL
        AND detected_mime_type IS NOT NULL
        AND byte_count IS NOT NULL
        AND width_px IS NOT NULL
        AND height_px IS NOT NULL
        AND original_sha256 IS NOT NULL
        AND canonical_sha256 IS NOT NULL
        AND metadata_stripped_at IS NOT NULL
        AND safety_scanned_at IS NOT NULL
        AND raw_disposed_at IS NOT NULL
        AND retention_policy_id IS NOT NULL
        AND retention_policy_version IS NOT NULL
        AND expires_at IS NOT NULL
        AND finalized_at IS NOT NULL
    )),
    CONSTRAINT ck_media_asset_rejected CHECK (
        state <> 'rejected'
        OR (rejected_at IS NOT NULL AND rejection_reason IS NOT NULL AND (raw_disposed_at IS NOT NULL OR raw_security_hold))
    ),
    CONSTRAINT ck_media_asset_deleted_tombstone CHECK (state <> 'deleted_tombstone' OR (
        deleted_at IS NOT NULL
        AND deletion_reason IS NOT NULL
        AND tombstone_sha256 IS NOT NULL
        AND NOT legal_hold
        AND NOT operational_hold
        AND NOT active_workflow_hold
        AND NOT ai_review_hold
    ))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_asset_canonical_object_unique
    ON ops.media_asset (canonical_object_key)
    WHERE canonical_object_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_asset_thumbnail_object_unique
    ON ops.media_asset (thumbnail_object_key)
    WHERE thumbnail_object_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_media_asset_scope_state
    ON ops.media_asset (company_id, region_id, store_id, state, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_media_asset_cleanup_eligibility
    ON ops.media_asset (expires_at, media_asset_id)
    WHERE state = 'ready'
      AND NOT legal_hold
      AND NOT operational_hold
      AND NOT active_workflow_hold
      AND NOT ai_review_hold;

CREATE TABLE IF NOT EXISTS ops.checklist_response_media (
    checklist_response_media_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    region_id UUID NOT NULL,
    store_id UUID NOT NULL,
    checklist_instance_id UUID NOT NULL,
    response_id UUID NOT NULL,
    template_item_id UUID NOT NULL REFERENCES ops.checklist_template_item(template_item_id),
    media_asset_id UUID NOT NULL,
    purpose TEXT NOT NULL DEFAULT 'checklist_evidence',
    display_order INTEGER NOT NULL DEFAULT 0,
    linked_by_user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locked_at TIMESTAMPTZ,
    unlinked_at TIMESTAMPTZ,
    unlinked_by_user_id UUID REFERENCES ops.user_account(user_id),
    unlink_reason TEXT,
    CONSTRAINT uq_checklist_response_media_asset UNIQUE (checklist_instance_id, template_item_id, media_asset_id),
    CONSTRAINT uq_checklist_response_media_order UNIQUE (checklist_instance_id, template_item_id, display_order),
    CONSTRAINT fk_checklist_response_media_store FOREIGN KEY (store_id, company_id, region_id)
        REFERENCES ops.store(store_id, company_id, region_id),
    CONSTRAINT fk_checklist_response_media_instance FOREIGN KEY (checklist_instance_id, store_id)
        REFERENCES ops.checklist_instance(checklist_instance_id, store_id),
    CONSTRAINT fk_checklist_response_media_response FOREIGN KEY (response_id, checklist_instance_id, template_item_id)
        REFERENCES ops.checklist_response(response_id, checklist_instance_id, template_item_id),
    CONSTRAINT fk_checklist_response_media_asset FOREIGN KEY (media_asset_id, company_id, store_id)
        REFERENCES ops.media_asset(media_asset_id, company_id, store_id),
    CONSTRAINT ck_checklist_response_media_purpose CHECK (purpose = 'checklist_evidence'),
    CONSTRAINT ck_checklist_response_media_order CHECK (display_order >= 0),
    CONSTRAINT ck_checklist_response_media_unlink CHECK (
        (unlinked_at IS NULL AND unlinked_by_user_id IS NULL AND unlink_reason IS NULL)
        OR (unlinked_at IS NOT NULL AND unlinked_by_user_id IS NOT NULL AND length(btrim(unlink_reason)) > 0)
    ),
    CONSTRAINT ck_checklist_response_media_lock CHECK (locked_at IS NULL OR unlinked_at IS NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_checklist_instance_template_identity
    ON ops.checklist_instance (checklist_instance_id, checklist_template_id);

CREATE TABLE IF NOT EXISTS ops.checklist_instance_item_policy (
    checklist_instance_id UUID NOT NULL,
    checklist_template_id UUID NOT NULL,
    template_item_id UUID NOT NULL,
    evidence_policy TEXT NOT NULL,
    max_evidence_count INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (checklist_instance_id, template_item_id),
    CONSTRAINT uq_checklist_instance_item_policy UNIQUE (checklist_instance_id, template_item_id),
    CONSTRAINT fk_checklist_instance_item_policy_instance
        FOREIGN KEY (checklist_instance_id, checklist_template_id)
        REFERENCES ops.checklist_instance(checklist_instance_id, checklist_template_id) ON DELETE CASCADE,
    CONSTRAINT fk_checklist_instance_item_policy_item
        FOREIGN KEY (template_item_id, checklist_template_id)
        REFERENCES ops.checklist_template_item(template_item_id, checklist_template_id),
    CONSTRAINT ck_checklist_instance_item_policy_value
        CHECK (evidence_policy IN ('none', 'optional', 'required')),
    CONSTRAINT ck_checklist_instance_item_policy_count CHECK (
        (evidence_policy = 'none' AND max_evidence_count = 0)
        OR (evidence_policy IN ('optional', 'required') AND max_evidence_count > 0)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_checklist_response_media_global_asset
  ON ops.checklist_response_media (media_asset_id);

CREATE TABLE IF NOT EXISTS ops.checklist_item_evidence_upload_intent (
  media_asset_id UUID PRIMARY KEY REFERENCES ops.media_asset(media_asset_id),
  checklist_instance_id UUID NOT NULL,
  template_item_id UUID NOT NULL,
  uploaded_by_user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_checklist_item_evidence_upload_intent_policy
    FOREIGN KEY (checklist_instance_id, template_item_id)
    REFERENCES ops.checklist_instance_item_policy(checklist_instance_id, template_item_id)
);

ALTER TABLE ops.checklist_response_media
    ADD CONSTRAINT fk_checklist_response_media_instance_policy
    FOREIGN KEY (checklist_instance_id, template_item_id)
    REFERENCES ops.checklist_instance_item_policy(checklist_instance_id, template_item_id);

CREATE TABLE IF NOT EXISTS ops.photo_evidence_command_receipt (
    photo_evidence_command_receipt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    idempotency_key UUID NOT NULL,
    command_type TEXT NOT NULL,
    command_digest CHAR(64) NOT NULL,
    result_code TEXT NOT NULL,
    result_entity_id UUID,
    result_json JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_photo_evidence_command_receipt UNIQUE (actor_user_id, idempotency_key),
    CONSTRAINT ck_photo_evidence_command_receipt_type
        CHECK (command_type IN ('link', 'unlink')),
    CONSTRAINT ck_photo_evidence_command_receipt_digest
        CHECK (command_digest ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_photo_evidence_command_receipt_result
      CHECK (length(btrim(result_code)) > 0),
    CONSTRAINT ck_photo_evidence_command_receipt_result_json
      CHECK (
        jsonb_typeof(result_json) = 'object'
        AND result_json ?& ARRAY[
          'checklistInstanceId', 'templateItemId', 'evidenceVersion',
          'evidencePolicy', 'maxEvidenceCount', 'evidence'
        ]
        AND result_json
          - 'checklistInstanceId' - 'templateItemId' - 'evidenceVersion'
          - 'evidencePolicy' - 'maxEvidenceCount' - 'evidence' = '{}'::jsonb
      )
);

CREATE TABLE IF NOT EXISTS ops.store_action_solution_attempt (
    solution_attempt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_action_plan_id UUID NOT NULL,
    company_id UUID NOT NULL,
    region_id UUID NOT NULL,
    store_id UUID NOT NULL,
    attempt_no INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'solution_review_pending',
    resolution_note TEXT NOT NULL,
    submitted_by_user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    idempotency_key UUID NOT NULL,
    expected_version INTEGER NOT NULL,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_store_action_solution_attempt_no UNIQUE (store_action_plan_id, attempt_no),
    CONSTRAINT uq_store_action_solution_attempt_idempotency UNIQUE (store_action_plan_id, idempotency_key),
    CONSTRAINT uq_store_action_solution_attempt_scope UNIQUE (solution_attempt_id, store_action_plan_id, company_id, region_id, store_id),
    CONSTRAINT fk_store_action_solution_attempt_plan FOREIGN KEY (store_action_plan_id, company_id, region_id, store_id)
        REFERENCES ops.store_action_plan(store_action_plan_id, company_id, region_id, store_id),
    CONSTRAINT ck_store_action_solution_attempt_no CHECK (attempt_no > 0),
    CONSTRAINT ck_store_action_solution_attempt_version CHECK (expected_version >= 0),
    CONSTRAINT ck_store_action_solution_attempt_note CHECK (length(btrim(resolution_note)) > 0),
    CONSTRAINT ck_store_action_solution_attempt_status CHECK (status = 'solution_review_pending')
);

ALTER TABLE ops.store_action_plan
    ADD COLUMN IF NOT EXISTS photo_evidence_version INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS current_solution_attempt_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_store_action_plan_current_solution_attempt'
          AND conrelid = 'ops.store_action_plan'::regclass
    ) THEN
        ALTER TABLE ops.store_action_plan
            ADD CONSTRAINT fk_store_action_plan_current_solution_attempt
            FOREIGN KEY (current_solution_attempt_id, store_action_plan_id, company_id, region_id, store_id)
            REFERENCES ops.store_action_solution_attempt(solution_attempt_id, store_action_plan_id, company_id, region_id, store_id);
    END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS ops.store_action_plan_evidence (
    store_action_plan_evidence_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_action_plan_id UUID NOT NULL,
    company_id UUID NOT NULL,
    region_id UUID NOT NULL,
    store_id UUID NOT NULL,
    media_asset_id UUID NOT NULL,
    solution_attempt_id UUID,
    purpose TEXT NOT NULL,
    submitted_by_user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_store_action_plan_evidence_asset UNIQUE (store_action_plan_id, media_asset_id, purpose, solution_attempt_id),
    CONSTRAINT fk_store_action_plan_evidence_plan FOREIGN KEY (store_action_plan_id, company_id, region_id, store_id)
        REFERENCES ops.store_action_plan(store_action_plan_id, company_id, region_id, store_id),
    CONSTRAINT fk_store_action_plan_evidence_asset FOREIGN KEY (media_asset_id, company_id, store_id)
        REFERENCES ops.media_asset(media_asset_id, company_id, store_id),
    CONSTRAINT fk_store_action_plan_evidence_attempt FOREIGN KEY (solution_attempt_id, store_action_plan_id, company_id, region_id, store_id)
        REFERENCES ops.store_action_solution_attempt(solution_attempt_id, store_action_plan_id, company_id, region_id, store_id),
    CONSTRAINT ck_store_action_plan_evidence_purpose CHECK (purpose IN ('finding', 'solution')),
    CONSTRAINT ck_store_action_plan_evidence_attempt CHECK (
        (purpose = 'finding' AND solution_attempt_id IS NULL)
        OR (purpose = 'solution' AND solution_attempt_id IS NOT NULL)
    )
);

CREATE TABLE IF NOT EXISTS ops.store_action_solution_review (
    solution_review_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    solution_attempt_id UUID NOT NULL,
    store_action_plan_id UUID NOT NULL,
    company_id UUID NOT NULL,
    region_id UUID NOT NULL,
    store_id UUID NOT NULL,
    decision TEXT NOT NULL,
    reason TEXT,
    reviewed_by_user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    idempotency_key UUID NOT NULL,
    expected_version INTEGER NOT NULL,
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_store_action_solution_review_attempt UNIQUE (solution_attempt_id),
    CONSTRAINT uq_store_action_solution_review_idempotency UNIQUE (store_action_plan_id, idempotency_key),
    CONSTRAINT fk_store_action_solution_review_attempt FOREIGN KEY (solution_attempt_id, store_action_plan_id, company_id, region_id, store_id)
        REFERENCES ops.store_action_solution_attempt(solution_attempt_id, store_action_plan_id, company_id, region_id, store_id),
    CONSTRAINT ck_store_action_solution_review_decision CHECK (decision IN ('approve', 'reject')),
    CONSTRAINT ck_store_action_solution_review_reason CHECK (
        decision <> 'reject' OR (reason IS NOT NULL AND length(btrim(reason)) > 0)
    ),
    CONSTRAINT ck_store_action_solution_review_version CHECK (expected_version >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_store_action_plan_finding_evidence_unique
    ON ops.store_action_plan_evidence (store_action_plan_id, media_asset_id)
    WHERE purpose = 'finding';

CREATE UNIQUE INDEX IF NOT EXISTS idx_store_action_plan_solution_evidence_unique
    ON ops.store_action_plan_evidence (solution_attempt_id, media_asset_id)
    WHERE purpose = 'solution';

CREATE TABLE IF NOT EXISTS ops.visual_reference_set (
    visual_reference_set_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    reference_code TEXT NOT NULL,
    reference_name TEXT NOT NULL,
    lifecycle_status TEXT NOT NULL DEFAULT 'draft',
    current_revision_no INTEGER NOT NULL DEFAULT 0,
    created_by_user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    retired_at TIMESTAMPTZ,
    CONSTRAINT uq_visual_reference_set_code UNIQUE (company_id, reference_code),
    CONSTRAINT uq_visual_reference_set_company UNIQUE (visual_reference_set_id, company_id),
    CONSTRAINT ck_visual_reference_set_status CHECK (lifecycle_status IN ('draft', 'scheduled', 'open', 'closed', 'retired')),
    CONSTRAINT ck_visual_reference_set_revision CHECK (current_revision_no >= 0)
);

CREATE TABLE IF NOT EXISTS ops.visual_reference_draft_item (
    visual_reference_draft_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visual_reference_set_id UUID NOT NULL,
    company_id UUID NOT NULL,
    checklist_template_id UUID NOT NULL,
    template_item_id UUID NOT NULL,
    item_order INTEGER NOT NULL,
    expected_visual_intent TEXT NOT NULL,
    allowed_variants_json JSONB NOT NULL DEFAULT '[]'::JSONB,
    review_instructions TEXT NOT NULL,
    rubric_version TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_visual_reference_draft_item_template UNIQUE (visual_reference_set_id, template_item_id),
    CONSTRAINT uq_visual_reference_draft_item_scope UNIQUE (visual_reference_draft_item_id, visual_reference_set_id, company_id),
    CONSTRAINT fk_visual_reference_draft_item_set FOREIGN KEY (visual_reference_set_id, company_id)
        REFERENCES ops.visual_reference_set(visual_reference_set_id, company_id),
    CONSTRAINT fk_visual_reference_draft_item_template FOREIGN KEY (checklist_template_id, company_id)
        REFERENCES ops.checklist_template(checklist_template_id, company_id),
    CONSTRAINT fk_visual_reference_draft_item_template_item FOREIGN KEY (template_item_id, checklist_template_id)
        REFERENCES ops.checklist_template_item(template_item_id, checklist_template_id),
    CONSTRAINT ck_visual_reference_draft_item_order CHECK (item_order >= 0),
    CONSTRAINT ck_visual_reference_draft_item_variants CHECK (jsonb_typeof(allowed_variants_json) = 'array')
);

CREATE TABLE IF NOT EXISTS ops.visual_reference_draft_item_asset (
    visual_reference_draft_item_asset_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visual_reference_draft_item_id UUID NOT NULL,
    visual_reference_set_id UUID NOT NULL,
    company_id UUID NOT NULL,
    media_asset_id UUID NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_visual_reference_draft_item_asset UNIQUE (visual_reference_draft_item_id, media_asset_id),
    CONSTRAINT uq_visual_reference_draft_item_asset_order UNIQUE (visual_reference_draft_item_id, display_order),
    CONSTRAINT fk_visual_reference_draft_item_asset_item FOREIGN KEY (visual_reference_draft_item_id, visual_reference_set_id, company_id)
        REFERENCES ops.visual_reference_draft_item(visual_reference_draft_item_id, visual_reference_set_id, company_id),
    CONSTRAINT fk_visual_reference_draft_item_asset_media FOREIGN KEY (media_asset_id, company_id)
        REFERENCES ops.media_asset(media_asset_id, company_id),
    CONSTRAINT ck_visual_reference_draft_item_asset_order CHECK (display_order >= 0)
);

CREATE TABLE IF NOT EXISTS ops.visual_campaign_revision (
    campaign_revision_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visual_reference_set_id UUID NOT NULL,
    company_id UUID NOT NULL,
    parent_revision_id UUID,
    revision_no INTEGER NOT NULL,
    expected_revision INTEGER NOT NULL,
    reference_version_no INTEGER NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL,
    submission_closes_at TIMESTAMPTZ NOT NULL,
    timezone_name TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    revision_type TEXT NOT NULL,
    revision_reason TEXT NOT NULL,
    assigned_store_snapshot_sha256 CHAR(64) NOT NULL,
    created_by_user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_visual_campaign_revision_no UNIQUE (visual_reference_set_id, revision_no),
    CONSTRAINT uq_visual_campaign_revision_scope UNIQUE (campaign_revision_id, visual_reference_set_id, company_id),
    CONSTRAINT fk_visual_campaign_revision_set FOREIGN KEY (visual_reference_set_id, company_id)
        REFERENCES ops.visual_reference_set(visual_reference_set_id, company_id),
    CONSTRAINT fk_visual_campaign_revision_parent FOREIGN KEY (parent_revision_id, visual_reference_set_id, company_id)
        REFERENCES ops.visual_campaign_revision(campaign_revision_id, visual_reference_set_id, company_id),
    CONSTRAINT ck_visual_campaign_revision_number CHECK (revision_no > 0 AND reference_version_no > 0),
    CONSTRAINT ck_visual_campaign_revision_expected CHECK (expected_revision >= 0),
    CONSTRAINT ck_visual_campaign_revision_window CHECK (starts_at < submission_closes_at),
    CONSTRAINT ck_visual_campaign_revision_timezone CHECK (timezone_name = 'Europe/Istanbul'),
    CONSTRAINT ck_visual_campaign_revision_type CHECK (
        revision_type IN ('publish', 'extend', 'reopen', 'scope_add', 'scope_withdraw', 'exempt')
    ),
    CONSTRAINT ck_visual_campaign_revision_reason CHECK (length(btrim(revision_reason)) > 0),
    CONSTRAINT ck_visual_campaign_revision_digest CHECK (assigned_store_snapshot_sha256 ~ '^[0-9a-f]{64}$')
);

CREATE TABLE IF NOT EXISTS ops.visual_campaign_assignment (
    assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visual_reference_set_id UUID NOT NULL,
    active_campaign_revision_id UUID NOT NULL,
    company_id UUID NOT NULL,
    region_id UUID NOT NULL,
    store_id UUID NOT NULL,
    first_valid_submission_at TIMESTAMPTZ,
    deadline_status TEXT NOT NULL,
    review_status TEXT NOT NULL,
    current_hold_reason TEXT,
    hold_reconciled_at TIMESTAMPTZ,
    optimistic_version INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_visual_campaign_assignment_store UNIQUE (visual_reference_set_id, store_id),
    CONSTRAINT uq_visual_campaign_assignment_scope UNIQUE (assignment_id, visual_reference_set_id, company_id, region_id, store_id),
    CONSTRAINT fk_visual_campaign_assignment_set FOREIGN KEY (visual_reference_set_id, company_id)
        REFERENCES ops.visual_reference_set(visual_reference_set_id, company_id),
    CONSTRAINT fk_visual_campaign_assignment_revision FOREIGN KEY (active_campaign_revision_id, visual_reference_set_id, company_id)
        REFERENCES ops.visual_campaign_revision(campaign_revision_id, visual_reference_set_id, company_id),
    CONSTRAINT fk_visual_campaign_assignment_store FOREIGN KEY (store_id, company_id, region_id)
        REFERENCES ops.store(store_id, company_id, region_id),
    CONSTRAINT ck_visual_campaign_assignment_deadline CHECK (deadline_status IN ('scheduled', 'open', 'on_time', 'missed', 'exempt', 'withdrawn', 'operational_hold')),
    CONSTRAINT ck_visual_campaign_assignment_review CHECK (review_status IN ('not_submitted', 'review_pending', 'correction_requested', 'completed')),
    CONSTRAINT ck_visual_campaign_assignment_version CHECK (optimistic_version >= 0),
    CONSTRAINT ck_visual_campaign_assignment_hold CHECK (
        deadline_status <> 'operational_hold' OR (current_hold_reason IS NOT NULL AND length(btrim(current_hold_reason)) > 0)
    ),
    CONSTRAINT ck_visual_campaign_assignment_hold_reconciliation CHECK (
        hold_reconciled_at IS NULL OR deadline_status = 'operational_hold'
    )
);

CREATE TABLE IF NOT EXISTS ops.visual_campaign_assignment_outcome (
    assignment_outcome_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL,
    campaign_revision_id UUID NOT NULL,
    visual_reference_set_id UUID NOT NULL,
    company_id UUID NOT NULL,
    region_id UUID NOT NULL,
    store_id UUID NOT NULL,
    deadline_status TEXT NOT NULL,
    review_status TEXT NOT NULL,
    first_valid_submission_at TIMESTAMPTZ,
    classified_at TIMESTAMPTZ NOT NULL,
    classification_reason TEXT,
    classified_by_user_id UUID REFERENCES ops.user_account(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_visual_campaign_outcome_revision UNIQUE (assignment_id, campaign_revision_id),
    CONSTRAINT fk_visual_campaign_outcome_assignment FOREIGN KEY (assignment_id, visual_reference_set_id, company_id, region_id, store_id)
        REFERENCES ops.visual_campaign_assignment(assignment_id, visual_reference_set_id, company_id, region_id, store_id),
    CONSTRAINT fk_visual_campaign_outcome_revision FOREIGN KEY (campaign_revision_id, visual_reference_set_id, company_id)
        REFERENCES ops.visual_campaign_revision(campaign_revision_id, visual_reference_set_id, company_id),
    CONSTRAINT ck_visual_campaign_outcome_deadline CHECK (deadline_status IN ('on_time', 'missed', 'exempt', 'withdrawn', 'operational_hold')),
    CONSTRAINT ck_visual_campaign_outcome_review CHECK (review_status IN ('not_submitted', 'review_pending', 'correction_requested', 'completed'))
);

CREATE TABLE IF NOT EXISTS ops.visual_campaign_submission (
    campaign_submission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL,
    campaign_revision_id UUID NOT NULL,
    visual_reference_set_id UUID NOT NULL,
    company_id UUID NOT NULL,
    region_id UUID NOT NULL,
    store_id UUID NOT NULL,
    submitted_by_user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    idempotency_key UUID NOT NULL,
    finalized_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_visual_campaign_submission_idempotency UNIQUE (assignment_id, idempotency_key),
    CONSTRAINT uq_visual_campaign_submission_scope UNIQUE (
        campaign_submission_id,
        campaign_revision_id,
        visual_reference_set_id,
        company_id,
        region_id,
        store_id
    ),
    CONSTRAINT fk_visual_campaign_submission_assignment FOREIGN KEY (
        assignment_id,
        visual_reference_set_id,
        company_id,
        region_id,
        store_id
    ) REFERENCES ops.visual_campaign_assignment(
        assignment_id,
        visual_reference_set_id,
        company_id,
        region_id,
        store_id
    ),
    CONSTRAINT fk_visual_campaign_submission_revision FOREIGN KEY (
        campaign_revision_id,
        visual_reference_set_id,
        company_id
    ) REFERENCES ops.visual_campaign_revision(
        campaign_revision_id,
        visual_reference_set_id,
        company_id
    )
);

CREATE TABLE IF NOT EXISTS ops.visual_reference_item (
    visual_reference_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_revision_id UUID NOT NULL,
    visual_reference_set_id UUID NOT NULL,
    company_id UUID NOT NULL,
    checklist_template_id UUID NOT NULL,
    template_item_id UUID NOT NULL,
    item_order INTEGER NOT NULL,
    expected_visual_intent TEXT NOT NULL,
    allowed_variants_json JSONB NOT NULL DEFAULT '[]'::JSONB,
    review_instructions TEXT NOT NULL,
    rubric_version TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_visual_reference_item_template_item UNIQUE (campaign_revision_id, template_item_id),
    CONSTRAINT uq_visual_reference_item_scope UNIQUE (visual_reference_item_id, campaign_revision_id, visual_reference_set_id, company_id),
    CONSTRAINT uq_visual_reference_item_company UNIQUE (visual_reference_item_id, company_id),
    CONSTRAINT fk_visual_reference_item_revision FOREIGN KEY (campaign_revision_id, visual_reference_set_id, company_id)
        REFERENCES ops.visual_campaign_revision(campaign_revision_id, visual_reference_set_id, company_id),
    CONSTRAINT fk_visual_reference_item_template FOREIGN KEY (checklist_template_id, company_id)
        REFERENCES ops.checklist_template(checklist_template_id, company_id),
    CONSTRAINT fk_visual_reference_item_template_item FOREIGN KEY (template_item_id, checklist_template_id)
        REFERENCES ops.checklist_template_item(template_item_id, checklist_template_id),
    CONSTRAINT ck_visual_reference_item_order CHECK (item_order >= 0),
    CONSTRAINT ck_visual_reference_item_variants CHECK (jsonb_typeof(allowed_variants_json) = 'array')
);

CREATE TABLE IF NOT EXISTS ops.visual_reference_item_asset (
    visual_reference_item_asset_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visual_reference_item_id UUID NOT NULL,
    campaign_revision_id UUID NOT NULL,
    visual_reference_set_id UUID NOT NULL,
    company_id UUID NOT NULL,
    media_asset_id UUID NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_visual_reference_item_asset UNIQUE (visual_reference_item_id, media_asset_id),
    CONSTRAINT uq_visual_reference_item_asset_order UNIQUE (visual_reference_item_id, display_order),
    CONSTRAINT fk_visual_reference_item_asset_item FOREIGN KEY (visual_reference_item_id, campaign_revision_id, visual_reference_set_id, company_id)
        REFERENCES ops.visual_reference_item(visual_reference_item_id, campaign_revision_id, visual_reference_set_id, company_id),
    CONSTRAINT fk_visual_reference_item_asset_media FOREIGN KEY (media_asset_id, company_id)
        REFERENCES ops.media_asset(media_asset_id, company_id),
    CONSTRAINT ck_visual_reference_item_asset_order CHECK (display_order >= 0)
);

CREATE TABLE IF NOT EXISTS ops.visual_campaign_submission_media (
    campaign_submission_media_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_submission_id UUID NOT NULL,
    campaign_revision_id UUID NOT NULL,
    visual_reference_set_id UUID NOT NULL,
    company_id UUID NOT NULL,
    region_id UUID NOT NULL,
    store_id UUID NOT NULL,
    visual_reference_item_id UUID NOT NULL,
    media_asset_id UUID NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_visual_campaign_submission_media UNIQUE (campaign_submission_id, visual_reference_item_id, media_asset_id),
    CONSTRAINT uq_visual_campaign_submission_media_order UNIQUE (campaign_submission_id, visual_reference_item_id, display_order),
    CONSTRAINT fk_visual_campaign_submission_media_submission FOREIGN KEY (
        campaign_submission_id,
        campaign_revision_id,
        visual_reference_set_id,
        company_id,
        region_id,
        store_id
    ) REFERENCES ops.visual_campaign_submission(
        campaign_submission_id,
        campaign_revision_id,
        visual_reference_set_id,
        company_id,
        region_id,
        store_id
    ),
    CONSTRAINT fk_visual_campaign_submission_media_item FOREIGN KEY (
        visual_reference_item_id,
        campaign_revision_id,
        visual_reference_set_id,
        company_id
    ) REFERENCES ops.visual_reference_item(
        visual_reference_item_id,
        campaign_revision_id,
        visual_reference_set_id,
        company_id
    ),
    CONSTRAINT fk_visual_campaign_submission_media_asset FOREIGN KEY (media_asset_id, company_id, store_id)
        REFERENCES ops.media_asset(media_asset_id, company_id, store_id),
    CONSTRAINT ck_visual_campaign_submission_media_order CHECK (display_order >= 0)
);

CREATE TABLE IF NOT EXISTS ops.visual_comparison_run (
    comparison_run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL,
    region_id UUID NOT NULL,
    store_id UUID NOT NULL,
    assignment_id UUID NOT NULL,
    visual_reference_set_id UUID NOT NULL,
    campaign_revision_id UUID NOT NULL,
    visual_reference_item_id UUID NOT NULL,
    evidence_media_asset_id UUID NOT NULL,
    isolation_class TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    evidence_sha256 CHAR(64) NOT NULL,
    reference_sha256 CHAR(64) NOT NULL,
    rubric_version TEXT NOT NULL,
    prompt_version TEXT NOT NULL,
    comparison_policy_version TEXT NOT NULL,
    provider_adapter_id TEXT,
    provider_model_id TEXT,
    idempotency_key CHAR(64) NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    latency_ms INTEGER,
    bounded_cost_minor_units BIGINT,
    decision TEXT,
    overall_confidence NUMERIC(6,5),
    result_json JSONB,
    failure_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_visual_comparison_run_idempotency UNIQUE (company_id, idempotency_key),
    CONSTRAINT uq_visual_comparison_run_scope UNIQUE (comparison_run_id, company_id),
    CONSTRAINT fk_visual_comparison_run_assignment FOREIGN KEY (assignment_id, visual_reference_set_id, company_id, region_id, store_id)
        REFERENCES ops.visual_campaign_assignment(assignment_id, visual_reference_set_id, company_id, region_id, store_id),
    CONSTRAINT fk_visual_comparison_run_reference_item FOREIGN KEY (visual_reference_item_id, campaign_revision_id, visual_reference_set_id, company_id)
        REFERENCES ops.visual_reference_item(visual_reference_item_id, campaign_revision_id, visual_reference_set_id, company_id),
    CONSTRAINT fk_visual_comparison_run_evidence FOREIGN KEY (evidence_media_asset_id, company_id, store_id)
        REFERENCES ops.media_asset(media_asset_id, company_id, store_id),
    CONSTRAINT ck_visual_comparison_run_isolation CHECK (isolation_class IN ('shadow', 'advisory')),
    CONSTRAINT ck_visual_comparison_run_status CHECK (
        status IN ('queued', 'processing', 'completed', 'abstained', 'failed_retryable', 'failed_terminal', 'human_reviewed')
    ),
    CONSTRAINT ck_visual_comparison_run_hashes CHECK (
        evidence_sha256 ~ '^[0-9a-f]{64}$' AND reference_sha256 ~ '^[0-9a-f]{64}$' AND idempotency_key ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT ck_visual_comparison_run_attempts CHECK (attempt_count >= 0),
    CONSTRAINT ck_visual_comparison_run_latency CHECK (latency_ms IS NULL OR latency_ms >= 0),
    CONSTRAINT ck_visual_comparison_run_cost CHECK (bounded_cost_minor_units IS NULL OR bounded_cost_minor_units >= 0),
    CONSTRAINT ck_visual_comparison_run_confidence CHECK (overall_confidence IS NULL OR overall_confidence BETWEEN 0 AND 1),
    CONSTRAINT ck_visual_comparison_run_decision CHECK (
        decision IS NULL OR decision IN ('pass', 'partial', 'fail', 'abstain', 'recapture_required')
    )
);

CREATE TABLE IF NOT EXISTS ops.visual_comparison_review (
    comparison_review_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comparison_run_id UUID NOT NULL,
    company_id UUID NOT NULL,
    review_no INTEGER NOT NULL,
    review_decision TEXT NOT NULL,
    review_reason TEXT NOT NULL,
    before_result_json JSONB,
    after_result_json JSONB,
    reviewed_by_user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_visual_comparison_review_run_no UNIQUE (comparison_run_id, review_no),
    CONSTRAINT fk_visual_comparison_review_run FOREIGN KEY (comparison_run_id, company_id)
        REFERENCES ops.visual_comparison_run(comparison_run_id, company_id),
    CONSTRAINT ck_visual_comparison_review_decision CHECK (
        review_decision IN ('accept', 'override', 'reject', 'request_recapture')
    ),
    CONSTRAINT ck_visual_comparison_review_no CHECK (review_no > 0),
    CONSTRAINT ck_visual_comparison_review_reason CHECK (length(btrim(review_reason)) > 0)
);

CREATE TABLE IF NOT EXISTS audit.photo_evidence_event (
    photo_evidence_event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor_user_id UUID REFERENCES ops.user_account(user_id),
    event_type TEXT NOT NULL,
    entity_name TEXT NOT NULL,
    entity_id UUID NOT NULL,
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    region_id UUID,
    store_id UUID,
    media_asset_id UUID,
    correlation_id TEXT NOT NULL,
    reason_code TEXT,
    state_before TEXT,
    state_after TEXT,
    content_sha256 CHAR(64),
    reference_version TEXT,
    rubric_version TEXT,
    provider_adapter_id TEXT,
    provider_model_id TEXT,
    policy_version TEXT,
    CONSTRAINT fk_photo_evidence_event_asset FOREIGN KEY (media_asset_id, company_id)
        REFERENCES ops.media_asset(media_asset_id, company_id),
    CONSTRAINT fk_photo_evidence_event_region FOREIGN KEY (region_id, company_id)
        REFERENCES ops.region(region_id, company_id),
    CONSTRAINT fk_photo_evidence_event_store FOREIGN KEY (store_id, company_id, region_id)
        REFERENCES ops.store(store_id, company_id, region_id),
    CONSTRAINT ck_photo_evidence_event_type CHECK (event_type IN (
        'checklist_photo_evidence.media.upload_initiated',
        'checklist_photo_evidence.media.uploaded',
        'checklist_photo_evidence.media.rejected',
        'checklist_photo_evidence.media.quarantined',
        'checklist_photo_evidence.media.finalized',
        'checklist_photo_evidence.media.viewed',
        'checklist_photo_evidence.media.downloaded',
        'checklist_photo_evidence.media.redacted',
        'checklist_photo_evidence.media.expired',
        'checklist_photo_evidence.media.deleted',
        'checklist_photo_evidence.media.deletion_failed',
        'checklist_photo_evidence.checklist.linked',
        'checklist_photo_evidence.checklist.unlinked',
        'checklist_photo_evidence.checklist.completed_locked',
        'checklist_photo_evidence.reference.draft_created',
        'checklist_photo_evidence.reference.published',
        'checklist_photo_evidence.reference.retired',
        'checklist_photo_evidence.reference.superseded',
        'checklist_photo_evidence.campaign.scheduled',
        'checklist_photo_evidence.campaign.opened',
        'checklist_photo_evidence.campaign.submitted',
        'checklist_photo_evidence.campaign.closed',
        'checklist_photo_evidence.campaign.missed',
        'checklist_photo_evidence.campaign.exempted',
        'checklist_photo_evidence.campaign.extended',
        'checklist_photo_evidence.campaign.reopened',
        'checklist_photo_evidence.campaign.scope_revised',
        'checklist_photo_evidence.campaign.operational_hold_recorded',
        'checklist_photo_evidence.action.solution_submitted',
        'checklist_photo_evidence.action.solution_approved',
        'checklist_photo_evidence.action.solution_rejected',
        'checklist_photo_evidence.action.solution_resubmitted',
        'checklist_photo_evidence.comparison.queued',
        'checklist_photo_evidence.comparison.invoked',
        'checklist_photo_evidence.comparison.completed',
        'checklist_photo_evidence.comparison.abstained',
        'checklist_photo_evidence.comparison.failed',
        'checklist_photo_evidence.comparison.retried',
        'checklist_photo_evidence.comparison.review_accepted',
        'checklist_photo_evidence.comparison.review_overridden',
        'checklist_photo_evidence.comparison.review_rejected',
        'checklist_photo_evidence.comparison.recapture_requested',
        'checklist_photo_evidence.retention.policy_changed',
        'checklist_photo_evidence.retention.cleanup_previewed',
        'checklist_photo_evidence.retention.cleanup_executed',
        'checklist_photo_evidence.authorization.denied'
    )),
    CONSTRAINT ck_photo_evidence_event_entity CHECK (entity_name IN (
        'media_asset',
        'checklist_response_media',
        'store_action_solution_attempt',
        'visual_reference_set',
        'visual_campaign_assignment',
        'visual_campaign_submission',
        'visual_comparison_run',
        'visual_comparison_review',
        'evidence_retention_policy',
        'evidence_access',
        'photo_media_purge_manifest'
    )),
    CONSTRAINT ck_photo_evidence_event_state_before CHECK (state_before IS NULL OR state_before IN (
        'initiated', 'uploaded', 'quarantined', 'accepted', 'canonicalized', 'ready', 'rejected',
        'expired', 'purge_pending', 'deleted_tombstone', 'draft', 'scheduled', 'open', 'closed',
        'retired', 'not_submitted', 'review_pending', 'correction_requested', 'completed',
        'solution_review_pending', 'correction_required', 'in_progress', 'on_time', 'missed',
        'exempt', 'withdrawn', 'operational_hold', 'queued', 'processing', 'abstained',
        'failed_retryable', 'failed_terminal', 'human_reviewed', 'approve', 'reject', 'accept',
        'override', 'request_recapture', 'previewed', 'executing', 'retryable_failure'
    )),
    CONSTRAINT ck_photo_evidence_event_state_after CHECK (state_after IS NULL OR state_after IN (
        'initiated', 'uploaded', 'quarantined', 'accepted', 'canonicalized', 'ready', 'rejected',
        'expired', 'purge_pending', 'deleted_tombstone', 'draft', 'scheduled', 'open', 'closed',
        'retired', 'not_submitted', 'review_pending', 'correction_requested', 'completed',
        'solution_review_pending', 'correction_required', 'in_progress', 'on_time', 'missed',
        'exempt', 'withdrawn', 'operational_hold', 'queued', 'processing', 'abstained',
        'failed_retryable', 'failed_terminal', 'human_reviewed', 'approve', 'reject', 'accept',
        'override', 'request_recapture', 'previewed', 'executing', 'retryable_failure'
    )),
    CONSTRAINT ck_photo_evidence_event_reason CHECK (reason_code IS NULL OR reason_code IN (
        'user_requested', 'policy_required', 'safety_rejection', 'quota_exceeded',
        'authorization_denied', 'retention_expired', 'legal_hold', 'operational_hold',
        'workflow_hold', 'ai_review_hold', 'deadline_elapsed', 'exempted',
        'correction_requested', 'provider_failure', 'schema_failure', 'safety_failure', 'superseded',
        'governed_cleanup'
    )),
    CONSTRAINT ck_photo_evidence_event_correlation CHECK (length(btrim(correlation_id)) > 0),
    CONSTRAINT ck_photo_evidence_event_hash CHECK (content_sha256 IS NULL OR content_sha256 ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS idx_photo_evidence_event_entity_time
    ON audit.photo_evidence_event (company_id, entity_name, entity_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_photo_evidence_event_asset_time
    ON audit.photo_evidence_event (media_asset_id, occurred_at DESC)
    WHERE media_asset_id IS NOT NULL;

CREATE OR REPLACE FUNCTION ops.guard_checklist_photo_evidence_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Checklist photo evidence history is immutable; operation % is not allowed.', TG_OP
        USING ERRCODE = '55000';
END;
$$;

CREATE OR REPLACE FUNCTION audit.guard_photo_evidence_event_append_only()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Photo evidence audit is append-only; operation % is not allowed.', TG_OP
        USING ERRCODE = '55000';
END;
$$;

CREATE OR REPLACE FUNCTION ops.guard_checklist_response_media_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    checklist_status TEXT;
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Checklist response media rows cannot be deleted.' USING ERRCODE = '55000';
    END IF;

    SELECT status
    INTO checklist_status
    FROM ops.checklist_instance
    WHERE checklist_instance_id = OLD.checklist_instance_id;

    IF OLD.unlinked_at IS NULL AND NEW.unlinked_at IS NOT NULL THEN
        IF OLD.locked_at IS NOT NULL OR checklist_status = 'completed' THEN
            RAISE EXCEPTION 'Completed or locked checklist evidence cannot be unlinked.' USING ERRCODE = '55000';
        END IF;
        IF NEW.unlinked_by_user_id IS NULL OR NEW.unlink_reason IS NULL OR length(btrim(NEW.unlink_reason)) = 0 THEN
            RAISE EXCEPTION 'Checklist evidence unlink requires actor and reason.' USING ERRCODE = '23514';
        END IF;
        IF (to_jsonb(NEW) - ARRAY['unlinked_at', 'unlinked_by_user_id', 'unlink_reason'])
            IS DISTINCT FROM
           (to_jsonb(OLD) - ARRAY['unlinked_at', 'unlinked_by_user_id', 'unlink_reason']) THEN
            RAISE EXCEPTION 'Checklist evidence unlink cannot modify other fields.' USING ERRCODE = '55000';
        END IF;
        NEW.unlinked_at := NOW();
        RETURN NEW;
    END IF;

    IF OLD.locked_at IS NULL AND NEW.locked_at IS NOT NULL THEN
        IF checklist_status <> 'completed' OR OLD.unlinked_at IS NOT NULL THEN
            RAISE EXCEPTION 'Only active evidence on a completed checklist can be locked.' USING ERRCODE = '55000';
        END IF;
        IF (to_jsonb(NEW) - 'locked_at') IS DISTINCT FROM (to_jsonb(OLD) - 'locked_at') THEN
            RAISE EXCEPTION 'Checklist evidence lock cannot modify other fields.' USING ERRCODE = '55000';
        END IF;
        NEW.locked_at := NOW();
        RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Checklist response media history transition is not allowed.' USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS trg_checklist_response_media_immutable ON ops.checklist_response_media;
DROP TRIGGER IF EXISTS trg_checklist_response_media_lifecycle ON ops.checklist_response_media;
CREATE TRIGGER trg_checklist_response_media_lifecycle
    BEFORE UPDATE OR DELETE ON ops.checklist_response_media
    FOR EACH ROW EXECUTE FUNCTION ops.guard_checklist_response_media_lifecycle();

DROP TRIGGER IF EXISTS trg_evidence_retention_policy_immutable ON ops.evidence_retention_policy;
CREATE TRIGGER trg_evidence_retention_policy_immutable
    BEFORE UPDATE OR DELETE ON ops.evidence_retention_policy
    FOR EACH ROW EXECUTE FUNCTION ops.guard_checklist_photo_evidence_immutable();

DROP TRIGGER IF EXISTS trg_store_action_solution_attempt_immutable ON ops.store_action_solution_attempt;
CREATE TRIGGER trg_store_action_solution_attempt_immutable
    BEFORE UPDATE OR DELETE ON ops.store_action_solution_attempt
    FOR EACH ROW EXECUTE FUNCTION ops.guard_checklist_photo_evidence_immutable();

DROP TRIGGER IF EXISTS trg_store_action_plan_evidence_immutable ON ops.store_action_plan_evidence;
CREATE TRIGGER trg_store_action_plan_evidence_immutable
    BEFORE UPDATE OR DELETE ON ops.store_action_plan_evidence
    FOR EACH ROW EXECUTE FUNCTION ops.guard_checklist_photo_evidence_immutable();

DROP TRIGGER IF EXISTS trg_store_action_solution_review_immutable ON ops.store_action_solution_review;
CREATE TRIGGER trg_store_action_solution_review_immutable
    BEFORE UPDATE OR DELETE ON ops.store_action_solution_review
    FOR EACH ROW EXECUTE FUNCTION ops.guard_checklist_photo_evidence_immutable();

DROP TRIGGER IF EXISTS trg_visual_campaign_revision_immutable ON ops.visual_campaign_revision;
CREATE TRIGGER trg_visual_campaign_revision_immutable
    BEFORE UPDATE OR DELETE ON ops.visual_campaign_revision
    FOR EACH ROW EXECUTE FUNCTION ops.guard_checklist_photo_evidence_immutable();

DROP TRIGGER IF EXISTS trg_visual_campaign_assignment_outcome_immutable ON ops.visual_campaign_assignment_outcome;
CREATE TRIGGER trg_visual_campaign_assignment_outcome_immutable
    BEFORE UPDATE OR DELETE ON ops.visual_campaign_assignment_outcome
    FOR EACH ROW EXECUTE FUNCTION ops.guard_checklist_photo_evidence_immutable();

DROP TRIGGER IF EXISTS trg_visual_campaign_submission_immutable ON ops.visual_campaign_submission;
CREATE TRIGGER trg_visual_campaign_submission_immutable
    BEFORE UPDATE OR DELETE ON ops.visual_campaign_submission
    FOR EACH ROW EXECUTE FUNCTION ops.guard_checklist_photo_evidence_immutable();

DROP TRIGGER IF EXISTS trg_visual_campaign_submission_media_immutable ON ops.visual_campaign_submission_media;
CREATE TRIGGER trg_visual_campaign_submission_media_immutable
    BEFORE UPDATE OR DELETE ON ops.visual_campaign_submission_media
    FOR EACH ROW EXECUTE FUNCTION ops.guard_checklist_photo_evidence_immutable();

DROP TRIGGER IF EXISTS trg_visual_reference_item_immutable ON ops.visual_reference_item;
CREATE TRIGGER trg_visual_reference_item_immutable
    BEFORE UPDATE OR DELETE ON ops.visual_reference_item
    FOR EACH ROW EXECUTE FUNCTION ops.guard_checklist_photo_evidence_immutable();

DROP TRIGGER IF EXISTS trg_visual_reference_item_asset_immutable ON ops.visual_reference_item_asset;
CREATE TRIGGER trg_visual_reference_item_asset_immutable
    BEFORE UPDATE OR DELETE ON ops.visual_reference_item_asset
    FOR EACH ROW EXECUTE FUNCTION ops.guard_checklist_photo_evidence_immutable();

DROP TRIGGER IF EXISTS trg_visual_comparison_review_immutable ON ops.visual_comparison_review;
CREATE TRIGGER trg_visual_comparison_review_immutable
    BEFORE UPDATE OR DELETE ON ops.visual_comparison_review
    FOR EACH ROW EXECUTE FUNCTION ops.guard_checklist_photo_evidence_immutable();

DROP TRIGGER IF EXISTS trg_photo_evidence_event_append_only ON audit.photo_evidence_event;
CREATE TRIGGER trg_photo_evidence_event_append_only
    BEFORE UPDATE OR DELETE ON audit.photo_evidence_event
    FOR EACH ROW EXECUTE FUNCTION audit.guard_photo_evidence_event_append_only();

COMMENT ON TABLE ops.evidence_retention_policy IS 'Company-scoped versioned retention policy; no provider or runtime activation.';
COMMENT ON TABLE ops.media_asset IS 'Private provider-neutral media metadata with safe lifecycle, retention, holds, and tombstone state.';
COMMENT ON TABLE ops.checklist_response_media IS 'Immutable exact checklist response/item evidence links.';
COMMENT ON TABLE ops.checklist_instance_item_policy IS 'Immutable evidence-policy snapshot pinned to the exact checklist instance and template item.';
COMMENT ON TABLE ops.photo_evidence_command_receipt IS 'Actor-scoped digest-bound idempotency receipts for checklist evidence commands.';

CREATE OR REPLACE FUNCTION ops.snapshot_checklist_instance_item_policy()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO ops.checklist_instance_item_policy (
        checklist_instance_id, checklist_template_id, template_item_id,
        evidence_policy, max_evidence_count
    )
    SELECT NEW.checklist_instance_id, NEW.checklist_template_id,
           item.template_item_id, item.evidence_policy, item.max_evidence_count
    FROM ops.checklist_template_item item
    WHERE item.checklist_template_id = NEW.checklist_template_id
    ON CONFLICT (checklist_instance_id, template_item_id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_checklist_instance_item_policy_snapshot ON ops.checklist_instance;
CREATE TRIGGER trg_checklist_instance_item_policy_snapshot
    AFTER INSERT ON ops.checklist_instance
    FOR EACH ROW EXECUTE FUNCTION ops.snapshot_checklist_instance_item_policy();

CREATE OR REPLACE FUNCTION ops.guard_checklist_instance_item_policy_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'checklist instance item policy is immutable';
END;
$$;

DROP TRIGGER IF EXISTS trg_checklist_instance_item_policy_immutable ON ops.checklist_instance_item_policy;
CREATE TRIGGER trg_checklist_instance_item_policy_immutable
  BEFORE UPDATE OR DELETE ON ops.checklist_instance_item_policy
  FOR EACH ROW EXECUTE FUNCTION ops.guard_checklist_instance_item_policy_immutable();

DROP TRIGGER IF EXISTS trg_checklist_item_evidence_upload_intent_immutable
  ON ops.checklist_item_evidence_upload_intent;
CREATE TRIGGER trg_checklist_item_evidence_upload_intent_immutable
  BEFORE UPDATE OR DELETE ON ops.checklist_item_evidence_upload_intent
  FOR EACH ROW EXECUTE FUNCTION ops.guard_checklist_instance_item_policy_immutable();

CREATE OR REPLACE FUNCTION ops.guard_published_checklist_item_evidence_policy()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF EXISTS (
            SELECT 1 FROM ops.checklist_template template
            WHERE template.checklist_template_id = OLD.checklist_template_id
              AND template.status <> 'draft'
        ) THEN
            RAISE EXCEPTION 'published checklist item evidence policy is immutable';
        END IF;
        RETURN OLD;
    END IF;
    IF EXISTS (
        SELECT 1 FROM ops.checklist_template template
        WHERE template.checklist_template_id = OLD.checklist_template_id
          AND template.status <> 'draft'
    ) AND (
        NEW.evidence_policy IS DISTINCT FROM OLD.evidence_policy
        OR NEW.max_evidence_count IS DISTINCT FROM OLD.max_evidence_count
    ) THEN
        RAISE EXCEPTION 'published checklist item evidence policy is immutable';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_published_checklist_item_evidence_policy ON ops.checklist_template_item;
CREATE TRIGGER trg_published_checklist_item_evidence_policy
    BEFORE UPDATE OR DELETE ON ops.checklist_template_item
    FOR EACH ROW EXECUTE FUNCTION ops.guard_published_checklist_item_evidence_policy();
COMMENT ON TABLE ops.store_action_solution_attempt IS 'Immutable Store Manager solution submissions awaiting scoped Region Manager review.';
COMMENT ON TABLE ops.store_action_plan_evidence IS 'Immutable finding or solution evidence linked to checklist-derived Store Action work.';
COMMENT ON TABLE ops.store_action_solution_review IS 'Append-only Region Manager approval or rejection of one current solution attempt.';
COMMENT ON TABLE ops.visual_reference_set IS 'Company-owned VM reference campaign aggregate with mutable current projection only.';
COMMENT ON TABLE ops.visual_campaign_revision IS 'Immutable campaign window, reference, and assignment-snapshot revision.';
COMMENT ON TABLE ops.visual_campaign_assignment IS 'Current store obligation projection; history remains in immutable outcomes.';
COMMENT ON TABLE ops.visual_campaign_assignment_outcome IS 'Immutable operational deadline and review outcome per campaign revision.';
COMMENT ON TABLE ops.visual_campaign_submission IS 'Immutable provider-neutral manual campaign submission truth independent of AI availability.';
COMMENT ON TABLE ops.visual_campaign_submission_media IS 'Immutable exact submission, rubric item, and evidence association.';

ALTER TABLE ops.media_asset
    ADD COLUMN IF NOT EXISTS declared_upload_byte_count BIGINT,
    ADD COLUMN IF NOT EXISTS thumbnail_byte_count BIGINT,
    ADD COLUMN IF NOT EXISTS quota_reserved_bytes BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS quota_reserved_class_a INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS quota_reserved_class_b INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS accounted_provider_bytes BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cleanup_lease_token UUID,
    ADD COLUMN IF NOT EXISTS cleanup_lease_expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cleanup_origin_state TEXT,
    ADD COLUMN IF NOT EXISTS storage_attempt_id UUID,
    ADD COLUMN IF NOT EXISTS processing_lease_token UUID,
    ADD COLUMN IF NOT EXISTS processing_lease_expires_at TIMESTAMPTZ;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_media_asset_storage_accounting'
    ) THEN
        ALTER TABLE ops.media_asset
            ADD CONSTRAINT ck_media_asset_storage_accounting CHECK (
                (declared_upload_byte_count IS NULL OR declared_upload_byte_count > 0)
                AND (thumbnail_byte_count IS NULL OR thumbnail_byte_count > 0)
                AND quota_reserved_bytes >= 0
                AND quota_reserved_class_a >= 0
                AND quota_reserved_class_b >= 0
                AND accounted_provider_bytes >= 0
                AND (
                    (cleanup_lease_token IS NULL AND cleanup_lease_expires_at IS NULL)
                    OR (cleanup_lease_token IS NOT NULL AND cleanup_lease_expires_at IS NOT NULL AND cleanup_origin_state IS NOT NULL)
                )
                AND (
                    (processing_lease_token IS NULL AND processing_lease_expires_at IS NULL)
                    OR (processing_lease_token IS NOT NULL AND processing_lease_expires_at IS NOT NULL)
                )
            );
    END IF;
END;
$$;

ALTER TABLE ops.media_asset DROP CONSTRAINT IF EXISTS ck_media_asset_ready;
ALTER TABLE ops.media_asset
    ADD CONSTRAINT ck_media_asset_ready CHECK (state <> 'ready' OR (
        canonical_object_key IS NOT NULL
        AND thumbnail_object_key IS NOT NULL
        AND detected_mime_type IS NOT NULL
        AND byte_count IS NOT NULL
        AND width_px IS NOT NULL
        AND height_px IS NOT NULL
        AND original_sha256 IS NOT NULL
        AND canonical_sha256 IS NOT NULL
        AND metadata_stripped_at IS NOT NULL
        AND safety_scanned_at IS NOT NULL
        AND retention_policy_id IS NOT NULL
        AND retention_policy_version IS NOT NULL
        AND expires_at IS NOT NULL
        AND finalized_at IS NOT NULL
        AND storage_attempt_id IS NOT NULL
    ));

CREATE INDEX IF NOT EXISTS idx_media_asset_raw_disposal_retry
    ON ops.media_asset (updated_at, media_asset_id)
    WHERE state = 'ready' AND raw_disposed_at IS NULL;

CREATE TABLE IF NOT EXISTS ops.photo_media_usage_state (
    usage_scope TEXT PRIMARY KEY,
    provider_visible_bytes BIGINT NOT NULL DEFAULT 0,
    operation_month DATE NOT NULL,
    class_a_operations BIGINT NOT NULL DEFAULT 0,
    class_b_operations BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_photo_media_usage_scope CHECK (usage_scope = 'photo-media-v1'),
    CONSTRAINT ck_photo_media_usage_bytes CHECK (provider_visible_bytes >= 0),
    CONSTRAINT ck_photo_media_usage_operations CHECK (
        class_a_operations >= 0 AND class_b_operations >= 0
    ),
    CONSTRAINT ck_photo_media_usage_month CHECK (
        operation_month = date_trunc('month', operation_month)::date
    )
);

CREATE TABLE IF NOT EXISTS ops.photo_media_daily_usage (
    usage_date DATE NOT NULL,
    subject_kind TEXT NOT NULL,
    subject_id UUID NOT NULL,
    uploaded_bytes BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (usage_date, subject_kind, subject_id),
    CONSTRAINT ck_photo_media_daily_usage_kind CHECK (subject_kind IN ('user', 'store')),
    CONSTRAINT ck_photo_media_daily_usage_bytes CHECK (uploaded_bytes >= 0)
);

CREATE TABLE IF NOT EXISTS ops.media_asset_replica (
    media_asset_replica_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    media_asset_id UUID NOT NULL,
    company_id UUID NOT NULL,
    replica_role TEXT NOT NULL,
    provider_adapter_id TEXT NOT NULL,
    jurisdiction TEXT NOT NULL,
    bucket_alias TEXT NOT NULL,
    object_key TEXT NOT NULL,
    object_version_id TEXT,
    replica_generation INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    replica_state TEXT NOT NULL DEFAULT 'pending',
    content_sha256 CHAR(64),
    byte_count BIGINT,
    copy_started_at TIMESTAMPTZ,
    verified_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    failure_reason_code TEXT,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_media_asset_replica_role_generation UNIQUE (media_asset_id, replica_role, replica_generation),
    CONSTRAINT uq_media_asset_replica_object UNIQUE (provider_adapter_id, jurisdiction, bucket_alias, object_key),
    CONSTRAINT uq_media_asset_replica_company UNIQUE (media_asset_replica_id, company_id),
    CONSTRAINT fk_media_asset_replica_asset FOREIGN KEY (media_asset_id, company_id)
        REFERENCES ops.media_asset(media_asset_id, company_id),
    CONSTRAINT ck_media_asset_replica_role CHECK (replica_role IN ('primary', 'recovery')),
    CONSTRAINT ck_media_asset_replica_generation CHECK (replica_generation > 0),
    CONSTRAINT ck_media_asset_replica_provider_jurisdiction CHECK (
        (provider_adapter_id = 'r2' AND jurisdiction = 'eu')
        OR (provider_adapter_id = 'seaweedfs' AND jurisdiction = 'onprem')
    ),
    CONSTRAINT ck_media_asset_replica_bucket_role CHECK (
        (replica_role = 'primary' AND bucket_alias = 'primary')
        OR (replica_role = 'recovery' AND bucket_alias = 'recovery')
    ),
    CONSTRAINT ck_media_asset_replica_state CHECK (
        replica_state IN ('pending', 'copying', 'verified', 'failed', 'deleted_tombstone')
    ),
    CONSTRAINT ck_media_asset_replica_object_key_private CHECK (
        object_key = btrim(object_key)
        AND length(object_key) > 0
        AND object_key ~ '^[A-Za-z0-9][A-Za-z0-9._/-]*$'
        AND object_key !~ '(^|/)\.\.?(/|$)'
        AND object_key !~ '//'
        AND object_key !~* '^(https?:|s3:|r2:|data:|file:)'
    ),
    CONSTRAINT ck_media_asset_replica_object_version_id_private CHECK (
        object_version_id IS NULL OR (
            object_version_id = btrim(object_version_id)
            AND octet_length(object_version_id) > 0
            AND octet_length(object_version_id) <= 1024
            AND object_version_id !~ '[[:cntrl:]]'
        )
    ),
    CONSTRAINT ck_media_asset_replica_hash CHECK (
        content_sha256 IS NULL OR content_sha256 ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT ck_media_asset_replica_byte_count CHECK (byte_count IS NULL OR byte_count > 0),
    CONSTRAINT ck_media_asset_replica_verified CHECK (
        replica_state <> 'verified'
        OR (
            content_sha256 IS NOT NULL
            AND byte_count IS NOT NULL
            AND copy_started_at IS NOT NULL
            AND verified_at IS NOT NULL
            AND failed_at IS NULL
            AND failure_reason_code IS NULL
            AND deleted_at IS NULL
        )
    ),
    CONSTRAINT ck_media_asset_replica_failed CHECK (
        replica_state <> 'failed'
        OR (failed_at IS NOT NULL AND length(btrim(failure_reason_code)) > 0)
    ),
    CONSTRAINT ck_media_asset_replica_deleted CHECK (
        replica_state <> 'deleted_tombstone'
        OR (deleted_at IS NOT NULL AND content_sha256 IS NOT NULL AND byte_count IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_media_asset_replica_reconciliation
    ON ops.media_asset_replica (replica_role, replica_state, updated_at, media_asset_id);

CREATE INDEX IF NOT EXISTS idx_media_asset_replica_asset
    ON ops.media_asset_replica (media_asset_id, replica_role, replica_state);

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_asset_replica_one_active_role
    ON ops.media_asset_replica (media_asset_id, replica_role)
    WHERE is_active;

CREATE TABLE IF NOT EXISTS audit.photo_media_storage_event (
    photo_media_storage_event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor_user_id UUID REFERENCES ops.user_account(user_id),
    event_type TEXT NOT NULL,
    media_asset_id UUID,
    media_asset_replica_id UUID,
    company_id UUID NOT NULL,
    correlation_id TEXT NOT NULL,
    reason_code TEXT,
    content_sha256 CHAR(64),
    byte_count BIGINT,
    manifest_digest CHAR(64),
    CONSTRAINT fk_photo_media_storage_event_asset FOREIGN KEY (media_asset_id, company_id)
        REFERENCES ops.media_asset(media_asset_id, company_id),
    CONSTRAINT fk_photo_media_storage_event_replica FOREIGN KEY (media_asset_replica_id, company_id)
        REFERENCES ops.media_asset_replica(media_asset_replica_id, company_id),
    CONSTRAINT ck_photo_media_storage_event_type CHECK (event_type IN (
        'checklist_photo_evidence.storage.primary_verified',
        'checklist_photo_evidence.storage.recovery_copy_started',
        'checklist_photo_evidence.storage.recovery_verified',
        'checklist_photo_evidence.storage.recovery_failed',
        'checklist_photo_evidence.storage.provider_failed',
        'checklist_photo_evidence.storage.quarantined',
        'checklist_photo_evidence.storage.reconciliation_detected',
        'checklist_photo_evidence.storage.restore_started',
        'checklist_photo_evidence.storage.restore_verified',
        'checklist_photo_evidence.storage.restore_failed',
        'checklist_photo_evidence.storage.restore_skipped',
        'checklist_photo_evidence.storage.raw_disposed',
        'checklist_photo_evidence.storage.cleanup_deleted',
        'checklist_photo_evidence.storage.cleanup_failed',
        'checklist_photo_evidence.storage.quota_denied'
    )),
    CONSTRAINT ck_photo_media_storage_event_reason CHECK (
        reason_code IS NULL OR reason_code IN (
            'copy_failed', 'hash_mismatch', 'size_mismatch', 'primary_missing',
            'recovery_missing', 'database_row_missing', 'storage_hard_limit',
            'class_a_hard_limit', 'class_b_hard_limit', 'partial_expired',
            'governed_cleanup', 'manual_restore', 'provider_delete_failed',
            'quarantine_disposed', 'scanner_unsafe', 'scanner_unavailable',
            'provider_write_failed', 'raw_finalized', 'primary_healthy'
        )
    ),
    CONSTRAINT ck_photo_media_storage_event_hash CHECK (
        content_sha256 IS NULL OR content_sha256 ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT ck_photo_media_storage_event_byte_count CHECK (byte_count IS NULL OR byte_count > 0),
    CONSTRAINT ck_photo_media_storage_event_manifest CHECK (
        manifest_digest IS NULL OR manifest_digest ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT ck_photo_media_storage_event_correlation CHECK (length(btrim(correlation_id)) > 0),
    CONSTRAINT ck_photo_media_storage_event_asset_presence CHECK (
        (event_type = 'checklist_photo_evidence.storage.quota_denied' AND media_asset_id IS NULL)
        OR (event_type <> 'checklist_photo_evidence.storage.quota_denied' AND media_asset_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_photo_media_storage_event_asset
    ON audit.photo_media_storage_event (media_asset_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS audit.photo_media_reconciliation_run (
    photo_media_reconciliation_run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expected_asset_count INTEGER NOT NULL,
    missing_object_count INTEGER NOT NULL,
    mismatch_object_count INTEGER NOT NULL,
    orphan_primary_count INTEGER NOT NULL,
    orphan_recovery_count INTEGER NOT NULL,
    dangling_link_count INTEGER NOT NULL DEFAULT 0,
    stuck_upload_count INTEGER NOT NULL DEFAULT 0,
    stuck_purge_count INTEGER NOT NULL DEFAULT 0,
    protected_expiry_count INTEGER NOT NULL DEFAULT 0,
    tombstone_residue_count INTEGER NOT NULL DEFAULT 0,
    manifest_digest CHAR(64) NOT NULL,
    CONSTRAINT ck_photo_media_reconciliation_counts CHECK (
        expected_asset_count >= 0
        AND missing_object_count >= 0
        AND mismatch_object_count >= 0
        AND orphan_primary_count >= 0
        AND orphan_recovery_count >= 0
        AND dangling_link_count >= 0
        AND stuck_upload_count >= 0
        AND stuck_purge_count >= 0
        AND protected_expiry_count >= 0
        AND tombstone_residue_count >= 0
    ),
    CONSTRAINT ck_photo_media_reconciliation_digest CHECK (
        manifest_digest ~ '^[0-9a-f]{64}$'
    )
);

CREATE TABLE IF NOT EXISTS ops.photo_media_purge_manifest (
    photo_media_purge_manifest_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source TEXT NOT NULL CHECK (source IN ('manual', 'scheduled')),
    status TEXT NOT NULL CHECK (status IN ('previewed', 'executing', 'completed', 'retryable_failure', 'expired')),
    manifest_digest CHAR(64) NOT NULL CHECK (manifest_digest ~ '^[0-9a-f]{64}$'),
    candidate_count INTEGER NOT NULL CHECK (candidate_count >= 0),
    candidate_bytes BIGINT NOT NULL CHECK (candidate_bytes >= 0),
    reason TEXT NOT NULL CHECK (
        reason IN ('manual_retention_cleanup', 'scheduled_retention_cleanup')
    ),
    created_by_user_id UUID REFERENCES ops.user_account(user_id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    execution_attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (execution_attempt_count >= 0),
    execution_lease_token UUID,
    execution_lease_expires_at TIMESTAMPTZ,
    executed_at TIMESTAMPTZ,
    last_failure_reason TEXT CHECK (last_failure_reason IS NULL OR last_failure_reason = 'provider_delete_failed'),
    CONSTRAINT ck_photo_media_purge_manifest_expiry CHECK (expires_at > created_at),
    CONSTRAINT ck_photo_media_purge_manifest_lease CHECK (
        (execution_lease_token IS NULL) = (execution_lease_expires_at IS NULL)
    ),
    CONSTRAINT ck_photo_media_purge_manifest_status_shape CHECK (
        (status = 'executing') = (execution_lease_token IS NOT NULL)
        AND (status = 'completed') = (executed_at IS NOT NULL)
    )
);

CREATE TABLE IF NOT EXISTS ops.photo_media_purge_manifest_item (
    photo_media_purge_manifest_id UUID NOT NULL
        REFERENCES ops.photo_media_purge_manifest(photo_media_purge_manifest_id),
    item_no INTEGER NOT NULL CHECK (item_no > 0),
    media_asset_id UUID NOT NULL,
    company_id UUID NOT NULL,
    asset_state TEXT NOT NULL CHECK (asset_state = 'ready'),
    canonical_sha256 CHAR(64) NOT NULL CHECK (canonical_sha256 ~ '^[0-9a-f]{64}$'),
    accounted_provider_bytes BIGINT NOT NULL CHECK (accounted_provider_bytes >= 0),
    expires_at TIMESTAMPTZ NOT NULL,
    retention_policy_id UUID NOT NULL,
    retention_policy_version INTEGER NOT NULL CHECK (retention_policy_version > 0),
    eligibility_digest CHAR(64) NOT NULL CHECK (eligibility_digest ~ '^[0-9a-f]{64}$'),
    PRIMARY KEY (photo_media_purge_manifest_id, item_no),
    UNIQUE (photo_media_purge_manifest_id, media_asset_id),
    FOREIGN KEY (media_asset_id, company_id)
        REFERENCES ops.media_asset(media_asset_id, company_id),
    FOREIGN KEY (retention_policy_id, company_id)
        REFERENCES ops.evidence_retention_policy(retention_policy_id, company_id)
);

ALTER TABLE ops.media_asset
    ADD CONSTRAINT fk_media_asset_purge_manifest
    FOREIGN KEY (purge_manifest_id)
    REFERENCES ops.photo_media_purge_manifest(photo_media_purge_manifest_id);

CREATE INDEX IF NOT EXISTS idx_media_asset_purge_manifest
    ON ops.media_asset(purge_manifest_id)
    WHERE purge_manifest_id IS NOT NULL;

CREATE OR REPLACE FUNCTION ops.guard_media_attachment_ready_lock()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE asset_state TEXT;
BEGIN
    SELECT state INTO asset_state FROM ops.media_asset
     WHERE media_asset_id = NEW.media_asset_id
       AND company_id = NEW.company_id
     FOR UPDATE;
    IF asset_state IS NULL OR asset_state IN ('purge_pending', 'deleted_tombstone') THEN
        RAISE EXCEPTION 'Media attachment requires a locked non-purge asset.'
            USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_checklist_media_ready_lock ON ops.checklist_response_media;
CREATE TRIGGER trg_checklist_media_ready_lock BEFORE INSERT ON ops.checklist_response_media
    FOR EACH ROW EXECUTE FUNCTION ops.guard_media_attachment_ready_lock();
DROP TRIGGER IF EXISTS trg_action_media_ready_lock ON ops.store_action_plan_evidence;
CREATE TRIGGER trg_action_media_ready_lock BEFORE INSERT ON ops.store_action_plan_evidence
    FOR EACH ROW EXECUTE FUNCTION ops.guard_media_attachment_ready_lock();
DROP TRIGGER IF EXISTS trg_reference_media_ready_lock ON ops.visual_reference_item_asset;
CREATE TRIGGER trg_reference_media_ready_lock BEFORE INSERT ON ops.visual_reference_item_asset
    FOR EACH ROW EXECUTE FUNCTION ops.guard_media_attachment_ready_lock();
DROP TRIGGER IF EXISTS trg_submission_media_ready_lock ON ops.visual_campaign_submission_media;
CREATE TRIGGER trg_submission_media_ready_lock BEFORE INSERT ON ops.visual_campaign_submission_media
    FOR EACH ROW EXECUTE FUNCTION ops.guard_media_attachment_ready_lock();

CREATE INDEX IF NOT EXISTS idx_photo_media_purge_manifest_status_expiry
    ON ops.photo_media_purge_manifest(status, expires_at, created_at);
CREATE INDEX IF NOT EXISTS idx_photo_media_purge_manifest_item_asset
    ON ops.photo_media_purge_manifest_item(media_asset_id, photo_media_purge_manifest_id);

CREATE OR REPLACE FUNCTION ops.guard_photo_media_purge_manifest_item_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Photo media purge manifest items are immutable.' USING ERRCODE = '55000';
END;
$$;

CREATE OR REPLACE FUNCTION ops.guard_photo_media_purge_manifest_update()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Photo media purge manifests cannot be deleted.' USING ERRCODE = '55000';
    END IF;
    IF NEW.photo_media_purge_manifest_id IS DISTINCT FROM OLD.photo_media_purge_manifest_id
       OR NEW.source IS DISTINCT FROM OLD.source
       OR NEW.manifest_digest IS DISTINCT FROM OLD.manifest_digest
       OR NEW.candidate_count IS DISTINCT FROM OLD.candidate_count
       OR NEW.candidate_bytes IS DISTINCT FROM OLD.candidate_bytes
       OR NEW.reason IS DISTINCT FROM OLD.reason
       OR NEW.created_by_user_id IS DISTINCT FROM OLD.created_by_user_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at
       OR NEW.expires_at IS DISTINCT FROM OLD.expires_at
    THEN
        RAISE EXCEPTION 'Photo media purge manifest identity is immutable.' USING ERRCODE = '55000';
    END IF;
    IF NOT (
        (OLD.status = 'previewed' AND NEW.status IN ('executing', 'expired'))
        OR (OLD.status = 'retryable_failure' AND NEW.status IN ('executing', 'expired'))
        OR (OLD.status = 'executing' AND NEW.status IN ('completed', 'retryable_failure'))
        OR (OLD.status = 'executing' AND NEW.status = 'executing'
            AND OLD.execution_lease_expires_at <= NOW())
        OR (OLD.status = 'executing' AND NEW.status = 'expired'
            AND OLD.execution_lease_expires_at <= NOW())
    ) THEN
        RAISE EXCEPTION 'Photo media purge manifest transition is invalid.' USING ERRCODE = '55000';
    END IF;
    IF NEW.execution_attempt_count < OLD.execution_attempt_count
       OR NEW.execution_attempt_count > OLD.execution_attempt_count + 1
       OR (NEW.status = 'executing'
           AND NEW.execution_attempt_count <> OLD.execution_attempt_count + 1)
       OR (NEW.status <> 'executing'
           AND NEW.execution_attempt_count <> OLD.execution_attempt_count)
    THEN
        RAISE EXCEPTION 'Photo media purge manifest attempt count is invalid.' USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_photo_media_purge_manifest_item_immutable ON ops.photo_media_purge_manifest_item;
CREATE TRIGGER trg_photo_media_purge_manifest_item_immutable
    BEFORE UPDATE OR DELETE ON ops.photo_media_purge_manifest_item
    FOR EACH ROW EXECUTE FUNCTION ops.guard_photo_media_purge_manifest_item_immutable();
DROP TRIGGER IF EXISTS trg_photo_media_purge_manifest_guard ON ops.photo_media_purge_manifest;
CREATE TRIGGER trg_photo_media_purge_manifest_guard
    BEFORE UPDATE OR DELETE ON ops.photo_media_purge_manifest
    FOR EACH ROW EXECUTE FUNCTION ops.guard_photo_media_purge_manifest_update();

CREATE OR REPLACE FUNCTION ops.guard_verified_media_asset_replica()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Verified media asset replica proof is immutable; delete is not allowed.'
            USING ERRCODE = '55000';
    END IF;

    IF OLD.replica_state = 'verified' THEN
        IF OLD.is_active AND NOT NEW.is_active
           AND NEW.replica_state = OLD.replica_state
           AND NEW.media_asset_id = OLD.media_asset_id
           AND NEW.company_id = OLD.company_id
           AND NEW.replica_role = OLD.replica_role
           AND NEW.replica_generation = OLD.replica_generation
           AND NEW.provider_adapter_id = OLD.provider_adapter_id
           AND NEW.jurisdiction = OLD.jurisdiction
           AND NEW.bucket_alias = OLD.bucket_alias
           AND NEW.object_key = OLD.object_key
           AND NEW.object_version_id IS NOT DISTINCT FROM OLD.object_version_id
           AND NEW.content_sha256 = OLD.content_sha256
           AND NEW.byte_count = OLD.byte_count
           AND NEW.copy_started_at = OLD.copy_started_at
           AND NEW.verified_at = OLD.verified_at
           AND NEW.failed_at IS NOT DISTINCT FROM OLD.failed_at
           AND NEW.failure_reason_code IS NOT DISTINCT FROM OLD.failure_reason_code
           AND NEW.deleted_at IS NOT DISTINCT FROM OLD.deleted_at
        THEN
            RETURN NEW;
        END IF;
        IF NEW.replica_state = 'deleted_tombstone' THEN
            IF NEW.media_asset_id IS DISTINCT FROM OLD.media_asset_id
                OR NEW.company_id IS DISTINCT FROM OLD.company_id
                OR NEW.replica_role IS DISTINCT FROM OLD.replica_role
                OR NEW.provider_adapter_id IS DISTINCT FROM OLD.provider_adapter_id
                OR NEW.jurisdiction IS DISTINCT FROM OLD.jurisdiction
                OR NEW.bucket_alias IS DISTINCT FROM OLD.bucket_alias
                OR NEW.object_key IS DISTINCT FROM OLD.object_key
                OR NEW.object_version_id IS DISTINCT FROM OLD.object_version_id
                OR NEW.replica_generation IS DISTINCT FROM OLD.replica_generation
                OR NEW.is_active IS DISTINCT FROM OLD.is_active
                OR NEW.content_sha256 IS DISTINCT FROM OLD.content_sha256
                OR NEW.byte_count IS DISTINCT FROM OLD.byte_count
                OR NEW.copy_started_at IS DISTINCT FROM OLD.copy_started_at
                OR NEW.verified_at IS DISTINCT FROM OLD.verified_at
                OR NEW.deleted_at IS NULL
            THEN
                RAISE EXCEPTION 'Verified media asset replica proof is immutable.'
                    USING ERRCODE = '55000';
            END IF;
            RETURN NEW;
        END IF;

        RAISE EXCEPTION 'Verified media asset replica proof is immutable.'
            USING ERRCODE = '55000';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_media_asset_replica_verified_immutable ON ops.media_asset_replica;
CREATE TRIGGER trg_media_asset_replica_verified_immutable
    BEFORE UPDATE OR DELETE ON ops.media_asset_replica
    FOR EACH ROW EXECUTE FUNCTION ops.guard_verified_media_asset_replica();

CREATE OR REPLACE FUNCTION ops.guard_media_asset_ready_recovery()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    verified_roles INTEGER;
BEGIN
    IF NEW.state = 'ready' THEN
        SELECT COUNT(DISTINCT mar.replica_role)
        INTO verified_roles
        FROM ops.media_asset_replica mar
        WHERE mar.media_asset_id = NEW.media_asset_id
          AND mar.company_id = NEW.company_id
          AND mar.replica_role IN ('primary', 'recovery')
          AND mar.is_active
          AND mar.replica_state = 'verified'
          AND mar.content_sha256 = NEW.canonical_sha256
          AND mar.byte_count = NEW.byte_count
          AND (mar.replica_role <> 'primary' OR mar.object_key = NEW.canonical_object_key);

        IF verified_roles <> 2 THEN
            RAISE EXCEPTION 'Media asset requires verified primary and recovery replicas before ready.'
                USING ERRCODE = '23514';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_media_asset_ready_recovery ON ops.media_asset;
CREATE TRIGGER trg_media_asset_ready_recovery
    BEFORE INSERT OR UPDATE OF state, company_id, canonical_object_key, canonical_sha256, byte_count ON ops.media_asset
    FOR EACH ROW EXECUTE FUNCTION ops.guard_media_asset_ready_recovery();

CREATE OR REPLACE FUNCTION ops.guard_media_asset_cleanup_lease_holds()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.cleanup_lease_token IS NOT NULL
       AND OLD.cleanup_lease_expires_at > NOW()
       AND (
           NEW.legal_hold IS DISTINCT FROM OLD.legal_hold
           OR NEW.operational_hold IS DISTINCT FROM OLD.operational_hold
           OR NEW.active_workflow_hold IS DISTINCT FROM OLD.active_workflow_hold
           OR NEW.ai_review_hold IS DISTINCT FROM OLD.ai_review_hold
           OR NEW.raw_security_hold IS DISTINCT FROM OLD.raw_security_hold
       )
    THEN
        RAISE EXCEPTION 'Media asset holds cannot change during an active storage lease.'
            USING ERRCODE = '55000';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_media_asset_cleanup_lease_holds ON ops.media_asset;
CREATE TRIGGER trg_media_asset_cleanup_lease_holds
    BEFORE UPDATE OF legal_hold, operational_hold, active_workflow_hold, ai_review_hold, raw_security_hold
    ON ops.media_asset
    FOR EACH ROW EXECUTE FUNCTION ops.guard_media_asset_cleanup_lease_holds();

DROP TRIGGER IF EXISTS trg_photo_media_storage_event_append_only ON audit.photo_media_storage_event;
CREATE TRIGGER trg_photo_media_storage_event_append_only
    BEFORE UPDATE OR DELETE ON audit.photo_media_storage_event
    FOR EACH ROW EXECUTE FUNCTION audit.guard_photo_evidence_event_append_only();

DROP TRIGGER IF EXISTS trg_photo_media_reconciliation_run_append_only ON audit.photo_media_reconciliation_run;
CREATE TRIGGER trg_photo_media_reconciliation_run_append_only
    BEFORE UPDATE OR DELETE ON audit.photo_media_reconciliation_run
    FOR EACH ROW EXECUTE FUNCTION audit.guard_photo_evidence_event_append_only();

COMMENT ON TABLE ops.media_asset_replica IS 'Provider-neutral primary/recovery copy proof; verified rows are immutable except governed deletion tombstones.';
COMMENT ON COLUMN ops.media_asset.raw_object_version_id IS
    'Provider-neutral opaque version identity for the raw object; legacy R2 rows remain NULL.';
COMMENT ON COLUMN ops.media_asset.thumbnail_object_version_id IS
    'Provider-neutral opaque version identity for the thumbnail object; legacy R2 rows remain NULL.';
COMMENT ON COLUMN ops.media_asset_replica.object_version_id IS
    'Provider-neutral opaque version identity authoritative for each stored replica; legacy R2 rows remain NULL.';
COMMENT ON TABLE audit.photo_media_storage_event IS 'Sanitized append-only media storage, recovery, reconciliation, quota, and cleanup audit.';
COMMENT ON TABLE audit.photo_media_reconciliation_run IS 'Sanitized append-only object inventory reconciliation receipts; object keys are never stored here.';

COMMENT ON TABLE ops.visual_reference_item IS 'Immutable exact template-item visual rubric pinned to one campaign revision.';
COMMENT ON TABLE ops.visual_reference_item_asset IS 'Immutable canonical reference image link for one visual rubric item.';
COMMENT ON TABLE ops.visual_comparison_run IS 'Provider-neutral shadow/advisory comparison evidence isolated from official business outputs.';
COMMENT ON TABLE ops.visual_comparison_review IS 'Append-only human review of an experimental comparison run.';
COMMENT ON TABLE audit.photo_evidence_event IS 'Append-only typed photo-evidence audit without URLs, credentials, image bytes, or free-form payloads.';
-- Store Action photographic remediation review V2 (migration 065).
ALTER TABLE ops.store_action_plan
    ADD COLUMN IF NOT EXISTS resolution_workflow_version SMALLINT NOT NULL DEFAULT 1;
ALTER TABLE ops.store_action_plan
    DROP CONSTRAINT IF EXISTS ck_store_action_plan_resolution_workflow_version;
ALTER TABLE ops.store_action_plan
    ADD CONSTRAINT ck_store_action_plan_resolution_workflow_version
    CHECK (resolution_workflow_version IN (1, 2));
ALTER TABLE ops.store_action_plan
    DROP CONSTRAINT IF EXISTS store_action_plan_status_check;
ALTER TABLE ops.store_action_plan
    ADD CONSTRAINT store_action_plan_status_check CHECK (
        status IN ('open', 'in_progress', 'blocked', 'solution_review_pending',
                   'correction_required', 'closed', 'cancelled')
    );
DROP INDEX IF EXISTS ops.idx_store_action_plan_active_source_unique;
CREATE UNIQUE INDEX idx_store_action_plan_active_source_unique
    ON ops.store_action_plan (store_id, source_type, source_id)
    WHERE status IN ('open', 'in_progress', 'blocked', 'solution_review_pending', 'correction_required');
CREATE INDEX IF NOT EXISTS idx_store_action_plan_solution_review_queue
    ON ops.store_action_plan (region_id, updated_at, store_action_plan_id)
    WHERE status = 'solution_review_pending';
CREATE TABLE IF NOT EXISTS ops.store_action_solution_upload_intent (
    store_action_solution_upload_intent_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_action_plan_id UUID NOT NULL,
    media_asset_id UUID NOT NULL,
    company_id UUID NOT NULL,
    region_id UUID NOT NULL,
    store_id UUID NOT NULL,
    initiated_by_user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_store_action_solution_upload_intent_asset UNIQUE (media_asset_id),
    CONSTRAINT fk_store_action_solution_upload_intent_plan
      FOREIGN KEY (store_action_plan_id, company_id, region_id, store_id)
      REFERENCES ops.store_action_plan(store_action_plan_id, company_id, region_id, store_id),
    CONSTRAINT fk_store_action_solution_upload_intent_asset
      FOREIGN KEY (media_asset_id, company_id, store_id)
      REFERENCES ops.media_asset(media_asset_id, company_id, store_id)
);
DROP TRIGGER IF EXISTS trg_store_action_solution_upload_intent_immutable
    ON ops.store_action_solution_upload_intent;
CREATE TRIGGER trg_store_action_solution_upload_intent_immutable
    BEFORE UPDATE OR DELETE ON ops.store_action_solution_upload_intent
    FOR EACH ROW EXECUTE FUNCTION ops.guard_checklist_photo_evidence_immutable();
-- VM reference management V1 (migration 066).
INSERT INTO ops.role (role_id, role_code, role_name, role_scope_type, description, is_system_role)
VALUES
    ('60000000-0000-0000-0000-000000000011', 'VM_REFERENCE_PUBLISHER', 'VM Reference Publisher', 'company', 'Explicit company-scoped VM reference publishing capability', TRUE),
    ('60000000-0000-0000-0000-000000000012', 'VM_VISUAL_REVIEWER', 'VM Visual Reviewer', 'company', 'Explicit company-scoped VM visual coverage read capability', TRUE),
    ('60000000-0000-0000-0000-000000000013', 'VM_CAMPAIGN_WINDOW_AUTHORITY', 'VM Campaign Window Authority', 'company', 'Explicit company-scoped VM campaign window authority', TRUE),
    ('60000000-0000-0000-0000-000000000014', 'VM_CAMPAIGN_SCOPE_AUTHORITY', 'VM Campaign Scope Authority', 'company', 'Explicit company-scoped VM campaign scope authority', TRUE),
    ('60000000-0000-0000-0000-000000000015', 'VM_CAMPAIGN_EMERGENCY_AUTHORITY', 'VM Campaign Emergency Authority', 'company', 'Explicit company-scoped VM campaign emergency authority', TRUE)
ON CONFLICT (role_code) DO UPDATE SET
    role_name = EXCLUDED.role_name,
    role_scope_type = EXCLUDED.role_scope_type,
    description = EXCLUDED.description,
    is_system_role = EXCLUDED.is_system_role;

INSERT INTO ops.permission (permission_id, permission_code, resource_name, action_name, description)
VALUES
    ('70000000-0000-0000-0000-000000000021', 'VM_REFERENCE_PUBLISHER', 'vm_reference', 'publish', 'Draft and publish company-scoped VM references'),
    ('70000000-0000-0000-0000-000000000022', 'VM_VISUAL_REVIEWER', 'vm_visual_coverage', 'read', 'Read company-scoped VM campaign coverage'),
    ('70000000-0000-0000-0000-000000000023', 'VM_CAMPAIGN_WINDOW_AUTHORITY', 'vm_campaign', 'revise_window', 'Extend or reopen VM campaign windows'),
    ('70000000-0000-0000-0000-000000000024', 'VM_CAMPAIGN_SCOPE_AUTHORITY', 'vm_campaign', 'revise_scope', 'Add, withdraw, or exempt VM campaign assignments'),
    ('70000000-0000-0000-0000-000000000025', 'VM_CAMPAIGN_EMERGENCY_AUTHORITY', 'vm_campaign', 'emergency_retire', 'Place campaigns on hold and execute emergency retirement')
ON CONFLICT (permission_code) DO UPDATE SET
    resource_name = EXCLUDED.resource_name,
    action_name = EXCLUDED.action_name,
    description = EXCLUDED.description;

WITH grants(role_code, permission_code) AS (
    VALUES
        ('VM_REFERENCE_PUBLISHER', 'VM_REFERENCE_PUBLISHER'),
        ('VM_VISUAL_REVIEWER', 'VM_VISUAL_REVIEWER'),
        ('VM_CAMPAIGN_WINDOW_AUTHORITY', 'VM_CAMPAIGN_WINDOW_AUTHORITY'),
        ('VM_CAMPAIGN_SCOPE_AUTHORITY', 'VM_CAMPAIGN_SCOPE_AUTHORITY'),
        ('VM_CAMPAIGN_EMERGENCY_AUTHORITY', 'VM_CAMPAIGN_EMERGENCY_AUTHORITY')
)
INSERT INTO ops.role_permission (role_id, permission_id)
SELECT role.role_id, permission.permission_id
FROM grants
INNER JOIN ops.role role ON role.role_code = grants.role_code
INNER JOIN ops.permission permission ON permission.permission_code = grants.permission_code
ON CONFLICT DO NOTHING;

ALTER TABLE ops.media_asset DROP CONSTRAINT IF EXISTS ck_media_asset_classification;
ALTER TABLE ops.media_asset ADD CONSTRAINT ck_media_asset_classification CHECK (
    classification IN ('checklist_evidence', 'action_evidence', 'vm_reference',
                       'vm_campaign_evidence', 'derived_artifact')
);

ALTER TABLE ops.visual_reference_set
    ADD COLUMN IF NOT EXISTS instructions TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS draft_optimistic_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ops.visual_reference_set DROP CONSTRAINT IF EXISTS ck_visual_reference_set_draft_version;
ALTER TABLE ops.visual_reference_set ADD CONSTRAINT ck_visual_reference_set_draft_version
    CHECK (draft_optimistic_version >= 0);

ALTER TABLE ops.visual_reference_draft_item
    ADD COLUMN IF NOT EXISTS required_evidence_count INTEGER NOT NULL DEFAULT 1;
ALTER TABLE ops.visual_reference_draft_item DROP CONSTRAINT IF EXISTS ck_visual_reference_draft_item_required_count;
ALTER TABLE ops.visual_reference_draft_item ADD CONSTRAINT ck_visual_reference_draft_item_required_count
    CHECK (required_evidence_count = 1);

CREATE TABLE IF NOT EXISTS ops.visual_reference_version (
    visual_reference_version_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visual_reference_set_id UUID NOT NULL,
    company_id UUID NOT NULL,
    version_no INTEGER NOT NULL,
    instructions TEXT NOT NULL,
    content_sha256 CHAR(64) NOT NULL,
    published_by_user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    retired_at TIMESTAMPTZ,
    CONSTRAINT uq_visual_reference_version_no UNIQUE (visual_reference_set_id, version_no),
    CONSTRAINT uq_visual_reference_version_scope UNIQUE (visual_reference_version_id, visual_reference_set_id, company_id),
    CONSTRAINT fk_visual_reference_version_set FOREIGN KEY (visual_reference_set_id, company_id)
      REFERENCES ops.visual_reference_set(visual_reference_set_id, company_id),
    CONSTRAINT ck_visual_reference_version_no CHECK (version_no > 0),
    CONSTRAINT ck_visual_reference_version_hash CHECK (content_sha256 ~ '^[0-9a-f]{64}$')
);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM ops.visual_campaign_revision LIMIT 1) THEN
        RAISE EXCEPTION 'Migration 066 requires the pre-runtime VM campaign foundation to be unused.'
            USING ERRCODE = '55000';
    END IF;
END;
$$;

ALTER TABLE ops.visual_campaign_revision
    ADD COLUMN IF NOT EXISTS visual_reference_version_id UUID,
    ADD COLUMN IF NOT EXISTS command_digest CHAR(64);
ALTER TABLE ops.visual_campaign_revision
    ALTER COLUMN visual_reference_version_id SET NOT NULL,
    ALTER COLUMN command_digest SET NOT NULL;
ALTER TABLE ops.visual_campaign_revision DROP CONSTRAINT IF EXISTS fk_visual_campaign_revision_reference_version;
ALTER TABLE ops.visual_campaign_revision ADD CONSTRAINT fk_visual_campaign_revision_reference_version
    FOREIGN KEY (visual_reference_version_id, visual_reference_set_id, company_id)
    REFERENCES ops.visual_reference_version(visual_reference_version_id, visual_reference_set_id, company_id);
ALTER TABLE ops.visual_campaign_revision DROP CONSTRAINT IF EXISTS ck_visual_campaign_revision_command_digest;
ALTER TABLE ops.visual_campaign_revision ADD CONSTRAINT ck_visual_campaign_revision_command_digest
    CHECK (command_digest ~ '^[0-9a-f]{64}$');

ALTER TABLE ops.visual_reference_item
    ADD COLUMN IF NOT EXISTS visual_reference_version_id UUID,
    ADD COLUMN IF NOT EXISTS required_evidence_count INTEGER NOT NULL DEFAULT 1;
ALTER TABLE ops.visual_reference_item ALTER COLUMN visual_reference_version_id SET NOT NULL;
ALTER TABLE ops.visual_reference_item DROP CONSTRAINT IF EXISTS fk_visual_reference_item_version;
ALTER TABLE ops.visual_reference_item ADD CONSTRAINT fk_visual_reference_item_version
    FOREIGN KEY (visual_reference_version_id, visual_reference_set_id, company_id)
    REFERENCES ops.visual_reference_version(visual_reference_version_id, visual_reference_set_id, company_id);
ALTER TABLE ops.visual_reference_item DROP CONSTRAINT IF EXISTS ck_visual_reference_item_required_count;
ALTER TABLE ops.visual_reference_item ADD CONSTRAINT ck_visual_reference_item_required_count
    CHECK (required_evidence_count = 1);

CREATE TABLE IF NOT EXISTS ops.visual_campaign_revision_store (
    campaign_revision_store_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_revision_id UUID NOT NULL,
    visual_reference_set_id UUID NOT NULL,
    company_id UUID NOT NULL,
    region_id UUID NOT NULL,
    store_id UUID NOT NULL,
    snapshot_sha256 CHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_visual_campaign_revision_store UNIQUE (campaign_revision_id, store_id),
    CONSTRAINT fk_visual_campaign_revision_store_revision FOREIGN KEY (campaign_revision_id, visual_reference_set_id, company_id)
      REFERENCES ops.visual_campaign_revision(campaign_revision_id, visual_reference_set_id, company_id),
    CONSTRAINT fk_visual_campaign_revision_store_store FOREIGN KEY (store_id, company_id, region_id)
      REFERENCES ops.store(store_id, company_id, region_id),
    CONSTRAINT ck_visual_campaign_revision_store_hash CHECK (snapshot_sha256 ~ '^[0-9a-f]{64}$')
);

CREATE TABLE IF NOT EXISTS ops.visual_reference_upload_intent (
    visual_reference_upload_intent_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visual_reference_set_id UUID NOT NULL,
    visual_reference_draft_item_id UUID NOT NULL,
    media_asset_id UUID NOT NULL,
    company_id UUID NOT NULL,
    initiated_by_user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_visual_reference_upload_intent_asset UNIQUE (media_asset_id),
    CONSTRAINT fk_visual_reference_upload_intent_item FOREIGN KEY (visual_reference_draft_item_id, visual_reference_set_id, company_id)
      REFERENCES ops.visual_reference_draft_item(visual_reference_draft_item_id, visual_reference_set_id, company_id),
    CONSTRAINT fk_visual_reference_upload_intent_asset FOREIGN KEY (media_asset_id, company_id)
      REFERENCES ops.media_asset(media_asset_id, company_id)
);

CREATE TABLE IF NOT EXISTS ops.visual_campaign_submission_upload_intent (
    visual_campaign_submission_upload_intent_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID NOT NULL,
    visual_reference_item_id UUID NOT NULL,
    media_asset_id UUID NOT NULL,
    visual_reference_set_id UUID NOT NULL,
    campaign_revision_id UUID NOT NULL,
    company_id UUID NOT NULL,
    region_id UUID NOT NULL,
    store_id UUID NOT NULL,
    initiated_by_user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_visual_campaign_submission_upload_intent_asset UNIQUE (media_asset_id),
    CONSTRAINT fk_visual_campaign_submission_upload_intent_assignment FOREIGN KEY (assignment_id, visual_reference_set_id, company_id, region_id, store_id)
      REFERENCES ops.visual_campaign_assignment(assignment_id, visual_reference_set_id, company_id, region_id, store_id),
    CONSTRAINT fk_visual_campaign_submission_upload_intent_item FOREIGN KEY (visual_reference_item_id, campaign_revision_id, visual_reference_set_id, company_id)
      REFERENCES ops.visual_reference_item(visual_reference_item_id, campaign_revision_id, visual_reference_set_id, company_id),
    CONSTRAINT fk_visual_campaign_submission_upload_intent_asset FOREIGN KEY (media_asset_id, company_id, store_id)
      REFERENCES ops.media_asset(media_asset_id, company_id, store_id)
);

CREATE TABLE IF NOT EXISTS ops.visual_campaign_command_receipt (
    visual_campaign_command_receipt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visual_reference_set_id UUID NOT NULL,
    company_id UUID NOT NULL,
    actor_user_id UUID REFERENCES ops.user_account(user_id),
    actor_identity TEXT NOT NULL,
    command_type TEXT NOT NULL,
    idempotency_key UUID NOT NULL,
    payload_sha256 CHAR(64) NOT NULL,
    result_code TEXT NOT NULL,
    result_entity_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_visual_campaign_command_receipt_idempotency UNIQUE (visual_reference_set_id, actor_identity, command_type, idempotency_key),
    CONSTRAINT fk_visual_campaign_command_receipt_set FOREIGN KEY (visual_reference_set_id, company_id)
      REFERENCES ops.visual_reference_set(visual_reference_set_id, company_id),
    CONSTRAINT ck_visual_campaign_command_receipt_type CHECK (command_type IN ('publish', 'submit', 'settle', 'extend', 'reopen', 'scope_add', 'withdraw', 'exempt', 'hold', 'reconcile', 'retire')),
    CONSTRAINT ck_visual_campaign_command_receipt_hash CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_visual_campaign_command_receipt_result CHECK (length(btrim(result_code)) > 0),
    CONSTRAINT ck_visual_campaign_command_receipt_actor CHECK (
      (actor_user_id IS NOT NULL AND actor_identity = actor_user_id::text)
      OR (actor_user_id IS NULL AND actor_identity = 'system:settlement')
    )
);

CREATE TABLE IF NOT EXISTS ops.checklist_instance_item_visual_reference (
    checklist_instance_item_visual_reference_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checklist_instance_id UUID NOT NULL,
    template_item_id UUID NOT NULL,
    store_id UUID NOT NULL,
    visual_reference_item_id UUID NOT NULL,
    campaign_revision_id UUID NOT NULL,
    visual_reference_set_id UUID NOT NULL,
    visual_reference_version_id UUID NOT NULL,
    company_id UUID NOT NULL,
    pinned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_checklist_instance_item_visual_reference UNIQUE (checklist_instance_id, template_item_id),
    CONSTRAINT fk_checklist_instance_item_visual_reference_instance FOREIGN KEY (checklist_instance_id, store_id)
      REFERENCES ops.checklist_instance(checklist_instance_id, store_id),
    CONSTRAINT fk_checklist_instance_item_visual_reference_item FOREIGN KEY (visual_reference_item_id, campaign_revision_id, visual_reference_set_id, company_id)
      REFERENCES ops.visual_reference_item(visual_reference_item_id, campaign_revision_id, visual_reference_set_id, company_id),
    CONSTRAINT fk_checklist_instance_item_visual_reference_version FOREIGN KEY (visual_reference_version_id, visual_reference_set_id, company_id)
      REFERENCES ops.visual_reference_version(visual_reference_version_id, visual_reference_set_id, company_id)
);

CREATE OR REPLACE FUNCTION ops.pin_checklist_instance_visual_references()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO ops.checklist_instance_item_visual_reference (
        checklist_instance_id, template_item_id, store_id, visual_reference_item_id,
        campaign_revision_id, visual_reference_set_id, visual_reference_version_id, company_id
    )
    SELECT NEW.checklist_instance_id, item.template_item_id, NEW.store_id,
        item.visual_reference_item_id, item.campaign_revision_id,
        item.visual_reference_set_id, item.visual_reference_version_id, item.company_id
    FROM ops.visual_campaign_assignment assignment
    INNER JOIN ops.visual_campaign_revision revision
      ON revision.campaign_revision_id = assignment.active_campaign_revision_id
    INNER JOIN ops.visual_reference_item item
      ON item.campaign_revision_id = revision.campaign_revision_id
     AND item.checklist_template_id = NEW.checklist_template_id
    WHERE assignment.store_id = NEW.store_id
      AND assignment.deadline_status IN ('scheduled', 'open')
      AND CURRENT_TIMESTAMP >= revision.starts_at
      AND CURRENT_TIMESTAMP < revision.submission_closes_at
    ON CONFLICT (checklist_instance_id, template_item_id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_checklist_instance_pin_visual_references ON ops.checklist_instance;
CREATE TRIGGER trg_checklist_instance_pin_visual_references
AFTER INSERT ON ops.checklist_instance
FOR EACH ROW EXECUTE FUNCTION ops.pin_checklist_instance_visual_references();

ALTER TABLE ops.visual_campaign_submission
    ADD COLUMN IF NOT EXISTS payload_sha256 CHAR(64);
ALTER TABLE ops.visual_campaign_submission ALTER COLUMN payload_sha256 SET NOT NULL;
ALTER TABLE ops.visual_campaign_submission DROP CONSTRAINT IF EXISTS ck_visual_campaign_submission_payload_hash;
ALTER TABLE ops.visual_campaign_submission ADD CONSTRAINT ck_visual_campaign_submission_payload_hash
    CHECK (payload_sha256 ~ '^[0-9a-f]{64}$');
CREATE UNIQUE INDEX IF NOT EXISTS idx_visual_campaign_submission_media_asset_unique
    ON ops.visual_campaign_submission_media(media_asset_id);

ALTER TABLE audit.photo_evidence_event
    ADD COLUMN IF NOT EXISTS visual_reference_version_id UUID,
    ADD COLUMN IF NOT EXISTS campaign_revision_id UUID,
    ADD COLUMN IF NOT EXISTS command_digest CHAR(64),
    ADD COLUMN IF NOT EXISTS idempotency_key UUID,
    ADD COLUMN IF NOT EXISTS assignment_snapshot_sha256 CHAR(64);
ALTER TABLE audit.photo_evidence_event DROP CONSTRAINT IF EXISTS ck_photo_evidence_event_command_digest;
ALTER TABLE audit.photo_evidence_event ADD CONSTRAINT ck_photo_evidence_event_command_digest CHECK (
    command_digest IS NULL OR command_digest ~ '^[0-9a-f]{64}$'
);
ALTER TABLE audit.photo_evidence_event DROP CONSTRAINT IF EXISTS ck_photo_evidence_event_snapshot_digest;
ALTER TABLE audit.photo_evidence_event ADD CONSTRAINT ck_photo_evidence_event_snapshot_digest CHECK (
    assignment_snapshot_sha256 IS NULL OR assignment_snapshot_sha256 ~ '^[0-9a-f]{64}$'
);

CREATE INDEX IF NOT EXISTS idx_visual_campaign_assignment_settlement
    ON ops.visual_campaign_assignment(deadline_status, active_campaign_revision_id, assignment_id)
    WHERE deadline_status IN ('scheduled', 'open');
CREATE INDEX IF NOT EXISTS idx_visual_campaign_revision_window
    ON ops.visual_campaign_revision(company_id, starts_at, submission_closes_at);

DO $$
DECLARE table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'visual_reference_version', 'visual_campaign_revision_store',
        'visual_reference_upload_intent', 'visual_campaign_submission_upload_intent',
        'visual_campaign_command_receipt', 'checklist_instance_item_visual_reference'
    ] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON ops.%I', 'trg_' || table_name || '_immutable', table_name);
        EXECUTE format(
            'CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON ops.%I FOR EACH ROW EXECUTE FUNCTION ops.guard_checklist_photo_evidence_immutable()',
            'trg_' || table_name || '_immutable', table_name
        );
    END LOOP;
END;
$$;

COMMENT ON TABLE ops.visual_reference_version IS 'Immutable published VM reference content identity.';
COMMENT ON TABLE ops.visual_campaign_revision_store IS 'Immutable reconstructable store snapshot for one campaign revision.';
COMMENT ON TABLE ops.visual_campaign_command_receipt IS 'Sanitized payload-bound idempotency receipt for VM campaign commands.';
COMMENT ON TABLE ops.checklist_instance_item_visual_reference IS 'Immutable exact checklist instance item to VM reference pin.';

CREATE TABLE IF NOT EXISTS ops.personnel_correction_request (
    request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    region_id UUID NOT NULL REFERENCES ops.region(region_id),
    store_id UUID NOT NULL REFERENCES ops.store(store_id),
    employee_id UUID NOT NULL REFERENCES ops.employee(employee_id),
    assignment_id UUID NOT NULL REFERENCES ops.employee_assignment_history(assignment_id),
    employee_revision TIMESTAMPTZ NOT NULL,
    assignment_revision TIMESTAMPTZ NOT NULL,
    previous_values JSONB NOT NULL CHECK (jsonb_typeof(previous_values) = 'object'),
    proposed_national_id_hash TEXT,
    proposed_values JSONB NOT NULL CHECK (jsonb_typeof(proposed_values) = 'object'),
    request_reason TEXT NOT NULL CHECK (length(btrim(request_reason)) BETWEEN 1 AND 500),
    request_status TEXT NOT NULL DEFAULT 'pending_hr_approval'
        CHECK (request_status IN ('pending_hr_approval', 'approved', 'rejected')),
    submitted_by_user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    reviewed_by_user_id UUID REFERENCES ops.user_account(user_id),
    review_note TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK ((request_status = 'pending_hr_approval' AND reviewed_at IS NULL AND reviewed_by_user_id IS NULL)
        OR (request_status <> 'pending_hr_approval' AND reviewed_at IS NOT NULL AND reviewed_by_user_id IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS personnel_correction_pending_employee
    ON ops.personnel_correction_request(employee_id) WHERE request_status = 'pending_hr_approval';
CREATE INDEX IF NOT EXISTS personnel_correction_company_status
    ON ops.personnel_correction_request(company_id, request_status, created_at DESC);
CREATE INDEX IF NOT EXISTS personnel_correction_store_status
    ON ops.personnel_correction_request(store_id, request_status, created_at DESC);
