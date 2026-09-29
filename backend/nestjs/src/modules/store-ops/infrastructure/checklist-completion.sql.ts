export const checklistCompletionSql = `
  SELECT
    ((
      SUM(scoring.score_ratio * cti.weight)
        FILTER (WHERE cti.response_type <> 'compliance' OR cr.response_value IS DISTINCT FROM 'not_applicable')
      / NULLIF(
          SUM(cti.weight) FILTER (WHERE cti.response_type <> 'compliance' OR cr.response_value IS DISTINCT FROM 'not_applicable'),
          0
        )
    ) * 100)::numeric(12,2)::text AS total_score,
    CASE
      WHEN COUNT(*) FILTER (WHERE cti.response_type = 'compliance') > 0 THEN
        AVG(scoring.score_ratio)
          FILTER (
            WHERE cti.response_type = 'compliance'
              AND cr.response_value IS DISTINCT FROM 'not_applicable'
          )
      ELSE
        SUM(scoring.score_ratio * cti.weight)
          / NULLIF(SUM(cti.weight), 0)
    END::numeric(7,4)::text AS compliance_rate,
    COUNT(*) FILTER (
      WHERE (cti.is_mandatory = TRUE AND cr.response_id IS NULL)
         OR (cti.response_type = 'compliance' AND cr.response_value = 'not_applicable'
             AND COALESCE(cr.comment_text, '') !~ '[^[:space:]]')
    )::text AS missing_mandatory_count,
    COUNT(*) FILTER (
      WHERE policy.evidence_policy = 'required'
        AND (cti.response_type <> 'compliance' OR cr.response_value IS DISTINCT FROM 'not_applicable')
        AND NOT EXISTS (
          SELECT 1 FROM ops.checklist_response_media media
          JOIN ops.media_asset asset ON asset.media_asset_id = media.media_asset_id
          WHERE media.checklist_instance_id = ci.checklist_instance_id
            AND media.template_item_id = cti.template_item_id
            AND media.unlinked_at IS NULL
            AND asset.state = 'ready'
        )
    )::text AS missing_required_evidence_count
  FROM ops.checklist_template_item cti
  LEFT JOIN ops.checklist_response cr
    ON cr.template_item_id = cti.template_item_id
   AND cr.checklist_instance_id = $1::uuid
  INNER JOIN ops.checklist_instance ci
    ON ci.checklist_template_id = cti.checklist_template_id
  LEFT JOIN ops.checklist_instance_item_policy policy
    ON policy.checklist_instance_id = ci.checklist_instance_id
   AND policy.template_item_id = cti.template_item_id
  CROSS JOIN LATERAL (
    SELECT CASE WHEN cti.response_type = 'compliance' THEN
      CASE cr.response_value
        WHEN 'compliant' THEN 1
        WHEN 'partially_compliant' THEN 0.5
        WHEN 'non_compliant' THEN 0
        WHEN 'not_applicable' THEN 0
        ELSE COALESCE(cr.score_value, 0) / NULLIF(cti.max_score, 0)
      END
    ELSE COALESCE(cr.score_value, 0) / NULLIF(cti.max_score, 0)
    END AS score_ratio
  ) scoring
  WHERE ci.checklist_instance_id = $1::uuid
`;
