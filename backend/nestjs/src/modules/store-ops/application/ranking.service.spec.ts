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
        achievement_rate: null,
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
        achievement_rate: null,
        target_value: "100",
      };
    });
  }

  type StoreRankingFixtureRow = Omit<
    ReturnType<typeof createStoreRows>[number],
    "target_value" | "achievement_rate"
  > & { target_value: string | null; achievement_rate?: string | null };
  type PersonnelRankingFixtureRow = Omit<
    ReturnType<typeof createPersonnelRows>[number],
    "target_value"
  > & { target_value: string | null };

  function createRepositoryMock(input?: {
    storeRows?: StoreRankingFixtureRow[];
    storeChecklistRows?: StoreRankingFixtureRow[];
    personnelRows?: PersonnelRankingFixtureRow[];
    period?: typeof period;
    storeBenchmarkRows?: Array<{ kpi_code: string; benchmark_value: string | null }>;
    personnelBenchmarkRows?: Array<{ kpi_code: string; benchmark_value: string | null }>;
  }) {
    const resolveActiveAssignment = (employeeId: string) => {
      const match = /^employee-(\d+)$/.exec(employeeId);
      if (!match) {
        return null;
      }

      const ordinal = Number(match[1]);
      const regionId = ordinal % 2 === 0 ? "region-2" : "region-1";
      const ownStoreOrdinal = ordinal <= 5 ? 1 : ordinal;

      return {
        employee_id: employeeId,
        external_employee_ref: null,
        first_name: `Personel${String(ordinal).padStart(3, "0")}`,
        last_name: "Test",
        company_id: "company-1",
        region_id: regionId,
        region_name: regionId === "region-2" ? "Region 2" : "Region 1",
        store_id: `store-${String(ownStoreOrdinal).padStart(3, "0")}`,
        store_name: `Store ${String(ownStoreOrdinal).padStart(3, "0")}`,
      };
    };

    return {
      resolveEmployeeIdForAuthIdentity: jest.fn(async () => "employee-105"),
      getActiveEmployeeAssignmentScope: jest.fn(async (employeeId: string) =>
        resolveActiveAssignment(employeeId),
      ),
      getActiveEmployeeAssignmentScopes: jest.fn(async (employeeIds: string[]) =>
        employeeIds
          .map((employeeId) => resolveActiveAssignment(employeeId))
          .filter((assignment) => assignment !== null),
      ),
      getLatestRankingPeriod: jest.fn(async () => input?.period ?? period),
      listRankingAvailablePeriods: jest.fn(async () => [input?.period ?? period]),
      listRankingStoreKpiRows: jest.fn(async () => input?.storeRows ?? createStoreRows(105)),
      listRankingStoreChecklistRows: jest.fn(async () => input?.storeChecklistRows ?? []),
      listRankingPersonnelKpiRows: jest.fn(
        async () => input?.personnelRows ?? createPersonnelRows(105),
      ),
      getStoreTurkeyBenchmarkValues: jest.fn(async () => input?.storeBenchmarkRows ?? []),
      getEmployeeTurkeyBenchmarkValues: jest.fn(async () => input?.personnelBenchmarkRows ?? []),
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

  function createKpiConfigRepositoryMockWithStoreProfile(
    metrics: Array<{
      code: string;
      label: string;
      weightPercent: number;
      benchmarkSource: "TARGET" | "TURKEY_AVERAGE";
      aliases?: string[];
    }>,
  ) {
    return {
      getKpiConfigRows: jest.fn(async () => [
        {
          config_key: "store_profile",
          config_payload: {
            profileCode: "store",
            title: "Custom store score profile",
            summary: "Custom ranking profile for test",
            futureMetricRule: "test",
            metrics: metrics.map((metric) => ({
              ...metric,
              ownerRole: "STORE_MANAGER",
              scoreBehavior: "score_only",
              direction: "HIGHER_IS_BETTER",
              capRatio: 1.2,
            })),
          },
        },
      ]),
    };
  }

  function createKpiConfigRepositoryMockWithPersonnelProfile(
    metrics: Array<{
      code: string;
      label: string;
      weightPercent: number;
      benchmarkSource: "TARGET" | "TURKEY_AVERAGE";
      aliases?: string[];
    }>,
  ) {
    return {
      getKpiConfigRows: jest.fn(async () => [
        {
          config_key: "personnel_profile",
          config_payload: {
            profileCode: "personnel",
            title: "Custom personnel score profile",
            summary: "Custom ranking profile for test",
            futureMetricRule: "test",
            metrics: metrics.map((metric) => ({
              ...metric,
              ownerRole: "STORE_PERSONNEL",
              scoreBehavior: "score_only",
              direction: "HIGHER_IS_BETTER",
              capRatio: 1.2,
            })),
          },
        },
      ]),
    };
  }

  function createService(
    repository: ReturnType<typeof createRepositoryMock>,
    kpiConfigRepository: Record<string, unknown>,
  ) {
    return new RankingService(
      repository as never,
      kpiConfigRepository as never,
      repository as never,
      repository as never,
    );
  }

  function createStoreKpiRows(input: {
    storeId: string;
    storeName: string;
    targetAchievement: number;
    upt: number;
    atv: number;
    cr: number;
  }) {
    const base = {
      ...createStoreRows(1)[0],
      store_id: input.storeId,
      store_name: input.storeName,
    };

    return [
      {
        ...base,
        kpi_code: "TARGET_ACHIEVEMENT",
        kpi_name: "Hedef gerceklestirme orani",
        actual_value: String(input.targetAchievement),
        target_value: "100",
      },
      {
        ...base,
        kpi_code: "UPT",
        kpi_name: "UPT",
        actual_value: String(input.upt),
        target_value: "not_applicable",
      },
      {
        ...base,
        kpi_code: "ATV",
        kpi_name: "ATV",
        actual_value: String(input.atv),
        target_value: "not_applicable",
      },
      {
        ...base,
        kpi_code: "CR",
        kpi_name: "CR",
        actual_value: String(input.cr),
        target_value: "not_applicable",
      },
    ];
  }

  const benchmarkRows = [
    { kpi_code: "UPT", benchmark_value: "2.62" },
    { kpi_code: "ATV", benchmark_value: "3573.08" },
    { kpi_code: "CR", benchmark_value: "0.1126" },
  ];

  it("uses requested daily periods for ranking reads and source metadata", async () => {
    const dailyPeriod = {
      period_type: "daily",
      period_start: "2026-05-15",
      period_end: "2026-05-15",
    };
    const repository = createRepositoryMock({ period: dailyPeriod });
    const service = createService(repository, createKpiConfigRepositoryMock());

    const result = await service.getRankings({
      userId: "user-1",
      employeeId: "employee-105",
      roleCodes: ["REGION_MANAGER"],
      companyIds: ["company-1"],
      regionIds: ["region-1"],
      storeIds: [],
      assignedStoreIds: [],
      periodType: "daily",
      periodStart: "2026-05-15",
    });

    expect(repository.getLatestRankingPeriod).toHaveBeenCalledWith(
      expect.objectContaining({
        periodType: "daily",
        periodStart: "2026-05-15",
      }),
    );
    expect(repository.listRankingStoreKpiRows).toHaveBeenCalledWith(
      expect.objectContaining({
        periodType: "daily",
        periodStart: "2026-05-15",
        periodEnd: "2026-05-15",
      }),
    );
    expect(repository.listRankingPersonnelKpiRows).toHaveBeenCalledWith(
      expect.objectContaining({
        periodType: "daily",
        periodStart: "2026-05-15",
        periodEnd: "2026-05-15",
      }),
    );
    expect(result.source).toEqual({
      mode: "live",
      periodType: "daily",
      periodStart: "2026-05-15",
      periodEnd: "2026-05-15",
    });
    expect(result.availablePeriods).toEqual([
      {
        periodType: "daily",
        periodStart: "2026-05-15",
        periodEnd: "2026-05-15",
      },
    ]);
  });

  it("caps store personnel to Turkey Top 100 summary rows and includes own position outside the top list", async () => {
    const repository = createRepositoryMock();
    const service = createService(repository, createKpiConfigRepositoryMock());

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
    const service = createService(repository, createKpiConfigRepositoryMock());

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
        canOpenProfile: true,
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
    const service = createService(repository, createKpiConfigRepositoryMock());

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

  it("limits region manager rankings to assigned action stores before user-id fallback", async () => {
    const repository = createRepositoryMock({
      storeRows: createStoreRows(12).map((row) => ({
        ...row,
        region_manager_user_id: "different-region-manager",
        region_manager_name: "Different Region Manager",
      })),
    });
    const service = createService(repository, createKpiConfigRepositoryMock());

    const result = await service.getRankings({
      userId: "regional-1",
      roleCodes: ["REGION_MANAGER"],
      companyIds: ["company-1"],
      regionIds: [],
      storeIds: [],
      assignedStoreIds: ["store-002", "store-005", "store-009"],
      periodType: "monthly",
      regionManagerUserId: "regional-1",
      limit: 100,
      offset: 0,
    });

    expect(result.storeLeaderboard.meta.total).toBe(3);
    expect(result.storeLeaderboard.items.map((row) => row.storeId)).toEqual([
      "store-002",
      "store-005",
      "store-009",
    ]);
    expect(
      result.storeLeaderboard.items.every((row) => row.visibility === "detail"),
    ).toBe(true);
  });

  it("marks personnel profile navigation from active assignment scope, not ranking period region", async () => {
    const repository = createRepositoryMock({
      personnelRows: [
        {
          ...createPersonnelRows(1)[0],
          employee_id: "employee-001",
          region_id: "region-1",
          store_id: "store-001",
        },
        {
          ...createPersonnelRows(1)[0],
          employee_id: "employee-002",
          region_id: "region-2",
          store_id: "store-002",
        },
      ],
    });
    repository.getActiveEmployeeAssignmentScopes.mockImplementation(
      async (employeeIds: string[]) => employeeIds.map((employeeId) => ({
        employee_id: employeeId,
        external_employee_ref: null,
        first_name: "Personel",
        last_name: "Test",
        company_id: "company-1",
        region_id: employeeId === "employee-001" ? "region-2" : "region-1",
        region_name: employeeId === "employee-001" ? "Region 2" : "Region 1",
        store_id: employeeId === "employee-001" ? "store-002" : "store-001",
        store_name: employeeId === "employee-001" ? "Store 002" : "Store 001",
      })),
    );
    const service = createService(repository, createKpiConfigRepositoryMock());

    const result = await service.getRankings({
      userId: "regional-1",
      roleCodes: ["REGION_MANAGER"],
      companyIds: ["company-1"],
      regionIds: ["region-1"],
      storeIds: [],
      assignedStoreIds: [],
      periodType: "monthly",
    });

    expect(
      result.personnelLeaderboard.items.find((row) => row.employeeId === "employee-001"),
    ).toEqual(
      expect.objectContaining({
        regionId: "region-1",
        canOpenProfile: false,
      }),
    );
    expect(
      result.personnelLeaderboard.items.find((row) => row.employeeId === "employee-002"),
    ).toEqual(
      expect.objectContaining({
        regionId: "region-2",
        canOpenProfile: true,
      }),
    );
    expect(repository.getActiveEmployeeAssignmentScopes).toHaveBeenCalledTimes(1);
    expect(repository.getActiveEmployeeAssignmentScopes).toHaveBeenCalledWith([
      "employee-001",
      "employee-002",
    ]);
    expect(repository.getActiveEmployeeAssignmentScope).not.toHaveBeenCalled();
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
    const service = createService(repository, createKpiConfigRepositoryMock());

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

  it("does not treat target achievement sales amounts as percentages when target is missing", async () => {
    const storeRows = [
      {
        ...createStoreRows(1)[0],
        store_id: "store-missing-target",
        actual_value: "293827",
        target_value: null,
      },
      {
        ...createStoreRows(1)[0],
        store_id: "store-high-achievement",
        actual_value: "120",
        target_value: "100",
      },
      {
        ...createStoreRows(1)[0],
        store_id: "store-low-achievement",
        actual_value: "80",
        target_value: "100",
      },
    ];
    const personnelRows = [
      {
        ...createPersonnelRows(1)[0],
        employee_id: "employee-missing-target",
        actual_value: "293827",
        target_value: null,
      },
      {
        ...createPersonnelRows(1)[0],
        employee_id: "employee-high-achievement",
        actual_value: "120",
        target_value: "100",
      },
      {
        ...createPersonnelRows(1)[0],
        employee_id: "employee-low-achievement",
        actual_value: "80",
        target_value: "100",
      },
    ];
    const repository = createRepositoryMock({ storeRows, personnelRows });
    const service = createService(repository, createKpiConfigRepositoryMock());

    const result = await service.getRankings({
      userId: "regional-1",
      roleCodes: ["REGION_MANAGER"],
      companyIds: [],
      regionIds: [],
      storeIds: [],
      assignedStoreIds: [],
      periodType: "monthly",
      sortKey: "TARGET_ACHIEVEMENT",
      sortDirection: "desc",
      limit: 3,
      offset: 0,
    });

    expect(result.storeLeaderboard.items.map((item) => item.storeId)).toEqual([
      "store-high-achievement",
      "store-low-achievement",
      "store-missing-target",
    ]);
    expect(result.personnelLeaderboard.items.map((item) => item.employeeId)).toEqual([
      "employee-high-achievement",
      "employee-low-achievement",
      "employee-missing-target",
    ]);
    expect(
      result.reference.store.metrics.find((metric) => metric.code === "TARGET_ACHIEVEMENT")
        ?.value,
    ).toBe(1);
    expect(
      result.reference.personnel.metrics.find(
        (metric) => metric.code === "TARGET_ACHIEVEMENT",
      )?.value,
    ).toBe(1);
  });

  it("breaks equal personnel score ties by underlying metric strength before employee id", async () => {
    const createMetricRows = (input: { employeeId: string; targetAchievement: number; atv: number; upt: number }) => {
      const base = { ...createPersonnelRows(1)[0], employee_id: input.employeeId };

      return [
        {
          ...base,
          kpi_code: "TARGET_ACHIEVEMENT",
          kpi_name: "Hedef gerceklestirme orani",
          actual_value: String(input.targetAchievement),
          target_value: "100",
        },
        {
          ...base,
          kpi_code: "ATV",
          kpi_name: "ATV",
          actual_value: String(input.atv),
          target_value: null,
        },
        {
          ...base,
          kpi_code: "UPT",
          kpi_name: "UPT",
          actual_value: String(input.upt),
          target_value: null,
        },
      ];
    };
    const personnelRows = [
      ...createMetricRows({
        employeeId: "employee-014",
        targetAchievement: 100,
        atv: 50,
        upt: 56.67,
      }),
      ...createMetricRows({
        employeeId: "employee-015",
        targetAchievement: 100.001,
        atv: 50.002,
        upt: 56.675,
      }),
    ];
    const repository = createRepositoryMock({
      storeRows: [],
      personnelRows,
      personnelBenchmarkRows: [
        { kpi_code: "ATV", benchmark_value: "100" },
        { kpi_code: "UPT", benchmark_value: "100" },
      ],
    });
    const service = createService(repository, createKpiConfigRepositoryMock());

    const result = await service.getRankings({
      userId: "regional-1",
      roleCodes: ["REGION_MANAGER"],
      companyIds: [],
      regionIds: [],
      storeIds: [],
      assignedStoreIds: [],
      periodType: "monthly",
      limit: 2,
      offset: 0,
    });

    expect(result.personnelLeaderboard.items.map((item) => item.scoreValue)).toEqual([72, 72]);
    expect(result.personnelLeaderboard.items.map((item) => item.employeeId)).toEqual([
      "employee-015",
      "employee-014",
    ]);
    expect(result.personnelLeaderboard.items.map((item) => item.rank)).toEqual([1, 2]);
    expect(result.personnelLeaderboard.items.map((item) => item.storeRank)).toEqual([1, 2]);
  });

  it("accepts gsm_approval as a store ranking sort key and scores from achievement rate", async () => {
    const baseStoreRow = createStoreRows(1)[0];
    const storeRows = [
      {
        ...baseStoreRow,
        store_id: "store-high-gsm",
        store_name: "High GSM Store",
        kpi_code: "gsm_approval",
        kpi_name: "GSM Onayı",
        actual_value: "91.2052",
        achievement_rate: "0.912052",
        target_value: null,
      },
      {
        ...baseStoreRow,
        store_id: "store-low-gsm",
        store_name: "Low GSM Store",
        kpi_code: "gsm_approval",
        kpi_name: "GSM Onayı",
        actual_value: "50",
        achievement_rate: "0.5",
        target_value: null,
      },
    ];
    const repository = createRepositoryMock({
      storeRows,
      personnelRows: [],
    });
    const service = createService(repository, createKpiConfigRepositoryMock());

    const result = await service.getRankings({
      userId: "regional-1",
      roleCodes: ["REGION_MANAGER"],
      companyIds: [],
      regionIds: [],
      storeIds: [],
      assignedStoreIds: [],
      periodType: "monthly",
      sortKey: "gsm_approval",
      sortDirection: "asc",
      limit: 2,
      offset: 0,
    });

    expect(result.storeLeaderboard.items.map((item) => item.storeId)).toEqual([
      "store-low-gsm",
      "store-high-gsm",
    ]);
    expect(result.storeLeaderboard.items[1].metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "gsm_approval",
          actualValue: 91.2052,
          contributionValue: 4.5603,
        }),
      ]),
    );
  });

  it("returns Turkey reference metrics even when low roles receive summary-only ranking rows", async () => {
    const repository = createRepositoryMock();
    const service = createService(repository, createKpiConfigRepositoryMock());

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

  it("returns missing store checklist weights to scored KPI metrics", async () => {
    const baseStoreRow = createStoreRows(1)[0];
    const storeRows = [
      {
        ...baseStoreRow,
        kpi_code: "TARGET_ACHIEVEMENT",
        kpi_name: "Hedef gerceklestirme orani",
        actual_value: "100",
        target_value: "100",
      },
      {
        ...baseStoreRow,
        kpi_code: "CR",
        kpi_name: "CR",
        actual_value: "0.2",
        target_value: "not_applicable",
      },
      {
        ...baseStoreRow,
        kpi_code: "ATV",
        kpi_name: "ATV",
        actual_value: "1500",
        target_value: "not_applicable",
      },
      {
        ...baseStoreRow,
        kpi_code: "UPT",
        kpi_name: "UPT",
        actual_value: "4",
        target_value: "not_applicable",
      },
    ];
    const repository = createRepositoryMock({
      storeRows,
      storeBenchmarkRows: [
        { kpi_code: "CR", benchmark_value: "0.2" },
        { kpi_code: "ATV", benchmark_value: "1500" },
        { kpi_code: "UPT", benchmark_value: "4" },
      ],
    });
    const service = createService(repository, createKpiConfigRepositoryMock());

    const result = await service.getRankings({
      userId: "regional-1",
      roleCodes: ["REGION_MANAGER"],
      companyIds: [],
      regionIds: [],
      storeIds: [],
      assignedStoreIds: [],
      periodType: "monthly",
    });

    expect(result.storeLeaderboard.items[0]).toEqual(
      expect.objectContaining({
        storeId: "store-001",
        scoreValue: 94.44,
      }),
    );
  });

  it("includes completed BM and VM checklist visits in live store rankings", async () => {
    const baseStoreRow = createStoreRows(1)[0];
    const storeRows = [
      {
        ...baseStoreRow,
        kpi_code: "TARGET_ACHIEVEMENT",
        kpi_name: "Hedef gerceklestirme orani",
        actual_value: "100",
        target_value: "100",
      },
      {
        ...baseStoreRow,
        kpi_code: "CR",
        kpi_name: "CR",
        actual_value: "0.2",
        target_value: "not_applicable",
      },
      {
        ...baseStoreRow,
        kpi_code: "ATV",
        kpi_name: "ATV",
        actual_value: "1500",
        target_value: "not_applicable",
      },
      {
        ...baseStoreRow,
        kpi_code: "UPT",
        kpi_name: "UPT",
        actual_value: "4",
        target_value: "not_applicable",
      },
    ];
    const checklistRows = [
      {
        ...baseStoreRow,
        kpi_code: "BM_CHECKLIST",
        kpi_name: "BM Checklist",
        actual_value: "80",
        target_value: null,
      },
      {
        ...baseStoreRow,
        kpi_code: "VM_CHECKLIST",
        kpi_name: "VM Checklist",
        actual_value: "100",
        target_value: null,
      },
    ];
    const repository = createRepositoryMock({
      storeRows,
      storeChecklistRows: checklistRows,
      personnelRows: [],
      storeBenchmarkRows: [
        { kpi_code: "CR", benchmark_value: "0.2" },
        { kpi_code: "ATV", benchmark_value: "1500" },
        { kpi_code: "UPT", benchmark_value: "4" },
      ],
    });
    const service = createService(repository, createKpiConfigRepositoryMock());

    const result = await service.getRankings({
      userId: "regional-1",
      roleCodes: ["REGION_MANAGER"],
      companyIds: [],
      regionIds: [],
      storeIds: [],
      assignedStoreIds: [],
      periodType: "monthly",
    });

    expect(repository.listRankingStoreChecklistRows).toHaveBeenCalledWith({
      companyIds: [],
      periodStart: "2026-03-01",
      periodEnd: "2026-03-31",
    });
    expect(result.storeLeaderboard.items[0]).toEqual(
      expect.objectContaining({
        storeId: "store-001",
        scoreValue: 94,
        metrics: expect.arrayContaining([
          expect.objectContaining({
            code: "BM_CHECKLIST",
            actualValue: 80,
            contributionValue: 4,
          }),
          expect.objectContaining({
            code: "VM_CHECKLIST",
            actualValue: 100,
            contributionValue: 5,
          }),
        ]),
      }),
    );
  });

  it("keeps target achievement weight dominant in default store rankings", async () => {
    const storeRows = [
      ...createStoreKpiRows({
        storeId: "store-hg-led",
        storeName: "HG Led Store",
        targetAchievement: 103,
        upt: 2.86,
        atv: 4140.33,
        cr: 0.1842,
      }),
      ...createStoreKpiRows({
        storeId: "store-atv-cr-led",
        storeName: "ATV CR Led Store",
        targetAchievement: 100.83,
        upt: 2.83,
        atv: 4780.53,
        cr: 0.1931,
      }),
    ];
    const repository = createRepositoryMock({
      storeRows,
      personnelRows: [],
      storeBenchmarkRows: benchmarkRows,
    });
    const service = createService(repository, createKpiConfigRepositoryMock());

    const result = await service.getRankings({
      userId: "regional-1",
      roleCodes: ["REGION_MANAGER"],
      companyIds: [],
      regionIds: [],
      storeIds: [],
      assignedStoreIds: [],
      periodType: "monthly",
    });

    expect(result.storeLeaderboard.items.map((row) => row.storeId)).toEqual([
      "store-hg-led",
      "store-atv-cr-led",
    ]);
    expect(result.storeLeaderboard.items[0].scoreValue).toBeGreaterThan(
      result.storeLeaderboard.items[1].scoreValue,
    );
  });

  it("uses published KPI config weights to change store ranking order", async () => {
    const storeRows = [
      ...createStoreKpiRows({
        storeId: "store-hg-led",
        storeName: "HG Led Store",
        targetAchievement: 103,
        upt: 2.86,
        atv: 4140.33,
        cr: 0.1842,
      }),
      ...createStoreKpiRows({
        storeId: "store-atv-cr-led",
        storeName: "ATV CR Led Store",
        targetAchievement: 100.83,
        upt: 2.83,
        atv: 4780.53,
        cr: 0.1931,
      }),
    ];
    const repository = createRepositoryMock({
      storeRows,
      personnelRows: [],
      storeBenchmarkRows: benchmarkRows,
    });
    const service = createService(
      repository,
      createKpiConfigRepositoryMockWithStoreProfile([
        {
          code: "TARGET_ACHIEVEMENT",
          label: "Hedef gerceklestirme orani",
          weightPercent: 20,
          benchmarkSource: "TARGET",
          aliases: ["STORE_SALES", "SALES_TARGET_ACHIEVEMENT"],
        },
        { code: "CR", label: "CR", weightPercent: 40, benchmarkSource: "TURKEY_AVERAGE" },
        { code: "ATV", label: "ATV", weightPercent: 25, benchmarkSource: "TURKEY_AVERAGE" },
        { code: "UPT", label: "UPT", weightPercent: 15, benchmarkSource: "TURKEY_AVERAGE" },
      ]),
    );

    const result = await service.getRankings({
      userId: "regional-1",
      roleCodes: ["REGION_MANAGER"],
      companyIds: [],
      regionIds: [],
      storeIds: [],
      assignedStoreIds: [],
      periodType: "monthly",
    });

    expect(result.storeLeaderboard.items.map((row) => row.storeId)).toEqual([
      "store-atv-cr-led",
      "store-hg-led",
    ]);
    expect(result.storeLeaderboard.items[0].scoreValue).toBeGreaterThan(
      result.storeLeaderboard.items[1].scoreValue,
    );
  });

  it("maps personnel NET_SALES rows into target achievement when published config is missing the alias", async () => {
    const personnelRows = [
      {
        ...createPersonnelRows(1)[0],
        employee_id: "employee-net-sales",
        kpi_code: "NET_SALES",
        kpi_name: "Net Sales",
        actual_value: "110000",
        target_value: "100000",
      },
    ];
    const repository = createRepositoryMock({ personnelRows, storeRows: [] });
    const service = createService(
      repository,
      createKpiConfigRepositoryMockWithPersonnelProfile([
        {
          code: "TARGET_ACHIEVEMENT",
          label: "Hedef gerceklestirme orani",
          weightPercent: 100,
          benchmarkSource: "TARGET",
          aliases: ["STORE_SALES", "SALES_TARGET_ACHIEVEMENT"],
        },
      ]),
    );

    const result = await service.getRankings({
      userId: "regional-1",
      roleCodes: ["REGION_MANAGER"],
      companyIds: [],
      regionIds: [],
      storeIds: [],
      assignedStoreIds: [],
      periodType: "monthly",
    });

    expect(repository.listRankingPersonnelKpiRows).toHaveBeenCalledWith(
      expect.objectContaining({
        metricCodes: expect.arrayContaining(["NET_SALES"]),
      }),
    );
    expect(result.personnelLeaderboard.items[0]).toEqual(
      expect.objectContaining({
        employeeId: "employee-net-sales",
        metrics: expect.arrayContaining([
          expect.objectContaining({
            code: "TARGET_ACHIEVEMENT",
            actualValue: 110000,
            targetValue: 100000,
          }),
        ]),
      }),
    );
  });

  it("applies privileged filters without recomputing Turkey ranks", async () => {
    const repository = createRepositoryMock();
    const service = createService(repository, createKpiConfigRepositoryMock());

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
