INSERT INTO ops.company (company_id, company_code, company_name)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'ACME', 'ACME Retail')
ON CONFLICT DO NOTHING;

INSERT INTO ops.region (region_id, company_id, region_code, region_name)
VALUES
    ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'MARMARA', 'Marmara'),
    ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'AEGEAN', 'Aegean')
ON CONFLICT (company_id, region_code) DO NOTHING;

INSERT INTO ops.region (region_id, company_id, region_code, region_name)
VALUES
    ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'IST', 'Istanbul Demo Region')
ON CONFLICT (company_id, region_code) DO UPDATE
SET
    region_name = EXCLUDED.region_name,
    status = 'active';

INSERT INTO ops.store (store_id, company_id, region_id, store_code, store_name, store_type, open_date)
VALUES
    ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'IST-001', 'Istanbul Kadikoy', 'company', DATE '2023-01-01'),
    ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'IST-002', 'Istanbul Besiktas', 'company', DATE '2023-03-01'),
    ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'IZM-001', 'Izmir Karsiyaka', 'company', DATE '2023-05-01')
ON CONFLICT (store_code) DO NOTHING;

INSERT INTO ops.store (store_id, company_id, region_id, store_code, store_name, store_type, open_date, timezone)
VALUES
    ('00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', 'STORE100', 'IstinyePark Demo Store', 'company', DATE '2026-04-20', 'Europe/Istanbul'),
    ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', 'DEMO-101', 'Demo Store 101', 'company', DATE '2026-01-01', 'Europe/Istanbul')
ON CONFLICT (store_code) DO UPDATE
SET
    region_id = EXCLUDED.region_id,
    store_name = EXCLUDED.store_name,
    store_type = EXCLUDED.store_type,
    status = 'active',
    timezone = EXCLUDED.timezone;

INSERT INTO ops.position (position_id, company_id, position_code, position_name, job_family, is_managerial)
VALUES
    ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'STORE_MANAGER', 'Store Manager', 'operations', TRUE),
    ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'SHIFT_LEAD', 'Shift Lead', 'operations', TRUE),
    ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'SALES_ASSOCIATE', 'Sales Associate', 'operations', FALSE),
    ('30000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'AUDITOR', 'Field Auditor', 'audit', FALSE)
ON CONFLICT (company_id, position_code) DO NOTHING;

INSERT INTO ops.position (position_id, company_id, position_code, position_name, job_family, is_managerial)
VALUES
    ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000001', 'DEMO_STORE_MANAGER', 'Demo Store Manager', 'operations', TRUE),
    ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000001', 'DEMO_STORE_PERSONNEL', 'Demo Store Personnel', 'operations', FALSE)
ON CONFLICT (company_id, position_code) DO UPDATE
SET
    position_name = EXCLUDED.position_name,
    job_family = EXCLUDED.job_family,
    is_managerial = EXCLUDED.is_managerial;

INSERT INTO ops.employee (
    employee_id, company_id, external_employee_ref, first_name, last_name, hire_date, employment_status, employment_type
)
VALUES
    ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'EMP-001', 'Ayse', 'Demir', DATE '2023-01-10', 'active', 'full_time'),
    ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'EMP-002', 'Mehmet', 'Kaya', DATE '2023-02-10', 'active', 'full_time'),
    ('40000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'EMP-003', 'Zeynep', 'Aydin', DATE '2023-04-15', 'active', 'part_time')
ON CONFLICT DO NOTHING;

INSERT INTO ops.employee (
    employee_id, company_id, external_employee_ref, first_name, last_name, hire_date, employment_status, employment_type
)
VALUES
    ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000001', 'DEMO-EMP-201', 'Store', 'Manager', DATE '2025-01-01', 'active', 'full_time'),
    ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000001', 'DEMO-EMP-202', 'Store', 'Personnel', DATE '2025-02-01', 'active', 'full_time'),
    ('00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000001', 'DEMO-EMP-203', 'Second', 'Associate', DATE '2025-03-01', 'active', 'full_time'),
    ('00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000001', 'DEMO-EMP-204', 'Third', 'Associate', DATE '2025-04-01', 'active', 'full_time')
ON CONFLICT (employee_id) DO UPDATE
SET
    external_employee_ref = EXCLUDED.external_employee_ref,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    employment_status = 'active',
    employment_type = EXCLUDED.employment_type;

INSERT INTO ops.employee_assignment_history (
    assignment_id, employee_id, store_id, region_id, position_id, manager_employee_id, start_date, is_primary_assignment, fte_ratio, assignment_status
)
VALUES
    ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', NULL, DATE '2023-01-10', TRUE, 1.00, 'active'),
    ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000001', DATE '2023-02-10', TRUE, 1.00, 'active'),
    ('50000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000002', DATE '2023-04-15', TRUE, 0.50, 'active')
ON CONFLICT DO NOTHING;

INSERT INTO ops.employee_assignment_history (
    assignment_id, employee_id, store_id, region_id, position_id, manager_employee_id, start_date, is_primary_assignment, fte_ratio, assignment_status
)
VALUES
    ('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000301', NULL, DATE '2026-01-01', TRUE, 1.00, 'active'),
    ('00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000201', DATE '2026-01-01', TRUE, 1.00, 'active'),
    ('00000000-0000-0000-0000-000000000403', '00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000201', DATE '2026-01-01', TRUE, 1.00, 'active'),
    ('00000000-0000-0000-0000-000000000404', '00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000201', DATE '2026-01-01', TRUE, 1.00, 'active')
ON CONFLICT (assignment_id) DO UPDATE
SET
    store_id = EXCLUDED.store_id,
    region_id = EXCLUDED.region_id,
    position_id = EXCLUDED.position_id,
    manager_employee_id = EXCLUDED.manager_employee_id,
    end_date = NULL,
    is_primary_assignment = TRUE,
    assignment_status = 'active';

INSERT INTO ops.role (role_id, role_code, role_name, role_scope_type, description, is_system_role)
VALUES
    ('60000000-0000-0000-0000-000000000001', 'SUPER_ADMIN', 'Super Admin', 'company', 'Full access across the company', TRUE),
    ('60000000-0000-0000-0000-000000000002', 'REGION_MANAGER', 'Region Manager', 'region', 'Manages region level operations and performance', TRUE),
    ('60000000-0000-0000-0000-000000000003', 'STORE_MANAGER', 'Store Manager', 'store', 'Manages a single store', TRUE),
    ('60000000-0000-0000-0000-000000000004', 'AUDITOR', 'Auditor', 'region', 'Executes checklist audits', TRUE),
    ('60000000-0000-0000-0000-000000000005', 'REPORT_VIEWER', 'Report Viewer', 'company', 'Read-only reporting access', TRUE),
    ('60000000-0000-0000-0000-000000000006', 'INTEGRATION_ADMIN', 'Integration Admin', 'company', 'Manages integration sources and import batches', TRUE),
    ('60000000-0000-0000-0000-000000000007', 'SNAPSHOT_OPERATOR', 'Snapshot Operator', 'company', 'Runs and reruns reporting snapshots', TRUE),
    ('60000000-0000-0000-0000-000000000008', 'STORE_PERSONNEL', 'Store Personnel', 'store', 'Reads personal store performance', TRUE),
    ('60000000-0000-0000-0000-000000000009', 'HR_ADMIN', 'HR Admin', 'company', 'Manages HR owned competitions and score review workflows', TRUE)
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
    ('70000000-0000-0000-0000-000000000012', 'auth.manage', 'auth', 'manage', 'Manage users, roles, and permissions'),
    ('70000000-0000-0000-0000-000000000013', 'competition.read', 'competition', 'read', 'Read competition standings and stage results'),
    ('70000000-0000-0000-0000-000000000014', 'competition.manage', 'competition', 'manage', 'Create, recalculate, and finalize competitions')
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
    ('60000000-0000-0000-0000-000000000008', '70000000-0000-0000-0000-000000000006'),
    ('60000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000013'),
    ('60000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000014'),
    ('60000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000013'),
    ('60000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000013'),
    ('60000000-0000-0000-0000-000000000005', '70000000-0000-0000-0000-000000000013'),
    ('60000000-0000-0000-0000-000000000008', '70000000-0000-0000-0000-000000000013'),
    ('60000000-0000-0000-0000-000000000009', '70000000-0000-0000-0000-000000000013'),
    ('60000000-0000-0000-0000-000000000009', '70000000-0000-0000-0000-000000000014')
ON CONFLICT DO NOTHING;

WITH rule AS (
    INSERT INTO ops.sales_target_incentive_rule_version (
        sales_target_incentive_rule_version_id,
        rule_version_code,
        status,
        effective_from,
        period_timezone,
        bracket_boundary_policy,
        round_before_lookup,
        raw_amount_minimum_scale,
        payable_amount_scale,
        sub_kurus_policy
    )
    VALUES (
        '81000000-0000-0000-0000-000000000001',
        'sales-target-incentive-v1.0.0',
        'active',
        DATE '2026-01-01',
        'Europe/Istanbul',
        'lower_inclusive_upper_exclusive',
        FALSE,
        6,
        2,
        'truncate_toward_zero'
    )
    ON CONFLICT (rule_version_code) DO UPDATE
    SET
        status = EXCLUDED.status,
        effective_from = EXCLUDED.effective_from,
        period_timezone = EXCLUDED.period_timezone,
        bracket_boundary_policy = EXCLUDED.bracket_boundary_policy,
        round_before_lookup = EXCLUDED.round_before_lookup,
        raw_amount_minimum_scale = EXCLUDED.raw_amount_minimum_scale,
        payable_amount_scale = EXCLUDED.payable_amount_scale,
        sub_kurus_policy = EXCLUDED.sub_kurus_policy
    RETURNING sales_target_incentive_rule_version_id AS rule_version_id
)
INSERT INTO ops.sales_target_incentive_rate_bracket (
    rule_version_id,
    rate_table_version,
    audience,
    min_achievement_pct,
    max_achievement_pct,
    rate,
    display_label,
    sort_order
)
SELECT
    bracket.rule_version_id,
    bracket.rate_table_version,
    bracket.audience,
    bracket.min_achievement_pct,
    bracket.max_achievement_pct,
    bracket.rate,
    bracket.display_label,
    bracket.sort_order
FROM rule
CROSS JOIN LATERAL (VALUES
    (rule.rule_version_id, 'manager-sales-target-v1.0.0', 'manager', NULL, 80.0000, 0.0000, '< 80.0000%', 10),
    (rule.rule_version_id, 'manager-sales-target-v1.0.0', 'manager', 80.0000, 85.0000, 0.0020, '>= 80.0000% and < 85.0000%', 20),
    (rule.rule_version_id, 'manager-sales-target-v1.0.0', 'manager', 85.0000, 90.0000, 0.0030, '>= 85.0000% and < 90.0000%', 30),
    (rule.rule_version_id, 'manager-sales-target-v1.0.0', 'manager', 90.0000, 95.0000, 0.0040, '>= 90.0000% and < 95.0000%', 40),
    (rule.rule_version_id, 'manager-sales-target-v1.0.0', 'manager', 95.0000, 100.0000, 0.0050, '>= 95.0000% and < 100.0000%', 50),
    (rule.rule_version_id, 'manager-sales-target-v1.0.0', 'manager', 100.0000, 110.0000, 0.0070, '>= 100.0000% and < 110.0000%', 60),
    (rule.rule_version_id, 'manager-sales-target-v1.0.0', 'manager', 110.0000, NULL, 0.0100, '>= 110.0000%', 70),
    (rule.rule_version_id, 'personnel-sales-target-v1.0.0', 'personnel', NULL, 80.0000, 0.0000, '< 80.0000%', 10),
    (rule.rule_version_id, 'personnel-sales-target-v1.0.0', 'personnel', 80.0000, 85.0000, 0.0050, '>= 80.0000% and < 85.0000%', 20),
    (rule.rule_version_id, 'personnel-sales-target-v1.0.0', 'personnel', 85.0000, 90.0000, 0.0050, '>= 85.0000% and < 90.0000%', 30),
    (rule.rule_version_id, 'personnel-sales-target-v1.0.0', 'personnel', 90.0000, 95.0000, 0.0065, '>= 90.0000% and < 95.0000%', 40),
    (rule.rule_version_id, 'personnel-sales-target-v1.0.0', 'personnel', 95.0000, 100.0000, 0.0075, '>= 95.0000% and < 100.0000%', 50),
    (rule.rule_version_id, 'personnel-sales-target-v1.0.0', 'personnel', 100.0000, 110.0000, 0.0150, '>= 100.0000% and < 110.0000%', 60),
    (rule.rule_version_id, 'personnel-sales-target-v1.0.0', 'personnel', 110.0000, NULL, 0.0165, '>= 110.0000%', 70)
) AS bracket(
    rule_version_id,
    rate_table_version,
    audience,
    min_achievement_pct,
    max_achievement_pct,
    rate,
    display_label,
    sort_order
)
ON CONFLICT (rule_version_id, rate_table_version, audience, sort_order) DO UPDATE
SET
    min_achievement_pct = EXCLUDED.min_achievement_pct,
    max_achievement_pct = EXCLUDED.max_achievement_pct,
    rate = EXCLUDED.rate,
    display_label = EXCLUDED.display_label,
    sort_order = EXCLUDED.sort_order;

INSERT INTO ops.competition_team_template (
    competition_team_template_id,
    template_code,
    template_name,
    description,
    is_active
)
VALUES
    ('90000000-0000-0000-0000-000000000001', 'MARMARA_DEMO', 'Marmara Demo', 'Demo challenge team for Istanbul stores', TRUE),
    ('90000000-0000-0000-0000-000000000002', 'KARADENIZ_DEMO', 'Karadeniz Demo', 'Demo challenge team for comparison stores', TRUE)
ON CONFLICT (template_code) DO UPDATE
SET
    template_name = EXCLUDED.template_name,
    description = EXCLUDED.description,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

INSERT INTO ops.competition_team_template_store (competition_team_template_id, store_id)
VALUES
    ('90000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000100'),
    ('90000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000101')
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
ON CONFLICT (template_code, version_no) DO NOTHING;

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
    ('b0000000-0000-0000-0000-000000000016', 'VM_CHECKLIST', 'VM Checklist', 'percentage', 'ratio', 'avg', 'store', NULL, 'higher_is_better', TRUE),
    ('b0000000-0000-0000-0000-000000000017', 'ITEM_COUNT', 'Item Count', 'count', 'count', 'sum', 'multi_scope', NULL, 'higher_is_better', TRUE),
    ('b0000000-0000-0000-0000-000000000018', 'TICKET_COUNT', 'Ticket Count', 'count', 'count', 'sum', 'multi_scope', NULL, 'higher_is_better', TRUE),
    ('b0000000-0000-0000-0000-000000000019', 'FF', 'Footfall', 'count', 'count', 'sum', 'store', NULL, 'higher_is_better', TRUE),
    ('b0000000-0000-0000-0000-000000000020', 'GSM_ONAY', 'GSM Onay', 'percentage', 'ratio', 'avg', 'store', NULL, 'higher_is_better', TRUE)
ON CONFLICT (kpi_code) DO NOTHING;

WITH demo_live_personnel_scoring_actual (employee_id, store_id, kpi_code, actual_value) AS (
    VALUES
        ('00000000-0000-0000-0000-000000000201'::uuid, '00000000-0000-0000-0000-000000000100'::uuid, 'TARGET_ACHIEVEMENT', 94.0000),
        ('00000000-0000-0000-0000-000000000201'::uuid, '00000000-0000-0000-0000-000000000100'::uuid, 'ATV', 88.0000),
        ('00000000-0000-0000-0000-000000000201'::uuid, '00000000-0000-0000-0000-000000000100'::uuid, 'UPT', 91.0000),
        ('00000000-0000-0000-0000-000000000201'::uuid, '00000000-0000-0000-0000-000000000100'::uuid, 'NET_SALES', 8800.0000),
        ('00000000-0000-0000-0000-000000000201'::uuid, '00000000-0000-0000-0000-000000000100'::uuid, 'TICKET_COUNT', 100.0000),
        ('00000000-0000-0000-0000-000000000201'::uuid, '00000000-0000-0000-0000-000000000100'::uuid, 'ITEM_COUNT', 9100.0000),
        ('00000000-0000-0000-0000-000000000202'::uuid, '00000000-0000-0000-0000-000000000100'::uuid, 'TARGET_ACHIEVEMENT', 98.0000),
        ('00000000-0000-0000-0000-000000000202'::uuid, '00000000-0000-0000-0000-000000000100'::uuid, 'ATV', 96.0000),
        ('00000000-0000-0000-0000-000000000202'::uuid, '00000000-0000-0000-0000-000000000100'::uuid, 'UPT', 95.0000),
        ('00000000-0000-0000-0000-000000000202'::uuid, '00000000-0000-0000-0000-000000000100'::uuid, 'NET_SALES', 9600.0000),
        ('00000000-0000-0000-0000-000000000202'::uuid, '00000000-0000-0000-0000-000000000100'::uuid, 'TICKET_COUNT', 100.0000),
        ('00000000-0000-0000-0000-000000000202'::uuid, '00000000-0000-0000-0000-000000000100'::uuid, 'ITEM_COUNT', 9500.0000),
        ('00000000-0000-0000-0000-000000000203'::uuid, '00000000-0000-0000-0000-000000000100'::uuid, 'TARGET_ACHIEVEMENT', 86.0000),
        ('00000000-0000-0000-0000-000000000203'::uuid, '00000000-0000-0000-0000-000000000100'::uuid, 'ATV', 84.0000),
        ('00000000-0000-0000-0000-000000000203'::uuid, '00000000-0000-0000-0000-000000000100'::uuid, 'UPT', 82.0000),
        ('00000000-0000-0000-0000-000000000203'::uuid, '00000000-0000-0000-0000-000000000100'::uuid, 'NET_SALES', 8400.0000),
        ('00000000-0000-0000-0000-000000000203'::uuid, '00000000-0000-0000-0000-000000000100'::uuid, 'TICKET_COUNT', 100.0000),
        ('00000000-0000-0000-0000-000000000203'::uuid, '00000000-0000-0000-0000-000000000100'::uuid, 'ITEM_COUNT', 8200.0000),
        ('00000000-0000-0000-0000-000000000204'::uuid, '00000000-0000-0000-0000-000000000101'::uuid, 'TARGET_ACHIEVEMENT', 99.0000),
        ('00000000-0000-0000-0000-000000000204'::uuid, '00000000-0000-0000-0000-000000000101'::uuid, 'ATV', 91.0000),
        ('00000000-0000-0000-0000-000000000204'::uuid, '00000000-0000-0000-0000-000000000101'::uuid, 'UPT', 90.0000),
        ('00000000-0000-0000-0000-000000000204'::uuid, '00000000-0000-0000-0000-000000000101'::uuid, 'NET_SALES', 9100.0000),
        ('00000000-0000-0000-0000-000000000204'::uuid, '00000000-0000-0000-0000-000000000101'::uuid, 'TICKET_COUNT', 100.0000),
        ('00000000-0000-0000-0000-000000000204'::uuid, '00000000-0000-0000-0000-000000000101'::uuid, 'ITEM_COUNT', 9000.0000)
)
INSERT INTO ops.kpi_actual (
    kpi_id, scope_type, company_id, region_id, store_id, employee_id,
    period_type, period_start, period_end, actual_value, source_type
)
SELECT
    definition.kpi_id,
    'employee',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000010',
    actual.store_id,
    actual.employee_id,
    'monthly',
    DATE '2026-04-01',
    DATE '2026-04-30',
    actual.actual_value,
    'demo_seed'
FROM demo_live_personnel_scoring_actual actual
JOIN ops.kpi_definition definition ON definition.kpi_code = actual.kpi_code
ON CONFLICT DO NOTHING;

INSERT INTO ops.target_distribution_request (
    target_distribution_request_id,
    company_id,
    region_id,
    store_id,
    request_month,
    target_label,
    total_target_value,
    allocation_count,
    request_status,
    request_reason,
    allocation_json,
    submitted_by_user_id,
    approved_by_user_id,
    approved_at
)
VALUES
    (
        '00000000-0000-0000-0000-000000000701',
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000010',
        '00000000-0000-0000-0000-000000000100',
        DATE '2026-04-01',
        'Demo live scoring monthly target',
        300.0000,
        3,
        'approved',
        'demo_live_target_distribution_request_store100',
        '[
          {"employeeId":"00000000-0000-0000-0000-000000000201","targetValue":100},
          {"employeeId":"00000000-0000-0000-0000-000000000202","targetValue":100},
          {"employeeId":"00000000-0000-0000-0000-000000000203","targetValue":100}
        ]'::jsonb,
        'demo_seed',
        'demo_seed',
        TIMESTAMPTZ '2026-04-01 09:00:00+00'
    ),
    (
        '00000000-0000-0000-0000-000000000702',
        '00000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000010',
        '00000000-0000-0000-0000-000000000101',
        DATE '2026-04-01',
        'Demo live scoring monthly target',
        100.0000,
        1,
        'approved',
        'demo_live_target_distribution_request_store101',
        '[
          {"employeeId":"00000000-0000-0000-0000-000000000204","targetValue":100}
        ]'::jsonb,
        'demo_seed',
        'demo_seed',
        TIMESTAMPTZ '2026-04-01 09:00:00+00'
    )
ON CONFLICT DO NOTHING;

WITH demo_live_personnel_target_reference (
    personnel_target_reference_id,
    source_request_id,
    employee_id,
    store_id,
    target_value
) AS (
    VALUES
        ('00000000-0000-0000-0000-000000000721'::uuid, '00000000-0000-0000-0000-000000000701'::uuid, '00000000-0000-0000-0000-000000000201'::uuid, '00000000-0000-0000-0000-000000000100'::uuid, 100.0000),
        ('00000000-0000-0000-0000-000000000722'::uuid, '00000000-0000-0000-0000-000000000701'::uuid, '00000000-0000-0000-0000-000000000202'::uuid, '00000000-0000-0000-0000-000000000100'::uuid, 100.0000),
        ('00000000-0000-0000-0000-000000000723'::uuid, '00000000-0000-0000-0000-000000000701'::uuid, '00000000-0000-0000-0000-000000000203'::uuid, '00000000-0000-0000-0000-000000000100'::uuid, 100.0000),
        ('00000000-0000-0000-0000-000000000724'::uuid, '00000000-0000-0000-0000-000000000702'::uuid, '00000000-0000-0000-0000-000000000204'::uuid, '00000000-0000-0000-0000-000000000101'::uuid, 100.0000)
)
INSERT INTO ops.personnel_target_reference (
    personnel_target_reference_id,
    source_request_id,
    company_id,
    region_id,
    store_id,
    employee_id,
    period_start,
    period_end,
    target_value,
    target_type,
    status,
    approved_by_user_id,
    approved_at
)
SELECT
    target.personnel_target_reference_id,
    target.source_request_id,
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000010',
    target.store_id,
    target.employee_id,
    DATE '2026-04-01',
    DATE '2026-04-30',
    target.target_value,
    'monthly_sales_target',
    'approved',
    'demo_seed',
    TIMESTAMPTZ '2026-04-01 09:00:00+00'
FROM demo_live_personnel_target_reference target
ON CONFLICT DO NOTHING;

WITH demo_closed_ranking_runs (snapshot_run_id, closure_date, generated_at) AS (
    VALUES
        ('00000000-0000-0000-0000-00000000f322'::uuid, DATE '2026-04-22', TIMESTAMPTZ '2026-04-22 21:00:00+00'),
        ('00000000-0000-0000-0000-00000000f323'::uuid, DATE '2026-04-23', TIMESTAMPTZ '2026-04-23 21:00:00+00'),
        ('00000000-0000-0000-0000-00000000f324'::uuid, DATE '2026-04-24', TIMESTAMPTZ '2026-04-24 21:00:00+00')
)
INSERT INTO rpt.snapshot_run (
    snapshot_run_id,
    snapshot_date,
    snapshot_type,
    period_start,
    period_end,
    run_status,
    idempotency_key,
    generated_at,
    started_at,
    finished_at,
    generated_by,
    source_batch_no
)
SELECT
    run.snapshot_run_id,
    run.closure_date,
    'daily',
    run.closure_date,
    run.closure_date,
    'completed',
    'demo_closed_ranking_seed:daily:' || run.closure_date::text,
    run.generated_at,
    run.generated_at,
    run.generated_at,
    'demo_closed_ranking_seed',
    'demo_closed_ranking_seed'
FROM demo_closed_ranking_runs run
ON CONFLICT DO NOTHING;

WITH demo_store_kpi_values (snapshot_run_id, store_id, kpi_code, period_start, period_end, actual_value, achievement_rate) AS (
    VALUES
        ('00000000-0000-0000-0000-00000000f322'::uuid, '00000000-0000-0000-0000-000000000100'::uuid, 'TARGET_ACHIEVEMENT', DATE '2026-04-22', DATE '2026-04-22', 96.0000, 0.9600),
        ('00000000-0000-0000-0000-00000000f322'::uuid, '00000000-0000-0000-0000-000000000100'::uuid, 'CR', DATE '2026-04-22', DATE '2026-04-22', 88.0000, 0.8800),
        ('00000000-0000-0000-0000-00000000f322'::uuid, '00000000-0000-0000-0000-000000000100'::uuid, 'ATV', DATE '2026-04-22', DATE '2026-04-22', 92.0000, 0.9200),
        ('00000000-0000-0000-0000-00000000f322'::uuid, '00000000-0000-0000-0000-000000000100'::uuid, 'UPT', DATE '2026-04-22', DATE '2026-04-22', 91.0000, 0.9100),
        ('00000000-0000-0000-0000-00000000f322'::uuid, '00000000-0000-0000-0000-000000000100'::uuid, 'BM_CHECKLIST', DATE '2026-04-01', DATE '2026-04-30', 95.0000, 0.9500),
        ('00000000-0000-0000-0000-00000000f322'::uuid, '00000000-0000-0000-0000-000000000100'::uuid, 'VM_CHECKLIST', DATE '2026-04-01', DATE '2026-04-30', 93.0000, 0.9300),
        ('00000000-0000-0000-0000-00000000f322'::uuid, '00000000-0000-0000-0000-000000000101'::uuid, 'TARGET_ACHIEVEMENT', DATE '2026-04-22', DATE '2026-04-22', 94.0000, 0.9400),
        ('00000000-0000-0000-0000-00000000f322'::uuid, '00000000-0000-0000-0000-000000000101'::uuid, 'CR', DATE '2026-04-22', DATE '2026-04-22', 84.0000, 0.8400),
        ('00000000-0000-0000-0000-00000000f322'::uuid, '00000000-0000-0000-0000-000000000101'::uuid, 'ATV', DATE '2026-04-22', DATE '2026-04-22', 90.0000, 0.9000),
        ('00000000-0000-0000-0000-00000000f322'::uuid, '00000000-0000-0000-0000-000000000101'::uuid, 'UPT', DATE '2026-04-22', DATE '2026-04-22', 89.0000, 0.8900),
        ('00000000-0000-0000-0000-00000000f322'::uuid, '00000000-0000-0000-0000-000000000101'::uuid, 'VM_CHECKLIST', DATE '2026-04-01', DATE '2026-04-30', 90.0000, 0.9000)
)
INSERT INTO rpt.store_kpi_snapshot (
    snapshot_run_id,
    store_id,
    kpi_id,
    period_start,
    period_end,
    target_value,
    actual_value,
    achievement_rate,
    status_band
)
SELECT
    value.snapshot_run_id,
    value.store_id,
    definition.kpi_id,
    value.period_start,
    value.period_end,
    100.0000,
    value.actual_value,
    value.achievement_rate,
    CASE
        WHEN value.achievement_rate >= 0.95 THEN 'green'
        WHEN value.achievement_rate >= 0.85 THEN 'yellow'
        ELSE 'red'
    END
FROM demo_store_kpi_values value
INNER JOIN ops.kpi_definition definition ON definition.kpi_code = value.kpi_code
ON CONFLICT DO NOTHING;

WITH demo_closed_ranking_runs (snapshot_run_id, closure_date) AS (
    VALUES
        ('00000000-0000-0000-0000-00000000f322'::uuid, DATE '2026-04-22'),
        ('00000000-0000-0000-0000-00000000f323'::uuid, DATE '2026-04-23'),
        ('00000000-0000-0000-0000-00000000f324'::uuid, DATE '2026-04-24')
),
demo_closed_ranking_metric_values (employee_id, store_id, kpi_code, actual_value) AS (
    VALUES
        ('00000000-0000-0000-0000-000000000201'::uuid, '00000000-0000-0000-0000-000000000100'::uuid, 'TARGET_ACHIEVEMENT', 94.0000),
        ('00000000-0000-0000-0000-000000000201'::uuid, '00000000-0000-0000-0000-000000000100'::uuid, 'ATV', 88.0000),
        ('00000000-0000-0000-0000-000000000201'::uuid, '00000000-0000-0000-0000-000000000100'::uuid, 'UPT', 91.0000),
        ('00000000-0000-0000-0000-000000000202'::uuid, '00000000-0000-0000-0000-000000000100'::uuid, 'TARGET_ACHIEVEMENT', 98.0000),
        ('00000000-0000-0000-0000-000000000202'::uuid, '00000000-0000-0000-0000-000000000100'::uuid, 'ATV', 96.0000),
        ('00000000-0000-0000-0000-000000000202'::uuid, '00000000-0000-0000-0000-000000000100'::uuid, 'UPT', 95.0000),
        ('00000000-0000-0000-0000-000000000203'::uuid, '00000000-0000-0000-0000-000000000100'::uuid, 'TARGET_ACHIEVEMENT', 86.0000),
        ('00000000-0000-0000-0000-000000000203'::uuid, '00000000-0000-0000-0000-000000000100'::uuid, 'ATV', 84.0000),
        ('00000000-0000-0000-0000-000000000203'::uuid, '00000000-0000-0000-0000-000000000100'::uuid, 'UPT', 82.0000),
        ('00000000-0000-0000-0000-000000000204'::uuid, '00000000-0000-0000-0000-000000000101'::uuid, 'TARGET_ACHIEVEMENT', 99.0000),
        ('00000000-0000-0000-0000-000000000204'::uuid, '00000000-0000-0000-0000-000000000101'::uuid, 'ATV', 91.0000),
        ('00000000-0000-0000-0000-000000000204'::uuid, '00000000-0000-0000-0000-000000000101'::uuid, 'UPT', 90.0000)
)
INSERT INTO rpt.employee_kpi_snapshot (
    snapshot_run_id,
    employee_id,
    store_id,
    kpi_id,
    period_start,
    period_end,
    actual_value
)
SELECT
    run.snapshot_run_id,
    metric.employee_id,
    metric.store_id,
    definition.kpi_id,
    run.closure_date,
    run.closure_date,
    metric.actual_value
FROM demo_closed_ranking_runs run
CROSS JOIN demo_closed_ranking_metric_values metric
JOIN ops.kpi_definition definition ON definition.kpi_code = metric.kpi_code
ON CONFLICT DO NOTHING;

WITH demo_closed_ranking_runs (snapshot_run_id, closure_date) AS (
    VALUES
        ('00000000-0000-0000-0000-00000000f322'::uuid, DATE '2026-04-22'),
        ('00000000-0000-0000-0000-00000000f323'::uuid, DATE '2026-04-23'),
        ('00000000-0000-0000-0000-00000000f324'::uuid, DATE '2026-04-24')
),
demo_closed_ranking_performance (
    employee_id,
    store_id,
    score_value,
    turkey_rank,
    turkey_population,
    store_rank,
    store_population
) AS (
    VALUES
        ('00000000-0000-0000-0000-000000000202'::uuid, '00000000-0000-0000-0000-000000000100'::uuid, 96.5000, 1, 4, 1, 3),
        ('00000000-0000-0000-0000-000000000204'::uuid, '00000000-0000-0000-0000-000000000101'::uuid, 93.6000, 2, 4, 1, 1),
        ('00000000-0000-0000-0000-000000000201'::uuid, '00000000-0000-0000-0000-000000000100'::uuid, 91.3000, 3, 4, 2, 3),
        ('00000000-0000-0000-0000-000000000203'::uuid, '00000000-0000-0000-0000-000000000100'::uuid, 84.0000, 4, 4, 3, 3)
)
INSERT INTO rpt.employee_performance_snapshot (
    snapshot_run_id,
    employee_id,
    store_id,
    period_start,
    period_end,
    score_value,
    matched_metrics,
    total_metrics,
    turkey_rank,
    turkey_population,
    store_rank,
    store_population
)
SELECT
    run.snapshot_run_id,
    perf.employee_id,
    perf.store_id,
    run.closure_date,
    run.closure_date,
    perf.score_value,
    3,
    3,
    perf.turkey_rank,
    perf.turkey_population,
    perf.store_rank,
    perf.store_population
FROM demo_closed_ranking_runs run
CROSS JOIN demo_closed_ranking_performance perf
ON CONFLICT DO NOTHING;

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
    ('d0000000-0000-0000-0000-000000000002', 'POS', 'Point of Sale', 'kpi', 'manual', 'latest_state', TRUE),
    ('d0000000-0000-0000-0000-000000000003', 'power-bi-kpi', 'Power BI KPI', 'kpi', 'power_bi', 'closed_period', TRUE)
ON CONFLICT (source_code, entity_type) DO NOTHING;
