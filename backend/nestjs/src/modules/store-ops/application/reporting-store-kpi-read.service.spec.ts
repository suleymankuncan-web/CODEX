import { ReportingStoreKpiReadService } from "./reporting-store-kpi-read.service";

describe("ReportingStoreKpiReadService", () => {
  it("normalizes GSM approval benchmark aliases for live store KPI highlights", async () => {
    const reportingRepository = {
      getStoreNameById: jest.fn(async () => "Marmara Park"),
      listStoreKpiPeriods: jest.fn(async () => [
        {
          period_type: "monthly",
          period_start: "2026-06-01",
          period_end: "2026-06-30",
        },
      ]),
      getLatestStoreKpiPeriod: jest.fn(async () => ({
        period_type: "monthly",
        period_start: "2026-06-01",
        period_end: "2026-06-30",
      })),
      getStorePerformanceRows: jest.fn(async () => [
        {
          kpi_code: "GSM_ONAY",
          kpi_name: "GSM Onay",
          actual_value: "40",
          target_value: null,
          achievement_rate: "0.4",
          store_name: "Marmara Park",
        },
      ]),
      getStoreTurkeyBenchmarkValues: jest.fn(async () => [
        { kpi_code: "gsm_onay", benchmark_value: "56.2" },
      ]),
    };
    const service = new ReportingStoreKpiReadService(
      async () => ({
        storeProfile: {
          futureMetricRule: "",
          metrics: [
            {
              code: "GSM_ONAY",
              label: "GSM Onay",
              weightPercent: 5,
              ownerRole: "STORE_MANAGER",
              scoreBehavior: "warning_first",
              direction: "HIGHER_IS_BETTER",
              benchmarkSource: "TARGET",
              capRatio: 1,
              aliases: [],
            },
          ],
          profileCode: "store",
          summary: "Store score",
          title: "Store score",
        },
      }),
      {} as never,
      reportingRepository as never,
      {} as never,
    );

    const result = await service.getStoreKpiHighlights({
      companyIds: ["company-1"],
      regionIds: [],
      storeIds: ["store-1"],
      periodType: "monthly",
    });

    const gsm = result.metrics.find((metric) => metric.code === "GSM_ONAY");
    expect((gsm as Record<string, unknown> | undefined)?.benchmarkSource).toBe("TURKEY_AVERAGE");
    expect((gsm as Record<string, unknown> | undefined)?.benchmarkValue).toBe(56.2);
    expect((gsm as Record<string, unknown> | undefined)?.achievementRate).toBe(0.4);
    expect((gsm as Record<string, unknown> | undefined)?.scoreContribution).toBe(2);
  });
});
