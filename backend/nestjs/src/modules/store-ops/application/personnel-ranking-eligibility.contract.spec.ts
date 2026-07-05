import {
  officialPersonnelRankingMinimumNetSalesValue,
  officialPersonnelRankingMinimumStoreSalesShare,
  resolvePersonnelRankingEligibility,
} from "./personnel-ranking-eligibility.contract";

describe("resolvePersonnelRankingEligibility", () => {
  it("excludes store managers from official personnel rankings", () => {
    const result = resolvePersonnelRankingEligibility({
      positionCode: "STORE_MANAGER",
      netSalesValue: 500_000,
      storeNetSalesValue: 2_000_000,
    });

    expect(result).toMatchObject({
      isEligible: false,
      reason: "store_manager_excluded",
    });
  });

  it("requires at least 50.000 TL monthly net sales", () => {
    const result = resolvePersonnelRankingEligibility({
      positionCode: "SALES_CONSULTANT",
      netSalesValue: officialPersonnelRankingMinimumNetSalesValue - 1,
      storeNetSalesValue: 2_000_000,
    });

    expect(result).toMatchObject({
      isEligible: false,
      reason: "below_minimum_net_sales",
    });
  });

  it("requires at least 2% store net sales share", () => {
    const result = resolvePersonnelRankingEligibility({
      positionCode: "SALES_CONSULTANT",
      netSalesValue: 50_000,
      storeNetSalesValue:
        50_000 / officialPersonnelRankingMinimumStoreSalesShare + 1,
    });

    expect(result).toMatchObject({
      isEligible: false,
      reason: "below_minimum_store_share",
    });
    expect(result.storeSalesShare).toBeLessThan(
      officialPersonnelRankingMinimumStoreSalesShare,
    );
  });

  it("marks non-manager personnel eligible when both monthly thresholds pass", () => {
    const result = resolvePersonnelRankingEligibility({
      positionCode: "ASSISTANT_MANAGER",
      netSalesValue: 75_000,
      storeNetSalesValue: 2_000_000,
    });

    expect(result).toMatchObject({
      isEligible: true,
      reason: "eligible",
      netSalesValue: 75_000,
      storeNetSalesValue: 2_000_000,
    });
    expect(result.storeSalesShare).toBeCloseTo(0.0375);
  });
});
