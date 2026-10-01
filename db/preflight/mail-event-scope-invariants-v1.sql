-- Additive diagnostics; immutable V1 inventory and business rows stay untouched.
WITH violations AS (
    SELECT 'MAIL-EVENT-01'::text AS check_id, event.event_id::text AS record_id
    FROM ops.operational_mail_event event
    LEFT JOIN ops.store store ON store.store_id = event.store_id
    WHERE event.store_id IS NOT NULL
      AND (store.store_id IS NULL OR event.company_id IS DISTINCT FROM store.company_id)
    UNION ALL
    SELECT 'MAIL-EVENT-02', event.event_id::text
    FROM ops.incentive_approval_mail_event event
    LEFT JOIN ops.sales_target_incentive_region_package package
      ON package.sales_target_incentive_region_package_id = event.package_id
    LEFT JOIN ops.incentive_company_cycle cycle ON cycle.cycle_id = event.cycle_id
    WHERE (event.package_id IS NOT NULL AND (package.company_id IS DISTINCT FROM event.company_id
      OR package.period_key IS DISTINCT FROM event.period_key))
      OR (event.cycle_id IS NOT NULL AND (cycle.company_id IS DISTINCT FROM event.company_id
      OR cycle.period_key IS DISTINCT FROM event.period_key))
), checks AS (SELECT unnest(ARRAY['MAIL-EVENT-01','MAIL-EVENT-02']) AS check_id)
SELECT checks.check_id, 'organization'::text AS category, COUNT(violations.record_id)::bigint AS violation_count,
    COALESCE((array_agg(substr(md5(violations.record_id),1,12) ORDER BY violations.record_id)
      FILTER(WHERE violations.record_id IS NOT NULL))[1:5],ARRAY[]::text[]) AS sample_refs
FROM checks LEFT JOIN violations ON violations.check_id=checks.check_id
GROUP BY checks.check_id ORDER BY checks.check_id;
