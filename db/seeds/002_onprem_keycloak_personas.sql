-- Synthetic-only identities used by the strict-local Keycloak proof.
-- No password or provider subject is stored here. The one-shot identity binder
-- attaches the exact Keycloak subjects after both systems have been reconciled.
-- The photo-proof administrator is a sixth synthetic-only account. It is kept
-- dormant until KEYCLOAK_SYNTHETIC_PHOTO_PROOF_ENABLED=true and the separate
-- photo-proof subject manifest is supplied to the identity binder.

-- Collision preflight is intentionally the first executable statement. The
-- deterministic photo-proof identity must never be silently adopted by a
-- seed rerun when an operator or an interrupted run has assigned its username,
-- UUID, role-assignment id, or action-assignment id to a different owner.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM ops.user_account
        WHERE username = 'onprem.photo-proof-admin'
          AND user_id <> '80000000-0000-0000-0000-000000000016'::uuid
    ) THEN
        RAISE EXCEPTION 'synthetic photo-proof username collision: onprem.photo-proof-admin';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM ops.user_account
        WHERE user_id = '80000000-0000-0000-0000-000000000016'::uuid
          AND username <> 'onprem.photo-proof-admin'
    ) THEN
        RAISE EXCEPTION 'synthetic photo-proof user id collision: 80000000-0000-0000-0000-000000000016';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM ops.user_role_assignment
        WHERE user_role_assignment_id = '90000000-0000-0000-0000-000000000016'::uuid
          AND user_id <> '80000000-0000-0000-0000-000000000016'::uuid
    ) THEN
        RAISE EXCEPTION 'synthetic photo-proof role assignment collision: 90000000-0000-0000-0000-000000000016';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM ops.user_action_store_assignment
        WHERE user_action_store_assignment_id = '91000000-0000-0000-0000-000000000015'::uuid
          AND user_id <> '80000000-0000-0000-0000-000000000016'::uuid
    ) THEN
        RAISE EXCEPTION 'synthetic photo-proof action assignment collision: 91000000-0000-0000-0000-000000000015';
    END IF;
END
$$;

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
    ('80000000-0000-0000-0000-000000000015', NULL, 'onprem.visual-merchandiser', 'visual-merchandiser@onprem.invalid', NULL, 'local', NULL, TRUE),
    ('80000000-0000-0000-0000-000000000016', NULL, 'onprem.photo-proof-admin', 'photo-proof-admin@onprem.invalid', NULL, 'local', NULL, FALSE)
ON CONFLICT (username) DO UPDATE SET
    email = EXCLUDED.email,
    is_active = CASE WHEN EXCLUDED.username = 'onprem.photo-proof-admin' THEN FALSE ELSE TRUE END,
    auth_provider = CASE WHEN EXCLUDED.username = 'onprem.photo-proof-admin' THEN 'local' ELSE ops.user_account.auth_provider END,
    provider_subject = CASE WHEN EXCLUDED.username = 'onprem.photo-proof-admin' THEN NULL ELSE ops.user_account.provider_subject END,
    deactivation_reason = CASE WHEN EXCLUDED.username = 'onprem.photo-proof-admin' THEN 'photo-proof-disabled' ELSE NULL END,
    deactivated_by_user_id = NULL,
    deactivated_at = CASE WHEN EXCLUDED.username = 'onprem.photo-proof-admin' THEN NOW() ELSE NULL END,
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
        ('90000000-0000-0000-0000-000000000011'::uuid, 'onprem.store-manager', 'STORE_MANAGER', 'store', '00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000010'::uuid, '00000000-0000-0000-0000-000000000100'::uuid),
        ('90000000-0000-0000-0000-000000000012'::uuid, 'onprem.region-manager', 'REGION_MANAGER', 'region', '00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000010'::uuid, NULL::uuid),
        ('90000000-0000-0000-0000-000000000013'::uuid, 'onprem.report-viewer', 'REPORT_VIEWER', 'company', '00000000-0000-0000-0000-000000000001'::uuid, NULL::uuid, NULL::uuid),
        ('90000000-0000-0000-0000-000000000014'::uuid, 'onprem.store-personnel', 'STORE_PERSONNEL', 'store', '00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000010'::uuid, '00000000-0000-0000-0000-000000000100'::uuid),
        ('90000000-0000-0000-0000-000000000015'::uuid, 'onprem.visual-merchandiser', 'VISUAL_MERCHANDISER', 'store', '00000000-0000-0000-0000-000000000001'::uuid, '00000000-0000-0000-0000-000000000010'::uuid, '00000000-0000-0000-0000-000000000100'::uuid),
        ('90000000-0000-0000-0000-000000000016'::uuid, 'onprem.photo-proof-admin', 'SUPER_ADMIN', 'company', '00000000-0000-0000-0000-000000000001'::uuid, NULL::uuid, NULL::uuid)
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

-- Reconcile the sixth account to exactly one active managed role without
-- deleting historical assignments. Any stale active role is closed before the
-- deterministic SUPER_ADMIN assignment above is used by the binder.
UPDATE ops.user_role_assignment stale
SET end_at = GREATEST(NOW(), stale.start_at)
FROM ops.user_account users
WHERE users.username = 'onprem.photo-proof-admin'
  AND stale.user_id = users.user_id
  AND stale.user_role_assignment_id <> '90000000-0000-0000-0000-000000000016'::uuid
  AND stale.end_at IS NULL;

WITH action_assignments(assignment_id, username, store_id) AS (
    VALUES
        ('91000000-0000-0000-0000-000000000011'::uuid, 'onprem.store-manager', '00000000-0000-0000-0000-000000000100'::uuid),
        ('91000000-0000-0000-0000-000000000012'::uuid, 'onprem.region-manager', '00000000-0000-0000-0000-000000000100'::uuid),
        ('91000000-0000-0000-0000-000000000013'::uuid, 'onprem.region-manager', '00000000-0000-0000-0000-000000000101'::uuid),
        ('91000000-0000-0000-0000-000000000014'::uuid, 'onprem.visual-merchandiser', '00000000-0000-0000-0000-000000000100'::uuid),
        ('91000000-0000-0000-0000-000000000015'::uuid, 'onprem.photo-proof-admin', '00000000-0000-0000-0000-000000000100'::uuid)
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

UPDATE ops.user_action_store_assignment stale
SET end_at = GREATEST(NOW(), stale.start_at)
FROM ops.user_account users
WHERE users.username = 'onprem.photo-proof-admin'
  AND stale.user_id = users.user_id
  AND stale.user_action_store_assignment_id <> '91000000-0000-0000-0000-000000000015'::uuid
  AND stale.end_at IS NULL;
