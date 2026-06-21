ALTER TABLE ops.kpi_actual
ADD COLUMN IF NOT EXISTS achievement_rate NUMERIC(18,6);

ALTER TABLE ops.kpi_actual
ALTER COLUMN achievement_rate TYPE NUMERIC(18,6);

ALTER TABLE rpt.store_kpi_snapshot
ADD COLUMN IF NOT EXISTS achievement_rate NUMERIC(18,6);

ALTER TABLE rpt.store_kpi_snapshot
ALTER COLUMN achievement_rate TYPE NUMERIC(18,6);

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
VALUES (
    'b0000000-0000-0000-0000-000000000020',
    'GSM_ONAY',
    'GSM Onay',
    'percentage',
    'ratio',
    'avg',
    'store',
    NULL,
    'higher_is_better',
    TRUE
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

INSERT INTO ops.kpi_score_profile_config (
    config_key,
    config_payload
)
VALUES
(
    'store_profile',
    '{
      "profileCode": "store",
      "title": "Store score profile",
      "summary": "Store manager owns the operational scorecard for the current store. The score is weighted and ready for future metric additions.",
      "metrics": [
        {
          "code": "TARGET_ACHIEVEMENT",
          "label": "Hedef gerceklestirme orani",
          "weightPercent": 35,
          "ownerRole": "STORE_MANAGER",
          "scoreBehavior": "task_candidate",
          "direction": "HIGHER_IS_BETTER",
          "benchmarkSource": "TARGET",
          "capRatio": 1.2,
          "aliases": ["STORE_SALES", "SALES_TARGET_ACHIEVEMENT"],
          "notes": "Primary store score driver and strongest workflow candidate."
        },
        {
          "code": "CR",
          "label": "CR",
          "weightPercent": 20,
          "ownerRole": "STORE_MANAGER",
          "scoreBehavior": "task_candidate",
          "direction": "HIGHER_IS_BETTER",
          "benchmarkSource": "TURKEY_AVERAGE",
          "capRatio": 1.2,
          "notes": "Conversion health should remain visible and action-oriented."
        },
        {
          "code": "ATV",
          "label": "ATV",
          "weightPercent": 15,
          "ownerRole": "STORE_MANAGER",
          "scoreBehavior": "warning_first",
          "direction": "HIGHER_IS_BETTER",
          "benchmarkSource": "TURKEY_AVERAGE",
          "capRatio": 1.2,
          "notes": "Useful in score immediately; promote to tasks only if signal quality stays high."
        },
        {
          "code": "UPT",
          "label": "UPT",
          "weightPercent": 15,
          "ownerRole": "STORE_MANAGER",
          "scoreBehavior": "warning_first",
          "direction": "HIGHER_IS_BETTER",
          "benchmarkSource": "TURKEY_AVERAGE",
          "capRatio": 1.2,
          "notes": "Operationally important but should avoid inbox noise early."
        },
        {
          "code": "BM_CHECKLIST",
          "label": "BM Checklist",
          "weightPercent": 5,
          "ownerRole": "STORE_MANAGER",
          "scoreBehavior": "task_candidate",
          "notes": "Compliance contributor that stays close to acknowledgement follow-up."
        },
        {
          "code": "VM_CHECKLIST",
          "label": "VM Checklist",
          "weightPercent": 5,
          "ownerRole": "STORE_MANAGER",
          "scoreBehavior": "task_candidate",
          "notes": "Visual teams may produce the data, but the store manager carries the score outcome."
        },
        {
          "code": "GSM_ONAY",
          "label": "GSM Onay",
          "weightPercent": 5,
          "ownerRole": "STORE_MANAGER",
          "scoreBehavior": "warning_first",
          "direction": "HIGHER_IS_BETTER",
          "benchmarkSource": "TARGET",
          "capRatio": 1,
          "notes": "Monthly store-level GSM approval contributor."
        }
      ],
      "futureMetricRule": "New metrics such as GSM approvals should be added through the KPI catalog and score profile, not hard-coded into one page."
    }'::jsonb
),
(
    'ownership_matrix',
    '[
      {
        "code": "TARGET_ACHIEVEMENT",
        "label": "Hedef gerceklestirme orani",
        "visibleTo": ["DEPUTY_GM", "REGION_MANAGER", "STORE_MANAGER", "STORE_PERSONNEL"],
        "operationalOwner": "STORE_MANAGER",
        "contributesTo": ["store", "personnel"],
        "taskCandidate": true
      },
      {
        "code": "CR",
        "label": "CR",
        "visibleTo": ["DEPUTY_GM", "REGION_MANAGER", "STORE_MANAGER"],
        "operationalOwner": "STORE_MANAGER",
        "contributesTo": ["store"],
        "taskCandidate": true
      },
      {
        "code": "ATV",
        "label": "ATV",
        "visibleTo": ["DEPUTY_GM", "REGION_MANAGER", "STORE_MANAGER", "STORE_PERSONNEL"],
        "operationalOwner": "STORE_MANAGER",
        "contributesTo": ["store", "personnel"],
        "taskCandidate": false
      },
      {
        "code": "UPT",
        "label": "UPT",
        "visibleTo": ["DEPUTY_GM", "REGION_MANAGER", "STORE_MANAGER", "STORE_PERSONNEL"],
        "operationalOwner": "STORE_MANAGER",
        "contributesTo": ["store", "personnel"],
        "taskCandidate": false
      },
      {
        "code": "BM_CHECKLIST",
        "label": "BM Checklist",
        "visibleTo": ["REGION_MANAGER", "STORE_MANAGER"],
        "operationalOwner": "STORE_MANAGER",
        "contributesTo": ["store"],
        "taskCandidate": true
      },
      {
        "code": "VM_CHECKLIST",
        "label": "VM Checklist",
        "visibleTo": ["REGION_MANAGER", "STORE_MANAGER", "VISUAL_TEAM"],
        "operationalOwner": "STORE_MANAGER",
        "contributesTo": ["store"],
        "taskCandidate": true
      },
      {
        "code": "GSM_ONAY",
        "label": "GSM Onay",
        "visibleTo": ["DEPUTY_GM", "REGION_MANAGER", "STORE_MANAGER"],
        "operationalOwner": "STORE_MANAGER",
        "contributesTo": ["store"],
        "taskCandidate": false
      }
    ]'::jsonb
)
ON CONFLICT (config_key) DO UPDATE
SET
    config_payload = EXCLUDED.config_payload,
    updated_at = NOW();

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
    '{"added":["GSM_ONAY"],"changed":["store_profile","ownership_matrix"]}'::jsonb,
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
  AND grading_bands IS NOT NULL;
