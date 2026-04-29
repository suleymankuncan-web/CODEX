import { StoreScoreBlendService } from "./store-score-blend.service";

describe("StoreScoreBlendService", () => {
  const service = new StoreScoreBlendService();

  it("blends monthly KPI score with completed BM checklist at 95/5", () => {
    const result = service.calculateMonthlyStoreScore({
      monthlyKpiScore: 108,
      bmChecklist: { score: 80, visitCount: 2 },
      config: { kpiPerformanceWeight: 95, bmChecklistWeight: 5, vmChecklistWeight: 0 },
    });

    expect(result.totalScore).toBe(106.6);
    expect(result.components.kpi.contribution).toBe(102.6);
    expect(result.components.bmChecklist.contribution).toBe(4);
    expect(result.components.bmChecklist.status).toBe("included");
  });

  it("does not penalize missing BM checklist", () => {
    const result = service.calculateMonthlyStoreScore({
      monthlyKpiScore: 108,
      bmChecklist: null,
      config: { kpiPerformanceWeight: 95, bmChecklistWeight: 5, vmChecklistWeight: 0 },
    });

    expect(result.totalScore).toBe(108);
    expect(result.components.kpi.weight).toBe(100);
    expect(result.components.kpi.contribution).toBe(108);
    expect(result.components.bmChecklist.included).toBe(false);
    expect(result.components.bmChecklist.status).toBe("not_included");
  });

  it("keeps inactive VM checklist from reducing the score", () => {
    const result = service.calculateMonthlyStoreScore({
      monthlyKpiScore: 100,
      bmChecklist: { score: 100, visitCount: 1 },
      config: { kpiPerformanceWeight: 95, bmChecklistWeight: 5, vmChecklistWeight: 0 },
    });

    expect(result.totalScore).toBe(100);
    expect(result.components.vmChecklist.status).toBe("future_inactive");
  });
});
