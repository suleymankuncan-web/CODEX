import type { KpiScoreProfile } from "./kpi-config.contract";
import type { KpiBenchmarkScoringService } from "./kpi-benchmark-scoring.service";

type EmployeePerformanceRankRow = {
  employee_id: string;
  kpi_code: string;
  actual_value: string;
  target_value: string | null;
};

export function buildEmployeeScoreRankRows(input: {
  rows: EmployeePerformanceRankRow[];
  profile: KpiScoreProfile;
  benchmarkLookup: Map<string, number | null>;
  scoringService: KpiBenchmarkScoringService;
}) {
  const byEmployee = new Map<
    string,
    Record<string, { actualValue: number; targetValue: number | null }>
  >();

  input.rows.forEach((row) => {
    const current = byEmployee.get(row.employee_id) ?? {};
    current[row.kpi_code] = {
      actualValue: Number(row.actual_value),
      targetValue: row.target_value !== null ? Number(row.target_value) : null,
    };
    byEmployee.set(row.employee_id, current);
  });

  const scoreRows = [...byEmployee.entries()].map(([peerEmployeeId, values]) => {
    const score = input.profile.metrics.reduce((sum, metric) => {
      const matchingCodes = [metric.code, ...(metric.aliases ?? [])];
      const matchedCode = matchingCodes.find((code) => values[code]);
      const matchedMetric = matchingCodes
        .map((code) => values[code])
        .find((value) => typeof value?.actualValue === "number");

      if (!matchedMetric) return sum;

      const benchmarkSource = metric.code === "TARGET_ACHIEVEMENT" ? "TARGET" : metric.benchmarkSource ?? (matchedMetric.targetValue !== null ? "TARGET" : "TURKEY_AVERAGE");
      const benchmarkValue =
        benchmarkSource === "TURKEY_AVERAGE" && matchedCode
          ? input.benchmarkLookup.get(matchedCode) ?? null
          : null;
      const metricScore = input.scoringService.scoreMetric({
        metricCode: metric.code,
        actualValue: matchedMetric.actualValue,
        benchmarkValue,
        targetValue: matchedMetric.targetValue,
        weightPercent: metric.weightPercent,
        direction: metric.direction ?? "HIGHER_IS_BETTER",
        benchmarkSource,
        capRatio: metric.capRatio ?? 1.2,
      });

      return metricScore.scoreContribution === null
        ? sum
        : sum + metricScore.scoreContribution;
    }, 0);

    return {
      employeeId: peerEmployeeId,
      score: Number(score.toFixed(2)),
    };
  });

  scoreRows.sort((left, right) => right.score - left.score);
  return scoreRows;
}
