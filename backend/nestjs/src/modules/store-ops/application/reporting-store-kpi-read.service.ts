import { ForbiddenException } from "@nestjs/common";
import { KpiScoreProfile, isGsmApprovalKpiCode } from "./kpi-config.contract";
import { KpiBenchmarkScoringService } from "./kpi-benchmark-scoring.service";
import { StoreScoreBlendService } from "./store-score-blend.service";
import { RankingReportingReadRepository } from "../infrastructure/ranking-reporting-read.repository";
import { StorePerformanceReportingReadRepository } from "../infrastructure/store-performance-reporting-read.repository";
import { StoreScoreReportingReadRepository } from "../infrastructure/store-score-reporting-read.repository";

const storeChecklistMetricCodes = new Set(["BM_CHECKLIST", "VM_CHECKLIST"]);

type StoreKpiConfigProvider = (input?: { snapshotRunId?: string }) => Promise<{
  storeProfile: KpiScoreProfile;
}>;

export class ReportingStoreKpiReadService {
  private readonly kpiBenchmarkScoringService = new KpiBenchmarkScoringService();

  constructor(
    private readonly getKpiConfig: StoreKpiConfigProvider,
    private readonly storeScoreReportingReadRepository: StoreScoreReportingReadRepository,
    private readonly storePerformanceReportingReadRepository: StorePerformanceReportingReadRepository,
    private readonly rankingReportingReadRepository: RankingReportingReadRepository,
  ) {}

  async getStoreKpiHighlights(input: {
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
    periodType?: "daily" | "weekly" | "monthly";
    periodStart?: string;
    storeId?: string;
    regionManagerUserId?: string;
  }) {
    const config = await this.getKpiConfig();
    const profile = config.storeProfile;
    const metricCodes = profile.metrics.map((metric) => metric.code);
    const storeId = input.storeId ?? input.storeIds[0] ?? null;

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

    if (input.storeId) {
      await this.assertCanReadStore({
        storeId,
        companyIds: input.companyIds,
        regionIds: input.regionIds,
        storeIds: input.storeIds,
        regionManagerUserId: input.regionManagerUserId,
      });
    }

    const [storeName, availablePeriods, latestPeriod] = await Promise.all([
      this.storePerformanceReportingReadRepository.getStoreNameById(storeId),
      this.storePerformanceReportingReadRepository.listStoreKpiPeriods({
        storeId,
        metricCodes,
      }),
      this.storePerformanceReportingReadRepository.getLatestStoreKpiPeriod({
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
      this.storePerformanceReportingReadRepository.getStorePerformanceRows({
        storeId,
        metricCodes,
        periodType: latestPeriod.period_type,
        periodStart: latestPeriod.period_start,
        periodEnd: latestPeriod.period_end,
      }),
      shouldReadChecklistRows
        ? this.rankingReportingReadRepository.listRankingStoreChecklistRows({
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
    let benchmarkRows = await this.storePerformanceReportingReadRepository.getStoreTurkeyBenchmarkValues({
      companyId: input.companyIds[0] ?? undefined,
      periodType: latestPeriod.period_type,
      periodStart: latestPeriod.period_start,
      periodEnd: latestPeriod.period_end,
    });

    if (!this.hasUsableBenchmarkRows(benchmarkRows)) {
      benchmarkRows = await this.storePerformanceReportingReadRepository.getStoreTurkeyBenchmarkValues({
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
      const rawAchievementRate =
        row && "achievement_rate" in row ? row.achievement_rate : null;
      const importedAchievementRate =
        rawAchievementRate !== null && rawAchievementRate !== undefined
          ? Number(rawAchievementRate)
          : null;
      const isChecklistMetric = storeChecklistMetricCodes.has(metric.code);
      const targetValue =
        isChecklistMetric && actualValue !== null
          ? 100
          : row?.target_value !== null && row?.target_value !== undefined
            ? Number(row.target_value)
            : null;
      const scoringActualValue =
        isGsmApprovalKpiCode(metric.code) && importedAchievementRate !== null
          ? importedAchievementRate
          : actualValue;
      const scoringTargetValue =
        isGsmApprovalKpiCode(metric.code) && importedAchievementRate !== null
          ? 1
          : targetValue;
      const scoringBenchmarkSource =
        isChecklistMetric
          ? "TARGET"
          : metric.code === "TARGET_ACHIEVEMENT"
            ? "TARGET"
            : metric.benchmarkSource ??
              (scoringTargetValue !== null ? "TARGET" : "TURKEY_AVERAGE");
      const displayBenchmarkSource = isGsmApprovalKpiCode(metric.code)
        ? "TURKEY_AVERAGE"
        : scoringBenchmarkSource;
      const benchmarkValue =
        !isChecklistMetric && displayBenchmarkSource === "TURKEY_AVERAGE" && row
          ? this.getBenchmarkValue(benchmarkLookup, matchingCodes)
          : null;
      const metricScore = this.kpiBenchmarkScoringService.scoreLiveMetric({
        metricCode: metric.code,
        actualValue: scoringActualValue,
        benchmarkValue,
        targetValue: scoringTargetValue,
        weightPercent: metric.weightPercent,
        direction: metric.direction ?? "HIGHER_IS_BETTER",
        benchmarkSource: scoringBenchmarkSource,
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
        benchmarkSource: displayBenchmarkSource,
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
    companyIds?: string[];
    storeIds: string[];
  }) {
    if (input.storeIds.length === 0 && (input.companyIds?.length ?? 0) > 0) {
      const storeScope =
        await this.storePerformanceReportingReadRepository.getStoreScopeById(
          input.storeId,
        );
      if (
        !storeScope ||
        storeScope.company_id === null ||
        !input.companyIds?.includes(storeScope.company_id)
      ) {
        throw new ForbiddenException(
          "Store score breakdown is outside current company scope.",
        );
      }
    }

    const isCompanyScoped =
      input.storeIds.length === 0 && (input.companyIds?.length ?? 0) > 0;
    if (!isCompanyScoped && !input.storeIds.includes(input.storeId)) {
      throw new ForbiddenException(
        "Store score breakdown is outside current store scope.",
      );
    }

    const [config, kpiRows, bmChecklist, vmChecklist] = await Promise.all([
      this.getKpiConfig({ snapshotRunId: input.snapshotRunId }),
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

  private hasUsableBenchmarkRows(rows: Array<{ benchmark_value: string | null }>) {
    return rows.some((row) => {
      if (row.benchmark_value === null) {
        return false;
      }

      const value = Number(row.benchmark_value);
      return Number.isFinite(value) && value !== 0;
    });
  }

  private getBenchmarkValue(
    benchmarkLookup: Map<string, number | null>,
    matchingCodes: string[],
  ) {
    const normalizedLookup = new Map(
      Array.from(benchmarkLookup.entries()).map(([code, value]) => [
        this.normalizeBenchmarkCode(code),
        value,
      ]),
    );

    for (const code of matchingCodes) {
      const value = benchmarkLookup.get(code);
      if (value !== undefined) {
        return value;
      }

      const normalizedValue = normalizedLookup.get(
        this.normalizeBenchmarkCode(code),
      );
      if (normalizedValue !== undefined) {
        return normalizedValue;
      }
    }

    return null;
  }

  private normalizeBenchmarkCode(code: string) {
    return isGsmApprovalKpiCode(code)
      ? "gsm_approval"
      : code.trim().toLowerCase();
  }

  private async assertCanReadStore(input: {
    storeId: string;
    companyIds: string[];
    regionIds: string[];
    storeIds: string[];
    regionManagerUserId?: string;
  }) {
    if (input.storeIds.includes(input.storeId)) {
      return;
    }

    if (
      input.regionManagerUserId &&
      await this.storePerformanceReportingReadRepository.canRegionManagerReadStore({
        userId: input.regionManagerUserId,
        storeId: input.storeId,
      })
    ) {
      return;
    }

    if (input.regionManagerUserId) {
      throw new ForbiddenException(
        "Store KPI highlights are outside current store scope.",
      );
    }

    const storeScope =
      await this.storePerformanceReportingReadRepository.getStoreScopeById(
        input.storeId,
      );

    if (!storeScope) {
      throw new ForbiddenException(
        "Store KPI highlights are outside current store scope.",
      );
    }

    if (
      storeScope.company_id &&
      input.companyIds.includes(storeScope.company_id)
    ) {
      return;
    }

    if (
      storeScope.region_id &&
      input.regionIds.includes(storeScope.region_id)
    ) {
      return;
    }

    throw new ForbiddenException(
      "Store KPI highlights are outside current store scope.",
    );
  }
}
