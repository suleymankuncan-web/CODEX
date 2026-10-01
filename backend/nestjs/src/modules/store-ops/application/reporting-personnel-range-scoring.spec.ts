import { ReportingService } from "./reporting.service";

function createReportingService(repository: Record<string, unknown>) {
  return new ReportingService(repository as never, { getKpiConfigRows: jest.fn(async () => []) } as never,
    {} as never, {} as never, repository as never, repository as never,
    repository as never, repository as never, repository as never);
}

describe("personnel range scoring regression", () => {
  it("scores reported range ATV and UPT with range benchmarks when HG has no target", async () => {
    const rows = [
      { kpi_code: "TARGET_ACHIEVEMENT", actual_value: "600", target_value: null },
      { kpi_code: "NET_SALES", actual_value: "600", target_value: null },
      { kpi_code: "ATV", actual_value: "6", target_value: null },
      { kpi_code: "UPT", actual_value: "3", target_value: null },
    ].map(row => ({ ...row, employee_id: "employee-1", store_id: "store-1", first_name: "Fixture", last_name: "Person", region_id: "region-1" }));
    const benchmarks = jest.fn(async (input: { isRange?: boolean; companyId?: string }) =>
      input.isRange && !input.companyId ? [{ kpi_code: "ATV", benchmark_value: "6" }, { kpi_code: "UPT", benchmark_value: "3" }] : []);
    const repository = {
      resolveEmployeeIdForAuthIdentity: jest.fn(async () => "employee-1"),
      listEmployeeKpiPeriods: jest.fn(async () => []),
      getActiveEmployeeAssignmentScope: jest.fn(async () => ({ store_id: "store-1", region_id: "region-1", company_id: "company-1" })),
      listRankingPersonnelKpiRows: jest.fn(async () => rows),
      getEmployeeTurkeyBenchmarkValues: benchmarks,
    };
    const result = await createReportingService(repository).getMyPerformance({
      userId: "user-1", employeeId: "employee-1", companyIds: ["company-1"], regionIds: [], storeIds: ["store-1"],
      mode: "live", periodType: "daily", periodStart: "2026-09-01", periodEnd: "2026-09-30",
    });
    expect(benchmarks).toHaveBeenCalledTimes(2);
    expect(benchmarks.mock.calls.every(([input]) => input.isRange === true)).toBe(true);
    expect(result.score).toEqual({ value: 42, matchedMetrics: 2, totalMetrics: 3 });
    expect(result.metrics.find(metric => metric.code === "TARGET_ACHIEVEMENT")).toMatchObject({ scoreStatus: "missing_reference", missingReason: "personnel_target_missing", contributionValue: 0 });
    expect(result.metrics.filter(metric => ["ATV", "UPT"].includes(metric.code)).map(metric => metric.contributionValue)).toEqual([21, 21]);
  });

});
