-- Trace: FR-DIAG-01..07, FR-DIAG-11; NFR-02..04; AC-01, AC-02; EC-01..08.
WITH scope_rows AS (
    SELECT 'ops.seller_code_request'::text AS source_table, seller_code_request_id::text AS record_id,
           company_id, region_id, store_id, NULL::uuid AS resolved_company_id, NULL::uuid AS batch_company_id
    FROM ops.seller_code_request
    UNION ALL SELECT 'ops.employee_offboarding_request', offboarding_request_id::text,
           company_id, region_id, store_id, NULL::uuid, NULL::uuid
    FROM ops.employee_offboarding_request
    UNION ALL SELECT 'ops.target_distribution_request', target_distribution_request_id::text,
           company_id, region_id, store_id, NULL::uuid, NULL::uuid
    FROM ops.target_distribution_request
    UNION ALL SELECT 'ops.personnel_target_reference', personnel_target_reference_id::text,
           company_id, region_id, store_id, NULL::uuid, NULL::uuid
    FROM ops.personnel_target_reference
    UNION ALL SELECT 'ops.kpi_target', kpi_target_id::text,
           company_id, region_id, store_id, NULL::uuid, NULL::uuid
    FROM ops.kpi_target
    UNION ALL SELECT 'ops.kpi_actual', kpi_actual_id::text,
           company_id, region_id, store_id, NULL::uuid, NULL::uuid
    FROM ops.kpi_actual
    UNION ALL SELECT 'ops.workforce_norm_plan', norm_plan_id::text,
           company_id, region_id, store_id, NULL::uuid, NULL::uuid
    FROM ops.workforce_norm_plan
    UNION ALL SELECT 'ops.turnover_event', turnover_event_id::text,
           company_id, region_id, store_id, NULL::uuid, NULL::uuid
    FROM ops.turnover_event
    UNION ALL SELECT 'ops.store_action_plan', store_action_plan_id::text,
           company_id, region_id, store_id, NULL::uuid, NULL::uuid
    FROM ops.store_action_plan
    UNION ALL SELECT 'ops.sales_target_incentive_projection', sales_target_incentive_projection_id::text,
           company_id, region_id, store_id, NULL::uuid, NULL::uuid
    FROM ops.sales_target_incentive_projection
    UNION ALL SELECT 'rpt.sales_target_incentive_assignment_snapshot', sales_target_incentive_assignment_snapshot_id::text,
           company_id, region_id, store_id, NULL::uuid, NULL::uuid
    FROM rpt.sales_target_incentive_assignment_snapshot
    UNION ALL SELECT 'rpt.sales_target_incentive_final_snapshot', sales_target_incentive_final_snapshot_id::text,
           company_id, region_id, store_id, NULL::uuid, NULL::uuid
    FROM rpt.sales_target_incentive_final_snapshot
    UNION ALL SELECT 'ops.sales_target_incentive_adjustment', sales_target_incentive_adjustment_id::text,
           company_id, region_id, store_id, NULL::uuid, NULL::uuid
    FROM ops.sales_target_incentive_adjustment
    UNION ALL SELECT 'ops.sales_target_incentive_store_review', sales_target_incentive_store_review_id::text,
           company_id, region_id, store_id, NULL::uuid, NULL::uuid
    FROM ops.sales_target_incentive_store_review
    UNION ALL SELECT 'ops.sales_target_incentive_region_package', sales_target_incentive_region_package_id::text,
           company_id, region_id, NULL::uuid, NULL::uuid, NULL::uuid
    FROM ops.sales_target_incentive_region_package
    UNION ALL SELECT 'ops.sales_target_incentive_region_package_store', sales_target_incentive_region_package_store_id::text,
           company_id, region_id, store_id, NULL::uuid, NULL::uuid
    FROM ops.sales_target_incentive_region_package_store
    UNION ALL SELECT 'ops.sales_target_incentive_region_correction', sales_target_incentive_region_correction_id::text,
           company_id, region_id, store_id, NULL::uuid, NULL::uuid
    FROM ops.sales_target_incentive_region_correction
    UNION ALL SELECT 'rpt.turnover_snapshot',
           concat_ws(':', snapshot_run_id::text, scope_type, company_id::text, region_id::text, store_id::text),
           company_id, region_id, store_id, NULL::uuid, NULL::uuid
    FROM rpt.turnover_snapshot
    UNION ALL
    SELECT 'stg.master_data_bootstrap_row', bootstrap_row.master_data_bootstrap_row_id::text,
           bootstrap_batch.company_id, bootstrap_row.resolved_region_id, bootstrap_row.resolved_store_id,
           bootstrap_row.resolved_company_id, bootstrap_batch.company_id
    FROM stg.master_data_bootstrap_row bootstrap_row
    INNER JOIN stg.master_data_bootstrap_batch bootstrap_batch
        ON bootstrap_batch.master_data_bootstrap_batch_id = bootstrap_row.master_data_bootstrap_batch_id
    UNION ALL SELECT 'audit.event_log', event_log_id::text,
           company_id, region_id, store_id, NULL::uuid, NULL::uuid
    FROM audit.event_log
),
target_candidates AS (
    SELECT request.*,
           CASE
               WHEN jsonb_typeof(request.allocation_json) = 'array'
                   THEN jsonb_array_length(request.allocation_json)
               ELSE NULL
           END AS safe_json_length
    FROM ops.target_distribution_request request
),
target_records AS (
    SELECT
        'TARGET-02'::text AS family,
        request.target_distribution_request_id::text AS record_key,
        'ops.target_distribution_request'::text AS source_table,
        ARRAY[
            CASE
                WHEN request.allocation_count < request.safe_json_length
                    THEN 'target.count_less_than_json_length'
                ELSE 'target.count_greater_than_json_length'
            END
        ]::text[] || CASE
            WHEN request.target_label = 'pilot_imported_personnel_targets'
                THEN ARRAY[]::text[]
            ELSE ARRAY['target.write_source_legacy_or_unknown']::text[]
        END AS reason_codes,
        jsonb_build_object(
            'approvalEvidence', CASE WHEN request.approval_evidence_json IS NULL THEN 'absent' ELSE 'present' END,
            'approvalMode', CASE
                WHEN request.approval_evidence_json ->> 'approvalMode' IN ('direct', 'adjusted')
                    THEN request.approval_evidence_json ->> 'approvalMode'
                ELSE 'unknown'
            END,
            'countDelta', request.allocation_count - request.safe_json_length,
            'createdVintage', CASE
                WHEN request.created_at < TIMESTAMPTZ '2025-01-01 00:00:00+00' THEN 'before_2025'
                WHEN request.created_at < TIMESTAMPTZ '2026-01-01 00:00:00+00' THEN '2025'
                WHEN request.created_at < TIMESTAMPTZ '2026-07-01 00:00:00+00' THEN '2026_h1'
                WHEN request.created_at < TIMESTAMPTZ '2027-01-01 00:00:00+00' THEN '2026_h2'
                ELSE 'future_or_unknown'
            END,
            'requestStatus', CASE
                WHEN request.request_status IN ('pending_region_approval', 'approved') THEN request.request_status
                ELSE 'unknown'
            END,
            'writeSource', CASE
                WHEN request.target_label = 'pilot_imported_personnel_targets' THEN 'pilot_roster_import'
                ELSE 'legacy_or_unknown'
            END
        ) AS dimensions,
        substr(md5(request.target_distribution_request_id::text), 1, 12) AS sample_ref
    FROM target_candidates request
    WHERE request.safe_json_length IS NOT NULL
      AND request.allocation_count IS DISTINCT FROM request.safe_json_length
),
org02_candidates AS (
    SELECT
        assignment.assignment_id::text AS record_key,
        ARRAY_REMOVE(ARRAY[
            CASE WHEN assignment.region_id IS DISTINCT FROM store.region_id
                THEN 'org.assignment_region_store_region' END,
            CASE WHEN region.company_id IS DISTINCT FROM store.company_id
                THEN 'org.region_company_store_company' END,
            CASE WHEN employee.company_id IS DISTINCT FROM store.company_id
                THEN 'org.employee_company_store_company' END,
            CASE WHEN position.company_id IS DISTINCT FROM store.company_id
                THEN 'org.position_company_store_company' END
        ]::text[], NULL) AS reason_codes
    FROM ops.employee_assignment_history assignment
    INNER JOIN ops.store store ON store.store_id = assignment.store_id
    INNER JOIN ops.region region ON region.region_id = assignment.region_id
    INNER JOIN ops.employee employee ON employee.employee_id = assignment.employee_id
    INNER JOIN ops.position position ON position.position_id = assignment.position_id
),
org02_records AS (
    SELECT
        'ORG-02'::text AS family,
        candidate.record_key,
        'ops.employee_assignment_history'::text AS source_table,
        candidate.reason_codes,
        jsonb_build_object('multipleReasons', cardinality(candidate.reason_codes) > 1) AS dimensions,
        substr(md5(candidate.record_key), 1, 12) AS sample_ref
    FROM org02_candidates candidate
    WHERE cardinality(candidate.reason_codes) > 0
),
org04_candidates AS (
    SELECT
        scope_row.source_table,
        scope_row.record_id AS record_key,
        ARRAY_REMOVE(ARRAY[
            CASE WHEN scope_row.region_id IS NOT NULL
                       AND scope_row.company_id IS NOT NULL
                       AND scope_row.company_id IS DISTINCT FROM region.company_id
                THEN 'org.scope_company_region' END,
            CASE WHEN scope_row.store_id IS NOT NULL
                       AND scope_row.company_id IS NOT NULL
                       AND scope_row.company_id IS DISTINCT FROM store.company_id
                THEN 'org.scope_company_store' END,
            CASE WHEN scope_row.store_id IS NOT NULL
                       AND scope_row.region_id IS NOT NULL
                       AND scope_row.region_id IS DISTINCT FROM store.region_id
                THEN 'org.scope_region_store' END,
            CASE WHEN scope_row.source_table = 'stg.master_data_bootstrap_row'
                       AND scope_row.resolved_company_id IS NOT NULL
                       AND scope_row.resolved_company_id IS DISTINCT FROM scope_row.batch_company_id
                THEN 'org.bootstrap_resolved_company_batch_company' END
        ]::text[], NULL) AS reason_codes
    FROM scope_rows scope_row
    LEFT JOIN ops.region region ON region.region_id = scope_row.region_id
    LEFT JOIN ops.store store ON store.store_id = scope_row.store_id
),
org04_records AS (
    SELECT
        'ORG-04'::text AS family,
        candidate.record_key,
        candidate.source_table,
        candidate.reason_codes,
        jsonb_build_object('multipleReasons', cardinality(candidate.reason_codes) > 1) AS dimensions,
        substr(md5(candidate.source_table || ':' || candidate.record_key), 1, 12) AS sample_ref
    FROM org04_candidates candidate
    WHERE cardinality(candidate.reason_codes) > 0
),
assignment_records AS (
    SELECT
        'ASSIGN-01'::text AS family,
        left_assignment.assignment_id::text || ':' || right_assignment.assignment_id::text AS record_key,
        'ops.employee_assignment_history'::text AS source_table,
        ARRAY[
            CASE
                WHEN GREATEST(left_assignment.start_date, right_assignment.start_date)
                     = LEAST(
                         COALESCE(left_assignment.end_date, 'infinity'::date),
                         COALESCE(right_assignment.end_date, 'infinity'::date)
                     ) THEN 'assignment.same_day_boundary'
                ELSE 'assignment.strict_multi_day'
            END,
            CASE WHEN left_assignment.end_date IS NULL OR right_assignment.end_date IS NULL
                THEN 'assignment.open_ended' END,
            CASE
                WHEN left_assignment.store_id IS NOT DISTINCT FROM right_assignment.store_id
                 AND left_assignment.region_id IS NOT DISTINCT FROM right_assignment.region_id
                    THEN 'assignment.same_scope'
                ELSE 'assignment.cross_scope'
            END
        ]::text[] AS unfiltered_reason_codes,
        jsonb_build_object(
            'openEnded', left_assignment.end_date IS NULL OR right_assignment.end_date IS NULL,
            'overlapKind', CASE
                WHEN GREATEST(left_assignment.start_date, right_assignment.start_date)
                     = LEAST(
                         COALESCE(left_assignment.end_date, 'infinity'::date),
                         COALESCE(right_assignment.end_date, 'infinity'::date)
                     ) THEN 'same_day_boundary'
                ELSE 'strict_multi_day'
            END,
            'scopeRelation', CASE
                WHEN left_assignment.store_id IS NOT DISTINCT FROM right_assignment.store_id
                 AND left_assignment.region_id IS NOT DISTINCT FROM right_assignment.region_id
                    THEN 'same_scope'
                ELSE 'cross_scope'
            END
        ) AS dimensions,
        substr(md5(left_assignment.assignment_id::text || ':' || right_assignment.assignment_id::text), 1, 12) AS sample_ref,
        left_assignment.assignment_id::text AS left_assignment_id,
        right_assignment.assignment_id::text AS right_assignment_id
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
),
assignment_clean_records AS (
    SELECT family, record_key, source_table,
           ARRAY_REMOVE(unfiltered_reason_codes, NULL) AS reason_codes,
           dimensions, sample_ref, left_assignment_id, right_assignment_id
    FROM assignment_records
),
all_records AS (
    SELECT family, record_key, source_table, reason_codes, dimensions, sample_ref
    FROM target_records
    UNION ALL
    SELECT family, record_key, source_table, reason_codes, dimensions, sample_ref
    FROM org02_records
    UNION ALL
    SELECT family, record_key, source_table, reason_codes, dimensions, sample_ref
    FROM org04_records
    UNION ALL
    SELECT family, record_key, source_table, reason_codes, dimensions, sample_ref
    FROM assignment_clean_records
),
ranked_records AS (
    SELECT record.*,
           row_number() OVER (
               PARTITION BY family, source_table, reason_codes, dimensions
               ORDER BY sample_ref
           ) AS sample_rank
    FROM all_records record
),
bucket_rows AS (
    SELECT
        family,
        source_table,
        reason_codes,
        dimensions,
        COUNT(*)::integer AS hit_count,
        CASE WHEN family = 'ASSIGN-01' THEN NULL
             ELSE COUNT(DISTINCT record_key)::integer END AS distinct_source_record_count,
        COALESCE(
            jsonb_agg(sample_ref ORDER BY sample_ref) FILTER (WHERE sample_rank <= 5),
            '[]'::jsonb
        ) AS sample_refs
    FROM ranked_records
    GROUP BY family, source_table, reason_codes, dimensions
),
source_memberships AS (
    SELECT family, source_table, record_key FROM target_records
    UNION
    SELECT family, source_table, record_key FROM org02_records
    UNION
    SELECT family, source_table, record_key FROM org04_records
    UNION
    SELECT family, source_table, left_assignment_id AS record_key FROM assignment_clean_records
    UNION
    SELECT family, source_table, right_assignment_id AS record_key FROM assignment_clean_records
),
cooccurrence_rows AS (
    SELECT
        left_member.family AS family_a,
        right_member.family AS family_b,
        left_member.source_table,
        COUNT(DISTINCT left_member.record_key)::integer AS source_record_count
    FROM source_memberships left_member
    INNER JOIN source_memberships right_member
        ON right_member.source_table = left_member.source_table
       AND right_member.record_key = left_member.record_key
       AND right_member.family > left_member.family
    GROUP BY left_member.family, right_member.family, left_member.source_table
),
family_catalog(family) AS (
    VALUES ('ASSIGN-01'), ('ORG-02'), ('ORG-04'), ('TARGET-02')
),
family_totals AS (
    SELECT catalog.family, COALESCE(COUNT(record.family), 0)::integer AS hit_count
    FROM family_catalog catalog
    LEFT JOIN all_records record ON record.family = catalog.family
    GROUP BY catalog.family
),
aggregate_result AS (
    SELECT
        COALESCE((SELECT SUM(hit_count) FROM family_totals), 0)::integer AS overall_check_hits,
        COALESCE((
            SELECT COUNT(*)
            FROM (SELECT DISTINCT source_table, record_key FROM source_memberships) distinct_records
        ), 0)::integer AS distinct_source_records,
        COALESCE((
            SELECT jsonb_agg(
                jsonb_strip_nulls(jsonb_build_object(
                    'dimensions', bucket.dimensions,
                    'distinctSourceRecordCount', bucket.distinct_source_record_count,
                    'family', bucket.family,
                    'hitCount', bucket.hit_count,
                    'querySetVersion', 'staging-remediation-diagnostic-v1',
                    'reasonCodes', to_jsonb(bucket.reason_codes),
                    'sampleRefs', bucket.sample_refs,
                    'sourceClass', CASE
                        WHEN bucket.source_table LIKE 'rpt.%' THEN 'reporting'
                        WHEN bucket.source_table LIKE 'stg.%' THEN 'staging'
                        WHEN bucket.source_table LIKE 'audit.%' THEN 'audit'
                        ELSE 'operational'
                    END,
                    'sourceTable', bucket.source_table,
                    'unit', 'check_hits'
                ))
                ORDER BY bucket.family, bucket.source_table, bucket.reason_codes::text, bucket.dimensions::text
            )
            FROM bucket_rows bucket
        ), '[]'::jsonb) AS buckets,
        COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'familyA', row.family_a,
                'familyB', row.family_b,
                'sourceRecordCount', row.source_record_count,
                'sourceTable', row.source_table,
                'unit', 'source_records'
            ) ORDER BY row.family_a, row.family_b, row.source_table)
            FROM cooccurrence_rows row
        ), '[]'::jsonb) AS cooccurrences,
        (SELECT jsonb_agg(jsonb_build_object(
            'family', total.family,
            'hitCount', total.hit_count,
            'unit', 'check_hits'
        ) ORDER BY total.family) FROM family_totals total) AS family_totals
)
SELECT jsonb_build_object(
    'buckets', result.buckets,
    'cooccurrences', result.cooccurrences,
    'distinctPeople', jsonb_build_object('status', 'distinct_count_unresolved'),
    'distinctSourceRecords', jsonb_build_object(
        'count', result.distinct_source_records,
        'unit', 'source_records'
    ),
    'familyTotals', result.family_totals,
    'observedAt', to_char(
        transaction_timestamp() AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
    ),
    'overallCheckHits', jsonb_build_object('count', result.overall_check_hits, 'unit', 'check_hits'),
    'querySetVersion', 'staging-remediation-diagnostic-v1'
) AS diagnostic
FROM aggregate_result result;
