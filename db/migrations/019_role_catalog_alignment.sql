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
ON CONFLICT (role_code) DO UPDATE
SET
    role_name = EXCLUDED.role_name,
    role_scope_type = EXCLUDED.role_scope_type,
    description = EXCLUDED.description,
    is_system_role = EXCLUDED.is_system_role;

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
ON CONFLICT (permission_code) DO UPDATE
SET
    resource_name = EXCLUDED.resource_name,
    action_name = EXCLUDED.action_name,
    description = EXCLUDED.description;

WITH grants(role_code, permission_code) AS (
    VALUES
        ('SUPER_ADMIN', 'store.read'),
        ('SUPER_ADMIN', 'employee.read'),
        ('SUPER_ADMIN', 'checklist.manage'),
        ('SUPER_ADMIN', 'kpi.read'),
        ('SUPER_ADMIN', 'snapshot.read'),
        ('SUPER_ADMIN', 'reports.read'),
        ('SUPER_ADMIN', 'integration.manage'),
        ('SUPER_ADMIN', 'snapshot.manage'),
        ('SUPER_ADMIN', 'target_distribution.manage'),
        ('SUPER_ADMIN', 'target_distribution.approve'),
        ('SUPER_ADMIN', 'kpi_config.manage'),
        ('SUPER_ADMIN', 'auth.manage'),
        ('REGION_MANAGER', 'store.read'),
        ('REGION_MANAGER', 'employee.read'),
        ('REGION_MANAGER', 'kpi.read'),
        ('REGION_MANAGER', 'reports.read'),
        ('REGION_MANAGER', 'target_distribution.approve'),
        ('STORE_MANAGER', 'store.read'),
        ('STORE_MANAGER', 'employee.read'),
        ('STORE_MANAGER', 'checklist.manage'),
        ('STORE_MANAGER', 'kpi.read'),
        ('STORE_MANAGER', 'reports.read'),
        ('STORE_MANAGER', 'target_distribution.manage'),
        ('AUDITOR', 'store.read'),
        ('AUDITOR', 'checklist.manage'),
        ('AUDITOR', 'reports.read'),
        ('REPORT_VIEWER', 'reports.read'),
        ('INTEGRATION_ADMIN', 'integration.manage'),
        ('SNAPSHOT_OPERATOR', 'snapshot.read'),
        ('SNAPSHOT_OPERATOR', 'snapshot.manage'),
        ('STORE_PERSONNEL', 'kpi.read'),
        ('STORE_PERSONNEL', 'reports.read')
)
INSERT INTO ops.role_permission (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM grants g
INNER JOIN ops.role r
    ON r.role_code = g.role_code
INNER JOIN ops.permission p
    ON p.permission_code = g.permission_code
ON CONFLICT DO NOTHING;
