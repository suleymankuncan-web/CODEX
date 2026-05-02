import { KpiBenchmarkScoringService } from "./kpi-benchmark-scoring.service";

describe("KpiBenchmarkScoringService", () => {
  const service = new KpiBenchmarkScoringService();

  it("scores higher-is-better metric against Turkey benchmark", () => {
    const result = service.scoreMetric({
      metricCode: "UPT",
      actualValue: 3.3,
      benchmarkValue: 3,
      targetValue: null,
      weightPercent: 15,
      direction: "HIGHER_IS_BETTER",
      benchmarkSource: "TURKEY_AVERAGE",
      capRatio: 1.2,
    });

    expect(result.actualRatio).toBe(1.1);
    expect(result.scoredRatio).toBe(1.1);
    expect(result.isCapped).toBe(false);
    expect(result.scoreContribution).toBe(16.5);
    expect(result.scoreStatus).toBe("scored");
  });

  it("keeps actual ratio visible but caps score contribution", () => {
    const result = service.scoreMetric({
      metricCode: "UPT",
      actualValue: 4.44,
      benchmarkValue: 3,
      targetValue: null,
      weightPercent: 15,
      direction: "HIGHER_IS_BETTER",
      benchmarkSource: "TURKEY_AVERAGE",
      capRatio: 1.2,
    });

    expect(result.actualRatio).toBe(1.48);
    expect(result.scoredRatio).toBe(1.2);
    expect(result.isCapped).toBe(true);
    expect(result.scoreContribution).toBe(18);
  });

  it("uses approved target for target achievement", () => {
    const result = service.scoreMetric({
      metricCode: "TARGET_ACHIEVEMENT",
      actualValue: 110000,
      benchmarkValue: null,
      targetValue: 100000,
      weightPercent: 40,
      direction: "HIGHER_IS_BETTER",
      benchmarkSource: "TARGET",
      capRatio: 1.2,
    });

    expect(result.actualRatio).toBe(1.1);
    expect(result.scoreContribution).toBe(44);
  });

  it("does not fabricate score when benchmark is missing", () => {
    const result = service.scoreMetric({
      metricCode: "ATV",
      actualValue: 4500,
      benchmarkValue: null,
      targetValue: null,
      weightPercent: 30,
      direction: "HIGHER_IS_BETTER",
      benchmarkSource: "TURKEY_AVERAGE",
      capRatio: 1.2,
    });

    expect(result.scoreStatus).toBe("missing_reference");
    expect(result.scoreContribution).toBeNull();
    expect(result.missingReason).toBe("benchmark_missing");
  });
});
