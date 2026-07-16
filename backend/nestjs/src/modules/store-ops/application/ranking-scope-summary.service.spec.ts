import { RankingService } from "./ranking.service";

describe("RankingService scope summary", () => {
  const period = {
    period_type: "monthly",
    period_start: "2026-03-01",
    period_end: "2026-03-31",
  };

  function storeRows(count: number) {
    return Array.from({ length: count }, (_, index) => {
      const ordinal = index + 1;

      return {
        store_id: `store-${String(ordinal).padStart(3, "0")}`,
        store_name: `Store ${String(ordinal).padStart(3, "0")}`,
        region_id: "region-1",
        region_name: "Region 1",
        region_manager_user_id: "regional-1",
        region_manager_name: "Region Manager",
        kpi_code: "TARGET_ACHIEVEMENT",
        kpi_name: "Hedef gerceklestirme orani",
        actual_value: String(130 - ordinal),
        achievement_rate: null,
        target_value: "100",
      };
    });
  }

  function personnelRows(count: number, assignedStoreIds: string[]) {
    return Array.from({ length: count }, (_, index) => {
      const ordinal = index + 1;
      const storeId = assignedStoreIds[index % assignedStoreIds.length];

      return {
        employee_id: `employee-${String(ordinal).padStart(3, "0")}`,
        first_name: `Personel${String(ordinal).padStart(3, "0")}`,
        last_name: "Test",
        store_id: storeId,
        store_name: storeId.replace("store-", "Store "),
        region_id: "region-1",
        region_name: "Region 1",
        region_manager_user_id: "regional-1",
        region_manager_name: "Region Manager",
        position_code: "SALES_ASSOCIATE",
        net_sales_value: "75000",
        store_net_sales_value: "1000000",
        kpi_code: "TARGET_ACHIEVEMENT",
        kpi_name: "Hedef gerceklestirme orani",
        actual_value: String(130 - ordinal),
        target_value: "100",
      };
    });
  }

  it("exposes active scope counts separately from KPI-row leaderboard populations", async () => {
    const assignedStoreIds = Array.from({ length: 30 }, (_, index) =>
      `store-${String(index + 1).padStart(3, "0")}`,
    );
    const reportingRepository = {
      resolveEmployeeIdForAuthIdentity: jest.fn(async () => null),
      getActiveStorePersonnelScopeSummary: jest.fn(async () => ({
        active_personnel_count: "150",
        store_count: "30",
      })),
      getActiveEmployeeAssignmentScopes: jest.fn(async (employeeIds: string[]) =>
        employeeIds.map((employeeId, index) => ({
          employee_id: employeeId,
          company_id: "company-1",
          region_id: "region-1",
          store_id: assignedStoreIds[index % assignedStoreIds.length],
        })),
      ),
      getEmployeeTurkeyBenchmarkValues: jest.fn(async () => []),
    };
    const rankingRepository = {
      getLatestRankingPeriod: jest.fn(async () => period),
      listRankingAvailablePeriods: jest.fn(async () => [period]),
      listRankingStoreKpiRows: jest.fn(async () => storeRows(29)),
      listRankingStoreChecklistRows: jest.fn(async () => []),
      listRankingPersonnelKpiRows: jest.fn(async () => personnelRows(126, assignedStoreIds)),
      listRankingFilterOptions: jest.fn(async () => ({
        regionManagers: [],
        regions: [],
        stores: [],
      })),
    };
    const service = new RankingService(
      reportingRepository as never,
      { getKpiConfigRows: jest.fn(async () => []) } as never,
      { getStoreTurkeyBenchmarkValues: jest.fn(async () => []) } as never,
      rankingRepository as never,
    );

    const result = await service.getRankings({
      userId: "regional-1",
      roleCodes: ["REGION_MANAGER"],
      companyIds: ["company-1"],
      regionIds: [],
      storeIds: [],
      assignedStoreIds,
      periodType: "monthly",
      regionManagerUserId: "regional-1",
      limit: 100,
      offset: 0,
    });

    expect(reportingRepository.getActiveStorePersonnelScopeSummary).toHaveBeenCalledWith({
      companyIds: [],
      regionIds: [],
      storeIds: assignedStoreIds,
    });
    expect(result.storeLeaderboard.meta.total).toBe(29);
    expect(result.personnelLeaderboard.meta.total).toBe(126);
    expect(result.scopeSummary).toEqual({
      activePersonnelCount: 150,
      storeCount: 30,
    });
  });
});
