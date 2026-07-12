-- Trace: FR-SCOPE-01, FR-DEC-08; NFR-02..04; AC-04, AC-05, AC-11; EC-01, EC-04, EC-05, EC-08.
-- One read-only statement owns both active V2 counts and the exact V1-to-V2 record bridge.
WITH params AS (
    SELECT (transaction_timestamp() AT TIME ZONE 'UTC')::date AS observed_on
),
scope_rows AS (
    SELECT 'ops.seller_code_request'::text AS source_table, seller_code_request_id::text AS record_key,
           company_id, region_id, store_id, NULL::uuid AS resolved_company_id, NULL::uuid AS batch_company_id
    FROM ops.seller_code_request
    UNION ALL SELECT 'ops.employee_offboarding_request', offboarding_request_id::text,
           company_id, region_id, store_id, NULL::uuid, NULL::uuid FROM ops.employee_offboarding_request
    UNION ALL SELECT 'ops.target_distribution_request', target_distribution_request_id::text,
           company_id, region_id, store_id, NULL::uuid, NULL::uuid FROM ops.target_distribution_request
    UNION ALL SELECT 'ops.personnel_target_reference', personnel_target_reference_id::text,
           company_id, region_id, store_id, NULL::uuid, NULL::uuid FROM ops.personnel_target_reference
    UNION ALL SELECT 'ops.kpi_target', kpi_target_id::text,
           company_id, region_id, store_id, NULL::uuid, NULL::uuid FROM ops.kpi_target
    UNION ALL SELECT 'ops.kpi_actual', kpi_actual_id::text,
           company_id, region_id, store_id, NULL::uuid, NULL::uuid FROM ops.kpi_actual
    UNION ALL SELECT 'ops.workforce_norm_plan', norm_plan_id::text,
           company_id, region_id, store_id, NULL::uuid, NULL::uuid FROM ops.workforce_norm_plan
    UNION ALL SELECT 'ops.turnover_event', turnover_event_id::text,
           company_id, region_id, store_id, NULL::uuid, NULL::uuid FROM ops.turnover_event
    UNION ALL SELECT 'ops.store_action_plan', store_action_plan_id::text,
           company_id, region_id, store_id, NULL::uuid, NULL::uuid FROM ops.store_action_plan
    UNION ALL SELECT 'ops.sales_target_incentive_projection', sales_target_incentive_projection_id::text,
           company_id, region_id, store_id, NULL::uuid, NULL::uuid FROM ops.sales_target_incentive_projection
    UNION ALL SELECT 'ops.sales_target_incentive_adjustment', sales_target_incentive_adjustment_id::text,
           company_id, region_id, store_id, NULL::uuid, NULL::uuid FROM ops.sales_target_incentive_adjustment
    UNION ALL SELECT 'ops.sales_target_incentive_store_review', sales_target_incentive_store_review_id::text,
           company_id, region_id, store_id, NULL::uuid, NULL::uuid FROM ops.sales_target_incentive_store_review
    UNION ALL SELECT 'ops.sales_target_incentive_region_package', sales_target_incentive_region_package_id::text,
           company_id, region_id, NULL::uuid, NULL::uuid, NULL::uuid FROM ops.sales_target_incentive_region_package
    UNION ALL SELECT 'ops.sales_target_incentive_region_package_store', sales_target_incentive_region_package_store_id::text,
           company_id, region_id, store_id, NULL::uuid, NULL::uuid FROM ops.sales_target_incentive_region_package_store
    UNION ALL SELECT 'ops.sales_target_incentive_region_correction', sales_target_incentive_region_correction_id::text,
           company_id, region_id, store_id, NULL::uuid, NULL::uuid FROM ops.sales_target_incentive_region_correction
    UNION ALL SELECT 'rpt.sales_target_incentive_assignment_snapshot', sales_target_incentive_assignment_snapshot_id::text,
           company_id, region_id, store_id, NULL::uuid, NULL::uuid FROM rpt.sales_target_incentive_assignment_snapshot
    UNION ALL SELECT 'rpt.sales_target_incentive_final_snapshot', sales_target_incentive_final_snapshot_id::text,
           company_id, region_id, store_id, NULL::uuid, NULL::uuid FROM rpt.sales_target_incentive_final_snapshot
    UNION ALL SELECT 'rpt.turnover_snapshot',
           concat_ws(':', snapshot_run_id::text, scope_type, company_id::text, region_id::text, store_id::text),
           company_id, region_id, store_id, NULL::uuid, NULL::uuid FROM rpt.turnover_snapshot
    UNION ALL SELECT 'stg.master_data_bootstrap_row', row.master_data_bootstrap_row_id::text,
           batch.company_id, row.resolved_region_id, row.resolved_store_id,
           row.resolved_company_id, batch.company_id
    FROM stg.master_data_bootstrap_row row
    INNER JOIN stg.master_data_bootstrap_batch batch
      ON batch.master_data_bootstrap_batch_id = row.master_data_bootstrap_batch_id
    UNION ALL SELECT 'audit.event_log', event_log_id::text,
           company_id, region_id, store_id, NULL::uuid, NULL::uuid FROM audit.event_log
),
scope_evaluation AS (
    SELECT row.*,
           row.company_id IS NOT NULL AND row.region_id IS NOT NULL
             AND row.company_id IS DISTINCT FROM region.company_id AS company_region_mismatch,
           row.company_id IS NOT NULL AND row.store_id IS NOT NULL
             AND row.company_id IS DISTINCT FROM store.company_id AS company_store_mismatch,
           row.region_id IS NOT NULL AND row.store_id IS NOT NULL
             AND row.region_id IS DISTINCT FROM store.region_id AS region_store_mismatch,
           row.source_table = 'stg.master_data_bootstrap_row'
             AND row.resolved_company_id IS NOT NULL
             AND row.resolved_company_id IS DISTINCT FROM row.batch_company_id AS bootstrap_company_mismatch
    FROM scope_rows row
    LEFT JOIN ops.region region ON region.region_id = row.region_id
    LEFT JOIN ops.store store ON store.store_id = row.store_id
),
v1_target_records AS (
    SELECT 'TARGET-02'::text AS family, request.target_distribution_request_id::text AS record_key
    FROM ops.target_distribution_request request
    WHERE CASE
      WHEN jsonb_typeof(request.allocation_json) = 'array'
        THEN request.allocation_count IS DISTINCT FROM jsonb_array_length(request.allocation_json)
      ELSE FALSE
    END
),
target_reference_stats AS (
    SELECT request.target_distribution_request_id,
           COUNT(reference.personnel_target_reference_id)
             FILTER (WHERE reference.status = 'approved')::integer AS approved_reference_count,
           COUNT(reference.personnel_target_reference_id)
             FILTER (WHERE reference.status = 'approved')
             - COUNT(DISTINCT ROW(reference.employee_id, reference.period_start, reference.period_end, reference.target_type))
             FILTER (WHERE reference.status = 'approved') AS approved_reference_duplicate_count
    FROM ops.target_distribution_request request
    LEFT JOIN ops.personnel_target_reference reference
      ON reference.source_request_id = request.target_distribution_request_id
    GROUP BY request.target_distribution_request_id
),
v2_target_records AS (
    SELECT
      'TARGET-02'::text AS family,
      request.target_distribution_request_id::text AS record_key,
      CASE WHEN request.target_label = 'pilot_imported_personnel_targets'
        THEN 'target.pilot_count_matches_approved_references'
        ELSE 'target.ordinary_count_matches_json' END::text AS invariant,
      CASE
        WHEN request.target_label = 'pilot_imported_personnel_targets'
             AND stats.approved_reference_duplicate_count > 0
          THEN 'target.pilot_approved_reference_duplicate'
        WHEN request.target_label = 'pilot_imported_personnel_targets'
          THEN 'target.pilot_count_approved_reference_mismatch'
        ELSE 'target.ordinary_count_json_mismatch'
      END::text AS reason,
      CASE WHEN request.target_label = 'pilot_imported_personnel_targets'
        THEN 'ops.personnel_target_reference'
        ELSE 'ops.target_distribution_request' END::text AS source_table
    FROM ops.target_distribution_request request
    INNER JOIN target_reference_stats stats
      ON stats.target_distribution_request_id = request.target_distribution_request_id
    WHERE (
      request.target_label = 'pilot_imported_personnel_targets'
      AND (
        request.allocation_count IS DISTINCT FROM stats.approved_reference_count
        OR stats.approved_reference_duplicate_count > 0
      )
    ) OR (
      request.target_label IS DISTINCT FROM 'pilot_imported_personnel_targets'
      AND CASE
        WHEN jsonb_typeof(request.allocation_json) = 'array'
          THEN request.allocation_count IS DISTINCT FROM jsonb_array_length(request.allocation_json)
        ELSE FALSE
      END
    )
),
assignment_evaluation AS (
    SELECT assignment.*, store.region_id AS store_region_id, store.company_id AS store_company_id,
           region.company_id AS region_company_id, employee.company_id AS employee_company_id,
           position.company_id AS position_company_id, params.observed_on,
           assignment.assignment_status = 'active'
             AND assignment.start_date <= params.observed_on
             AND (assignment.end_date IS NULL OR assignment.end_date >= params.observed_on) AS active_now,
           assignment.end_date IS NOT NULL AND assignment.end_date < params.observed_on AS closed_history,
           assignment.start_date > params.observed_on AS future_assignment
    FROM ops.employee_assignment_history assignment
    CROSS JOIN params
    INNER JOIN ops.store store ON store.store_id = assignment.store_id
    INNER JOIN ops.region region ON region.region_id = assignment.region_id
    INNER JOIN ops.employee employee ON employee.employee_id = assignment.employee_id
    INNER JOIN ops.position position ON position.position_id = assignment.position_id
),
v1_org02_records AS (
    SELECT 'ORG-02'::text AS family, assignment_id::text AS record_key
    FROM assignment_evaluation
    WHERE region_id IS DISTINCT FROM store_region_id
       OR region_company_id IS DISTINCT FROM store_company_id
       OR employee_company_id IS DISTINCT FROM store_company_id
       OR position_company_id IS DISTINCT FROM store_company_id
),
v2_org02_records AS (
    SELECT 'ORG-02'::text AS family, assignment_id::text AS record_key,
           'assignment.lifecycle_region'::text AS invariant,
           CASE
             WHEN NOT active_now AND NOT closed_history AND NOT future_assignment
               THEN 'assignment.active_lifecycle_invalid'
             WHEN active_now AND region_id IS DISTINCT FROM store_region_id
               THEN 'assignment.active_region_store_mismatch'
             WHEN region_company_id IS DISTINCT FROM store_company_id
               THEN 'assignment.region_company_store_company'
             WHEN employee_company_id IS DISTINCT FROM store_company_id
               THEN 'assignment.employee_company_store_company'
             ELSE 'assignment.position_company_store_company'
           END::text AS reason,
           'ops.employee_assignment_history'::text AS source_table
    FROM assignment_evaluation
    WHERE (NOT active_now AND NOT closed_history AND NOT future_assignment)
       OR (active_now AND region_id IS DISTINCT FROM store_region_id)
       OR region_company_id IS DISTINCT FROM store_company_id
       OR employee_company_id IS DISTINCT FROM store_company_id
       OR position_company_id IS DISTINCT FROM store_company_id
),
v1_org04_records AS (
    SELECT 'ORG-04'::text AS family, source_table || ':' || record_key AS record_key
    FROM scope_evaluation
    WHERE company_region_mismatch OR company_store_mismatch OR region_store_mismatch OR bootstrap_company_mismatch
),
generic_v2_org04_records AS (
    SELECT 'ORG-04'::text AS family, source_table || ':' || record_key AS record_key,
           'org.scope_hierarchy'::text AS invariant,
           CASE
             WHEN bootstrap_company_mismatch THEN 'org.bootstrap_resolved_company_batch_company'
             WHEN company_region_mismatch THEN 'org.scope_company_region'
             WHEN company_store_mismatch THEN 'org.scope_company_store'
             ELSE 'org.scope_region_store'
           END::text AS reason,
           source_table
    FROM scope_evaluation
    WHERE source_table NOT IN ('ops.kpi_actual', 'ops.workforce_norm_plan')
      AND (company_region_mismatch OR company_store_mismatch OR region_store_mismatch OR bootstrap_company_mismatch)
),
kpi_basis AS (
    SELECT actual.*,
           (date_trunc('month', actual.period_start) + INTERVAL '1 month - 1 day')::date AS authority_date
    FROM ops.kpi_actual actual
),
kpi_manager_stats AS (
    SELECT actual.kpi_actual_id, actual.company_id, actual.region_id, actual.store_id, actual.period_end,
           store.company_id AS store_company_id, region.company_id AS region_company_id,
           COUNT(assignment.user_role_assignment_id)
             FILTER (WHERE assignment.user_id IS NOT NULL)::integer AS candidate_count,
           MIN(assignment.region_id::text)::uuid AS expected_region_id
    FROM kpi_basis actual
    INNER JOIN ops.store store ON store.store_id = actual.store_id
    INNER JOIN ops.region region ON region.region_id = actual.region_id
    LEFT JOIN ops.user_role_assignment assignment
      INNER JOIN ops.role role ON role.role_id = assignment.role_id
        AND role.role_code = 'REGION_MANAGER'
      ON assignment.company_id IS NOT DISTINCT FROM actual.company_id
     AND assignment.region_id IS NOT NULL
     AND assignment.start_at::date <= actual.authority_date
     AND (assignment.end_at IS NULL OR assignment.end_at::date >= actual.authority_date)
     AND (
       (assignment.scope_type = 'store' AND assignment.store_id = actual.store_id)
       OR (
         assignment.scope_type = 'region'
         AND EXISTS (
           SELECT 1
           FROM ops.user_action_store_assignment action_store
           WHERE action_store.user_id = assignment.user_id
             AND action_store.store_id = actual.store_id
             AND action_store.start_at::date <= actual.authority_date
             AND (action_store.end_at IS NULL OR action_store.end_at::date >= actual.authority_date)
         )
       )
     )
    WHERE actual.scope_type = 'store' AND actual.store_id IS NOT NULL AND actual.region_id IS NOT NULL
    GROUP BY actual.kpi_actual_id, actual.company_id, actual.region_id, actual.store_id,
             actual.period_end, store.company_id, region.company_id
),
kpi_v2_org04_records AS (
    SELECT 'ORG-04'::text AS family, 'ops.kpi_actual:' || kpi_actual_id::text AS record_key,
           'org.kpi_period_end_manager'::text AS invariant,
           CASE
             WHEN company_id IS DISTINCT FROM region_company_id THEN 'org.scope_company_region'
             WHEN company_id IS DISTINCT FROM store_company_id THEN 'org.scope_company_store'
             WHEN candidate_count = 0 THEN 'kpi.period_end_manager_missing'
             WHEN candidate_count > 1 THEN 'kpi.period_end_manager_ambiguous'
             ELSE 'kpi.region_period_end_manager_mismatch'
           END::text AS reason,
           'ops.kpi_actual'::text AS source_table
    FROM kpi_manager_stats
    WHERE company_id IS DISTINCT FROM region_company_id
       OR company_id IS DISTINCT FROM store_company_id
       OR candidate_count <> 1
       OR region_id IS DISTINCT FROM expected_region_id
),
norm_basis AS (
    SELECT plan.*, params.observed_on,
           CASE WHEN plan.period_start > params.observed_on THEN plan.period_start ELSE params.observed_on END AS authority_date,
           CASE WHEN plan.period_start > params.observed_on THEN 'future' ELSE 'active' END AS lifecycle_phase
    FROM ops.workforce_norm_plan plan
    CROSS JOIN params
    WHERE NOT (plan.period_end < params.observed_on)
),
norm_manager_stats AS (
    SELECT plan.norm_plan_id, plan.company_id, plan.region_id, plan.store_id, plan.lifecycle_phase,
           store.company_id AS store_company_id, region.company_id AS region_company_id,
           COUNT(assignment.user_role_assignment_id)
             FILTER (WHERE assignment.user_id IS NOT NULL)::integer AS candidate_count,
           MIN(assignment.region_id::text)::uuid AS expected_region_id
    FROM norm_basis plan
    INNER JOIN ops.store store ON store.store_id = plan.store_id
    INNER JOIN ops.region region ON region.region_id = plan.region_id
    LEFT JOIN ops.user_role_assignment assignment
      INNER JOIN ops.role role ON role.role_id = assignment.role_id
        AND role.role_code = 'REGION_MANAGER'
      ON assignment.company_id IS NOT DISTINCT FROM plan.company_id
     AND assignment.region_id IS NOT NULL
     AND assignment.start_at::date <= plan.authority_date
     AND (assignment.end_at IS NULL OR assignment.end_at::date >= plan.authority_date)
     AND (
       (assignment.scope_type = 'store' AND assignment.store_id = plan.store_id)
       OR (
         assignment.scope_type = 'region'
         AND EXISTS (
           SELECT 1 FROM ops.user_action_store_assignment action_store
           WHERE action_store.user_id = assignment.user_id
             AND action_store.store_id = plan.store_id
             AND action_store.start_at::date <= plan.authority_date
             AND (action_store.end_at IS NULL OR action_store.end_at::date >= plan.authority_date)
         )
       )
     )
    WHERE plan.store_id IS NOT NULL AND plan.region_id IS NOT NULL
    GROUP BY plan.norm_plan_id, plan.company_id, plan.region_id, plan.store_id,
             plan.lifecycle_phase, store.company_id, region.company_id
),
norm_v2_org04_records AS (
    SELECT 'ORG-04'::text AS family, 'ops.workforce_norm_plan:' || norm_plan_id::text AS record_key,
           'norm.lifecycle_manager'::text AS invariant,
           CASE
             WHEN company_id IS DISTINCT FROM region_company_id THEN 'org.scope_company_region'
             WHEN company_id IS DISTINCT FROM store_company_id THEN 'org.scope_company_store'
             WHEN lifecycle_phase = 'active' AND candidate_count = 0 THEN 'norm.active_manager_missing'
             WHEN lifecycle_phase = 'active' AND candidate_count > 1 THEN 'norm.active_manager_ambiguous'
             WHEN lifecycle_phase = 'active' THEN 'norm.active_region_manager_mismatch'
             WHEN candidate_count = 0 THEN 'norm.future_manager_missing'
             WHEN candidate_count > 1 THEN 'norm.future_manager_ambiguous'
             ELSE 'norm.future_region_manager_mismatch'
           END::text AS reason,
           'ops.workforce_norm_plan'::text AS source_table
    FROM norm_manager_stats
    WHERE company_id IS DISTINCT FROM region_company_id
       OR company_id IS DISTINCT FROM store_company_id
       OR candidate_count <> 1
       OR region_id IS DISTINCT FROM expected_region_id
),
v1_assignment_records AS (
    SELECT 'ASSIGN-01'::text AS family,
           'pair:' || left_assignment.assignment_id::text || ':' || right_assignment.assignment_id::text AS record_key
    FROM ops.employee_assignment_history left_assignment
    INNER JOIN ops.employee_assignment_history right_assignment
      ON right_assignment.employee_id = left_assignment.employee_id
     AND right_assignment.assignment_id::text > left_assignment.assignment_id::text
     AND daterange(left_assignment.start_date, COALESCE(left_assignment.end_date, 'infinity'::date), '[]')
         && daterange(right_assignment.start_date, COALESCE(right_assignment.end_date, 'infinity'::date), '[]')
    WHERE left_assignment.is_primary_assignment = TRUE
      AND right_assignment.is_primary_assignment = TRUE
      AND left_assignment.assignment_status = 'active'
      AND right_assignment.assignment_status = 'active'
),
v2_primary_overlap_records AS (
    SELECT 'ASSIGN-01'::text AS family,
           'pair:' || left_assignment.assignment_id::text || ':' || right_assignment.assignment_id::text AS record_key,
           'assignment.primary_ranges_non_overlapping'::text AS invariant,
           CASE WHEN GREATEST(left_assignment.start_date, right_assignment.start_date)
                    = LEAST(COALESCE(left_assignment.end_date, 'infinity'::date),
                            COALESCE(right_assignment.end_date, 'infinity'::date))
             THEN 'assignment.primary_same_day_handoff'
             ELSE 'assignment.primary_strict_overlap' END::text AS reason,
           'ops.employee_assignment_history'::text AS source_table
    FROM ops.employee_assignment_history left_assignment
    INNER JOIN ops.employee_assignment_history right_assignment
      ON right_assignment.employee_id = left_assignment.employee_id
     AND right_assignment.assignment_id::text > left_assignment.assignment_id::text
     AND daterange(left_assignment.start_date, COALESCE(left_assignment.end_date, 'infinity'::date), '[]')
         && daterange(right_assignment.start_date, COALESCE(right_assignment.end_date, 'infinity'::date), '[]')
    WHERE left_assignment.is_primary_assignment = TRUE
      AND right_assignment.is_primary_assignment = TRUE
      AND left_assignment.assignment_status = 'active'
      AND right_assignment.assignment_status = 'active'
),
open_assignment_counts AS (
    SELECT assignment.employee_id,
           COUNT(*)::integer AS open_assignment_count,
           COUNT(*) FILTER (WHERE assignment.is_primary_assignment)::integer AS open_primary_count
    FROM ops.employee_assignment_history assignment
    CROSS JOIN params
    WHERE assignment.assignment_status = 'active'
      AND assignment.start_date <= params.observed_on
      AND assignment.end_date IS NULL
    GROUP BY assignment.employee_id
),
v2_open_primary_records AS (
    SELECT 'ASSIGN-01'::text AS family, 'employee:' || employee_id::text AS record_key,
           'assignment.exactly_one_open_primary'::text AS invariant,
           CASE WHEN open_primary_count = 0 THEN 'assignment.open_primary_missing'
             ELSE 'assignment.open_primary_multiple' END::text AS reason,
           'ops.employee_assignment_history'::text AS source_table
    FROM open_assignment_counts
    WHERE open_assignment_count > 0 AND open_primary_count <> 1
),
v1_records AS (
    SELECT * FROM v1_target_records
    UNION ALL SELECT * FROM v1_org02_records
    UNION ALL SELECT * FROM v1_org04_records
    UNION ALL SELECT * FROM v1_assignment_records
),
v2_records AS (
    SELECT * FROM v2_target_records
    UNION ALL SELECT * FROM v2_org02_records
    UNION ALL SELECT * FROM generic_v2_org04_records
    UNION ALL SELECT * FROM kpi_v2_org04_records
    UNION ALL SELECT * FROM norm_v2_org04_records
    UNION ALL SELECT * FROM v2_primary_overlap_records
    UNION ALL SELECT * FROM v2_open_primary_records
),
ranked_v2_records AS (
    SELECT record.*,
           substr(md5(record.family || ':' || record.record_key), 1, 12) AS sample_ref,
           row_number() OVER (
             PARTITION BY record.family, record.invariant, record.reason, record.source_table
             ORDER BY substr(md5(record.family || ':' || record.record_key), 1, 12)
           ) AS sample_rank
    FROM v2_records record
),
hit_groups AS (
    SELECT family, invariant, reason, source_table, COUNT(*)::integer AS hit_count,
           jsonb_agg(sample_ref ORDER BY sample_ref) FILTER (WHERE sample_rank <= 5) AS sample_refs
    FROM ranked_v2_records
    GROUP BY family, invariant, reason, source_table
),
family_catalog(family) AS (
    VALUES ('ASSIGN-01'), ('ORG-02'), ('ORG-04'), ('TARGET-02')
),
family_totals AS (
    SELECT catalog.family, COUNT(record.record_key)::integer AS hit_count
    FROM family_catalog catalog
    LEFT JOIN v2_records record ON record.family = catalog.family
    GROUP BY catalog.family
),
bridge_rows AS (
    SELECT catalog.family,
      (SELECT COUNT(*)::integer FROM v1_records record WHERE record.family = catalog.family) AS v1_hit_count,
      (SELECT COUNT(*)::integer FROM v2_records record WHERE record.family = catalog.family) AS v2_hit_count,
      (SELECT COUNT(*)::integer FROM v1_records v1
       WHERE v1.family = catalog.family
         AND EXISTS (SELECT 1 FROM v2_records v2 WHERE v2.family = v1.family AND v2.record_key = v1.record_key))
        AS carried_forward_count,
      (SELECT COUNT(*)::integer FROM v1_records v1
       WHERE v1.family = catalog.family
         AND NOT EXISTS (SELECT 1 FROM v2_records v2 WHERE v2.family = v1.family AND v2.record_key = v1.record_key))
        AS revised_valid_count,
      (SELECT COUNT(*)::integer FROM v2_records v2
       WHERE v2.family = catalog.family
         AND NOT EXISTS (SELECT 1 FROM v1_records v1 WHERE v1.family = v2.family AND v1.record_key = v2.record_key))
        AS v2_new_count
    FROM family_catalog catalog
),
document AS (
    SELECT
      COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'count', hit.hit_count,
        'invariant', hit.invariant,
        'reason', hit.reason,
        'sampleRefs', COALESCE(hit.sample_refs, '[]'::jsonb),
        'sourceTable', hit.source_table,
        'unit', 'check_hits'
      ) ORDER BY hit.family, hit.invariant, hit.reason, hit.source_table) FROM hit_groups hit), '[]'::jsonb) AS hits,
      (SELECT jsonb_agg(jsonb_build_object(
        'family', total.family, 'hitCount', total.hit_count, 'unit', 'check_hits'
      ) ORDER BY total.family) FROM family_totals total) AS family_totals,
      (SELECT jsonb_agg(jsonb_build_object(
        'carriedForwardCount', bridge.carried_forward_count,
        'family', bridge.family,
        'revisedValidCount', bridge.revised_valid_count,
        'unit', 'check_hits',
        'v1HitCount', bridge.v1_hit_count,
        'v2HitCount', bridge.v2_hit_count,
        'v2NewCount', bridge.v2_new_count
      ) ORDER BY bridge.family) FROM bridge_rows bridge) AS bridge,
      COALESCE((SELECT SUM(hit_count) FROM family_totals), 0)::integer AS overall_check_hits
)
SELECT jsonb_build_object(
  'bridge', document.bridge,
  'familyTotals', document.family_totals,
  'hits', document.hits,
  'observedAt', to_char(transaction_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'overallCheckHits', jsonb_build_object('count', document.overall_check_hits, 'unit', 'check_hits'),
  'querySetVersion', 'staging-remediation-invariant-v2'
) AS invariant
FROM document;
