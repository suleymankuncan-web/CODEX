import { ClosedRankingService } from "./closed-ranking.service";

describe("ClosedRankingService", () => {
  const currentEmployeeId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const storeId = "22222222-2222-4222-8222-222222222222";

  function createRepositoryMock(overrides?: Record<string, jest.Mock>) {
    return {
      getEmployeeIdForUser: jest.fn(),
      getLatestCompletedSnapshotRunByType: jest.fn(),
      getCompletedDailySnapshotByDate: jest.fn(),
      listClosedDailyPersonnelRankRows: jest.fn(),
      listClosedDailyMetricRankRows: jest.fn(),
      ...overrides,
    };
  }

  it("returns not_closed when no completed daily snapshot exists", async () => {
    const repository = createRepositoryMock({
      getCompletedDailySnapshotByDate: jest.fn(async () => null),
    });
    const service = new ClosedRankingService(repository as never);

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
    const service = new ClosedRankingService(repository as never);

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
    expect(result.currentEmployee).toEqual(
      expect.objectContaining({
        employeeId: currentEmployeeId,
        displayName: "Ayse Yilmaz",
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
});
