SET LOCAL lock_timeout = '5000ms';
SET LOCAL statement_timeout = '30000ms';

INSERT INTO ops.permission (permission_id, permission_code, resource_name, action_name, description)
VALUES
    ('70000000-0000-0000-0000-000000000026', 'INCENTIVE_SALES_DIRECTOR_APPROVAL', 'incentive', 'approve_sales_director', 'Approve submitted region incentive packages as Sales Director'),
    ('70000000-0000-0000-0000-000000000027', 'INCENTIVE_HR_APPROVAL', 'incentive', 'approve_hr', 'Approve the sealed company incentive package as HR'),
    ('70000000-0000-0000-0000-000000000028', 'INCENTIVE_GENERAL_MANAGER_APPROVAL', 'incentive', 'approve_general_manager', 'Give the final company incentive approval'),
    ('70000000-0000-0000-0000-000000000029', 'INCENTIVE_PAYROLL_DELIVERY', 'incentive', 'deliver_payroll', 'Receive and reconcile the final payroll delivery')
ON CONFLICT (permission_code) DO UPDATE SET
    resource_name = EXCLUDED.resource_name,
    action_name = EXCLUDED.action_name,
    description = EXCLUDED.description;

CREATE TABLE IF NOT EXISTS ops.user_permission_assignment (
    user_permission_assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_role_assignment_id UUID NOT NULL REFERENCES ops.user_role_assignment(user_role_assignment_id),
    user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    permission_id UUID NOT NULL REFERENCES ops.permission(permission_id),
    scope_type TEXT NOT NULL CHECK (scope_type IN ('company', 'region', 'store')),
    company_id UUID NOT NULL REFERENCES ops.company(company_id),
    region_id UUID REFERENCES ops.region(region_id),
    store_id UUID REFERENCES ops.store(store_id),
    starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ends_at TIMESTAMPTZ,
    granted_by_user_id UUID NOT NULL REFERENCES ops.user_account(user_id),
    grant_reason TEXT NOT NULL CHECK (BTRIM(grant_reason) <> ''),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    revoked_by_user_id UUID REFERENCES ops.user_account(user_id),
    revoke_reason TEXT,
    effective_range TSTZRANGE GENERATED ALWAYS AS (
        tstzrange(starts_at, COALESCE(ends_at, 'infinity'::timestamptz), '[)')
    ) STORED,
    scope_key TEXT GENERATED ALWAYS AS (
        scope_type || ':' || company_id::text || ':' ||
        COALESCE(region_id::text, '-') || ':' || COALESCE(store_id::text, '-')
    ) STORED,
    CHECK (ends_at IS NULL OR ends_at > starts_at),
    CHECK (
        (revoked_at IS NULL AND revoked_by_user_id IS NULL AND revoke_reason IS NULL) OR
        (revoked_at IS NOT NULL AND revoked_by_user_id IS NOT NULL AND BTRIM(COALESCE(revoke_reason, '')) <> '')
    ),
    CHECK (
        (scope_type = 'company' AND region_id IS NULL AND store_id IS NULL) OR
        (scope_type = 'region' AND region_id IS NOT NULL AND store_id IS NULL) OR
        (scope_type = 'store' AND region_id IS NOT NULL AND store_id IS NOT NULL)
    ),
    EXCLUDE USING gist (
        user_id WITH =,
        permission_id WITH =,
        scope_key WITH =,
        effective_range WITH &&
    ) WHERE (revoked_at IS NULL)
);

CREATE INDEX IF NOT EXISTS idx_user_permission_assignment_user_active
    ON ops.user_permission_assignment (user_id, starts_at, ends_at)
    WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_permission_assignment_role
    ON ops.user_permission_assignment (user_role_assignment_id, created_at DESC);

CREATE OR REPLACE FUNCTION ops.guard_user_permission_assignment_v1()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    assignment RECORD;
    permission_code_value TEXT;
    assignment_rank INTEGER;
    grant_rank INTEGER;
BEGIN
    PERFORM 1 FROM ops.user_account WHERE user_id = NEW.user_id FOR UPDATE;
    PERFORM pg_advisory_xact_lock(hashtext(
        'user_permission:' || NEW.user_id::text || ':' || NEW.company_id::text
    )::bigint);

    SELECT role_assignment.user_id, role_assignment.role_id, role_assignment.scope_type,
           role_assignment.company_id, role_assignment.region_id, role_assignment.store_id,
           role_assignment.start_at, role_assignment.end_at,
           role.role_code
    INTO assignment
    FROM ops.user_role_assignment role_assignment
    JOIN ops.role role ON role.role_id = role_assignment.role_id
    JOIN ops.user_account account ON account.user_id = role_assignment.user_id
    WHERE role_assignment.user_role_assignment_id = NEW.user_role_assignment_id
      AND role_assignment.start_at <= NOW()
      AND (role_assignment.end_at IS NULL OR role_assignment.end_at > NOW())
      AND account.is_active = TRUE
    FOR UPDATE OF role_assignment;
    IF NOT FOUND OR assignment.user_id <> NEW.user_id THEN
        RAISE EXCEPTION 'Capability grant requires an active matching role assignment'
            USING ERRCODE = '23514', CONSTRAINT = 'ck_user_permission_active_role';
    END IF;
    IF NEW.starts_at < assignment.start_at OR
       (assignment.end_at IS NOT NULL AND (NEW.ends_at IS NULL OR NEW.ends_at > assignment.end_at)) THEN
        RAISE EXCEPTION 'Capability validity must stay within the role assignment validity'
            USING ERRCODE = '23514', CONSTRAINT = 'ck_user_permission_role_validity';
    END IF;
    IF assignment.role_code = 'SUPER_ADMIN' THEN
        RAISE EXCEPTION 'Super Admin permissions are fixed'
            USING ERRCODE = '23514', CONSTRAINT = 'ck_user_permission_super_fixed';
    END IF;
    IF EXISTS (
        SELECT 1 FROM ops.user_role_assignment super_assignment
        JOIN ops.role super_role ON super_role.role_id = super_assignment.role_id
        WHERE super_assignment.user_id = NEW.user_id AND super_role.role_code = 'SUPER_ADMIN'
          AND super_assignment.start_at < COALESCE(NEW.ends_at, 'infinity'::timestamptz)
          AND COALESCE(super_assignment.end_at, 'infinity'::timestamptz) > NEW.starts_at
    ) THEN
        RAISE EXCEPTION 'Users with Super Admin cannot receive personal capabilities'
            USING ERRCODE = '23514', CONSTRAINT = 'ck_user_permission_target_super_fixed';
    END IF;
    IF NEW.granted_by_user_id = NEW.user_id THEN
        RAISE EXCEPTION 'Users cannot grant capabilities to themselves'
            USING ERRCODE = '23514', CONSTRAINT = 'ck_user_permission_no_self_grant';
    END IF;

    assignment_rank := CASE assignment.scope_type WHEN 'company' THEN 0 WHEN 'region' THEN 1 ELSE 2 END;
    grant_rank := CASE NEW.scope_type WHEN 'company' THEN 0 WHEN 'region' THEN 1 ELSE 2 END;
    IF grant_rank < assignment_rank OR assignment.company_id <> NEW.company_id OR
       (assignment.region_id IS NOT NULL AND assignment.region_id <> NEW.region_id) OR
       (assignment.store_id IS NOT NULL AND assignment.store_id <> NEW.store_id) THEN
        RAISE EXCEPTION 'Capability scope exceeds its role assignment'
            USING ERRCODE = '23514', CONSTRAINT = 'ck_user_permission_role_scope';
    END IF;
    IF NEW.region_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM ops.region region
        WHERE region.region_id = NEW.region_id AND region.company_id = NEW.company_id AND region.status = 'active'
    ) THEN
        RAISE EXCEPTION 'Capability region does not belong to the active company'
            USING ERRCODE = '23514', CONSTRAINT = 'ck_user_permission_region_scope';
    END IF;
    IF NEW.store_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM ops.store store
        WHERE store.store_id = NEW.store_id AND store.company_id = NEW.company_id
          AND store.region_id = NEW.region_id AND store.status = 'active'
    ) THEN
        RAISE EXCEPTION 'Capability store does not belong to the active region'
            USING ERRCODE = '23514', CONSTRAINT = 'ck_user_permission_store_scope';
    END IF;

    SELECT permission_code INTO permission_code_value
    FROM ops.permission WHERE permission_id = NEW.permission_id;
    IF permission_code_value = 'INCENTIVE_FINAL_APPROVAL' THEN
        RAISE EXCEPTION 'Legacy final approval cannot be granted directly'
            USING ERRCODE = '23514', CONSTRAINT = 'ck_user_permission_legacy_final';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext(
        'role_permission:' || assignment.role_id::text || ':' || NEW.permission_id::text
    )::bigint);
    IF EXISTS (
        SELECT 1 FROM ops.role_permission
        WHERE role_id = assignment.role_id AND permission_id = NEW.permission_id
    ) THEN
        RAISE EXCEPTION 'Capability already belongs to the role defaults'
            USING ERRCODE = '23514', CONSTRAINT = 'ck_user_permission_not_redundant';
    END IF;
    IF permission_code_value IN ('INCENTIVE_SALES_DIRECTOR_APPROVAL','INCENTIVE_GENERAL_MANAGER_APPROVAL')
       AND (assignment.role_code <> 'REPORT_VIEWER' OR NEW.scope_type <> 'company') THEN
        RAISE EXCEPTION 'Executive incentive approval requires company-scoped Report Viewer'
            USING ERRCODE = '23514', CONSTRAINT = 'ck_user_permission_executive_role';
    END IF;
    IF permission_code_value IN ('INCENTIVE_HR_APPROVAL','INCENTIVE_PAYROLL_DELIVERY')
       AND (assignment.role_code <> 'HR_ADMIN' OR NEW.scope_type <> 'company') THEN
        RAISE EXCEPTION 'HR incentive capability requires company-scoped HR Admin'
            USING ERRCODE = '23514', CONSTRAINT = 'ck_user_permission_hr_role';
    END IF;
    IF permission_code_value IN ('INCENTIVE_SALES_DIRECTOR_APPROVAL','INCENTIVE_GENERAL_MANAGER_APPROVAL')
       AND EXISTS (
           SELECT 1 FROM ops.user_permission_assignment other
           JOIN ops.permission permission ON permission.permission_id = other.permission_id
           WHERE other.user_id = NEW.user_id AND other.company_id = NEW.company_id
             AND other.user_permission_assignment_id <> NEW.user_permission_assignment_id
             AND permission.permission_code IN ('INCENTIVE_SALES_DIRECTOR_APPROVAL','INCENTIVE_GENERAL_MANAGER_APPROVAL')
             AND permission.permission_code <> permission_code_value
             AND other.revoked_at IS NULL
             AND other.starts_at < COALESCE(NEW.ends_at, 'infinity'::timestamptz)
             AND COALESCE(other.ends_at, 'infinity'::timestamptz) > NEW.starts_at
       ) THEN
        RAISE EXCEPTION 'Sales Director and General Manager approvals cannot overlap for one user'
            USING ERRCODE = '23514', CONSTRAINT = 'ck_user_permission_approval_separation';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_permission_assignment_guard ON ops.user_permission_assignment;
CREATE TRIGGER trg_user_permission_assignment_guard
BEFORE INSERT OR UPDATE OF user_role_assignment_id, user_id, permission_id, scope_type,
    company_id, region_id, store_id, starts_at, ends_at, granted_by_user_id
ON ops.user_permission_assignment
FOR EACH ROW EXECUTE FUNCTION ops.guard_user_permission_assignment_v1();

CREATE OR REPLACE FUNCTION ops.guard_role_permission_capability_v1()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    permission_code_value TEXT;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext(
        'role_permission:' || NEW.role_id::text || ':' || NEW.permission_id::text
    )::bigint);
    SELECT permission_code INTO permission_code_value FROM ops.permission WHERE permission_id = NEW.permission_id;
    IF permission_code_value IN (
        'INCENTIVE_SALES_DIRECTOR_APPROVAL','INCENTIVE_HR_APPROVAL',
        'INCENTIVE_GENERAL_MANAGER_APPROVAL','INCENTIVE_PAYROLL_DELIVERY'
    ) THEN
        RAISE EXCEPTION 'Incentive stage capabilities must be assigned to individuals'
            USING ERRCODE = '23514', CONSTRAINT = 'ck_role_permission_capability_only';
    END IF;
    IF EXISTS (
        SELECT 1 FROM ops.user_permission_assignment assignment
        JOIN ops.user_role_assignment role_assignment
          ON role_assignment.user_role_assignment_id = assignment.user_role_assignment_id
        WHERE role_assignment.role_id = NEW.role_id AND assignment.permission_id = NEW.permission_id
          AND assignment.revoked_at IS NULL
          AND COALESCE(assignment.ends_at, 'infinity'::timestamptz) > NOW()
    ) THEN
        RAISE EXCEPTION 'Role default conflicts with existing personal capability grants'
            USING ERRCODE = '23514', CONSTRAINT = 'ck_role_permission_personal_conflict';
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_role_permission_capability_guard ON ops.role_permission;
CREATE TRIGGER trg_role_permission_capability_guard
BEFORE INSERT OR UPDATE OF role_id, permission_id ON ops.role_permission
FOR EACH ROW EXECUTE FUNCTION ops.guard_role_permission_capability_v1();

CREATE OR REPLACE FUNCTION ops.guard_user_permission_revocation_v1()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.revoked_at IS NOT NULL AND (
        NEW.revoked_at IS DISTINCT FROM OLD.revoked_at OR
        NEW.revoked_by_user_id IS DISTINCT FROM OLD.revoked_by_user_id OR
        NEW.revoke_reason IS DISTINCT FROM OLD.revoke_reason
    ) THEN
        RAISE EXCEPTION 'Capability revocation evidence is immutable'
            USING ERRCODE = '55000';
    END IF;
    IF OLD.revoked_at IS NULL AND NEW.revoked_at IS NULL AND (
        NEW.revoked_by_user_id IS NOT NULL OR NEW.revoke_reason IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'Capability revocation evidence requires revoked_at'
            USING ERRCODE = '23514', CONSTRAINT = 'ck_user_permission_revocation_evidence';
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_user_permission_revocation_guard ON ops.user_permission_assignment;
CREATE TRIGGER trg_user_permission_revocation_guard
BEFORE UPDATE OF revoked_at, revoked_by_user_id, revoke_reason ON ops.user_permission_assignment
FOR EACH ROW EXECUTE FUNCTION ops.guard_user_permission_revocation_v1();

CREATE OR REPLACE FUNCTION ops.guard_super_role_assignment_capabilities_v1()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM ops.role WHERE role_id = NEW.role_id AND role_code = 'SUPER_ADMIN') THEN
      PERFORM 1 FROM ops.user_account WHERE user_id = NEW.user_id FOR UPDATE;
      IF EXISTS (
           SELECT 1 FROM ops.user_permission_assignment assignment
           WHERE assignment.user_id = NEW.user_id AND assignment.revoked_at IS NULL
             AND assignment.starts_at < COALESCE(NEW.end_at, 'infinity'::timestamptz)
             AND COALESCE(assignment.ends_at, 'infinity'::timestamptz) > NEW.start_at
       ) THEN
        RAISE EXCEPTION 'Super Admin assignment requires personal capabilities to be revoked first'
            USING ERRCODE = '23514', CONSTRAINT = 'ck_super_role_no_personal_capabilities';
      END IF;
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_super_role_assignment_capability_guard ON ops.user_role_assignment;
CREATE TRIGGER trg_super_role_assignment_capability_guard
BEFORE INSERT OR UPDATE OF role_id, user_id, start_at, end_at ON ops.user_role_assignment
FOR EACH ROW EXECUTE FUNCTION ops.guard_super_role_assignment_capabilities_v1();

CREATE OR REPLACE FUNCTION ops.guard_legacy_incentive_approval_v1()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF (TG_OP = 'INSERT' AND NEW.incentive_approval = TRUE) OR
       (TG_OP = 'UPDATE' AND OLD.incentive_approval = FALSE AND NEW.incentive_approval = TRUE) THEN
        RAISE EXCEPTION 'Legacy incentive final approval can only be revoked'
            USING ERRCODE = '23514', CONSTRAINT = 'ck_legacy_incentive_approval_revoke_only';
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_legacy_incentive_approval_guard ON ops.user_role_assignment;
CREATE TRIGGER trg_legacy_incentive_approval_guard
BEFORE INSERT OR UPDATE OF incentive_approval ON ops.user_role_assignment
FOR EACH ROW EXECUTE FUNCTION ops.guard_legacy_incentive_approval_v1();

COMMENT ON TABLE ops.user_permission_assignment IS
    'Allow-only, role-bound user capability grants with bounded scope, validity, grant reason and revocation evidence.';
