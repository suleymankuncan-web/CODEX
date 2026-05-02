-- Protect open-ended active role grants from duplicate user/role/scope rows.
-- Future scheduled or finite overlapping assignments require a separate range-overlap design.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM ops.user_role_assignment
        WHERE end_at IS NULL
        GROUP BY
            user_id,
            role_id,
            scope_type,
            COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid),
            COALESCE(region_id, '00000000-0000-0000-0000-000000000000'::uuid),
            COALESCE(store_id, '00000000-0000-0000-0000-000000000000'::uuid)
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Duplicate active role assignments exist; resolve duplicates before applying uq_user_role_assignment_active_scope';
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_role_assignment_active_scope
    ON ops.user_role_assignment (
        user_id,
        role_id,
        scope_type,
        COALESCE(company_id, '00000000-0000-0000-0000-000000000000'::uuid),
        COALESCE(region_id, '00000000-0000-0000-0000-000000000000'::uuid),
        COALESCE(store_id, '00000000-0000-0000-0000-000000000000'::uuid)
    )
    WHERE end_at IS NULL;
