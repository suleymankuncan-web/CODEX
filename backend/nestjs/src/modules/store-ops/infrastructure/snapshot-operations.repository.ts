import { Injectable } from "@nestjs/common";
import { RequestContextStore } from "../../../shared/request-context";
import { DatabaseService } from "../../../shared/database/database.service";

type Queryable = {
  query: <T>(sql: string, params?: unknown[]) => Promise<{ rowCount: number; rows: T[] }>;
};

type SnapshotRunRow = {
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

@Injectable()
export class SnapshotOperationsRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  private buildSnapshotRunFilters(
    input: { runStatus?: string; snapshotType?: string; actorCompanyIds?: string[] },
    runAlias = "rpt.snapshot_run",
  ) {
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (input.runStatus) {
      params.push(input.runStatus);
      clauses.push(`${runAlias}.run_status = $${params.length}`);
    }

    if (input.snapshotType) {
      params.push(input.snapshotType);
      clauses.push(`${runAlias}.snapshot_type = $${params.length}`);
    }

    if (input.actorCompanyIds) {
      params.push(input.actorCompanyIds);
      clauses.push(`${runAlias}.company_ids && $${params.length}::uuid[]`);
    }

    return {
      clauses,
      params,
      whereClause: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
    };
  }

  async findSnapshotRunById(input: string | { snapshotRunId: string; actorCompanyIds?: string[] }) {
    const { snapshotRunId, actorCompanyIds } = this.resolveScopedSnapshotRunInput(input);
    const params: unknown[] = [snapshotRunId];
    const companyScopeClause = this.buildCompanyScopeClause(actorCompanyIds, params);
    const result = await this.databaseService.query<SnapshotRunRow>(
      `
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
          rpt.snapshot_run.kpi_config_version_id,
          version.version_no AS kpi_config_version_no
        FROM rpt.snapshot_run
        LEFT JOIN ops.kpi_config_version version
          ON version.kpi_config_version_id = rpt.snapshot_run.kpi_config_version_id
        WHERE rpt.snapshot_run.snapshot_run_id = $1::uuid
        ${companyScopeClause}
        LIMIT 1
      `,
      params,
    );

    return result.rows[0] ?? null;
  }

  async listSnapshotRuns(input: {
    runStatus?: string;
    snapshotType?: string;
    actorCompanyIds?: string[];
    limit?: number;
    offset?: number;
  }) {
    const { params, whereClause } = this.buildSnapshotRunFilters(input);
    const limit = input.limit ?? 50;
    const offset = input.offset ?? 0;

    const rows = await this.databaseService.query<SnapshotRunRow>(
      `
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
          rpt.snapshot_run.kpi_config_version_id,
          version.version_no AS kpi_config_version_no
        FROM rpt.snapshot_run
        LEFT JOIN ops.kpi_config_version version
          ON version.kpi_config_version_id = rpt.snapshot_run.kpi_config_version_id
        ${whereClause}
        ORDER BY rpt.snapshot_run.generated_at DESC
        LIMIT $${params.length + 1}
        OFFSET $${params.length + 2}
      `,
      [...params, limit, offset],
    );

    const totalResult = await this.databaseService.query<{ total_count: string }>(
      `
        SELECT COUNT(*)::text AS total_count
        FROM rpt.snapshot_run
        ${whereClause}
      `,
      params,
    );

    return {
      rows: rows.rows,
      total: Number(totalResult.rows[0]?.total_count ?? 0),
    };
  }

  async getSnapshotRunSummary(input: {
    runStatus?: string;
    snapshotType?: string;
    actorCompanyIds?: string[];
  }) {
    const { params, whereClause } = this.buildSnapshotRunFilters(input);

    const grouped = await this.databaseService.query<{
      run_status: string;
      run_count: string;
    }>(
      `
        SELECT run_status, COUNT(*)::text AS run_count
        FROM rpt.snapshot_run
        ${whereClause}
        GROUP BY run_status
      `,
      params,
    );

    const totalResult = await this.databaseService.query<{ total_count: string }>(
      `
        SELECT COUNT(*)::text AS total_count
        FROM rpt.snapshot_run
        ${whereClause}
      `,
      params,
    );

    return {
      rows: grouped.rows,
      total: Number(totalResult.rows[0]?.total_count ?? 0),
    };
  }

  async getLatestSnapshotRunIdByStatus(input: {
    runStatus: string;
    snapshotType?: string;
    actorCompanyIds?: string[];
  }) {
    const { clauses, params } = this.buildSnapshotRunFilters({
      snapshotType: input.snapshotType,
      actorCompanyIds: input.actorCompanyIds,
    });
    params.push(input.runStatus);
    clauses.push(`rpt.snapshot_run.run_status = $${params.length}`);
    const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

    const result = await this.databaseService.query<{ snapshot_run_id: string }>(
      `
        SELECT rpt.snapshot_run.snapshot_run_id
        FROM rpt.snapshot_run
        ${whereClause}
        ORDER BY rpt.snapshot_run.generated_at DESC, rpt.snapshot_run.snapshot_run_id DESC
        LIMIT 1
      `,
      params,
    );

    return result.rows[0]?.snapshot_run_id ?? null;
  }

  async findLatestSnapshotRunByTypeAndPeriod(input: {
    snapshotType: string;
    periodStart: string;
    periodEnd: string;
    actorCompanyIds?: string[];
  }) {
    const params: unknown[] = [input.snapshotType, input.periodStart, input.periodEnd];
    const companyScopeClause = this.buildCompanyScopeClause(input.actorCompanyIds, params);
    const result = await this.databaseService.query<SnapshotRunRow>(
      `
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
          rpt.snapshot_run.kpi_config_version_id,
          version.version_no AS kpi_config_version_no
        FROM rpt.snapshot_run
        LEFT JOIN ops.kpi_config_version version
          ON version.kpi_config_version_id = rpt.snapshot_run.kpi_config_version_id
        WHERE rpt.snapshot_run.snapshot_type = $1
          AND rpt.snapshot_run.period_start = $2::date
          AND rpt.snapshot_run.period_end = $3::date
          ${companyScopeClause}
        ORDER BY rpt.snapshot_run.generated_at DESC, rpt.snapshot_run.snapshot_run_id DESC
        LIMIT 1
      `,
      params,
    );

    return result.rows[0] ?? null;
  }

  async getSnapshotRunActionCounts(input: {
    runStatus?: string;
    snapshotType?: string;
    actorCompanyIds?: string[];
    stuckBefore: string;
  }) {
    const { params, whereClause } = this.buildSnapshotRunFilters(input);
    params.push(input.stuckBefore);

    const result = await this.databaseService.query<{
      retry_ready_count: string;
      stuck_count: string;
    }>(
      `
        WITH action_totals AS (
          SELECT
            COUNT(*) FILTER (
              WHERE rpt.snapshot_run.run_status = 'failed'
            )::text AS retry_ready_count,
            COUNT(*) FILTER (
              WHERE rpt.snapshot_run.run_status IN ('queued', 'running')
                AND rpt.snapshot_run.generated_at < $${params.length}::timestamptz
            )::text AS stuck_count
          FROM rpt.snapshot_run
          ${whereClause}
        )
        SELECT * FROM action_totals
      `,
      params,
    );

    return {
      retryReady: Number(result.rows[0]?.retry_ready_count ?? 0),
      stuck: Number(result.rows[0]?.stuck_count ?? 0),
    };
  }

  async getLatestStuckSnapshotRunId(input: {
    runStatus?: string;
    snapshotType?: string;
    actorCompanyIds?: string[];
    stuckBefore: string;
  }) {
    const { clauses, params } = this.buildSnapshotRunFilters(input);
    params.push(input.stuckBefore);
    clauses.push(`rpt.snapshot_run.run_status IN ('queued', 'running')`);
    clauses.push(`rpt.snapshot_run.generated_at < $${params.length}::timestamptz`);
    const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

    const result = await this.databaseService.query<{ snapshot_run_id: string }>(
      `
        SELECT /* latest_stuck_snapshot_run */ rpt.snapshot_run.snapshot_run_id
        FROM rpt.snapshot_run
        ${whereClause}
        ORDER BY rpt.snapshot_run.generated_at DESC, rpt.snapshot_run.snapshot_run_id DESC
        LIMIT 1
      `,
      params,
    );

    return result.rows[0]?.snapshot_run_id ?? null;
  }

  async listSnapshotRunsNeedingAction(input: {
    runStatus?: string;
    snapshotType?: string;
    actorCompanyIds?: string[];
    limit?: number;
    offset?: number;
    stuckBefore: string;
  }) {
    const { params, whereClause } = this.buildSnapshotRunFilters(input);
    params.push(input.stuckBefore);

    const baseCte = `
      WITH action_queue AS (
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
          rpt.snapshot_run.kpi_config_version_id,
          version.version_no AS kpi_config_version_no,
          CASE
            WHEN rpt.snapshot_run.run_status IN ('queued', 'running') AND rpt.snapshot_run.generated_at < $${params.length}::timestamptz THEN 'stuck'
            WHEN rpt.snapshot_run.run_status = 'failed' THEN 'retry_ready'
            ELSE NULL
          END AS health_state,
          CASE
            WHEN rpt.snapshot_run.run_status IN ('queued', 'running') AND rpt.snapshot_run.generated_at < $${params.length}::timestamptz THEN 'Snapshot run has exceeded the in-progress time threshold'
            WHEN rpt.snapshot_run.run_status = 'failed' THEN 'Snapshot run failed and can be rerun'
            ELSE NULL
          END AS action_reason,
          CASE
            WHEN rpt.snapshot_run.run_status IN ('queued', 'running') AND rpt.snapshot_run.generated_at < $${params.length}::timestamptz THEN 'Inspect worker execution before requesting another rerun'
            WHEN rpt.snapshot_run.run_status = 'failed' THEN 'Trigger a rerun after verifying the failure cause'
            ELSE NULL
          END AS recommended_action,
          CASE
            WHEN rpt.snapshot_run.run_status IN ('queued', 'running') AND rpt.snapshot_run.generated_at < $${params.length}::timestamptz THEN TRUE
          ELSE FALSE
          END AS is_stuck
        FROM rpt.snapshot_run
        LEFT JOIN ops.kpi_config_version version
          ON version.kpi_config_version_id = rpt.snapshot_run.kpi_config_version_id
        ${whereClause}
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
      snapshot_run_id: string;
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
        ORDER BY generated_at DESC, snapshot_run_id DESC
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

  async getSnapshotRunAudit(snapshotRunId: string) {
    const result = await this.databaseService.query<{
      event_log_id: string;
      occurred_at: string;
      actor_user_id: string | null;
      event_type: string;
      metadata_json: Record<string, unknown>;
    }>(
      `
        SELECT event_log_id, occurred_at, actor_user_id, event_type, metadata_json
        FROM audit.event_log
        WHERE entity_name = 'rpt.snapshot_run'
          AND entity_id = $1::uuid
        ORDER BY occurred_at ASC
      `,
      [snapshotRunId],
    );

    return result.rows;
  }

  async getSnapshotRowCounts(snapshotRunId: string, actorCompanyIds?: string[]) {
    const [workforce, kpis, checklists, turnover] = await Promise.all([
      this.countSnapshotRows("rpt.store_workforce_snapshot", snapshotRunId, actorCompanyIds),
      this.countSnapshotRows("rpt.store_kpi_snapshot", snapshotRunId, actorCompanyIds),
      this.countSnapshotRows("rpt.store_checklist_snapshot", snapshotRunId, actorCompanyIds),
      this.countSnapshotRows("rpt.turnover_snapshot", snapshotRunId, actorCompanyIds),
    ]);

    return {
      workforceRows: workforce,
      kpiRows: kpis,
      checklistRows: checklists,
      turnoverRows: turnover,
    };
  }

  async countReruns(input: string | { snapshotRunId: string; actorCompanyIds?: string[] }) {
    const { snapshotRunId, actorCompanyIds } = this.resolveScopedSnapshotRunInput(input);
    const params: unknown[] = [snapshotRunId];
    const companyScopeClause = this.buildCompanyScopeClause(actorCompanyIds, params);
    const result = await this.databaseService.query<{ rerun_count: string }>(
      `
        SELECT COUNT(*)::text AS rerun_count
        FROM rpt.snapshot_run
        WHERE rerun_of_snapshot_run_id = $1::uuid
        ${companyScopeClause}
      `,
      params,
    );

    return Number(result.rows[0]?.rerun_count ?? 0);
  }

  async getLatestRerunSnapshotRunId(
    input: string | { snapshotRunId: string; actorCompanyIds?: string[] },
  ) {
    const { snapshotRunId, actorCompanyIds } = this.resolveScopedSnapshotRunInput(input);
    const params: unknown[] = [snapshotRunId];
    const companyScopeClause = this.buildCompanyScopeClause(actorCompanyIds, params);
    const result = await this.databaseService.query<{ snapshot_run_id: string }>(
      `
        SELECT snapshot_run_id
        FROM rpt.snapshot_run
        WHERE rerun_of_snapshot_run_id = $1::uuid
        ${companyScopeClause}
        ORDER BY generated_at DESC
        LIMIT 1
      `,
      params,
    );

    return result.rows[0]?.snapshot_run_id ?? null;
  }

  async listRerunChildren(input: string | { snapshotRunId: string; actorCompanyIds?: string[] }) {
    const { snapshotRunId, actorCompanyIds } = this.resolveScopedSnapshotRunInput(input);
    const params: unknown[] = [snapshotRunId];
    const companyScopeClause = this.buildCompanyScopeClause(actorCompanyIds, params);
    const result = await this.databaseService.query<SnapshotRunRow>(
      `
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
          rpt.snapshot_run.kpi_config_version_id,
          version.version_no AS kpi_config_version_no
        FROM rpt.snapshot_run
        LEFT JOIN ops.kpi_config_version version
          ON version.kpi_config_version_id = rpt.snapshot_run.kpi_config_version_id
        WHERE rpt.snapshot_run.rerun_of_snapshot_run_id = $1::uuid
        ${companyScopeClause}
        ORDER BY rpt.snapshot_run.generated_at ASC, rpt.snapshot_run.snapshot_run_id ASC
      `,
      params,
    );

    return result.rows;
  }

  async countActiveReruns(input: string | { snapshotRunId: string; actorCompanyIds?: string[] }) {
    const { snapshotRunId, actorCompanyIds } = this.resolveScopedSnapshotRunInput(input);
    const params: unknown[] = [snapshotRunId];
    const companyScopeClause = this.buildCompanyScopeClause(actorCompanyIds, params);
    const result = await this.databaseService.query<{ active_rerun_count: string }>(
      `
        SELECT COUNT(*)::text AS active_rerun_count
        FROM rpt.snapshot_run
        WHERE rerun_of_snapshot_run_id = $1::uuid
          AND run_status IN ('queued', 'running')
          ${companyScopeClause}
      `,
      params,
    );

    return Number(result.rows[0]?.active_rerun_count ?? 0);
  }

  async listFailedSnapshotRunsForLookup(input: { actorCompanyIds?: string[] } = {}) {
    const params: unknown[] = [];
    const companyScopeClause = this.buildCompanyScopeClause(input.actorCompanyIds, params);
    const result = await this.databaseService.query<SnapshotRunRow>(
      `
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
          rpt.snapshot_run.kpi_config_version_id,
          version.version_no AS kpi_config_version_no
        FROM rpt.snapshot_run
        LEFT JOIN ops.kpi_config_version version
          ON version.kpi_config_version_id = rpt.snapshot_run.kpi_config_version_id
        WHERE rpt.snapshot_run.run_status = 'failed'
        ${companyScopeClause}
        ORDER BY rpt.snapshot_run.generated_at DESC
        LIMIT 20
      `,
      params,
    );

    return result.rows;
  }

  async createSnapshotRun(
    input: {
      snapshotType: string;
      periodStart: string;
      periodEnd: string;
      actorUserId: string;
      idempotencyKey: string | null;
      actorCompanyIds?: string[];
      rerunOfSnapshotRunId?: string | null;
      kpiConfigVersionId?: string | null;
    },
    client?: Queryable,
  ) {
    const runner = this.getRunner(client);
    const result = await runner.query<{
      snapshot_run_id: string;
      company_ids: string[];
      snapshot_date: string;
      generated_at: string;
      run_status: string;
      started_at: string | null;
      finished_at: string | null;
      failure_reason: string | null;
      rerun_of_snapshot_run_id: string | null;
      kpi_config_version_id: string | null;
      kpi_config_version_no: number | null;
    }>(
      `
        INSERT INTO rpt.snapshot_run (
          snapshot_date,
          snapshot_type,
          period_start,
          period_end,
          run_status,
          idempotency_key,
          generated_by,
          company_ids,
          rerun_of_snapshot_run_id,
          kpi_config_version_id
        )
        VALUES (CURRENT_DATE, $1, $2::date, $3::date, 'queued', $4, $5, $6::uuid[], $7::uuid, $8::uuid)
        RETURNING
          snapshot_run_id,
          company_ids,
          snapshot_date,
          generated_at,
          run_status,
          started_at,
          finished_at,
          failure_reason,
          rerun_of_snapshot_run_id,
          kpi_config_version_id,
          (
            SELECT version_no
            FROM ops.kpi_config_version
            WHERE kpi_config_version_id = $8::uuid
          ) AS kpi_config_version_no
      `,
      [
        input.snapshotType,
        input.periodStart,
        input.periodEnd,
        input.idempotencyKey,
        input.actorUserId,
        input.actorCompanyIds ?? [],
        input.rerunOfSnapshotRunId ?? null,
        input.kpiConfigVersionId ?? null,
      ],
    );

    return result.rows[0];
  }

  async recordSnapshotAuditEvent(
    input: {
      actorUserId?: string | null;
      eventType: string;
      snapshotRunId: string;
      metadata?: Record<string, unknown>;
    },
    client?: Queryable,
  ) {
    const runner = this.getRunner(client);

    await runner.query(
      `
        INSERT INTO audit.event_log (
          actor_user_id,
          event_type,
          entity_name,
          entity_id,
          scope_type,
          metadata_json
        )
        VALUES ($1::uuid, $2, 'rpt.snapshot_run', $3::uuid, 'company', $4::jsonb)
      `,
      [
        input.actorUserId ?? null,
        input.eventType,
        input.snapshotRunId,
        JSON.stringify({
          correlationId: RequestContextStore.getCorrelationId(),
          ...(input.metadata ?? {}),
        }),
      ],
    );
  }

  async markSnapshotRunStarted(snapshotRunId: string) {
    await this.databaseService.withTransaction(async (client) => {
      await client.query(
        `
          UPDATE rpt.snapshot_run
          SET
            run_status = 'running',
            started_at = COALESCE(started_at, NOW()),
            finished_at = NULL,
            failure_reason = NULL
          WHERE snapshot_run_id = $1::uuid
        `,
        [snapshotRunId],
      );

      await this.recordSnapshotAuditEvent(
        {
          eventType: "snapshot_run.started",
          snapshotRunId,
        },
        client,
      );
    });
  }

  async markSnapshotRunCompleted(snapshotRunId: string) {
    await this.databaseService.withTransaction(async (client) => {
      await client.query(
        `
          UPDATE rpt.snapshot_run
          SET
            run_status = 'completed',
            finished_at = NOW(),
            failure_reason = NULL
          WHERE snapshot_run_id = $1::uuid
        `,
        [snapshotRunId],
      );

      await this.recordSnapshotAuditEvent(
        {
          eventType: "snapshot_run.completed",
          snapshotRunId,
        },
        client,
      );
    });
  }

  async markSnapshotRunFailed(snapshotRunId: string, failureReason: string) {
    await this.databaseService.withTransaction(async (client) => {
      await client.query(
        `
          UPDATE rpt.snapshot_run
          SET
            run_status = 'failed',
            finished_at = NOW(),
            failure_reason = $2
          WHERE snapshot_run_id = $1::uuid
        `,
        [snapshotRunId, failureReason],
      );

      await this.recordSnapshotAuditEvent(
        {
          eventType: "snapshot_run.failed",
          snapshotRunId,
          metadata: {
            failureReason,
          },
        },
        client,
      );
    });
  }

  private async countSnapshotRows(
    tableName: string,
    snapshotRunId: string,
    actorCompanyIds?: string[],
  ) {
    const params: unknown[] = [snapshotRunId];
    const companyScope = this.buildSnapshotRowCompanyScope(tableName, actorCompanyIds, params);
    const result = await this.databaseService.query<{ row_count: string }>(
      `
        SELECT COUNT(*)::text AS row_count
        FROM ${tableName}
        WHERE snapshot_run_id = $1::uuid
        ${companyScope.whereClause}
      `,
      params,
    );

    return Number(result.rows[0]?.row_count ?? 0);
  }

  private buildCompanyScopeClause(
    actorCompanyIds: string[] | undefined,
    params: unknown[],
    runAlias = "rpt.snapshot_run",
  ) {
    if (!actorCompanyIds) {
      return "";
    }

    params.push(actorCompanyIds);
    return `AND ${runAlias}.company_ids && $${params.length}::uuid[]`;
  }

  private buildSnapshotRowCompanyScope(
    tableName: string,
    actorCompanyIds: string[] | undefined,
    params: unknown[],
  ) {
    if (!actorCompanyIds) {
      return { whereClause: "" };
    }

    params.push(actorCompanyIds);
    const paramRef = `$${params.length}::uuid[]`;

    if (tableName === "rpt.turnover_snapshot") {
      return {
        whereClause: `AND ${tableName}.company_id = ANY(${paramRef})`,
      };
    }

    return {
      whereClause: `
        AND EXISTS (
          SELECT 1
          FROM ops.store scoped_store
          WHERE scoped_store.store_id = ${tableName}.store_id
            AND scoped_store.company_id = ANY(${paramRef})
        )
      `,
    };
  }

  private resolveScopedSnapshotRunInput(
    input: string | { snapshotRunId: string; actorCompanyIds?: string[] },
  ) {
    if (typeof input === "string") {
      return { snapshotRunId: input, actorCompanyIds: undefined };
    }

    return input;
  }

  private getRunner(client?: Queryable): Queryable {
    return client ?? (this.databaseService as unknown as Queryable);
  }
}
