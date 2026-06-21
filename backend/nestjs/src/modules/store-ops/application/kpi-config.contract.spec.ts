import {
  kpiOwnershipMatrix,
  storeKpiScoreProfile,
  type KpiScoreProfileMetric,
} from "./kpi-config.contract";

function assertStoreWeightTotal(metrics: Pick<KpiScoreProfileMetric, "weightPercent">[]) {
  const total = metrics.reduce((sum, metric) => sum + metric.weightPercent, 0);
  if (total !== 100) {
    throw new Error(`Store KPI score profile total must be 100; received ${total}`);
  }
}

describe("kpi config contract", () => {
  it("keeps the default store score profile weights aligned with GSM_ONAY", () => {
    const weights = new Map(
      storeKpiScoreProfile.metrics.map((metric) => [metric.code, metric.weightPercent]),
    );

    expect(weights).toEqual(
      new Map([
        ["TARGET_ACHIEVEMENT", 35],
        ["CR", 20],
        ["ATV", 15],
        ["UPT", 15],
        ["BM_CHECKLIST", 5],
        ["VM_CHECKLIST", 5],
        ["GSM_ONAY", 5],
      ]),
    );
    expect(() => assertStoreWeightTotal(storeKpiScoreProfile.metrics)).not.toThrow();
  });

  it("fails loudly when the store profile total drifts away from 100", () => {
    expect(() =>
      assertStoreWeightTotal([
        ...storeKpiScoreProfile.metrics,
        { weightPercent: 1 },
      ]),
    ).toThrow("Store KPI score profile total must be 100");
  });

  it("exposes GSM_ONAY to store-level operators without making it a task source", () => {
    expect(kpiOwnershipMatrix).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "GSM_ONAY",
          visibleTo: ["DEPUTY_GM", "REGION_MANAGER", "STORE_MANAGER"],
          contributesTo: ["store"],
          taskCandidate: false,
        }),
      ]),
    );
  });
});
