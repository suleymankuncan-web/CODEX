import type { KpiBenchmarkMetricInput } from "./kpi-benchmark-scoring.contract";
import { KpiBenchmarkScoringService } from "./kpi-benchmark-scoring.service";

describe("live HG scoring", () => {
  const service = new KpiBenchmarkScoringService();
  const input: KpiBenchmarkMetricInput = {
    metricCode: "TARGET_ACHIEVEMENT", actualValue: 100, targetValue: 100,
    benchmarkValue: 80, weightPercent: 40, direction: "HIGHER_IS_BETTER",
    benchmarkSource: "TARGET", capRatio: 1.2,
  };

  it.each([[80, 40, 32], [100, 40, 40], [100, 30, 30], [100, 0, 0]])(
    "uses the published weight: actual %s, weight %s earns %s",
    (actualValue, weightPercent, scoreContribution) => {
      expect(service.scoreLiveMetric({ ...input, actualValue, weightPercent }).scoreContribution)
        .toBe(scoreContribution);
    },
  );

  it("never uses Turkey's HG average as the score denominator", () => {
    for (const benchmarkValue of [20, 80, 150, null]) {
      expect(service.scoreLiveMetric({ ...input, benchmarkValue, benchmarkSource: "TURKEY_AVERAGE" })
        .scoreContribution).toBe(40);
    }
  });

  it("adds daily contributions against a fixed monthly target", () => {
    expect([3, 5, 8].map(actualValue => service.scoreLiveMetric({ ...input, actualValue })
      .scoreContribution)).toEqual([1.2, 2, 3.2]);
  });

  it.each([null, 0])("does not substitute a Turkey reference for target %s", targetValue => {
    expect(service.scoreLiveMetric({ ...input, targetValue }).scoreContribution).toBeNull();
  });

  it("preserves the live upper cap and negative contribution floor", () => {
    expect(service.scoreLiveMetric({ ...input, actualValue: 250 })).toMatchObject({
      actualRatio: 2.5, scoredRatio: 2, capRatio: 2, isCapped: true, scoreContribution: 80,
    });
    expect(service.scoreLiveMetric({ ...input, actualValue: -10 })).toMatchObject({
      actualRatio: -0.1, scoredRatio: 0, scoreContribution: 0,
    });
  });

  it("keeps other KPI base 70 and the closed-snapshot cap policy unchanged", () => {
    expect(service.scoreLiveMetric({ ...input, metricCode: "ATV", benchmarkValue: 100,
      benchmarkSource: "TURKEY_AVERAGE", weightPercent: 60 }).scoreContribution).toBe(42);
    expect(service.scoreMetric({ ...input, actualValue: 150 })).toMatchObject({
      scoredRatio: 1.2, capRatio: 1.2, scoreContribution: 48,
    });
  });
});
