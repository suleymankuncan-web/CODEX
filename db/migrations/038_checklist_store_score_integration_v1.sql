CREATE OR REPLACE FUNCTION rpt.generate_store_checklist_snapshot(
    p_snapshot_run_id UUID,
    p_period_start DATE,
    p_period_end DATE
)
RETURNS VOID
LANGUAGE SQL
AS $$
INSERT INTO rpt.store_checklist_snapshot (
    snapshot_run_id,
    store_id,
    checklist_template_id,
    audit_count,
    avg_score,
    compliance_rate,
    critical_issue_count
)
SELECT
    p_snapshot_run_id,
    ci.store_id,
    ci.checklist_template_id,
    COUNT(DISTINCT ci.checklist_instance_id)::INTEGER AS audit_count,
    AVG(ci.total_score)::NUMERIC(12,2) AS avg_score,
    AVG(ci.compliance_rate)::NUMERIC(7,4) AS compliance_rate,
    COALESCE(COUNT(cr.response_id) FILTER (WHERE cr.is_non_compliant = TRUE), 0)::INTEGER AS critical_issue_count
FROM ops.checklist_instance ci
LEFT JOIN ops.checklist_response cr
  ON cr.checklist_instance_id = ci.checklist_instance_id
WHERE ci.status = 'completed'
  AND ci.completed_at IS NOT NULL
  AND ci.completed_at::date BETWEEN p_period_start AND p_period_end
GROUP BY ci.store_id, ci.checklist_template_id;
$$;
