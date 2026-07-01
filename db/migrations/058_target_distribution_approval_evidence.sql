ALTER TABLE ops.target_distribution_request
  ADD COLUMN IF NOT EXISTS approval_evidence_json JSONB;

COMMENT ON COLUMN ops.target_distribution_request.approval_evidence_json
  IS 'Stores original and final target approval evidence for adjusted approvals without changing approved target references.';
