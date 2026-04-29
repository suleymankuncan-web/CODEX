import { StoreScoreBlendService } from "./store-score-blend.service";

describe("StoreScoreBlendService", () => {
  const service = new StoreScoreBlendService();
  const activeConfig = {
    kpiPerformanceWeight: 90,
    bmChecklistWeight: 5,
    vmChecklistWeight: 5,
    missingWeightPolicy: "return_missing_weight_to_kpi" as const,
  };

  it("blends KPI, BM, and VM at 90/5/5 when both checklists are completed", () => {
    const result = service.calculateMonthlyStoreScore({
      monthlyKpiScore: 100,
      bmChecklist: { score: 80, visitCount: 1 },
      vmChecklist: { score: 100, visitCount: 1 },
      config: activeConfig,
    });

    expect(result.totalScore).toBe(99);
    expect(result.configuredWeights).toEqual({
      kpiPerformanceWeight: 90,
      bmChecklistWeight: 5,
      vmChecklistWeight: 5,
    });
    expect(result.effectiveWeights).toEqual({
      kpiPerformanceWeight: 90,
      bmChecklistWeight: 5,
      vmChecklistWeight: 5,
    });
    expect(result.components.kpi.contribution).toBe(90);
    expect(result.components.bmChecklist.contribution).toBe(4);
    expect(result.components.vmChecklist.contribution).toBe(5);
  });

  it("returns missing VM weight to KPI when BM is completed and VM is missing", () => {
    const result = service.calculateMonthlyStoreScore({
      monthlyKpiScore: 100,
      bmChecklist: { score: 80, visitCount: 1 },
      vmChecklist: null,
      config: activeConfig,
    });

    expect(result.totalScore).toBe(99);
    expect(result.effectiveWeights).toEqual({
      kpiPerformanceWeight: 95,
      bmChecklistWeight: 5,
      vmChecklistWeight: 0,
    });
    expect(result.components.vmChecklist).toEqual({
      included: false,
      score: null,
      weight: 0,
      contribution: null,
      visitCount: 0,
      status: "not_included",
      missingReason: "vm_checklist_not_completed_for_period",
    });
  });

  it("returns missing BM weight to KPI when VM is completed and BM is missing", () => {
    const result = service.calculateMonthlyStoreScore({
      monthlyKpiScore: 100,
      bmChecklist: null,
      vmChecklist: { score: 90, visitCount: 1 },
      config: activeConfig,
    });

    expect(result.totalScore).toBe(99.5);
    expect(result.effectiveWeights).toEqual({
      kpiPerformanceWeight: 95,
      bmChecklistWeight: 0,
      vmChecklistWeight: 5,
    });
    expect(result.components.bmChecklist.missingReason).toBe(
      "bm_checklist_not_completed_for_period",
    );
  });

  it("uses KPI at 100 percent when both checklist components are missing", () => {
    const result = service.calculateMonthlyStoreScore({
      monthlyKpiScore: 100,
      bmChecklist: null,
      vmChecklist: null,
      config: activeConfig,
    });

    expect(result.totalScore).toBe(100);
    expect(result.effectiveWeights).toEqual({
      kpiPerformanceWeight: 100,
      bmChecklistWeight: 0,
      vmChecklistWeight: 0,
    });
  });

  it("keeps total score null when monthly KPI score is missing", () => {
    const result = service.calculateMonthlyStoreScore({
      monthlyKpiScore: null,
      bmChecklist: { score: 80, visitCount: 1 },
      vmChecklist: { score: 90, visitCount: 1 },
      config: activeConfig,
    });

    expect(result.totalScore).toBeNull();
    expect(result.components.kpi.status).toBe("missing_reference");
    expect(result.components.kpi.missingReason).toBe("monthly_kpi_score_missing");
    expect(result.components.bmChecklist.status).toBe("included");
    expect(result.components.vmChecklist.status).toBe("included");
    expect(result.components.bmChecklist.contribution).toBeNull();
    expect(result.components.vmChecklist.contribution).toBeNull();
  });
});
