import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";
import { type ImportBatchEntityType } from "./import-batch-raw-writer.repository";

type ImportBatchReadFilters = {
  actorCompanyIds: string[];
  status?: string;
  entityType?: string;
  sourceCode?: string;
  startedFrom?: string;
  startedTo?: string;
};

@Injectable()
export class ImportBatchReadRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  private buildImportBatchFilters(
    input: ImportBatchReadFilters,
    batchAlias = "stg.import_batch",
    sourceAlias = "src",
  ) {
    const conditions: string[] = [`${batchAlias}.company_ids && $1::uuid[]`];
    const params: unknown[] = [input.actorCompanyIds];

    if (input.status) {
      params.push(input.status);
      conditions.push(`${batchAlias}.status = $${params.length}`);
    }

    if (input.entityType) {
      params.push(input.entityType);
      conditions.push(`${batchAlias}.entity_type = $${params.length}`);
    }

    if (input.sourceCode) {
      params.push(input.sourceCode);
      conditions.push(`${sourceAlias}.source_code = $${params.length}`);
    }

    if (input.startedFrom) {
      params.push(input.startedFrom);
      conditions.push(`${batchAlias}.started_at >= $${params.length}::timestamptz`);
    }

    if (input.startedTo) {
      params.push(input.startedTo);
      conditions.push(`${batchAlias}.started_at <= $${params.length}::timestamptz`);
    }

    return {
      conditions,
      params,
      whereClause: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    };
  }

  private getImportRawUnionSql() {
    return `
      SELECT import_batch_id, normalized_status, validation_error FROM stg.employee_raw
      UNION ALL
      SELECT import_batch_id, normalized_status, validation_error FROM stg.store_raw
      UNION ALL
      SELECT import_batch_id, normalized_status, validation_error FROM stg.kpi_raw
      UNION ALL
      SELECT import_batch_id, normalized_status, validation_error FROM stg.assignment_raw
      UNION ALL
      SELECT import_batch_id, normalized_status, validation_error FROM stg.position_raw
      UNION ALL
      SELECT import_batch_id, normalized_status, validation_error FROM stg.company_raw
      UNION ALL
      SELECT import_batch_id, normalized_status, validation_error FROM stg.region_raw
    `;
  }

  private getMissingDependencyPredicate(alias = "raw") {
    return `
      ${alias}.validation_error ILIKE '%employee reference could not be resolved%'
      OR ${alias}.validation_error ILIKE '%store reference could not be resolved%'
      OR ${alias}.validation_error ILIKE '%position reference could not be resolved%'
      OR ${alias}.validation_error ILIKE '%region could not be resolved%'
      OR ${alias}.validation_error ILIKE '%company could not be resolved%'
      OR ${alias}.validation_error ILIKE '%manager%could not be resolved%'
    `;
  }

  async listImportBatches(input: ImportBatchReadFilters & {
    limit?: number;
    offset?: number;
  }) {
    const { params, whereClause } = this.buildImportBatchFilters(input);

    const totalResult = await this.databaseService.query<{ total_count: string }>(
      `
        SELECT COUNT(*)::text AS total_count
        FROM stg.import_batch
        INNER JOIN stg.integration_source src
          ON src.integration_source_id = stg.import_batch.integration_source_id
        ${whereClause}
      `,
      params,
    );

    const listParams = [...params, input.limit ?? 50, input.offset ?? 0];
    const result = await this.databaseService.query<{
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
    }>(
      `
        SELECT
          import_batch_id,
          integration_source_id,
          src.source_code,
          src.source_name,
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
          last_retried_at
        FROM stg.import_batch
        INNER JOIN stg.integration_source src
          ON src.integration_source_id = stg.import_batch.integration_source_id
        ${whereClause}
        ORDER BY started_at DESC, import_batch_id DESC
        LIMIT $${params.length + 1}
        OFFSET $${params.length + 2}
      `,
      listParams,
    );

    return {
      rows: result.rows,
      total: Number(totalResult.rows[0]?.total_count ?? 0),
    };
  }

  async getImportBatchSummary(input: ImportBatchReadFilters) {
    const { params, whereClause } = this.buildImportBatchFilters(input);

    const totalResult = await this.databaseService.query<{ total_count: string }>(
      `
        SELECT COUNT(*)::text AS total_count
        FROM stg.import_batch
        INNER JOIN stg.integration_source src
          ON src.integration_source_id = stg.import_batch.integration_source_id
        ${whereClause}
      `,
      params,
    );

    const groupedResult = await this.databaseService.query<{
      status: string;
      batch_count: string;
    }>(
      `
        SELECT status, COUNT(*)::text AS batch_count
        FROM stg.import_batch
        INNER JOIN stg.integration_source src
          ON src.integration_source_id = stg.import_batch.integration_source_id
        ${whereClause}
        GROUP BY status
      `,
      params,
    );

    const totals = {
      all: Number(totalResult.rows[0]?.total_count ?? 0),
      completed: 0,
      failed: 0,
      completedWithErrors: 0,
      pending: 0,
      queued: 0,
      processing: 0,
    };

    for (const row of groupedResult.rows) {
      if (row.status === "completed") totals.completed = Number(row.batch_count);
      if (row.status === "failed") totals.failed = Number(row.batch_count);
      if (row.status === "completed_with_errors") {
        totals.completedWithErrors = Number(row.batch_count);
      }
      if (row.status === "pending") totals.pending = Number(row.batch_count);
      if (row.status === "queued") totals.queued = Number(row.batch_count);
      if (row.status === "processing") totals.processing = Number(row.batch_count);
    }

    return totals;
  }

  async getLatestImportBatchIdByStatus(input: ImportBatchReadFilters & { status: string }) {
    const { conditions, params } = this.buildImportBatchFilters(input);
    params.push(input.status);
    conditions.push(`stg.import_batch.status = $${params.length}`);
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await this.databaseService.query<{ import_batch_id: string }>(
      `
        SELECT import_batch_id
        FROM stg.import_batch
        INNER JOIN stg.integration_source src
          ON src.integration_source_id = stg.import_batch.integration_source_id
        ${whereClause}
        ORDER BY started_at DESC, import_batch_id DESC
        LIMIT 1
      `,
      params,
    );

    return result.rows[0]?.import_batch_id ?? null;
  }

  async getImportBatchActionCounts(input: ImportBatchReadFilters & { stuckBefore: string }) {
    const { params, whereClause } = this.buildImportBatchFilters(input, "b", "src");
    params.push(input.stuckBefore);
    const stuckBeforeParam = `$${params.length}::timestamptz`;

    const result = await this.databaseService.query<{
      blocked_count: string;
      retry_ready_count: string;
      needs_action_count: string;
      stuck_count: string;
    }>(
      `
        WITH filtered_batches AS (
          SELECT
            b.import_batch_id,
            b.status,
            b.started_at
          FROM stg.import_batch b
          INNER JOIN stg.integration_source src
            ON src.integration_source_id = b.integration_source_id
          ${whereClause}
        ),
        raw_all AS (
          ${this.getImportRawUnionSql()}
        ),
        per_batch AS (
          SELECT
            fb.import_batch_id,
            fb.status,
            fb.started_at,
            COALESCE(
              BOOL_OR(
                raw.normalized_status = 'retryable_error'
                AND (${this.getMissingDependencyPredicate("raw")})
              ),
              FALSE
            ) AS has_dependency_blockers,
            COALESCE(BOOL_OR(raw.normalized_status = 'retryable_error'), FALSE) AS has_retryable_error
          FROM filtered_batches fb
          LEFT JOIN raw_all raw
            ON raw.import_batch_id = fb.import_batch_id
          GROUP BY fb.import_batch_id, fb.status, fb.started_at
        ),
        action_totals AS (
          SELECT
            COUNT(*) FILTER (
              WHERE status IN ('failed', 'completed_with_errors')
                AND has_dependency_blockers
            )::text AS blocked_count,
            COUNT(*) FILTER (
              WHERE status IN ('failed', 'completed_with_errors')
                AND has_retryable_error
                AND NOT has_dependency_blockers
            )::text AS retry_ready_count,
            COUNT(*) FILTER (
              WHERE status IN ('failed', 'completed_with_errors')
                AND NOT has_retryable_error
            )::text AS needs_action_count,
            COUNT(*) FILTER (
              WHERE status IN ('pending', 'queued', 'processing')
                AND started_at < ${stuckBeforeParam}
            )::text AS stuck_count
          FROM per_batch
        )
        SELECT * FROM action_totals
      `,
      params,
    );

    return {
      blocked: Number(result.rows[0]?.blocked_count ?? 0),
      retryReady: Number(result.rows[0]?.retry_ready_count ?? 0),
      needsAction: Number(result.rows[0]?.needs_action_count ?? 0),
      stuck: Number(result.rows[0]?.stuck_count ?? 0),
    };
  }

  async getLatestStuckImportBatchId(input: ImportBatchReadFilters & { stuckBefore: string }) {
    const { conditions, params } = this.buildImportBatchFilters(input);
    params.push(input.stuckBefore);
    conditions.push(`stg.import_batch.status IN ('pending', 'queued', 'processing')`);
    conditions.push(`stg.import_batch.started_at < $${params.length}::timestamptz`);
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await this.databaseService.query<{ import_batch_id: string }>(
      `
        SELECT /* latest_stuck_batch */ import_batch_id
        FROM stg.import_batch
        INNER JOIN stg.integration_source src
          ON src.integration_source_id = stg.import_batch.integration_source_id
        ${whereClause}
        ORDER BY started_at DESC, import_batch_id DESC
        LIMIT 1
      `,
      params,
    );

    return result.rows[0]?.import_batch_id ?? null;
  }

  async listImportBatchesNeedingAction(input: ImportBatchReadFilters & {
    limit?: number;
    offset?: number;
    stuckBefore: string;
  }) {
    const { params, whereClause } = this.buildImportBatchFilters(input, "b", "src");
    params.push(input.stuckBefore);
    const stuckBeforeParam = `$${params.length}::timestamptz`;

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
        ${this.getImportRawUnionSql()}
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
              AND (${this.getMissingDependencyPredicate("raw")})
            ),
            FALSE
          ) AS has_dependency_blockers,
          COALESCE(BOOL_OR(raw.normalized_status = 'retryable_error'), FALSE) AS has_retryable_error
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
          END AS is_stuck
        FROM per_batch
        WHERE
          (status IN ('pending', 'queued', 'processing') AND started_at < ${stuckBeforeParam})
          OR status IN ('failed', 'completed_with_errors')
      )
    `;

    const totalResult = await this.databaseService.query<{ total_count: string }>(
      `
        ${baseCte}
        SELECT COUNT(*)::text AS total_count
        FROM action_queue
        WHERE health_state IS NOT NULL
      `,
      params,
    );

    const listParams = [...params, input.limit ?? 50, input.offset ?? 0];
    const result = await this.databaseService.query<{
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
    }>(
      `
        ${baseCte}
        SELECT *
        FROM action_queue
        WHERE health_state IS NOT NULL
        ORDER BY started_at DESC, import_batch_id DESC
        LIMIT $${params.length + 1}
        OFFSET $${params.length + 2}
      `,
      listParams,
    );

    return {
      rows: result.rows,
      total: Number(totalResult.rows[0]?.total_count ?? 0),
    };
  }

  private getRawTableMetadata(
    entityType: ImportBatchEntityType,
  ) {
    switch (entityType) {
      case "employee":
        return {
          tableName: "stg.employee_raw",
          rowIdColumn: "stg_employee_raw_id",
          sourceRefColumn: "source_employee_id",
        };
      case "store":
        return {
          tableName: "stg.store_raw",
          rowIdColumn: "stg_store_raw_id",
          sourceRefColumn: "source_store_id",
        };
      case "kpi":
        return {
          tableName: "stg.kpi_raw",
          rowIdColumn: "stg_kpi_raw_id",
          sourceRefColumn: "source_metric_id",
        };
      case "assignment":
        return {
          tableName: "stg.assignment_raw",
          rowIdColumn: "stg_assignment_raw_id",
          sourceRefColumn: "source_assignment_id",
        };
      case "position":
        return {
          tableName: "stg.position_raw",
          rowIdColumn: "stg_position_raw_id",
          sourceRefColumn: "source_position_id",
        };
      case "company":
        return {
          tableName: "stg.company_raw",
          rowIdColumn: "stg_company_raw_id",
          sourceRefColumn: "source_company_id",
        };
      case "region":
        return {
          tableName: "stg.region_raw",
          rowIdColumn: "stg_region_raw_id",
          sourceRefColumn: "source_region_id",
        };
    }
  }

  async getImportBatch(input: { actorCompanyIds: string[]; batchId: string }) {
    const result = await this.databaseService.query<{
      import_batch_id: string;
      integration_source_id: string;
      source_code: string;
      source_name: string;
      entity_type:
        | "employee"
        | "store"
        | "kpi"
        | "assignment"
        | "position"
        | "company"
        | "region";
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
    }>(
      `
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
        WHERE b.import_batch_id = $1
          AND b.company_ids && $2::uuid[]
        LIMIT 1
      `,
      [input.batchId, input.actorCompanyIds],
    );

    return result.rows[0] ?? null;
  }

  async getImportBatchRowStatusSummary(
    batchId: string,
    entityType:
      | "employee"
      | "store"
      | "kpi"
      | "assignment"
      | "position"
      | "company"
      | "region",
  ) {
    const metadata = this.getRawTableMetadata(entityType);
    const result = await this.databaseService.query<{
      normalized_status: string;
      row_count: string;
    }>(
      `
        SELECT normalized_status, COUNT(*)::text AS row_count
        FROM ${metadata.tableName}
        WHERE import_batch_id = $1
        GROUP BY normalized_status
      `,
      [batchId],
    );

    return result.rows;
  }

  async getImportBatchLineageSummary(batchId: string) {
    const result = await this.databaseService.query<{
      row_hash_count: string;
      raw_row_reference_count: string;
      sample_row_hash: string | null;
      sample_raw_row_reference: string | null;
    }>(
      `
        SELECT
          COUNT(*) FILTER (WHERE row_hash IS NOT NULL)::text AS row_hash_count,
          COUNT(*) FILTER (WHERE raw_row_reference IS NOT NULL)::text AS raw_row_reference_count,
          MIN(row_hash) FILTER (WHERE row_hash IS NOT NULL) AS sample_row_hash,
          MIN(raw_row_reference) FILTER (WHERE raw_row_reference IS NOT NULL) AS sample_raw_row_reference
        FROM stg.kpi_raw
        WHERE import_batch_id = $1
      `,
      [batchId],
    );

    return result.rows[0] ?? null;
  }

  async getImportBatchQualityIssueRows(
    batchId: string,
    entityType:
      | "employee"
      | "store"
      | "kpi"
      | "assignment"
      | "position"
      | "company"
      | "region",
  ) {
    const metadata = this.getRawTableMetadata(entityType);
    const result = await this.databaseService.query<{
      normalized_status: string;
      validation_error: string | null;
      row_count: string;
    }>(
      `
        SELECT
          normalized_status,
          validation_error,
          COUNT(*)::text AS row_count
        FROM ${metadata.tableName}
        WHERE import_batch_id = $1
          AND normalized_status IN ('validation_failed', 'retryable_error')
        GROUP BY validation_error, normalized_status
        ORDER BY COUNT(*) DESC, normalized_status ASC, validation_error ASC
      `,
      [batchId],
    );

    return result.rows;
  }

  async getImportBatchErrors(input: {
    batchId: string;
    entityType:
      | "employee"
      | "store"
      | "kpi"
      | "assignment"
      | "position"
      | "company"
      | "region";
    limit?: number;
    offset?: number;
  }) {
    const metadata = this.getRawTableMetadata(input.entityType);
    const filterClause = `
      WHERE import_batch_id = $1
        AND normalized_status IN ('validation_failed', 'retryable_error')
    `;

    const totalResult = await this.databaseService.query<{ total_count: string }>(
      `
        SELECT COUNT(*)::text AS total_count
        FROM ${metadata.tableName}
        ${filterClause}
      `,
      [input.batchId],
    );

    const params: unknown[] = [input.batchId, input.limit ?? 50, input.offset ?? 0];
    const result = await this.databaseService.query<{
      row_id: string;
      source_ref: string;
      store_external_ref: string | null;
      employee_external_ref: string | null;
      payload_json: Record<string, unknown> | null;
      row_hash: string | null;
      raw_row_reference: string | null;
      normalized_status: string;
      validation_error: string | null;
      processed_at: string | null;
    }>(
      `
        SELECT
          ${metadata.rowIdColumn} AS row_id,
          ${metadata.sourceRefColumn} AS source_ref,
          ${input.entityType === "kpi" ? "store_external_ref" : "NULL::text"} AS store_external_ref,
          ${input.entityType === "kpi" ? "employee_external_ref" : "NULL::text"} AS employee_external_ref,
          payload_json,
          ${input.entityType === "kpi" ? "row_hash" : "NULL::text"} AS row_hash,
          ${input.entityType === "kpi" ? "raw_row_reference" : "NULL::text"} AS raw_row_reference,
          normalized_status,
          validation_error,
          processed_at
        FROM ${metadata.tableName}
        ${filterClause}
        ORDER BY processed_at DESC NULLS LAST, ${metadata.rowIdColumn} ASC
        LIMIT $2
        OFFSET $3
      `,
      params,
    );

    return {
      rows: result.rows,
      total: Number(totalResult.rows[0]?.total_count ?? 0),
    };
  }

  async getImportBatchDependencySummary(
    batchId: string,
    entityType:
      | "employee"
      | "store"
      | "kpi"
      | "assignment"
      | "position"
      | "company"
      | "region",
  ) {
    const metadata = this.getRawTableMetadata(entityType);
    const result = await this.databaseService.query<{
      employee_count: string;
      store_count: string;
      position_count: string;
      region_count: string;
      company_count: string;
      manager_count: string;
    }>(
      `
        SELECT
          SUM(CASE WHEN validation_error ILIKE '%employee reference could not be resolved%' THEN 1 ELSE 0 END)::text AS employee_count,
          SUM(CASE WHEN validation_error ILIKE '%store reference could not be resolved%' THEN 1 ELSE 0 END)::text AS store_count,
          SUM(CASE WHEN validation_error ILIKE '%position reference could not be resolved%' THEN 1 ELSE 0 END)::text AS position_count,
          SUM(CASE WHEN validation_error ILIKE '%region could not be resolved%' THEN 1 ELSE 0 END)::text AS region_count,
          SUM(CASE WHEN validation_error ILIKE '%company could not be resolved%' THEN 1 ELSE 0 END)::text AS company_count,
          SUM(CASE WHEN validation_error ILIKE '%manager%could not be resolved%' THEN 1 ELSE 0 END)::text AS manager_count
        FROM ${metadata.tableName}
        WHERE import_batch_id = $1
          AND normalized_status = 'retryable_error'
      `,
      [batchId],
    );

    return result.rows[0] ?? null;
  }


  async getImportBatchAudit(batchId: string) {
    const result = await this.databaseService.query<{
      event_log_id: string;
      occurred_at: string;
      actor_user_id: string | null;
      event_type: string;
      metadata_json: Record<string, unknown>;
    }>(
      `
        SELECT
          event_log_id,
          occurred_at,
          actor_user_id,
          event_type,
          metadata_json
        FROM audit.event_log
        WHERE entity_name = 'stg.import_batch'
          AND entity_id = $1::uuid
        ORDER BY occurred_at ASC, event_log_id ASC
      `,
      [batchId],
    );

    return result.rows;
  }

}
