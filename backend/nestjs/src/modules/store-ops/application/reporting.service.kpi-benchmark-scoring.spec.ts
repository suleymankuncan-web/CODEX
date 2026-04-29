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
      "benchmark_missing",
    );
    expect(targetAchievement?.contributionValue).toBe(0);
  });
});
