import { ReportingService } from "./reporting.service";

function createReportingService(
  reportingRepository: Record<string, unknown>,
  kpiConfigRepository: Record<string, unknown> = {
    getKpiConfigRows: jest.fn(async () => []),
  },
  closedRankingService: Record<string, unknown> = {},
  liveMonthlyLeaderboardService: Record<string, unknown> = {},
) {
  return new ReportingService(
    reportingRepository as never,
    kpiConfigRepository as never,
    closedRankingService as never,
    liveMonthlyLeaderboardService as never,
    reportingRepository as never,
    reportingRepository as never,
    reportingRepository as never,
    reportingRepository as never,
    reportingRepository as never,
  );
}

describe("ReportingService metric-specific personnel ranks", () => {
  it("returns metric-specific live ranks for personnel performance KPI cards", async () => {
    const reportingRepository = {
      resolveEmployeeIdForAuthIdentity: jest.fn(async () => "employee-1"),
      listEmployeeKpiPeriods: jest.fn(async () => [
        {
          period_type: "monthly",
          period_start: "2026-03-01",
          period_end: "2026-03-31",
        },
      ]),
      getLatestEmployeeKpiPeriod: jest.fn(async () => ({
        period_type: "monthly",
        period_start: "2026-03-01",
        period_end: "2026-03-31",
        store_id: "store-1",
      })),
      getEmployeePerformanceRows: jest.fn(async () => [
        {
          employee_id: "employee-1",
          first_name: "Ada",
          last_name: "Lovelace",
          store_id: "store-1",
          store_name: "Marmara Park",
          region_id: "region-1",
          kpi_code: "UPT",
          kpi_name: "UPT",
          target_value: null,
          personnel_target_reference_id: null,
          actual_value: "4",
        },
        {
          employee_id: "employee-1",
          first_name: "Ada",
          last_name: "Lovelace",
          store_id: "store-1",
          store_name: "Marmara Park",
          region_id: "region-1",
          kpi_code: "ATV",
          kpi_name: "ATV",
          target_value: null,
          personnel_target_reference_id: null,
          actual_value: "100",
        },
      ]),
      getPeerEmployeePerformanceRows: jest.fn(async () => [
        {
          employee_id: "employee-2",
          first_name: "Grace",
          last_name: "Hopper",
          store_id: "store-1",
          store_name: "Marmara Park",
          region_id: "region-1",
          kpi_code: "UPT",
          kpi_name: "UPT",
          target_value: null,
          actual_value: "5",
        },
        {
          employee_id: "employee-2",
          first_name: "Grace",
          last_name: "Hopper",
          store_id: "store-1",
          store_name: "Marmara Park",
          region_id: "region-1",
          kpi_code: "ATV",
          kpi_name: "ATV",
          target_value: null,
          actual_value: "80",
        },
        {
          employee_id: "employee-1",
          first_name: "Ada",
          last_name: "Lovelace",
          store_id: "store-1",
          store_name: "Marmara Park",
          region_id: "region-1",
          kpi_code: "UPT",
          kpi_name: "UPT",
          target_value: null,
          actual_value: "4",
        },
        {
          employee_id: "employee-1",
          first_name: "Ada",
          last_name: "Lovelace",
          store_id: "store-1",
          store_name: "Marmara Park",
          region_id: "region-1",
          kpi_code: "ATV",
          kpi_name: "ATV",
          target_value: null,
          actual_value: "100",
        },
        {
          employee_id: "employee-3",
          first_name: "Katherine",
          last_name: "Johnson",
          store_id: "store-2",
          store_name: "Forum",
          region_id: "region-1",
          kpi_code: "UPT",
          kpi_name: "UPT",
          target_value: null,
          actual_value: "2",
        },
        {
          employee_id: "employee-3",
          first_name: "Katherine",
          last_name: "Johnson",
          store_id: "store-2",
          store_name: "Forum",
          region_id: "region-1",
          kpi_code: "ATV",
          kpi_name: "ATV",
          target_value: null,
          actual_value: "120",
        },
      ]),
      getEmployeeTurkeyBenchmarkValues: jest.fn(async () => [
        { kpi_code: "ATV", benchmark_value: "100" },
        { kpi_code: "UPT", benchmark_value: "4" },
      ]),
    };
    const service = createReportingService(reportingRepository);

    const result = await service.getMyPerformance({
      userId: "user-1",
      employeeId: "employee-1",
      companyIds: [],
      regionIds: [],
      storeIds: ["store-1"],
      periodType: "monthly",
      periodStart: "2026-03-01",
    });

    expect(result.metricRanks).toEqual(
      expect.arrayContaining([
        {
          code: "UPT",
          label: "UPT",
          actualValue: 4,
          storeRank: 2,
          storePopulation: 2,
          regionRank: 2,
          regionPopulation: 3,
          turkeyRank: 2,
          turkeyPopulation: 3,
        },
        {
          code: "ATV",
          label: "ATV",
          actualValue: 100,
          storeRank: 1,
          storePopulation: 2,
          regionRank: 2,
          regionPopulation: 3,
          turkeyRank: 2,
          turkeyPopulation: 3,
        },
      ]),
    );
  });

  it("returns metric-specific closed snapshot ranks for personnel performance KPI cards", async () => {
    const employeeId = "00000000-0000-0000-0000-000000000202";
    const reportingRepository = {
      resolveEmployeeIdForAuthIdentity: jest.fn(async () => employeeId),
      getCompletedSnapshotRunByTypeAndDate: jest.fn(async () => ({
        snapshot_run_id: "00000000-0000-0000-0000-000000000111",
        snapshot_date: "2026-04-24",
        snapshot_type: "daily",
        period_start: "2026-04-24",
        period_end: "2026-04-24",
        run_status: "completed",
        generated_at: "2026-04-24T21:00:00.000Z",
        generated_by: null,
      })),
      getLatestCompletedSnapshotRunByType: jest.fn(),
      getEmployeePerformanceSnapshot: jest.fn(async () => ({
        employee_id: employeeId,
        first_name: "Ada",
        last_name: "Lovelace",
        store_id: "store-1",
        store_name: "Marmara Park",
        period_start: "2026-04-24",
        period_end: "2026-04-24",
        score_value: "86",
        matched_metrics: 2,
        total_metrics: 3,
        turkey_rank: 300,
        turkey_population: 500,
        store_rank: 4,
        store_population: 8,
      })),
      getEmployeeKpiSnapshotRows: jest.fn(async () => [
        {
          employee_id: employeeId,
          store_id: "store-1",
          kpi_code: "UPT",
          kpi_name: "UPT",
          actual_value: "4",
        },
      ]),
      listClosedDailyMetricRankRows: jest.fn(async () => [
        {
          employee_id: employeeId,
          kpi_code: "UPT",
          kpi_name: "UPT",
          actual_value: "4",
          store_rank: 2,
          store_population: 8,
          turkey_rank: 41,
          turkey_population: 500,
        },
      ]),
    };
    const service = createReportingService(reportingRepository);

    const result = await service.getMyPerformance({
      userId: "user-1",
      employeeId,
      companyIds: [],
      regionIds: [],
      storeIds: ["store-1"],
      mode: "closed",
      snapshotDate: "2026-04-24",
    });

    expect(result.rankings.turkeyRank).toBe(300);
    expect(result.metricRanks).toEqual([
      {
        code: "UPT",
        label: "UPT",
        actualValue: 4,
        storeRank: 2,
        storePopulation: 8,
        regionRank: null,
        regionPopulation: 0,
        turkeyRank: 41,
        turkeyPopulation: 500,
      },
    ]);
  });
});
