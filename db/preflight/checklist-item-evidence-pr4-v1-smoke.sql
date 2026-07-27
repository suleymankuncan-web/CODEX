BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'ops' AND table_name = 'checklist_template_item'
      AND column_name = 'evidence_policy'
  ) THEN
    RAISE EXCEPTION 'evidence policy column is missing';
  END IF;

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
    RAISE EXCEPTION 'active checklist instance has no pinned item policy';
  END IF;

  IF to_regclass('ops.checklist_item_evidence_upload_intent') IS NULL THEN
    RAISE EXCEPTION 'checklist evidence upload intent table is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'ops' AND table_name = 'photo_evidence_command_receipt'
      AND column_name = 'result_json' AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'deterministic receipt result_json is missing or nullable';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_photo_evidence_event_type'
      AND pg_get_constraintdef(oid) LIKE '%checklist_photo_evidence.checklist.completed_locked%'
  ) THEN
    RAISE EXCEPTION 'typed checklist completion evidence event is unavailable';
  END IF;
END;
$$;

SELECT json_build_object(
  'event', 'checklist_item_evidence_pr4_smoke.completed',
  'upload_intent', 'immutable',
  'receipt_result', 'deterministic_sanitized',
  'completion_event', 'typed',
  'rolled_back', true
)::text;

ROLLBACK;
