-- Trace: FR-02..11; NFR-01..05; AC-01..05; EC-01..12.
-- One read-only statement classifies V2 authority roots. Raw keys never leave this statement.
WITH params AS (
    SELECT (transaction_timestamp() AT TIME ZONE 'UTC')::date AS observed_on
),
source_contract AS (
    SELECT 'assignment_rotation_lifecycle'::text AS code,
           CASE WHEN to_regclass('ops.assignment_rotation_lifecycle') IS NULL
             THEN 'absent' ELSE 'present' END::text AS state
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
generic_org04 AS (
    SELECT 'ORG-04'::text AS family,
           source_table || ':' || record_key AS record_key,
           source_table || ':' || record_key AS authority_unit_key,
           'org04.scope_hierarchy_mismatch'::text AS authority_reason,
           'authority.scope_hierarchy'::text AS authority_source
    FROM scope_evaluation
    WHERE source_table NOT IN ('ops.kpi_actual', 'ops.workforce_norm_plan')
      AND (company_region_mismatch OR company_store_mismatch OR region_store_mismatch OR bootstrap_company_mismatch)
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
org02_records AS (
    SELECT 'ORG-02'::text AS family,
           assignment_id::text AS record_key,
           assignment_id::text AS authority_unit_key,
           'org02.rotation_authority_source_absent'::text AS authority_reason,
           'authority.assignment_lifecycle_contract'::text AS authority_source
    FROM assignment_evaluation
    WHERE (NOT active_now AND NOT closed_history AND NOT future_assignment)
       OR (active_now AND region_id IS DISTINCT FROM store_region_id)
       OR region_company_id IS DISTINCT FROM store_company_id
       OR employee_company_id IS DISTINCT FROM store_company_id
       OR position_company_id IS DISTINCT FROM store_company_id
),
primary_overlap_records AS (
    SELECT 'ASSIGN-01'::text AS family,
           'pair:' || left_assignment.assignment_id::text || ':' || right_assignment.assignment_id::text AS record_key,
           left_assignment.employee_id::text AS authority_unit_key,
           'assign01.rotation_authority_source_absent'::text AS authority_reason,
           'authority.assignment_lifecycle_contract'::text AS authority_source
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
open_primary_records AS (
    SELECT 'ASSIGN-01'::text AS family,
           'employee:' || employee_id::text AS record_key,
           employee_id::text AS authority_unit_key,
           'assign01.rotation_authority_source_absent'::text AS authority_reason,
           'authority.assignment_lifecycle_contract'::text AS authority_source
    FROM open_assignment_counts
    WHERE open_assignment_count > 0 AND open_primary_count <> 1
),
manager_subjects AS (
    SELECT 'ops.kpi_actual'::text AS source_class,
           actual.kpi_actual_id::text AS record_key,
           actual.company_id,
           actual.region_id,
           actual.store_id,
           (date_trunc('month', actual.period_start) + INTERVAL '1 month - 1 day')::date AS authority_date,
           store.company_id AS store_company_id,
           region.company_id AS region_company_id
    FROM ops.kpi_actual actual
    INNER JOIN ops.store store ON store.store_id = actual.store_id
    INNER JOIN ops.region region ON region.region_id = actual.region_id
    WHERE actual.scope_type = 'store' AND actual.store_id IS NOT NULL AND actual.region_id IS NOT NULL
    UNION ALL
    SELECT 'ops.workforce_norm_plan', plan.norm_plan_id::text,
           plan.company_id, plan.region_id, plan.store_id,
           CASE WHEN plan.period_start > params.observed_on THEN plan.period_start ELSE params.observed_on END,
           store.company_id, region.company_id
    FROM ops.workforce_norm_plan plan
    CROSS JOIN params
    INNER JOIN ops.store store ON store.store_id = plan.store_id
    INNER JOIN ops.region region ON region.region_id = plan.region_id
    WHERE NOT (plan.period_end < params.observed_on)
      AND plan.store_id IS NOT NULL AND plan.region_id IS NOT NULL
),
manager_role_rows AS (
    SELECT assignment.*
    FROM ops.user_role_assignment assignment
    INNER JOIN ops.role role ON role.role_id = assignment.role_id
    WHERE role.role_code = 'REGION_MANAGER'
),
manager_candidates AS (
    SELECT subject.source_class, subject.record_key, assignment.user_role_assignment_id,
           assignment.user_id, assignment.scope_type, assignment.region_id
    FROM manager_subjects subject
    INNER JOIN manager_role_rows assignment
      ON assignment.company_id IS NOT DISTINCT FROM subject.company_id
     AND assignment.region_id IS NOT NULL
     AND assignment.start_at::date <= subject.authority_date
     AND (assignment.end_at IS NULL OR assignment.end_at::date >= subject.authority_date)
     AND (
       (assignment.scope_type = 'store' AND assignment.store_id = subject.store_id)
       OR (
         assignment.scope_type = 'region'
         AND EXISTS (
           SELECT 1
           FROM ops.user_action_store_assignment action_store
           WHERE action_store.user_id = assignment.user_id
             AND action_store.store_id = subject.store_id
             AND action_store.start_at::date <= subject.authority_date
             AND (action_store.end_at IS NULL OR action_store.end_at::date >= subject.authority_date)
         )
       )
     )
),
manager_candidate_stats AS (
    SELECT subject.source_class, subject.record_key,
           COUNT(candidate.user_role_assignment_id)::integer AS candidate_row_count,
           COUNT(DISTINCT candidate.user_id)::integer AS candidate_user_count,
           COUNT(DISTINCT candidate.scope_type)::integer AS candidate_scope_count,
           MIN(candidate.region_id::text)::uuid AS expected_region_id
    FROM manager_subjects subject
    LEFT JOIN manager_candidates candidate
      ON candidate.source_class = subject.source_class AND candidate.record_key = subject.record_key
    GROUP BY subject.source_class, subject.record_key
),
manager_coverage_stats AS (
    SELECT subject.source_class, subject.record_key,
           COUNT(role_row.user_role_assignment_id) FILTER (
             WHERE (role_row.scope_type = 'store' AND role_row.store_id = subject.store_id)
                OR (
                  role_row.scope_type = 'region'
                  AND (
                    role_row.region_id = subject.region_id
                    OR EXISTS (
                      SELECT 1 FROM ops.user_action_store_assignment action_store
                      WHERE action_store.user_id = role_row.user_id
                        AND action_store.store_id = subject.store_id
                    )
                  )
                )
           )::integer AS ever_relevant_role_count,
           COUNT(role_row.user_role_assignment_id) FILTER (
             WHERE role_row.start_at::date <= subject.authority_date
               AND (role_row.end_at IS NULL OR role_row.end_at::date >= subject.authority_date)
               AND (
                 (role_row.scope_type = 'store' AND role_row.store_id = subject.store_id)
                 OR (
                   role_row.scope_type = 'region'
                   AND (
                     role_row.region_id = subject.region_id
                     OR EXISTS (
                       SELECT 1 FROM ops.user_action_store_assignment action_store
                       WHERE action_store.user_id = role_row.user_id
                         AND action_store.store_id = subject.store_id
                     )
                   )
                 )
               )
           )::integer AS effective_relevant_role_count
    FROM manager_subjects subject
    LEFT JOIN manager_role_rows role_row
      ON role_row.company_id IS NOT DISTINCT FROM subject.company_id
     AND role_row.region_id IS NOT NULL
    GROUP BY subject.source_class, subject.record_key
),
manager_classification AS (
    SELECT 'ORG-04'::text AS family,
           subject.source_class || ':' || subject.record_key AS record_key,
           subject.source_class || ':' || subject.store_id::text || ':' || subject.authority_date::text
             AS authority_unit_key,
           CASE
             WHEN subject.company_id IS DISTINCT FROM subject.region_company_id
               OR subject.company_id IS DISTINCT FROM subject.store_company_id
               THEN 'org04.scope_hierarchy_mismatch'
             WHEN candidate.candidate_row_count = 0 AND coverage.ever_relevant_role_count = 0
               THEN 'org04.role_assignment_never_configured'
             WHEN candidate.candidate_row_count = 0 AND coverage.effective_relevant_role_count = 0
               THEN 'org04.role_assignment_not_effective'
             WHEN candidate.candidate_row_count = 0
               THEN 'org04.region_portfolio_not_effective'
             WHEN candidate.candidate_row_count > 1 AND candidate.candidate_user_count = 1
               THEN 'org04.duplicate_rows_same_manager'
             WHEN candidate.candidate_user_count > 1 AND candidate.candidate_scope_count > 1
               THEN 'org04.mixed_scope_multiple_managers'
             WHEN candidate.candidate_user_count > 1
               THEN 'org04.multiple_distinct_managers'
             WHEN candidate.candidate_row_count = 1
               AND subject.region_id IS DISTINCT FROM candidate.expected_region_id
               THEN 'org04.unique_manager_region_mismatch'
             ELSE NULL
           END::text AS authority_reason,
           CASE
             WHEN subject.company_id IS DISTINCT FROM subject.region_company_id
               OR subject.company_id IS DISTINCT FROM subject.store_company_id
               THEN 'authority.scope_hierarchy'
             WHEN candidate.candidate_row_count = 0
               AND coverage.ever_relevant_role_count > 0
               AND coverage.effective_relevant_role_count > 0
               THEN 'authority.action_store_portfolio'
             ELSE 'authority.rbac_role_assignment'
           END::text AS authority_source,
           candidate.candidate_row_count,
           candidate.expected_region_id
    FROM manager_subjects subject
    INNER JOIN manager_candidate_stats candidate
      ON candidate.source_class = subject.source_class AND candidate.record_key = subject.record_key
    INNER JOIN manager_coverage_stats coverage
      ON coverage.source_class = subject.source_class AND coverage.record_key = subject.record_key
    WHERE subject.company_id IS DISTINCT FROM subject.region_company_id
       OR subject.company_id IS DISTINCT FROM subject.store_company_id
       OR candidate.candidate_row_count <> 1
       OR subject.region_id IS DISTINCT FROM candidate.expected_region_id
),
classified_records AS (
    SELECT family, record_key, authority_unit_key, authority_reason, authority_source FROM generic_org04
    UNION ALL SELECT family, record_key, authority_unit_key, authority_reason, authority_source FROM manager_classification
    UNION ALL SELECT family, record_key, authority_unit_key, authority_reason, authority_source FROM org02_records
    UNION ALL SELECT family, record_key, authority_unit_key, authority_reason, authority_source FROM primary_overlap_records
    UNION ALL SELECT family, record_key, authority_unit_key, authority_reason, authority_source FROM open_primary_records
),
ranked_authority_refs AS (
    SELECT record.family, record.authority_reason, record.authority_source,
           substr(md5(record.family || ':' || record.authority_unit_key), 1, 12) AS authority_ref,
           row_number() OVER (
             PARTITION BY record.family, record.authority_reason, record.authority_source
             ORDER BY substr(md5(record.family || ':' || record.authority_unit_key), 1, 12)
           ) AS sample_rank
    FROM (SELECT DISTINCT family, authority_reason, authority_source, authority_unit_key FROM classified_records) record
),
bucket_rows AS (
    SELECT record.family, record.authority_reason, record.authority_source,
           COUNT(DISTINCT record.record_key)::integer AS check_hit_count,
           COUNT(DISTINCT record.authority_unit_key)::integer AS authority_unit_count,
           COALESCE((
             SELECT jsonb_agg(ref.authority_ref ORDER BY ref.authority_ref)
             FROM ranked_authority_refs ref
             WHERE ref.family = record.family
               AND ref.authority_reason IS NOT DISTINCT FROM record.authority_reason
               AND ref.authority_source = record.authority_source
               AND ref.sample_rank <= 5
           ), '[]'::jsonb) AS sample_authority_refs
    FROM classified_records record
    GROUP BY record.family, record.authority_reason, record.authority_source
),
family_catalog(family) AS (VALUES ('ASSIGN-01'::text), ('ORG-02'::text), ('ORG-04'::text)),
family_totals AS (
    SELECT catalog.family,
           COALESCE(SUM(bucket.authority_unit_count), 0)::integer AS authority_unit_count,
           COALESCE(SUM(bucket.check_hit_count), 0)::integer AS check_hit_count
    FROM family_catalog catalog
    LEFT JOIN bucket_rows bucket ON bucket.family = catalog.family
    GROUP BY catalog.family
),
document AS (
    SELECT
      COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'authorityUnitCount', bucket.authority_unit_count,
        'checkHitCount', bucket.check_hit_count,
        'family', bucket.family,
        'reason', bucket.authority_reason,
        'sampleAuthorityRefs', bucket.sample_authority_refs,
        'source', bucket.authority_source,
        'units', jsonb_build_object('authority', 'authority_units', 'findings', 'check_hits')
      ) ORDER BY bucket.family, bucket.authority_reason, bucket.authority_source) FROM bucket_rows bucket), '[]'::jsonb) AS buckets,
      (SELECT jsonb_agg(jsonb_build_object(
        'authorityUnitCount', total.authority_unit_count,
        'checkHitCount', total.check_hit_count,
        'family', total.family
      ) ORDER BY total.family) FROM family_totals total) AS family_totals,
      jsonb_build_object(
        'authorityUnitCount', (SELECT COALESCE(SUM(authority_unit_count), 0)::integer FROM family_totals),
        'checkHitCount', (SELECT COALESCE(SUM(check_hit_count), 0)::integer FROM family_totals)
      ) AS overall,
      (SELECT jsonb_agg(jsonb_build_object('code', contract.code, 'state', contract.state)) FROM source_contract contract)
        AS source_contracts
)
SELECT jsonb_build_object(
  'buckets', document.buckets,
  'familyTotals', document.family_totals,
  'observedAt', to_jsonb(transaction_timestamp()),
  'overall', document.overall,
  'querySetVersion', 'staging-remediation-row-authority-classifier-v1',
  'sourceContracts', document.source_contracts
) AS authority_classifier
FROM document;
