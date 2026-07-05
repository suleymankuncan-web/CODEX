import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { ReportingRepository } from "../infrastructure/reporting.repository";
import { buildListResponse } from "../../../shared/http/response-builders";
import { mapAuditEvent } from "../../../shared/audit/audit-event.mapper";
import { KpiScoreProfile } from "./kpi-config.contract";
import { createSnapshotKpiConfigProvider, getDefaultKpiConfig, mapKpiConfigVersionMetadata, resolveKpiConfigFromRows, validateKpiConfigInput } from "./reporting-kpi-config.helpers";
import { KpiConfigRepository } from "../infrastructure/kpi-config.repository";
import { ClosedRankingService } from "./closed-ranking.service";
import { KpiBenchmarkScoringService } from "./kpi-benchmark-scoring.service";
import { LiveMonthlyLeaderboardService } from "./live-monthly-leaderboard.service";
import { ReportingStoreKpiReadService } from "./reporting-store-kpi-read.service";
import { buildLiveMetricRanks, formatEmployeeAssignmentName, getProfileMetricCodes, hasUsableBenchmarkRows, mapClosedMetricRankRows, mapEmployeeAssignmentIdentity, mapEmployeeAvailablePeriods } from "./reporting-performance.helpers";
import { StoreScoreReportingReadRepository } from "../infrastructure/store-score-reporting-read.repository";
import { ClosedRankingRepository } from "../infrastructure/closed-ranking.repository";
import { RankingReportingReadRepository } from "../infrastructure/ranking-reporting-read.repository";
import { SnapshotReportingReadRepository } from "../infrastructure/snapshot-reporting-read.repository";
import { StorePerformanceReportingReadRepository } from "../infrastructure/store-performance-reporting-read.repository";
import { buildOfficialEmployeeScoreRankContext } from "./employee-score-rank.helpers";

@Injectable()
export class ReportingService {
  private readonly kpiBenchmarkScoringService = new KpiBenchmarkScoringService();
  private readonly storeKpiReadService: ReportingStoreKpiReadService;

  constructor(
    private readonly reportingRepository: ReportingRepository,
    private readonly kpiConfigRepository: KpiConfigRepository,
    private readonly closedRankingService: ClosedRankingService,
    private readonly liveMonthlyLeaderboardService: LiveMonthlyLeaderboardService,
    private readonly storeScoreReportingReadRepository: StoreScoreReportingReadRepository,
    private readonly closedRankingRepository: ClosedRankingRepository,
    private readonly snapshotReportingReadRepository: SnapshotReportingReadRepository,
    private readonly storePerformanceReportingReadRepository: StorePerformanceReportingReadRepository,
    private readonly rankingReportingReadRepository: RankingReportingReadRepository,
  ) {
    this.storeKpiReadService = new ReportingStoreKpiReadService(
      createSnapshotKpiConfigProvider(
        () => this.getKpiConfig(),
        this.storeScoreReportingReadRepository,
        this.kpiConfigRepository,
      ),
      this.storeScoreReportingReadRepository,
      this.storePerformanceReportingReadRepository,
      this.rankingReportingReadRepository,
    );
  }

  private mapSnapshotRun(item: {
    snapshot_run_id: string;
    snapshot_date: string;
    snapshot_type: string;
    period_start: string;
    period_end: string;
    run_status: string;
    generated_at: string;
    generated_by: string;
  }) {
    return {
      snapshotRunId: item.snapshot_run_id,
      snapshotDate: item.snapshot_date,
      snapshotType: item.snapshot_type,
      periodStart: item.period_start,
      periodEnd: item.period_end,
      runStatus: item.run_status,
      generatedAt: item.generated_at,
      generatedBy: item.generated_by,
    };
  }

  async listSnapshotRuns(input: {
    runStatus?: string;
    snapshotType?: string;
    snapshotDate?: string;
    limit?: number;
    offset?: number;
  }) {
    const result = await this.snapshotReportingReadRepository.listSnapshotRuns(input);
    return buildListResponse(
      result.rows.map((item) => this.mapSnapshotRun(item)),
      { total: result.total, limit: input.limit, offset: input.offset },
    );
  }

  async getWorkforceReport(input: {
    snapshotRunId: string;
    storeId?: string;
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
    limit?: number;
    offset?: number;
  }) {
    const result = await this.snapshotReportingReadRepository.getWorkforceReport(input);

    return buildListResponse(
      result.rows.map((item) => ({
        snapshotRunId: item.snapshot_run_id,
        storeId: item.store_id, storeName: item.store_name,
        positionId: item.position_id,
        activeHeadcount: item.active_headcount,
        activeFte: item.active_fte,
        plannedHeadcount: item.planned_headcount,
        plannedFte: item.planned_fte,
        gapHeadcount: item.gap_headcount,
        gapFte: item.gap_fte,
      })),
      { total: result.total, limit: input.limit, offset: input.offset },
    );
  }

  async getKpiReport(input: {
    snapshotRunId: string;
    storeId?: string;
    kpiId?: string;
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
    limit?: number;
    offset?: number;
  }) {
    const result = await this.snapshotReportingReadRepository.getKpiReport(input);

    return buildListResponse(
      result.rows.map((item) => ({
        snapshotRunId: item.snapshot_run_id,
        storeId: item.store_id, storeName: item.store_name,
        kpiId: item.kpi_id,
        kpiCode: item.kpi_code,
        kpiName: item.kpi_name,
        periodStart: item.period_start,
        periodEnd: item.period_end,
        targetValue: item.target_value,
        actualValue: item.actual_value,
        achievementRate: item.achievement_rate,
        statusBand: item.status_band,
      })),
      { total: result.total, limit: input.limit, offset: input.offset },
    );
  }

  async getChecklistReport(input: {
    snapshotRunId: string;
    storeId?: string;
    checklistTemplateId?: string;
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
    limit?: number;
    offset?: number;
  }) {
    const result = await this.snapshotReportingReadRepository.getChecklistReport(input);

    return buildListResponse(
      result.rows.map((item) => ({
        snapshotRunId: item.snapshot_run_id,
        storeId: item.store_id, storeName: item.store_name,
        checklistTemplateId: item.checklist_template_id,
        auditCount: item.audit_count,
        avgScore: item.avg_score,
        complianceRate: item.compliance_rate,
        criticalIssueCount: item.critical_issue_count,
      })),
      { total: result.total, limit: input.limit, offset: input.offset },
    );
  }

  async getTurnoverReport(input: {
    snapshotRunId: string;
    scopeType?: string;
    companyId?: string;
    regionId?: string;
    storeId?: string;
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
    limit?: number;
    offset?: number;
  }) {
    const result = await this.snapshotReportingReadRepository.getTurnoverReport(input);

    return buildListResponse(
      result.rows.map((item) => ({
        snapshotRunId: item.snapshot_run_id,
        scopeType: item.scope_type,
        companyId: item.company_id, companyName: item.company_name,
        regionId: item.region_id, regionName: item.region_name,
        storeId: item.store_id, storeName: item.store_name,
        periodStart: item.period_start,
        periodEnd: item.period_end,
        openingHeadcount: item.opening_headcount,
        closingHeadcount: item.closing_headcount,
        avgHeadcount: item.avg_headcount,
        leaverCount: item.leaver_count,
        turnoverRate: item.turnover_rate,
      })),
      { total: result.total, limit: input.limit, offset: input.offset },
    );
  }

  async getReportingSummary() {
    const latestCompletedSnapshotRun =
      await this.snapshotReportingReadRepository.getLatestCompletedSnapshotRun();

    if (!latestCompletedSnapshotRun) {
      return {
        latestCompletedSnapshotRun: null,
        cards: {
          workforceRows: 0,
          kpiRows: 0,
          checklistRows: 0,
          turnoverRows: 0,
        },
      };
    }

    const cards = await this.snapshotReportingReadRepository.getSnapshotRowCounts(
      latestCompletedSnapshotRun.snapshot_run_id,
    );

    return {
      latestCompletedSnapshotRun: this.mapSnapshotRun(latestCompletedSnapshotRun),
      cards,
    };
  }

  async getKpiConfig() {
    try {
      const [rows, latestVersion] = await Promise.all([
        this.kpiConfigRepository.getKpiConfigRows(),
        this.kpiConfigRepository.getLatestPublishedKpiConfigVersion(),
      ]);
      return {
        ...resolveKpiConfigFromRows(rows),
        metadata: mapKpiConfigVersionMetadata(latestVersion),
      };
    } catch {
      // Fall back to in-code defaults until local or prod config table is populated.
    }

    return {
      ...getDefaultKpiConfig(),
      metadata: mapKpiConfigVersionMetadata(null),
    };
  }

  async getKpiConfigEditor() {
    const [publishedRows, draftRows, latestVersion] = await Promise.all([
      this.kpiConfigRepository.getKpiConfigRows(),
      this.kpiConfigRepository.getDraftKpiConfigRows(),
      this.kpiConfigRepository.getLatestPublishedKpiConfigVersion(),
    ]);
    const publishedConfig = resolveKpiConfigFromRows(publishedRows);
    const draftConfig =
      draftRows.length > 0 ? resolveKpiConfigFromRows(draftRows) : publishedConfig;

    return {
      draftConfig,
      publishedConfig,
      hasUnpublishedChanges:
        JSON.stringify(draftConfig) !== JSON.stringify(publishedConfig),
      latestPublishedVersion: mapKpiConfigVersionMetadata(latestVersion),
    };
  }

  async saveKpiConfigDraft(input: {
    actorUserId: string;
    storeProfile: unknown;
    personnelProfile: unknown;
    ownershipMatrix: unknown;
    gradingBands: unknown;
  }) {
    validateKpiConfigInput(input);
    await this.kpiConfigRepository.saveKpiConfigDraft(input);
    return this.getKpiConfigEditor();
  }

  async publishKpiConfigDraft(actorUserId: string) {
    await this.kpiConfigRepository.publishKpiConfigDraft(actorUserId);
    return this.getKpiConfigEditor();
  }

  async getKpiConfigAudit() {
    const rows = await this.kpiConfigRepository.listKpiConfigAudit();
    return buildListResponse(rows.map((item) => mapAuditEvent(item)), {
      total: rows.length,
      limit: rows.length,
      offset: 0,
    });
  }

  async getStoreKpiHighlights(input: {
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
    periodType?: "daily" | "weekly" | "monthly";
    periodStart?: string;
    storeId?: string; regionManagerUserId?: string;
  }) {
    return this.storeKpiReadService.getStoreKpiHighlights(input);
  }
  async getStoreMonthlyScoreBreakdown(input: {
    snapshotRunId: string;
    storeId: string;
    storeIds: string[];
  }) {
    return this.storeKpiReadService.getStoreMonthlyScoreBreakdown(input);
  }

  async getMyPerformance(input: {
    userId: string;
    employeeId?: string;
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
    mode?: "live" | "closed";
    snapshotDate?: string;
    periodType?: "daily" | "weekly" | "monthly";
    periodStart?: string;
  }) {
    if (input.mode === "closed") {
      return this.getClosedMyPerformance(input);
    }

    return this.getLiveMyPerformance(input);
  }

  async getPersonnelPerformance(input: {
    userId: string;
    employeeId?: string;
    targetEmployeeId: string;
    roleCodes: string[];
    identityCompanyIds?: string[];
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
    assignedStoreIds: string[];
    mode?: "live" | "closed";
    snapshotDate?: string;
    periodType?: "daily" | "weekly" | "monthly";
    periodStart?: string;
  }) {
    if (!this.isUuid(input.targetEmployeeId)) {
      throw new BadRequestException("Invalid personnel profile id");
    }

    await this.assertCanReadPersonnelPerformance(input);

    if (input.mode === "closed") {
      return this.getClosedMyPerformance({
        ...input,
        targetEmployeeId: input.targetEmployeeId,
      });
    }

    return this.getLiveMyPerformance({
      ...input,
      targetEmployeeId: input.targetEmployeeId,
    });
  }

  private async assertCanReadPersonnelPerformance(input: {
    userId: string;
    employeeId?: string;
    targetEmployeeId: string;
    roleCodes: string[];
    identityCompanyIds?: string[];
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
    assignedStoreIds: string[];
  }) {
    const currentEmployeeId =
      await this.reportingRepository.resolveEmployeeIdForAuthIdentity({
        userId: input.userId,
        employeeId: input.employeeId,
        companyIds: input.identityCompanyIds ?? input.companyIds,
      });

    if (currentEmployeeId && currentEmployeeId === input.targetEmployeeId) {
      return;
    }

    const assignment =
      await this.reportingRepository.getActiveEmployeeAssignmentScope(input.targetEmployeeId);

    if (!assignment) {
      throw new ForbiddenException("Personnel profile is outside the current user's scope");
    }

    const managerStoreIds = input.assignedStoreIds.length > 0
      ? input.assignedStoreIds
      : input.storeIds;

    if (
      input.roleCodes.includes("SUPER_ADMIN") &&
      (
        !this.hasPersonnelReadScope({
          companyIds: input.companyIds,
          regionIds: input.regionIds,
          storeIds: managerStoreIds,
        }) ||
        (assignment.company_id && input.companyIds.includes(assignment.company_id)) ||
        (assignment.region_id && input.regionIds.includes(assignment.region_id)) ||
        (assignment.store_id && managerStoreIds.includes(assignment.store_id))
      )
    ) {
      return;
    }

    if (
      input.roleCodes.includes("REGION_MANAGER") &&
      assignment.region_id &&
      input.regionIds.includes(assignment.region_id)
    ) {
      return;
    }
    if (
      input.roleCodes.includes("STORE_MANAGER") &&
      assignment.store_id &&
      managerStoreIds.includes(assignment.store_id)
    ) {
      return;
    }

    throw new ForbiddenException("Personnel profile is outside the current user's scope");
  }

  private isUuid(value: string) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    );
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

  async getClosedLeaderboard(input: {
    userId: string;
    employeeId?: string;
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
    roleCodes: string[];
    assignedStoreIds: string[];
    periodType?: "daily" | "monthly";
    periodStart?: string;
    snapshotDate?: string;
    storeId?: string;
    limit?: number;
  }) {
    const closedLeaderboard = await this.closedRankingService.getClosedLeaderboard(input);

    if (
      input.periodType === "monthly" &&
      closedLeaderboard.source.state === "not_closed"
    ) {
      const config = await this.getKpiConfig();
      return this.liveMonthlyLeaderboardService.getLiveMonthlyLeaderboard({
        ...input,
        profile: config.personnelProfile,
      });
    }

    return closedLeaderboard;
  }

  private resolveWeightedAchievementRate(input: {
    actualValue: number | null;
    targetValue?: number | null;
    averageValue?: number | null;
  }) {
    if (
      input.actualValue !== null &&
      input.targetValue !== null &&
      input.targetValue !== undefined &&
      Number.isFinite(input.targetValue) &&
      input.targetValue !== 0
    ) {
      return Number((input.actualValue / input.targetValue).toFixed(4));
    }

    if (
      input.actualValue !== null &&
      input.averageValue !== null &&
      input.averageValue !== undefined &&
      Number.isFinite(input.averageValue) &&
      input.averageValue !== 0
    ) {
      return Number((input.actualValue / input.averageValue).toFixed(4));
    }

    return null;
  }

  private async getLiveMyPerformance(input: {
    userId: string;
    employeeId?: string;
    targetEmployeeId?: string;
    roleCodes?: string[];
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
    periodType?: "daily" | "weekly" | "monthly";
    periodStart?: string;
  }) {
    const config = await this.getKpiConfig();
    const profile = config.personnelProfile;
    const metricCodes = getProfileMetricCodes(profile);
    const employeeDataMetricCodes = [...new Set([...metricCodes, "NET_SALES"])];
    const employeeId =
      input.targetEmployeeId ??
      await this.reportingRepository.resolveEmployeeIdForAuthIdentity({
        userId: input.userId,
        employeeId: input.employeeId,
        companyIds: input.companyIds,
      });

    if (!employeeId) {
      return {
        source: {
          mode: "live",
          snapshotRunId: null,
          snapshotDate: null,
        },
        employee: null,
        period: null,
        score: {
          value: 0,
          matchedMetrics: 0,
          totalMetrics: profile.metrics.length,
        },
        rankings: {
          turkeyRank: null,
          turkeyPopulation: 0,
          regionRank: null,
          regionPopulation: 0,
          storeRank: null,
          storePopulation: 0,
        },
        metricRanks: [],
        availablePeriods: [],
        partial: {
          isPartial: true,
          missingMetricCodes: profile.metrics.map((metric) => metric.code),
          missingMetricLabels: profile.metrics.map((metric) => metric.label),
        },
        metrics: profile.metrics.map((metric) => ({
          code: metric.code,
          label: metric.label,
          weightPercent: metric.weightPercent,
          actualValue: null,
          contributionValue: 0,
          status: "missing",
        })),
      };
    }

    const allowGlobalScope =
      Boolean(input.targetEmployeeId) &&
      input.roleCodes?.includes("SUPER_ADMIN") === true &&
      !this.hasPersonnelReadScope({
        companyIds: input.companyIds,
        regionIds: input.regionIds,
        storeIds: input.storeIds,
      });
    const availablePeriods = await this.reportingRepository.listEmployeeKpiPeriods({
      employeeId,
      metricCodes: employeeDataMetricCodes,
      companyIds: input.companyIds,
      regionIds: input.regionIds,
      storeIds: input.storeIds,
      allowGlobalScope,
    });
    const latestPeriod = await this.reportingRepository.getLatestEmployeeKpiPeriod({
      employeeId,
      metricCodes: employeeDataMetricCodes,
      companyIds: input.companyIds,
      regionIds: input.regionIds,
      storeIds: input.storeIds,
      allowGlobalScope,
      periodType: input.periodType,
      periodStart: input.periodStart,
    });
    const mappedAvailablePeriods = mapEmployeeAvailablePeriods(
      availablePeriods,
      latestPeriod,
      input.periodType,
    );

    if (!latestPeriod) {
      const fallbackAssignment =
        await this.reportingRepository.getActiveEmployeeAssignmentScope(employeeId);

      return {
        source: {
          mode: "live",
          snapshotRunId: null,
          snapshotDate: null,
        },
        employee: mapEmployeeAssignmentIdentity(employeeId, fallbackAssignment),
        period: null,
        score: {
          value: 0,
          matchedMetrics: 0,
          totalMetrics: profile.metrics.length,
        },
        rankings: {
          turkeyRank: null,
          turkeyPopulation: 0,
          regionRank: null,
          regionPopulation: 0,
          storeRank: null,
          storePopulation: 0,
        },
        metricRanks: [],
        availablePeriods: mappedAvailablePeriods,
        partial: {
          isPartial: true,
          missingMetricCodes: profile.metrics.map((metric) => metric.code),
          missingMetricLabels: profile.metrics.map((metric) => metric.label),
        },
        metrics: profile.metrics.map((metric) => ({
          code: metric.code,
          label: metric.label,
          weightPercent: metric.weightPercent,
          actualValue: null,
          contributionValue: 0,
          status: "missing",
        })),
      };
    }

    const employeeRows = await this.reportingRepository.getEmployeePerformanceRows({
      employeeId,
      metricCodes: employeeDataMetricCodes,
      periodStart: latestPeriod.period_start,
      periodEnd: latestPeriod.period_end,
    });
    const fallbackAssignment =
      employeeRows[0] ? null : await this.reportingRepository.getActiveEmployeeAssignmentScope(employeeId);
    let benchmarkRows = await this.reportingRepository.getEmployeeTurkeyBenchmarkValues({
      companyId: input.companyIds[0] ?? undefined,
      periodType: latestPeriod.period_type ?? input.periodType,
      periodStart: latestPeriod.period_start,
      periodEnd: latestPeriod.period_end,
    });

    if (!hasUsableBenchmarkRows(benchmarkRows)) {
      benchmarkRows = await this.reportingRepository.getEmployeeTurkeyBenchmarkValues({
        companyId: undefined,
        periodType: latestPeriod.period_type ?? input.periodType,
        periodStart: latestPeriod.period_start,
        periodEnd: latestPeriod.period_end,
      });
    }
    let turkeyRows = await this.reportingRepository.getPeerEmployeePerformanceRows({
      metricCodes,
      companyId: input.companyIds[0] ?? undefined,
      storeId: null,
      periodStart: latestPeriod.period_start,
      periodEnd: latestPeriod.period_end,
    });

    if (turkeyRows.length === 0) {
      turkeyRows = await this.reportingRepository.getPeerEmployeePerformanceRows({
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

    const metricLookup = new Map(employeeRows.map((row) => [row.kpi_code, row]));
    const salesRow = metricLookup.get("NET_SALES");
    const mappedMetrics = profile.metrics.map((metric) => {
      const matchingCodes = [metric.code, ...(metric.aliases ?? [])];
      const row = matchingCodes
        .map((code) => metricLookup.get(code))
        .find((value) => Boolean(value));
      const actualValue = row ? Number(row.actual_value) : null;
      const targetValue =
        row?.target_value !== null && row?.target_value !== undefined
          ? Number(row.target_value)
          : null;
      const benchmarkSource = metric.code === "TARGET_ACHIEVEMENT" ? "TARGET" : metric.benchmarkSource ?? (targetValue !== null ? "TARGET" : "TURKEY_AVERAGE");
      const benchmarkValue =
        benchmarkSource === "TURKEY_AVERAGE" && row
          ? benchmarkLookup.get(row.kpi_code) ?? null
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
      const achievementRate = metricScore.actualRatio;
      const contributionValue =
        metricScore.scoreContribution !== null ? metricScore.scoreContribution : 0;
      const scoreStatus =
        metricScore.scoreStatus === "missing_actual"
          ? "missing"
          : metricScore.scoreStatus;
      const missingReason =
        metric.code === "TARGET_ACHIEVEMENT" &&
        metricScore.missingReason === "benchmark_missing"
          ? "personnel_target_missing"
          : metricScore.missingReason;

      return {
        code: metric.code,
        label: metric.label,
        weightPercent: metric.weightPercent,
        actualValue,
        targetValue,
        benchmarkValue,
        benchmarkSource,
        achievementRate,
        actualRatio: metricScore.actualRatio,
        scoredRatio: metricScore.scoredRatio,
        capRatio: metricScore.capRatio,
        isCapped: metricScore.isCapped,
        missingReason,
        contributionValue,
        dataStatus: actualValue !== null ? "reported" : "missing",
        scoreStatus,
      };
    });

    const scoreValue = Number(
      mappedMetrics
        .filter((metric) => metric.scoreStatus === "scored")
        .reduce((sum, metric) => sum + metric.contributionValue, 0)
        .toFixed(2),
    );
    const matchedMetrics = mappedMetrics.filter((metric) => metric.scoreStatus === "scored").length;
    const missingMetrics = profile.metrics.filter(
      (metric) => !mappedMetrics.some((item) => item.code === metric.code && item.scoreStatus !== "missing"),
    );
    const pendingNormalizationMetrics = profile.metrics.filter(
      (metric) =>
        mappedMetrics.some(
          (item) => item.code === metric.code && item.scoreStatus === "pending_normalization",
        ),
    );

    const currentRegionId = employeeRows[0]?.region_id ?? fallbackAssignment?.region_id ?? null;
    const { turkeyScores, storeScores, regionScores, officialRows } =
      buildOfficialEmployeeScoreRankContext({
        rows: turkeyRows,
        profile,
        benchmarkLookup,
        scoringService: this.kpiBenchmarkScoringService,
        storeId: latestPeriod.store_id,
        regionId: currentRegionId,
      });

    const storeRank =
      storeScores.findIndex((row) => row.employeeId === employeeId) >= 0
        ? storeScores.findIndex((row) => row.employeeId === employeeId) + 1
        : null;
    const regionRank =
      regionScores.findIndex((row) => row.employeeId === employeeId) >= 0
        ? regionScores.findIndex((row) => row.employeeId === employeeId) + 1
        : null;
    const turkeyRank =
      turkeyScores.findIndex((row) => row.employeeId === employeeId) >= 0
        ? turkeyScores.findIndex((row) => row.employeeId === employeeId) + 1
        : null;
    const metricRanks = buildLiveMetricRanks({
      employeeId,
      metricCodes,
      rows: officialRows,
      storeId: latestPeriod.store_id ?? null,
      regionId: currentRegionId,
    });

    return {
      source: {
        mode: "live",
        snapshotRunId: null,
        snapshotDate: null,
      },
      employee: {
        employeeId,
        displayName: employeeRows[0]
          ? `${employeeRows[0].first_name} ${employeeRows[0].last_name}`.trim()
          : formatEmployeeAssignmentName(fallbackAssignment),
        storeId: employeeRows[0]?.store_id ?? latestPeriod.store_id ?? fallbackAssignment?.store_id ?? null,
        storeName: employeeRows[0]?.store_name ?? fallbackAssignment?.store_name ?? null,
      },
      period: {
        periodStart: latestPeriod.period_start,
        periodEnd: latestPeriod.period_end,
      },
      score: {
        value: scoreValue,
        matchedMetrics,
        totalMetrics: profile.metrics.length,
      },
      rankings: {
        turkeyRank,
        turkeyPopulation: turkeyScores.length,
        regionRank,
        regionPopulation: regionScores.length,
        storeRank,
        storePopulation: storeScores.length,
      },
      metricRanks,
      availablePeriods: mappedAvailablePeriods,
      partial: {
        isPartial: missingMetrics.length > 0 || pendingNormalizationMetrics.length > 0,
        missingMetricCodes: missingMetrics.map((metric) => metric.code),
        missingMetricLabels: missingMetrics.map((metric) => metric.label),
        pendingNormalizationCodes: pendingNormalizationMetrics.map((metric) => metric.code),
        pendingNormalizationLabels: pendingNormalizationMetrics.map((metric) => metric.label),
      },
      supporting: {
        netSalesValue: salesRow ? Number(salesRow.actual_value) : null,
        targetEntryMode: "manager_assignment",
        targetEditableByCurrentUser: false,
      },
      metrics: mappedMetrics,
    };
  }

  private async getClosedMyPerformance(input: {
    userId: string;
    employeeId?: string;
    targetEmployeeId?: string;
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
    snapshotDate?: string;
  }) {
    const config = await this.getKpiConfig();
    const profile = config.personnelProfile;
    const metricCodes = getProfileMetricCodes(profile);
    const employeeDataMetricCodes = [...new Set([...metricCodes, "NET_SALES"])];
    const employeeId =
      input.targetEmployeeId ??
      await this.reportingRepository.resolveEmployeeIdForAuthIdentity({
        userId: input.userId,
        employeeId: input.employeeId,
        companyIds: input.companyIds,
      });

    if (!employeeId) {
      return {
        source: {
          mode: "closed",
          snapshotRunId: null,
          snapshotDate: input.snapshotDate ?? null,
        },
        employee: null,
        period: null,
        score: {
          value: 0,
          matchedMetrics: 0,
          totalMetrics: profile.metrics.length,
        },
        rankings: {
          turkeyRank: null,
          turkeyPopulation: 0,
          regionRank: null,
          regionPopulation: 0,
          storeRank: null,
          storePopulation: 0,
        },
        metricRanks: [],
        availablePeriods: [],
        partial: {
          isPartial: true,
          missingMetricCodes: profile.metrics.map((metric) => metric.code),
          missingMetricLabels: profile.metrics.map((metric) => metric.label),
        },
        metrics: profile.metrics.map((metric) => ({
          code: metric.code,
          label: metric.label,
          weightPercent: metric.weightPercent,
          actualValue: null,
          contributionValue: 0,
          status: "missing",
        })),
      };
    }

    const snapshotRun = input.snapshotDate
      ? await this.closedRankingRepository.getCompletedSnapshotRunByTypeAndDate({
          snapshotType: "daily",
          periodStart: input.snapshotDate,
          periodEnd: input.snapshotDate,
        })
      : await this.closedRankingRepository.getLatestCompletedSnapshotRunByType("daily");

    if (!snapshotRun) {
      return {
        source: {
          mode: "closed",
          snapshotRunId: null,
          snapshotDate: input.snapshotDate ?? null,
        },
        employee: null,
        period: null,
        score: {
          value: 0,
          matchedMetrics: 0,
          totalMetrics: profile.metrics.length,
        },
        rankings: {
          turkeyRank: null,
          turkeyPopulation: 0,
          regionRank: null,
          regionPopulation: 0,
          storeRank: null,
          storePopulation: 0,
        },
        metricRanks: [],
        availablePeriods: [],
        partial: {
          isPartial: true,
          missingMetricCodes: profile.metrics.map((metric) => metric.code),
          missingMetricLabels: profile.metrics.map((metric) => metric.label),
        },
        metrics: profile.metrics.map((metric) => ({
          code: metric.code,
          label: metric.label,
          weightPercent: metric.weightPercent,
          actualValue: null,
          contributionValue: 0,
          status: "missing",
        })),
      };
    }

    const summaryRow = await this.closedRankingRepository.getEmployeePerformanceSnapshot({
      snapshotRunId: snapshotRun.snapshot_run_id,
      employeeId,
    });
    const metricRows = await this.closedRankingRepository.getEmployeeKpiSnapshotRows({
      snapshotRunId: snapshotRun.snapshot_run_id,
      employeeId,
      metricCodes: employeeDataMetricCodes,
    });
    const visibleMetricRankCodes = new Set(metricCodes);
    const metricRankRows = (
      await this.closedRankingRepository.listClosedDailyMetricRankRows({
        snapshotRunId: snapshotRun.snapshot_run_id,
        employeeIds: [employeeId],
      })
    ).filter((row) => visibleMetricRankCodes.has(row.kpi_code));
    const fallbackAssignment = summaryRow
      ? null
      : await this.reportingRepository.getActiveEmployeeAssignmentScope(employeeId);
    const metricLookup = new Map(metricRows.map((row) => [row.kpi_code, row]));
    const salesRow = metricLookup.get("NET_SALES");
    const mappedMetrics = profile.metrics.map((metric) => {
      const matchingCodes = [metric.code, ...(metric.aliases ?? [])];
      const row = matchingCodes
        .map((code) => metricLookup.get(code))
        .find((value) => Boolean(value));
      const actualValue = row ? Number(row.actual_value) : null;

      return {
        code: metric.code,
        label: metric.label,
        weightPercent: metric.weightPercent,
        actualValue,
        contributionValue:
          actualValue !== null ? Number(((actualValue * metric.weightPercent) / 100).toFixed(2)) : 0,
        status: actualValue !== null ? "reported" : "missing",
      };
    });
    const missingMetrics = profile.metrics.filter(
      (metric) => !mappedMetrics.some((item) => item.code === metric.code && item.status === "reported"),
    );

    return {
      source: {
        mode: "closed",
        snapshotRunId: snapshotRun.snapshot_run_id,
        snapshotDate: snapshotRun.period_start,
      },
      employee: summaryRow
        ? {
            employeeId,
            displayName: `${summaryRow.first_name} ${summaryRow.last_name}`.trim(),
            storeId: summaryRow.store_id,
            storeName: summaryRow.store_name,
          }
        : {
            employeeId,
            displayName: fallbackAssignment
              ? `${fallbackAssignment.first_name} ${fallbackAssignment.last_name}`.trim()
              : "Unknown employee",
            storeId: fallbackAssignment?.store_id ?? null,
            storeName: fallbackAssignment?.store_name ?? null,
          },
      period: summaryRow
        ? {
            periodStart: summaryRow.period_start,
            periodEnd: summaryRow.period_end,
          }
        : {
            periodStart: snapshotRun.period_start,
            periodEnd: snapshotRun.period_end,
          },
      score: {
        value: summaryRow ? Number(summaryRow.score_value) : 0,
        matchedMetrics: summaryRow?.matched_metrics ?? 0,
        totalMetrics: summaryRow?.total_metrics ?? profile.metrics.length,
      },
      rankings: {
        turkeyRank: summaryRow?.turkey_rank ?? null,
        turkeyPopulation: summaryRow?.turkey_population ?? 0,
        regionRank: null,
        regionPopulation: 0,
        storeRank: summaryRow?.store_rank ?? null,
        storePopulation: summaryRow?.store_population ?? 0,
      },
      metricRanks: mapClosedMetricRankRows(metricRankRows),
      availablePeriods: [
        {
          periodType: "daily",
          periodStart: summaryRow?.period_start ?? snapshotRun.period_start,
          periodEnd: summaryRow?.period_end ?? snapshotRun.period_end,
        },
      ],
      partial: {
        isPartial: missingMetrics.length > 0,
        missingMetricCodes: missingMetrics.map((metric) => metric.code),
        missingMetricLabels: missingMetrics.map((metric) => metric.label),
      },
      supporting: {
        netSalesValue: salesRow ? Number(salesRow.actual_value) : null,
        targetEntryMode: "manager_assignment",
        targetEditableByCurrentUser: false,
      },
      metrics: mappedMetrics,
    };
  }

  private buildClosedStoreLeaderboard(
    rows: Array<{
      store_id: string;
      store_name: string;
      kpi_code: string;
      actual_value: string | null;
    }>,
    profile: KpiScoreProfile,
    limit: number,
  ) {
    const byStore = new Map<
      string,
      {
        storeName: string;
        values: Record<string, number>;
      }
    >();

    rows.forEach((row) => {
      const current = byStore.get(row.store_id) ?? {
        storeName: row.store_name,
        values: {},
      };
      if (row.actual_value !== null) {
        current.values[row.kpi_code] = Number(row.actual_value);
      }
      byStore.set(row.store_id, current);
    });

    return [...byStore.entries()]
      .map(([storeId, value]) => {
        const scoreValue = profile.metrics.reduce((sum, metric) => {
          const matchingCodes = [metric.code, ...(metric.aliases ?? [])];
          const matchedValue = matchingCodes
            .map((code) => value.values[code])
            .find((candidate) => typeof candidate === "number");
          return sum + (((matchedValue ?? 0) * metric.weightPercent) / 100);
        }, 0);

        const matchedMetrics = profile.metrics.filter((metric) => {
          const matchingCodes = [metric.code, ...(metric.aliases ?? [])];
          return matchingCodes.some((code) => typeof value.values[code] === "number");
        }).length;

        return {
          storeId,
          storeName: value.storeName,
          scoreValue: Number(scoreValue.toFixed(2)),
          matchedMetrics,
          totalMetrics: profile.metrics.length,
        };
      })
      .sort((left, right) => right.scoreValue - left.scoreValue)
      .slice(0, limit)
      .map((row, index) => ({
        ...row,
        rank: index + 1,
      }));
  }
}
