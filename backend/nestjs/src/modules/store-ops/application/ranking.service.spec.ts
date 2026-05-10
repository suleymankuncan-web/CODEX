import { RankingService } from "./ranking.service";

describe("RankingService", () => {
  const period = {
    period_type: "monthly",
    period_start: "2026-03-01",
    period_end: "2026-03-31",
  };

  function createStoreRows(count: number) {
    return Array.from({ length: count }, (_, index) => {
      const ordinal = index + 1;
      const regionId = ordinal % 2 === 0 ? "region-2" : "region-1";

      return {
        store_id: `store-${String(ordinal).padStart(3, "0")}`,
        store_name: `Store ${String(ordinal).padStart(3, "0")}`,
        region_id: regionId,
        region_name: regionId === "region-2" ? "Region 2" : "Region 1",
        region_manager_user_id:
          regionId === "region-2" ? "region-manager-2" : "region-manager-1",
        region_manager_name:
          regionId === "region-2" ? "Region Manager 2" : "Region Manager 1",
        kpi_code: "TARGET_ACHIEVEMENT",
        kpi_name: "Hedef gerceklestirme orani",
        actual_value: String(106 - ordinal),
        target_value: "100",
      };
    });
  }

  function createPersonnelRows(count: number) {
    return Array.from({ length: count }, (_, index) => {
      const ordinal = index + 1;
      const regionId = ordinal % 2 === 0 ? "region-2" : "region-1";
      const ownStoreOrdinal = ordinal <= 5 ? 1 : ordinal;

      return {
        employee_id: `employee-${String(ordinal).padStart(3, "0")}`,
        first_name: `Personel${String(ordinal).padStart(3, "0")}`,
        last_name: "Test",
        store_id: `store-${String(ownStoreOrdinal).padStart(3, "0")}`,
        store_name: `Store ${String(ownStoreOrdinal).padStart(3, "0")}`,
        region_id: regionId,
        region_name: regionId === "region-2" ? "Region 2" : "Region 1",
        region_manager_user_id:
          regionId === "region-2" ? "region-manager-2" : "region-manager-1",
        region_manager_name:
          regionId === "region-2" ? "Region Manager 2" : "Region Manager 1",
        kpi_code: "TARGET_ACHIEVEMENT",
        kpi_name: "Hedef gerceklestirme orani",
        actual_value: String(106 - ordinal),
        target_value: "100",
      };
    });
  }

  function createRepositoryMock(input?: {
    storeRows?: ReturnType<typeof createStoreRows>;
    personnelRows?: ReturnType<typeof createPersonnelRows>;
  }) {
    return {
      resolveEmployeeIdForAuthIdentity: jest.fn(async () => "employee-105"),
      getLatestMonthlyRankingPeriod: jest.fn(async () => period),
      listRankingAvailablePeriods: jest.fn(async () => [period]),
      listRankingStoreKpiRows: jest.fn(async () => input?.storeRows ?? createStoreRows(105)),
      listRankingPersonnelKpiRows: jest.fn(
        async () => input?.personnelRows ?? createPersonnelRows(105),
      ),
      getStoreTurkeyBenchmarkValues: jest.fn(async () => []),
      getEmployeeTurkeyBenchmarkValues: jest.fn(async () => []),
      listRankingFilterOptions: jest.fn(async () => ({
        regionManagers: [
          { id: "region-manager-1", label: "Region Manager 1" },
          { id: "region-manager-2", label: "Region Manager 2" },
        ],
        regions: [
          { id: "region-1", label: "Region 1" },
          { id: "region-2", label: "Region 2" },
        ],
        stores: [
          { id: "store-001", label: "Store 001" },
          { id: "store-002", label: "Store 002" },
        ],
      })),
    };
  }

  function createKpiConfigRepositoryMock() {
    return {
      getKpiConfigRows: jest.fn(async () => []),
    };
  }

  it("caps store personnel to Turkey Top 100 summary rows and includes own position outside the top list", async () => {
    const repository = createRepositoryMock();
    const service = new RankingService(
      repository as never,
      createKpiConfigRepositoryMock() as never,
    );

    const result = await service.getRankings({
      userId: "user-1",
      employeeId: "employee-105",
      roleCodes: ["STORE_PERSONNEL"],
      companyIds: [],
      regionIds: [],
      storeIds: [],
      assignedStoreIds: ["store-105"],
      periodType: "monthly",
      limit: 500,
      offset: 250,
    });

    expect(result.access).toEqual({
      globalMode: "top100",
      canSeeGlobalDetails: false,
      canSeeManagedStorePersonnelDetails: false,
    });
    expect(result.storeLeaderboard.items).toHaveLength(100);
    expect(result.personnelLeaderboard.items).toHaveLength(100);
    expect(result.personnelLeaderboard.currentEmployee).toEqual(
      expect.objectContaining({
        employeeId: "employee-105",
        rank: 105,
        visibility: "summary",
      }),
    );
    expect(result.personnelLeaderboard.currentEmployee).not.toHaveProperty("metrics");
    expect(result.storeLeaderboard.items[0]).not.toHaveProperty("metrics");
    expect(result.personnelLeaderboard.items[0]).not.toHaveProperty("metrics");
  });

  it("keeps store manager global rankings summary-only while exposing own-store personnel details", async () => {
    const repository = createRepositoryMock();
    const service = new RankingService(
      repository as never,
      createKpiConfigRepositoryMock() as never,
    );

    const result = await service.getRankings({
      userId: "manager-1",
      roleCodes: ["STORE_MANAGER"],
      companyIds: [],
      regionIds: [],
      storeIds: ["store-001"],
      assignedStoreIds: ["store-001"],
      periodType: "monthly",
    });

    expect(result.access.globalMode).toBe("top100");
    expect(result.personnelLeaderboard.items[0]).not.toHaveProperty("metrics");
    expect(result.personnelLeaderboard.managedStorePersonnel).toHaveLength(5);
    expect(result.personnelLeaderboard.managedStorePersonnel[0]).toEqual(
      expect.objectContaining({
        storeId: "store-001",
        visibility: "detail",
        metrics: expect.arrayContaining([
          expect.objectContaining({
            code: "TARGET_ACHIEVEMENT",
            actualValue: 105,
            targetValue: 100,
          }),
        ]),
      }),
    );
  });

  it("lets privileged roles page through full Turkey rankings with detail metrics", async () => {
    const repository = createRepositoryMock();
    const service = new RankingService(
      repository as never,
      createKpiConfigRepositoryMock() as never,
    );

    const result = await service.getRankings({
      userId: "regional-1",
      roleCodes: ["REGION_MANAGER"],
      companyIds: [],
      regionIds: [],
      storeIds: [],
      assignedStoreIds: [],
      periodType: "monthly",
      limit: 50,
      offset: 10,
    });

    expect(result.access).toEqual({
      globalMode: "full",
      canSeeGlobalDetails: true,
      canSeeManagedStorePersonnelDetails: true,
    });
    expect(result.storeLeaderboard.meta).toEqual({
      total: 105,
      limit: 50,
      offset: 10,
    });
    expect(result.storeLeaderboard.items).toHaveLength(50);
    expect(result.storeLeaderboard.items[0]).toEqual(
      expect.objectContaining({
        rank: 11,
        visibility: "detail",
        metrics: expect.arrayContaining([
          expect.objectContaining({ code: "TARGET_ACHIEVEMENT" }),
        ]),
      }),
    );
    expect(result.personnelLeaderboard.items[0]).toHaveProperty("metrics");
  });

  it("sorts privileged rankings across the full filtered population before pagination", async () => {
    const storeRows = [
      {
        ...createStoreRows(1)[0],
        store_id: "store-high",
        actual_value: "240",
        target_value: "100",
      },
      {
        ...createStoreRows(1)[0],
        store_id: "store-low",
        actual_value: "50",
        target_value: "100",
      },
      {
        ...createStoreRows(1)[0],
        store_id: "store-mid",
        actual_value: "110",
        target_value: "100",
      },
    ];
    const personnelRows = [
      {
        ...createPersonnelRows(1)[0],
        employee_id: "employee-high",
        actual_value: "220",
        target_value: "100",
      },
      {
        ...createPersonnelRows(1)[0],
        employee_id: "employee-low",
        actual_value: "40",
        target_value: "100",
      },
      {
        ...createPersonnelRows(1)[0],
        employee_id: "employee-mid",
        actual_value: "105",
        target_value: "100",
      },
    ];
    const repository = createRepositoryMock({ storeRows, personnelRows });
    const service = new RankingService(
      repository as never,
      createKpiConfigRepositoryMock() as never,
    );

    const result = await service.getRankings({
      userId: "regional-1",
      roleCodes: ["REGION_MANAGER"],
      companyIds: [],
      regionIds: [],
      storeIds: [],
      assignedStoreIds: [],
      periodType: "monthly",
      sortKey: "TARGET_ACHIEVEMENT",
      sortDirection: "asc",
      limit: 1,
      offset: 0,
    });

    expect(result.storeLeaderboard.items).toHaveLength(1);
    expect(result.storeLeaderboard.items[0]).toEqual(
      expect.objectContaining({
        storeId: "store-low",
        rank: 3,
      }),
    );
    expect(result.personnelLeaderboard.items).toHaveLength(1);
    expect(result.personnelLeaderboard.items[0]).toEqual(
      expect.objectContaining({
        employeeId: "employee-low",
        rank: 3,
      }),
    );
  });

  it("returns Turkey reference metrics even when low roles receive summary-only ranking rows", async () => {
    const repository = createRepositoryMock();
    const service = new RankingService(
      repository as never,
      createKpiConfigRepositoryMock() as never,
    );

    const result = await service.getRankings({
      userId: "personnel-1",
      employeeId: "employee-105",
      roleCodes: ["STORE_PERSONNEL"],
      companyIds: [],
      regionIds: [],
      storeIds: [],
      assignedStoreIds: ["store-105"],
      periodType: "monthly",
    });

    expect(result.storeLeaderboard.items[0]).not.toHaveProperty("metrics");
    expect(result.personnelLeaderboard.items[0]).not.toHaveProperty("metrics");
    expect(result.reference.store.averageScore).toBeGreaterThan(0);
    expect(result.reference.store.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "TARGET_ACHIEVEMENT",
          value: expect.any(Number),
        }),
      ]),
    );
    expect(result.reference.personnel.averageScore).toBeGreaterThan(0);
  });

  it("applies privileged filters without recomputing Turkey ranks", async () => {
    const repository = createRepositoryMock();
    const service = new RankingService(
      repository as never,
      createKpiConfigRepositoryMock() as never,
    );

    const result = await service.getRankings({
      userId: "super-admin-1",
      roleCodes: ["SUPER_ADMIN"],
      companyIds: [],
      regionIds: [],
      storeIds: [],
      assignedStoreIds: [],
      periodType: "monthly",
      regionId: "region-2",
      limit: 10,
    });

    expect(result.storeLeaderboard.items).toHaveLength(10);
    expect(
      result.storeLeaderboard.items.every(
        (row: { regionId: string | null }) => row.regionId === "region-2",
      ),
    ).toBe(true);
    expect(result.storeLeaderboard.items[0]).toEqual(
      expect.objectContaining({
        storeId: "store-002",
        rank: 2,
      }),
    );
    expect(
      result.personnelLeaderboard.items.every(
        (row: { regionId: string | null }) => row.regionId === "region-2",
      ),
    ).toBe(true);
  });
});
