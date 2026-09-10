import { KpiBenchmarkScoringService } from "./kpi-benchmark-scoring.service";
import { isGsmApprovalKpiCode } from "./kpi-config.contract";
import type {
  PerformanceScoreEvaluationInput,
  PerformanceScoreEvaluationMetric,
  PerformanceScoreEvaluationResult,
} from "./performance-score-evaluator.contract";

const storeChecklistMetricCodes = new Set(["BM_CHECKLIST", "VM_CHECKLIST"]);

export class PerformanceScoreEvaluator {
  private readonly kpiBenchmarkScoringService = new KpiBenchmarkScoringService();

  evaluate(input: PerformanceScoreEvaluationInput): PerformanceScoreEvaluationResult {
    const metrics = input.profile.metrics.map((metric) => {
      const matchingCodes = [metric.code, ...(metric.aliases ?? [])];
      const matchedCode = matchingCodes.find((code) => input.values.has(code));
      const matchedMetric = matchedCode ? input.values.get(matchedCode) : undefined;
      const actualValue = matchedMetric?.actualValue ?? null;
      const targetValue = matchedMetric?.targetValue ?? null;
      const scoringActualValue = isGsmApprovalKpiCode(metric.code)
        ? matchedMetric?.scoreValue ?? actualValue : actualValue;
      const scoringTargetValue =
        isGsmApprovalKpiCode(metric.code) &&
        matchedMetric?.scoreValue !== null &&
        matchedMetric?.scoreValue !== undefined
          ? 1
          : targetValue;
      const benchmarkSource = metric.code === "TARGET_ACHIEVEMENT" ? "TARGET" : metric.benchmarkSource ?? (scoringTargetValue !== null ? "TARGET" : "TURKEY_AVERAGE");
      const benchmarkValue =
        benchmarkSource === "TURKEY_AVERAGE" && matchedCode
          ? this.resolveBenchmarkValue({
              benchmarkLookup: input.benchmarkLookup,
              fallback: input.benchmarkFallback,
              matchedCode,
              metricCode: metric.code,
            })
          : null;
      const score = storeChecklistMetricCodes.has(metric.code)
        ? {
            scoreContribution:
              actualValue !== null && Number.isFinite(actualValue)
                ? Number(((Math.max(0, Math.min(actualValue, 100)) * 0.7 * metric.weightPercent) / 100).toFixed(4))
                : null,
          }
        : this.kpiBenchmarkScoringService.scoreLiveMetric({
            metricCode: metric.code,
            actualValue: scoringActualValue,
            benchmarkValue,
            targetValue: scoringTargetValue,
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
      input.useStoreChecklistFallback && input.profile.profileCode === "store"
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

  private resolveBenchmarkValue(input: {
    benchmarkLookup: Map<string, number | null>;
    fallback: PerformanceScoreEvaluationInput["benchmarkFallback"];
    matchedCode: string;
    metricCode: string;
  }) {
    if (input.fallback === "matched-only") {
      return input.benchmarkLookup.get(input.matchedCode) ?? null;
    }

    return (
      input.benchmarkLookup.get(input.matchedCode) ??
      input.benchmarkLookup.get(input.metricCode) ??
      null
    );
  }

  private scoreStoreProfileWithChecklistFallback(input: {
    metrics: PerformanceScoreEvaluationMetric[];
    profile: PerformanceScoreEvaluationInput["profile"];
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
}
