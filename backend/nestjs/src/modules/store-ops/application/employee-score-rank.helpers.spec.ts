import { KpiBenchmarkScoringService } from "./kpi-benchmark-scoring.service";
import { buildOfficialEmployeeScoreRankContext } from "./employee-score-rank.helpers";
import type { KpiScoreProfile } from "./kpi-config.contract";

describe("buildOfficialEmployeeScoreRankContext", () => {
  const profile: KpiScoreProfile = {
    profileCode: "personnel",
    title: "Personnel score profile",
    summary: "Test profile",
    metrics: [
      {
        code: "TARGET_ACHIEVEMENT",
        label: "Hedef gerceklestirme orani",
        weightPercent: 100,
        ownerRole: "STORE_PERSONNEL",
        scoreBehavior: "score_only",
        benchmarkSource: "TARGET",
        capRatio: 1,
      },
    ],
    futureMetricRule: "Test profile only.",
  };
  const scoringService = new KpiBenchmarkScoringService();

  it("keeps every non-manager personnel row with recorded sales", () => {
    const rows = [
      row("employee-manager", "STORE_MANAGER", "500000", "1000000", "store-1"),
      row("employee-low-sales", "SALES_ASSOCIATE", "49999", "1000000", "store-1"),
      row("employee-low-share", "SALES_ASSOCIATE", "50000", "3000000", "store-1"),
      row("employee-official", "ASSISTANT_MANAGER", "75000", "1000000", "store-1"),
    ];

    const result = buildOfficialEmployeeScoreRankContext({
      rows,
      profile,
      benchmarkLookup: new Map(),
      scoringService,
      storeId: "store-1",
      regionId: "region-1",
    });

    expect(result.turkeyScores.map((item) => item.employeeId)).toEqual([
      "employee-low-sales",
      "employee-low-share",
      "employee-official",
    ]);
    expect(result.storeScores).toHaveLength(3);
    expect(result.regionScores).toHaveLength(3);
    expect(result.officialRows.map((item) => item.employee_id)).toEqual([
      "employee-low-sales",
      "employee-low-share",
      "employee-official",
    ]);
  });

  it("breaks tied official scores by underlying target achievement strength", () => {
    const rows = [
      row("employee-lower-ratio", "SALES_ASSOCIATE", "90000", "1000000", "store-1", "125", "100"),
      row("employee-higher-ratio", "SALES_ASSOCIATE", "90000", "1000000", "store-1", "150", "100"),
    ];

    const result = buildOfficialEmployeeScoreRankContext({
      rows,
      profile,
      benchmarkLookup: new Map(),
      scoringService,
      storeId: "store-1",
      regionId: "region-1",
    });

    expect(result.turkeyScores.map((item) => item.employeeId)).toEqual([
      "employee-higher-ratio",
      "employee-lower-ratio",
    ]);
  });
});

function row(
  employeeId: string,
  positionCode: string,
  netSalesValue: string,
  storeNetSalesValue: string,
  storeId: string,
  actualValue = "100",
  targetValue = "100",
) {
  return {
    employee_id: employeeId,
    store_id: storeId,
    region_id: "region-1",
    position_code: positionCode,
    net_sales_value: netSalesValue,
    store_net_sales_value: storeNetSalesValue,
    kpi_code: "TARGET_ACHIEVEMENT",
    actual_value: actualValue,
    target_value: targetValue,
  };
}
