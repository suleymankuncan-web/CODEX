export const storeOwnershipRevisionSql = `
  WITH transition_summary AS (
    SELECT transition.store_id,
           COUNT(*)::bigint AS transition_count,
           MAX(transition.created_at) AS latest_transition_at
    FROM ops.store_ownership_transition transition
    JOIN ops.store store ON store.store_id = transition.store_id
    WHERE store.company_id = $1::uuid
    GROUP BY transition.store_id
  )
  SELECT md5(COALESCE(string_agg(
    concat_ws(':', store.store_id::text, store.store_type, store.updated_at::text,
      COALESCE(summary.transition_count, 0)::text,
      COALESCE(summary.latest_transition_at::text, '')),
    '|' ORDER BY store.store_id
  ), '')) AS revision
  FROM ops.store store
  LEFT JOIN transition_summary summary ON summary.store_id = store.store_id
  WHERE store.company_id = $1::uuid
`;

export const closedIncentivePeriodAfterOwnershipDateSql = `
  SELECT run.period_key
  FROM ops.sales_target_incentive_close_run run
  WHERE run.company_id = $1::uuid AND run.period_end >= $2::date
    AND run.status = 'succeeded'
  ORDER BY run.period_end
  LIMIT 1
`;
