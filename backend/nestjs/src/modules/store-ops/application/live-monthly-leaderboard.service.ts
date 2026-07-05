import { ForbiddenException, Injectable } from "@nestjs/common";
import { ReportingRepository } from "../infrastructure/reporting.repository";
import type { KpiScoreProfile } from "./kpi-config.contract";
import type {
  ClosedRankingEmployee,
  ClosedRankingMetricRank,
  ClosedRankingSummary,
} from "./closed-ranking.contract";
import { PerformanceScoreEvaluator } from "./performance-score-evaluator.service";
import {
  resolvePersonnelRankingEligibility,
  type PersonnelRankingEligibilityResult,
} from "./personnel-ranking-eligibility.contract";

type LiveEmployeePerformanceRow = {
  employee_id: string;
  first_name?: string;
  last_name?: string;
  store_id: string | null;
  store_name?: string | null;
  region_id?: string | null;
  position_code?: string | null;
  net_sales_value?: string | null;
  store_net_sales_value?: string | null;
  kpi_code: string;
  kpi_name?: string;
  target_value: string | null;
  actual_value: string;
};

type LiveEmployeeScoreRow = {
  employeeId: string;
  firstName: string;
  lastName: string;
  storeId: string | null;
  storeName: string | null;
  regionId: string | null;
  scoreValue: number;
  rankingEligibility: PersonnelRankingEligibilityResult;
};

@Injectable()
export class LiveMonthlyLeaderboardService {
  private readonly performanceScoreEvaluator = new PerformanceScoreEvaluator();

  constructor(private readonly reportingRepository: ReportingRepository) {}

  async getLiveMonthlyLeaderboard(input: {
    userId: string;
    employeeId?: string;
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
    roleCodes: string[];
    assignedStoreIds: string[];
    periodStart?: string;
    storeId?: string;
    limit?: number;
    profile: KpiScoreProfile;
  }): Promise<ClosedRankingSummary> {
    const metricCodes = input.profile.metrics.map((metric) => metric.code);
    const employeeDataMetricCodes = [...new Set([...metricCodes, "NET_SALES"])];
    const employeeId = await this.reportingRepository.resolveEmployeeIdForAuthIdentity({
      userId: input.userId,
      employeeId: input.employeeId,
      companyIds: input.companyIds,
    });

    if (!employeeId) {
      return this.getLiveLeaderboardEmptyResponse({
        periodStart: input.periodStart ?? null,
        periodEnd: input.periodStart ? this.resolveMonthEnd(input.periodStart) : null,
        availablePeriods: [],
      });
    }

    const [availablePeriods, latestPeriod] = await Promise.all([
      this.reportingRepository.listEmployeeKpiPeriods({
        employeeId,
        metricCodes: employeeDataMetricCodes,
        companyIds: input.companyIds,
        regionIds: input.regionIds,
        storeIds: input.storeIds,
      }),
      this.reportingRepository.getLatestEmployeeKpiPeriod({
        employeeId,
        metricCodes: employeeDataMetricCodes,
        companyIds: input.companyIds,
        regionIds: input.regionIds,
        storeIds: input.storeIds,
        periodType: "monthly",
        periodStart: input.periodStart,
      }),
    ]);

    const mappedAvailablePeriods = availablePeriods.map((period) => ({
      periodType: period.period_type,
      periodStart: period.period_start,
      periodEnd: period.period_end,
    }));

    if (!latestPeriod) {
      return this.getLiveLeaderboardEmptyResponse({
        periodStart: input.periodStart ?? null,
        periodEnd: input.periodStart ? this.resolveMonthEnd(input.periodStart) : null,
        availablePeriods: mappedAvailablePeriods,
      });
    }

    const storeFilter =
      this.resolveLeaderboardStoreFilter(input) ?? latestPeriod.store_id ?? undefined;

    let benchmarkRows = await this.reportingRepository.getEmployeeTurkeyBenchmarkValues({
      companyId: input.companyIds[0] ?? undefined,
      periodType: "monthly",
      periodStart: latestPeriod.period_start,
      periodEnd: latestPeriod.period_end,
    });

    if (!this.hasUsableBenchmarkRows(benchmarkRows)) {
      benchmarkRows = await this.reportingRepository.getEmployeeTurkeyBenchmarkValues({
        companyId: undefined,
        periodType: "monthly",
        periodStart: latestPeriod.period_start,
        periodEnd: latestPeriod.period_end,
      });
    }

    let peerRows = await this.reportingRepository.getPeerEmployeePerformanceRows({
      metricCodes,
      companyId: input.companyIds[0] ?? undefined,
      storeId: null,
      periodStart: latestPeriod.period_start,
      periodEnd: latestPeriod.period_end,
    });

    if (peerRows.length === 0) {
      peerRows = await this.reportingRepository.getPeerEmployeePerformanceRows({
        metricCodes,
        companyId: undefined,
        storeId: null,
        periodStart: latestPeriod.period_start,
        periodEnd: latestPeriod.period_end,
      });
    }

    const benchmarkLookup = new Map(
      benchmarkRows.map((row) => [
        row.kpi_code,
        row.benchmark_value !== null ? Number(row.benchmark_value) : null,
      ]),
    );
    const scoreRows = this.buildLiveEmployeeScoreRows({
      rows: peerRows,
      profile: input.profile,
      benchmarkLookup,
    });
    const officialScoreRows = scoreRows.filter(
      (row) => row.rankingEligibility.isEligible,
    );
    const limit = input.limit ?? 10;
    const storeScoreRows = storeFilter
      ? officialScoreRows.filter((row) => row.storeId === storeFilter)
      : officialScoreRows;
    const currentScoreRow =
      scoreRows.find((row) => row.employeeId === employeeId) ?? null;
    const officialEmployeeIds = new Set(
      officialScoreRows.map((row) => row.employeeId),
    );
    const officialPeerRows = peerRows.filter((row) =>
      officialEmployeeIds.has(row.employee_id),
    );
    const employeeIds = this.uniqueIds([
      ...storeScoreRows.slice(0, limit).map((row) => row.employeeId),
      currentScoreRow?.rankingEligibility.isEligible
        ? currentScoreRow.employeeId
        : null,
    ]);
    const metricRanksByEmployee = this.buildLiveMetricRanksByEmployee({
      rows: officialPeerRows,
      employeeIds,
      profile: input.profile,
    });
    const turkeyRankByEmployee = this.buildRankMap(officialScoreRows);
    const storeRankByEmployee = this.buildRankMap(storeScoreRows);
    const regionRankMapsByRegion = this.buildRegionRankMaps(officialScoreRows);
    const toEmployee = (row: LiveEmployeeScoreRow): ClosedRankingEmployee => {
      const regionRank = row.regionId
        ? regionRankMapsByRegion.get(row.regionId)?.get(row.employeeId)
        : undefined;

      return this.mapLiveEmployeeRow({
        row,
        turkeyRank: row.rankingEligibility.isEligible
          ? turkeyRankByEmployee.get(row.employeeId)?.rank ?? null
          : null,
        turkeyPopulation: officialScoreRows.length,
        regionRank: regionRank?.rank ?? null,
        regionPopulation: regionRank?.population ?? 0,
        storeRank: row.rankingEligibility.isEligible
          ? storeRankByEmployee.get(row.employeeId)?.rank ?? null
          : null,
        storePopulation: storeScoreRows.length,
        metricRanks: metricRanksByEmployee.get(row.employeeId) ?? [],
      });
    };

    return {
      source: {
        mode: "live",
        periodType: "monthly",
        state: scoreRows.length > 0 ? "live" : "no_data",
        snapshotRunId: null,
        snapshotDate: null,
        periodStart: latestPeriod.period_start,
        periodEnd: latestPeriod.period_end,
      },
      includedSnapshotRuns: [],
      currentEmployee: currentScoreRow ? toEmployee(currentScoreRow) : null,
      personnelTop: storeScoreRows.slice(0, limit).map((row) => toEmployee(row)),
      availablePeriods: mappedAvailablePeriods,
    };
  }

  private buildLiveEmployeeScoreRows(input: {
    rows: LiveEmployeePerformanceRow[];
    profile: KpiScoreProfile;
    benchmarkLookup: Map<string, number | null>;
  }): LiveEmployeeScoreRow[] {
    const byEmployee = new Map<
      string,
      {
        firstName: string;
        lastName: string;
        storeId: string | null;
        storeName: string | null;
        regionId: string | null;
        positionCode: string | null;
        netSalesValue: number | null;
        storeNetSalesValue: number | null;
        values: Map<
          string,
          {
            label: string;
            actualValue: number;
            targetValue: number | null;
          }
        >;
      }
    >();

    input.rows.forEach((row) => {
      const actualValue = Number(row.actual_value);

      if (!Number.isFinite(actualValue)) {
        return;
      }

      const current = byEmployee.get(row.employee_id) ?? {
        firstName: row.first_name ?? "",
        lastName: row.last_name ?? "",
        storeId: row.store_id,
        storeName: row.store_name ?? null,
        regionId: row.region_id ?? null,
        positionCode: row.position_code ?? null,
        netSalesValue: parseFiniteNumber(row.net_sales_value),
        storeNetSalesValue: parseFiniteNumber(row.store_net_sales_value),
        values: new Map(),
      };
      current.positionCode = current.positionCode ?? row.position_code ?? null;
      current.netSalesValue =
        current.netSalesValue ?? parseFiniteNumber(row.net_sales_value);
      current.storeNetSalesValue =
        current.storeNetSalesValue ?? parseFiniteNumber(row.store_net_sales_value);
      current.values.set(row.kpi_code, {
        label: row.kpi_name ?? row.kpi_code,
        actualValue,
        targetValue: row.target_value !== null ? Number(row.target_value) : null,
      });
      byEmployee.set(row.employee_id, current);
    });

    return [...byEmployee.entries()]
      .map(([employeeId, value]) => {
        const scoring = this.performanceScoreEvaluator.evaluate({
          values: value.values,
          profile: input.profile,
          benchmarkLookup: input.benchmarkLookup,
          benchmarkFallback: "matched-only",
          useStoreChecklistFallback: false,
        });
        const rankingEligibility = resolvePersonnelRankingEligibility({
          positionCode: value.positionCode,
          netSalesValue: value.netSalesValue,
          storeNetSalesValue: value.storeNetSalesValue,
        });

        return {
          employeeId,
          firstName: value.firstName,
          lastName: value.lastName,
          storeId: value.storeId,
          storeName: value.storeName,
          regionId: value.regionId,
          scoreValue: scoring.scoreValue,
          rankingEligibility,
        };
      })
      .sort(
        (left, right) =>
          right.scoreValue - left.scoreValue ||
          left.employeeId.localeCompare(right.employeeId),
      );
  }

  private buildLiveMetricRanksByEmployee(input: {
    rows: LiveEmployeePerformanceRow[];
    employeeIds: string[];
    profile: KpiScoreProfile;
  }) {
    const metricRanksByEmployee = new Map<string, ClosedRankingMetricRank[]>();

    input.profile.metrics.forEach((metric) => {
      const matchingCodes = [metric.code, ...(metric.aliases ?? [])];
      const metricRows = input.rows
        .filter(
          (row) =>
            matchingCodes.includes(row.kpi_code) &&
            Number.isFinite(Number(row.actual_value)),
        )
        .sort(
          (left, right) =>
            Number(right.actual_value) - Number(left.actual_value) ||
            left.employee_id.localeCompare(right.employee_id),
        );
      const turkeyRankByEmployee = this.buildMetricRankMap(metricRows);
      const storeRowsByStore = metricRows.reduce((map, row) => {
        const key = row.store_id ?? "__no_store__";
        const current = map.get(key) ?? [];
        current.push(row);
        map.set(key, current);
        return map;
      }, new Map<string, LiveEmployeePerformanceRow[]>());
      const storeRankMapsByStore = new Map<
        string,
        Map<string, { rank: number; population: number }>
      >();

      storeRowsByStore.forEach((rows, storeKey) => {
        storeRankMapsByStore.set(storeKey, this.buildMetricRankMap(rows));
      });
      const regionRankMapsByRegion = this.buildMetricRegionRankMaps(metricRows);

      input.employeeIds.forEach((employeeId) => {
        const currentRow =
          metricRows.find((row) => row.employee_id === employeeId) ?? null;

        if (!currentRow) {
          return;
        }

        const storeKey = currentRow.store_id ?? "__no_store__";
        const current = metricRanksByEmployee.get(employeeId) ?? [];
        const turkeyRank = turkeyRankByEmployee.get(employeeId);
        const storeRank = storeRankMapsByStore.get(storeKey)?.get(employeeId);
        const regionRank = currentRow.region_id
          ? regionRankMapsByRegion.get(currentRow.region_id)?.get(employeeId)
          : undefined;
        current.push({
          code: metric.code,
          label: currentRow.kpi_name ?? metric.label,
          actualValue: Number(currentRow.actual_value),
          storeRank: storeRank?.rank ?? null,
          storePopulation: storeRank?.population ?? 0,
          regionRank: regionRank?.rank ?? null,
          regionPopulation: regionRank?.population ?? 0,
          turkeyRank: turkeyRank?.rank ?? null,
          turkeyPopulation: turkeyRank?.population ?? 0,
        });
        metricRanksByEmployee.set(employeeId, current);
      });
    });

    return metricRanksByEmployee;
  }

  private buildRankMap(rows: LiveEmployeeScoreRow[]) {
    return new Map(
      rows.map((row, index) => [
        row.employeeId,
        {
          rank: index + 1,
          population: rows.length,
        },
      ]),
    );
  }

  private buildMetricRankMap(rows: LiveEmployeePerformanceRow[]) {
    return new Map(
      rows.map((row, index) => [
        row.employee_id,
        {
          rank: index + 1,
          population: rows.length,
        },
      ]),
    );
  }

  private buildRegionRankMaps(rows: LiveEmployeeScoreRow[]) {
    const rowsByRegion = rows.reduce((map, row) => {
      const key = row.regionId;
      if (!key) return map;
      const current = map.get(key) ?? [];
      current.push(row);
      map.set(key, current);
      return map;
    }, new Map<string, LiveEmployeeScoreRow[]>());

    const rankMaps = new Map<string, Map<string, { rank: number; population: number }>>();
    rowsByRegion.forEach((regionRows, regionId) => {
      rankMaps.set(regionId, this.buildRankMap(regionRows));
    });
    return rankMaps;
  }

  private buildMetricRegionRankMaps(rows: LiveEmployeePerformanceRow[]) {
    const rowsByRegion = rows.reduce((map, row) => {
      const key = row.region_id;
      if (!key) return map;
      const current = map.get(key) ?? [];
      current.push(row);
      map.set(key, current);
      return map;
    }, new Map<string, LiveEmployeePerformanceRow[]>());

    const rankMaps = new Map<string, Map<string, { rank: number; population: number }>>();
    rowsByRegion.forEach((regionRows, regionId) => {
      rankMaps.set(regionId, this.buildMetricRankMap(regionRows));
    });
    return rankMaps;
  }

  private mapLiveEmployeeRow(input: {
    row: LiveEmployeeScoreRow;
    turkeyRank: number | null;
    turkeyPopulation: number;
    regionRank: number | null;
    regionPopulation: number;
    storeRank: number | null;
    storePopulation: number;
    metricRanks: ClosedRankingMetricRank[];
  }): ClosedRankingEmployee {
    return {
      employeeId: input.row.employeeId,
      displayName:
        `${input.row.firstName} ${input.row.lastName}`.trim() || "Unknown employee",
      storeId: input.row.storeId,
      storeName: input.row.storeName,
      scoreValue: input.row.scoreValue,
      rankingStatus: input.row.rankingEligibility.isEligible
        ? "official"
        : "preview_only",
      eligibilityReason: input.row.rankingEligibility.reason,
      neededPerformanceDays: 0,
      rankings: {
        turkeyRank: input.turkeyRank,
        turkeyPopulation: input.turkeyPopulation,
        regionRank: input.regionRank,
        regionPopulation: input.regionPopulation,
        storeRank: input.storeRank,
        storePopulation: input.storePopulation,
      },
      coverage: {
        closedDaysInPeriod: 1,
        daysWithPerformance: 1,
        minimumRequiredDays: 1,
        isEligibleForRanking: input.row.rankingEligibility.isEligible,
      },
      metricRanks: input.metricRanks,
    };
  }

  private resolveLeaderboardStoreFilter(input: {
    storeId?: string;
    roleCodes: string[];
    assignedStoreIds: string[];
    storeIds: string[];
  }) {
    if (input.storeId) {
      this.assertLeaderboardStoreFilterInScope(input);
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

  private assertLeaderboardStoreFilterInScope(input: {
    storeId?: string;
    roleCodes: string[];
    assignedStoreIds: string[];
    storeIds: string[];
  }) {
    if (input.roleCodes.includes("SUPER_ADMIN")) {
      return;
    }

    const allowedStoreIds = [
      ...new Set([...input.storeIds, ...input.assignedStoreIds].filter(Boolean)),
    ];

    if (!allowedStoreIds.includes(input.storeId ?? "")) {
      throw new ForbiddenException("Live leaderboard store is outside current scope");
    }
  }

  private getLiveLeaderboardEmptyResponse(input: {
    periodStart: string | null;
    periodEnd: string | null;
    availablePeriods: Array<{
      periodType: string;
      periodStart: string;
      periodEnd: string;
    }>;
  }): ClosedRankingSummary {
    return {
      source: {
        mode: "live",
        periodType: "monthly",
        state: "no_data",
        snapshotRunId: null,
        snapshotDate: null,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
      },
      includedSnapshotRuns: [],
      currentEmployee: null,
      personnelTop: [],
      availablePeriods: input.availablePeriods,
    };
  }

  private uniqueIds(values: Array<string | null>) {
    return [...new Set(values.filter((value): value is string => Boolean(value)))];
  }

  private resolveMonthEnd(monthStart: string) {
    const year = Number(monthStart.slice(0, 4));
    const month = Number(monthStart.slice(5, 7));
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return `${monthStart.slice(0, 7)}-${String(lastDay).padStart(2, "0")}`;
  }

  private hasUsableBenchmarkRows(rows: Array<{ benchmark_value: string | null }>) {
    return rows.some((row) => {
      if (row.benchmark_value === null) {
        return false;
      }

      const value = Number(row.benchmark_value);
      return Number.isFinite(value) && value !== 0;
    });
  }
}

function parseFiniteNumber(value: string | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}
