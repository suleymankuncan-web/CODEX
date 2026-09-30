WITH violations AS (
    SELECT 'INC-PART-01'::text AS check_id, revision.participation_revision_id::text AS record_id
    FROM ops.sales_target_incentive_participation_revision revision
    LEFT JOIN rpt.sales_target_incentive_final_snapshot snapshot ON snapshot.sales_target_incentive_final_snapshot_id=revision.final_snapshot_id
    WHERE snapshot.sales_target_incentive_final_snapshot_id IS NULL
       OR ROW(revision.company_id,revision.store_id,revision.period_key)
          IS DISTINCT FROM ROW(snapshot.company_id,snapshot.store_id,snapshot.period_key)
    UNION ALL
    SELECT 'INC-PART-02', concat_ws(':', package_store.region_package_id::text,package_store.store_id::text)
    FROM ops.sales_target_incentive_region_package_store package_store
    LEFT JOIN ops.sales_target_incentive_participation_revision revision
      ON revision.store_id=package_store.store_id AND revision.period_key=package_store.period_key
     AND revision.final_snapshot_id=package_store.final_snapshot_id AND revision.revision_no=package_store.participation_revision_no
    WHERE (package_store.participation_revision_no=0 AND package_store.participation_exclusions_json<>'[]'::jsonb)
       OR (package_store.participation_revision_no>0 AND (revision.participation_revision_id IS NULL
           OR package_store.company_id IS DISTINCT FROM revision.company_id
           OR package_store.participation_exclusions_json IS DISTINCT FROM revision.exclusions_json))
), checks AS (SELECT unnest(ARRAY['INC-PART-01','INC-PART-02']) AS check_id)
SELECT checks.check_id, 'organization'::text AS category, COUNT(violations.record_id)::bigint AS violation_count,
       COALESCE((array_agg(substr(md5(violations.record_id),1,12) ORDER BY violations.record_id)
         FILTER (WHERE violations.record_id IS NOT NULL))[1:5],ARRAY[]::text[]) AS sample_refs
FROM checks LEFT JOIN violations ON violations.check_id=checks.check_id GROUP BY checks.check_id ORDER BY checks.check_id;
