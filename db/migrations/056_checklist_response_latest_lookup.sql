CREATE INDEX IF NOT EXISTS idx_checklist_response_instance_responded_at
  ON ops.checklist_response (checklist_instance_id, responded_at DESC);
