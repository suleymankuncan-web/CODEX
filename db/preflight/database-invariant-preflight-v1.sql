WITH scope_rows AS (
    SELECT 'ops.seller_code_request' AS source_table, seller_code_request_id::text AS record_id, company_id, region_id, store_id
    FROM ops.seller_code_request
    UNION ALL
    SELECT 'ops.employee_offboarding_request', offboarding_request_id::text, company_id, region_id, store_id
    FROM ops.employee_offboarding_request
    UNION ALL
    SELECT 'ops.target_distribution_request', target_distribution_request_id::text, company_id, region_id, store_id
    FROM ops.target_distribution_request
    UNION ALL
    SELECT 'ops.personnel_target_reference', personnel_target_reference_id::text, company_id, region_id, store_id
    FROM ops.personnel_target_reference
    UNION ALL
    SELECT 'ops.kpi_target', kpi_target_id::text, company_id, region_id, store_id
    FROM ops.kpi_target
    UNION ALL
    SELECT 'ops.kpi_actual', kpi_actual_id::text, company_id, region_id, store_id
    FROM ops.kpi_actual
    UNION ALL
    SELECT 'ops.workforce_norm_plan', norm_plan_id::text, company_id, region_id, store_id
    FROM ops.workforce_norm_plan
    UNION ALL
    SELECT 'ops.turnover_event', turnover_event_id::text, company_id, region_id, store_id
    FROM ops.turnover_event
    UNION ALL
    SELECT 'ops.store_action_plan', store_action_plan_id::text, company_id, region_id, store_id
    FROM ops.store_action_plan
    UNION ALL
    SELECT 'ops.sales_target_incentive_projection', sales_target_incentive_projection_id::text, company_id, region_id, store_id
    FROM ops.sales_target_incentive_projection
    UNION ALL
    SELECT 'rpt.sales_target_incentive_assignment_snapshot', sales_target_incentive_assignment_snapshot_id::text, company_id, region_id, store_id
    FROM rpt.sales_target_incentive_assignment_snapshot
    UNION ALL
    SELECT 'rpt.sales_target_incentive_final_snapshot', sales_target_incentive_final_snapshot_id::text, company_id, region_id, store_id
    FROM rpt.sales_target_incentive_final_snapshot
    UNION ALL
    SELECT 'ops.sales_target_incentive_adjustment', sales_target_incentive_adjustment_id::text, company_id, region_id, store_id
    FROM ops.sales_target_incentive_adjustment
    UNION ALL
    SELECT 'ops.sales_target_incentive_store_review', sales_target_incentive_store_review_id::text, company_id, region_id, store_id
    FROM ops.sales_target_incentive_store_review
    UNION ALL
    SELECT 'ops.sales_target_incentive_region_package', sales_target_incentive_region_package_id::text, company_id, region_id, NULL::uuid
    FROM ops.sales_target_incentive_region_package
    UNION ALL
    SELECT 'ops.sales_target_incentive_region_package_store', sales_target_incentive_region_package_store_id::text, company_id, region_id, store_id
    FROM ops.sales_target_incentive_region_package_store
    UNION ALL
    SELECT 'ops.sales_target_incentive_region_correction', sales_target_incentive_region_correction_id::text, company_id, region_id, store_id
    FROM ops.sales_target_incentive_region_correction
    UNION ALL
    SELECT 'rpt.turnover_snapshot', concat_ws(':', snapshot_run_id::text, scope_type, company_id::text, region_id::text, store_id::text), company_id, region_id, store_id
    FROM rpt.turnover_snapshot
    UNION ALL
    SELECT
        'stg.master_data_bootstrap_row',
        bootstrap_row.master_data_bootstrap_row_id::text,
        bootstrap_batch.company_id,
        bootstrap_row.resolved_region_id,
        bootstrap_row.resolved_store_id
    FROM stg.master_data_bootstrap_row bootstrap_row
    INNER JOIN stg.master_data_bootstrap_batch bootstrap_batch
        ON bootstrap_batch.master_data_bootstrap_batch_id = bootstrap_row.master_data_bootstrap_batch_id
    UNION ALL
    SELECT 'audit.event_log', event_log_id::text, company_id, region_id, store_id
    FROM audit.event_log
),
target_duplicate_employees AS (
    SELECT
        request.target_distribution_request_id,
        allocation.value ->> 'employeeId' AS employee_id
    FROM ops.target_distribution_request request
    CROSS JOIN LATERAL jsonb_array_elements(
        CASE
            WHEN jsonb_typeof(request.allocation_json) = 'array' THEN request.allocation_json
            ELSE '[]'::jsonb
        END
    ) allocation(value)
    WHERE NULLIF(allocation.value ->> 'employeeId', '') IS NOT NULL
    GROUP BY request.target_distribution_request_id, allocation.value ->> 'employeeId'
    HAVING COUNT(*) > 1
),
violations AS (
    SELECT
        'ORG-01' AS check_id,
        substr(md5(store.store_id::text), 1, 12) AS sample_ref
    FROM ops.store store
    INNER JOIN ops.region region ON region.region_id = store.region_id
    WHERE store.company_id IS DISTINCT FROM region.company_id

    UNION ALL

    SELECT
        'ORG-02',
        substr(md5(assignment.assignment_id::text), 1, 12)
    FROM ops.employee_assignment_history assignment
    INNER JOIN ops.store store ON store.store_id = assignment.store_id
    INNER JOIN ops.region region ON region.region_id = assignment.region_id
    INNER JOIN ops.employee employee ON employee.employee_id = assignment.employee_id
    INNER JOIN ops.position position ON position.position_id = assignment.position_id
    WHERE assignment.region_id IS DISTINCT FROM store.region_id
       OR region.company_id IS DISTINCT FROM store.company_id
       OR employee.company_id IS DISTINCT FROM store.company_id
       OR position.company_id IS DISTINCT FROM store.company_id

    UNION ALL

    SELECT
        'ORG-03',
        substr(md5(assignment.user_role_assignment_id::text), 1, 12)
    FROM ops.user_role_assignment assignment
    LEFT JOIN ops.region region ON region.region_id = assignment.region_id
    LEFT JOIN ops.store store ON store.store_id = assignment.store_id
    WHERE (assignment.region_id IS NOT NULL AND assignment.company_id IS DISTINCT FROM region.company_id)
       OR (assignment.store_id IS NOT NULL AND (
            assignment.company_id IS DISTINCT FROM store.company_id
            OR assignment.region_id IS DISTINCT FROM store.region_id
       ))

    UNION ALL

    SELECT
        'ORG-04',
        substr(md5(scope_violation.source_table || ':' || scope_violation.record_id), 1, 12)
    FROM (
        SELECT scope_row.source_table, scope_row.record_id
        FROM scope_rows scope_row
        LEFT JOIN ops.region region ON region.region_id = scope_row.region_id
        LEFT JOIN ops.store store ON store.store_id = scope_row.store_id
        WHERE (scope_row.region_id IS NOT NULL
                AND scope_row.company_id IS NOT NULL
                AND scope_row.company_id IS DISTINCT FROM region.company_id)
           OR (scope_row.store_id IS NOT NULL AND (
                (scope_row.company_id IS NOT NULL AND scope_row.company_id IS DISTINCT FROM store.company_id)
                OR (scope_row.region_id IS NOT NULL AND scope_row.region_id IS DISTINCT FROM store.region_id)
           ))

        UNION

        SELECT
            'stg.master_data_bootstrap_row',
            bootstrap_row.master_data_bootstrap_row_id::text
        FROM stg.master_data_bootstrap_row bootstrap_row
        INNER JOIN stg.master_data_bootstrap_batch bootstrap_batch
            ON bootstrap_batch.master_data_bootstrap_batch_id = bootstrap_row.master_data_bootstrap_batch_id
        WHERE bootstrap_row.resolved_company_id IS NOT NULL
          AND bootstrap_row.resolved_company_id IS DISTINCT FROM bootstrap_batch.company_id
    ) scope_violation

    UNION ALL

    SELECT
        'AUTH-01',
        substr(md5(assignment.user_role_assignment_id::text), 1, 12)
    FROM ops.user_role_assignment assignment
    WHERE assignment.scope_type NOT IN ('company', 'region', 'store')
       OR (assignment.scope_type = 'company' AND NOT (
            assignment.company_id IS NOT NULL
            AND assignment.region_id IS NULL
            AND assignment.store_id IS NULL
       ))
       OR (assignment.scope_type = 'region' AND NOT (
            assignment.company_id IS NOT NULL
            AND assignment.region_id IS NOT NULL
            AND assignment.store_id IS NULL
       ))
       OR (assignment.scope_type = 'store' AND NOT (
            assignment.company_id IS NOT NULL
            AND assignment.region_id IS NOT NULL
            AND assignment.store_id IS NOT NULL
       ))

    UNION ALL

    SELECT
        'AUTH-02',
        substr(md5(assignment.user_role_assignment_id::text), 1, 12)
    FROM ops.user_role_assignment assignment
    INNER JOIN ops.role role ON role.role_id = assignment.role_id
    WHERE role.role_scope_type IS DISTINCT FROM assignment.scope_type
      AND NOT (
          role.role_code = 'REGION_MANAGER'
          AND role.role_scope_type = 'region'
          AND assignment.scope_type = 'store'
      )

    UNION ALL

    SELECT
        'ASSIGN-01',
        substr(md5(left_assignment.assignment_id::text || ':' || right_assignment.assignment_id::text), 1, 12)
    FROM ops.employee_assignment_history left_assignment
    INNER JOIN ops.employee_assignment_history right_assignment
        ON right_assignment.employee_id = left_assignment.employee_id
       AND right_assignment.assignment_id::text > left_assignment.assignment_id::text
       AND daterange(
            left_assignment.start_date,
            COALESCE(left_assignment.end_date, 'infinity'::date),
            '[]'
       ) && daterange(
            right_assignment.start_date,
            COALESCE(right_assignment.end_date, 'infinity'::date),
            '[]'
       )
    WHERE left_assignment.is_primary_assignment = TRUE
      AND right_assignment.is_primary_assignment = TRUE
      AND left_assignment.assignment_status = 'active'
      AND right_assignment.assignment_status = 'active'

    UNION ALL

    SELECT
        'TARGET-01',
        substr(md5(request.target_distribution_request_id::text), 1, 12)
    FROM ops.target_distribution_request request
    WHERE jsonb_typeof(request.allocation_json) IS DISTINCT FROM 'array'

    UNION ALL

    SELECT
        'TARGET-02',
        substr(md5(request.target_distribution_request_id::text), 1, 12)
    FROM ops.target_distribution_request request
    WHERE CASE
        WHEN jsonb_typeof(request.allocation_json) = 'array'
            THEN request.allocation_count IS DISTINCT FROM jsonb_array_length(request.allocation_json)
        ELSE FALSE
    END

    UNION ALL

    SELECT
        'TARGET-03',
        substr(md5(duplicate.target_distribution_request_id::text || ':' || duplicate.employee_id), 1, 12)
    FROM target_duplicate_employees duplicate

    UNION ALL

    SELECT
        'KEY-01',
        substr(md5(duplicate_key.key_value), 1, 12)
    FROM (
        SELECT region_id::text || ':' || company_id::text AS key_value
        FROM ops.region
        GROUP BY region_id, company_id
        HAVING COUNT(*) > 1

        UNION ALL

        SELECT store_id::text || ':' || company_id::text || ':' || region_id::text
        FROM ops.store
        GROUP BY store_id, company_id, region_id
        HAVING COUNT(*) > 1
    ) duplicate_key
),
check_catalog(check_id, category) AS (
    VALUES
        ('ORG-01', 'organization'),
        ('ORG-02', 'organization'),
        ('ORG-03', 'organization'),
        ('ORG-04', 'organization'),
        ('AUTH-01', 'authorization'),
        ('AUTH-02', 'authorization'),
        ('ASSIGN-01', 'assignment'),
        ('TARGET-01', 'target'),
        ('TARGET-02', 'target'),
        ('TARGET-03', 'target'),
        ('KEY-01', 'candidate_key')
),
ranked_violations AS (
    SELECT
        violation.check_id,
        violation.sample_ref,
        row_number() OVER (
            PARTITION BY violation.check_id
            ORDER BY violation.sample_ref
        ) AS sample_rank
    FROM violations violation
),
violation_summary AS (
    SELECT
        violation.check_id,
        COUNT(*)::integer AS violation_count,
        COALESCE(
            jsonb_agg(violation.sample_ref ORDER BY violation.sample_ref)
                FILTER (WHERE violation.sample_rank <= 5),
            '[]'::jsonb
        ) AS sample_refs
    FROM ranked_violations violation
    GROUP BY violation.check_id
)
SELECT
    check_catalog.check_id,
    check_catalog.category,
    COALESCE(violation_summary.violation_count, 0) AS violation_count,
    COALESCE(violation_summary.sample_refs, '[]'::jsonb) AS sample_refs
FROM check_catalog
LEFT JOIN violation_summary USING (check_id)
ORDER BY check_catalog.check_id;
