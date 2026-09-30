import { SalesTargetIncentiveCalculatorService } from "./sales-target-incentive-calculator.service";

describe("V2 net incentive bases", () => {
  const calculator = new SalesTargetIncentiveCalculatorService();
  const personnel = (net: string, storeNet = "1000000") => calculator.calculatePersonnel({
    storeOwnershipType: "company", positionCode: "SALES_ASSOCIATE", storeTarget: "1000000",
    storeActualNetSales: storeNet, personnelTarget: "100000", personnelActualNetSales: net,
  });
  it("uses same-store attributed net for both the achievement bracket and payable base", () => {
    expect(personnel("90000")).toMatchObject({ ruleVersionCode: "sales-target-incentive-v2.0.0",
      achievementPct: "90.0000", rate: "0.0065", rawEarnedAmount: "585.000000", payableAmount: "585.00" });
  });
  it("keeps seller net above store net while the manager uses the receiving store's net", () => {
    expect(calculator.calculatePersonnel({ storeOwnershipType: "company", positionCode: "SALES_ASSOCIATE",
      storeTarget: "2000000", storeActualNetSales: "1950000", personnelTarget: "2000000", personnelActualNetSales: "2000000" }))
      .toMatchObject({ achievementPct: "100.0000", storeAchievementPct: "97.5000", rate: "0.0150", payableAmount: "30000.00" });
    expect(calculator.calculateManager({ storeOwnershipType: "company", storeTarget: "2000000", storeActualNetSales: "1950000" }))
      .toMatchObject({ achievementPct: "97.5000", rate: "0.0050", payableAmount: "9750.00" });
  });
  it("retains the 80% store gate even when a cross-store return leaves personnel net unchanged", () => {
    expect(personnel("120000", "799999")).toMatchObject({ achievementPct: "120.0000", storeGatePassed: false,
      personalRateBeforeGate: "0.0165", rate: "0.0000", payableAmount: "0.00" });
    expect(personnel("120000", "800000")).toMatchObject({ storeGatePassed: true, payableAmount: "1980.00" });
  });
  it("preserves negative net achievement with the existing zero-pay bracket", () => {
    expect(personnel("-20000")).toMatchObject({ achievementPct: "-20.0000", rate: "0.0000", payableAmount: "0.00" });
    expect(calculator.calculateManager({ storeOwnershipType: "company", storeTarget: "1000000", storeActualNetSales: "-20000" }))
      .toMatchObject({ achievementPct: "-2.0000", rate: "0.0000", payableAmount: "0.00" });
  });
});
