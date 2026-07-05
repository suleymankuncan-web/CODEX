import { RankingService } from "./ranking.service";

describe("RankingService display labels", () => {
  function createRepositoryMock() {
    return {
      resolveEmployeeIdForAuthIdentity: jest.fn(async () => null),
      getActiveEmployeeAssignmentScope: jest.fn(async () => null),
      getActiveEmployeeAssignmentScopes: jest.fn(async () => []),
      getActiveStorePersonnelScopeSummary: jest.fn(async () => ({
        active_personnel_count: "1",
        store_count: "1",
      })),
      getEmployeeTurkeyBenchmarkValues: jest.fn(async () => []),
      getStoreTurkeyBenchmarkValues: jest.fn(async () => []),
      getLatestRankingPeriod: jest.fn(async () => ({
        period_type: "monthly",
        period_start: "2026-03-01",
        period_end: "2026-03-31",
      })),
      listRankingAvailablePeriods: jest.fn(async () => [
        {
          period_type: "monthly",
          period_start: "2026-03-01",
          period_end: "2026-03-31",
        },
      ]),
      listRankingStoreKpiRows: jest.fn(async () => []),
      listRankingStoreChecklistRows: jest.fn(async () => []),
      listRankingPersonnelKpiRows: jest.fn(async () => [
        {
          employee_id: "employee-001",
          first_name: "",
          last_name: "   ",
          store_id: "store-001",
          store_name: "Store 001",
          region_id: "region-1",
          region_name: "Region 1",
          region_manager_user_id: "region-manager-1",
          region_manager_name: "Region Manager 1",
          position_code: "SALES_ASSOCIATE",
          net_sales_value: "75000",
          store_net_sales_value: "1000000",
          kpi_code: "TARGET_ACHIEVEMENT",
          kpi_name: "Hedef gerceklestirme orani",
          actual_value: "100",
          target_value: "100",
        },
      ]),
      listRankingFilterOptions: jest.fn(async () => ({
        regionManagers: [],
        regions: [],
        stores: [],
      })),
    };
  }

  it("uses product-safe personnel labels when imported names are missing", async () => {
    const repository = createRepositoryMock();
    const service = new RankingService(
      repository as never,
      { getKpiConfigRows: jest.fn(async () => []) } as never,
      repository as never,
      repository as never,
    );

    const result = await service.getRankings({
      userId: "regional-1",
      roleCodes: ["REGION_MANAGER"],
      companyIds: [],
      regionIds: [],
      storeIds: [],
      assignedStoreIds: [],
      periodType: "monthly",
      limit: 10,
      offset: 0,
    });

    expect(result.personnelLeaderboard.items[0]).toEqual(
      expect.objectContaining({
        employeeId: "employee-001",
        displayName: "Personel bilgisi eksik",
      }),
    );
  });
});
