import { resolvePersonnelRankingEligibility } from "./personnel-ranking-eligibility.contract";

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

  it("includes personnel with any recorded net sales value", () => {
    const result = resolvePersonnelRankingEligibility({
      positionCode: "SALES_CONSULTANT",
      netSalesValue: 1,
      storeNetSalesValue: 2_000_000,
    });

    expect(result).toMatchObject({
      isEligible: true,
      reason: "eligible",
      netSalesValue: 1,
    });
  });

  it("does not exclude personnel based on store sales share", () => {
    const result = resolvePersonnelRankingEligibility({
      positionCode: "SALES_CONSULTANT",
      netSalesValue: 1,
      storeNetSalesValue: 2_000_000,
    });

    expect(result).toMatchObject({
      isEligible: true,
      reason: "eligible",
    });
    expect(result.storeSalesShare).toBeCloseTo(0.0000005);
  });

  it("does not require store sales when personnel net sales is present", () => {
    const result = resolvePersonnelRankingEligibility({
      positionCode: "ASSISTANT_MANAGER",
      netSalesValue: 75_000,
      storeNetSalesValue: null,
    });

    expect(result).toMatchObject({
      isEligible: true,
      reason: "eligible",
      netSalesValue: 75_000,
      storeNetSalesValue: null,
      storeSalesShare: null,
    });
  });

  it("still excludes personnel without a net sales value", () => {
    const result = resolvePersonnelRankingEligibility({
      positionCode: "SALES_CONSULTANT",
      netSalesValue: null,
      storeNetSalesValue: 2_000_000,
    });

    expect(result).toMatchObject({
      isEligible: false,
      reason: "missing_net_sales",
    });
  });
});
