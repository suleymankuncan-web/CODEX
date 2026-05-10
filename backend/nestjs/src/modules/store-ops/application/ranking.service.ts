import { Injectable } from "@nestjs/common";
import { KpiConfigRepository } from "../infrastructure/kpi-config.repository";
import { ReportingRepository } from "../infrastructure/reporting.repository";
import { KpiBenchmarkScoringService } from "./kpi-benchmark-scoring.service";
import {
  KpiScoreProfile,
  personnelKpiScoreProfile,
  storeKpiScoreProfile,
} from "./kpi-config.contract";
import {
  PersonnelRankingRow,
  RankingMetricValue,
  RankingPeriodType,
  RankingReferenceGroup,
  RankingResponse,
  RankingSortDirection,
  RankingSortKey,
  RankingVisibility,
  StoreRankingRow,
} from "./ranking.contract";
import { resolveRankingAccess } from "./ranking-access.policy";

type RankingPeriodRow = {
  period_type: string;
  period_start: string;
  period_end: string;
};

type RawStoreRankingKpiRow = {
  store_id: string;
  store_name: string | null;
  region_id: string | null;
  region_name: string | null;
  region_manager_user_id: string | null;
  region_manager_name: string | null;
  kpi_code: string;
  kpi_name: string | null;
  actual_value: string | null;
  target_value: string | null;
};

type RawPersonnelRankingKpiRow = {
  employee_id: string;
  first_name: string | null;
  last_name: string | null;
  store_id: string | null;
  store_name: string | null;
  region_id: string | null;
  region_name: string | null;
  region_manager_user_id: string | null;
  region_manager_name: string | null;
  kpi_code: string;
  kpi_name: string | null;
  actual_value: string | null;
  target_value: string | null;
};

type RankingFilters = {
  regionManagerUserId?: string;
  regionId?: string;
  storeId?: string;
  search?: string;
};

export type GetRankingsInput = RankingFilters & {
  userId: string;
  employeeId?: string;
  roleCodes: string[];
  companyIds: string[];
  regionIds: string[];
  storeIds: string[];
  assignedStoreIds: string[];
  periodType?: RankingPeriodType;
  periodStart?: string;
  sortKey?: RankingSortKey;
  sortDirection?: RankingSortDirection;
  limit?: number;
  offset?: number;
};

@Injectable()
export class RankingService {
  private readonly kpiBenchmarkScoringService = new KpiBenchmarkScoringService();

  constructor(
    private readonly reportingRepository: ReportingRepository,
    private readonly kpiConfigRepository: KpiConfigRepository,
  ) {}

  async getRankings(input: GetRankingsInput): Promise<RankingResponse> {
    const access = resolveRankingAccess({
      roleCodes: input.roleCodes,
      requestedLimit: input.limit,
      requestedOffset: input.offset,
    });
    const { storeProfile, personnelProfile } = await this.getKpiProfiles();
    const storeMetricCodes = this.getProfileMetricCodes(storeProfile);
    const personnelMetricCodes = this.getProfileMetricCodes(personnelProfile);
    const allMetricCodes = this.uniqueIds([...storeMetricCodes, ...personnelMetricCodes]);

    const [employeeId, latestPeriod] = await Promise.all([
      this.reportingRepository.resolveEmployeeIdForAuthIdentity({
        userId: input.userId,
        employeeId: input.employeeId,
        companyIds: input.companyIds,
      }),
      this.reportingRepository.getLatestMonthlyRankingPeriod({
        metricCodes: allMetricCodes,
        periodStart: input.periodStart,
      }),
    ]);

    const availablePeriods = await this.reportingRepository.listRankingAvailablePeriods({
      metricCodes: allMetricCodes,
    });

    if (!latestPeriod) {
      return this.getEmptyResponse({
        access,
        availablePeriods,
        periodStart: input.periodStart ?? null,
        periodEnd: input.periodStart ? this.resolveMonthEnd(input.periodStart) : null,
      });
    }

    const [
      rawStoreRows,
      rawPersonnelRows,
      storeBenchmarkRows,
      personnelBenchmarkRows,
      filters,
    ] = await Promise.all([
      this.reportingRepository.listRankingStoreKpiRows({
        metricCodes: storeMetricCodes,
        companyIds: input.companyIds,
        periodType: latestPeriod.period_type,
        periodStart: latestPeriod.period_start,
        periodEnd: latestPeriod.period_end,
      }),
      this.reportingRepository.listRankingPersonnelKpiRows({
        metricCodes: personnelMetricCodes,
        companyIds: input.companyIds,
        periodType: latestPeriod.period_type,
        periodStart: latestPeriod.period_start,
        periodEnd: latestPeriod.period_end,
      }),
      this.getStoreBenchmarks({
        companyId: input.companyIds[0],
        periodType: latestPeriod.period_type,
        periodStart: latestPeriod.period_start,
        periodEnd: latestPeriod.period_end,
      }),
      this.getPersonnelBenchmarks({
        companyId: input.companyIds[0],
        periodType: latestPeriod.period_type,
        periodStart: latestPeriod.period_start,
        periodEnd: latestPeriod.period_end,
      }),
      this.reportingRepository.listRankingFilterOptions({
        companyIds: input.companyIds,
        periodType: latestPeriod.period_type,
        periodStart: latestPeriod.period_start,
        periodEnd: latestPeriod.period_end,
      }),
    ]);

    const storeBenchmarkLookup = this.toBenchmarkLookup(storeBenchmarkRows);
    const personnelBenchmarkLookup = this.toBenchmarkLookup(personnelBenchmarkRows);
    const storeRows = this.rankStoreRows(
      this.buildStoreRows({
        rows: rawStoreRows,
        profile: storeProfile,
        benchmarkLookup: storeBenchmarkLookup,
      }),
    );
    const personnelRows = this.rankPersonnelRows(
      this.buildPersonnelRows({
        rows: rawPersonnelRows,
        profile: personnelProfile,
        benchmarkLookup: personnelBenchmarkLookup,
      }),
    );
    const reference = {
      store: this.buildReferenceGroup({
        rows: storeRows,
        profile: storeProfile,
        benchmarkLookup: storeBenchmarkLookup,
      }),
      personnel: this.buildReferenceGroup({
        rows: personnelRows,
        profile: personnelProfile,
        benchmarkLookup: personnelBenchmarkLookup,
      }),
    };

    const filteredStoreRows = access.isPrivileged
      ? this.applyStoreFilters(storeRows, input)
      : storeRows;
    const filteredPersonnelRows = access.isPrivileged
      ? this.applyPersonnelFilters(personnelRows, input)
      : personnelRows;
    const effectiveSortKey = access.canSeeGlobalDetails ? input.sortKey ?? "score" : "score";
    const effectiveSortDirection = access.canSeeGlobalDetails
      ? input.sortDirection ?? "desc"
      : "desc";
    const sortedStoreRows = this.sortRowsForList(
      filteredStoreRows,
      effectiveSortKey,
      effectiveSortDirection,
      (row) => row.storeId,
    );
    const sortedPersonnelRows = this.sortRowsForList(
      filteredPersonnelRows,
      effectiveSortKey,
      effectiveSortDirection,
      (row) => row.employeeId,
    );
    const storeItems = this.selectGlobalRows(sortedStoreRows, access).map((row) =>
      this.maskStoreRow(row, access.canSeeGlobalDetails ? "detail" : "summary"),
    );
    const personnelItems = this.selectGlobalRows(sortedPersonnelRows, access).map((row) =>
      this.maskPersonnelRow(row, access.canSeeGlobalDetails ? "detail" : "summary"),
    );
    const currentEmployee =
      employeeId !== null
        ? personnelRows.find((row) => row.employeeId === employeeId) ?? null
        : null;
    const currentStoreId = this.resolveCurrentStoreId(input, currentEmployee);
    const currentStore =
      currentStoreId !== null
        ? storeRows.find((row) => row.storeId === currentStoreId) ?? null
        : null;
    const managedStoreIds = this.uniqueIds([...input.assignedStoreIds, ...input.storeIds]);
    const managedStorePersonnel =
      access.canSeeManagedStorePersonnelDetails && managedStoreIds.length > 0
        ? personnelRows
            .filter((row) => row.storeId !== null && managedStoreIds.includes(row.storeId))
            .map((row) => this.maskPersonnelRow(row, "detail"))
        : [];

    return {
      source: {
        mode: "live",
        periodType: "monthly",
        periodStart: latestPeriod.period_start,
        periodEnd: latestPeriod.period_end,
      },
      access: {
        globalMode: access.globalMode,
        canSeeGlobalDetails: access.canSeeGlobalDetails,
        canSeeManagedStorePersonnelDetails: access.canSeeManagedStorePersonnelDetails,
      },
      filters,
      reference,
      storeLeaderboard: {
        items: storeItems,
        currentStore: currentStore
          ? this.maskStoreRow(currentStore, access.canSeeGlobalDetails ? "detail" : "summary")
          : null,
        meta: {
          total: access.isPrivileged ? filteredStoreRows.length : storeRows.length,
          limit: access.globalLimit,
          offset: access.globalOffset,
        },
      },
      personnelLeaderboard: {
        items: personnelItems,
        currentEmployee: currentEmployee
          ? this.maskPersonnelRow(
              currentEmployee,
              access.canSeeGlobalDetails ? "detail" : "summary",
            )
          : null,
        managedStorePersonnel,
        meta: {
          total: access.isPrivileged ? filteredPersonnelRows.length : personnelRows.length,
          limit: access.globalLimit,
          offset: access.globalOffset,
        },
      },
      availablePeriods: this.mapAvailablePeriods(availablePeriods),
    };
  }

  private async getKpiProfiles() {
    const rows = await this.kpiConfigRepository.getKpiConfigRows();
    const configMap = new Map(rows.map((row) => [row.config_key, row.config_payload]));
    const storeProfile = configMap.get("store_profile");
    const personnelProfile = configMap.get("personnel_profile");

    return {
      storeProfile: this.isScoreProfile(storeProfile, "store")
        ? storeProfile
        : storeKpiScoreProfile,
      personnelProfile: this.isScoreProfile(personnelProfile, "personnel")
        ? personnelProfile
        : personnelKpiScoreProfile,
    };
  }

  private isScoreProfile(
    value: unknown,
    profileCode: "store" | "personnel",
  ): value is KpiScoreProfile {
    const profile = value as KpiScoreProfile | null;
    return (
      Boolean(profile) &&
      profile?.profileCode === profileCode &&
      Array.isArray(profile.metrics) &&
      profile.metrics.length > 0
    );
  }

  private getProfileMetricCodes(profile: KpiScoreProfile) {
    return this.uniqueIds(
      profile.metrics.flatMap((metric) => [metric.code, ...(metric.aliases ?? [])]),
    );
  }

  private async getStoreBenchmarks(input: {
    companyId?: string;
    periodType: string;
    periodStart: string;
    periodEnd: string;
  }) {
    let rows = await this.reportingRepository.getStoreTurkeyBenchmarkValues(input);

    if (input.companyId && !this.hasUsableBenchmarkRows(rows)) {
      rows = await this.reportingRepository.getStoreTurkeyBenchmarkValues({
        ...input,
        companyId: undefined,
      });
    }

    return rows;
  }

  private async getPersonnelBenchmarks(input: {
    companyId?: string;
    periodType: string;
    periodStart: string;
    periodEnd: string;
  }) {
    let rows = await this.reportingRepository.getEmployeeTurkeyBenchmarkValues(input);

    if (input.companyId && !this.hasUsableBenchmarkRows(rows)) {
      rows = await this.reportingRepository.getEmployeeTurkeyBenchmarkValues({
        ...input,
        companyId: undefined,
      });
    }

    return rows;
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

  private toBenchmarkLookup(rows: Array<{ kpi_code: string; benchmark_value: string | null }>) {
    return new Map(
      rows.map((row) => [
        row.kpi_code,
        row.benchmark_value !== null ? Number(row.benchmark_value) : null,
      ]),
    );
  }

  private buildStoreRows(input: {
    rows: RawStoreRankingKpiRow[];
    profile: KpiScoreProfile;
    benchmarkLookup: Map<string, number | null>;
  }): Array<Omit<StoreRankingRow, "rank" | "population" | "visibility"> & {
    metrics: RankingMetricValue[];
  }> {
    const grouped = new Map<
      string,
      {
        storeName: string | null;
        regionId: string | null;
        regionName: string | null;
        regionManagerUserId: string | null;
        regionManagerName: string | null;
        values: Map<
          string,
          {
            label: string;
            actualValue: number | null;
            targetValue: number | null;
          }
        >;
      }
    >();

    input.rows.forEach((row) => {
      const current = grouped.get(row.store_id) ?? {
        storeName: row.store_name,
        regionId: row.region_id,
        regionName: row.region_name,
        regionManagerUserId: row.region_manager_user_id,
        regionManagerName: row.region_manager_name,
        values: new Map(),
      };
      current.values.set(row.kpi_code, {
        label: row.kpi_name ?? row.kpi_code,
        actualValue: this.toFiniteNumber(row.actual_value),
        targetValue: this.toFiniteNumber(row.target_value),
      });
      grouped.set(row.store_id, current);
    });

    return [...grouped.entries()]
      .map(([storeId, value]) => {
        const scoring = this.scoreProfile({
          values: value.values,
          profile: input.profile,
          benchmarkLookup: input.benchmarkLookup,
        });

        return {
          subject: "store" as const,
          storeId,
          storeName: value.storeName,
          regionId: value.regionId,
          regionName: value.regionName,
          regionManagerUserId: value.regionManagerUserId,
          regionManagerName: value.regionManagerName,
          scoreValue: scoring.scoreValue,
          metrics: scoring.metrics,
        };
      })
      .filter((row) => row.metrics.some((metric) => metric.actualValue !== null));
  }

  private buildPersonnelRows(input: {
    rows: RawPersonnelRankingKpiRow[];
    profile: KpiScoreProfile;
    benchmarkLookup: Map<string, number | null>;
  }): Array<
    Omit<
      PersonnelRankingRow,
      "rank" | "population" | "storeRank" | "storePopulation" | "visibility"
    > & {
      metrics: RankingMetricValue[];
    }
  > {
    const grouped = new Map<
      string,
      {
        firstName: string | null;
        lastName: string | null;
        storeId: string | null;
        storeName: string | null;
        regionId: string | null;
        regionName: string | null;
        regionManagerUserId: string | null;
        regionManagerName: string | null;
        values: Map<
          string,
          {
            label: string;
            actualValue: number | null;
            targetValue: number | null;
          }
        >;
      }
    >();

    input.rows.forEach((row) => {
      const current = grouped.get(row.employee_id) ?? {
        firstName: row.first_name,
        lastName: row.last_name,
        storeId: row.store_id,
        storeName: row.store_name,
        regionId: row.region_id,
        regionName: row.region_name,
        regionManagerUserId: row.region_manager_user_id,
        regionManagerName: row.region_manager_name,
        values: new Map(),
      };
      current.values.set(row.kpi_code, {
        label: row.kpi_name ?? row.kpi_code,
        actualValue: this.toFiniteNumber(row.actual_value),
        targetValue: this.toFiniteNumber(row.target_value),
      });
      grouped.set(row.employee_id, current);
    });

    return [...grouped.entries()]
      .map(([employeeId, value]) => {
        const scoring = this.scoreProfile({
          values: value.values,
          profile: input.profile,
          benchmarkLookup: input.benchmarkLookup,
        });
        const displayName = [value.firstName, value.lastName]
          .filter(Boolean)
          .join(" ")
          .trim();

        return {
          subject: "personnel" as const,
          employeeId,
          displayName: displayName || employeeId,
          storeId: value.storeId,
          storeName: value.storeName,
          regionId: value.regionId,
          regionName: value.regionName,
          regionManagerUserId: value.regionManagerUserId,
          regionManagerName: value.regionManagerName,
          scoreValue: scoring.scoreValue,
          metrics: scoring.metrics,
        };
      })
      .filter((row) => row.metrics.some((metric) => metric.actualValue !== null));
  }

  private scoreProfile(input: {
    values: Map<
      string,
      {
        label: string;
        actualValue: number | null;
        targetValue: number | null;
      }
    >;
    profile: KpiScoreProfile;
    benchmarkLookup: Map<string, number | null>;
  }) {
    const metrics = input.profile.metrics.map((metric) => {
      const matchingCodes = [metric.code, ...(metric.aliases ?? [])];
      const matchedCode = matchingCodes.find((code) => input.values.has(code));
      const matchedMetric = matchedCode ? input.values.get(matchedCode) : undefined;
      const actualValue = matchedMetric?.actualValue ?? null;
      const targetValue = matchedMetric?.targetValue ?? null;
      const benchmarkSource =
        metric.benchmarkSource ?? (targetValue !== null ? "TARGET" : "TURKEY_AVERAGE");
      const benchmarkValue =
        benchmarkSource === "TURKEY_AVERAGE" && matchedCode
          ? input.benchmarkLookup.get(matchedCode) ??
            input.benchmarkLookup.get(metric.code) ??
            null
          : null;
      const score = this.kpiBenchmarkScoringService.scoreMetric({
        metricCode: metric.code,
        actualValue,
        benchmarkValue,
        targetValue,
        weightPercent: metric.weightPercent,
        direction: metric.direction ?? "HIGHER_IS_BETTER",
        benchmarkSource,
        capRatio: metric.capRatio ?? 1.2,
      });

      return {
        code: metric.code,
        label: matchedMetric?.label ?? metric.label,
        actualValue,
        targetValue,
        benchmarkValue,
        contributionValue: score.scoreContribution,
      };
    });

    const scoreValue = metrics.reduce(
      (sum, metric) => sum + (metric.contributionValue ?? 0),
      0,
    );

    return {
      scoreValue: Number(scoreValue.toFixed(2)),
      metrics,
    };
  }

  private buildReferenceGroup(input: {
    rows: Array<{ scoreValue: number; metrics: RankingMetricValue[] }>;
    profile: KpiScoreProfile;
    benchmarkLookup: Map<string, number | null>;
  }): RankingReferenceGroup {
    return {
      averageScore: this.average(input.rows.map((row) => row.scoreValue)),
      metrics: input.profile.metrics.map((metric) => {
        const benchmarkValue = input.benchmarkLookup.get(metric.code) ?? null;
        const value =
          metric.code === "TARGET_ACHIEVEMENT" || benchmarkValue === null
            ? this.average(
                input.rows.map((row) =>
                  this.getMetricComparableValue(row.metrics, metric.code),
                ),
              )
            : benchmarkValue;

        return {
          code: metric.code,
          label: metric.label,
          value,
        };
      }),
    };
  }

  private sortRowsForList<Row extends { rank: number; scoreValue: number; metrics: RankingMetricValue[] }>(
    rows: Row[],
    sortKey: RankingSortKey,
    sortDirection: RankingSortDirection,
    stableId: (row: Row) => string,
  ) {
    const direction = sortDirection === "desc" ? -1 : 1;

    return [...rows].sort((left, right) => {
      const leftValue = this.getSortValue(left, sortKey);
      const rightValue = this.getSortValue(right, sortKey);

      if (leftValue === null && rightValue === null) {
        return left.rank - right.rank || stableId(left).localeCompare(stableId(right));
      }

      if (leftValue === null) {
        return 1;
      }

      if (rightValue === null) {
        return -1;
      }

      return (
        (leftValue - rightValue) * direction ||
        left.rank - right.rank ||
        stableId(left).localeCompare(stableId(right))
      );
    });
  }

  private getSortValue(
    row: { scoreValue: number; metrics: RankingMetricValue[] },
    sortKey: RankingSortKey,
  ) {
    if (sortKey === "score") {
      return row.scoreValue;
    }

    return this.getMetricComparableValue(row.metrics, sortKey);
  }

  private getMetricComparableValue(metrics: RankingMetricValue[], code: string) {
    const metric = metrics.find((candidate) => candidate.code === code);

    if (!metric || metric.actualValue === null || !Number.isFinite(metric.actualValue)) {
      return null;
    }

    if (code !== "TARGET_ACHIEVEMENT") {
      return metric.actualValue;
    }

    if (
      metric.targetValue === null ||
      metric.targetValue === undefined ||
      !Number.isFinite(metric.targetValue) ||
      metric.targetValue === 0
    ) {
      return metric.actualValue;
    }

    return metric.actualValue / Math.abs(metric.targetValue);
  }

  private average(values: Array<number | null>) {
    const numericValues = values.filter(
      (value): value is number => value !== null && Number.isFinite(value),
    );

    if (!numericValues.length) {
      return null;
    }

    return Number(
      (
        numericValues.reduce((total, value) => total + value, 0) /
        numericValues.length
      ).toFixed(4),
    );
  }

  private rankStoreRows(
    rows: Array<Omit<StoreRankingRow, "rank" | "population" | "visibility"> & {
      metrics: RankingMetricValue[];
    }>,
  ): Array<StoreRankingRow & { metrics: RankingMetricValue[] }> {
    const sorted = [...rows].sort(
      (left, right) =>
        right.scoreValue - left.scoreValue || left.storeId.localeCompare(right.storeId),
    );
    const population = sorted.length;

    return sorted.map((row, index) => ({
      ...row,
      rank: index + 1,
      population,
      visibility: "detail",
    }));
  }

  private rankPersonnelRows(
    rows: Array<
      Omit<
        PersonnelRankingRow,
        "rank" | "population" | "storeRank" | "storePopulation" | "visibility"
      > & {
        metrics: RankingMetricValue[];
      }
    >,
  ): Array<PersonnelRankingRow & { metrics: RankingMetricValue[] }> {
    const sorted = [...rows].sort(
      (left, right) =>
        right.scoreValue - left.scoreValue ||
        left.employeeId.localeCompare(right.employeeId),
    );
    const storeRanks = this.buildStoreRanks(sorted);
    const population = sorted.length;

    return sorted.map((row, index) => {
      const storeRank = storeRanks.get(row.employeeId);

      return {
        ...row,
        rank: index + 1,
        population,
        storeRank: storeRank?.rank ?? null,
        storePopulation: storeRank?.population ?? 0,
        visibility: "detail",
      };
    });
  }

  private buildStoreRanks(
    rows: Array<{
      employeeId: string;
      storeId: string | null;
      scoreValue: number;
    }>,
  ) {
    const byStore = rows.reduce((map, row) => {
      const key = row.storeId ?? "__no_store__";
      const current = map.get(key) ?? [];
      current.push(row);
      map.set(key, current);
      return map;
    }, new Map<string, Array<{ employeeId: string; storeId: string | null; scoreValue: number }>>());
    const ranks = new Map<string, { rank: number; population: number }>();

    byStore.forEach((storeRows) => {
      const sorted = [...storeRows].sort(
        (left, right) =>
          right.scoreValue - left.scoreValue ||
          left.employeeId.localeCompare(right.employeeId),
      );
      sorted.forEach((row, index) => {
        ranks.set(row.employeeId, {
          rank: index + 1,
          population: sorted.length,
        });
      });
    });

    return ranks;
  }

  private applyStoreFilters(
    rows: Array<StoreRankingRow & { metrics: RankingMetricValue[] }>,
    filters: RankingFilters,
  ) {
    const normalizedSearch = this.normalizeSearch(filters.search);

    return rows.filter((row) => {
      if (
        filters.regionManagerUserId &&
        row.regionManagerUserId !== filters.regionManagerUserId
      ) {
        return false;
      }

      if (filters.regionId && row.regionId !== filters.regionId) {
        return false;
      }

      if (filters.storeId && row.storeId !== filters.storeId) {
        return false;
      }

      if (normalizedSearch && !this.matchesSearch(normalizedSearch, [
        row.storeName,
        row.regionName,
        row.regionManagerName,
      ])) {
        return false;
      }

      return true;
    });
  }

  private applyPersonnelFilters(
    rows: Array<PersonnelRankingRow & { metrics: RankingMetricValue[] }>,
    filters: RankingFilters,
  ) {
    const normalizedSearch = this.normalizeSearch(filters.search);

    return rows.filter((row) => {
      if (
        filters.regionManagerUserId &&
        row.regionManagerUserId !== filters.regionManagerUserId
      ) {
        return false;
      }

      if (filters.regionId && row.regionId !== filters.regionId) {
        return false;
      }

      if (filters.storeId && row.storeId !== filters.storeId) {
        return false;
      }

      if (normalizedSearch && !this.matchesSearch(normalizedSearch, [
        row.displayName,
        row.storeName,
        row.regionName,
        row.regionManagerName,
      ])) {
        return false;
      }

      return true;
    });
  }

  private selectGlobalRows<Row>(rows: Row[], access: { globalLimit: number; globalOffset: number; isPrivileged: boolean }) {
    if (!access.isPrivileged) {
      return rows.slice(0, access.globalLimit);
    }

    return rows.slice(access.globalOffset, access.globalOffset + access.globalLimit);
  }

  private maskStoreRow(
    row: StoreRankingRow & { metrics?: RankingMetricValue[] },
    visibility: RankingVisibility,
  ): StoreRankingRow {
    if (visibility === "detail") {
      return {
        ...row,
        visibility,
        metrics: row.metrics ?? [],
      };
    }

    const { metrics: _metrics, ...summary } = row;
    return {
      ...summary,
      visibility,
    };
  }

  private maskPersonnelRow(
    row: PersonnelRankingRow & { metrics?: RankingMetricValue[] },
    visibility: RankingVisibility,
  ): PersonnelRankingRow {
    if (visibility === "detail") {
      return {
        ...row,
        visibility,
        metrics: row.metrics ?? [],
      };
    }

    const { metrics: _metrics, ...summary } = row;
    return {
      ...summary,
      visibility,
    };
  }

  private resolveCurrentStoreId(
    input: GetRankingsInput,
    currentEmployee: PersonnelRankingRow | null,
  ) {
    return (
      input.assignedStoreIds[0] ??
      input.storeIds[0] ??
      currentEmployee?.storeId ??
      null
    );
  }

  private mapAvailablePeriods(periods: RankingPeriodRow[]) {
    return periods.map((period) => ({
      periodType: "monthly" as const,
      periodStart: period.period_start,
      periodEnd: period.period_end,
    }));
  }

  private getEmptyResponse(input: {
    access: ReturnType<typeof resolveRankingAccess>;
    availablePeriods: RankingPeriodRow[];
    periodStart: string | null;
    periodEnd: string | null;
  }): RankingResponse {
    return {
      source: {
        mode: "live",
        periodType: "monthly",
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
      },
      access: {
        globalMode: input.access.globalMode,
        canSeeGlobalDetails: input.access.canSeeGlobalDetails,
        canSeeManagedStorePersonnelDetails:
          input.access.canSeeManagedStorePersonnelDetails,
      },
      filters: {
        regionManagers: [],
        regions: [],
        stores: [],
      },
      reference: {
        store: {
          averageScore: null,
          metrics: [],
        },
        personnel: {
          averageScore: null,
          metrics: [],
        },
      },
      storeLeaderboard: {
        items: [],
        currentStore: null,
        meta: {
          total: 0,
          limit: input.access.globalLimit,
          offset: input.access.globalOffset,
        },
      },
      personnelLeaderboard: {
        items: [],
        currentEmployee: null,
        managedStorePersonnel: [],
        meta: {
          total: 0,
          limit: input.access.globalLimit,
          offset: input.access.globalOffset,
        },
      },
      availablePeriods: this.mapAvailablePeriods(input.availablePeriods),
    };
  }

  private toFiniteNumber(value: string | null) {
    if (value === null) {
      return null;
    }

    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
  }

  private normalizeSearch(value?: string) {
    const normalized = value?.trim().toLocaleLowerCase("tr-TR");
    return normalized ? normalized : null;
  }

  private matchesSearch(search: string, candidates: Array<string | null>) {
    return candidates.some((candidate) =>
      candidate?.toLocaleLowerCase("tr-TR").includes(search),
    );
  }

  private uniqueIds(values: Array<string | null | undefined>) {
    return [...new Set(values.filter((value): value is string => Boolean(value)))];
  }

  private resolveMonthEnd(periodStart: string) {
    const [year, month] = periodStart.split("-").map(Number);

    if (!year || !month) {
      return null;
    }

    const monthEnd = new Date(Date.UTC(year, month, 0));
    return monthEnd.toISOString().slice(0, 10);
  }
}
