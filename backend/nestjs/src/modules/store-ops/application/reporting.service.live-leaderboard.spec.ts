import { ReportingService } from "./reporting.service";

describe("ReportingService live leaderboard fallback", () => {
  it("rejects explicit live fallback store filters outside the caller scope", async () => {
    const closedRankingService = {
      getClosedLeaderboard: jest.fn(async () => ({
        source: {
          mode: "closed",
          periodType: "monthly",
          state: "not_closed",
          snapshotRunId: null,
          snapshotDate: null,
          periodStart: "2026-03-01",
          periodEnd: "2026-03-31",
        },
        includedSnapshotRuns: [],
        currentEmployee: null,
        personnelTop: [],
      })),
    };
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
        period_start: "2026-03-01",
        period_end: "2026-03-31",
        store_id: "store-1",
      })),
      getEmployeeTurkeyBenchmarkValues: jest.fn(async () => []),
      getPeerEmployeePerformanceRows: jest.fn(async () => []),
    };
    const service = new ReportingService(
      reportingRepository as never,
      { getKpiConfigRows: jest.fn(async () => []) } as never,
      closedRankingService as never,
    );

    await expect(
      service.getClosedLeaderboard({
        userId: "user-1",
        employeeId: "employee-1",
        companyIds: ["company-1"],
        regionIds: [],
        storeIds: ["store-1"],
        roleCodes: ["STORE_MANAGER"],
        assignedStoreIds: ["store-1"],
        periodType: "monthly",
        periodStart: "2026-03-01",
        storeId: "store-2",
        limit: 10,
      }),
    ).rejects.toThrow("Live leaderboard store is outside current scope");
    expect(reportingRepository.getPeerEmployeePerformanceRows).not.toHaveBeenCalled();
  });

  it("serves monthly imported KPI rankings when monthly closure is not available", async () => {
    const closedRankingService = {
      getClosedLeaderboard: jest.fn(async () => ({
        source: {
          mode: "closed",
          periodType: "monthly",
          state: "not_closed",
          snapshotRunId: null,
          snapshotDate: null,
          periodStart: "2026-03-01",
          periodEnd: "2026-03-31",
        },
        includedSnapshotRuns: [],
        currentEmployee: null,
        personnelTop: [],
      })),
    };
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
        period_start: "2026-03-01",
        period_end: "2026-03-31",
        store_id: "store-1",
      })),
      getEmployeeTurkeyBenchmarkValues: jest.fn(async () => [
        { kpi_code: "ATV", benchmark_value: "500" },
        { kpi_code: "UPT", benchmark_value: "2" },
      ]),
      getPeerEmployeePerformanceRows: jest.fn(async () => [
        {
          employee_id: "employee-1",
          first_name: "Ada",
          last_name: "Lovelace",
          store_id: "store-1",
          store_name: "Marmara Park",
          kpi_code: "TARGET_ACHIEVEMENT",
          kpi_name: "Hedef gerceklestirme orani",
          target_value: "100",
          personnel_target_reference_id: "target-1",
          actual_value: "120",
        },
        {
          employee_id: "employee-1",
          first_name: "Ada",
          last_name: "Lovelace",
          store_id: "store-1",
          store_name: "Marmara Park",
          kpi_code: "ATV",
          kpi_name: "ATV",
          target_value: null,
          personnel_target_reference_id: null,
          actual_value: "600",
        },
        {
          employee_id: "employee-1",
          first_name: "Ada",
          last_name: "Lovelace",
          store_id: "store-1",
          store_name: "Marmara Park",
          kpi_code: "UPT",
          kpi_name: "UPT",
          target_value: null,
          personnel_target_reference_id: null,
          actual_value: "3",
        },
        {
          employee_id: "employee-2",
          first_name: "Grace",
          last_name: "Hopper",
          store_id: "store-1",
          store_name: "Marmara Park",
          kpi_code: "TARGET_ACHIEVEMENT",
          kpi_name: "Hedef gerceklestirme orani",
          target_value: "100",
          personnel_target_reference_id: "target-2",
          actual_value: "80",
        },
        {
          employee_id: "employee-2",
          first_name: "Grace",
          last_name: "Hopper",
          store_id: "store-1",
          store_name: "Marmara Park",
          kpi_code: "ATV",
          kpi_name: "ATV",
          target_value: null,
          personnel_target_reference_id: null,
          actual_value: "550",
        },
        {
          employee_id: "employee-2",
          first_name: "Grace",
          last_name: "Hopper",
          store_id: "store-1",
          store_name: "Marmara Park",
          kpi_code: "UPT",
          kpi_name: "UPT",
          target_value: null,
          personnel_target_reference_id: null,
          actual_value: "2.5",
        },
        {
          employee_id: "employee-3",
          first_name: "Katherine",
          last_name: "Johnson",
          store_id: "store-2",
          store_name: "Cadde",
          kpi_code: "TARGET_ACHIEVEMENT",
          kpi_name: "Hedef gerceklestirme orani",
          target_value: "100",
          personnel_target_reference_id: "target-3",
          actual_value: "130",
        },
        {
          employee_id: "employee-3",
          first_name: "Katherine",
          last_name: "Johnson",
          store_id: "store-2",
          store_name: "Cadde",
          kpi_code: "ATV",
          kpi_name: "ATV",
          target_value: null,
          personnel_target_reference_id: null,
          actual_value: "700",
        },
        {
          employee_id: "employee-3",
          first_name: "Katherine",
          last_name: "Johnson",
          store_id: "store-2",
          store_name: "Cadde",
          kpi_code: "UPT",
          kpi_name: "UPT",
          target_value: null,
          personnel_target_reference_id: null,
          actual_value: "3.5",
        },
      ]),
    };
    const service = new ReportingService(
      reportingRepository as never,
      { getKpiConfigRows: jest.fn(async () => []) } as never,
      closedRankingService as never,
    );

    const result = await service.getClosedLeaderboard({
      userId: "user-1",
      employeeId: "employee-1",
      companyIds: ["company-1"],
      regionIds: [],
      storeIds: ["store-1"],
      roleCodes: ["STORE_MANAGER"],
      assignedStoreIds: ["store-1"],
      periodType: "monthly",
      periodStart: "2026-03-01",
      limit: 10,
    });

    expect(result.source).toEqual(
      expect.objectContaining({
        mode: "live",
        periodType: "monthly",
        state: "live",
        periodStart: "2026-03-01",
        periodEnd: "2026-03-31",
      }),
    );
    expect(result.personnelTop.map((employee) => employee.displayName)).toEqual([
      "Ada Lovelace",
      "Grace Hopper",
    ]);
    expect(result.currentEmployee).toEqual(
      expect.objectContaining({
        displayName: "Ada Lovelace",
        scoreValue: 120,
        rankings: {
          turkeyRank: 1,
          turkeyPopulation: 3,
          storeRank: 1,
          storePopulation: 2,
        },
      }),
    );
    expect(result.currentEmployee?.metricRanks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "ATV",
          actualValue: 600,
          turkeyRank: 2,
          storeRank: 1,
        }),
      ]),
    );
  });
});
