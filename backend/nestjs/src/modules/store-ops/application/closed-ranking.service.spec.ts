import { ClosedRankingService } from "./closed-ranking.service";

describe("ClosedRankingService", () => {
  const currentEmployeeId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const storeId = "22222222-2222-4222-8222-222222222222";

  function createRepositoryMock(overrides?: Record<string, jest.Mock>) {
    const reportingRepository = {
      getEmployeeIdForUser: jest.fn(),
      resolveEmployeeIdForAuthIdentity: jest.fn(async (input) => input.employeeId ?? null),
      getLatestCompletedSnapshotRunByType: jest.fn(),
      getCompletedDailySnapshotByDate: jest.fn(),
      getEmployeePerformanceSnapshot: jest.fn(),
      ...overrides,
    };
    const closedRankingRepository = {
      listClosedDailyPersonnelRankRows: jest.fn(),
      listClosedDailyMetricRankRows: jest.fn(),
      listCompletedDailySnapshotsInMonth: jest.fn(),
      listClosedMonthlyPersonnelAggregateRows: jest.fn(),
      listClosedMonthlyMetricRankRows: jest.fn(),
      ...overrides,
    };

    return {
      ...reportingRepository,
      ...closedRankingRepository,
      reportingRepository,
      closedRankingRepository,
    };
  }

  function createService(repository: ReturnType<typeof createRepositoryMock>) {
    return new ClosedRankingService(
      repository.reportingRepository as never,
      repository.closedRankingRepository as never,
    );
  }

  it("returns not_closed when no completed daily snapshot exists", async () => {
    const repository = createRepositoryMock({
      getCompletedDailySnapshotByDate: jest.fn(async () => null),
    });
    const service = createService(repository);

    const result = await service.getClosedLeaderboard({
      userId: "user-1",
      employeeId: currentEmployeeId,
      companyIds: [],
      regionIds: [],
      storeIds: [storeId],
      roleCodes: ["STORE_PERSONNEL"],
      assignedStoreIds: [storeId],
      periodType: "daily",
      periodStart: "2026-04-23",
      limit: 10,
    });

    expect(result).toEqual({
      source: {
        mode: "closed",
        periodType: "daily",
        state: "not_closed",
        snapshotRunId: null,
        snapshotDate: "2026-04-23",
        periodStart: "2026-04-23",
        periodEnd: "2026-04-23",
      },
      includedSnapshotRuns: [],
      currentEmployee: null,
      personnelTop: [],
    });
  });

  it("maps daily current employee metric mini ranks", async () => {
    const repository = createRepositoryMock({
      getCompletedDailySnapshotByDate: jest.fn(async () => ({
        snapshot_run_id: "11111111-1111-4111-8111-111111111111",
        snapshot_date: "2026-04-23",
        snapshot_type: "daily",
        period_start: "2026-04-23",
        period_end: "2026-04-23",
        run_status: "completed",
        generated_at: "2026-04-24T00:10:00.000Z",
        generated_by: "system",
      })),
      listClosedDailyPersonnelRankRows: jest.fn(async () => [
        {
          employee_id: currentEmployeeId,
          first_name: "Ayse",
          last_name: "Yilmaz",
          store_id: storeId,
          store_name: "Kadikoy",
          score_value: "91.2500",
          turkey_rank: 4,
          turkey_population: 100,
          store_rank: 1,
          store_population: 8,
        },
      ]),
      listClosedDailyMetricRankRows: jest.fn(async () => [
        {
          employee_id: currentEmployeeId,
          kpi_code: "UPT",
          kpi_name: "UPT",
          actual_value: "2.4000",
          store_rank: 1,
          store_population: 8,
          turkey_rank: 9,
          turkey_population: 100,
        },
        {
          employee_id: currentEmployeeId,
          kpi_code: "ATV",
          kpi_name: "ATV",
          actual_value: "850.0000",
          store_rank: 3,
          store_population: 8,
          turkey_rank: 41,
          turkey_population: 100,
        },
      ]),
    });
    const service = createService(repository);

    const result = await service.getClosedLeaderboard({
      userId: "user-1",
      employeeId: currentEmployeeId,
      companyIds: ["00000000-0000-0000-0000-000000000001"],
      regionIds: [],
      storeIds: [storeId],
      roleCodes: ["STORE_PERSONNEL"],
      assignedStoreIds: [storeId],
      periodType: "daily",
      periodStart: "2026-04-23",
      limit: 10,
    });

    expect(result.source).toEqual(
      expect.objectContaining({
        mode: "closed",
        periodType: "daily",
        state: "closed",
        snapshotRunId: "11111111-1111-4111-8111-111111111111",
      }),
    );
    expect(result.includedSnapshotRuns).toEqual([
      {
        snapshotRunId: "11111111-1111-4111-8111-111111111111",
        snapshotDate: "2026-04-23",
        snapshotType: "daily",
        periodStart: "2026-04-23",
        periodEnd: "2026-04-23",
        runStatus: "completed",
        generatedAt: "2026-04-24T00:10:00.000Z",
        generatedBy: "system",
      },
    ]);
    expect(result.currentEmployee).toEqual(
      expect.objectContaining({
        employeeId: currentEmployeeId,
        displayName: "Ayse Yilmaz",
        rankingStatus: "official",
        eligibilityReason: "eligible",
        neededPerformanceDays: 0,
        coverage: {
          closedDaysInPeriod: 1,
          daysWithPerformance: 1,
          minimumRequiredDays: 1,
          isEligibleForRanking: true,
        },
        rankings: {
          turkeyRank: 4,
          turkeyPopulation: 100,
          storeRank: 1,
          storePopulation: 8,
        },
      }),
    );
    expect(result.currentEmployee?.metricRanks).toEqual([
      expect.objectContaining({ code: "UPT", turkeyRank: 9, storeRank: 1 }),
      expect.objectContaining({ code: "ATV", turkeyRank: 41, storeRank: 3 }),
    ]);
  });

  it("rejects explicit closed leaderboard store filters outside the caller scope", async () => {
    const foreignStoreId = "33333333-3333-4333-8333-333333333333";
    const repository = createRepositoryMock({
      getCompletedDailySnapshotByDate: jest.fn(async () => ({
        snapshot_run_id: "11111111-1111-4111-8111-111111111111",
        snapshot_date: "2026-04-23",
        snapshot_type: "daily",
        period_start: "2026-04-23",
        period_end: "2026-04-23",
        run_status: "completed",
        generated_at: "2026-04-24T00:10:00.000Z",
        generated_by: "system",
      })),
      listClosedDailyPersonnelRankRows: jest.fn(async () => [
        {
          employee_id: currentEmployeeId,
          first_name: "Ayse",
          last_name: "Yilmaz",
          store_id: storeId,
          store_name: "Kadikoy",
          score_value: "91.2500",
          turkey_rank: 4,
          turkey_population: 100,
          store_rank: 1,
          store_population: 8,
        },
      ]),
      listClosedDailyMetricRankRows: jest.fn(async () => []),
    });
    const service = createService(repository);

    await expect(
      service.getClosedLeaderboard({
        userId: "user-1",
        employeeId: currentEmployeeId,
        companyIds: ["00000000-0000-0000-0000-000000000001"],
        regionIds: [],
        storeIds: [storeId],
        roleCodes: ["STORE_PERSONNEL"],
        assignedStoreIds: [storeId],
        periodType: "daily",
        periodStart: "2026-04-23",
        storeId: foreignStoreId,
        limit: 10,
      }),
    ).rejects.toThrow("Closed leaderboard store is outside current scope");
    expect(repository.listClosedDailyPersonnelRankRows).not.toHaveBeenCalled();
  });

  it("uses only completed daily snapshots in the selected month", async () => {
    const repository = createRepositoryMock({
      listCompletedDailySnapshotsInMonth: jest.fn(async () => [
        {
          snapshot_run_id: "11111111-1111-4111-8111-111111111111",
          snapshot_date: "2026-04-01",
          snapshot_type: "daily",
          period_start: "2026-04-01",
          period_end: "2026-04-01",
          run_status: "completed",
          generated_at: "2026-04-01T08:00:00.000Z",
          generated_by: "ranking-closure-job",
        },
        {
          snapshot_run_id: "22222222-2222-4222-8222-222222222222",
          snapshot_date: "2026-04-02",
          snapshot_type: "daily",
          period_start: "2026-04-02",
          period_end: "2026-04-02",
          run_status: "completed",
          generated_at: "2026-04-02T08:00:00.000Z",
          generated_by: "ranking-closure-job",
        },
        {
          snapshot_run_id: "33333333-3333-4333-8333-333333333333",
          snapshot_date: "2026-04-03",
          snapshot_type: "daily",
          period_start: "2026-04-03",
          period_end: "2026-04-03",
          run_status: "completed",
          generated_at: "2026-04-03T08:00:00.000Z",
          generated_by: "ranking-closure-job",
        },
      ]),
      listClosedMonthlyPersonnelAggregateRows: jest.fn(async () => [
        {
          employee_id: currentEmployeeId,
          first_name: "Ayse",
          last_name: "Yilmaz",
          store_id: storeId,
          store_name: "Kadikoy",
          score_value: "89.5000",
          days_with_performance: "3",
          turkey_rank: 5,
          turkey_population: 80,
          store_rank: 1,
          store_population: 7,
        },
      ]),
      listClosedMonthlyMetricRankRows: jest.fn(async () => []),
    });
    const service = createService(repository);

    const result = await service.getClosedLeaderboard({
      userId: "user-1",
      employeeId: currentEmployeeId,
      companyIds: ["00000000-0000-0000-0000-000000000001"],
      regionIds: [],
      storeIds: [storeId],
      roleCodes: ["STORE_PERSONNEL"],
      assignedStoreIds: [storeId],
      periodType: "monthly",
      periodStart: "2026-04-01",
      limit: 10,
    });

    expect(repository.listClosedMonthlyPersonnelAggregateRows).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshotRunIds: [
          "11111111-1111-4111-8111-111111111111",
          "22222222-2222-4222-8222-222222222222",
          "33333333-3333-4333-8333-333333333333",
        ],
      }),
    );
    expect(result.source).toEqual(
      expect.objectContaining({
        periodType: "monthly",
        state: "closed",
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
      }),
    );
    expect(result.currentEmployee?.coverage).toEqual({
      closedDaysInPeriod: 3,
      daysWithPerformance: 3,
      minimumRequiredDays: 3,
      isEligibleForRanking: true,
    });
    expect(result.includedSnapshotRuns.map((run) => run.snapshotDate)).toEqual([
      "2026-04-01",
      "2026-04-02",
      "2026-04-03",
    ]);
  });

  it("marks 1-2 day monthly rows as preview-only", async () => {
    const repository = createRepositoryMock({
      listCompletedDailySnapshotsInMonth: jest.fn(async () => [
        {
          snapshot_run_id: "11111111-1111-4111-8111-111111111111",
          snapshot_date: "2026-04-01",
          snapshot_type: "daily",
          period_start: "2026-04-01",
          period_end: "2026-04-01",
          run_status: "completed",
          generated_at: "2026-04-01T08:00:00.000Z",
          generated_by: "ranking-closure-job",
        },
        {
          snapshot_run_id: "22222222-2222-4222-8222-222222222222",
          snapshot_date: "2026-04-02",
          snapshot_type: "daily",
          period_start: "2026-04-02",
          period_end: "2026-04-02",
          run_status: "completed",
          generated_at: "2026-04-02T08:00:00.000Z",
          generated_by: "ranking-closure-job",
        },
      ]),
      listClosedMonthlyPersonnelAggregateRows: jest.fn(async () => [
        {
          employee_id: currentEmployeeId,
          first_name: "Ayse",
          last_name: "Yilmaz",
          store_id: storeId,
          store_name: "Kadikoy",
          score_value: "90.0000",
          days_with_performance: "2",
          turkey_rank: 1,
          turkey_population: 25,
          store_rank: 1,
          store_population: 5,
        },
      ]),
      listClosedMonthlyMetricRankRows: jest.fn(async () => []),
    });
    const service = createService(repository);

    const result = await service.getClosedLeaderboard({
      userId: "user-1",
      employeeId: currentEmployeeId,
      companyIds: ["00000000-0000-0000-0000-000000000001"],
      regionIds: [],
      storeIds: [storeId],
      roleCodes: ["STORE_PERSONNEL"],
      assignedStoreIds: [storeId],
      periodType: "monthly",
      periodStart: "2026-04-01",
      limit: 10,
    });

    expect(result.currentEmployee?.coverage).toEqual({
      closedDaysInPeriod: 2,
      daysWithPerformance: 2,
      minimumRequiredDays: 3,
      isEligibleForRanking: false,
    });
    expect(result.currentEmployee?.rankings).toEqual({
      turkeyRank: null,
      turkeyPopulation: 25,
      storeRank: null,
      storePopulation: 5,
    });
    expect(result.currentEmployee).toEqual(
      expect.objectContaining({
        rankingStatus: "preview_only",
        eligibilityReason: "needs_more_closed_days",
        neededPerformanceDays: 1,
      }),
    );
  });
});
