import { KpiBenchmarkScoringService } from "./kpi-benchmark-scoring.service";
import { PerformanceScoreEvaluator } from "./performance-score-evaluator.service";
import { personnelKpiScoreProfile, storeKpiScoreProfile } from "./kpi-config.contract";

const service = new KpiBenchmarkScoringService();
const base = { metricCode: "ATV", actualValue: 100, benchmarkValue: 100, targetValue: null, weightPercent: 100, direction: "HIGHER_IS_BETTER" as const, benchmarkSource: "TURKEY_AVERAGE" as const, capRatio: 1.2 };

describe("live reference 70 / ceiling 140 policy", () => {
  it.each([[0, 0], [50, 35], [100, 70], [150, 105], [200, 140], [300, 140], [-10, 0]])("scores actual %s as %s points", (actualValue, expected) => {
    expect(service.scoreLiveMetric({ ...base, actualValue }).scoreContribution).toBe(expected);
  });
  it("keeps raw ratios above the cap and preserves old snapshot scoring", () => {
    expect(service.scoreLiveMetric({ ...base, actualValue: 300 })).toMatchObject({ actualRatio: 3, scoredRatio: 2, capRatio: 2, isCapped: true, scoreContribution: 140 });
    expect(service.scoreMetric({ ...base, actualValue: 300 }).scoreContribution).toBe(120);
  });
  it.each([null, 0, NaN])("does not fabricate a score for missing/invalid reference %s", benchmarkValue => {
    expect(service.scoreLiveMetric({ ...base, benchmarkValue }).scoreContribution).toBeNull();
  });
  it("retains target semantics and raw checklist percentages", () => {
    expect(service.scoreLiveMetric({ ...base, metricCode: "TARGET_ACHIEVEMENT", benchmarkSource: "TARGET", targetValue: 50, benchmarkValue: 1000 }).scoreContribution).toBe(200);
    expect(service.scoreLiveMetric({ ...base, metricCode: "BM_CHECKLIST", actualValue: 80, benchmarkSource: "TARGET", targetValue: 100 })).toMatchObject({ actualValue: 80, actualRatio: .8, scoreContribution: 56 });
  });
  it.each([personnelKpiScoreProfile, storeKpiScoreProfile])("all reference values total 70 in $profileCode", profile => {
    const values = new Map(profile.metrics.map(metric => [metric.code, { label: metric.label, actualValue: 100, targetValue: 100 }]));
    const result = new PerformanceScoreEvaluator().evaluate({ profile, values, benchmarkLookup: new Map(profile.metrics.map(metric => [metric.code, 100])), benchmarkFallback: "matched-only", useStoreChecklistFallback: true });
    expect(result.scoreValue).toBe(70);
    expect(result.metrics.reduce((sum, metric) => sum + (metric.contributionValue ?? 0), 0)).toBe(70);
  });
  it("personnel at double reference score 140 and store missing checklists redistribute within the same ceiling", () => {
    for (const profile of [personnelKpiScoreProfile, storeKpiScoreProfile]) {
      const result = new PerformanceScoreEvaluator().evaluate({ profile, values: new Map(profile.metrics.filter(metric => !metric.code.includes("CHECKLIST")).map(metric => [metric.code, { label: metric.label, actualValue: 200, targetValue: 100 }])), benchmarkLookup: new Map(profile.metrics.map(metric => [metric.code, 100])), benchmarkFallback: "matched-only", useStoreChecklistFallback: true });
      expect(result.scoreValue).toBe(140);
    }
  });
});
