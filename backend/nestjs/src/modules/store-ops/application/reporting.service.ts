import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { ReportingRepository } from "../infrastructure/reporting.repository";
import { buildListResponse } from "../../../shared/http/response-builders";
import { mapAuditEvent } from "../../../shared/audit/audit-event.mapper";
import {
  KpiGradingBand,
  KpiOwnershipMatrixRow,
  kpiGradingBands,
  KpiScoreProfile,
  kpiOwnershipMatrix,
  normalizeKpiScoreProfile,
  personnelKpiScoreProfile,
  storeKpiScoreProfile,
} from "./kpi-config.contract";
import { KpiConfigRepository } from "../infrastructure/kpi-config.repository";
import { ClosedRankingService } from "./closed-ranking.service";
import { StoreScoreBlendService } from "./store-score-blend.service";
import { KpiBenchmarkScoringService } from "./kpi-benchmark-scoring.service";
import { LiveMonthlyLeaderboardService } from "./live-monthly-leaderboard.service";
import { StoreScoreReportingReadRepository } from "../infrastructure/store-score-reporting-read.repository";
import { ClosedRankingRepository } from "../infrastructure/closed-ranking.repository";

const storeChecklistMetricCodes = new Set(["BM_CHECKLIST", "VM_CHECKLIST"]);

@Injectable()
export class ReportingService {
  private readonly kpiBenchmarkScoringService = new KpiBenchmarkScoringService();

  constructor(
    private readonly reportingRepository: ReportingRepository,
    private readonly kpiConfigRepository: KpiConfigRepository,
    private readonly closedRankingService: ClosedRankingService,
    private readonly liveMonthlyLeaderboardService: LiveMonthlyLeaderboardService,
    private readonly storeScoreReportingReadRepository: StoreScoreReportingReadRepository =
      reportingRepository as unknown as StoreScoreReportingReadRepository,
    private readonly closedRankingRepository: ClosedRankingRepository =
      reportingRepository as unknown as ClosedRankingRepository,
  ) {}

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
    const result = await this.reportingRepository.listSnapshotRuns(input);
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
    const result = await this.reportingRepository.getWorkforceReport(input);

    return buildListResponse(
      result.rows.map((item) => ({
        snapshotRunId: item.snapshot_run_id,
        storeId: item.store_id,
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
    const result = await this.reportingRepository.getKpiReport(input);

    return buildListResponse(
      result.rows.map((item) => ({
        snapshotRunId: item.snapshot_run_id,
        storeId: item.store_id,
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
    const result = await this.reportingRepository.getChecklistReport(input);

    return buildListResponse(
      result.rows.map((item) => ({
        snapshotRunId: item.snapshot_run_id,
        storeId: item.store_id,
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
    const result = await this.reportingRepository.getTurnoverReport(input);

    return buildListResponse(
      result.rows.map((item) => ({
        snapshotRunId: item.snapshot_run_id,
        scopeType: item.scope_type,
        companyId: item.company_id,
        regionId: item.region_id,
        storeId: item.store_id,
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
      await this.reportingRepository.getLatestCompletedSnapshotRun();

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

    const cards = await this.reportingRepository.getSnapshotRowCounts(
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
        ...this.resolveKpiConfigFromRows(rows),
        metadata: this.mapKpiConfigVersionMetadata(latestVersion),
      };
    } catch {
      // Fall back to in-code defaults until local or prod config table is populated.
    }

    return {
      ...this.getDefaultKpiConfig(),
      metadata: this.mapKpiConfigVersionMetadata(null),
    };
  }

  async getKpiConfigEditor() {
    const [publishedRows, draftRows, latestVersion] = await Promise.all([
      this.kpiConfigRepository.getKpiConfigRows(),
      this.kpiConfigRepository.getDraftKpiConfigRows(),
      this.kpiConfigRepository.getLatestPublishedKpiConfigVersion(),
    ]);
    const publishedConfig = this.resolveKpiConfigFromRows(publishedRows);
    const draftConfig =
      draftRows.length > 0 ? this.resolveKpiConfigFromRows(draftRows) : publishedConfig;

    return {
      draftConfig,
      publishedConfig,
      hasUnpublishedChanges:
        JSON.stringify(draftConfig) !== JSON.stringify(publishedConfig),
      latestPublishedVersion: this.mapKpiConfigVersionMetadata(latestVersion),
    };
  }

  async saveKpiConfigDraft(input: {
    actorUserId: string;
    storeProfile: unknown;
    personnelProfile: unknown;
    ownershipMatrix: unknown;
    gradingBands: unknown;
  }) {
    this.validateKpiConfigInput(input);
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
  }) {
    const config = await this.getKpiConfig();
    const profile = config.storeProfile;
    const metricCodes = profile.metrics.map((metric) => metric.code);
    const storeId = input.storeIds[0] ?? null;

    if (!storeId) {
      return {
        source: {
          mode: "live",
          snapshotRunId: null,
          snapshotDate: null,
          periodType: input.periodType ?? "monthly",
        },
        store: null,
        period: null,
        score: {
          value: 0,
          matchedMetrics: 0,
          totalMetrics: profile.metrics.length,
        },
        availablePeriods: [],
        partial: {
          isPartial: true,
          missingMetricCodes: profile.metrics.map((metric) => metric.code),
          missingMetricLabels: profile.metrics.map((metric) => metric.label),
          pendingNormalizationCodes: [],
          pendingNormalizationLabels: [],
        },
        metrics: profile.metrics.map((metric) => ({
          code: metric.code,
          label: metric.label,
          weightPercent: metric.weightPercent,
          actualValue: null,
          targetValue: null,
          achievementRate: null,
          statusBand: null,
          dataStatus: "missing" as const,
          scoreStatus: "missing" as const,
        })),
      };
    }

    const [storeName, availablePeriods, latestPeriod] = await Promise.all([
      this.reportingRepository.getStoreNameById(storeId),
      this.reportingRepository.listStoreKpiPeriods({
        storeId,
        metricCodes,
      }),
      this.reportingRepository.getLatestStoreKpiPeriod({
        storeId,
        metricCodes,
        periodType: input.periodType ?? "monthly",
        periodStart: input.periodStart,
      }),
    ]);

    if (!latestPeriod) {
      return {
        source: {
          mode: "live",
          snapshotRunId: null,
          snapshotDate: null,
          periodType: input.periodType ?? "monthly",
        },
        store: {
          storeId,
          storeName,
        },
        period: null,
        score: {
          value: 0,
          matchedMetrics: 0,
          totalMetrics: profile.metrics.length,
        },
        availablePeriods: availablePeriods.map((period) => ({
          periodType: period.period_type,
          periodStart: period.period_start,
          periodEnd: period.period_end,
        })),
        partial: {
          isPartial: true,
          missingMetricCodes: profile.metrics.map((metric) => metric.code),
          missingMetricLabels: profile.metrics.map((metric) => metric.label),
          pendingNormalizationCodes: [],
          pendingNormalizationLabels: [],
        },
        metrics: profile.metrics.map((metric) => ({
          code: metric.code,
          label: metric.label,
          weightPercent: metric.weightPercent,
          actualValue: null,
          targetValue: null,
          achievementRate: null,
          statusBand: null,
          dataStatus: "missing" as const,
          scoreStatus: "missing" as const,
        })),
      };
    }

    const shouldReadChecklistRows = metricCodes.some((code) =>
      storeChecklistMetricCodes.has(code),
    );
    const [storePerformanceRows, checklistRows] = await Promise.all([
      this.reportingRepository.getStorePerformanceRows({
        storeId,
        metricCodes,
        periodType: latestPeriod.period_type,
        periodStart: latestPeriod.period_start,
        periodEnd: latestPeriod.period_end,
      }),
      shouldReadChecklistRows
        ? this.reportingRepository.listRankingStoreChecklistRows({
            companyIds: input.companyIds,
            periodStart: latestPeriod.period_start,
            periodEnd: latestPeriod.period_end,
          })
        : Promise.resolve([]),
    ]);
    const liveRows = [
      ...storePerformanceRows,
      ...checklistRows.filter((row) => row.store_id === storeId),
    ];
    let benchmarkRows = await this.reportingRepository.getStoreTurkeyBenchmarkValues({
      companyId: input.companyIds[0] ?? undefined,
      periodType: latestPeriod.period_type,
      periodStart: latestPeriod.period_start,
      periodEnd: latestPeriod.period_end,
    });

    if (!this.hasUsableBenchmarkRows(benchmarkRows)) {
      benchmarkRows = await this.reportingRepository.getStoreTurkeyBenchmarkValues({
        companyId: undefined,
        periodType: latestPeriod.period_type,
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

    const rowLookup = new Map(liveRows.map((row) => [row.kpi_code, row]));
    const mappedMetrics = profile.metrics.map((metric) => {
      const matchingCodes = [metric.code, ...(metric.aliases ?? [])];
      const row = matchingCodes
        .map((code) => rowLookup.get(code))
        .find((value) => Boolean(value));
      const actualValue =
        row?.actual_value !== null && row?.actual_value !== undefined
          ? Number(row.actual_value)
          : null;
      const isChecklistMetric = storeChecklistMetricCodes.has(metric.code);
      const targetValue =
        isChecklistMetric && actualValue !== null
          ? 100
          : row?.target_value !== null && row?.target_value !== undefined
            ? Number(row.target_value)
            : null;
      const benchmarkSource =
        isChecklistMetric
          ? "TARGET"
          : metric.benchmarkSource ?? (targetValue !== null ? "TARGET" : "TURKEY_AVERAGE");
      const benchmarkValue =
        !isChecklistMetric && benchmarkSource === "TURKEY_AVERAGE" && row
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
        capRatio: isChecklistMetric ? 1 : metric.capRatio ?? 1.2,
      });
      const achievementRate = metricScore.actualRatio;
      const statusBand =
        achievementRate === null
          ? null
          : achievementRate >= 1
            ? "on_track"
            : achievementRate >= 0.85
              ? "at_risk"
              : "off_track";
      const dataStatus = actualValue !== null ? "reported" : "missing";
      const scoreStatus =
        metricScore.scoreStatus === "missing_actual"
          ? "missing"
          : metricScore.scoreStatus;

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
        scoreContribution: metricScore.scoreContribution,
        missingReason: metricScore.missingReason,
        statusBand,
        dataStatus,
        scoreStatus,
      };
    });

    const scoreValue = Number(
      mappedMetrics
        .filter((metric) => metric.scoreStatus === "scored" && metric.achievementRate !== null)
        .reduce(
          (sum, metric) => sum + ((metric.scoreContribution ?? 0) / 100),
          0,
        )
        .toFixed(2),
    );
    const matchedMetrics = mappedMetrics.filter(
      (metric) => metric.scoreStatus === "scored",
    ).length;
    const missingMetrics = mappedMetrics.filter((metric) => metric.dataStatus === "missing");
    const pendingNormalizationMetrics = mappedMetrics.filter(
      (metric) => metric.scoreStatus === "pending_normalization",
    );

    return {
      source: {
        mode: "live",
        snapshotRunId: null,
        snapshotDate: null,
        periodType: latestPeriod.period_type,
      },
      store: {
        storeId,
        storeName: liveRows[0]?.store_name ?? storeName,
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
      availablePeriods: availablePeriods.map((period) => ({
        periodType: period.period_type,
        periodStart: period.period_start,
        periodEnd: period.period_end,
      })),
      partial: {
        isPartial:
          missingMetrics.length > 0 || pendingNormalizationMetrics.length > 0,
        missingMetricCodes: missingMetrics.map((metric) => metric.code),
        missingMetricLabels: missingMetrics.map((metric) => metric.label),
        pendingNormalizationCodes: pendingNormalizationMetrics.map((metric) => metric.code),
        pendingNormalizationLabels: pendingNormalizationMetrics.map((metric) => metric.label),
      },
      metrics: mappedMetrics,
    };
  }

  async getStoreMonthlyScoreBreakdown(input: {
    snapshotRunId: string;
    storeId: string;
    storeIds: string[];
  }) {
    if (!input.storeIds.includes(input.storeId)) {
      throw new ForbiddenException(
        "Store score breakdown is outside current store scope.",
      );
    }

    const [config, kpiRows, bmChecklist, vmChecklist] = await Promise.all([
      this.getKpiConfig(),
      this.storeScoreReportingReadRepository.getStoreKpiSnapshotRowsForScore({
        snapshotRunId: input.snapshotRunId,
        storeId: input.storeId,
      }),
      this.storeScoreReportingReadRepository.getStoreChecklistSnapshotForScore({
        snapshotRunId: input.snapshotRunId,
        storeId: input.storeId,
        templateType: "BM_STORE_VISIT",
      }),
      this.storeScoreReportingReadRepository.getStoreChecklistSnapshotForScore({
        snapshotRunId: input.snapshotRunId,
        storeId: input.storeId,
        templateType: "VM_STORE_VISIT",
      }),
    ]);
    const storeMetricWeights = config.storeProfile.metrics.filter(
      (metric) => !["BM_CHECKLIST", "VM_CHECKLIST"].includes(metric.code),
    );
    const kpiWeightTotal = storeMetricWeights.reduce(
      (sum, metric) => sum + metric.weightPercent,
      0,
    );
    const kpiScore =
      kpiWeightTotal > 0
        ? storeMetricWeights.reduce((sum, metric) => {
            const row = kpiRows.find((item) => {
              const matchingCodes = [metric.code, ...(metric.aliases ?? [])];
              return matchingCodes.includes(item.kpi_code);
            });
            const achievementRate =
              row?.achievement_rate !== null && row?.achievement_rate !== undefined
                ? Number(row.achievement_rate)
                : null;

            if (
              achievementRate === null ||
              !Number.isFinite(achievementRate)
            ) {
              return sum;
            }

            return sum + achievementRate * (metric.weightPercent / kpiWeightTotal) * 100;
          }, 0)
        : null;

    const blendService = new StoreScoreBlendService();
    const mapChecklistSnapshot = (
      checklist: { avg_score: string | null; audit_count: number } | null,
    ) =>
      checklist?.avg_score !== null && checklist?.avg_score !== undefined
        ? {
            score: Number(checklist.avg_score),
            visitCount: Number(checklist.audit_count),
          }
        : null;

    return {
      snapshotRunId: input.snapshotRunId,
      storeId: input.storeId,
      scoreStatus: "final" as const,
      ...blendService.calculateMonthlyStoreScore({
        monthlyKpiScore:
          kpiScore !== null && Number.isFinite(kpiScore)
            ? Number(kpiScore.toFixed(2))
            : null,
        bmChecklist: mapChecklistSnapshot(bmChecklist),
        vmChecklist: mapChecklistSnapshot(vmChecklist),
        config: {
          kpiPerformanceWeight: 90,
          bmChecklistWeight: 5,
          vmChecklistWeight: 5,
          missingWeightPolicy: "return_missing_weight_to_kpi",
        },
      }),
    };
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
    const metricCodes = this.getProfileMetricCodes(profile);
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
          storeRank: null,
          storePopulation: 0,
        },
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
    const mappedAvailablePeriods = this.mapEmployeeAvailablePeriods(
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
        employee: this.mapEmployeeAssignmentIdentity(employeeId, fallbackAssignment),
        period: null,
        score: {
          value: 0,
          matchedMetrics: 0,
          totalMetrics: profile.metrics.length,
        },
        rankings: {
          turkeyRank: null,
          turkeyPopulation: 0,
          storeRank: null,
          storePopulation: 0,
        },
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

    if (!this.hasUsableBenchmarkRows(benchmarkRows)) {
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
      const benchmarkSource =
        metric.benchmarkSource ?? (targetValue !== null ? "TARGET" : "TURKEY_AVERAGE");
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

    const scoreForRows = (
      rows: Array<{
        employee_id: string;
        kpi_code: string;
        actual_value: string;
        target_value: string | null;
      }>,
    ) => {
      const byEmployee = new Map<
        string,
        Record<string, { actualValue: number; targetValue: number | null }>
      >();

      rows.forEach((row) => {
        const current = byEmployee.get(row.employee_id) ?? {};
        current[row.kpi_code] = {
          actualValue: Number(row.actual_value),
          targetValue: row.target_value !== null ? Number(row.target_value) : null,
        };
        byEmployee.set(row.employee_id, current);
      });

      const scoreRows = [...byEmployee.entries()].map(([peerEmployeeId, values]) => {
        const score = profile.metrics.reduce((sum, metric) => {
          const matchingCodes = [metric.code, ...(metric.aliases ?? [])];
          const matchedCode = matchingCodes.find((code) => values[code]);
          const matchedMetric = matchingCodes
            .map((code) => values[code])
            .find((value) => typeof value?.actualValue === "number");

          if (!matchedMetric) {
            return sum;
          }

          const benchmarkSource =
            metric.benchmarkSource ??
            (matchedMetric.targetValue !== null ? "TARGET" : "TURKEY_AVERAGE");
          const benchmarkValue =
            benchmarkSource === "TURKEY_AVERAGE" && matchedCode
              ? benchmarkLookup.get(matchedCode) ?? null
              : null;
          const metricScore = this.kpiBenchmarkScoringService.scoreMetric({
            metricCode: metric.code,
            actualValue: matchedMetric.actualValue,
            benchmarkValue,
            targetValue: matchedMetric.targetValue,
            weightPercent: metric.weightPercent,
            direction: metric.direction ?? "HIGHER_IS_BETTER",
            benchmarkSource,
            capRatio: metric.capRatio ?? 1.2,
          });

          if (metricScore.scoreContribution === null) {
            return sum;
          }

          return sum + metricScore.scoreContribution;
        }, 0);

        return {
          employeeId: peerEmployeeId,
          score: Number(score.toFixed(2)),
        };
      });

      scoreRows.sort((left, right) => right.score - left.score);
      return scoreRows;
    };

    const storeRows = latestPeriod.store_id
      ? turkeyRows.filter((row) => row.store_id === latestPeriod.store_id)
      : [];
    const storeScores = scoreForRows(storeRows);
    const turkeyScores = scoreForRows(turkeyRows);

    const storeRank =
      storeScores.findIndex((row) => row.employeeId === employeeId) >= 0
        ? storeScores.findIndex((row) => row.employeeId === employeeId) + 1
        : null;
    const turkeyRank =
      turkeyScores.findIndex((row) => row.employeeId === employeeId) >= 0
        ? turkeyScores.findIndex((row) => row.employeeId === employeeId) + 1
        : null;

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
          : this.formatEmployeeAssignmentName(fallbackAssignment),
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
        storeRank,
        storePopulation: storeScores.length,
      },
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
    const metricCodes = this.getProfileMetricCodes(profile);
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
          storeRank: null,
          storePopulation: 0,
        },
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
          storeRank: null,
          storePopulation: 0,
        },
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
        storeRank: summaryRow?.store_rank ?? null,
        storePopulation: summaryRow?.store_population ?? 0,
      },
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

  private resolveKpiConfigFromRows(
    rows: Array<{
      config_key: string;
      config_payload: unknown;
    }>,
  ) {
    const configMap = new Map(rows.map((row) => [row.config_key, row.config_payload]));
    const storeProfile = configMap.get("store_profile") ?? configMap.get("draft_store_profile");
    const personnelProfile =
      configMap.get("personnel_profile") ?? configMap.get("draft_personnel_profile");
    const ownershipMatrixPayload =
      configMap.get("ownership_matrix") ?? configMap.get("draft_ownership_matrix");
    const gradingBandsPayload =
      configMap.get("grading_bands") ?? configMap.get("draft_grading_bands");

    if (storeProfile && personnelProfile && ownershipMatrixPayload && gradingBandsPayload) {
      return {
        storeProfile: normalizeKpiScoreProfile(storeProfile as KpiScoreProfile),
        personnelProfile: normalizeKpiScoreProfile(personnelProfile as KpiScoreProfile),
        ownershipMatrix: ownershipMatrixPayload as KpiOwnershipMatrixRow[],
        gradingBands: gradingBandsPayload as KpiGradingBand[],
      };
    }

    return this.getDefaultKpiConfig();
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

  private mapEmployeeAvailablePeriods(
    periods: Array<{ period_type: string; period_start: string; period_end: string }>,
    fallbackPeriod?: {
      period_type?: string | null;
      period_start: string;
      period_end: string;
    } | null,
    fallbackPeriodType?: string,
  ) {
    const seenPeriodKeys = new Set<string>();
    const mappedPeriods: Array<{
      periodType: string;
      periodStart: string;
      periodEnd: string;
    }> = [];

    const addPeriod = (periodType: string | null | undefined, periodStart: string, periodEnd: string) => {
      if (!periodStart || !periodEnd) {
        return;
      }

      const normalizedPeriodType = this.normalizeEmployeeLivePeriodType(
        periodType,
        periodStart,
        periodEnd,
        fallbackPeriodType,
      );
      if (!normalizedPeriodType) {
        return;
      }

      const periodKey = `${normalizedPeriodType}:${periodStart}`;
      if (seenPeriodKeys.has(periodKey)) {
        return;
      }

      seenPeriodKeys.add(periodKey);
      mappedPeriods.push({
        periodType: normalizedPeriodType,
        periodStart,
        periodEnd,
      });
    };

    periods.forEach((period) => addPeriod(period.period_type, period.period_start, period.period_end));

    if (fallbackPeriod) {
      addPeriod(
        fallbackPeriod.period_type ?? fallbackPeriodType ?? "monthly",
        fallbackPeriod.period_start,
        fallbackPeriod.period_end,
      );
    }

    return mappedPeriods;
  }

  private normalizeEmployeeLivePeriodType(
    periodType: string | null | undefined,
    periodStart: string,
    periodEnd: string,
    fallbackPeriodType?: string,
  ) {
    if (periodType === "custom") {
      return periodStart === periodEnd ? "daily" : "monthly";
    }

    return periodType ?? fallbackPeriodType ?? "monthly";
  }

  private mapEmployeeAssignmentIdentity(
    employeeId: string,
    assignment: {
      first_name?: string | null;
      last_name?: string | null;
      store_id?: string | null;
      store_name?: string | null;
    } | null,
  ) {
    return {
      employeeId,
      displayName: this.formatEmployeeAssignmentName(assignment),
      storeId: assignment?.store_id ?? null,
      storeName: assignment?.store_name ?? null,
    };
  }

  private formatEmployeeAssignmentName(
    assignment: {
      first_name?: string | null;
      last_name?: string | null;
    } | null,
  ) {
    return assignment
      ? `${assignment.first_name ?? ""} ${assignment.last_name ?? ""}`.trim() || "Unknown employee"
      : "Unknown employee";
  }

  private mapKpiConfigVersionMetadata(version: {
    kpi_config_version_id: string;
    version_no: number;
    effective_from: string;
    effective_to: string | null;
    published_at: string;
    published_by: string | null;
  } | null) {
    return {
      kpiConfigVersionId: version?.kpi_config_version_id ?? null,
      versionNo: version?.version_no ?? null,
      effectiveFrom: version?.effective_from ?? null,
      effectiveTo: version?.effective_to ?? null,
      publishedAt: version?.published_at ?? null,
      publishedBy: version?.published_by ?? null,
    };
  }

  private getProfileMetricCodes(profile: KpiScoreProfile) {
    return [
      ...new Set(profile.metrics.flatMap((metric) => [metric.code, ...(metric.aliases ?? [])])),
    ];
  }

  private getDefaultKpiConfig() {
    return {
      storeProfile: normalizeKpiScoreProfile(storeKpiScoreProfile),
      personnelProfile: normalizeKpiScoreProfile(personnelKpiScoreProfile),
      ownershipMatrix: kpiOwnershipMatrix,
      gradingBands: kpiGradingBands,
    };
  }

  private validateKpiConfigInput(input: {
    storeProfile: unknown;
    personnelProfile: unknown;
    ownershipMatrix: unknown;
    gradingBands: unknown;
  }) {
    const storeProfile = input.storeProfile as KpiScoreProfile;
    const personnelProfile = input.personnelProfile as KpiScoreProfile;
    const ownershipMatrix = input.ownershipMatrix as KpiOwnershipMatrixRow[];
    const gradingBands = input.gradingBands as KpiGradingBand[];

    this.validateProfile(storeProfile, {
      expectedCode: "store",
      exactTotal: 100,
      label: "storeProfile",
    });
    this.validateProfile(personnelProfile, {
      expectedCode: "personnel",
      exactTotal: 100,
      label: "personnelProfile",
    });
    this.validateOwnershipMatrix(storeProfile, personnelProfile, ownershipMatrix);
    this.validateGradingBands(gradingBands);
  }

  private validateProfile(
    profile: KpiScoreProfile,
    rules: {
      expectedCode: "store" | "personnel";
      label: string;
      exactTotal?: number;
      maxTotal?: number;
    },
  ) {
    if (!profile || profile.profileCode !== rules.expectedCode) {
      throw new BadRequestException(`${rules.label} profileCode is invalid.`);
    }

    if (!Array.isArray(profile.metrics) || profile.metrics.length === 0) {
      throw new BadRequestException(`${rules.label} must contain at least one metric.`);
    }

    const seenCodes = new Set<string>();
    const totalWeight = profile.metrics.reduce((sum, metric) => {
      const normalizedCode = metric.code?.trim();
      const normalizedLabel = metric.label?.trim();

      if (!normalizedCode || !normalizedLabel) {
        throw new BadRequestException(
          `${rules.label} contains a metric with empty code or label.`,
        );
      }

      if (seenCodes.has(normalizedCode)) {
        throw new BadRequestException(
          `${rules.label} contains duplicate metric code "${normalizedCode}".`,
        );
      }
      seenCodes.add(normalizedCode);

      if (!Number.isFinite(metric.weightPercent) || metric.weightPercent < 0) {
        throw new BadRequestException(
          `${rules.label} metric "${normalizedCode}" has invalid weightPercent.`,
        );
      }

      return sum + metric.weightPercent;
    }, 0);

    if (rules.exactTotal !== undefined && totalWeight !== rules.exactTotal) {
      throw new BadRequestException(
        `${rules.label} weight total must equal ${rules.exactTotal}.`,
      );
    }

    if (rules.maxTotal !== undefined && totalWeight > rules.maxTotal) {
      throw new BadRequestException(
        `${rules.label} weight total cannot exceed ${rules.maxTotal}.`,
      );
    }
  }

  private validateOwnershipMatrix(
    storeProfile: KpiScoreProfile,
    personnelProfile: KpiScoreProfile,
    ownershipMatrix: KpiOwnershipMatrixRow[],
  ) {
    if (!Array.isArray(ownershipMatrix) || ownershipMatrix.length === 0) {
      throw new BadRequestException("ownershipMatrix must contain at least one row.");
    }

    const metricCodes = new Set([
      ...storeProfile.metrics.map((metric) => metric.code.trim()),
      ...personnelProfile.metrics.map((metric) => metric.code.trim()),
    ]);
    const seenRows = new Set<string>();

    for (const row of ownershipMatrix) {
      const code = row.code?.trim();
      const label = row.label?.trim();

      if (!code || !label) {
        throw new BadRequestException(
          "ownershipMatrix contains a row with empty code or label.",
        );
      }

      if (seenRows.has(code)) {
        throw new BadRequestException(
          `ownershipMatrix contains duplicate code "${code}".`,
        );
      }
      seenRows.add(code);

      if (!metricCodes.has(code)) {
        throw new BadRequestException(
          `ownershipMatrix code "${code}" is not present in any KPI profile.`,
        );
      }

      if (!Array.isArray(row.visibleTo) || row.visibleTo.length === 0) {
        throw new BadRequestException(
          `ownershipMatrix row "${code}" must define at least one visibleTo role.`,
        );
      }

      if (!Array.isArray(row.contributesTo) || row.contributesTo.length === 0) {
        throw new BadRequestException(
          `ownershipMatrix row "${code}" must define contributesTo.`,
        );
      }
    }
  }

  private validateGradingBands(gradingBands: KpiGradingBand[]) {
    if (!Array.isArray(gradingBands) || gradingBands.length === 0) {
      throw new BadRequestException("gradingBands must contain at least one row.");
    }

    const seenCodes = new Set<string>();
    let lastMinScore = Number.POSITIVE_INFINITY;

    for (const band of gradingBands) {
      const code = band.code?.trim();
      const label = band.label?.trim();
      const emoji = band.emoji?.trim();

      if (!code || !label || !emoji) {
        throw new BadRequestException(
          "gradingBands contains a row with empty code, label, or emoji.",
        );
      }

      if (seenCodes.has(code)) {
        throw new BadRequestException(
          `gradingBands contains duplicate code "${code}".`,
        );
      }
      seenCodes.add(code);

      if (!Number.isFinite(band.minScore) || band.minScore < 0) {
        throw new BadRequestException(
          `gradingBands row "${code}" has invalid minScore.`,
        );
      }

      if (band.minScore > lastMinScore) {
        throw new BadRequestException(
          "gradingBands must be sorted from highest minScore to lowest.",
        );
      }

      lastMinScore = band.minScore;
    }
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
