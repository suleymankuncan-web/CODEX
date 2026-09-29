BEGIN;
SET LOCAL lock_timeout = '5000ms';
SET LOCAL statement_timeout = '30000ms';
LOCK TABLE ops.user_role_assignment, ops.role_permission, ops.role IN ACCESS EXCLUSIVE MODE;

DELETE FROM ops.role_permission role_permission
USING ops.role role, ops.permission permission
WHERE role.role_id = role_permission.role_id
  AND permission.permission_id = role_permission.permission_id
  AND role.role_code = 'SUPER_ADMIN'
  AND permission.permission_code = ANY(ARRAY[
      'VM_REFERENCE_PUBLISHER', 'VM_VISUAL_REVIEWER',
      'VM_CAMPAIGN_WINDOW_AUTHORITY', 'VM_CAMPAIGN_SCOPE_AUTHORITY',
      'VM_CAMPAIGN_EMERGENCY_AUTHORITY'
  ]::text[]);

INSERT INTO ops.role (role_id, role_code, role_name, role_scope_type, description, is_system_role)
VALUES
    ('60000000-0000-0000-0000-000000000004', 'AUDITOR', 'Auditor', 'region', 'Executes checklist audits', TRUE),
    ('60000000-0000-0000-0000-000000000006', 'INTEGRATION_ADMIN', 'Integration Admin', 'company', 'Manages integration sources and import batches', TRUE),
    ('60000000-0000-0000-0000-000000000007', 'SNAPSHOT_OPERATOR', 'Snapshot Operator', 'company', 'Runs and reruns reporting snapshots', TRUE),
    ('60000000-0000-0000-0000-000000000011', 'VM_REFERENCE_PUBLISHER', 'VM Reference Publisher', 'company', 'Explicit company-scoped VM reference publishing capability', TRUE),
    ('60000000-0000-0000-0000-000000000012', 'VM_VISUAL_REVIEWER', 'VM Visual Reviewer', 'company', 'Explicit company-scoped VM visual coverage read capability', TRUE),
    ('60000000-0000-0000-0000-000000000013', 'VM_CAMPAIGN_WINDOW_AUTHORITY', 'VM Campaign Window Authority', 'company', 'Explicit company-scoped VM campaign window authority', TRUE),
    ('60000000-0000-0000-0000-000000000014', 'VM_CAMPAIGN_SCOPE_AUTHORITY', 'VM Campaign Scope Authority', 'company', 'Explicit company-scoped VM campaign scope authority', TRUE),
    ('60000000-0000-0000-0000-000000000015', 'VM_CAMPAIGN_EMERGENCY_AUTHORITY', 'VM Campaign Emergency Authority', 'company', 'Explicit company-scoped VM campaign emergency authority', TRUE)
ON CONFLICT (role_code) DO NOTHING;

INSERT INTO ops.role_permission (role_id, permission_id)
SELECT role.role_id, permission.permission_id
FROM ops.role role
JOIN (VALUES
    ('AUDITOR', 'store.read'), ('AUDITOR', 'checklist.manage'), ('AUDITOR', 'reports.read'),
    ('INTEGRATION_ADMIN', 'integration.manage'),
    ('SNAPSHOT_OPERATOR', 'snapshot.read'), ('SNAPSHOT_OPERATOR', 'snapshot.manage'),
    ('VM_REFERENCE_PUBLISHER', 'VM_REFERENCE_PUBLISHER'),
    ('VM_VISUAL_REVIEWER', 'VM_VISUAL_REVIEWER'),
    ('VM_CAMPAIGN_WINDOW_AUTHORITY', 'VM_CAMPAIGN_WINDOW_AUTHORITY'),
    ('VM_CAMPAIGN_SCOPE_AUTHORITY', 'VM_CAMPAIGN_SCOPE_AUTHORITY'),
    ('VM_CAMPAIGN_EMERGENCY_AUTHORITY', 'VM_CAMPAIGN_EMERGENCY_AUTHORITY')
) AS mapping(role_code, permission_code) ON mapping.role_code = role.role_code
JOIN ops.permission permission ON permission.permission_code = mapping.permission_code
ON CONFLICT (role_id, permission_id) DO NOTHING;

DELETE FROM audit.schema_migration WHERE migration_name = '091_role_catalog_simplification_v1.sql';
COMMIT;
