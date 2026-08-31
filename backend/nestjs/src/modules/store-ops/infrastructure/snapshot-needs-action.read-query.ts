import { DatabaseService } from "../../../shared/database/database.service";

export type SnapshotRunRow = {
  snapshot_run_id: string;
  company_ids: string[];
  snapshot_date: string;
  snapshot_type: string;
  period_start: string;
  period_end: string;
  run_status: string;
  generated_at: string;
  generated_by: string;
  started_at: string | null;
  finished_at: string | null;
  failure_reason: string | null;
  rerun_of_snapshot_run_id: string | null;
  kpi_config_version_id: string | null;
  kpi_config_version_no: number | null;
};

export type SnapshotNeedsActionRow = SnapshotRunRow & {
  health_state: string;
  action_reason: string;
  recommended_action: string;
  can_rerun: boolean;
  rerun_count: string | number;
  latest_rerun_snapshot_run_id: string | null;
  is_stuck: boolean;
};

export async function listSnapshotRunsNeedingAction(
  databaseService: DatabaseService,
  input: {
    runStatus?: string;
    snapshotType?: string;
    actorCompanyIds?: string[];
    limit?: number;
    offset?: number;
    stuckBefore: string;
  },
  filters: { params: unknown[]; whereClause: string },
): Promise<{
  rows: SnapshotNeedsActionRow[];
  total: number;
  revision: string | null;
}> {
  const { params, whereClause } = filters;
  const stuckBeforeParam = params.length + 1;
  params.push(input.stuckBefore);

  const childScopeClause = input.actorCompanyIds
    ? (() => {
        params.push(input.actorCompanyIds);
        return `AND child.company_ids && $${params.length}::uuid[]`;
      })()
    : "";
  const limit = input.limit ?? 50;
  const offset = input.offset ?? 0;
  params.push(limit, offset);
  const limitParam = params.length - 1;
  const offsetParam = params.length;

  const result = await databaseService.query<{
    row_kind: "item" | "meta";
    snapshot_run_id: string | null;
    company_ids: string[] | null;
    snapshot_date: string | null;
    snapshot_type: string | null;
    period_start: string | null;
    period_end: string | null;
    run_status: string | null;
    generated_at: string | null;
    generated_by: string | null;
    started_at: string | null;
    finished_at: string | null;
    failure_reason: string | null;
    rerun_of_snapshot_run_id: string | null;
    kpi_config_version_id: string | null;
    kpi_config_version_no: number | null;
    health_state: string | null;
    action_reason: string | null;
    recommended_action: string | null;
    can_rerun: boolean | null;
    rerun_count: string | number | null;
    latest_rerun_snapshot_run_id: string | null;
    is_stuck: boolean | null;
    total_count: string | number;
    revision: string | null;
  }>(
    `
        WITH scoped_base_parents AS MATERIALIZED (
          SELECT
            rpt.snapshot_run.snapshot_run_id,
            rpt.snapshot_run.company_ids,
            rpt.snapshot_run.snapshot_date,
            rpt.snapshot_run.snapshot_type,
            rpt.snapshot_run.period_start,
            rpt.snapshot_run.period_end,
            rpt.snapshot_run.run_status,
            rpt.snapshot_run.generated_at,
            rpt.snapshot_run.generated_by,
            rpt.snapshot_run.started_at,
            rpt.snapshot_run.finished_at,
            rpt.snapshot_run.failure_reason,
            rpt.snapshot_run.rerun_of_snapshot_run_id,
            rpt.snapshot_run.kpi_config_version_id
          FROM rpt.snapshot_run
          ${whereClause}
        ),
        action_parents AS MATERIALIZED (
          SELECT *
          FROM scoped_base_parents
          WHERE run_status = 'failed'
             OR (
               run_status IN ('queued', 'running')
               AND generated_at < $${stuckBeforeParam}::timestamptz
             )
        ),
        rerun_aggregates AS MATERIALIZED (
          SELECT
            child.rerun_of_snapshot_run_id,
            COUNT(*)::int AS rerun_count,
            (array_agg(
              child.snapshot_run_id
              ORDER BY child.generated_at DESC, child.snapshot_run_id DESC
            ))[1] AS latest_rerun_snapshot_run_id
          FROM rpt.snapshot_run child
          WHERE child.rerun_of_snapshot_run_id IN (
            SELECT action_parent.snapshot_run_id
            FROM action_parents action_parent
          )
            ${childScopeClause}
          GROUP BY child.rerun_of_snapshot_run_id
        ),
        action_queue AS MATERIALIZED (
          SELECT
            parent.snapshot_run_id,
            parent.company_ids,
            parent.snapshot_date,
            parent.snapshot_type,
            parent.period_start,
            parent.period_end,
            parent.run_status,
            parent.generated_at,
            parent.generated_by,
            parent.started_at,
            parent.finished_at,
            parent.failure_reason,
            parent.rerun_of_snapshot_run_id,
            parent.kpi_config_version_id,
            version.version_no AS kpi_config_version_no,
            CASE
              WHEN parent.run_status IN ('queued', 'running')
                AND parent.generated_at < $${stuckBeforeParam}::timestamptz
                THEN 'stuck'
              WHEN parent.run_status = 'failed' THEN 'retry_ready'
              ELSE NULL
            END AS health_state,
            CASE
              WHEN parent.run_status IN ('queued', 'running')
                AND parent.generated_at < $${stuckBeforeParam}::timestamptz
                THEN 'Snapshot run has exceeded the in-progress time threshold'
              WHEN parent.run_status = 'failed'
                THEN 'Snapshot run failed and can be rerun'
              ELSE NULL
            END AS action_reason,
            CASE
              WHEN parent.run_status IN ('queued', 'running')
                AND parent.generated_at < $${stuckBeforeParam}::timestamptz
                THEN 'Inspect worker execution before requesting another rerun'
              WHEN parent.run_status = 'failed'
                THEN 'Trigger a rerun after verifying the failure cause'
              ELSE NULL
            END AS recommended_action,
            parent.run_status = 'failed' AS can_rerun,
            COALESCE(reruns.rerun_count, 0)::int AS rerun_count,
            reruns.latest_rerun_snapshot_run_id,
            CASE
              WHEN parent.run_status IN ('queued', 'running')
                AND parent.generated_at < $${stuckBeforeParam}::timestamptz
                THEN TRUE
              ELSE FALSE
            END AS is_stuck
          FROM action_parents parent
          LEFT JOIN ops.kpi_config_version version
            ON version.kpi_config_version_id = parent.kpi_config_version_id
          LEFT JOIN rerun_aggregates reruns
            ON reruns.rerun_of_snapshot_run_id = parent.snapshot_run_id
        ),
        filtered_action_queue AS MATERIALIZED (
          SELECT *
          FROM action_queue
          WHERE health_state IS NOT NULL
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
                      'snapshot-needs-action:v1',
                      COALESCE(
                        (
                          SELECT jsonb_agg(
                            jsonb_build_array(
                              revision_row.snapshot_run_id::text,
                              revision_row.snapshot_date::text,
                              revision_row.snapshot_type,
                              revision_row.run_status,
                              revision_row.health_state,
                              to_char(revision_row.generated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
                              revision_row.period_start::text,
                              revision_row.period_end::text,
                              revision_row.generated_by::text,
                              to_char(revision_row.started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
                              to_char(revision_row.finished_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
                              revision_row.failure_reason,
                              revision_row.rerun_of_snapshot_run_id::text,
                              revision_row.kpi_config_version_id::text,
                              revision_row.kpi_config_version_no,
                              CASE
                                WHEN revision_row.kpi_config_version_id IS NULL
                                  THEN 'pre_governance'
                                ELSE 'versioned'
                              END,
                              revision_row.action_reason,
                              revision_row.recommended_action,
                              revision_row.can_rerun,
                              revision_row.rerun_count,
                              revision_row.latest_rerun_snapshot_run_id::text,
                              revision_row.is_stuck,
                              COALESCE(
                                (
                                  SELECT jsonb_agg(company.company_id::text ORDER BY company.company_id)
                                  FROM unnest(revision_row.company_ids) AS company(company_id)
                                ),
                                '[]'::jsonb
                              )
                            )
                            ORDER BY revision_row.generated_at DESC, revision_row.snapshot_run_id DESC
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
          ORDER BY generated_at DESC, snapshot_run_id DESC
          LIMIT $${limitParam}
          OFFSET $${offsetParam}
        )
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
            NULL AS snapshot_run_id,
            NULL AS company_ids,
            NULL AS snapshot_date,
            NULL AS snapshot_type,
            NULL AS period_start,
            NULL AS period_end,
            NULL AS run_status,
            NULL AS generated_at,
            NULL AS generated_by,
            NULL AS started_at,
            NULL AS finished_at,
            NULL AS failure_reason,
            NULL AS rerun_of_snapshot_run_id,
            NULL AS kpi_config_version_id,
            NULL AS kpi_config_version_no,
            NULL AS health_state,
            NULL AS action_reason,
            NULL AS recommended_action,
            NULL AS can_rerun,
            NULL AS rerun_count,
            NULL AS latest_rerun_snapshot_run_id,
            NULL AS is_stuck,
            totals.total_count,
            revision_digest.revision
          FROM totals
          CROSS JOIN revision_digest
          WHERE NOT EXISTS (SELECT 1 FROM paged)
        ) action_result
        ORDER BY
          CASE WHEN row_kind = 'item' THEN 0 ELSE 1 END,
          generated_at DESC NULLS LAST,
          snapshot_run_id DESC NULLS LAST
      `,
    params,
  );

  const pageRows = result.rows.filter(
    (row) => row.row_kind !== "meta" && Boolean(row.snapshot_run_id),
  );
  const metadataRow = result.rows.find((row) => row.total_count !== undefined);

  return {
    rows: pageRows.map(
      ({
        row_kind: _rowKind,
        total_count: _totalCount,
        revision: _revision,
        ...row
      }) => row as SnapshotNeedsActionRow,
    ),
    total: Number(metadataRow?.total_count ?? 0),
    revision: metadataRow?.revision ?? null,
  };
}
