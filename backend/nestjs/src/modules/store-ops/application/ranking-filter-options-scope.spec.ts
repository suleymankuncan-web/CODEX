import { RankingService } from "./ranking.service";

describe("RankingService scoped filter options", () => {
  const period = {
    period_type: "monthly",
    period_start: "2026-06-01",
    period_end: "2026-06-30",
  };
  const stores = [
    {
      store_id: "store-1",
      store_name: "Assigned store",
      region_id: "region-1",
      region_name: "Assigned region",
      region_manager_user_id: "manager-1",
      region_manager_name: "Assigned manager",
      kpi_code: "TARGET_ACHIEVEMENT",
      kpi_name: "Target achievement",
      actual_value: "90",
      target_value: "100",
    },
    {
      store_id: "store-2",
      store_name: "Forbidden store",
      region_id: "region-2",
      region_name: "Forbidden region",
      region_manager_user_id: "manager-2",
      region_manager_name: "Forbidden manager",
      kpi_code: "TARGET_ACHIEVEMENT",
      kpi_name: "Target achievement",
      actual_value: "95",
      target_value: "100",
    },
  ];
  const personnel = stores.map((store, index) => ({
    employee_id: `employee-${index + 1}`,
    first_name: `Person ${index + 1}`,
    last_name: "Test",
    store_id: store.store_id,
    store_name: store.store_name,
    region_id: store.region_id,
    region_name: store.region_name,
    region_manager_user_id: store.region_manager_user_id,
    region_manager_name: store.region_manager_name,
    position_code: "SALES_ASSOCIATE",
    net_sales_value: "100",
    store_net_sales_value: "1000",
    kpi_code: store.kpi_code,
    kpi_name: store.kpi_name,
    actual_value: store.actual_value,
    target_value: store.target_value,
  }));

  function createService() {
    const reportingRepository = {
      resolveEmployeeIdForAuthIdentity: jest.fn(async () => null),
      getActiveStorePersonnelScopeSummary: jest.fn(async () => ({
        active_personnel_count: "0",
        store_count: "1",
      })),
      getActiveEmployeeAssignmentScopes: jest.fn(async () => personnel.map((person) => ({
        employee_id: person.employee_id,
        company_id: "company-1",
        region_id: person.region_id,
        store_id: person.store_id,
      }))),
      getEmployeeTurkeyBenchmarkValues: jest.fn(async () => []),
    };
    const rankingRepository = {
      getLatestRankingPeriod: jest.fn(async () => period),
      listRankingAvailablePeriods: jest.fn(async () => [period]),
      listRankingStoreKpiRows: jest.fn(async () => stores),
      listRankingStoreChecklistRows: jest.fn(async () => []),
      listRankingPersonnelKpiRows: jest.fn(async () => personnel),
      listRankingFilterOptions: jest.fn(async () => ({
        regionManagers: [
          { id: "manager-1", label: "Assigned manager", storeIds: ["store-1"] },
          { id: "manager-2", label: "Forbidden manager", storeIds: ["store-2"] },
          { id: "manager-3", label: "Manager without period KPI data", storeIds: [] },
        ],
        regions: [{ id: "region-2", label: "Forbidden region" }],
        stores: [{ id: "store-2", label: "Forbidden store" }],
      })),
    };
    const service = new RankingService(
      reportingRepository as never,
      { getKpiConfigRows: jest.fn(async () => []) } as never,
      { getStoreTurkeyBenchmarkValues: jest.fn(async () => []) } as never,
      rankingRepository as never,
    );

    return { rankingRepository, service };
  }

  it("EC-001 exposes only assigned Region Manager directory metadata", async () => {
    const { rankingRepository, service } = createService();

    const result = await service.getRankings({
      userId: "manager-1",
      roleCodes: ["REGION_MANAGER"],
      companyIds: ["company-1"],
      regionIds: [],
      storeIds: [],
      assignedStoreIds: ["store-1"],
      periodType: "monthly",
    });

    expect(result.filters).toEqual({
      regionManagers: [{ id: "manager-1", label: "Assigned manager" }],
      regions: [{ id: "region-1", label: "Assigned region" }],
      stores: [{ id: "store-1", label: "Assigned store" }],
    });
    expect(rankingRepository.listRankingFilterOptions).toHaveBeenCalledWith(expect.objectContaining({
      managerOnly: true,
      companyIds: ["company-1"],
    }));
  });

  it("EC-002 exposes only the Store Manager current-store metadata", async () => {
    const { rankingRepository, service } = createService();

    const result = await service.getRankings({
      userId: "store-manager-1",
      roleCodes: ["STORE_MANAGER"],
      companyIds: ["company-1"],
      regionIds: [],
      storeIds: ["store-1"],
      assignedStoreIds: [],
      periodType: "monthly",
    });

    expect(result.filters).toEqual({
      regionManagers: [{ id: "manager-1", label: "Assigned manager" }],
      regions: [{ id: "region-1", label: "Assigned region" }],
      stores: [{ id: "store-1", label: "Assigned store" }],
    });
    expect(rankingRepository.listRankingFilterOptions).not.toHaveBeenCalled();
  });

  it("scopes a Region Manager's selected peer to overlapping assigned stores in both lists", async () => {
    const { rankingRepository, service } = createService();
    rankingRepository.listRankingFilterOptions.mockResolvedValue({
      regionManagers: [
        { id: "manager-3", label: "Overlapping manager", storeIds: ["store-1", "store-2"] },
      ],
      regions: [],
      stores: [],
    });

    const result = await service.getRankings({
      userId: "manager-1",
      roleCodes: ["REGION_MANAGER"],
      companyIds: ["company-1"],
      regionIds: [],
      storeIds: [],
      assignedStoreIds: ["store-1"],
      regionManagerUserId: "manager-3",
      periodType: "monthly",
    });

    expect(result.filters.regionManagers).toEqual([{ id: "manager-3", label: "Overlapping manager" }]);
    expect(result.storeLeaderboard.items.map((row) => row.storeId)).toEqual(["store-1"]);
    expect(result.personnelLeaderboard.items.map((row) => row.employeeId)).toEqual(["employee-1"]);
  });

  it("shows every active company Region Manager to Report Viewer even without period KPI data", async () => {
    const { rankingRepository, service } = createService();

    const result = await service.getRankings({
      userId: "viewer-1",
      roleCodes: ["REPORT_VIEWER"],
      companyIds: ["company-1"],
      regionIds: [],
      storeIds: [],
      assignedStoreIds: [],
      periodType: "monthly",
    });

    expect(result.regionManagerLeaderboard.items.map((item) => item.userId)).toEqual([
      "manager-1",
      "manager-2",
      "manager-3",
    ]);
    expect(result.regionManagerLeaderboard.items[2]).toEqual(expect.objectContaining({
      averageScore: null,
      storeCount: 0,
    }));
    expect(result.filters.regionManagers).toHaveLength(3);
    expect(rankingRepository.listRankingFilterOptions).toHaveBeenCalledTimes(1);
  });

  it("filters a selected Report Viewer manager by direct store assignments", async () => {
    const { rankingRepository, service } = createService();
    rankingRepository.listRankingFilterOptions.mockResolvedValue({
      regionManagers: [
        { id: "manager-3", label: "Directly assigned manager", storeIds: ["store-2"] },
      ],
      regions: [],
      stores: [],
    });

    const result = await service.getRankings({
      userId: "viewer-1",
      roleCodes: ["REPORT_VIEWER"],
      companyIds: ["company-1"],
      regionIds: [],
      storeIds: [],
      assignedStoreIds: [],
      regionManagerUserId: "manager-3",
      periodType: "monthly",
    });

    expect(result.storeLeaderboard.items.map((item) => item.storeId)).toEqual(["store-2"]);
    expect(result.personnelLeaderboard.items.map((item) => item.employeeId)).toEqual(["employee-2"]);
    expect(result.regionManagerLeaderboard.items).toEqual([
      expect.objectContaining({
        averageScore: expect.any(Number),
        storeCount: 1,
        userId: "manager-3",
      }),
    ]);
  });

  it("filters both lists by manager assignments after computing Turkey ranks", async () => {
    const { rankingRepository, service } = createService();
    rankingRepository.listRankingFilterOptions.mockResolvedValue({
      regionManagers: [
        { id: "manager-3", label: "Directly assigned manager", storeIds: ["store-1"] },
      ],
      regions: [],
      stores: [],
    });

    const result = await service.getRankings({
      userId: "viewer-1",
      roleCodes: ["REPORT_VIEWER"],
      companyIds: ["company-1"],
      regionIds: [],
      storeIds: [],
      assignedStoreIds: [],
      regionManagerUserId: "manager-3",
      periodType: "monthly",
    });

    expect(result.storeLeaderboard.items).toEqual([
      expect.objectContaining({ storeId: "store-1", rank: 2, population: 2 }),
    ]);
    expect(result.personnelLeaderboard.items).toEqual([
      expect.objectContaining({ employeeId: "employee-1", rank: 2, population: 2 }),
    ]);
  });

  it("rejects an unknown manager filter instead of falling back to a stored region label", async () => {
    const { service } = createService();
    const result = await service.getRankings({
      userId: "viewer-1",
      roleCodes: ["REPORT_VIEWER"],
      companyIds: ["company-1"],
      regionIds: [],
      storeIds: [],
      assignedStoreIds: [],
      regionManagerUserId: "manager-unknown",
      periodType: "monthly",
    });
    expect(result.storeLeaderboard.items).toEqual([]);
    expect(result.personnelLeaderboard.items).toEqual([]);
  });
});
