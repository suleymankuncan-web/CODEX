import type { DatabaseService } from "../../../shared/database/database.service";

export function escapePostgresLikePattern(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

export async function listImportBatchesNeedingAction(
  databaseService: DatabaseService,
  input: {
    limit?: number;
    offset?: number;
    stuckBefore: string;
    q?: string;
  },
  params: unknown[],
  whereClause: string,
  rawUnionSql: string,
  missingDependencyPredicate: string,
) {
    params.push(input.stuckBefore);
    const stuckBeforeParam = `$${params.length}::timestamptz`;
    const normalizedQuery = input.q?.trim() || null;
    const queryClause = normalizedQuery
      ? (() => {
          params.push(`%${escapePostgresLikePattern(normalizedQuery)}%`);
          const queryParam = `$${params.length}`;
          return `
            AND (
              import_batch_id::text ILIKE ${queryParam} ESCAPE '\\'
              OR source_code ILIKE ${queryParam} ESCAPE '\\'
              OR source_name ILIKE ${queryParam} ESCAPE '\\'
              OR entity_type ILIKE ${queryParam} ESCAPE '\\'
              OR health_state ILIKE ${queryParam} ESCAPE '\\'
              OR action_reason ILIKE ${queryParam} ESCAPE '\\'
            )`;
        })()
      : "";

    const baseCte = `
      WITH filtered_batches AS (
        SELECT
          b.import_batch_id,
          b.integration_source_id,
          src.source_code,
          src.source_name,
          b.entity_type,
          b.source_batch_id,
          b.source_payload_hash,
          b.source_captured_at,
          b.source_window_started_at,
          b.source_window_ended_at,
          b.started_at,
          b.finished_at,
          b.status,
          b.raw_file_name,
          b.record_count,
          b.error_count,
          b.retry_count,
          b.last_retried_at
        FROM stg.import_batch b
        INNER JOIN stg.integration_source src
          ON src.integration_source_id = b.integration_source_id
        ${whereClause}
      ),
      raw_all AS (
        ${rawUnionSql}
      ),
      per_batch AS (
        SELECT
          fb.import_batch_id,
          fb.integration_source_id,
          fb.source_code,
          fb.source_name,
          fb.entity_type,
          fb.source_batch_id,
          fb.source_payload_hash,
          fb.source_captured_at,
          fb.source_window_started_at,
          fb.source_window_ended_at,
          fb.started_at,
          fb.finished_at,
          fb.status,
          fb.raw_file_name,
          fb.record_count,
          fb.error_count,
          fb.retry_count,
          fb.last_retried_at,
          COALESCE(
            BOOL_OR(
              raw.normalized_status = 'retryable_error'
              AND (${missingDependencyPredicate})
            ),
            FALSE
          ) AS has_dependency_blockers,
          COALESCE(BOOL_OR(raw.normalized_status = 'retryable_error'), FALSE) AS has_retryable_error,
          COALESCE(SUM(CASE WHEN raw.raw_entity_type = fb.entity_type AND raw.normalized_status = 'retryable_error' AND raw.validation_error ILIKE '%employee reference could not be resolved%' THEN 1 ELSE 0 END), 0)::text AS employee_dependency_count,
          COALESCE(SUM(CASE WHEN raw.raw_entity_type = fb.entity_type AND raw.normalized_status = 'retryable_error' AND raw.validation_error ILIKE '%store reference could not be resolved%' THEN 1 ELSE 0 END), 0)::text AS store_dependency_count,
          COALESCE(SUM(CASE WHEN raw.raw_entity_type = fb.entity_type AND raw.normalized_status = 'retryable_error' AND raw.validation_error ILIKE '%position reference could not be resolved%' THEN 1 ELSE 0 END), 0)::text AS position_dependency_count,
          COALESCE(SUM(CASE WHEN raw.raw_entity_type = fb.entity_type AND raw.normalized_status = 'retryable_error' AND raw.validation_error ILIKE '%region could not be resolved%' THEN 1 ELSE 0 END), 0)::text AS region_dependency_count,
          COALESCE(SUM(CASE WHEN raw.raw_entity_type = fb.entity_type AND raw.normalized_status = 'retryable_error' AND raw.validation_error ILIKE '%company could not be resolved%' THEN 1 ELSE 0 END), 0)::text AS company_dependency_count,
          COALESCE(SUM(CASE WHEN raw.raw_entity_type = fb.entity_type AND raw.normalized_status = 'retryable_error' AND raw.validation_error ILIKE '%manager%could not be resolved%' THEN 1 ELSE 0 END), 0)::text AS manager_dependency_count
        FROM filtered_batches fb
        LEFT JOIN raw_all raw
          ON raw.import_batch_id = fb.import_batch_id
        GROUP BY
          fb.import_batch_id,
          fb.integration_source_id,
          fb.source_code,
          fb.source_name,
          fb.entity_type,
          fb.source_batch_id,
          fb.source_payload_hash,
          fb.source_captured_at,
          fb.source_window_started_at,
          fb.source_window_ended_at,
          fb.started_at,
          fb.finished_at,
          fb.status,
          fb.raw_file_name,
          fb.record_count,
          fb.error_count,
          fb.retry_count,
          fb.last_retried_at
      ),
      action_queue AS (
        SELECT
          import_batch_id,
          integration_source_id,
          source_code,
          source_name,
          entity_type,
          source_batch_id,
          source_payload_hash,
          source_captured_at,
          source_window_started_at,
          source_window_ended_at,
          started_at,
          finished_at,
          status,
          raw_file_name,
          record_count,
          error_count,
          retry_count,
          last_retried_at,
          CASE
            WHEN status IN ('pending', 'queued', 'processing') AND started_at < ${stuckBeforeParam} THEN 'stuck'
            WHEN status IN ('failed', 'completed_with_errors') AND has_dependency_blockers THEN 'blocked'
            WHEN status IN ('failed', 'completed_with_errors') AND has_retryable_error AND NOT has_dependency_blockers THEN 'retry_ready'
            WHEN status IN ('failed', 'completed_with_errors') AND NOT has_retryable_error THEN 'needs_action'
            ELSE NULL
          END AS health_state,
          CASE
            WHEN status IN ('pending', 'queued', 'processing') AND started_at < ${stuckBeforeParam} THEN 'Batch has exceeded the in-progress time threshold'
            WHEN status IN ('failed', 'completed_with_errors') AND has_dependency_blockers THEN 'Missing dependency mappings detected'
            WHEN status IN ('failed', 'completed_with_errors') AND has_retryable_error AND NOT has_dependency_blockers THEN 'Retryable write errors remain'
            WHEN status IN ('failed', 'completed_with_errors') AND NOT has_retryable_error THEN 'Batch requires manual review before retry'
            ELSE NULL
          END AS action_reason,
          CASE
            WHEN status IN ('pending', 'queued', 'processing') AND started_at < ${stuckBeforeParam} THEN 'Inspect worker execution and consider retrying after the root cause is fixed'
            WHEN status IN ('failed', 'completed_with_errors') AND has_dependency_blockers THEN 'Import the missing dependency entity types before retrying'
            WHEN status IN ('failed', 'completed_with_errors') AND has_retryable_error AND NOT has_dependency_blockers THEN 'Retry the batch now'
            WHEN status IN ('failed', 'completed_with_errors') AND NOT has_retryable_error THEN 'Inspect batch errors and correct the source data before retrying'
            ELSE NULL
          END AS recommended_action,
          CASE
            WHEN status IN ('pending', 'queued', 'processing') AND started_at < ${stuckBeforeParam} THEN TRUE
            ELSE FALSE
          END AS is_stuck,
          employee_dependency_count
          ,store_dependency_count
          ,position_dependency_count
          ,region_dependency_count
          ,company_dependency_count
          ,manager_dependency_count
        FROM per_batch
        WHERE
          (status IN ('pending', 'queued', 'processing') AND started_at < ${stuckBeforeParam})
          OR status IN ('failed', 'completed_with_errors')
      ),
      filtered_action_queue AS MATERIALIZED (
        SELECT *
        FROM action_queue
        WHERE health_state IS NOT NULL
        ${queryClause}
      ),
      totals AS MATERIALIZED (
        SELECT COUNT(*)::text AS total_count
        FROM filtered_action_queue
      ),
      revision_rows AS MATERIALIZED (
        SELECT filtered_action_queue.*
        FROM filtered_action_queue
        CROSS JOIN totals
        WHERE totals.total_count::bigint <= 10000
      ),
      revision_digest AS MATERIALIZED (
        SELECT
          CASE
            WHEN totals.total_count::bigint <= 10000 THEN encode(
              digest(
                convert_to(
                  jsonb_build_array(
                    'integration-needs-action:v1',
                    COALESCE(
                      (
                        SELECT jsonb_agg(
                          jsonb_build_array(
                            revision_row.import_batch_id,
                            revision_row.integration_source_id,
                            revision_row.source_code,
                            revision_row.source_name,
                            revision_row.entity_type,
                            revision_row.source_batch_id,
                            revision_row.source_payload_hash,
                            to_char(revision_row.source_captured_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
                            to_char(revision_row.source_window_started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
                            to_char(revision_row.source_window_ended_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
                            to_char(revision_row.started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
                            to_char(revision_row.finished_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
                            revision_row.status,
                            revision_row.raw_file_name,
                            revision_row.record_count,
                            revision_row.error_count,
                            revision_row.retry_count,
                            to_char(revision_row.last_retried_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
                            revision_row.health_state,
                            revision_row.action_reason,
                            revision_row.recommended_action,
                            revision_row.is_stuck,
                            revision_row.employee_dependency_count::integer,
                            revision_row.store_dependency_count::integer,
                            revision_row.position_dependency_count::integer,
                            revision_row.region_dependency_count::integer,
                            revision_row.company_dependency_count::integer,
                            revision_row.manager_dependency_count::integer
                          )
                          ORDER BY revision_row.started_at DESC, revision_row.import_batch_id DESC
                        )
                        FROM revision_rows revision_row
                      ),
                      '[]'::jsonb
                    )
                  )::text,
                  'UTF8'
                ),
                'sha256'
              ),
              'hex'
            )
            ELSE NULL
          END AS revision
        FROM totals
      ),
      paged AS (
        SELECT *
        FROM filtered_action_queue
        ORDER BY started_at DESC, import_batch_id DESC
        LIMIT $${params.length + 1}
        OFFSET $${params.length + 2}
      )
    `;

    const result = await databaseService.query<{
      row_kind?: "item" | "meta";
      total_count: string;
      revision: string | null;
      import_batch_id: string;
      integration_source_id: string;
      source_code: string;
      source_name: string;
      entity_type: string;
      source_batch_id: string | null;
      source_payload_hash: string | null;
      source_captured_at: string | null;
      source_window_started_at: string | null;
      source_window_ended_at: string | null;
      started_at: string;
      finished_at: string | null;
      status: string;
      raw_file_name: string | null;
      record_count: number;
      error_count: number;
      retry_count: number;
      last_retried_at: string | null;
      health_state: string;
      action_reason: string;
      recommended_action: string;
      is_stuck: boolean;
      employee_dependency_count: string | null;
      store_dependency_count: string | null;
      position_dependency_count: string | null;
      region_dependency_count: string | null;
      company_dependency_count: string | null;
      manager_dependency_count: string | null;
    }>(
      `
        ${baseCte}
        SELECT *
        FROM (
          SELECT
            'item'::text AS row_kind,
            paged.*,
            totals.total_count,
            revision_digest.revision
          FROM paged
          CROSS JOIN totals
          CROSS JOIN revision_digest

          UNION ALL

          SELECT
            'meta'::text AS row_kind,
            NULL AS import_batch_id,
            NULL AS integration_source_id,
            NULL AS source_code,
            NULL AS source_name,
            NULL AS entity_type,
            NULL AS source_batch_id,
            NULL AS source_payload_hash,
            NULL AS source_captured_at,
            NULL AS source_window_started_at,
            NULL AS source_window_ended_at,
            NULL AS started_at,
            NULL AS finished_at,
            NULL AS status,
            NULL AS raw_file_name,
            NULL AS record_count,
            NULL AS error_count,
            NULL AS retry_count,
            NULL AS last_retried_at,
            NULL AS health_state,
            NULL AS action_reason,
            NULL AS recommended_action,
            NULL AS is_stuck,
            NULL AS employee_dependency_count,
            NULL AS store_dependency_count,
            NULL AS position_dependency_count,
            NULL AS region_dependency_count,
            NULL AS company_dependency_count,
            NULL AS manager_dependency_count,
            totals.total_count,
            revision_digest.revision
          FROM totals
          CROSS JOIN revision_digest
          WHERE NOT EXISTS (SELECT 1 FROM paged)
        ) action_result
        ORDER BY
          CASE WHEN row_kind = 'item' THEN 0 ELSE 1 END,
          started_at DESC NULLS LAST,
          import_batch_id DESC NULLS LAST
      `,
      [...params, input.limit ?? 50, input.offset ?? 0],
    );

    return {
      rows: result.rows
        .filter(
          (row) =>
            (row.row_kind === undefined || row.row_kind === "item") &&
            row.import_batch_id !== null,
        )
        .map(
          ({ row_kind: _rowKind, total_count: _totalCount, revision: _revision, ...row }) =>
            row,
        ),
      total: Number(
        result.rows[0]?.total_count ??
          result.rows.filter((row) => row.import_batch_id !== null).length,
      ),
      revision: result.rows.find((row) => row.revision !== undefined)?.revision ?? null,
    };
  }
