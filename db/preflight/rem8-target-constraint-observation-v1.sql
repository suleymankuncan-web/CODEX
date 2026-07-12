-- Trace: FR-05..08; NFR-01..03; AC-02, AC-03; EC-05..10, EC-16.
WITH target_relation AS (
  SELECT class.oid, class.relkind, class.reltuples
  FROM pg_catalog.pg_class class
  INNER JOIN pg_catalog.pg_namespace namespace ON namespace.oid = class.relnamespace
  WHERE namespace.nspname = 'ops'
    AND class.relname = 'target_distribution_request'
),
target_stats AS (
  SELECT
    GREATEST(relation.reltuples, 0)::bigint AS estimated_rows,
    COALESCE(stats.n_live_tup, 0)::bigint AS live_rows,
    COALESCE(stats.n_dead_tup, 0)::bigint AS dead_rows,
    pg_catalog.pg_relation_size(relation.oid)::bigint AS table_bytes,
    pg_catalog.pg_indexes_size(relation.oid)::bigint AS index_bytes,
    pg_catalog.pg_total_relation_size(relation.oid)::bigint AS total_bytes,
    relation.relkind = 'p' AS partitioned,
    COALESCE(stats.n_tup_ins, 0)::bigint AS inserted,
    COALESCE(stats.n_tup_upd, 0)::bigint AS updated,
    COALESCE(stats.n_tup_del, 0)::bigint AS deleted
  FROM target_relation relation
  LEFT JOIN pg_catalog.pg_stat_user_tables stats ON stats.relid = relation.oid
),
database_stats AS (
  SELECT CASE WHEN stats_reset IS NULL THEN NULL
    ELSE GREATEST(EXTRACT(EPOCH FROM transaction_timestamp() - stats_reset), 0)::bigint
  END AS stats_age_seconds
  FROM pg_catalog.pg_stat_database
  WHERE datname = pg_catalog.current_database()
),
transaction_stats AS (
  SELECT
    COUNT(*) FILTER (WHERE activity.xact_start IS NOT NULL)::integer AS active_count,
    COUNT(*) FILTER (
      WHERE activity.xact_start IS NOT NULL
        AND transaction_timestamp() - activity.xact_start > INTERVAL '5 seconds'
    )::integer AS over_5s_count,
    COUNT(*) FILTER (
      WHERE activity.xact_start IS NOT NULL
        AND transaction_timestamp() - activity.xact_start > INTERVAL '30 seconds'
    )::integer AS over_30s_count,
    COALESCE(MAX(
      GREATEST(EXTRACT(EPOCH FROM transaction_timestamp() - activity.xact_start) * 1000, 0)
    ) FILTER (WHERE activity.xact_start IS NOT NULL), 0)::bigint AS max_age_ms
  FROM pg_catalog.pg_stat_activity activity
  WHERE activity.pid <> pg_catalog.pg_backend_pid()
    AND activity.datname = pg_catalog.current_database()
),
lock_stats AS (
  SELECT lock.mode, lock.granted, COUNT(*)::integer AS lock_count
  FROM pg_catalog.pg_locks lock
  INNER JOIN target_relation relation ON relation.oid = lock.relation
  GROUP BY lock.mode, lock.granted
),
ordinary_duplicates AS (
  SELECT COUNT(*)::integer AS row_count
  FROM ops.target_distribution_request request
  WHERE request.target_label IS DISTINCT FROM 'pilot_imported_personnel_targets'
    AND pg_catalog.jsonb_typeof(request.allocation_json) = 'array'
    AND EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_array_elements(request.allocation_json) AS entry(item)
      WHERE pg_catalog.jsonb_typeof(entry.item) = 'object'
        AND pg_catalog.jsonb_typeof(entry.item -> 'employeeId') = 'string'
      GROUP BY pg_catalog.lower(entry.item ->> 'employeeId')
      HAVING pg_catalog.count(*) > 1
    )
),
pilot_duplicate_groups AS (
  SELECT COUNT(*)::integer AS group_count
  FROM (
    SELECT
      reference.employee_id,
      reference.period_start,
      reference.period_end,
      reference.target_type
    FROM ops.personnel_target_reference reference
    WHERE reference.status = 'approved'
    GROUP BY
      reference.employee_id,
      reference.period_start,
      reference.period_end,
      reference.target_type
    HAVING COUNT(*) > 1
  ) duplicate_group
),
non_array_rows AS (
  SELECT COUNT(*)::integer AS row_count
  FROM ops.target_distribution_request request
  WHERE pg_catalog.jsonb_typeof(request.allocation_json) IS DISTINCT FROM 'array'
),
pilot_index AS (
  SELECT
    index_catalog.indisunique,
    index_catalog.indisvalid,
    index_catalog.indisready,
    index_catalog.indnkeyatts,
    ARRAY(
      SELECT attribute.attname
      FROM pg_catalog.unnest(index_catalog.indkey::smallint[]) WITH ORDINALITY key(attnum, position)
      INNER JOIN pg_catalog.pg_attribute attribute
        ON attribute.attrelid = table_class.oid
       AND attribute.attnum = key.attnum
      WHERE key.position <= index_catalog.indnkeyatts
      ORDER BY key.position
    ) AS key_columns,
    pg_catalog.pg_get_expr(index_catalog.indpred, index_catalog.indrelid) AS predicate
  FROM pg_catalog.pg_index index_catalog
  INNER JOIN pg_catalog.pg_class index_class ON index_class.oid = index_catalog.indexrelid
  INNER JOIN pg_catalog.pg_class table_class ON table_class.oid = index_catalog.indrelid
  INNER JOIN pg_catalog.pg_namespace namespace ON namespace.oid = table_class.relnamespace
  WHERE namespace.nspname = 'ops'
    AND table_class.relname = 'personnel_target_reference'
    AND index_class.relname = 'idx_personnel_target_reference_active_unique'
),
pilot_index_state AS (
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM pilot_index) THEN 'absent'
    WHEN EXISTS (
      SELECT 1 FROM pilot_index index_state
      WHERE NOT index_state.indisunique OR NOT index_state.indisvalid OR NOT index_state.indisready
    ) THEN 'invalid'
    WHEN EXISTS (
      SELECT 1 FROM pilot_index index_state
      WHERE index_state.indnkeyatts = 4
        AND index_state.key_columns = ARRAY['employee_id', 'period_start', 'period_end', 'target_type']::name[]
        AND pg_catalog.regexp_replace(index_state.predicate, '[()[:space:]]', '', 'g')
          IN ('status=''approved''::text', 'status=''approved''')
    ) THEN 'present_valid_exact'
    ELSE 'definition_drifted'
  END::text AS state
),
artifact_state AS (
  SELECT
    CASE WHEN pg_catalog.to_regprocedure(
      'ops.target_distribution_employee_ids_unique_v1(jsonb)'
    ) IS NULL THEN 'absent' ELSE 'present' END::text AS function_state,
    COALESCE((
      SELECT CASE WHEN constraint_catalog.convalidated
        THEN 'present_valid' ELSE 'present_not_valid' END
      FROM pg_catalog.pg_constraint constraint_catalog
      INNER JOIN target_relation relation ON relation.oid = constraint_catalog.conrelid
      WHERE constraint_catalog.conname = 'ck_target_distribution_employee_ids_unique_v1'
        AND constraint_catalog.contype = 'c'
    ), 'absent')::text AS constraint_state
),
document AS (
  SELECT
    target_stats.*,
    database_stats.stats_age_seconds,
    transaction_stats.*,
    ordinary_duplicates.row_count AS ordinary_duplicate_rows,
    pilot_duplicate_groups.group_count AS pilot_duplicate_groups,
    non_array_rows.row_count AS non_array_rows,
    pilot_index_state.state AS pilot_unique_index,
    artifact_state.function_state,
    artifact_state.constraint_state
  FROM target_stats
  CROSS JOIN database_stats
  CROSS JOIN transaction_stats
  CROSS JOIN ordinary_duplicates
  CROSS JOIN pilot_duplicate_groups
  CROSS JOIN non_array_rows
  CROSS JOIN pilot_index_state
  CROSS JOIN artifact_state
)
SELECT pg_catalog.jsonb_build_object(
  'artifacts', pg_catalog.jsonb_build_object(
    'constraintState', document.constraint_state,
    'functionState', document.function_state
  ),
  'compatibility', pg_catalog.jsonb_build_object(
    'nonArrayRows', document.non_array_rows,
    'ordinaryDuplicateRows', document.ordinary_duplicate_rows,
    'pilotDuplicateGroups', document.pilot_duplicate_groups,
    'pilotUniqueIndex', document.pilot_unique_index
  ),
  'locks', COALESCE((
    SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'count', lock_stats.lock_count,
      'granted', lock_stats.granted,
      'mode', lock_stats.mode
    ) ORDER BY lock_stats.mode, lock_stats.granted)
    FROM lock_stats
  ), '[]'::jsonb),
  'observedAt', pg_catalog.to_char(
    transaction_timestamp() AT TIME ZONE 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
  ),
  'querySetVersion', 'rem8-target-constraint-observation-v1',
  'server', pg_catalog.jsonb_build_object(
    'major', pg_catalog.current_setting('server_version_num')::integer / 10000
  ),
  'targetTable', pg_catalog.jsonb_build_object(
    'deadRows', document.dead_rows,
    'estimatedRows', document.estimated_rows,
    'indexBytes', document.index_bytes,
    'liveRows', document.live_rows,
    'partitioned', document.partitioned,
    'tableBytes', document.table_bytes,
    'totalBytes', document.total_bytes
  ),
  'transactions', pg_catalog.jsonb_build_object(
    'activeCount', document.active_count,
    'maxAgeMs', document.max_age_ms,
    'over30sCount', document.over_30s_count,
    'over5sCount', document.over_5s_count
  ),
  'writes', pg_catalog.jsonb_build_object(
    'deleted', document.deleted,
    'inserted', document.inserted,
    'statsAgeSeconds', document.stats_age_seconds,
    'updated', document.updated
  )
) AS observation
FROM document;
