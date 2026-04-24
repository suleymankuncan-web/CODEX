import { Injectable } from "@nestjs/common";
import { ReportingRepository } from "../infrastructure/reporting.repository";
import {
  ClosedRankingEmployee,
  ClosedRankingInput,
  ClosedRankingMetricRankRow,
  ClosedRankingPeriodType,
  ClosedRankingPersonnelRankRow,
  ClosedRankingSnapshotRunRow,
  ClosedRankingState,
  ClosedRankingSummary,
} from "./closed-ranking.contract";

@Injectable()
export class ClosedRankingService {
  constructor(private readonly reportingRepository: ReportingRepository) {}

  async getClosedLeaderboard(input: ClosedRankingInput): Promise<ClosedRankingSummary> {
    const periodType = input.periodType ?? "daily";

    if (periodType === "monthly") {
      return this.getMonthlyClosedLeaderboard(input);
    }

    return this.getDailyClosedLeaderboard(input);
  }

  private async getDailyClosedLeaderboard(
    input: ClosedRankingInput,
  ): Promise<ClosedRankingSummary> {
    const periodStart = input.periodStart ?? input.snapshotDate;
    const currentEmployeeId = await this.resolveCurrentEmployeeId(input);
    const snapshotRun = periodStart
      ? await this.reportingRepository.getCompletedDailySnapshotByDate({
          periodStart,
        })
      : await this.reportingRepository.getLatestCompletedSnapshotRunByType("daily");

    if (!snapshotRun) {
      return this.getEmptyResponse({
        periodType: "daily",
        state: "not_closed",
        snapshotDate: periodStart ?? null,
        periodStart: periodStart ?? null,
        periodEnd: periodStart ?? null,
      });
    }

    const limit = input.limit ?? 10;
    const companyId = input.companyIds[0] ?? undefined;
    const storeId = this.resolveStoreFilter(input);
    const personnelRows =
      await this.reportingRepository.listClosedDailyPersonnelRankRows({
        snapshotRunId: snapshotRun.snapshot_run_id,
        companyId,
        storeId,
        limit,
      });

    const currentRow = await this.resolveCurrentDailyRow({
      snapshotRun,
      currentEmployeeId,
      personnelRows,
    });
    const employeeIds = this.uniqueEmployeeIds([
      ...personnelRows.map((row) => row.employee_id),
      currentRow?.employee_id ?? null,
    ]);
    const metricRows =
      employeeIds.length > 0
        ? await this.reportingRepository.listClosedDailyMetricRankRows({
            snapshotRunId: snapshotRun.snapshot_run_id,
            employeeIds,
            storeId,
          })
        : [];
    const metricRowsByEmployee = this.groupMetricRowsByEmployee(metricRows);
    const state: ClosedRankingState =
      personnelRows.length > 0 || currentRow ? "closed" : "no_data";

    return {
      source: {
        mode: "closed",
        periodType: "daily",
        state,
        snapshotRunId: snapshotRun.snapshot_run_id,
        snapshotDate: snapshotRun.snapshot_date,
        periodStart: snapshotRun.period_start,
        periodEnd: snapshotRun.period_end,
      },
      currentEmployee: currentRow
        ? this.mapEmployeeRow({
            row: currentRow,
            periodType: "daily",
            closedDaysInPeriod: 1,
            minimumRequiredDays: 1,
            metricRows: metricRowsByEmployee.get(currentRow.employee_id) ?? [],
          })
        : null,
      personnelTop: personnelRows.map((row) =>
        this.mapEmployeeRow({
          row,
          periodType: "daily",
          closedDaysInPeriod: 1,
          minimumRequiredDays: 1,
          metricRows: metricRowsByEmployee.get(row.employee_id) ?? [],
        }),
      ),
    };
  }

  private async getMonthlyClosedLeaderboard(
    input: ClosedRankingInput,
  ): Promise<ClosedRankingSummary> {
    const monthStart = this.resolveMonthStart(input.periodStart ?? input.snapshotDate);
    const monthEnd = monthStart ? this.resolveMonthEnd(monthStart) : null;

    if (!monthStart) {
      return this.getEmptyResponse({
        periodType: "monthly",
        state: "not_closed",
        snapshotDate: null,
        periodStart: null,
        periodEnd: null,
      });
    }

    const currentEmployeeId = await this.resolveCurrentEmployeeId(input);
    const completedRuns =
      await this.reportingRepository.listCompletedDailySnapshotsInMonth({
        monthStart,
      });

    if (completedRuns.length === 0) {
      return this.getEmptyResponse({
        periodType: "monthly",
        state: "not_closed",
        snapshotDate: null,
        periodStart: monthStart,
        periodEnd: monthEnd,
      });
    }

    const limit = input.limit ?? 10;
    const companyId = input.companyIds[0] ?? undefined;
    const storeId = this.resolveStoreFilter(input);
    const snapshotRunIds = completedRuns.map((run) => run.snapshot_run_id);
    const personnelRows =
      await this.reportingRepository.listClosedMonthlyPersonnelAggregateRows({
        snapshotRunIds,
        companyId,
        storeId,
        limit: Math.max(limit, 1000),
      });
    const currentRow =
      currentEmployeeId !== null
        ? personnelRows.find((row) => row.employee_id === currentEmployeeId) ?? null
        : null;
    const employeeIds = this.uniqueEmployeeIds([
      ...personnelRows.slice(0, limit).map((row) => row.employee_id),
      currentRow?.employee_id ?? null,
    ]);
    const metricRows =
      employeeIds.length > 0
        ? await this.reportingRepository.listClosedMonthlyMetricRankRows({
            snapshotRunIds,
            employeeIds,
            storeId,
          })
        : [];
    const metricRowsByEmployee = this.groupMetricRowsByEmployee(metricRows);
    const state: ClosedRankingState =
      personnelRows.length > 0 || currentRow ? "closed" : "no_data";
    const closedDaysInPeriod = completedRuns.length;
    const minimumRequiredDays = 3;

    return {
      source: {
        mode: "closed",
        periodType: "monthly",
        state,
        snapshotRunId: null,
        snapshotDate: completedRuns[completedRuns.length - 1]?.snapshot_date ?? null,
        periodStart: monthStart,
        periodEnd: monthEnd,
      },
      currentEmployee: currentRow
        ? this.mapEmployeeRow({
            row: currentRow,
            periodType: "monthly",
            closedDaysInPeriod,
            minimumRequiredDays,
            metricRows: metricRowsByEmployee.get(currentRow.employee_id) ?? [],
          })
        : null,
      personnelTop: personnelRows.slice(0, limit).map((row) =>
        this.mapEmployeeRow({
          row,
          periodType: "monthly",
          closedDaysInPeriod,
          minimumRequiredDays,
          metricRows: metricRowsByEmployee.get(row.employee_id) ?? [],
        }),
      ),
    };
  }

  private async resolveCurrentEmployeeId(input: ClosedRankingInput) {
    return this.reportingRepository.resolveEmployeeIdForAuthIdentity({
      userId: input.userId,
      employeeId: input.employeeId,
      companyIds: input.companyIds,
    });
  }

  private resolveStoreFilter(input: ClosedRankingInput) {
    if (input.storeId) {
      return input.storeId;
    }

    if (input.roleCodes.includes("STORE_MANAGER") && input.assignedStoreIds.length === 1) {
      return input.assignedStoreIds[0];
    }

    if (input.roleCodes.includes("STORE_PERSONNEL") && input.storeIds.length === 1) {
      return input.storeIds[0];
    }

    return undefined;
  }

  private async resolveCurrentDailyRow(input: {
    snapshotRun: ClosedRankingSnapshotRunRow;
    currentEmployeeId: string | null;
    personnelRows: ClosedRankingPersonnelRankRow[];
  }) {
    if (!input.currentEmployeeId) {
      return null;
    }

    const currentTopRow = input.personnelRows.find(
      (row) => row.employee_id === input.currentEmployeeId,
    );

    if (currentTopRow) {
      return currentTopRow;
    }

    return this.reportingRepository.getEmployeePerformanceSnapshot({
      snapshotRunId: input.snapshotRun.snapshot_run_id,
      employeeId: input.currentEmployeeId,
    });
  }

  private mapEmployeeRow(input: {
    row: ClosedRankingPersonnelRankRow;
    periodType: ClosedRankingPeriodType;
    closedDaysInPeriod: number;
    minimumRequiredDays: number;
    metricRows: ClosedRankingMetricRankRow[];
  }): ClosedRankingEmployee {
    const daysWithPerformance =
      input.periodType === "daily"
        ? 1
        : Number(input.row.days_with_performance ?? 0);
    const isEligibleForRanking = daysWithPerformance >= input.minimumRequiredDays;

    return {
      employeeId: input.row.employee_id,
      displayName: `${input.row.first_name} ${input.row.last_name}`.trim(),
      storeId: input.row.store_id,
      storeName: input.row.store_name,
      scoreValue: Number(input.row.score_value),
      rankings: {
        turkeyRank: isEligibleForRanking ? input.row.turkey_rank : null,
        turkeyPopulation: input.row.turkey_population,
        storeRank: isEligibleForRanking ? input.row.store_rank : null,
        storePopulation: input.row.store_population,
      },
      coverage: {
        closedDaysInPeriod: input.closedDaysInPeriod,
        daysWithPerformance,
        minimumRequiredDays: input.minimumRequiredDays,
        isEligibleForRanking,
      },
      metricRanks: input.metricRows.map((row) => ({
        code: row.kpi_code,
        label: row.kpi_name,
        actualValue: row.actual_value !== null ? Number(row.actual_value) : null,
        storeRank: row.store_rank,
        storePopulation: row.store_population,
        turkeyRank: row.turkey_rank,
        turkeyPopulation: row.turkey_population,
      })),
    };
  }

  private groupMetricRowsByEmployee(rows: ClosedRankingMetricRankRow[]) {
    return rows.reduce((map, row) => {
      const current = map.get(row.employee_id) ?? [];
      current.push(row);
      map.set(row.employee_id, current);
      return map;
    }, new Map<string, ClosedRankingMetricRankRow[]>());
  }

  private uniqueEmployeeIds(values: Array<string | null>) {
    return [...new Set(values.filter((value): value is string => Boolean(value)))];
  }

  private resolveMonthStart(value?: string) {
    if (!value) {
      return null;
    }

    return `${value.slice(0, 7)}-01`;
  }

  private resolveMonthEnd(monthStart: string) {
    const year = Number(monthStart.slice(0, 4));
    const month = Number(monthStart.slice(5, 7));
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return `${monthStart.slice(0, 7)}-${String(lastDay).padStart(2, "0")}`;
  }

  private getEmptyResponse(input: {
    periodType: ClosedRankingPeriodType;
    state: ClosedRankingState;
    snapshotDate: string | null;
    periodStart: string | null;
    periodEnd: string | null;
  }): ClosedRankingSummary {
    return {
      source: {
        mode: "closed",
        periodType: input.periodType,
        state: input.state,
        snapshotRunId: null,
        snapshotDate: input.snapshotDate,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
      },
      currentEmployee: null,
      personnelTop: [],
    };
  }
}
