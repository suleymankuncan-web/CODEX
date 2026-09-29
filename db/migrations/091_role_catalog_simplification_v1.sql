SET LOCAL lock_timeout = '5000ms';
SET LOCAL statement_timeout = '30000ms';

LOCK TABLE ops.user_role_assignment, ops.role_permission, ops.role IN SHARE ROW EXCLUSIVE MODE;

DO $role_assignment_preflight$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM ops.user_role_assignment assignment
        JOIN ops.role role ON role.role_id = assignment.role_id
        WHERE role.role_code = ANY(ARRAY[
            'AUDITOR', 'INTEGRATION_ADMIN', 'SNAPSHOT_OPERATOR',
            'VM_REFERENCE_PUBLISHER', 'VM_VISUAL_REVIEWER',
            'VM_CAMPAIGN_WINDOW_AUTHORITY', 'VM_CAMPAIGN_SCOPE_AUTHORITY',
            'VM_CAMPAIGN_EMERGENCY_AUTHORITY'
        ]::text[])
    ) THEN
        RAISE EXCEPTION 'Removed roles still have user assignments; clean them explicitly before migration 091';
    END IF;
END;
$role_assignment_preflight$;

INSERT INTO ops.role_permission (role_id, permission_id)
SELECT super_role.role_id, permission.permission_id
FROM ops.role super_role
JOIN ops.permission permission ON permission.permission_code = ANY(ARRAY[
    'VM_REFERENCE_PUBLISHER', 'VM_VISUAL_REVIEWER',
    'VM_CAMPAIGN_WINDOW_AUTHORITY', 'VM_CAMPAIGN_SCOPE_AUTHORITY',
    'VM_CAMPAIGN_EMERGENCY_AUTHORITY'
]::text[])
WHERE super_role.role_code = 'SUPER_ADMIN'
ON CONFLICT (role_id, permission_id) DO NOTHING;

DELETE FROM ops.role_permission role_permission
USING ops.role role
WHERE role.role_id = role_permission.role_id
  AND role.role_code = ANY(ARRAY[
      'AUDITOR', 'INTEGRATION_ADMIN', 'SNAPSHOT_OPERATOR',
      'VM_REFERENCE_PUBLISHER', 'VM_VISUAL_REVIEWER',
      'VM_CAMPAIGN_WINDOW_AUTHORITY', 'VM_CAMPAIGN_SCOPE_AUTHORITY',
      'VM_CAMPAIGN_EMERGENCY_AUTHORITY'
  ]::text[]);

DELETE FROM ops.role
WHERE role_code = ANY(ARRAY[
    'AUDITOR', 'INTEGRATION_ADMIN', 'SNAPSHOT_OPERATOR',
    'VM_REFERENCE_PUBLISHER', 'VM_VISUAL_REVIEWER',
    'VM_CAMPAIGN_WINDOW_AUTHORITY', 'VM_CAMPAIGN_SCOPE_AUTHORITY',
    'VM_CAMPAIGN_EMERGENCY_AUTHORITY'
]::text[]);
