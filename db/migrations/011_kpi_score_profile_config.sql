CREATE TABLE IF NOT EXISTS ops.kpi_score_profile_config (
    config_key TEXT PRIMARY KEY,
    config_payload JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
          "weightPercent": 40,
          "ownerRole": "STORE_MANAGER",
          "scoreBehavior": "task_candidate",
          "aliases": ["STORE_SALES", "SALES_TARGET_ACHIEVEMENT"],
          "notes": "Primary store score driver and strongest workflow candidate."
        },
        {
          "code": "CR",
          "label": "CR",
          "weightPercent": 20,
          "ownerRole": "STORE_MANAGER",
          "scoreBehavior": "task_candidate",
          "notes": "Conversion health should remain visible and action-oriented."
        },
        {
          "code": "ATV",
          "label": "ATV",
          "weightPercent": 15,
          "ownerRole": "STORE_MANAGER",
          "scoreBehavior": "warning_first",
          "notes": "Useful in score immediately; promote to tasks only if signal quality stays high."
        },
        {
          "code": "UPT",
          "label": "UPT",
          "weightPercent": 15,
          "ownerRole": "STORE_MANAGER",
          "scoreBehavior": "warning_first",
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
        }
      ],
      "futureMetricRule": "New metrics such as GSM approvals should be added through the KPI catalog and score profile, not hard-coded into one page."
    }'::jsonb
),
(
    'personnel_profile',
    '{
      "profileCode": "personnel",
      "title": "Personnel score profile",
      "summary": "Store personnel should have an individual scorecard that stays related to, but separate from, the store score.",
      "metrics": [
        {
          "code": "TARGET_ACHIEVEMENT",
          "label": "Hedef gerceklestirme orani",
          "weightPercent": 40,
          "ownerRole": "STORE_PERSONNEL",
          "scoreBehavior": "warning_first",
          "aliases": ["STORE_SALES", "SALES_TARGET_ACHIEVEMENT"],
          "notes": "Primary personnel score driver and strongest coaching signal."
        },
        {
          "code": "ATV",
          "label": "ATV",
          "weightPercent": 30,
          "ownerRole": "STORE_PERSONNEL",
          "scoreBehavior": "warning_first",
          "notes": "Useful for coaching and should not inherit store-level weighting by default."
        },
        {
          "code": "UPT",
          "label": "UPT",
          "weightPercent": 30,
          "ownerRole": "STORE_PERSONNEL",
          "scoreBehavior": "warning_first",
          "notes": "Belongs in the personnel profile even before task triggers are enabled."
        }
      ],
      "futureMetricRule": "Personnel weights should live in the same rule system as store weights, but remain a separate profile."
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
      }
    ]'::jsonb
),
(
    'grading_bands',
    '[
      { "code": "A", "label": "Mukemmel", "emoji": "🏆", "tone": "calm", "minScore": 1.0 },
      { "code": "B", "label": "Iyi", "emoji": "🙂", "tone": "accent", "minScore": 0.85 },
      { "code": "C", "label": "Takip gerekli", "emoji": "👀", "tone": "warning", "minScore": 0.75 },
      { "code": "D", "label": "Kritik", "emoji": "🚨", "tone": "danger", "minScore": 0.0 }
    ]'::jsonb
)
ON CONFLICT (config_key) DO UPDATE
SET
    config_payload = EXCLUDED.config_payload,
    updated_at = NOW();
