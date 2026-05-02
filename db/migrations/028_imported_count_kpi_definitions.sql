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
    ('b0000000-0000-0000-0000-000000000017', 'ITEM_COUNT', 'Item Count', 'count', 'count', 'sum', 'multi_scope', NULL, 'higher_is_better', TRUE),
    ('b0000000-0000-0000-0000-000000000018', 'TICKET_COUNT', 'Ticket Count', 'count', 'count', 'sum', 'multi_scope', NULL, 'higher_is_better', TRUE)
ON CONFLICT (kpi_code) DO NOTHING;
