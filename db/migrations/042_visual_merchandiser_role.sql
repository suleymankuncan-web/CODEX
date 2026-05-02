INSERT INTO ops.role (role_id, role_code, role_name, role_scope_type, description, is_system_role)
VALUES
    ('60000000-0000-0000-0000-000000000010', 'VISUAL_MERCHANDISER', 'Visual Merchandiser', 'store', 'Reads assigned store checklist and performance surfaces for VM pilot work', TRUE)
ON CONFLICT (role_code) DO UPDATE
SET
    role_name = EXCLUDED.role_name,
    role_scope_type = EXCLUDED.role_scope_type,
    description = EXCLUDED.description,
    is_system_role = EXCLUDED.is_system_role;

WITH grants(role_code, permission_code) AS (
    VALUES
        ('VISUAL_MERCHANDISER', 'store.read'),
        ('VISUAL_MERCHANDISER', 'employee.read'),
        ('VISUAL_MERCHANDISER', 'kpi.read'),
        ('VISUAL_MERCHANDISER', 'reports.read')
)
INSERT INTO ops.role_permission (role_id, permission_id)
SELECT role.role_id, permission.permission_id
FROM grants
INNER JOIN ops.role role
    ON role.role_code = grants.role_code
INNER JOIN ops.permission permission
    ON permission.permission_code = grants.permission_code
ON CONFLICT DO NOTHING;
