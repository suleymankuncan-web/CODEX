DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM ops.kpi_definition WHERE kpi_code = 'GSM_ONAY'
  ) AND NOT EXISTS (
    SELECT 1 FROM ops.kpi_definition WHERE kpi_code = 'gsm_approval'
  ) THEN
    UPDATE ops.kpi_definition
    SET
      kpi_code = 'gsm_approval',
      kpi_name = 'GSM Onayı',
      metric_type = 'percentage',
      unit_type = 'ratio',
      aggregation_type = 'avg',
      scope_type = 'store',
      formula_definition = NULL,
      target_direction = 'higher_is_better',
      is_active = TRUE
    WHERE kpi_code = 'GSM_ONAY';
  END IF;
END $$;

INSERT INTO ops.kpi_definition (
  kpi_id,
  kpi_code,
  kpi_name,
  metric_type,
  unit_type,
  aggregation_type,
  scope_type,
  formula_definition,
  target_direction,
  is_active
)
SELECT
  COALESCE(
    (SELECT kpi_id FROM ops.kpi_definition WHERE kpi_code = 'GSM_ONAY' LIMIT 1),
    'b0000000-0000-0000-0000-000000000020'::uuid
  ),
  'gsm_approval',
  'GSM Onayı',
  'percentage',
  'ratio',
  'avg',
  'store',
  NULL,
  'higher_is_better',
  TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM ops.kpi_definition WHERE kpi_code = 'gsm_approval'
)
ON CONFLICT (kpi_code) DO UPDATE
SET
  kpi_name = EXCLUDED.kpi_name,
  metric_type = EXCLUDED.metric_type,
  unit_type = EXCLUDED.unit_type,
  aggregation_type = EXCLUDED.aggregation_type,
  scope_type = EXCLUDED.scope_type,
  formula_definition = EXCLUDED.formula_definition,
  target_direction = EXCLUDED.target_direction,
  is_active = EXCLUDED.is_active;

UPDATE ops.kpi_definition
SET
  kpi_name = 'GSM Onayı',
  metric_type = 'percentage',
  unit_type = 'ratio',
  aggregation_type = 'avg',
  scope_type = 'store',
  formula_definition = NULL,
  target_direction = 'higher_is_better',
  is_active = TRUE
WHERE kpi_code = 'gsm_approval';

UPDATE ops.kpi_definition
SET is_active = FALSE
WHERE kpi_code = 'GSM_ONAY';

WITH transformed AS (
  SELECT
    config_key,
    jsonb_set(
      config_payload,
      '{metrics}',
      (
        SELECT jsonb_agg(
          CASE
            WHEN metric->>'code' IN ('GSM_ONAY', 'gsm_approval') THEN
              metric ||
              jsonb_build_object(
                'code', 'gsm_approval',
                'label', 'GSM Onayı',
                'aliases', jsonb_build_array('GSM_ONAY', 'gsm_onay')
              )
            ELSE metric
          END
          ORDER BY ordinal
        )
        FROM jsonb_array_elements(config_payload->'metrics') WITH ORDINALITY AS items(metric, ordinal)
      )
    ) AS config_payload
  FROM ops.kpi_score_profile_config
  WHERE config_key IN ('store_profile', 'draft_store_profile')
    AND config_payload ? 'metrics'
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(config_payload->'metrics') AS items(metric)
      WHERE metric->>'code' IN ('GSM_ONAY', 'gsm_approval')
    )
)
UPDATE ops.kpi_score_profile_config config
SET
  config_payload = transformed.config_payload,
  updated_at = NOW()
FROM transformed
WHERE config.config_key = transformed.config_key;

WITH transformed AS (
  SELECT
    config_key,
    (
      SELECT jsonb_agg(
        CASE
          WHEN item->>'code' IN ('GSM_ONAY', 'gsm_approval') THEN
            item || jsonb_build_object('code', 'gsm_approval', 'label', 'GSM Onayı')
          ELSE item
        END
        ORDER BY ordinal
      )
      FROM jsonb_array_elements(config_payload) WITH ORDINALITY AS items(item, ordinal)
    ) AS config_payload
  FROM ops.kpi_score_profile_config
  WHERE config_key IN ('ownership_matrix', 'draft_ownership_matrix')
    AND jsonb_typeof(config_payload) = 'array'
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(config_payload) AS items(item)
      WHERE item->>'code' IN ('GSM_ONAY', 'gsm_approval')
    )
)
UPDATE ops.kpi_score_profile_config config
SET
  config_payload = transformed.config_payload,
  updated_at = NOW()
FROM transformed
WHERE config.config_key = transformed.config_key;

WITH published_config AS (
  SELECT
    (
      SELECT config_payload
      FROM ops.kpi_score_profile_config
      WHERE config_key = 'store_profile'
      LIMIT 1
    ) AS store_profile,
    (
      SELECT config_payload
      FROM ops.kpi_score_profile_config
      WHERE config_key = 'personnel_profile'
      LIMIT 1
    ) AS personnel_profile,
    (
      SELECT config_payload
      FROM ops.kpi_score_profile_config
      WHERE config_key = 'ownership_matrix'
      LIMIT 1
    ) AS ownership_matrix,
    (
      SELECT config_payload
      FROM ops.kpi_score_profile_config
      WHERE config_key = 'grading_bands'
      LIMIT 1
    ) AS grading_bands
)
INSERT INTO ops.kpi_config_version (
  version_no,
  lifecycle_state,
  effective_from,
  published_at,
  published_by,
  change_summary,
  config_payload
)
SELECT
  COALESCE((SELECT MAX(version_no) + 1 FROM ops.kpi_config_version), 1),
  'published',
  NOW(),
  NOW(),
  NULL,
  '{"added":["gsm_approval"],"changed":["store_profile","ownership_matrix"],"legacyAliases":["GSM_ONAY"]}'::jsonb,
  jsonb_build_object(
    'storeProfile', store_profile,
    'personnelProfile', personnel_profile,
    'ownershipMatrix', ownership_matrix,
    'gradingBands', grading_bands
  )
FROM published_config
WHERE store_profile IS NOT NULL
  AND personnel_profile IS NOT NULL
  AND ownership_matrix IS NOT NULL
  AND grading_bands IS NOT NULL
  AND store_profile::text LIKE '%gsm_approval%'
  AND NOT EXISTS (
    SELECT 1
    FROM ops.kpi_config_version
    WHERE change_summary @> '{"added":["gsm_approval"]}'::jsonb
  );
