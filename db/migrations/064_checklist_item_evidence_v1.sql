BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

ALTER TABLE audit.photo_evidence_event
  DROP CONSTRAINT IF EXISTS ck_photo_evidence_event_type;
ALTER TABLE audit.photo_evidence_event
  ADD CONSTRAINT ck_photo_evidence_event_type CHECK (event_type IN (
    'checklist_photo_evidence.media.upload_initiated', 'checklist_photo_evidence.media.uploaded',
    'checklist_photo_evidence.media.rejected', 'checklist_photo_evidence.media.quarantined',
    'checklist_photo_evidence.media.finalized', 'checklist_photo_evidence.media.viewed',
    'checklist_photo_evidence.media.downloaded', 'checklist_photo_evidence.media.redacted',
    'checklist_photo_evidence.media.expired', 'checklist_photo_evidence.media.deleted',
    'checklist_photo_evidence.media.deletion_failed', 'checklist_photo_evidence.checklist.linked',
    'checklist_photo_evidence.checklist.unlinked', 'checklist_photo_evidence.checklist.completed_locked',
    'checklist_photo_evidence.reference.draft_created', 'checklist_photo_evidence.reference.published',
    'checklist_photo_evidence.reference.retired', 'checklist_photo_evidence.reference.superseded',
    'checklist_photo_evidence.campaign.scheduled', 'checklist_photo_evidence.campaign.opened',
    'checklist_photo_evidence.campaign.submitted', 'checklist_photo_evidence.campaign.closed',
    'checklist_photo_evidence.campaign.missed', 'checklist_photo_evidence.campaign.exempted',
    'checklist_photo_evidence.campaign.extended', 'checklist_photo_evidence.campaign.reopened',
    'checklist_photo_evidence.campaign.scope_revised', 'checklist_photo_evidence.campaign.operational_hold_recorded',
    'checklist_photo_evidence.action.solution_submitted', 'checklist_photo_evidence.action.solution_approved',
    'checklist_photo_evidence.action.solution_rejected', 'checklist_photo_evidence.action.solution_resubmitted',
    'checklist_photo_evidence.comparison.queued', 'checklist_photo_evidence.comparison.invoked',
    'checklist_photo_evidence.comparison.completed', 'checklist_photo_evidence.comparison.abstained',
    'checklist_photo_evidence.comparison.failed', 'checklist_photo_evidence.comparison.retried',
    'checklist_photo_evidence.comparison.review_accepted', 'checklist_photo_evidence.comparison.review_overridden',
    'checklist_photo_evidence.comparison.review_rejected', 'checklist_photo_evidence.comparison.recapture_requested',
    'checklist_photo_evidence.retention.policy_changed', 'checklist_photo_evidence.retention.cleanup_previewed',
    'checklist_photo_evidence.retention.cleanup_executed', 'checklist_photo_evidence.authorization.denied'
  ));

DO $$
BEGIN
  IF EXISTS (
    SELECT media_asset_id
    FROM ops.checklist_response_media
    GROUP BY media_asset_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate checklist evidence asset links must be resolved before migration';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM ops.checklist_response_media media
    JOIN ops.checklist_instance instance
      ON instance.checklist_instance_id = media.checklist_instance_id
    WHERE instance.status IN ('completed', 'cancelled')
  ) THEN
    RAISE EXCEPTION 'historical checklist evidence links require an explicit snapshot migration decision';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM ops.checklist_instance instance
    LEFT JOIN ops.checklist_template template
      ON template.checklist_template_id = instance.checklist_template_id
    WHERE instance.status IN ('planned', 'in_progress')
      AND template.checklist_template_id IS NULL
  ) THEN
    RAISE EXCEPTION 'active checklist instance references a missing template';
  END IF;
END;
$$;

ALTER TABLE ops.checklist_template_item
  ADD COLUMN IF NOT EXISTS evidence_policy TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS max_evidence_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE ops.checklist_template_item
  DROP CONSTRAINT IF EXISTS ck_checklist_template_item_evidence_policy;
ALTER TABLE ops.checklist_template_item
  ADD CONSTRAINT ck_checklist_template_item_evidence_policy
    CHECK (evidence_policy IN ('none', 'optional', 'required'));
ALTER TABLE ops.checklist_template_item
  DROP CONSTRAINT IF EXISTS ck_checklist_template_item_evidence_count;
ALTER TABLE ops.checklist_template_item
  ADD CONSTRAINT ck_checklist_template_item_evidence_count CHECK (
    (evidence_policy = 'none' AND max_evidence_count = 0)
    OR (evidence_policy IN ('optional', 'required') AND max_evidence_count > 0)
  );

ALTER TABLE ops.checklist_instance
  ADD COLUMN IF NOT EXISTS evidence_version_no INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ops.checklist_instance
  DROP CONSTRAINT IF EXISTS ck_checklist_instance_evidence_version;
ALTER TABLE ops.checklist_instance
  ADD CONSTRAINT ck_checklist_instance_evidence_version CHECK (evidence_version_no >= 0);

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
    REFERENCES ops.checklist_instance(checklist_instance_id, checklist_template_id)
    ON DELETE CASCADE,
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

CREATE OR REPLACE FUNCTION ops.snapshot_checklist_instance_item_policy()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO ops.checklist_instance_item_policy (
    checklist_instance_id, checklist_template_id, template_item_id,
    evidence_policy, max_evidence_count
  )
  SELECT
    NEW.checklist_instance_id, NEW.checklist_template_id, item.template_item_id,
    item.evidence_policy, item.max_evidence_count
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

INSERT INTO ops.checklist_instance_item_policy (
  checklist_instance_id, checklist_template_id, template_item_id,
  evidence_policy, max_evidence_count
)
SELECT
  instance.checklist_instance_id,
  instance.checklist_template_id,
  item.template_item_id,
  item.evidence_policy,
  item.max_evidence_count
FROM ops.checklist_instance instance
JOIN ops.checklist_template_item item
  ON item.checklist_template_id = instance.checklist_template_id
WHERE instance.status IN ('planned', 'in_progress')
ON CONFLICT (checklist_instance_id, template_item_id) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM ops.checklist_instance instance
    JOIN ops.checklist_template_item item
      ON item.checklist_template_id = instance.checklist_template_id
    LEFT JOIN ops.checklist_instance_item_policy policy
      ON policy.checklist_instance_id = instance.checklist_instance_id
     AND policy.template_item_id = item.template_item_id
    WHERE instance.status IN ('planned', 'in_progress')
      AND policy.checklist_instance_id IS NULL
  ) THEN
    RAISE EXCEPTION 'active checklist instance policy snapshot is incomplete';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION ops.guard_checklist_instance_item_policy_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'checklist instance item policy is immutable';
END;
$$;

DROP TRIGGER IF EXISTS trg_checklist_instance_item_policy_immutable
  ON ops.checklist_instance_item_policy;
CREATE TRIGGER trg_checklist_instance_item_policy_immutable
  BEFORE UPDATE OR DELETE ON ops.checklist_instance_item_policy
  FOR EACH ROW EXECUTE FUNCTION ops.guard_checklist_instance_item_policy_immutable();

CREATE OR REPLACE FUNCTION ops.guard_published_checklist_item_evidence_policy()
RETURNS trigger
LANGUAGE plpgsql
AS $$
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

DROP TRIGGER IF EXISTS trg_published_checklist_item_evidence_policy
  ON ops.checklist_template_item;
CREATE TRIGGER trg_published_checklist_item_evidence_policy
  BEFORE UPDATE OR DELETE ON ops.checklist_template_item
  FOR EACH ROW EXECUTE FUNCTION ops.guard_published_checklist_item_evidence_policy();

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

DROP TRIGGER IF EXISTS trg_checklist_item_evidence_upload_intent_immutable
  ON ops.checklist_item_evidence_upload_intent;
CREATE TRIGGER trg_checklist_item_evidence_upload_intent_immutable
  BEFORE UPDATE OR DELETE ON ops.checklist_item_evidence_upload_intent
  FOR EACH ROW EXECUTE FUNCTION ops.guard_checklist_instance_item_policy_immutable();

ALTER TABLE ops.checklist_response_media
  DROP CONSTRAINT IF EXISTS fk_checklist_response_media_instance_policy;
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

COMMENT ON COLUMN ops.checklist_template_item.evidence_policy
  IS 'Draft-authored none|optional|required photo evidence policy.';
COMMENT ON TABLE ops.checklist_instance_item_policy
  IS 'Immutable evidence-policy snapshot pinned to the exact checklist instance and template item.';
COMMENT ON TABLE ops.photo_evidence_command_receipt
  IS 'Actor-scoped digest-bound idempotency receipts for checklist evidence commands.';

COMMIT;
