SET LOCAL lock_timeout = '5000ms';
SET LOCAL statement_timeout = '30000ms';

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
    capture_source TEXT NOT NULL,
    raw_object_key TEXT NOT NULL,
    canonical_object_key TEXT,
    thumbnail_object_key TEXT,
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
    CONSTRAINT ck_media_asset_raw_key_private CHECK (
        raw_object_key = btrim(raw_object_key)
        AND length(raw_object_key) > 0
        AND raw_object_key ~ '^[A-Za-z0-9][A-Za-z0-9._/-]*$'
        AND raw_object_key !~ '(^|/)\.\.?(/|$)'
        AND raw_object_key !~ '//'
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
        'evidence_access'
    )),
    CONSTRAINT ck_photo_evidence_event_state_before CHECK (state_before IS NULL OR state_before IN (
        'initiated', 'uploaded', 'quarantined', 'accepted', 'canonicalized', 'ready', 'rejected',
        'expired', 'purge_pending', 'deleted_tombstone', 'draft', 'scheduled', 'open', 'closed',
        'retired', 'not_submitted', 'review_pending', 'correction_requested', 'completed',
        'solution_review_pending', 'correction_required', 'in_progress', 'on_time', 'missed',
        'exempt', 'withdrawn', 'operational_hold', 'queued', 'processing', 'abstained',
        'failed_retryable', 'failed_terminal', 'human_reviewed', 'approve', 'reject', 'accept',
        'override', 'request_recapture'
    )),
    CONSTRAINT ck_photo_evidence_event_state_after CHECK (state_after IS NULL OR state_after IN (
        'initiated', 'uploaded', 'quarantined', 'accepted', 'canonicalized', 'ready', 'rejected',
        'expired', 'purge_pending', 'deleted_tombstone', 'draft', 'scheduled', 'open', 'closed',
        'retired', 'not_submitted', 'review_pending', 'correction_requested', 'completed',
        'solution_review_pending', 'correction_required', 'in_progress', 'on_time', 'missed',
        'exempt', 'withdrawn', 'operational_hold', 'queued', 'processing', 'abstained',
        'failed_retryable', 'failed_terminal', 'human_reviewed', 'approve', 'reject', 'accept',
        'override', 'request_recapture'
    )),
    CONSTRAINT ck_photo_evidence_event_reason CHECK (reason_code IS NULL OR reason_code IN (
        'user_requested', 'policy_required', 'safety_rejection', 'quota_exceeded',
        'authorization_denied', 'retention_expired', 'legal_hold', 'operational_hold',
        'workflow_hold', 'ai_review_hold', 'deadline_elapsed', 'exempted',
        'correction_requested', 'provider_failure', 'schema_failure', 'safety_failure', 'superseded'
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
COMMENT ON TABLE ops.store_action_solution_attempt IS 'Immutable Store Manager solution submissions awaiting scoped Region Manager review.';
COMMENT ON TABLE ops.store_action_plan_evidence IS 'Immutable finding or solution evidence linked to checklist-derived Store Action work.';
COMMENT ON TABLE ops.store_action_solution_review IS 'Append-only Region Manager approval or rejection of one current solution attempt.';
COMMENT ON TABLE ops.visual_reference_set IS 'Company-owned VM reference campaign aggregate with mutable current projection only.';
COMMENT ON TABLE ops.visual_campaign_revision IS 'Immutable campaign window, reference, and assignment-snapshot revision.';
COMMENT ON TABLE ops.visual_campaign_assignment IS 'Current store obligation projection; history remains in immutable outcomes.';
COMMENT ON TABLE ops.visual_campaign_assignment_outcome IS 'Immutable operational deadline and review outcome per campaign revision.';
COMMENT ON TABLE ops.visual_campaign_submission IS 'Immutable provider-neutral manual campaign submission truth independent of AI availability.';
COMMENT ON TABLE ops.visual_campaign_submission_media IS 'Immutable exact submission, rubric item, and evidence association.';
COMMENT ON TABLE ops.visual_reference_item IS 'Immutable exact template-item visual rubric pinned to one campaign revision.';
COMMENT ON TABLE ops.visual_reference_item_asset IS 'Immutable canonical reference image link for one visual rubric item.';
COMMENT ON TABLE ops.visual_comparison_run IS 'Provider-neutral shadow/advisory comparison evidence isolated from official business outputs.';
COMMENT ON TABLE ops.visual_comparison_review IS 'Append-only human review of an experimental comparison run.';
COMMENT ON TABLE audit.photo_evidence_event IS 'Append-only typed photo-evidence audit without URLs, credentials, image bytes, or free-form payloads.';
