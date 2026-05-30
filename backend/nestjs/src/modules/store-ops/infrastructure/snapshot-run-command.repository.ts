import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../../shared/database/database.service";
import { KpiBenchmarkScoringService } from "../application/kpi-benchmark-scoring.service";
import { KpiConfigRepository } from "./kpi-config.repository";
import { SnapshotOperationsRepository } from "./snapshot-operations.repository";
import type { KpiScoreProfile } from "../application/kpi-config.contract";

type Queryable = {
  query: <T>(sql: string, params?: unknown[]) => Promise<{ rowCount: number; rows: T[] }>;
};

@Injectable()
export class SnapshotRunCommandRepository {
  private readonly kpiBenchmarkScoringService = new KpiBenchmarkScoringService();

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly snapshotOperationsRepository: SnapshotOperationsRepository,
    private readonly kpiConfigRepository: KpiConfigRepository,
  ) {}

  async createOrReuseSnapshotRun(input: {
    snapshotType: string;
    periodStart: string;
    periodEnd: string;
    actorUserId: string;
    idempotencyKey: string;
    actorCompanyIds?: string[];
  }) {
    return this.databaseService.withTransaction(async (client) => {
      const existingParams: unknown[] = [input.idempotencyKey];
      const existingScopeClause = input.actorCompanyIds
        ? (() => {
            existingParams.push(input.actorCompanyIds);
            return `AND company_ids = $${existingParams.length}::uuid[]`;
          })()
        : "AND company_ids = '{}'::uuid[]";
      const existing = await client.query<{
        snapshot_run_id: string;
        company_ids: string[];
        snapshot_date: string;
        generated_at: string;
        run_status: string;
      }>(
        `
          SELECT snapshot_run_id, company_ids, snapshot_date, generated_at, run_status
          FROM rpt.snapshot_run
          WHERE idempotency_key = $1
          ${existingScopeClause}
          LIMIT 1
        `,
        existingParams,
      );

      if (existing.rowCount && existing.rows[0]) {
        return {
          ...existing.rows[0],
          reused: true,
        };
      }

      const latestKpiConfigVersion = await this.getLatestKpiConfigVersion(client);
      const run = await this.snapshotOperationsRepository.createSnapshotRun(
        {
          snapshotType: input.snapshotType,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          actorUserId: input.actorUserId,
          idempotencyKey: input.idempotencyKey,
          actorCompanyIds: input.actorCompanyIds,
          kpiConfigVersionId: latestKpiConfigVersion?.kpi_config_version_id ?? null,
        },
        client,
      );

      await this.snapshotOperationsRepository.recordSnapshotAuditEvent(
        {
          actorUserId: input.actorUserId,
          eventType: "snapshot_run.created",
          snapshotRunId: run.snapshot_run_id,
          metadata: {
            snapshotType: input.snapshotType,
            periodStart: input.periodStart,
            periodEnd: input.periodEnd,
            kpiConfigVersionId: latestKpiConfigVersion?.kpi_config_version_id ?? null,
            versionNo: latestKpiConfigVersion?.version_no ?? null,
            companyIds: input.actorCompanyIds ?? [],
          },
        },
        client,
      );

      return run;
    });
  }

  async createRerunSnapshotRun(input: {
    snapshotRunId: string;
    actorUserId: string;
    actorCompanyIds?: string[];
    existing: {
      snapshot_type: string;
      period_start: string;
      period_end: string;
      kpi_config_version_id?: string | null;
      kpi_config_version_no?: number | null;
    };
  }) {
    return this.databaseService.withTransaction(async (client) => {
      const latestKpiConfigVersion = input.existing.kpi_config_version_id
        ? null
        : await this.getLatestKpiConfigVersion(client);
      const kpiConfigVersionId =
        input.existing.kpi_config_version_id ??
        latestKpiConfigVersion?.kpi_config_version_id ??
        null;
      const versionNo =
        input.existing.kpi_config_version_no ?? latestKpiConfigVersion?.version_no ?? null;
      const newRun = await this.snapshotOperationsRepository.createSnapshotRun(
        {
          snapshotType: input.existing.snapshot_type,
          periodStart: input.existing.period_start,
          periodEnd: input.existing.period_end,
          actorUserId: input.actorUserId,
          idempotencyKey: `${input.snapshotRunId}:rerun:${new Date().toISOString()}`,
          actorCompanyIds: input.actorCompanyIds,
          rerunOfSnapshotRunId: input.snapshotRunId,
          kpiConfigVersionId,
        },
        client,
      );

      await this.snapshotOperationsRepository.recordSnapshotAuditEvent(
        {
          actorUserId: input.actorUserId,
          eventType: "snapshot_run.created",
          snapshotRunId: newRun.snapshot_run_id,
          metadata: {
            snapshotType: input.existing.snapshot_type,
            periodStart: input.existing.period_start,
            periodEnd: input.existing.period_end,
            rerunOfSnapshotRunId: input.snapshotRunId,
            kpiConfigVersionId,
            versionNo,
          },
        },
        client,
      );

      await this.snapshotOperationsRepository.recordSnapshotAuditEvent(
        {
          actorUserId: input.actorUserId,
          eventType: "snapshot_run.rerun_requested",
          snapshotRunId: input.snapshotRunId,
          metadata: {
            newSnapshotRunId: newRun.snapshot_run_id,
            kpiConfigVersionId,
            versionNo,
            companyIds: input.actorCompanyIds ?? [],
          },
        },
        client,
      );

      return newRun;
    });
  }

  async executeSnapshotRun(input: {
    snapshotRunId: string;
    periodStart: string;
    periodEnd: string;
    personnelProfile: KpiScoreProfile | null;
  }) {
    await this.databaseService.withTransaction(async (client) => {
      await client.query(
        `SELECT rpt.generate_store_workforce_snapshot($1::uuid, $2::date, $3::date)`,
        [input.snapshotRunId, input.periodStart, input.periodEnd],
      );

      await client.query(
        `SELECT rpt.generate_store_kpi_snapshot($1::uuid, $2::date, $3::date)`,
        [input.snapshotRunId, input.periodStart, input.periodEnd],
      );

      await client.query(
        `SELECT rpt.generate_store_checklist_snapshot($1::uuid, $2::date, $3::date)`,
        [input.snapshotRunId, input.periodStart, input.periodEnd],
      );

      await client.query(
        `SELECT rpt.generate_turnover_snapshot($1::uuid, $2::date, $3::date)`,
        [input.snapshotRunId, input.periodStart, input.periodEnd],
      );

      if (input.personnelProfile) {
        await this.materializeEmployeePerformanceSnapshot(
          client,
          input.snapshotRunId,
          input.periodStart,
          input.periodEnd,
          input.personnelProfile,
        );
      }
    });
  }

  private async getLatestKpiConfigVersion(client?: Queryable) {
    try {
      return await this.kpiConfigRepository.getLatestPublishedKpiConfigVersion(client);
    } catch {
      return null;
    }
  }

  private async materializeEmployeePerformanceSnapshot(
    client: Queryable,
    snapshotRunId: string,
    periodStart: string,
    periodEnd: string,
    profile: KpiScoreProfile,
  ) {
    const metricCodes = profile.metrics.map((metric) => metric.code);
    if (metricCodes.length === 0) {
      return;
    }

    const rows = await client.query<{
      employee_id: string;
      store_id: string | null;
      kpi_id: string;
      kpi_code: string;
      actual_value: string;
      target_value: string | null;
      personnel_target_reference_id: string | null;
    }>(
      `
        SELECT
          ka.employee_id,
          ka.store_id,
          kd.kpi_id,
          kd.kpi_code,
          SUM(ka.actual_value)::text AS actual_value,
          ptr.target_value::text AS target_value,
          ptr.personnel_target_reference_id::text AS personnel_target_reference_id
        FROM ops.kpi_actual ka
        INNER JOIN ops.kpi_definition kd
          ON kd.kpi_id = ka.kpi_id
        LEFT JOIN ops.personnel_target_reference ptr
          ON ptr.employee_id = ka.employee_id
         AND ptr.period_start <= ka.period_start
         AND ptr.period_end >= ka.period_end
         AND ptr.target_type = 'monthly_sales_target'
         AND ptr.status = 'approved'
         AND kd.kpi_code = 'TARGET_ACHIEVEMENT'
        WHERE ka.scope_type = 'employee'
          AND kd.kpi_code = ANY($1::text[])
          AND ka.period_start >= $2::date
          AND ka.period_end <= $3::date
        GROUP BY
          ka.employee_id,
          ka.store_id,
          kd.kpi_id,
          kd.kpi_code,
          ptr.target_value,
          ptr.personnel_target_reference_id
      `,
      [metricCodes, periodStart, periodEnd],
    );

    await client.query(
      `DELETE FROM rpt.employee_kpi_snapshot WHERE snapshot_run_id = $1::uuid`,
      [snapshotRunId],
    );
    await client.query(
      `DELETE FROM rpt.employee_performance_snapshot WHERE snapshot_run_id = $1::uuid`,
      [snapshotRunId],
    );

    if (rows.rows.length === 0) {
      return;
    }

    const benchmarkRows = await client.query<{
      kpi_code: string;
      benchmark_value: string | null;
    }>(
      `
        WITH scoped_actual AS (
          SELECT
            ka.employee_id,
            kd.kpi_code,
            SUM(ka.actual_value) AS actual_value
          FROM ops.kpi_actual ka
          INNER JOIN ops.kpi_definition kd
            ON kd.kpi_id = ka.kpi_id
          WHERE ka.scope_type = 'employee'
            AND ka.period_start >= $1::date
            AND ka.period_end <= $2::date
          GROUP BY ka.employee_id, kd.kpi_code
        )
        SELECT 'ATV' AS kpi_code,
               (SUM(net_sales.actual_value) / NULLIF(SUM(ticket_count.actual_value), 0))::text AS benchmark_value
        FROM scoped_actual net_sales
        INNER JOIN scoped_actual ticket_count
          ON ticket_count.employee_id = net_sales.employee_id
          AND ticket_count.kpi_code = 'TICKET_COUNT'
        WHERE net_sales.kpi_code = 'NET_SALES'
        UNION ALL
        SELECT 'UPT' AS kpi_code,
               (SUM(item_count.actual_value) / NULLIF(SUM(ticket_count.actual_value), 0))::text AS benchmark_value
        FROM scoped_actual item_count
        INNER JOIN scoped_actual ticket_count
          ON ticket_count.employee_id = item_count.employee_id
          AND ticket_count.kpi_code = 'TICKET_COUNT'
        WHERE item_count.kpi_code = 'ITEM_COUNT'
      `,
      [periodStart, periodEnd],
    );
    const benchmarkLookup = new Map(
      benchmarkRows.rows.map((row) => [
        row.kpi_code,
        row.benchmark_value !== null ? Number(row.benchmark_value) : null,
      ]),
    );

    for (const row of rows.rows) {
      await client.query(
        `
          INSERT INTO rpt.employee_kpi_snapshot (
            snapshot_run_id,
            employee_id,
            store_id,
            kpi_id,
            period_start,
            period_end,
            actual_value,
            personnel_target_reference_id
          )
          VALUES (
            $1::uuid,
            $2::uuid,
            $3::uuid,
            $4::uuid,
            $5::date,
            $6::date,
            $7::numeric,
            $8::uuid
          )
        `,
        [
          snapshotRunId,
          row.employee_id,
          row.store_id,
          row.kpi_id,
          periodStart,
          periodEnd,
          row.actual_value,
          row.personnel_target_reference_id ?? null,
        ],
      );
    }

    const metricLookupByEmployee = new Map<
      string,
      {
        storeId: string | null;
        values: Record<string, { actualValue: number; targetValue: number | null }>;
      }
    >();

    rows.rows.forEach((row) => {
      const current = metricLookupByEmployee.get(row.employee_id) ?? {
        storeId: row.store_id,
        values: {},
      };
      current.storeId = current.storeId ?? row.store_id;
      current.values[row.kpi_code] = {
        actualValue: Number(row.actual_value),
        targetValue:
          row.target_value !== null && row.target_value !== undefined
            ? Number(row.target_value)
            : null,
      };
      metricLookupByEmployee.set(row.employee_id, current);
    });

    const scoreRows = [...metricLookupByEmployee.entries()].map(([employeeId, value]) => {
      const score = profile.metrics.reduce((sum, metric) => {
        const matchingCodes = [metric.code, ...(metric.aliases ?? [])];
        const matchedCode = matchingCodes.find(
          (code) => value.values[code] !== undefined,
        );
        const matchedMetric = matchedCode ? value.values[matchedCode] : null;
        const actualValue = matchedMetric?.actualValue ?? null;
        const targetValue = matchedMetric?.targetValue ?? null;
        const benchmarkSource =
          metric.benchmarkSource ??
          (metric.code === "TARGET_ACHIEVEMENT" ? "TARGET" : "TURKEY_AVERAGE");
        const benchmarkValue =
          benchmarkSource === "TURKEY_AVERAGE" && matchedCode
            ? benchmarkLookup.get(matchedCode) ?? null
            : null;
        const metricScore = this.kpiBenchmarkScoringService.scoreMetric({
          metricCode: metric.code,
          actualValue,
          benchmarkValue,
          targetValue,
          weightPercent: metric.weightPercent,
          direction: metric.direction ?? "HIGHER_IS_BETTER",
          benchmarkSource,
          capRatio: metric.capRatio ?? 1.2,
        });

        return sum + (metricScore.scoreContribution ?? 0);
      }, 0);

      const matchedMetrics = profile.metrics.filter((metric) => {
        const matchingCodes = [metric.code, ...(metric.aliases ?? [])];
        const matchedCode = matchingCodes.find(
          (code) => value.values[code] !== undefined,
        );
        const matchedMetric = matchedCode ? value.values[matchedCode] : null;
        const actualValue = matchedMetric?.actualValue ?? null;
        const targetValue = matchedMetric?.targetValue ?? null;
        const benchmarkSource =
          metric.benchmarkSource ??
          (metric.code === "TARGET_ACHIEVEMENT" ? "TARGET" : "TURKEY_AVERAGE");
        const benchmarkValue =
          benchmarkSource === "TURKEY_AVERAGE" && matchedCode
            ? benchmarkLookup.get(matchedCode) ?? null
            : null;

        return (
          this.kpiBenchmarkScoringService.scoreMetric({
            metricCode: metric.code,
            actualValue,
            benchmarkValue,
            targetValue,
            weightPercent: metric.weightPercent,
            direction: metric.direction ?? "HIGHER_IS_BETTER",
            benchmarkSource,
            capRatio: metric.capRatio ?? 1.2,
          }).scoreStatus === "scored"
        );
      }).length;

      return {
        employeeId,
        storeId: value.storeId,
        scoreValue: Number(score.toFixed(4)),
        matchedMetrics,
      };
    });

    const turkeyPopulation = scoreRows.length;
    const turkeyRanks = [...scoreRows]
      .sort((left, right) => right.scoreValue - left.scoreValue)
      .map((row, index) => ({
        employeeId: row.employeeId,
        rank: index + 1,
      }));
    const turkeyRankLookup = new Map(turkeyRanks.map((row) => [row.employeeId, row.rank]));

    const storeRankLookup = new Map<string, { rank: number; population: number }>();
    const byStore = new Map<string, typeof scoreRows>();
    scoreRows.forEach((row) => {
      const key = row.storeId ?? "unassigned";
      const current = byStore.get(key) ?? [];
      current.push(row);
      byStore.set(key, current);
    });
    byStore.forEach((rowsForStore) => {
      const ranked = [...rowsForStore].sort((left, right) => right.scoreValue - left.scoreValue);
      ranked.forEach((row, index) => {
        storeRankLookup.set(row.employeeId, {
          rank: index + 1,
          population: ranked.length,
        });
      });
    });

    for (const row of scoreRows) {
      const storeRank = storeRankLookup.get(row.employeeId);
      await client.query(
        `
          INSERT INTO rpt.employee_performance_snapshot (
            snapshot_run_id,
            employee_id,
            store_id,
            period_start,
            period_end,
            score_value,
            matched_metrics,
            total_metrics,
            turkey_rank,
            turkey_population,
            store_rank,
            store_population
          )
          VALUES (
            $1::uuid,
            $2::uuid,
            $3::uuid,
            $4::date,
            $5::date,
            $6::numeric,
            $7::integer,
            $8::integer,
            $9::integer,
            $10::integer,
            $11::integer,
            $12::integer
          )
        `,
        [
          snapshotRunId,
          row.employeeId,
          row.storeId,
          periodStart,
          periodEnd,
          row.scoreValue,
          row.matchedMetrics,
          profile.metrics.length,
          turkeyRankLookup.get(row.employeeId) ?? null,
          turkeyPopulation,
          storeRank?.rank ?? null,
          storeRank?.population ?? 0,
        ],
      );
    }
  }
}
