import { Injectable } from "@nestjs/common";
import { buildCurrentStoreComparisons } from "./ranking-store-comparisons";
import { resolveRankingDateRange } from "./ranking-date-range";
import { KpiConfigRepository } from "../infrastructure/kpi-config.repository";
import { RankingReportingReadRepository } from "../infrastructure/ranking-reporting-read.repository";
import { ReportingRepository } from "../infrastructure/reporting.repository";
import { StorePerformanceReportingReadRepository } from "../infrastructure/store-performance-reporting-read.repository";
import {
  KpiScoreProfile,
  normalizeKpiScoreProfile,
  personnelKpiScoreProfile,
  storeKpiScoreProfile,
} from "./kpi-config.contract";
import { PerformanceScoreEvaluator } from "./performance-score-evaluator.service";
import {
  RankingMetricValue,
  PersonnelRankingRow,
  RankingPeriodType,
  RankingResponse,
  RankingSortDirection,
  RankingSortKey,
} from "./ranking.contract";
import { resolveRankingAccess } from "./ranking-access.policy";
import {
  applyPersonnelFilters,
  buildRankingReferenceGroup,
  getEmptyRankingResponse,
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
import { resolveRankingScopePolicy } from "./ranking-scope-policy";
import { filterPersonnelByActiveAssignmentScope } from "./ranking-personnel-scope";
import {
  resolvePersonnelRankingEligibility,
  type PersonnelRankingEligibilityResult,
} from "./personnel-ranking-eligibility.contract";
import { buildRegionManagerSummary } from "./ranking-region-manager-summary";
import { buildBoundedManagedPersonnelPage } from "./ranking-managed-personnel-page";
import { personnelStoreScoreShares } from "./personnel-store-score-share";
import {
  buildScopedRankingFilterOptions,
  selectScopedRankingFilterRows,
} from "./ranking-filter-options";
import { buildCompanyManagerStoreView, replaceManagerFilterOptions } from "./ranking-company-manager-directory";

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
  achievement_rate?: string | null;
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
  position_code?: string | null;
  net_sales_value?: string | null;
  store_net_sales_value?: string | null;
  kpi_code: string;
  kpi_name: string | null;
  actual_value: string | null;
  target_value: string | null;
};
type UnrankedPersonnelRankingCandidate = UnrankedPersonnelRankingRow & {
  rankingEligibility: PersonnelRankingEligibilityResult;
  allocationWeight: number | null;
};
type ActivePersonnelAssignmentScope = Awaited<ReturnType<
  ReportingRepository["getActiveEmployeeAssignmentScope"]
>>;
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
  periodEnd?: string;
  sortKey?: RankingSortKey;
  sortDirection?: RankingSortDirection;
  limit?: number;
  offset?: number;
  regionManagerLimit?: number;
  regionManagerOffset?: number;
  regionManagerRiskOffset?: number;
  regionManagerUnassigned?: boolean;
  managedPersonnelLimit?: number;
  managedPersonnelOffset?: number;
};

@Injectable()
export class RankingService {
  private readonly performanceScoreEvaluator = new PerformanceScoreEvaluator();

  constructor(
    private readonly reportingRepository: ReportingRepository,
    private readonly kpiConfigRepository: KpiConfigRepository,
    private readonly storePerformanceReportingReadRepository: StorePerformanceReportingReadRepository,
    private readonly rankingReportingReadRepository: RankingReportingReadRepository,
  ) {}

  async getRankings(input: GetRankingsInput): Promise<RankingResponse> {
    const dateRange = resolveRankingDateRange(input);
    const access = resolveRankingAccess({
      roleCodes: input.roleCodes,
      requestedLimit: input.limit,
      requestedOffset: input.offset,
    });
    const scopePolicy = resolveRankingScopePolicy(input);

    if (scopePolicy.failClosed) {
      return getEmptyRankingResponse({
        access,
        availablePeriods: [],
        periodType: input.periodType ?? "monthly",
        periodStart: input.periodStart ?? null,
        periodEnd: input.periodStart
          ? input.periodType === "daily"
            ? input.periodStart
            : resolveMonthEnd(input.periodStart)
          : null,
      });
    }
    const { storeProfile, personnelProfile } = await this.getKpiProfiles();
    const storeMetricCodes = this.getProfileMetricCodes(storeProfile);
    const personnelMetricCodes = this.getProfileMetricCodes(personnelProfile);
    const allMetricCodes = uniqueIds([...storeMetricCodes, ...personnelMetricCodes]);
    const canReadCompanyHierarchy = input.roleCodes.some(
      (role) => role === "REPORT_VIEWER" || role === "SUPER_ADMIN",
    );
    const [employeeId, latestPeriod, activeScopeSummary] = await Promise.all([
      this.reportingRepository.resolveEmployeeIdForAuthIdentity({
        userId: input.userId,
        employeeId: input.employeeId,
        companyIds: input.companyIds,
      }),
      dateRange ?? this.rankingReportingReadRepository.getLatestRankingPeriod({
        metricCodes: allMetricCodes,
        periodType: input.periodType ?? "monthly",
        periodStart: input.periodStart,
      }),
      this.reportingRepository.getActiveStorePersonnelScopeSummary(
        this.resolveActiveScopeSummaryInput(input),
      ),
    ]);
    const scopeSummary = this.toScopeSummary(activeScopeSummary);

    const availablePeriods =
      await this.rankingReportingReadRepository.listRankingAvailablePeriods({
        metricCodes: allMetricCodes,
      });

    if (!latestPeriod) {
      return getEmptyRankingResponse({
        access,
        availablePeriods,
        periodType: input.periodType ?? "monthly",
        periodStart: input.periodStart ?? null,
        periodEnd: input.periodStart
          ? input.periodType === "daily"
            ? input.periodStart
            : resolveMonthEnd(input.periodStart)
          : null,
        scopeSummary,
      });
    }

    const [
      rawStoreKpiRows,
      rawStoreChecklistRows,
      rawPersonnelRows,
      storeBenchmarkRows,
      personnelBenchmarkRows,
      companyFilterOptions,
    ] = await Promise.all([
      this.rankingReportingReadRepository.listRankingStoreKpiRows({
        isRange: Boolean(dateRange),
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
        isRange: Boolean(dateRange),
        metricCodes: personnelMetricCodes,
        companyIds: input.companyIds,
        periodType: latestPeriod.period_type,
        periodStart: latestPeriod.period_start,
        periodEnd: latestPeriod.period_end,
      }),
      this.getStoreBenchmarks({
        isRange: Boolean(dateRange),
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
      canReadCompanyHierarchy
        ? this.rankingReportingReadRepository.listRankingFilterOptions({
            companyIds: input.companyIds,
            periodType: latestPeriod.period_type,
            periodStart: latestPeriod.period_start,
            periodEnd: latestPeriod.period_end,
          })
        : Promise.resolve(null),
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
    const personnelCandidates = this.buildPersonnelRows({
      rows: rawPersonnelRows,
      profile: personnelProfile,
      benchmarkLookup: personnelBenchmarkLookup,
    });
    const storeScoreShares = personnelStoreScoreShares(personnelCandidates.filter(
      row => row.rankingEligibility.reason !== "store_manager_excluded",
    ));
    const personnelRows = rankPersonnelRows(
      personnelCandidates
        .filter((row) => row.rankingEligibility.isEligible)
        .map(({ rankingEligibility: _rankingEligibility, allocationWeight: _allocationWeight, ...row }) => ({
          ...row, storeScoreShare: storeScoreShares.get(row.employeeId) ?? null,
        })),
    );
    const activePersonnelAssignments =
      await this.reportingRepository.getActiveEmployeeAssignmentScopes(
        uniqueIds(personnelRows.map((row) => row.employeeId)),
      );
    const assignmentByEmployeeId = new Map(
      activePersonnelAssignments.map((assignment) => [assignment.employee_id, assignment]),
    );
    const { companyFilters, filteredStoreRows } = buildCompanyManagerStoreView({
      rows: storeRows, filters: input, directory: companyFilterOptions?.regionManagers,
      canReadCompanyHierarchy, isPrivileged: access.isPrivileged,
      enforceAssignedReadScope: scopePolicy.enforceAssignedReadScope,
    });
    const authorizedStoreRows = selectScopedRankingFilterRows({
      rows: storeRows,
      isPrivileged: access.isPrivileged,
      assignedStoreIds: input.assignedStoreIds,
      enforceAssignedReadScope: scopePolicy.enforceAssignedReadScope,
      regionIds: input.regionIds,
      storeIds: input.storeIds,
    });
    const activeScopedPersonnelRows = access.isPrivileged
      ? filterPersonnelByActiveAssignmentScope(personnelRows, {
          roleCodes: input.roleCodes,
          companyIds: input.companyIds,
          regionIds: input.regionIds,
          storeIds: input.storeIds,
          assignedStoreIds: input.assignedStoreIds,
          requestedRegionId: input.regionId,
          requestedStoreId: input.storeId,
          assignmentByEmployeeId,
        })
      : personnelRows;
    const personnelDisplayFilters = {
      ...companyFilters,
      enforceAssignedReadScope: false,
      regionId: undefined,
      regionIds: [],
      storeId: undefined,
      storeIds: [],
      assignedStoreIds: [],
    };
    const filteredPersonnelRows = access.isPrivileged
      ? applyPersonnelFilters(activeScopedPersonnelRows, personnelDisplayFilters)
      : personnelRows;
    const reference = {
      store: buildRankingReferenceGroup({
        rows: access.isPrivileged ? filteredStoreRows : storeRows,
        profile: storeProfile,
        benchmarkLookup: storeBenchmarkLookup,
      }),
      personnel: buildRankingReferenceGroup({
        rows: access.isPrivileged ? filteredPersonnelRows : personnelRows,
        profile: personnelProfile,
        benchmarkLookup: personnelBenchmarkLookup,
      }),
    };
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
    const filters = buildScopedRankingFilterOptions(
      access.isPrivileged
        ? authorizedStoreRows
        : currentStore
          ? [currentStore]
          : authorizedStoreRows,
    );
    replaceManagerFilterOptions(filters, companyFilterOptions?.regionManagers);
    const managedStoreIds = uniqueIds([...input.assignedStoreIds, ...input.storeIds]);
    const managedStorePersonnelRows =
      access.canSeeManagedStorePersonnelDetails && managedStoreIds.length > 0
        ? personnelRows.filter(
            (row) => {
              const activeStoreId = assignmentByEmployeeId.get(row.employeeId)?.store_id ?? null;
              return activeStoreId !== null && managedStoreIds.includes(activeStoreId);
            },
          )
        : [];
    const managedPersonnelLimit = Math.min(Math.max(input.managedPersonnelLimit ?? 50, 1), 100);
    const managedPersonnelOffset = Math.max(input.managedPersonnelOffset ?? 0, 0);
    const managedPersonnelPage = buildBoundedManagedPersonnelPage(
      managedStorePersonnelRows,
      { limit: managedPersonnelLimit, offset: managedPersonnelOffset },
    );
    const personnelProfileAccess = await this.resolvePersonnelProfileAccess({
      rows: [
        ...selectedPersonnelRows,
        ...(currentEmployee ? [currentEmployee] : []),
        ...managedPersonnelPage.items,
      ],
      currentEmployeeId: employeeId,
      roleCodes: input.roleCodes,
      companyIds: input.companyIds,
      regionIds: input.regionIds,
      storeIds: input.storeIds,
      assignedStoreIds: input.assignedStoreIds,
      assignmentByEmployeeId,
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
        ? managedPersonnelPage.items.map((row) => maskPersonnelRow(withProfileAccess(row), "detail"))
        : [];
    const regionManagerLimit = Math.min(Math.max(input.regionManagerLimit ?? 50, 1), 100);
    const regionManagerOffset = Math.max(input.regionManagerOffset ?? 0, 0);
    const regionManagerRiskOffset = Math.max(input.regionManagerRiskOffset ?? 0, 0);
    const regionManagerLeaderboard = canReadCompanyHierarchy
        ? buildRegionManagerSummary(filteredStoreRows, {
          limit: regionManagerLimit,
          offset: regionManagerOffset,
          riskOffset: regionManagerRiskOffset,
        }, companyFilterOptions?.regionManagers)
      : {
          items: [],
          meta: { total: 0, limit: regionManagerLimit, offset: regionManagerOffset },
          riskItems: [],
          riskMeta: { total: 0, limit: regionManagerLimit, offset: regionManagerRiskOffset },
          riskStoreCount: 0,
        };

    return {
      source: {
        mode: "live",
        periodType: latestPeriod.period_type === "daily" ? "daily" : "monthly",
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
      scopeSummary,
      regionManagerLeaderboard,
      storeLeaderboard: {
        ...(currentStore && ((input.roleCodes.includes("STORE_MANAGER") && managedStoreIds.includes(currentStore.storeId)) ||
          (input.roleCodes.includes("REGION_MANAGER") && authorizedStoreRows.some(row => row.storeId === currentStore.storeId)))
          ? { currentStoreComparisons: buildCurrentStoreComparisons(storeRows, currentStore) } : {}),
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
        managedStorePersonnelMeta: managedPersonnelPage.meta,
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
    assignmentByEmployeeId: Map<string, ActivePersonnelAssignmentScope>;
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
    for (const employeeId of scopedEmployeeIds) {
      result.set(
        employeeId,
        this.canReadPersonnelProfileFromActiveAssignment({
          roleCodes: input.roleCodes,
          companyIds: input.companyIds,
          regionIds: input.regionIds,
          storeIds: managerStoreIds,
          assignment: input.assignmentByEmployeeId.get(employeeId) ?? null,
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

    if (input.roleCodes.includes("REPORT_VIEWER")) {
      return (
        input.assignment.company_id !== null &&
        input.companyIds.includes(input.assignment.company_id)
      );
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
      return input.storeIds.length > 0
        ? input.assignment.store_id !== null && input.storeIds.includes(input.assignment.store_id)
        : input.assignment.region_id !== null && input.regionIds.includes(input.assignment.region_id);
    }

    return input.roleCodes.includes("STORE_MANAGER") && input.assignment.store_id !== null && input.storeIds.includes(input.assignment.store_id);
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
    isRange?: boolean;
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

  private resolveActiveScopeSummaryInput(input: GetRankingsInput) {
    if (input.assignedStoreIds.length > 0) {
      return {
        companyIds: [],
        regionIds: [],
        storeIds: input.assignedStoreIds,
      };
    }

    if (input.storeIds.length > 0) {
      return {
        companyIds: [],
        regionIds: [],
        storeIds: input.storeIds,
      };
    }

    if (input.regionIds.length > 0) {
      return {
        companyIds: [],
        regionIds: input.regionIds,
        storeIds: [],
      };
    }

    return {
      companyIds: input.companyIds,
      regionIds: [],
      storeIds: [],
    };
  }

  private toScopeSummary(input: {
    store_count: string | null;
    active_personnel_count: string | null;
  }) {
    return {
      storeCount: this.toNonNegativeInteger(input.store_count),
      activePersonnelCount: this.toNonNegativeInteger(input.active_personnel_count),
    };
  }

  private toNonNegativeInteger(value: string | null) {
    if (value === null) {
      return 0;
    }

    const numericValue = Number(value);

    return Number.isFinite(numericValue) && numericValue > 0
      ? Math.floor(numericValue)
      : 0;
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
            scoreValue?: number | null;
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
        scoreValue: toFiniteNumber(row.achievement_rate ?? null),
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
  }): UnrankedPersonnelRankingCandidate[] {
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
        positionCode: string | null;
        netSalesValue: number | null;
        storeNetSalesValue: number | null;
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
        positionCode: row.position_code ?? null,
        netSalesValue: toFiniteNumber(row.net_sales_value ?? null),
        storeNetSalesValue: toFiniteNumber(row.store_net_sales_value ?? null),
        values: new Map(),
      };
      current.positionCode = current.positionCode ?? row.position_code ?? null;
      current.netSalesValue =
        current.netSalesValue ?? toFiniteNumber(row.net_sales_value ?? null);
      current.storeNetSalesValue =
        current.storeNetSalesValue ?? toFiniteNumber(row.store_net_sales_value ?? null);
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
          .map((part) => part?.trim())
          .filter(Boolean)
          .join(" ")
          .trim();
        const rankingEligibility = resolvePersonnelRankingEligibility({
          positionCode: value.positionCode,
          netSalesValue: value.netSalesValue,
          storeNetSalesValue: value.storeNetSalesValue,
        });
        const completeScore = input.profile.metrics.filter(metric => metric.weightPercent > 0).every(
          metric => scoring.metrics.some(result => result.code === metric.code && result.contributionValue !== null),
        );
        const allocationWeight = completeScore && value.netSalesValue !== null
          ? Math.max(0, value.netSalesValue) * Math.max(0, scoring.scoreValue) : null;

        return {
          subject: "personnel" as const,
          employeeId,
          displayName: displayName || "Personel bilgisi eksik",
          storeId: value.storeId,
          storeName: value.storeName,
          regionId: value.regionId,
          regionName: value.regionName,
          regionManagerUserId: value.regionManagerUserId,
          regionManagerName: value.regionManagerName,
          scoreValue: scoring.scoreValue,
          canOpenProfile: false,
          rankingEligibility,
          allocationWeight,
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
    return this.performanceScoreEvaluator.evaluate({
      values: input.values,
      profile: input.profile,
      benchmarkLookup: input.benchmarkLookup,
      benchmarkFallback: "matched-or-canonical",
      useStoreChecklistFallback: true,
    });
  }

}
