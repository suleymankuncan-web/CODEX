import {
  KpiBenchmarkMetricInput,
  KpiBenchmarkMetricResult,
} from "./kpi-benchmark-scoring.contract";

export class KpiBenchmarkScoringService {
  // Live policy v2. Keep scoreMetric unchanged for versioned closed snapshots.
  scoreLiveMetric(input: KpiBenchmarkMetricInput): KpiBenchmarkMetricResult {
    const capRatio = ["BM_CHECKLIST", "VM_CHECKLIST"].includes(input.metricCode) ? 1 : 2;
    const result = this.scoreMetric({ ...input, capRatio });
    if (result.actualRatio === null) return result;
    const reference = input.benchmarkSource === "TARGET" ? input.targetValue : input.benchmarkValue;
    const scoredRatio = Math.max(0, Math.min(input.actualValue! / reference!, capRatio));
    return {
      ...result,
      scoredRatio: this.round(scoredRatio),
      scoreContribution: this.round(scoredRatio * 70 * input.weightPercent / 100),
    };
  }

  scoreMetric(input: KpiBenchmarkMetricInput): KpiBenchmarkMetricResult {
    if (input.actualValue === null || !Number.isFinite(input.actualValue)) {
      return this.missing(input, "missing_actual", "actual_missing");
    }

    const referenceValue =
      input.benchmarkSource === "TARGET"
        ? input.targetValue
        : input.benchmarkValue;

    if (referenceValue === null || !Number.isFinite(referenceValue)) {
      return this.missing(input, "missing_reference", "benchmark_missing");
    }

    if (referenceValue === 0) {
      return this.missing(
        input,
        "missing_reference",
        "benchmark_denominator_zero",
      );
    }

    if (input.direction !== "HIGHER_IS_BETTER") {
      return this.missing(input, "missing_reference", "unsupported_direction");
    }

    const actualRatio = input.actualValue / referenceValue;
    const scoredRatio = Math.min(actualRatio, input.capRatio);
    const isCapped = actualRatio > input.capRatio;

    return {
      metricCode: input.metricCode,
      actualValue: input.actualValue,
      benchmarkValue: input.benchmarkValue,
      targetValue: input.targetValue,
      actualRatio: this.round(actualRatio),
      scoredRatio: this.round(scoredRatio),
      capRatio: input.capRatio,
      isCapped,
      weightPercent: input.weightPercent,
      scoreContribution: this.round(scoredRatio * input.weightPercent),
      scoreStatus: "scored",
    };
  }

  private missing(
    input: KpiBenchmarkMetricInput,
    scoreStatus: "missing_reference" | "missing_actual",
    missingReason: string,
  ): KpiBenchmarkMetricResult {
    return {
      metricCode: input.metricCode,
      actualValue: input.actualValue,
      benchmarkValue: input.benchmarkValue,
      targetValue: input.targetValue,
      actualRatio: null,
      scoredRatio: null,
      capRatio: input.capRatio,
      isCapped: false,
      weightPercent: input.weightPercent,
      scoreContribution: null,
      scoreStatus,
      missingReason,
    };
  }

  private round(value: number) {
    return Number(value.toFixed(4));
  }
}
