ALTER TABLE ops.checklist_template_item
    ADD COLUMN IF NOT EXISTS creates_remediation_task BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN ops.checklist_template_item.creates_remediation_task IS
    'Controls whether an acknowledged non-compliant response creates a Store Action task.';

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
        OR NEW.creates_remediation_task IS DISTINCT FROM OLD.creates_remediation_task
    ) THEN
        RAISE EXCEPTION 'published checklist item evidence policy is immutable';
    END IF;
    RETURN NEW;
END;
$$;
