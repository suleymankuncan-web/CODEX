-- Synthetic-only identities used by the strict-local Keycloak proof.
-- No password or provider subject is stored here. The one-shot identity binder
-- attaches the exact Keycloak subjects after both systems have been reconciled.

INSERT INTO ops.user_account (
    user_id,
    employee_id,
    username,
    email,
    password_hash,
    auth_provider,
    provider_subject,
    is_active
)
VALUES
    ('80000000-0000-0000-0000-000000000011', NULL, 'onprem.store-manager', 'store-manager@onprem.invalid', NULL, 'local', NULL, TRUE),
    ('80000000-0000-0000-0000-000000000012', NULL, 'onprem.region-manager', 'region-manager@onprem.invalid', NULL, 'local', NULL, TRUE),
    ('80000000-0000-0000-0000-000000000013', NULL, 'onprem.report-viewer', 'report-viewer@onprem.invalid', NULL, 'local', NULL, TRUE),
    ('80000000-0000-0000-0000-000000000014', NULL, 'onprem.store-personnel', 'store-personnel@onprem.invalid', NULL, 'local', NULL, TRUE),
    ('80000000-0000-0000-0000-000000000015', NULL, 'onprem.visual-merchandiser', 'visual-merchandiser@onprem.invalid', NULL, 'local', NULL, TRUE)
ON CONFLICT (username) DO UPDATE SET
    email = EXCLUDED.email,
    is_active = TRUE,
    deactivation_reason = NULL,
    deactivated_by_user_id = NULL,
    deactivated_at = NULL,
    updated_at = NOW();

WITH assignments(
    assignment_id,
    username,
    role_code,
    scope_type,
    company_id,
    region_id,
    store_id
) AS (
    VALUES
        ('90000000-0000-0000-0000-000000000011'::uuid, 'onprem.store-manager', 'STORE_MANAGER', 'store', NULL::uuid, NULL::uuid, '00000000-0000-0000-0000-000000000100'::uuid),
        ('90000000-0000-0000-0000-000000000012'::uuid, 'onprem.region-manager', 'REGION_MANAGER', 'region', NULL::uuid, '00000000-0000-0000-0000-000000000010'::uuid, NULL::uuid),
        ('90000000-0000-0000-0000-000000000013'::uuid, 'onprem.report-viewer', 'REPORT_VIEWER', 'company', '00000000-0000-0000-0000-000000000001'::uuid, NULL::uuid, NULL::uuid),
        ('90000000-0000-0000-0000-000000000014'::uuid, 'onprem.store-personnel', 'STORE_PERSONNEL', 'store', NULL::uuid, NULL::uuid, '00000000-0000-0000-0000-000000000100'::uuid),
        ('90000000-0000-0000-0000-000000000015'::uuid, 'onprem.visual-merchandiser', 'VISUAL_MERCHANDISER', 'store', NULL::uuid, NULL::uuid, '00000000-0000-0000-0000-000000000100'::uuid)
)
INSERT INTO ops.user_role_assignment (
    user_role_assignment_id,
    user_id,
    role_id,
    scope_type,
    company_id,
    region_id,
    store_id,
    start_at,
    end_at
)
SELECT
    assignments.assignment_id,
    users.user_id,
    roles.role_id,
    assignments.scope_type,
    assignments.company_id,
    assignments.region_id,
    assignments.store_id,
    TIMESTAMPTZ '2026-01-01 00:00:00+00',
    NULL
FROM assignments
INNER JOIN ops.user_account users ON users.username = assignments.username
INNER JOIN ops.role roles ON roles.role_code = assignments.role_code
ON CONFLICT (user_role_assignment_id) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    role_id = EXCLUDED.role_id,
    scope_type = EXCLUDED.scope_type,
    company_id = EXCLUDED.company_id,
    region_id = EXCLUDED.region_id,
    store_id = EXCLUDED.store_id,
    start_at = EXCLUDED.start_at,
    end_at = NULL;

WITH action_assignments(assignment_id, username, store_id) AS (
    VALUES
        ('91000000-0000-0000-0000-000000000011'::uuid, 'onprem.store-manager', '00000000-0000-0000-0000-000000000100'::uuid),
        ('91000000-0000-0000-0000-000000000012'::uuid, 'onprem.region-manager', '00000000-0000-0000-0000-000000000100'::uuid),
        ('91000000-0000-0000-0000-000000000013'::uuid, 'onprem.region-manager', '00000000-0000-0000-0000-000000000101'::uuid),
        ('91000000-0000-0000-0000-000000000014'::uuid, 'onprem.visual-merchandiser', '00000000-0000-0000-0000-000000000100'::uuid)
)
INSERT INTO ops.user_action_store_assignment (
    user_action_store_assignment_id,
    user_id,
    store_id,
    start_at,
    end_at
)
SELECT
    action_assignments.assignment_id,
    users.user_id,
    action_assignments.store_id,
    TIMESTAMPTZ '2026-01-01 00:00:00+00',
    NULL
FROM action_assignments
INNER JOIN ops.user_account users ON users.username = action_assignments.username
ON CONFLICT (user_action_store_assignment_id) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    store_id = EXCLUDED.store_id,
    start_at = EXCLUDED.start_at,
    end_at = NULL;
