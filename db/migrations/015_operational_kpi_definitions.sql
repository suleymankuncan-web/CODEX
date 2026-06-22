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
    ('b0000000-0000-0000-0000-000000000010', 'NET_SALES', 'Net Sales', 'currency', 'currency', 'sum', 'multi_scope', NULL, 'higher_is_better', TRUE),
    ('b0000000-0000-0000-0000-000000000011', 'TARGET_ACHIEVEMENT', 'Target Achievement', 'percentage', 'ratio', 'avg', 'multi_scope', 'net_sales / assigned_target', 'higher_is_better', TRUE),
    ('b0000000-0000-0000-0000-000000000012', 'CR', 'Conversion Rate', 'percentage', 'ratio', 'avg', 'store', NULL, 'higher_is_better', TRUE),
    ('b0000000-0000-0000-0000-000000000013', 'ATV', 'Average Ticket Value', 'currency', 'currency', 'avg', 'multi_scope', NULL, 'higher_is_better', TRUE),
    ('b0000000-0000-0000-0000-000000000014', 'UPT', 'Units Per Ticket', 'ratio', 'count', 'avg', 'multi_scope', NULL, 'higher_is_better', TRUE),
    ('b0000000-0000-0000-0000-000000000015', 'BM_CHECKLIST', 'BM Checklist', 'percentage', 'ratio', 'avg', 'store', NULL, 'higher_is_better', TRUE),
    ('b0000000-0000-0000-0000-000000000016', 'VM_CHECKLIST', 'VM Checklist', 'percentage', 'ratio', 'avg', 'store', NULL, 'higher_is_better', TRUE)
ON CONFLICT (kpi_code) DO NOTHING;
