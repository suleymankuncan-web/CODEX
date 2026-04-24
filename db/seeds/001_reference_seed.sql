INSERT INTO ops.company (company_id, company_code, company_name)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'ACME', 'ACME Retail')
ON CONFLICT (company_code) DO NOTHING;

INSERT INTO ops.region (region_id, company_id, region_code, region_name)
VALUES
    ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'MARMARA', 'Marmara'),
    ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'AEGEAN', 'Aegean')
ON CONFLICT (company_id, region_code) DO NOTHING;

INSERT INTO ops.store (store_id, company_id, region_id, store_code, store_name, store_type, open_date)
VALUES
    ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'IST-001', 'Istanbul Kadikoy', 'flagship', DATE '2023-01-01'),
    ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'IST-002', 'Istanbul Besiktas', 'standard', DATE '2023-03-01'),
    ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'IZM-001', 'Izmir Karsiyaka', 'standard', DATE '2023-05-01')
ON CONFLICT (store_code) DO NOTHING;

INSERT INTO ops.position (position_id, company_id, position_code, position_name, job_family, is_managerial)
VALUES
    ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'STORE_MANAGER', 'Store Manager', 'operations', TRUE),
    ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'SHIFT_LEAD', 'Shift Lead', 'operations', TRUE),
    ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'SALES_ASSOCIATE', 'Sales Associate', 'operations', FALSE),
    ('30000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'AUDITOR', 'Field Auditor', 'audit', FALSE)
ON CONFLICT (company_id, position_code) DO NOTHING;

INSERT INTO ops.employee (
    employee_id, company_id, external_employee_ref, first_name, last_name, hire_date, employment_status, employment_type
)
VALUES
    ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'EMP-001', 'Ayse', 'Demir', DATE '2023-01-10', 'active', 'full_time'),
    ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'EMP-002', 'Mehmet', 'Kaya', DATE '2023-02-10', 'active', 'full_time'),
    ('40000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'EMP-003', 'Zeynep', 'Aydin', DATE '2023-04-15', 'active', 'part_time')
ON CONFLICT DO NOTHING;

INSERT INTO ops.employee_assignment_history (
    assignment_id, employee_id, store_id, region_id, position_id, manager_employee_id, start_date, is_primary_assignment, fte_ratio, assignment_status
)
VALUES
    ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', NULL, DATE '2023-01-10', TRUE, 1.00, 'active'),
    ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', DATE '2023-02-10', TRUE, 1.00, 'active'),
    ('50000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000002', DATE '2023-04-15', TRUE, 0.50, 'active')
ON CONFLICT DO NOTHING;

INSERT INTO ops.role (role_id, role_code, role_name, role_scope_type, description, is_system_role)
VALUES
    ('60000000-0000-0000-0000-000000000001', 'SUPER_ADMIN', 'Super Admin', 'company', 'Full access across the company', TRUE),
    ('60000000-0000-0000-0000-000000000002', 'REGION_MANAGER', 'Region Manager', 'region', 'Manages region level operations and performance', TRUE),
    ('60000000-0000-0000-0000-000000000003', 'STORE_MANAGER', 'Store Manager', 'store', 'Manages a single store', TRUE),
    ('60000000-0000-0000-0000-000000000004', 'AUDITOR', 'Auditor', 'region', 'Executes checklist audits', TRUE),
    ('60000000-0000-0000-0000-000000000005', 'REPORT_VIEWER', 'Report Viewer', 'company', 'Read-only reporting access', TRUE),
    ('60000000-0000-0000-0000-000000000006', 'INTEGRATION_ADMIN', 'Integration Admin', 'company', 'Manages integration sources and import batches', TRUE),
    ('60000000-0000-0000-0000-000000000007', 'SNAPSHOT_OPERATOR', 'Snapshot Operator', 'company', 'Runs and reruns reporting snapshots', TRUE),
    ('60000000-0000-0000-0000-000000000008', 'STORE_PERSONNEL', 'Store Personnel', 'store', 'Reads personal store performance', TRUE)
ON CONFLICT (role_code) DO NOTHING;

INSERT INTO ops.permission (permission_id, permission_code, resource_name, action_name, description)
VALUES
    ('70000000-0000-0000-0000-000000000001', 'store.read', 'store', 'read', 'Read store data'),
    ('70000000-0000-0000-0000-000000000002', 'employee.read', 'employee', 'read', 'Read employee data'),
    ('70000000-0000-0000-0000-000000000003', 'checklist.manage', 'checklist', 'manage', 'Create and complete checklist instances'),
    ('70000000-0000-0000-0000-000000000004', 'kpi.read', 'kpi', 'read', 'Read KPI data'),
    ('70000000-0000-0000-0000-000000000005', 'snapshot.read', 'snapshot', 'read', 'Read reporting snapshots'),
    ('70000000-0000-0000-0000-000000000006', 'reports.read', 'reports', 'read', 'Read reporting surfaces'),
    ('70000000-0000-0000-0000-000000000007', 'integration.manage', 'integration', 'manage', 'Manage integration sources and import batches'),
    ('70000000-0000-0000-0000-000000000008', 'snapshot.manage', 'snapshot', 'manage', 'Run and rerun reporting snapshots'),
    ('70000000-0000-0000-0000-000000000009', 'target_distribution.manage', 'target_distribution', 'manage', 'Create target distribution requests'),
    ('70000000-0000-0000-0000-000000000010', 'target_distribution.approve', 'target_distribution', 'approve', 'Approve target distribution requests'),
    ('70000000-0000-0000-0000-000000000011', 'kpi_config.manage', 'kpi_config', 'manage', 'Manage KPI scoring configuration'),
    ('70000000-0000-0000-0000-000000000012', 'auth.manage', 'auth', 'manage', 'Manage users, roles, and permissions')
ON CONFLICT (permission_code) DO NOTHING;

INSERT INTO ops.role_permission (role_id, permission_id)
VALUES
    ('60000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001'),
    ('60000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000002'),
    ('60000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000003'),
    ('60000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000004'),
    ('60000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000005'),
    ('60000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000006'),
    ('60000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000007'),
    ('60000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000008'),
    ('60000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000009'),
    ('60000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000010'),
    ('60000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000011'),
    ('60000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000012'),
    ('60000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001'),
    ('60000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000002'),
    ('60000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000004'),
    ('60000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000006'),
    ('60000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000010'),
    ('60000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000001'),
    ('60000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000002'),
    ('60000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000003'),
    ('60000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000004'),
    ('60000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000006'),
    ('60000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000009'),
    ('60000000-0000-0000-0000-000000000004', '70000000-0000-0000-0000-000000000001'),
    ('60000000-0000-0000-0000-000000000004', '70000000-0000-0000-0000-000000000003'),
    ('60000000-0000-0000-0000-000000000004', '70000000-0000-0000-0000-000000000006'),
    ('60000000-0000-0000-0000-000000000005', '70000000-0000-0000-0000-000000000006'),
    ('60000000-0000-0000-0000-000000000006', '70000000-0000-0000-0000-000000000007'),
    ('60000000-0000-0000-0000-000000000007', '70000000-0000-0000-0000-000000000005'),
    ('60000000-0000-0000-0000-000000000007', '70000000-0000-0000-0000-000000000008'),
    ('60000000-0000-0000-0000-000000000008', '70000000-0000-0000-0000-000000000004'),
    ('60000000-0000-0000-0000-000000000008', '70000000-0000-0000-0000-000000000006')
ON CONFLICT DO NOTHING;

INSERT INTO ops.user_account (user_id, employee_id, username, email, auth_provider, is_active)
VALUES
    ('80000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'ayse.demir', 'ayse.demir@acme.local', 'local', TRUE),
    ('80000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 'mehmet.kaya', 'mehmet.kaya@acme.local', 'local', TRUE)
ON CONFLICT (username) DO NOTHING;

INSERT INTO ops.user_role_assignment (
    user_role_assignment_id, user_id, role_id, scope_type, company_id, region_id, store_id
)
VALUES
    ('90000000-0000-0000-0000-000000000001', '80000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 'company', '00000000-0000-0000-0000-000000000001', NULL, NULL),
    ('90000000-0000-0000-0000-000000000002', '80000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000003', 'store', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

INSERT INTO ops.checklist_template (
    checklist_template_id, company_id, template_code, template_name, category, version_no, status, effective_from, created_by
)
VALUES
    ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'OPENING_AUDIT_V1', 'Opening Audit', 'operations', 1, 'active', DATE '2024-01-01', '80000000-0000-0000-0000-000000000001')
ON CONFLICT (template_code) DO NOTHING;

INSERT INTO ops.checklist_template_item (
    template_item_id, checklist_template_id, section_name, item_no, item_text, response_type, is_mandatory, weight, max_score
)
VALUES
    ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Store Readiness', 1, 'Store opened on time', 'boolean', TRUE, 2, 2),
    ('a1000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Store Readiness', 2, 'Cash desk is operational', 'boolean', TRUE, 3, 3),
    ('a1000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'Visual Merchandising', 3, 'Promo area matches planogram', 'score', TRUE, 5, 5)
ON CONFLICT DO NOTHING;

INSERT INTO ops.kpi_definition (
    kpi_id, kpi_code, kpi_name, metric_type, unit_type, aggregation_type, scope_type, formula_definition, target_direction, is_active
)
VALUES
    ('b0000000-0000-0000-0000-000000000001', 'AUDIT_COMPLIANCE', 'Audit Compliance', 'percentage', 'ratio', 'avg', 'store', 'compliant_items / total_items', 'higher_is_better', TRUE),
    ('b0000000-0000-0000-0000-000000000002', 'HEADCOUNT_GAP', 'Headcount Gap', 'difference', 'count', 'sum', 'store', 'planned_headcount - active_headcount', 'lower_is_better', TRUE),
    ('b0000000-0000-0000-0000-000000000003', 'TURNOVER_RATE', 'Turnover Rate', 'percentage', 'ratio', 'avg', 'store', 'leaver_count / avg_headcount', 'lower_is_better', TRUE),
    ('b0000000-0000-0000-0000-000000000010', 'NET_SALES', 'Net Sales', 'currency', 'currency', 'sum', 'multi_scope', NULL, 'higher_is_better', TRUE),
    ('b0000000-0000-0000-0000-000000000011', 'TARGET_ACHIEVEMENT', 'Target Achievement', 'percentage', 'ratio', 'avg', 'multi_scope', 'net_sales / assigned_target', 'higher_is_better', TRUE),
    ('b0000000-0000-0000-0000-000000000012', 'CR', 'Conversion Rate', 'percentage', 'ratio', 'avg', 'store', NULL, 'higher_is_better', TRUE),
    ('b0000000-0000-0000-0000-000000000013', 'ATV', 'Average Ticket Value', 'currency', 'currency', 'avg', 'multi_scope', NULL, 'higher_is_better', TRUE),
    ('b0000000-0000-0000-0000-000000000014', 'UPT', 'Units Per Ticket', 'ratio', 'count', 'avg', 'multi_scope', NULL, 'higher_is_better', TRUE),
    ('b0000000-0000-0000-0000-000000000015', 'BM_CHECKLIST', 'BM Checklist', 'percentage', 'ratio', 'avg', 'store', NULL, 'higher_is_better', TRUE),
    ('b0000000-0000-0000-0000-000000000016', 'VM_CHECKLIST', 'VM Checklist', 'percentage', 'ratio', 'avg', 'store', NULL, 'higher_is_better', TRUE)
ON CONFLICT (kpi_code) DO NOTHING;

INSERT INTO ops.kpi_target (
    kpi_target_id, kpi_id, scope_type, company_id, store_id, period_type, period_start, period_end, target_value, threshold_green, threshold_yellow, threshold_red
)
VALUES
    ('b1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'store', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'monthly', DATE '2026-04-01', DATE '2026-04-30', 0.95, 0.95, 0.90, 0.85),
    ('b1000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'store', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'monthly', DATE '2026-04-01', DATE '2026-04-30', 0, 0, 1, 2)
ON CONFLICT DO NOTHING;

INSERT INTO ops.workforce_norm_plan (
    norm_plan_id, company_id, region_id, store_id, position_id, period_start, period_end, planned_headcount, planned_fte, approved_by, approved_at
)
VALUES
    ('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', DATE '2026-04-01', DATE '2026-04-30', 1, 1, '80000000-0000-0000-0000-000000000001', NOW()),
    ('c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', DATE '2026-04-01', DATE '2026-04-30', 2, 2, '80000000-0000-0000-0000-000000000001', NOW())
ON CONFLICT DO NOTHING;

INSERT INTO stg.integration_source (
    integration_source_id,
    source_code,
    source_name,
    entity_type,
    source_system,
    state_model,
    is_active
)
VALUES
    ('d0000000-0000-0000-0000-000000000001', 'HRIS', 'Corporate HRIS', 'employee', 'manual', 'latest_state', TRUE),
    ('d0000000-0000-0000-0000-000000000002', 'POS', 'Point of Sale', 'kpi', 'manual', 'latest_state', TRUE)
ON CONFLICT (source_code, entity_type) DO NOTHING;
