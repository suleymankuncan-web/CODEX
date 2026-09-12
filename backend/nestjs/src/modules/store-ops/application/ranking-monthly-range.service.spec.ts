import { RankingService } from "./ranking.service";

describe("RankingService aggregated periods", () => {
  const month = { period_type: "monthly", period_start: "2026-09-01", period_end: "2026-09-30", uses_daily_components: true };
  const input = { userId: "viewer", roleCodes: ["REPORT_VIEWER"], companyIds: ["company"], regionIds: [], storeIds: [], assignedStoreIds: [], periodType: "monthly" as const, periodStart: "2026-09-01" };
  function fixture() {
    const repository = {
      resolveEmployeeIdForAuthIdentity: jest.fn(async () => null),
      getActiveStorePersonnelScopeSummary: jest.fn(async () => ({ active_personnel_count: "0", store_count: "2" })),
      getLatestRankingPeriod: jest.fn(async () => month),
      listRankingAvailablePeriods: jest.fn(async () => [month]),
      listRankingStoreKpiRows: jest.fn(async () => [100, 300].map((actual, index) => ({ store_id: `store-${index}`, store_name: `Store ${index}`, region_id: null, region_name: null, region_manager_user_id: null, region_manager_name: null, kpi_code: "ATV", kpi_name: "ATV", actual_value: String(actual), target_value: null }))),
      listRankingStoreChecklistRows: jest.fn(async () => []),
      listRankingPersonnelKpiRows: jest.fn(async () => []),
      getStoreTurkeyBenchmarkValues: jest.fn(async () => [{ kpi_code: "ATV", benchmark_value: "100" }]),
      getEmployeeTurkeyBenchmarkValues: jest.fn(async () => []),
      listRankingFilterOptions: jest.fn(async () => ({ regionManagers: [], regions: [], stores: [] })),
      getActiveEmployeeAssignmentScopes: jest.fn(async () => []),
    };
    const config = { getKpiConfigRows: jest.fn(async () => [{ config_key: "store_profile", config_payload: {
      profileCode: "store", title: "Store", summary: "Test profile", futureMetricRule: "test",
      metrics: [{ code: "ATV", label: "ATV", weightPercent: 100, ownerRole: "STORE_MANAGER", scoreBehavior: "score_only", direction: "HIGHER_IS_BETTER", benchmarkSource: "TURKEY_AVERAGE", capRatio: 1.2 }],
    } }]) };
    return { repository, service: new RankingService(repository as never, config as never, repository as never, repository as never) };
  }
  it("routes full months with daily facts through all aggregate reads and recomputes baseline70/cap140 ranks", async () => {
    const { service, repository } = fixture();
    const result = await service.getRankings(input);
    expect(result.source).toEqual({ mode: "live", periodType: "monthly", periodStart: "2026-09-01", periodEnd: "2026-09-30" });
    for (const read of [repository.listRankingStoreKpiRows, repository.listRankingPersonnelKpiRows, repository.getStoreTurkeyBenchmarkValues, repository.getEmployeeTurkeyBenchmarkValues]) {
      expect(read).toHaveBeenCalledWith(expect.objectContaining({ isRange: true, periodStart: "2026-09-01", periodEnd: "2026-09-30" }));
    }
    expect(result.storeLeaderboard.items.map(row => [row.storeId, row.scoreValue, row.rank])).toEqual([["store-1", 140, 1], ["store-0", 70, 2]]);
  });
  it("uses explicit inclusive bounds without looking up or substituting a snapshot", async () => {
    const { service, repository } = fixture();
    const result = await service.getRankings({ ...input, periodType: "daily", periodStart: "2026-08-31", periodEnd: "2026-09-02" });
    expect(repository.getLatestRankingPeriod).not.toHaveBeenCalled();
    expect(result.source).toEqual({ mode: "live", periodType: "daily", periodStart: "2026-08-31", periodEnd: "2026-09-02" });
    expect(repository.getEmployeeTurkeyBenchmarkValues).toHaveBeenCalledWith(expect.objectContaining({ isRange: true, periodStart: "2026-08-31", periodEnd: "2026-09-02" }));
  });
  it("retains both dates when scope fails closed before any data read", async () => {
    const { service, repository } = fixture();
    const result = await service.getRankings({ ...input, companyIds: [], periodType: "daily", periodStart: "2026-08-31", periodEnd: "2026-09-02" });
    expect(result.source.periodEnd).toBe("2026-09-02");
    expect(result.storeLeaderboard.items).toEqual([]);
    expect(repository.listRankingStoreKpiRows).not.toHaveBeenCalled();
  });

});
