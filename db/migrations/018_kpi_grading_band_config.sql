INSERT INTO ops.kpi_score_profile_config (
    config_key,
    config_payload
)
VALUES
(
    'grading_bands',
    '[
      { "code": "A", "label": "Mukemmel", "emoji": "🏆", "tone": "calm", "minScore": 1.0 },
      { "code": "B", "label": "Iyi", "emoji": "🙂", "tone": "accent", "minScore": 0.85 },
      { "code": "C", "label": "Takip gerekli", "emoji": "👀", "tone": "warning", "minScore": 0.75 },
      { "code": "D", "label": "Kritik", "emoji": "🚨", "tone": "danger", "minScore": 0.0 }
    ]'::jsonb
),
(
    'draft_grading_bands',
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
