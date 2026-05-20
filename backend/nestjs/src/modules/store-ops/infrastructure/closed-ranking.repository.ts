import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";
import type {
  ClosedRankingMetricRankRow,
  ClosedRankingPersonnelRankRow,
  ClosedRankingSnapshotRunRow,
} from "../application/closed-ranking.contract";

@Injectable()
export class ClosedRankingRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async getLatestCompletedSnapshotRunByType(snapshotType: string) {
    const result = await this.databaseService.query<ClosedRankingSnapshotRunRow>(
      `
        SELECT
          sr.snapshot_run_id,
          sr.snapshot_date::text AS snapshot_date,
          sr.snapshot_type,
          sr.period_start::text AS period_start,
          sr.period_end::text AS period_end,
          sr.run_status,
          sr.generated_at,
          sr.generated_by
        FROM rpt.snapshot_run sr
        WHERE sr.run_status = 'completed'
          AND sr.snapshot_type = $1
          AND ($1 <> 'daily' OR sr.period_start = sr.period_end)
        ORDER BY sr.generated_at DESC
        LIMIT 1
      `,
      [snapshotType],
    );

    return result.rows[0] ?? null;
  }

  async getCompletedSnapshotRunByTypeAndDate(input: {
    snapshotType: string;
    periodStart: string;
    periodEnd: string;
  }) {
    const result = await this.databaseService.query<ClosedRankingSnapshotRunRow>(
      `
        SELECT
          sr.snapshot_run_id,
          sr.snapshot_date::text AS snapshot_date,
          sr.snapshot_type,
          sr.period_start::text AS period_start,
          sr.period_end::text AS period_end,
          sr.run_status,
          sr.generated_at,
          sr.generated_by
        FROM rpt.snapshot_run sr
        WHERE sr.run_status = 'completed'
          AND sr.snapshot_type = $1
          AND sr.period_start = $2::date
          AND sr.period_end = $3::date
        ORDER BY sr.generated_at DESC
        LIMIT 1
      `,
      [input.snapshotType, input.periodStart, input.periodEnd],
    );

    return result.rows[0] ?? null;
  }

  async getCompletedDailySnapshotByDate(input: { periodStart: string }) {
    const result = await this.databaseService.query<ClosedRankingSnapshotRunRow>(
      `
        SELECT
          sr.snapshot_run_id,
          sr.snapshot_date::text AS snapshot_date,
          sr.snapshot_type,
          sr.period_start::text AS period_start,
          sr.period_end::text AS period_end,
          sr.run_status,
          sr.generated_at,
          sr.generated_by
        FROM rpt.snapshot_run sr
        WHERE sr.run_status = 'completed'
          AND sr.snapshot_type = $1
          AND sr.period_start = $2::date
          AND sr.period_end = $2::date
        ORDER BY sr.generated_at DESC
        LIMIT 1
      `,
      ["daily", input.periodStart],
    );

    return result.rows[0] ?? null;
  }

  async listClosedDailyPersonnelRankRows(input: {
    snapshotRunId: string;
    companyId?: string;
    storeId?: string;
    limit: number;
  }): Promise<ClosedRankingPersonnelRankRow[]> {
    const params: unknown[] = [input.snapshotRunId];
    const clauses = [`eps.snapshot_run_id = $1::uuid`];

    if (input.companyId) {
      params.push(input.companyId);
      clauses.push(`store.company_id = $${params.length}::uuid`);
    }

    if (input.storeId) {
      params.push(input.storeId);
      clauses.push(`eps.store_id = $${params.length}::uuid`);
    }

    params.push(input.limit);

    const result = await this.databaseService.query<ClosedRankingPersonnelRankRow>(
      `
        /* closed_personnel_daily_rank_rows */
        SELECT
          eps.employee_id,
          e.first_name,
          e.last_name,
          eps.store_id,
          store.store_name,
          eps.score_value::text AS score_value,
          eps.turkey_rank,
          eps.turkey_population,
          eps.store_rank,
          eps.store_population
        FROM rpt.employee_performance_snapshot eps
        INNER JOIN ops.employee e
          ON e.employee_id = eps.employee_id
        LEFT JOIN ops.store store
          ON store.store_id = eps.store_id
        WHERE ${clauses.join(" AND ")}
        ORDER BY eps.turkey_rank ASC NULLS LAST, eps.score_value DESC, eps.employee_id ASC
        LIMIT $${params.length}
      `,
      params,
    );

    return result.rows;
  }

  async listClosedDailyMetricRankRows(input: {
    snapshotRunId: string;
    employeeIds: string[];
    storeId?: string;
  }): Promise<ClosedRankingMetricRankRow[]> {
    if (input.employeeIds.length === 0) {
      return [];
    }

    const result = await this.databaseService.query<ClosedRankingMetricRankRow>(
      `
        /* closed_metric_daily_rank_rows */
        WITH metric_rows AS (
          SELECT
            eks.employee_id,
            eks.store_id,
            kd.kpi_code,
            kd.kpi_name,
            eks.actual_value::text AS actual_value,
            RANK() OVER (
              PARTITION BY kd.kpi_code
              ORDER BY eks.actual_value DESC NULLS LAST, eks.employee_id ASC
            ) AS turkey_rank,
            COUNT(*) OVER (PARTITION BY kd.kpi_code) AS turkey_population,
            RANK() OVER (
              PARTITION BY kd.kpi_code, eks.store_id
              ORDER BY eks.actual_value DESC NULLS LAST, eks.employee_id ASC
            ) AS store_rank,
            COUNT(*) OVER (PARTITION BY kd.kpi_code, eks.store_id) AS store_population
          FROM rpt.employee_kpi_snapshot eks
          INNER JOIN ops.kpi_definition kd
            ON kd.kpi_id = eks.kpi_id
          WHERE eks.snapshot_run_id = $1::uuid
        )
        SELECT
          employee_id,
          kpi_code,
          kpi_name,
          actual_value,
          store_rank,
          store_population,
          turkey_rank,
          turkey_population
        FROM metric_rows
        WHERE employee_id = ANY($2::uuid[])
        ORDER BY employee_id ASC, kpi_code ASC
      `,
      [input.snapshotRunId, input.employeeIds],
    );

    return result.rows;
  }

  async listCompletedDailySnapshotsInMonth(input: {
    monthStart: string;
  }): Promise<ClosedRankingSnapshotRunRow[]> {
    const result = await this.databaseService.query<ClosedRankingSnapshotRunRow>(
      `
        SELECT
          sr.snapshot_run_id,
          sr.snapshot_date::text AS snapshot_date,
          sr.snapshot_type,
          sr.period_start::text AS period_start,
          sr.period_end::text AS period_end,
          sr.run_status,
          sr.generated_at,
          sr.generated_by
        FROM rpt.snapshot_run sr
        WHERE sr.snapshot_type = 'daily'
          AND sr.run_status = 'completed'
          AND sr.period_start = sr.period_end
          AND sr.period_start >= $1::date
          AND sr.period_start < ($1::date + INTERVAL '1 month')
        ORDER BY sr.period_start ASC
      `,
      [input.monthStart],
    );

    return result.rows;
  }

  async listClosedMonthlyPersonnelAggregateRows(input: {
    snapshotRunIds: string[];
    companyId?: string;
    storeId?: string;
    limit: number;
  }): Promise<ClosedRankingPersonnelRankRow[]> {
    if (input.snapshotRunIds.length === 0) {
      return [];
    }

    const params: unknown[] = [input.snapshotRunIds];
    const dailyClauses = [`eps.snapshot_run_id = ANY($1::uuid[])`];

    if (input.companyId) {
      params.push(input.companyId);
      dailyClauses.push(`store.company_id = $${params.length}::uuid`);
    }

    const finalClauses: string[] = [];
    if (input.storeId) {
      params.push(input.storeId);
      finalClauses.push(`ranked.store_id = $${params.length}::uuid`);
    }

    params.push(input.limit);
    const limitParam = params.length;
    const finalWhereClause = finalClauses.length
      ? `WHERE ${finalClauses.join(" AND ")}`
      : "";

    const result = await this.databaseService.query<ClosedRankingPersonnelRankRow>(
      `
        /* closed_personnel_monthly_rank_rows */
        WITH daily_rows AS (
          SELECT
            eps.employee_id,
            eps.store_id,
            AVG(eps.score_value)::numeric(18,4) AS score_value,
            COUNT(*)::int AS days_with_performance
          FROM rpt.employee_performance_snapshot eps
          LEFT JOIN ops.store store
            ON store.store_id = eps.store_id
          WHERE ${dailyClauses.join(" AND ")}
          GROUP BY eps.employee_id, eps.store_id
        ),
        eligible_rows AS (
          SELECT *
          FROM daily_rows
          WHERE days_with_performance >= 3
        ),
        eligible_ranked AS (
          SELECT
            eligible_rows.*,
            RANK() OVER (
              ORDER BY score_value DESC, employee_id ASC
            ) AS turkey_rank,
            COUNT(*) OVER () AS turkey_population,
            RANK() OVER (
              PARTITION BY store_id
              ORDER BY score_value DESC, employee_id ASC
            ) AS store_rank,
            COUNT(*) OVER (PARTITION BY store_id) AS store_population
          FROM eligible_rows
        ),
        eligible_counts AS (
          SELECT COUNT(*)::int AS turkey_population
          FROM eligible_rows
        ),
        store_eligible_counts AS (
          SELECT store_id, COUNT(*)::int AS store_population
          FROM eligible_rows
          GROUP BY store_id
        ),
        ranked AS (
          SELECT
            daily_rows.employee_id,
            daily_rows.store_id,
            daily_rows.score_value,
            daily_rows.days_with_performance,
            eligible_ranked.turkey_rank,
            COALESCE(eligible_ranked.turkey_population, eligible_counts.turkey_population, 0) AS turkey_population,
            eligible_ranked.store_rank,
            COALESCE(eligible_ranked.store_population, store_eligible_counts.store_population, 0) AS store_population
          FROM daily_rows
          CROSS JOIN eligible_counts
          LEFT JOIN eligible_ranked
            ON eligible_ranked.employee_id = daily_rows.employee_id
           AND eligible_ranked.store_id IS NOT DISTINCT FROM daily_rows.store_id
          LEFT JOIN store_eligible_counts
            ON store_eligible_counts.store_id IS NOT DISTINCT FROM daily_rows.store_id
        )
        SELECT
          ranked.employee_id,
          e.first_name,
          e.last_name,
          ranked.store_id,
          store.store_name,
          ranked.score_value::text AS score_value,
          ranked.days_with_performance::text AS days_with_performance,
          ranked.turkey_rank,
          ranked.turkey_population,
          ranked.store_rank,
          ranked.store_population
        FROM ranked
        INNER JOIN ops.employee e
          ON e.employee_id = ranked.employee_id
        LEFT JOIN ops.store store
          ON store.store_id = ranked.store_id
        ${finalWhereClause}
        ORDER BY ranked.turkey_rank ASC NULLS LAST, ranked.score_value DESC, ranked.employee_id ASC
        LIMIT $${limitParam}
      `,
      params,
    );

    return result.rows;
  }

  async listClosedMonthlyMetricRankRows(input: {
    snapshotRunIds: string[];
    employeeIds: string[];
    storeId?: string;
  }): Promise<ClosedRankingMetricRankRow[]> {
    if (input.snapshotRunIds.length === 0 || input.employeeIds.length === 0) {
      return [];
    }

    const result = await this.databaseService.query<ClosedRankingMetricRankRow>(
      `
        WITH monthly_metric_rows AS (
          SELECT
            eks.employee_id,
            eks.store_id,
            kd.kpi_code,
            kd.kpi_name,
            AVG(eks.actual_value)::numeric(18,4) AS actual_value
          FROM rpt.employee_kpi_snapshot eks
          INNER JOIN ops.kpi_definition kd
            ON kd.kpi_id = eks.kpi_id
          WHERE eks.snapshot_run_id = ANY($1::uuid[])
          GROUP BY eks.employee_id, eks.store_id, kd.kpi_code, kd.kpi_name
        ),
        ranked AS (
          SELECT
            monthly_metric_rows.employee_id,
            monthly_metric_rows.store_id,
            monthly_metric_rows.kpi_code,
            monthly_metric_rows.kpi_name,
            monthly_metric_rows.actual_value,
            RANK() OVER (
              PARTITION BY kpi_code
              ORDER BY actual_value DESC NULLS LAST, employee_id ASC
            ) AS turkey_rank,
            COUNT(*) OVER (PARTITION BY kpi_code) AS turkey_population,
            RANK() OVER (
              PARTITION BY kpi_code, store_id
              ORDER BY actual_value DESC NULLS LAST, employee_id ASC
            ) AS store_rank,
            COUNT(*) OVER (PARTITION BY kpi_code, store_id) AS store_population
          FROM monthly_metric_rows
        )
        SELECT
          employee_id,
          kpi_code,
          kpi_name,
          actual_value::text AS actual_value,
          store_rank,
          store_population,
          turkey_rank,
          turkey_population
        FROM ranked
        WHERE employee_id = ANY($2::uuid[])
        ORDER BY employee_id ASC, kpi_code ASC
      `,
      [input.snapshotRunIds, input.employeeIds],
    );

    return result.rows;
  }

  async getEmployeePerformanceSnapshot(input: {
    snapshotRunId: string;
    employeeId: string;
  }) {
    const result = await this.databaseService.query<{
      employee_id: string;
      first_name: string;
      last_name: string;
      store_id: string | null;
      store_name: string | null;
      period_start: string;
      period_end: string;
      score_value: string;
      matched_metrics: number;
      total_metrics: number;
      turkey_rank: number | null;
      turkey_population: number;
      store_rank: number | null;
      store_population: number;
    }>(
      `
        SELECT
          eps.employee_id,
          e.first_name,
          e.last_name,
          eps.store_id,
          store.store_name,
          eps.period_start,
          eps.period_end,
          eps.score_value::text AS score_value,
          eps.matched_metrics,
          eps.total_metrics,
          eps.turkey_rank,
          eps.turkey_population,
          eps.store_rank,
          eps.store_population
        FROM rpt.employee_performance_snapshot eps
        INNER JOIN ops.employee e
          ON e.employee_id = eps.employee_id
        LEFT JOIN ops.store store
          ON store.store_id = eps.store_id
        WHERE eps.snapshot_run_id = $1::uuid
          AND eps.employee_id = $2::uuid
        LIMIT 1
      `,
      [input.snapshotRunId, input.employeeId],
    );

    return result.rows[0] ?? null;
  }

  async getEmployeeKpiSnapshotRows(input: {
    snapshotRunId: string;
    employeeId: string;
    metricCodes: string[];
  }) {
    const result = await this.databaseService.query<{
      employee_id: string;
      store_id: string | null;
      kpi_code: string;
      kpi_name: string;
      actual_value: string;
    }>(
      `
        SELECT
          eks.employee_id,
          eks.store_id,
          kd.kpi_code,
          kd.kpi_name,
          eks.actual_value::text AS actual_value
        FROM rpt.employee_kpi_snapshot eks
        INNER JOIN ops.kpi_definition kd
          ON kd.kpi_id = eks.kpi_id
        WHERE eks.snapshot_run_id = $1::uuid
          AND eks.employee_id = $2::uuid
          AND kd.kpi_code = ANY($3::text[])
        ORDER BY kd.kpi_code ASC
      `,
      [input.snapshotRunId, input.employeeId, input.metricCodes],
    );

    return result.rows;
  }
}
