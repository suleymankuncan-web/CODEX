INSERT INTO stg.integration_source (
    integration_source_id,
    source_code,
    source_name,
    entity_type,
    source_system,
    state_model,
    is_active
)
VALUES (
    'd0000000-0000-0000-0000-000000000003',
    'power-bi-kpi',
    'Power BI KPI',
    'kpi',
    'power_bi',
    'closed_period',
    TRUE
)
ON CONFLICT (source_code, entity_type) DO UPDATE
SET
    source_name = EXCLUDED.source_name,
    source_system = EXCLUDED.source_system,
    state_model = EXCLUDED.state_model;
