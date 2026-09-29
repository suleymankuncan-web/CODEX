BEGIN;

INSERT INTO ops.company (company_id, company_code, company_name)
VALUES
  ('a1000000-0000-4000-8000-000000000001', 'VM_AUTH_MATRIX', 'Synthetic VM auth matrix'),
  ('a1000000-0000-4000-8000-000000000002', 'VM_AUTH_OTHER', 'Synthetic other company');
INSERT INTO ops.region (region_id, company_id, region_code, region_name)
VALUES ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'VM_AUTH', 'Synthetic VM auth region');
INSERT INTO ops.store (store_id, company_id, region_id, store_code, store_name, store_type)
VALUES ('a3000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001', 'VM_AUTH', 'Synthetic VM auth store', 'company');
INSERT INTO ops.user_account (user_id, username, email)
VALUES ('a4000000-0000-4000-8000-000000000001', 'vm-auth-matrix', 'vm-auth-matrix@example.invalid');

CREATE OR REPLACE FUNCTION pg_temp.vm_reference_publisher_allowed()
RETURNS BOOLEAN LANGUAGE SQL STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM ops.user_account actor
    INNER JOIN ops.company active_company
      ON active_company.company_id = 'a1000000-0000-4000-8000-000000000001'
     AND active_company.status = 'active'
    WHERE actor.user_id = 'a4000000-0000-4000-8000-000000000001'
      AND actor.is_active = TRUE
      AND EXISTS (
        SELECT 1 FROM ops.user_role_assignment capability_assignment
        INNER JOIN ops.role capability_role ON capability_role.role_id = capability_assignment.role_id
         AND capability_role.role_scope_type = 'company'
        INNER JOIN ops.role_permission role_permission ON role_permission.role_id = capability_assignment.role_id
        INNER JOIN ops.permission permission ON permission.permission_id = role_permission.permission_id
        WHERE capability_assignment.user_id = actor.user_id
          AND capability_assignment.company_id = active_company.company_id
          AND capability_assignment.scope_type = 'company'
          AND capability_assignment.region_id IS NULL
          AND capability_assignment.store_id IS NULL
          AND permission.permission_code = 'VM_REFERENCE_PUBLISHER'
          AND capability_assignment.start_at <= CURRENT_TIMESTAMP
          AND (capability_assignment.end_at IS NULL OR capability_assignment.end_at >= CURRENT_TIMESTAMP)
      )
  );
$$;

INSERT INTO ops.user_role_assignment (user_id, role_id, scope_type, company_id)
SELECT 'a4000000-0000-4000-8000-000000000001', role_id, 'company',
  'a1000000-0000-4000-8000-000000000001'
FROM ops.role WHERE role_code = 'SUPER_ADMIN';

DO $$
DECLARE capability_role_id UUID;
BEGIN
  SELECT role_id INTO capability_role_id FROM ops.role WHERE role_code = 'SUPER_ADMIN';
  IF NOT pg_temp.vm_reference_publisher_allowed() THEN RAISE EXCEPTION 'vm_auth_positive_matrix_failed'; END IF;

  UPDATE ops.user_account SET is_active = FALSE WHERE user_id = 'a4000000-0000-4000-8000-000000000001';
  IF pg_temp.vm_reference_publisher_allowed() THEN RAISE EXCEPTION 'vm_auth_inactive_actor_failed'; END IF;
  UPDATE ops.user_account SET is_active = TRUE WHERE user_id = 'a4000000-0000-4000-8000-000000000001';

  UPDATE ops.company SET status = 'inactive' WHERE company_id = 'a1000000-0000-4000-8000-000000000001';
  IF pg_temp.vm_reference_publisher_allowed() THEN RAISE EXCEPTION 'vm_auth_inactive_company_failed'; END IF;
  UPDATE ops.company SET status = 'active' WHERE company_id = 'a1000000-0000-4000-8000-000000000001';

  DELETE FROM ops.user_role_assignment WHERE user_id = 'a4000000-0000-4000-8000-000000000001' AND role_id = capability_role_id;
  IF pg_temp.vm_reference_publisher_allowed() THEN RAISE EXCEPTION 'vm_auth_missing_capability_failed'; END IF;
  INSERT INTO ops.user_role_assignment (user_id, role_id, scope_type, company_id)
  VALUES ('a4000000-0000-4000-8000-000000000001', capability_role_id, 'company',
    'a1000000-0000-4000-8000-000000000002');
  IF pg_temp.vm_reference_publisher_allowed() THEN RAISE EXCEPTION 'vm_auth_wrong_company_capability_failed'; END IF;
  DELETE FROM ops.user_role_assignment WHERE user_id = 'a4000000-0000-4000-8000-000000000001' AND role_id = capability_role_id;

  INSERT INTO ops.user_role_assignment (user_id, role_id, scope_type, company_id, region_id, store_id)
  VALUES ('a4000000-0000-4000-8000-000000000001', capability_role_id, 'store',
    'a1000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000001');
  IF pg_temp.vm_reference_publisher_allowed() THEN RAISE EXCEPTION 'vm_auth_store_scoped_capability_failed'; END IF;
END;
$$;

SELECT '{"event":"vm_reference_auth_matrix.completed","positive":true,"inactive_actor_denied":true,"inactive_company_denied":true,"missing_capability_denied":true,"wrong_company_denied":true,"store_scoped_capability_denied":true,"rolled_back":true}';
ROLLBACK;
