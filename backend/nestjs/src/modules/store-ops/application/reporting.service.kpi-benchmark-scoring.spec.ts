import { ReportingService } from "./reporting.service";

describe("ReportingService KPI benchmark scoring", () => {
  it("returns capped benchmark metadata for store live KPI highlights", async () => {
    const reportingRepository = {
      getStoreNameById: jest.fn(async () => "Marmara Park"),
      listStoreKpiPeriods: jest.fn(async () => [
        {
          period_type: "daily",
          period_start: "2026-03-01",
          period_end: "2026-03-01",
        },
      ]),
      getLatestStoreKpiPeriod: jest.fn(async () => ({
        period_type: "daily",
        period_start: "2026-03-01",
        period_end: "2026-03-01",
      })),
      getStorePerformanceRows: jest.fn(async () => [
        {
          kpi_code: "UPT",
          kpi_name: "UPT",
          actual_value: "4.44",
          target_value: null,
          store_name: "Marmara Park",
        },
      ]),
      getPeerStorePerformanceRows: jest.fn(async () => []),
      getStoreTurkeyBenchmarkValues: jest.fn(async () => [
        { kpi_code: "UPT", benchmark_value: "3" },
      ]),
    };
    const service = new ReportingService(
      reportingRepository as never,
      { getKpiConfigRows: jest.fn(async () => []) } as never,
      {} as never,
      {} as never,
    );

    const result = await service.getStoreKpiHighlights({
      companyIds: [],
      regionIds: [],
      storeIds: ["store-1"],
      periodType: "daily",
    });

    const upt = result.metrics.find((metric) => metric.code === "UPT");
    expect((upt as Record<string, unknown> | undefined)?.actualRatio).toBe(1.48);
    expect((upt as Record<string, unknown> | undefined)?.scoredRatio).toBe(1.2);
    expect((upt as Record<string, unknown> | undefined)?.isCapped).toBe(true);
    expect((upt as Record<string, unknown> | undefined)?.scoreContribution).toBe(18);
  });

  it("does not score personnel target achievement without an approved target", async () => {
    const reportingRepository = {
      resolveEmployeeIdForAuthIdentity: jest.fn(async () => "employee-1"),
      listEmployeeKpiPeriods: jest.fn(async () => [
        {
          period_type: "daily",
          period_start: "2026-03-01",
          period_end: "2026-03-01",
        },
      ]),
      getLatestEmployeeKpiPeriod: jest.fn(async () => ({
        period_start: "2026-03-01",
        period_end: "2026-03-01",
        store_id: "store-1",
      })),
      getEmployeePerformanceRows: jest.fn(async () => [
        {
          employee_id: "employee-1",
          first_name: "Ada",
          last_name: "Lovelace",
          store_id: "store-1",
          store_name: "Marmara Park",
          kpi_code: "TARGET_ACHIEVEMENT",
          kpi_name: "Target Achievement",
          target_value: null,
          personnel_target_reference_id: null,
          actual_value: "110000",
        },
      ]),
      getPeerEmployeePerformanceRows: jest.fn(async () => []),
      getEmployeeTurkeyBenchmarkValues: jest.fn(async () => []),
    };
    const service = new ReportingService(
      reportingRepository as never,
      { getKpiConfigRows: jest.fn(async () => []) } as never,
      {} as never,
      {} as never,
    );

    const result = await service.getMyPerformance({
      userId: "user-1",
      employeeId: "employee-1",
      companyIds: [],
      regionIds: [],
      storeIds: ["store-1"],
      periodType: "daily",
    });

    const targetAchievement = result.metrics.find(
      (metric) => metric.code === "TARGET_ACHIEVEMENT",
    );
    expect((targetAchievement as Record<string, unknown> | undefined)?.scoreStatus).toBe(
      "missing_reference",
    );
    expect((targetAchievement as Record<string, unknown> | undefined)?.missingReason).toBe(
      "personnel_target_missing",
    );
    expect(targetAchievement?.contributionValue).toBe(0);
  });

  it("falls back to global personnel benchmarks when scoped benchmark rows are unusable", async () => {
    const getEmployeeTurkeyBenchmarkValues = jest
      .fn()
      .mockResolvedValueOnce([
        { kpi_code: "ATV", benchmark_value: null },
        { kpi_code: "UPT", benchmark_value: null },
      ])
      .mockResolvedValueOnce([
        { kpi_code: "ATV", benchmark_value: "4" },
        { kpi_code: "UPT", benchmark_value: "2" },
      ]);
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
      getEmployeePerformanceRows: jest.fn(async () => [
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
          actual_value: "6",
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
      ]),
      getPeerEmployeePerformanceRows: jest.fn(async () => []),
      getEmployeeTurkeyBenchmarkValues,
    };
    const service = new ReportingService(
      reportingRepository as never,
      { getKpiConfigRows: jest.fn(async () => []) } as never,
      {} as never,
      {} as never,
    );

    const result = await service.getMyPerformance({
      userId: "user-1",
      employeeId: "employee-1",
      companyIds: ["company-1"],
      regionIds: [],
      storeIds: ["store-1"],
      periodType: "monthly",
    });

    expect(getEmployeeTurkeyBenchmarkValues).toHaveBeenCalledTimes(2);
    expect(getEmployeeTurkeyBenchmarkValues).toHaveBeenLastCalledWith({
      companyId: undefined,
      periodType: "monthly",
      periodStart: "2026-03-01",
      periodEnd: "2026-03-31",
    });

    const atv = result.metrics.find((metric) => metric.code === "ATV");
    const upt = result.metrics.find((metric) => metric.code === "UPT");
    expect((atv as Record<string, unknown> | undefined)?.scoreStatus).toBe("scored");
    expect((atv as Record<string, unknown> | undefined)?.benchmarkValue).toBe(4);
    expect((upt as Record<string, unknown> | undefined)?.scoreStatus).toBe("scored");
    expect((upt as Record<string, unknown> | undefined)?.benchmarkValue).toBe(2);
  });

  it("scores personnel target achievement against an approved target reference", async () => {
    const reportingRepository = {
      resolveEmployeeIdForAuthIdentity: jest.fn(async () => "employee-1"),
      listEmployeeKpiPeriods: jest.fn(async () => [
        {
          period_type: "daily",
          period_start: "2026-03-01",
          period_end: "2026-03-01",
        },
      ]),
      getLatestEmployeeKpiPeriod: jest.fn(async () => ({
        period_start: "2026-03-01",
        period_end: "2026-03-01",
        store_id: "store-1",
      })),
      getEmployeePerformanceRows: jest.fn(async () => [
        {
          employee_id: "employee-1",
          first_name: "Ada",
          last_name: "Lovelace",
          store_id: "store-1",
          store_name: "Marmara Park",
          kpi_code: "TARGET_ACHIEVEMENT",
          kpi_name: "Target Achievement",
          target_value: "100000",
          personnel_target_reference_id: "00000000-0000-4000-8000-000000000901",
          actual_value: "110000",
        },
      ]),
      getPeerEmployeePerformanceRows: jest.fn(async () => []),
      getEmployeeTurkeyBenchmarkValues: jest.fn(async () => []),
    };
    const service = new ReportingService(
      reportingRepository as never,
      { getKpiConfigRows: jest.fn(async () => []) } as never,
      {} as never,
      {} as never,
    );

    const result = await service.getMyPerformance({
      userId: "user-1",
      employeeId: "employee-1",
      companyIds: [],
      regionIds: [],
      storeIds: ["store-1"],
      periodType: "daily",
    });

    const targetAchievement = result.metrics.find(
      (metric) => metric.code === "TARGET_ACHIEVEMENT",
    );
    expect((targetAchievement as Record<string, unknown> | undefined)?.scoreStatus).toBe(
      "scored",
    );
    expect((targetAchievement as Record<string, unknown> | undefined)?.targetValue).toBe(
      100000,
    );
    expect((targetAchievement as Record<string, unknown> | undefined)?.actualRatio).toBe(
      1.1,
    );
    expect((targetAchievement as Record<string, unknown> | undefined)?.benchmarkSource).toBe(
      "TARGET",
    );
  });
});
