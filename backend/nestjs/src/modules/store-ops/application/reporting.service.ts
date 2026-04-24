import { BadRequestException, Injectable } from "@nestjs/common";
import { ReportingRepository } from "../infrastructure/reporting.repository";
import { buildListResponse } from "../../../shared/http/response-builders";
import { mapAuditEvent } from "../../../shared/audit/audit-event.mapper";
import {
  KpiGradingBand,
  KpiOwnershipMatrixRow,
  kpiGradingBands,
  KpiScoreProfile,
  kpiOwnershipMatrix,
  personnelKpiScoreProfile,
  storeKpiScoreProfile,
} from "./kpi-config.contract";
import { KpiConfigRepository } from "../infrastructure/kpi-config.repository";
import { ClosedRankingService } from "./closed-ranking.service";

@Injectable()
export class ReportingService {
  constructor(
    private readonly reportingRepository: ReportingRepository,
    private readonly kpiConfigRepository: KpiConfigRepository,
    private readonly closedRankingService: ClosedRankingService,
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
      const rows = await this.kpiConfigRepository.getKpiConfigRows();
      return this.resolveKpiConfigFromRows(rows);
    } catch {
      // Fall back to in-code defaults until local or prod config table is populated.
    }

    return this.getDefaultKpiConfig();
  }

  async getKpiConfigEditor() {
    const publishedRows = await this.kpiConfigRepository.getKpiConfigRows();
    const draftRows = await this.kpiConfigRepository.getDraftKpiConfigRows();
    const publishedConfig = this.resolveKpiConfigFromRows(publishedRows);
    const draftConfig =
      draftRows.length > 0 ? this.resolveKpiConfigFromRows(draftRows) : publishedConfig;

    return {
      draftConfig,
      publishedConfig,
      hasUnpublishedChanges:
        JSON.stringify(draftConfig) !== JSON.stringify(publishedConfig),
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

    const liveRows = await this.reportingRepository.getStorePerformanceRows({
      storeId,
      metricCodes,
      periodType: latestPeriod.period_type,
      periodStart: latestPeriod.period_start,
      periodEnd: latestPeriod.period_end,
    });
    let peerRows = await this.reportingRepository.getPeerStorePerformanceRows({
      metricCodes,
      companyId: input.companyIds[0] ?? undefined,
      periodType: latestPeriod.period_type,
      periodStart: latestPeriod.period_start,
      periodEnd: latestPeriod.period_end,
    });

    if (peerRows.length === 0) {
      peerRows = await this.reportingRepository.getPeerStorePerformanceRows({
        metricCodes,
        companyId: undefined,
        periodType: latestPeriod.period_type,
        periodStart: latestPeriod.period_start,
        periodEnd: latestPeriod.period_end,
      });
    }
    const nationalAverages = peerRows.reduce(
      (map, row) => {
        const current = map.get(row.kpi_code) ?? { total: 0, count: 0 };
        current.total += Number(row.actual_value);
        current.count += 1;
        map.set(row.kpi_code, current);
        return map;
      },
      new Map<string, { total: number; count: number }>(),
    );

    const rowLookup = new Map(liveRows.map((row) => [row.kpi_code, row]));
    const mappedMetrics = profile.metrics.map((metric) => {
      const matchingCodes = [metric.code, ...(metric.aliases ?? [])];
      const row = matchingCodes
        .map((code) => rowLookup.get(code))
        .find((value) => Boolean(value));
      const actualValue = row?.actual_value ? Number(row.actual_value) : null;
      const targetValue = row?.target_value ? Number(row.target_value) : null;
      const averageSource = row ? nationalAverages.get(row.kpi_code) : null;
      const averageValue =
        averageSource && averageSource.count > 0
          ? averageSource.total / averageSource.count
          : null;
      const achievementRate = (() => {
        if (
          actualValue !== null &&
          targetValue !== null &&
          Number.isFinite(targetValue) &&
          targetValue !== 0
        ) {
          return Number((actualValue / targetValue).toFixed(4));
        }

        if (
          actualValue !== null &&
          averageValue !== null &&
          Number.isFinite(averageValue) &&
          averageValue !== 0
        ) {
          return Number((actualValue / averageValue).toFixed(4));
        }

        return null;
      })();
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
        achievementRate !== null
          ? "scored"
          : actualValue !== null
            ? "pending_normalization"
            : "missing";

      return {
        code: metric.code,
        label: metric.label,
        weightPercent: metric.weightPercent,
        actualValue,
        targetValue,
        achievementRate,
        statusBand,
        dataStatus,
        scoreStatus,
      };
    });

    const scoreValue = Number(
      mappedMetrics
        .filter((metric) => metric.scoreStatus === "scored" && metric.achievementRate !== null)
        .reduce(
          (sum, metric) => sum + ((metric.achievementRate ?? 0) * metric.weightPercent) / 100,
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
    return this.closedRankingService.getClosedLeaderboard(input);
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
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
    periodType?: "daily" | "weekly" | "monthly";
    periodStart?: string;
  }) {
    const config = await this.getKpiConfig();
    const profile = config.personnelProfile;
    const metricCodes = profile.metrics.map((metric) => metric.code);
    const employeeDataMetricCodes = [...new Set([...metricCodes, "NET_SALES"])];
    const employeeId =
      input.employeeId ??
      (await this.reportingRepository.getEmployeeIdForUser(input.userId)) ??
      null;

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

    const availablePeriods = await this.reportingRepository.listEmployeeKpiPeriods({
      employeeId,
      metricCodes: employeeDataMetricCodes,
      companyIds: input.companyIds,
      regionIds: input.regionIds,
      storeIds: input.storeIds,
    });
    const latestPeriod = await this.reportingRepository.getLatestEmployeeKpiPeriod({
      employeeId,
      metricCodes: employeeDataMetricCodes,
      companyIds: input.companyIds,
      regionIds: input.regionIds,
      storeIds: input.storeIds,
      periodType: input.periodType,
      periodStart: input.periodStart,
    });

    if (!latestPeriod) {
      return {
        source: {
          mode: "live",
          snapshotRunId: null,
          snapshotDate: null,
        },
        employee: {
          employeeId,
          displayName: "Unknown employee",
          storeId: null,
          storeName: null,
        },
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
        availablePeriods: availablePeriods.map((period) => ({
          periodType: period.period_type,
          periodStart: period.period_start,
          periodEnd: period.period_end,
        })),
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

    const nationalAverages = turkeyRows.reduce(
      (map, row) => {
        const current = map.get(row.kpi_code) ?? { total: 0, count: 0 };
        current.total += Number(row.actual_value);
        current.count += 1;
        map.set(row.kpi_code, current);
        return map;
      },
      new Map<string, { total: number; count: number }>(),
    );

    const metricLookup = new Map(employeeRows.map((row) => [row.kpi_code, row]));
    const salesRow = metricLookup.get("NET_SALES");
    const mappedMetrics = profile.metrics.map((metric) => {
      const matchingCodes = [metric.code, ...(metric.aliases ?? [])];
      const row = matchingCodes
        .map((code) => metricLookup.get(code))
        .find((value) => Boolean(value));
      const actualValue = row ? Number(row.actual_value) : null;
      const targetValue = row?.target_value ? Number(row.target_value) : null;
      const averageSource = row ? nationalAverages.get(row.kpi_code) : null;
      const averageValue =
        averageSource && averageSource.count > 0
          ? averageSource.total / averageSource.count
          : null;
      const achievementRate = this.resolveWeightedAchievementRate({
        actualValue,
        targetValue,
        averageValue,
      });
      const contributionValue =
        achievementRate !== null
          ? Number(((achievementRate * metric.weightPercent) / 100).toFixed(2))
          : 0;
      const scoreStatus =
        achievementRate !== null
          ? "scored"
          : actualValue !== null
            ? "pending_normalization"
            : "missing";

      return {
        code: metric.code,
        label: metric.label,
        weightPercent: metric.weightPercent,
        actualValue,
        targetValue,
        achievementRate,
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
          const matchedMetric = matchingCodes
            .map((code) => values[code])
            .find((value) => typeof value?.actualValue === "number");

          if (!matchedMetric) {
            return sum;
          }

          const averageSource = nationalAverages.get(
            matchingCodes.find((code) => values[code]) ?? metric.code,
          );
          const averageValue =
            averageSource && averageSource.count > 0
              ? averageSource.total / averageSource.count
              : null;
          const achievementRate = this.resolveWeightedAchievementRate({
            actualValue: matchedMetric.actualValue,
            targetValue: matchedMetric.targetValue,
            averageValue,
          });

          if (achievementRate === null) {
            return sum;
          }

          return sum + (achievementRate * metric.weightPercent) / 100;
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
          : "Unknown employee",
        storeId: employeeRows[0]?.store_id ?? latestPeriod.store_id,
        storeName: employeeRows[0]?.store_name ?? null,
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
      availablePeriods: availablePeriods.map((period) => ({
        periodType: period.period_type,
        periodStart: period.period_start,
        periodEnd: period.period_end,
      })),
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
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
    snapshotDate?: string;
  }) {
    const config = await this.getKpiConfig();
    const profile = config.personnelProfile;
    const metricCodes = profile.metrics.map((metric) => metric.code);
    const employeeDataMetricCodes = [...new Set([...metricCodes, "NET_SALES"])];
    const employeeId =
      input.employeeId ??
      (await this.reportingRepository.getEmployeeIdForUser(input.userId)) ??
      null;

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
      ? await this.reportingRepository.getCompletedSnapshotRunByTypeAndDate({
          snapshotType: "daily",
          periodStart: input.snapshotDate,
          periodEnd: input.snapshotDate,
        })
      : await this.reportingRepository.getLatestCompletedSnapshotRunByType("daily");

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

    const summaryRow = await this.reportingRepository.getEmployeePerformanceSnapshot({
      snapshotRunId: snapshotRun.snapshot_run_id,
      employeeId,
    });
    const metricRows = await this.reportingRepository.getEmployeeKpiSnapshotRows({
      snapshotRunId: snapshotRun.snapshot_run_id,
      employeeId,
      metricCodes: employeeDataMetricCodes,
    });
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
        : null,
      period: summaryRow
        ? {
            periodStart: summaryRow.period_start,
            periodEnd: summaryRow.period_end,
          }
        : null,
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
      availablePeriods: summaryRow
        ? [
            {
              periodType: "daily",
              periodStart: summaryRow.period_start,
              periodEnd: summaryRow.period_end,
            },
          ]
        : [],
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
        storeProfile: storeProfile as KpiScoreProfile,
        personnelProfile: personnelProfile as KpiScoreProfile,
        ownershipMatrix: ownershipMatrixPayload as KpiOwnershipMatrixRow[],
        gradingBands: gradingBandsPayload as KpiGradingBand[],
      };
    }

    return this.getDefaultKpiConfig();
  }

  private getDefaultKpiConfig() {
    return {
      storeProfile: storeKpiScoreProfile,
      personnelProfile: personnelKpiScoreProfile,
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
