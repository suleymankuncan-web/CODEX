import { RankingService } from "./ranking.service";

describe("ranking published weights", () => {
  it("refreshes both live profiles on the next read without rewriting facts", async () => {
    const profile = (profileCode: string, weightPercent: number) => ({
      config_key: `${profileCode}_profile`,
      config_payload: {
        profileCode, title: profileCode, summary: "test", futureMetricRule: "test",
        metrics: [
          { code: "TARGET_ACHIEVEMENT", weightPercent, benchmarkSource: "TARGET" },
          { code: "ATV", weightPercent: 100 - weightPercent, benchmarkSource: "TURKEY_AVERAGE" },
        ].map(metric => ({ ...metric, label: metric.code, ownerRole: "STORE_MANAGER",
          scoreBehavior: "score_only", direction: "HIGHER_IS_BETTER", capRatio: 1.2 })),
      },
    });
    const config = { getKpiConfigRows: jest.fn(async () => [profile("store", 40), profile("personnel", 40)]) };
    const rows = ["TARGET_ACHIEVEMENT", "ATV"].map(kpi_code => ({
      store_id: "store", store_name: "Store", region_id: null, region_name: null,
      region_manager_user_id: null, region_manager_name: null,
      kpi_code, kpi_name: kpi_code, actual_value: "100", target_value: "100",
    }));
    const repository = {
      resolveEmployeeIdForAuthIdentity: jest.fn(async () => null),
      getActiveStorePersonnelScopeSummary: jest.fn(async () => ({ active_personnel_count: "1", store_count: "1" })),
      listRankingAvailablePeriods: jest.fn(async () => []),
      listRankingStoreKpiRows: jest.fn(async () => rows),
      listRankingStoreChecklistRows: jest.fn(async () => []),
      listRankingPersonnelKpiRows: jest.fn(async () => rows.map(row => ({ ...row,
        employee_id: "employee", first_name: "Person", last_name: "Test", position_code: "SALES_ASSOCIATE",
        net_sales_value: "100", store_net_sales_value: "100",
      }))),
      getStoreTurkeyBenchmarkValues: jest.fn(async () => [{ kpi_code: "ATV", benchmark_value: "100" }]),
      getEmployeeTurkeyBenchmarkValues: jest.fn(async () => [{ kpi_code: "ATV", benchmark_value: "100" }]),
      listRankingFilterOptions: jest.fn(async () => ({ regionManagers: [], regions: [], stores: [] })),
      getActiveEmployeeAssignmentScopes: jest.fn(async () => [{ employee_id: "employee",
        company_id: "company", store_id: "store", store_name: "Store", region_id: null, region_name: null }]),
    };
    const service = new RankingService(repository as never, config as never, repository as never, repository as never);
    const input = { userId: "viewer", roleCodes: ["REPORT_VIEWER"], companyIds: ["company"],
      regionIds: [], storeIds: [], assignedStoreIds: [], periodType: "daily" as const,
      periodStart: "2026-09-01", periodEnd: "2026-09-02" };
    const before = await service.getRankings(input);
    expect(before.storeLeaderboard.items[0].scoreValue).toBe(82);
    expect(before.personnelLeaderboard.items[0].scoreValue).toBe(82);

    config.getKpiConfigRows.mockResolvedValue([profile("store", 30), profile("personnel", 50)]);
    const after = await service.getRankings(input);
    expect(after.storeLeaderboard.items[0].scoreValue).toBe(79);
    expect(after.personnelLeaderboard.items[0].scoreValue).toBe(85);
    expect(config.getKpiConfigRows).toHaveBeenCalledTimes(2);
    expect(rows.map(row => row.actual_value)).toEqual(["100", "100"]);
  });
});
