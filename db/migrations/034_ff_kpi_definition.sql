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
VALUES
    ('b0000000-0000-0000-0000-000000000019', 'FF', 'Footfall', 'count', 'count', 'sum', 'store', NULL, 'higher_is_better', TRUE)
ON CONFLICT (kpi_code) DO NOTHING;
