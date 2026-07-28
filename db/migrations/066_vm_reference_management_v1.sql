SET LOCAL lock_timeout = '5000ms';
SET LOCAL statement_timeout = '30000ms';

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

ALTER TABLE ops.visual_campaign_assignment
    ADD COLUMN IF NOT EXISTS hold_reconciled_at TIMESTAMPTZ;
ALTER TABLE ops.visual_campaign_assignment DROP CONSTRAINT IF EXISTS ck_visual_campaign_assignment_hold_reconciliation;
ALTER TABLE ops.visual_campaign_assignment ADD CONSTRAINT ck_visual_campaign_assignment_hold_reconciliation
    CHECK (hold_reconciled_at IS NULL OR deadline_status = 'operational_hold');

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
    CONSTRAINT ck_visual_campaign_command_receipt_result CHECK (length(btrim(result_code)) > 0)
    ,CONSTRAINT ck_visual_campaign_command_receipt_actor CHECK (
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
