import { Injectable } from "@nestjs/common";
import { KpiConfigRepository } from "../infrastructure/kpi-config.repository";
import { RankingReportingReadRepository } from "../infrastructure/ranking-reporting-read.repository";
import { ReportingRepository } from "../infrastructure/reporting.repository";
import { StorePerformanceReportingReadRepository } from "../infrastructure/store-performance-reporting-read.repository";
import { KpiBenchmarkScoringService } from "./kpi-benchmark-scoring.service";
import {
  KpiScoreProfile,
  normalizeKpiScoreProfile,
  personnelKpiScoreProfile,
  storeKpiScoreProfile,
} from "./kpi-config.contract";
import {
  RankingMetricValue,
  PersonnelRankingRow,
  RankingPeriodType,
  RankingReferenceGroup,
  RankingResponse,
  RankingSortDirection,
  RankingSortKey,
} from "./ranking.contract";
import { resolveRankingAccess } from "./ranking-access.policy";
import {
  applyPersonnelFilters,
  applyStoreFilters,
  average,
  getEmptyRankingResponse,
  getMetricComparableValue,
  mapAvailablePeriods,
  maskPersonnelRow,
  maskStoreRow,
  rankPersonnelRows,
  RankingFilters,
  rankStoreRows,
  resolveCurrentStoreId,
  resolveMonthEnd,
  selectGlobalRows,
  sortRowsForList,
  toFiniteNumber,
  uniqueIds,
  UnrankedPersonnelRankingRow,
  UnrankedStoreRankingRow,
} from "./ranking-list.helpers";

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

type ActivePersonnelAssignmentScope = Awaited<
  ReturnType<ReportingRepository["getActiveEmployeeAssignmentScope"]>
>;

const storeChecklistMetricCodes = new Set(["BM_CHECKLIST", "VM_CHECKLIST"]);

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
    private readonly storePerformanceReportingReadRepository: StorePerformanceReportingReadRepository =
      reportingRepository as unknown as StorePerformanceReportingReadRepository,
    private readonly rankingReportingReadRepository: RankingReportingReadRepository =
      reportingRepository as unknown as RankingReportingReadRepository,
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
    const allMetricCodes = uniqueIds([...storeMetricCodes, ...personnelMetricCodes]);

    const [employeeId, latestPeriod] = await Promise.all([
      this.reportingRepository.resolveEmployeeIdForAuthIdentity({
        userId: input.userId,
        employeeId: input.employeeId,
        companyIds: input.companyIds,
      }),
      this.rankingReportingReadRepository.getLatestMonthlyRankingPeriod({
        metricCodes: allMetricCodes,
        periodStart: input.periodStart,
      }),
    ]);

    const availablePeriods =
      await this.rankingReportingReadRepository.listRankingAvailablePeriods({
        metricCodes: allMetricCodes,
      });

    if (!latestPeriod) {
      return getEmptyRankingResponse({
        access,
        availablePeriods,
        periodStart: input.periodStart ?? null,
        periodEnd: input.periodStart ? resolveMonthEnd(input.periodStart) : null,
      });
    }

    const [
      rawStoreKpiRows,
      rawStoreChecklistRows,
      rawPersonnelRows,
      storeBenchmarkRows,
      personnelBenchmarkRows,
      filters,
    ] = await Promise.all([
      this.rankingReportingReadRepository.listRankingStoreKpiRows({
        metricCodes: storeMetricCodes,
        companyIds: input.companyIds,
        periodType: latestPeriod.period_type,
        periodStart: latestPeriod.period_start,
        periodEnd: latestPeriod.period_end,
      }),
      this.rankingReportingReadRepository.listRankingStoreChecklistRows({
        companyIds: input.companyIds,
        periodStart: latestPeriod.period_start,
        periodEnd: latestPeriod.period_end,
      }),
      this.rankingReportingReadRepository.listRankingPersonnelKpiRows({
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
      this.rankingReportingReadRepository.listRankingFilterOptions({
        companyIds: input.companyIds,
        periodType: latestPeriod.period_type,
        periodStart: latestPeriod.period_start,
        periodEnd: latestPeriod.period_end,
      }),
    ]);
    const rawStoreRows = [...rawStoreKpiRows, ...rawStoreChecklistRows];

    const storeBenchmarkLookup = this.toBenchmarkLookup(storeBenchmarkRows);
    const personnelBenchmarkLookup = this.toBenchmarkLookup(personnelBenchmarkRows);
    const storeRows = rankStoreRows(
      this.buildStoreRows({
        rows: rawStoreRows,
        profile: storeProfile,
        benchmarkLookup: storeBenchmarkLookup,
      }),
    );
    const personnelRows = rankPersonnelRows(
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
      ? applyStoreFilters(storeRows, input)
      : storeRows;
    const filteredPersonnelRows = access.isPrivileged
      ? applyPersonnelFilters(personnelRows, input)
      : personnelRows;
    const effectiveSortKey = access.canSeeGlobalDetails ? input.sortKey ?? "score" : "score";
    const effectiveSortDirection = access.canSeeGlobalDetails
      ? input.sortDirection ?? "desc"
      : "desc";
    const sortedStoreRows = sortRowsForList(
      filteredStoreRows,
      effectiveSortKey,
      effectiveSortDirection,
      (row) => row.storeId,
    );
    const sortedPersonnelRows = sortRowsForList(
      filteredPersonnelRows,
      effectiveSortKey,
      effectiveSortDirection,
      (row) => row.employeeId,
    );
    const selectedPersonnelRows = selectGlobalRows(sortedPersonnelRows, access);
    const currentEmployee =
      employeeId !== null
        ? personnelRows.find((row) => row.employeeId === employeeId) ?? null
        : null;
    const currentStoreId = resolveCurrentStoreId(input, currentEmployee);
    const currentStore =
      currentStoreId !== null
        ? storeRows.find((row) => row.storeId === currentStoreId) ?? null
        : null;
    const managedStoreIds = uniqueIds([...input.assignedStoreIds, ...input.storeIds]);
    const managedStorePersonnelRows =
      access.canSeeManagedStorePersonnelDetails && managedStoreIds.length > 0
        ? personnelRows.filter(
            (row) => row.storeId !== null && managedStoreIds.includes(row.storeId),
          )
        : [];
    const personnelProfileAccess = await this.resolvePersonnelProfileAccess({
      rows: [
        ...selectedPersonnelRows,
        ...(currentEmployee ? [currentEmployee] : []),
        ...managedStorePersonnelRows,
      ],
      currentEmployeeId: employeeId,
      roleCodes: input.roleCodes,
      companyIds: input.companyIds,
      regionIds: input.regionIds,
      storeIds: input.storeIds,
      assignedStoreIds: input.assignedStoreIds,
    });
    const withProfileAccess = (
      row: PersonnelRankingRow & { metrics?: RankingMetricValue[] },
    ) => ({
      ...row,
      canOpenProfile: personnelProfileAccess.get(row.employeeId) ?? false,
    });

    const storeItems = selectGlobalRows(sortedStoreRows, access).map((row) =>
      maskStoreRow(row, access.canSeeGlobalDetails ? "detail" : "summary"),
    );
    const personnelItems = selectedPersonnelRows.map((row) =>
      maskPersonnelRow(withProfileAccess(row), access.canSeeGlobalDetails ? "detail" : "summary"),
    );
    const managedStorePersonnel =
      access.canSeeManagedStorePersonnelDetails && managedStoreIds.length > 0
        ? managedStorePersonnelRows.map((row) => maskPersonnelRow(withProfileAccess(row), "detail"))
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
          ? maskStoreRow(currentStore, access.canSeeGlobalDetails ? "detail" : "summary")
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
          ? maskPersonnelRow(
              withProfileAccess(currentEmployee),
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
      availablePeriods: mapAvailablePeriods(availablePeriods),
    };
  }

  private async getKpiProfiles() {
    const rows = await this.kpiConfigRepository.getKpiConfigRows();
    const configMap = new Map(rows.map((row) => [row.config_key, row.config_payload]));
    const storeProfile = configMap.get("store_profile");
    const personnelProfile = configMap.get("personnel_profile");

    return {
      storeProfile: this.isScoreProfile(storeProfile, "store")
        ? normalizeKpiScoreProfile(storeProfile)
        : normalizeKpiScoreProfile(storeKpiScoreProfile),
      personnelProfile: this.isScoreProfile(personnelProfile, "personnel")
        ? normalizeKpiScoreProfile(personnelProfile)
        : normalizeKpiScoreProfile(personnelKpiScoreProfile),
    };
  }

  private async resolvePersonnelProfileAccess(input: {
    rows: Array<PersonnelRankingRow & { metrics?: RankingMetricValue[] }>;
    currentEmployeeId: string | null;
    roleCodes: string[];
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
    assignedStoreIds: string[];
  }) {
    const employeeIds = uniqueIds(input.rows.map((row) => row.employeeId));
    const result = new Map<string, boolean>();
    const managerStoreIds = input.assignedStoreIds.length > 0
      ? input.assignedStoreIds
      : input.storeIds;
    const scopedEmployeeIds = employeeIds.filter((employeeId) => {
      if (input.currentEmployeeId && input.currentEmployeeId === employeeId) {
        result.set(employeeId, true);
        return false;
      }

      return true;
    });
    const assignments =
      await this.reportingRepository.getActiveEmployeeAssignmentScopes(scopedEmployeeIds);
    const assignmentByEmployeeId = new Map(
      assignments.map((assignment) => [assignment.employee_id, assignment]),
    );

    for (const employeeId of scopedEmployeeIds) {
      result.set(
        employeeId,
        this.canReadPersonnelProfileFromActiveAssignment({
          roleCodes: input.roleCodes,
          companyIds: input.companyIds,
          regionIds: input.regionIds,
          storeIds: managerStoreIds,
          assignment: assignmentByEmployeeId.get(employeeId) ?? null,
        }),
      );
    }

    return result;
  }

  private canReadPersonnelProfileFromActiveAssignment(input: {
    roleCodes: string[];
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
    assignment: ActivePersonnelAssignmentScope;
  }) {
    if (!input.assignment) {
      return false;
    }

    if (input.roleCodes.includes("SUPER_ADMIN")) {
      return (
        !this.hasPersonnelReadScope(input) ||
        (input.assignment.company_id !== null &&
          input.companyIds.includes(input.assignment.company_id)) ||
        (input.assignment.region_id !== null &&
          input.regionIds.includes(input.assignment.region_id)) ||
        (input.assignment.store_id !== null &&
          input.storeIds.includes(input.assignment.store_id))
      );
    }

    if (input.roleCodes.includes("REGION_MANAGER")) {
      return (
        input.assignment.region_id !== null &&
        input.regionIds.includes(input.assignment.region_id)
      );
    }

    if (input.roleCodes.includes("STORE_MANAGER")) {
      return (
        input.assignment.store_id !== null &&
        input.storeIds.includes(input.assignment.store_id)
      );
    }

    return false;
  }

  private hasPersonnelReadScope(input: {
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
  }) {
    return (
      input.companyIds.length > 0 ||
      input.regionIds.length > 0 ||
      input.storeIds.length > 0
    );
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
    return uniqueIds(
      profile.metrics.flatMap((metric) => [metric.code, ...(metric.aliases ?? [])]),
    );
  }

  private async getStoreBenchmarks(input: {
    companyId?: string;
    periodType: string;
    periodStart: string;
    periodEnd: string;
  }) {
    let rows = await this.storePerformanceReportingReadRepository.getStoreTurkeyBenchmarkValues(input);

    if (input.companyId && !this.hasUsableBenchmarkRows(rows)) {
      rows = await this.storePerformanceReportingReadRepository.getStoreTurkeyBenchmarkValues({
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
  }): UnrankedStoreRankingRow[] {
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
        actualValue: toFiniteNumber(row.actual_value),
        targetValue: toFiniteNumber(row.target_value),
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
  }): UnrankedPersonnelRankingRow[] {
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
        actualValue: toFiniteNumber(row.actual_value),
        targetValue: toFiniteNumber(row.target_value),
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
          canOpenProfile: false,
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
      const score = storeChecklistMetricCodes.has(metric.code)
        ? {
            scoreContribution:
              actualValue !== null && Number.isFinite(actualValue)
                ? Number(((actualValue * metric.weightPercent) / 100).toFixed(4))
                : null,
          }
        : this.kpiBenchmarkScoringService.scoreMetric({
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

    const scoreValue =
      input.profile.profileCode === "store"
        ? this.scoreStoreProfileWithChecklistFallback({
            metrics,
            profile: input.profile,
          })
        : metrics.reduce((sum, metric) => sum + (metric.contributionValue ?? 0), 0);

    return {
      scoreValue: Number(scoreValue.toFixed(2)),
      metrics,
    };
  }

  private scoreStoreProfileWithChecklistFallback(input: {
    metrics: Array<{ code: string; contributionValue: number | null | undefined }>;
    profile: KpiScoreProfile;
  }) {
    const metricByCode = new Map(input.metrics.map((metric) => [metric.code, metric]));
    const kpiConfiguredWeight = input.profile.metrics
      .filter((metric) => !storeChecklistMetricCodes.has(metric.code))
      .reduce((sum, metric) => sum + metric.weightPercent, 0);
    const kpiContribution = input.profile.metrics
      .filter((metric) => !storeChecklistMetricCodes.has(metric.code))
      .reduce((sum, metric) => {
        const contribution = metricByCode.get(metric.code)?.contributionValue;
        return sum + (contribution ?? 0);
      }, 0);
    const checklistMetrics = input.profile.metrics.filter((metric) =>
      storeChecklistMetricCodes.has(metric.code),
    );
    const checklistContribution = checklistMetrics.reduce((sum, metric) => {
      const contribution = metricByCode.get(metric.code)?.contributionValue;
      return sum + (contribution ?? 0);
    }, 0);
    const missingChecklistWeight = checklistMetrics.reduce((sum, metric) => {
      const contribution = metricByCode.get(metric.code)?.contributionValue;
      return contribution === null || contribution === undefined
        ? sum + metric.weightPercent
        : sum;
    }, 0);

    if (kpiConfiguredWeight <= 0) {
      return checklistContribution;
    }

    return (
      (kpiContribution / kpiConfiguredWeight) *
        (kpiConfiguredWeight + missingChecklistWeight) +
      checklistContribution
    );
  }

  private buildReferenceGroup(input: {
    rows: Array<{ scoreValue: number; metrics: RankingMetricValue[] }>;
    profile: KpiScoreProfile;
    benchmarkLookup: Map<string, number | null>;
  }): RankingReferenceGroup {
    return {
      averageScore: average(input.rows.map((row) => row.scoreValue)),
      metrics: input.profile.metrics.map((metric) => {
        const benchmarkValue = input.benchmarkLookup.get(metric.code) ?? null;
        const value =
          metric.code === "TARGET_ACHIEVEMENT" || benchmarkValue === null
            ? average(
                input.rows.map((row) =>
                  getMetricComparableValue(row.metrics, metric.code),
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

}
