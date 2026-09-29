WITH violations AS (
    SELECT assignment.user_permission_assignment_id
    FROM ops.user_permission_assignment assignment
    JOIN ops.user_role_assignment role_assignment
      ON role_assignment.user_role_assignment_id = assignment.user_role_assignment_id
    LEFT JOIN ops.region region ON region.region_id = assignment.region_id
    LEFT JOIN ops.store store ON store.store_id = assignment.store_id
    WHERE assignment.user_id IS DISTINCT FROM role_assignment.user_id
       OR assignment.company_id IS DISTINCT FROM role_assignment.company_id
       OR (role_assignment.region_id IS NOT NULL AND assignment.region_id IS DISTINCT FROM role_assignment.region_id)
       OR (role_assignment.store_id IS NOT NULL AND assignment.store_id IS DISTINCT FROM role_assignment.store_id)
       OR (assignment.region_id IS NOT NULL AND assignment.company_id IS DISTINCT FROM region.company_id)
       OR (assignment.store_id IS NOT NULL AND (
            assignment.company_id IS DISTINCT FROM store.company_id
            OR assignment.region_id IS DISTINCT FROM store.region_id
       ))
)
SELECT
    'USER-PERM-01' AS check_id,
    COUNT(*)::bigint AS violation_count,
    COALESCE(array_agg(substr(md5(user_permission_assignment_id::text), 1, 12))
      FILTER (WHERE user_permission_assignment_id IS NOT NULL), ARRAY[]::text[]) AS sample_refs
FROM violations;
