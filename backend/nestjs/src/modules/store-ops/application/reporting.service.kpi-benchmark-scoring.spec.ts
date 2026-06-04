import { BadRequestException, ForbiddenException } from "@nestjs/common";
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
      listRankingStoreChecklistRows: jest.fn(async () => []),
      getPeerStorePerformanceRows: jest.fn(async () => []),
      getStoreTurkeyBenchmarkValues: jest.fn(async () => [
        { kpi_code: "UPT", benchmark_value: "3" },
      ]),
    };
    const service = createReportingService(reportingRepository);

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

  it("feeds completed BM and VM checklist visits into live store KPI highlights", async () => {
    const reportingRepository = {
      getStoreNameById: jest.fn(async () => "Marmara Park"),
      listStoreKpiPeriods: jest.fn(async () => [
        {
          period_type: "monthly",
          period_start: "2026-03-01",
          period_end: "2026-03-31",
        },
      ]),
      getLatestStoreKpiPeriod: jest.fn(async () => ({
        period_type: "monthly",
        period_start: "2026-03-01",
        period_end: "2026-03-31",
      })),
      getStorePerformanceRows: jest.fn(async () => [
        {
          kpi_code: "TARGET_ACHIEVEMENT",
          kpi_name: "Hedef gerceklestirme",
          actual_value: "100",
          target_value: "100",
          store_name: "Marmara Park",
        },
      ]),
      listRankingStoreChecklistRows: jest.fn(async () => [
        {
          store_id: "store-1",
          store_name: "Marmara Park",
          region_id: null,
          region_name: null,
          region_manager_user_id: null,
          region_manager_name: null,
          kpi_code: "BM_CHECKLIST",
          kpi_name: "BM Checklist",
          actual_value: "80",
          target_value: null,
        },
        {
          store_id: "store-1",
          store_name: "Marmara Park",
          region_id: null,
          region_name: null,
          region_manager_user_id: null,
          region_manager_name: null,
          kpi_code: "VM_CHECKLIST",
          kpi_name: "VM Checklist",
          actual_value: "100",
          target_value: null,
        },
      ]),
      getPeerStorePerformanceRows: jest.fn(async () => []),
      getStoreTurkeyBenchmarkValues: jest.fn(async () => []),
    };
    const service = createReportingService(reportingRepository);

    const result = await service.getStoreKpiHighlights({
      companyIds: ["company-1"],
      regionIds: [],
      storeIds: ["store-1"],
      periodType: "monthly",
    });

    expect(reportingRepository.listRankingStoreChecklistRows).toHaveBeenCalledWith({
      companyIds: ["company-1"],
      periodStart: "2026-03-01",
      periodEnd: "2026-03-31",
    });
    expect(result.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "BM_CHECKLIST",
          actualValue: 80,
          achievementRate: 0.8,
          scoreContribution: 4,
          scoreStatus: "scored",
        }),
        expect.objectContaining({
          code: "VM_CHECKLIST",
          actualValue: 100,
          achievementRate: 1,
          scoreContribution: 5,
          scoreStatus: "scored",
        }),
      ]),
    );
  });

  it("reads selected store KPI highlights when the store is inside active region-manager scope", async () => {
    const reportingRepository = {
      canRegionManagerReadStore: jest.fn(async () => true),
      getStoreScopeById: jest.fn(),
      getStoreNameById: jest.fn(async () => "IstinyePark"),
      listStoreKpiPeriods: jest.fn(async () => []),
      getLatestStoreKpiPeriod: jest.fn(async () => null),
    };
    const service = createReportingService(reportingRepository);

    const result = await service.getStoreKpiHighlights({
      companyIds: [],
      regionIds: [],
      storeIds: [],
      storeId: "store-2",
      regionManagerUserId: "region-manager-user",
      periodType: "monthly",
      periodStart: "2026-05-01",
    });

    expect(reportingRepository.canRegionManagerReadStore).toHaveBeenCalledWith({
      userId: "region-manager-user",
      storeId: "store-2",
    });
    expect(reportingRepository.getStoreScopeById).not.toHaveBeenCalled();
    expect(reportingRepository.getLatestStoreKpiPeriod).toHaveBeenCalledWith(
      expect.objectContaining({
        storeId: "store-2",
        periodType: "monthly",
        periodStart: "2026-05-01",
      }),
    );
    expect(result.store).toEqual({
      storeId: "store-2",
      storeName: "IstinyePark",
    });
    expect(result.partial.isPartial).toBe(true);
  });

  it("blocks selected store KPI highlights outside the caller store scope", async () => {
    const reportingRepository = {
      getStoreScopeById: jest.fn(async () => ({
        store_id: "store-2",
        company_id: "company-1",
        region_id: "region-2",
      })),
      getStoreNameById: jest.fn(),
      listStoreKpiPeriods: jest.fn(),
      getLatestStoreKpiPeriod: jest.fn(),
    };
    const service = createReportingService(reportingRepository);

    await expect(
      service.getStoreKpiHighlights({
        companyIds: [],
        regionIds: ["region-1"],
        storeIds: [],
        storeId: "store-2",
        periodType: "monthly",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(reportingRepository.getStoreNameById).not.toHaveBeenCalled();
    expect(reportingRepository.getLatestStoreKpiPeriod).not.toHaveBeenCalled();
  });

  it("does not trust aggregate region scope for dual-role selected store KPI highlights", async () => {
    const reportingRepository = {
      canRegionManagerReadStore: jest.fn(async () => false),
      getStoreScopeById: jest.fn(),
      getStoreNameById: jest.fn(),
      listStoreKpiPeriods: jest.fn(),
      getLatestStoreKpiPeriod: jest.fn(),
    };
    const service = createReportingService(reportingRepository);

    await expect(
      service.getStoreKpiHighlights({
        companyIds: [],
        regionIds: ["region-from-store-role-union"],
        storeIds: ["assigned-store-1"],
        storeId: "store-2",
        regionManagerUserId: "dual-role-user",
        periodType: "monthly",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(reportingRepository.getStoreScopeById).not.toHaveBeenCalled();
    expect(reportingRepository.getStoreNameById).not.toHaveBeenCalled();
  });

  it("allows selected store KPI highlights inside assigned store scope", async () => {
    const reportingRepository = {
      getStoreScopeById: jest.fn(),
      getStoreNameById: jest.fn(async () => "Assigned Store"),
      listStoreKpiPeriods: jest.fn(async () => []),
      getLatestStoreKpiPeriod: jest.fn(async () => null),
    };
    const service = createReportingService(reportingRepository);

    const result = await service.getStoreKpiHighlights({
      companyIds: [],
      regionIds: [],
      storeIds: ["store-1", "store-2"],
      storeId: "store-2",
      periodType: "monthly",
    });

    expect(reportingRepository.getStoreScopeById).not.toHaveBeenCalled();
    expect(reportingRepository.getLatestStoreKpiPeriod).toHaveBeenCalledWith(
      expect.objectContaining({ storeId: "store-2" }),
    );
    expect(result.store?.storeId).toBe("store-2");
  });

  it("keeps region manager KPI highlights unselected when storeId is omitted", async () => {
    const reportingRepository = {
      getStoreScopeById: jest.fn(),
      getStoreNameById: jest.fn(),
      listStoreKpiPeriods: jest.fn(),
      getLatestStoreKpiPeriod: jest.fn(),
    };
    const service = createReportingService(reportingRepository);

    const result = await service.getStoreKpiHighlights({
      companyIds: [],
      regionIds: ["region-1"],
      storeIds: [],
      periodType: "monthly",
    });

    expect(reportingRepository.getStoreScopeById).not.toHaveBeenCalled();
    expect(reportingRepository.getStoreNameById).not.toHaveBeenCalled();
    expect(result.store).toBeNull();
    expect(result.partial.isPartial).toBe(true);
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
    const service = createReportingService(reportingRepository);

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

  it("keeps the active personnel period selectable when the repository period list is empty", async () => {
    const reportingRepository = {
      resolveEmployeeIdForAuthIdentity: jest.fn(async () => "employee-1"),
      listEmployeeKpiPeriods: jest.fn(async () => []),
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
          kpi_code: "ATV",
          kpi_name: "ATV",
          target_value: null,
          personnel_target_reference_id: null,
          actual_value: "1500",
        },
      ]),
      getPeerEmployeePerformanceRows: jest.fn(async () => []),
      getEmployeeTurkeyBenchmarkValues: jest.fn(async () => [
        { kpi_code: "ATV", benchmark_value: "1000" },
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

    expect(result.availablePeriods).toEqual([
      {
        periodType: "monthly",
        periodStart: "2026-03-01",
        periodEnd: "2026-03-31",
      },
    ]);
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
    const service = createReportingService(reportingRepository);

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
    const service = createReportingService(reportingRepository);

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
    expect(reportingRepository.listEmployeeKpiPeriods).toHaveBeenCalledWith(
      expect.objectContaining({
        metricCodes: expect.arrayContaining(["TARGET_ACHIEVEMENT", "STORE_SALES"]),
      }),
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

  it("maps employee NET_SALES to personnel target achievement for published profile configs without the alias", async () => {
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
          kpi_code: "NET_SALES",
          kpi_name: "Net Sales",
          target_value: "100000",
          personnel_target_reference_id: "00000000-0000-4000-8000-000000000901",
          actual_value: "110000",
        },
      ]),
      getPeerEmployeePerformanceRows: jest.fn(async () => []),
      getEmployeeTurkeyBenchmarkValues: jest.fn(async () => []),
    };
    const service = createReportingService(
      reportingRepository,
      {
        getKpiConfigRows: jest.fn(async () => [
          {
            config_key: "store_profile",
            config_payload: {
              profileCode: "store",
              title: "Store score profile",
              summary: "Store score profile",
              futureMetricRule: "test",
              metrics: [],
            },
          },
          {
            config_key: "personnel_profile",
            config_payload: {
              profileCode: "personnel",
              title: "Personnel score profile",
              summary: "Personnel score profile",
              futureMetricRule: "test",
              metrics: [
                {
                  code: "TARGET_ACHIEVEMENT",
                  label: "Hedef gerceklestirme orani",
                  weightPercent: 100,
                  ownerRole: "STORE_PERSONNEL",
                  scoreBehavior: "warning_first",
                  direction: "HIGHER_IS_BETTER",
                  benchmarkSource: "TARGET",
                  capRatio: 1.2,
                  aliases: ["STORE_SALES", "SALES_TARGET_ACHIEVEMENT"],
                },
              ],
            },
          },
          { config_key: "ownership_matrix", config_payload: [] },
          { config_key: "grading_bands", config_payload: [] },
        ]),
        getLatestPublishedKpiConfigVersion: jest.fn(async () => null),
      },
    );

    const result = await service.getMyPerformance({
      userId: "user-1",
      employeeId: "employee-1",
      companyIds: [],
      regionIds: [],
      storeIds: ["store-1"],
      periodType: "monthly",
      periodStart: "2026-03-01",
    });

    const targetAchievement = result.metrics.find(
      (metric) => metric.code === "TARGET_ACHIEVEMENT",
    );
    expect((targetAchievement as Record<string, unknown> | undefined)?.actualValue).toBe(
      110000,
    );
    expect((targetAchievement as Record<string, unknown> | undefined)?.targetValue).toBe(
      100000,
    );
    expect((targetAchievement as Record<string, unknown> | undefined)?.scoreStatus).toBe(
      "scored",
    );
  });

  it("keeps custom imported personnel periods visible as monthly live periods", async () => {
    const targetEmployeeId = "00000000-0000-4000-8000-000000000201";
    const getEmployeeTurkeyBenchmarkValues = jest.fn(async () => [
      { kpi_code: "ATV", benchmark_value: "500" },
      { kpi_code: "UPT", benchmark_value: "2" },
    ]);
    const reportingRepository = {
      resolveEmployeeIdForAuthIdentity: jest.fn(async () => "employee-1"),
      getActiveEmployeeAssignmentScope: jest.fn(async () => ({
        employee_id: targetEmployeeId,
        first_name: "Ada",
        last_name: "Lovelace",
        company_id: "company-1",
        region_id: "region-1",
        store_id: "store-1",
        store_name: "Marmara Park",
      })),
      listEmployeeKpiPeriods: jest.fn(async () => [
        {
          period_type: "custom",
          period_start: "2026-03-01",
          period_end: "2026-03-31",
        },
      ]),
      getLatestEmployeeKpiPeriod: jest.fn(async () => ({
        period_type: "custom",
        period_start: "2026-03-01",
        period_end: "2026-03-31",
        store_id: "store-1",
      })),
      getEmployeePerformanceRows: jest.fn(async () => [
        {
          employee_id: targetEmployeeId,
          first_name: "Ada",
          last_name: "Lovelace",
          store_id: "store-1",
          store_name: "Marmara Park",
          kpi_code: "NET_SALES",
          kpi_name: "Net Sales",
          target_value: "100000",
          personnel_target_reference_id: "00000000-0000-4000-8000-000000000901",
          actual_value: "110000",
        },
        {
          employee_id: targetEmployeeId,
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
      ]),
      getPeerEmployeePerformanceRows: jest.fn(async () => []),
      getEmployeeTurkeyBenchmarkValues,
    };
    const service = createReportingService(reportingRepository);

    const result = await service.getPersonnelPerformance({
      userId: "region-manager-1",
      employeeId: "region-manager-employee",
      targetEmployeeId,
      roleCodes: ["REGION_MANAGER"],
      identityCompanyIds: [],
      companyIds: ["company-1"],
      regionIds: ["region-1"],
      storeIds: [],
      assignedStoreIds: [],
      periodType: "monthly",
      periodStart: "2026-03-01",
    });

    expect(result.availablePeriods).toEqual([
      {
        periodType: "monthly",
        periodStart: "2026-03-01",
        periodEnd: "2026-03-31",
      },
    ]);
    expect(getEmployeeTurkeyBenchmarkValues).toHaveBeenCalledWith(
      expect.objectContaining({
        periodType: "custom",
        periodStart: "2026-03-01",
        periodEnd: "2026-03-31",
      }),
    );
    expect(result.period).toEqual({
      periodStart: "2026-03-01",
      periodEnd: "2026-03-31",
    });
    expect(
      result.metrics.find((metric) => metric.code === "TARGET_ACHIEVEMENT")?.actualValue,
    ).toBe(110000);
  });

  it("keeps closed personnel profiles renderable when the selected snapshot has no score row", async () => {
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
      getEmployeePerformanceSnapshot: jest.fn(async () => null),
      getEmployeeKpiSnapshotRows: jest.fn(async () => []),
      getActiveEmployeeAssignmentScope: jest.fn(async () => ({
        employee_id: employeeId,
        external_employee_ref: "EMP-2",
        first_name: "Ada",
        last_name: "Lovelace",
        company_id: "company-1",
        region_id: "region-1",
        region_name: "Marmara",
        store_id: "store-1",
        store_name: "Marmara Park",
      })),
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

    expect(result.employee).toEqual({
      employeeId,
      displayName: "Ada Lovelace",
      storeId: "store-1",
      storeName: "Marmara Park",
    });
    expect(result.period).toEqual({
      periodStart: "2026-04-24",
      periodEnd: "2026-04-24",
    });
    expect(result.availablePeriods).toEqual([
      {
        periodType: "daily",
        periodStart: "2026-04-24",
        periodEnd: "2026-04-24",
      },
    ]);
  });
});

describe("ReportingService personnel performance profile access", () => {
  const currentEmployeeId = "00000000-0000-0000-0000-000000000201";
  const targetEmployeeId = "00000000-0000-0000-0000-000000000202";

  function createRepositoryMock(input?: {
    currentEmployeeId?: string | null;
    targetStoreId?: string | null;
    targetRegionId?: string | null;
    targetCompanyId?: string | null;
    latestPeriod?: {
      period_type?: string;
      period_start: string;
      period_end: string;
      store_id: string | null;
    } | null;
    employeeRows?: Array<{
      employee_id: string;
      first_name: string;
      last_name: string;
      store_id: string | null;
      store_name: string | null;
      kpi_code: string;
      kpi_name: string;
      target_value: string | null;
      personnel_target_reference_id: string | null;
      actual_value: string;
    }>;
  }) {
    const targetStoreId = input?.targetStoreId ?? "store-1";
    const targetRegionId = input?.targetRegionId ?? "region-1";
    const targetCompanyId = input?.targetCompanyId ?? "company-1";

    return {
      resolveEmployeeIdForAuthIdentity: jest.fn(async () => input?.currentEmployeeId ?? currentEmployeeId),
      getActiveEmployeeAssignmentScope: jest.fn(async () => ({
        employee_id: targetEmployeeId,
        external_employee_ref: "EMP-2",
        first_name: "Ada",
        last_name: "Lovelace",
        company_id: targetCompanyId,
        region_id: targetRegionId,
        region_name: "Marmara",
        store_id: targetStoreId,
        store_name: "Marmara Park",
      })),
      listEmployeeKpiPeriods: jest.fn(async () => [
        {
          period_type: "monthly",
          period_start: "2026-03-01",
          period_end: "2026-03-31",
        },
      ]),
      getLatestEmployeeKpiPeriod: jest.fn(async () => (
        input?.latestPeriod === undefined
          ? {
              period_start: "2026-03-01",
              period_end: "2026-03-31",
              store_id: targetStoreId,
            }
          : input.latestPeriod
      )),
      getEmployeePerformanceRows: jest.fn(async () => input?.employeeRows ?? [
        {
          employee_id: targetEmployeeId,
          first_name: "Ada",
          last_name: "Lovelace",
          store_id: targetStoreId,
          store_name: "Marmara Park",
          kpi_code: "UPT",
          kpi_name: "UPT",
          target_value: null,
          personnel_target_reference_id: null,
          actual_value: "3.4",
        },
      ]),
      getPeerEmployeePerformanceRows: jest.fn(async () => []),
      getEmployeeTurkeyBenchmarkValues: jest.fn(async () => [
        { kpi_code: "UPT", benchmark_value: "2.8" },
      ]),
    };
  }

  function createService(repository: ReturnType<typeof createRepositoryMock>) {
    return createReportingService(repository);
  }

  it("blocks store personnel from opening another employee profile", async () => {
    const repository = createRepositoryMock({ currentEmployeeId });
    const service = createService(repository);

    await expect(
      service.getPersonnelPerformance({
        userId: "user-1",
        employeeId: currentEmployeeId,
        targetEmployeeId,
        roleCodes: ["STORE_PERSONNEL"],
        companyIds: ["company-1"],
        regionIds: [],
        storeIds: ["store-1"],
        assignedStoreIds: [],
        periodType: "monthly",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(repository.getEmployeePerformanceRows).not.toHaveBeenCalled();
  });

  it("allows store managers to open assigned-store personnel profiles", async () => {
    const repository = createRepositoryMock({ targetStoreId: "store-1" });
    const service = createService(repository);

    const result = await service.getPersonnelPerformance({
      userId: "manager-1",
      employeeId: "manager-employee",
      targetEmployeeId,
      roleCodes: ["STORE_MANAGER"],
      companyIds: [],
      regionIds: [],
      storeIds: ["store-1"],
      assignedStoreIds: ["store-1"],
      periodType: "monthly",
    });

    expect(result.employee?.employeeId).toBe(targetEmployeeId);
    expect(repository.getEmployeePerformanceRows).toHaveBeenCalledWith(
      expect.objectContaining({ employeeId: targetEmployeeId }),
    );
  });

  it("allows region managers to open profiles inside their region", async () => {
    const repository = createRepositoryMock({ targetRegionId: "region-1" });
    const service = createService(repository);

    const result = await service.getPersonnelPerformance({
      userId: "region-manager-1",
      employeeId: "region-manager-employee",
      targetEmployeeId,
      roleCodes: ["REGION_MANAGER"],
      companyIds: ["company-1"],
      regionIds: ["region-1"],
      storeIds: [],
      assignedStoreIds: [],
      periodType: "monthly",
    });

    expect(result.employee?.displayName).toBe("Ada Lovelace");
  });

  it("blocks region managers from opening profiles outside their region", async () => {
    const repository = createRepositoryMock({ targetRegionId: "region-2" });
    const service = createService(repository);

    await expect(
      service.getPersonnelPerformance({
        userId: "region-manager-1",
        employeeId: "region-manager-employee",
        targetEmployeeId,
        roleCodes: ["REGION_MANAGER"],
        companyIds: [],
        regionIds: ["region-1"],
        storeIds: [],
        assignedStoreIds: [],
        periodType: "monthly",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(repository.getEmployeePerformanceRows).not.toHaveBeenCalled();
  });

  it("keeps the selected personnel identity when the requested live period has no KPI rows", async () => {
    const repository = createRepositoryMock({
      targetRegionId: "region-1",
      latestPeriod: null,
    });
    const service = createService(repository);

    const result = await service.getPersonnelPerformance({
      userId: "region-manager-1",
      employeeId: "region-manager-employee",
      targetEmployeeId,
      roleCodes: ["REGION_MANAGER"],
      companyIds: ["company-1"],
      regionIds: ["region-1"],
      storeIds: [],
      assignedStoreIds: [],
      periodType: "monthly",
      periodStart: "2026-05-01",
    });

    expect(result.employee).toEqual({
      employeeId: targetEmployeeId,
      displayName: "Ada Lovelace",
      storeId: "store-1",
      storeName: "Marmara Park",
    });
    expect(result.period).toBeNull();
    expect(result.partial.isPartial).toBe(true);
  });

  it("allows super admins without explicit company scope to open global personnel profiles", async () => {
    const repository = createRepositoryMock();
    const service = createService(repository);

    const result = await service.getPersonnelPerformance({
      userId: "super-admin-1",
      employeeId: "super-admin-employee",
      targetEmployeeId,
      roleCodes: ["SUPER_ADMIN"],
      companyIds: [],
      regionIds: [],
      storeIds: [],
      assignedStoreIds: [],
      periodType: "monthly",
    });

    expect(result.employee?.employeeId).toBe(targetEmployeeId);
    expect(repository.getLatestEmployeeKpiPeriod).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeId: targetEmployeeId,
        companyIds: [],
        regionIds: [],
        storeIds: [],
        allowGlobalScope: true,
      }),
    );
    expect(repository.listEmployeeKpiPeriods).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeId: targetEmployeeId,
        allowGlobalScope: true,
      }),
    );
  });

  it("keeps unscoped region managers blocked from global personnel profiles", async () => {
    const repository = createRepositoryMock({ targetRegionId: "region-1" });
    const service = createService(repository);

    await expect(
      service.getPersonnelPerformance({
        userId: "region-manager-1",
        employeeId: "region-manager-employee",
        targetEmployeeId,
        roleCodes: ["REGION_MANAGER"],
        companyIds: [],
        regionIds: [],
        storeIds: [],
        assignedStoreIds: [],
        periodType: "monthly",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(repository.getEmployeePerformanceRows).not.toHaveBeenCalled();
  });

  it("rejects malformed personnel profile ids before querying assignment scope", async () => {
    const repository = createRepositoryMock();
    const service = createService(repository);

    await expect(
      service.getPersonnelPerformance({
        userId: "manager-1",
        employeeId: "manager-employee",
        targetEmployeeId: "not-a-uuid",
        roleCodes: ["STORE_MANAGER"],
        companyIds: [],
        regionIds: [],
        storeIds: ["store-1"],
        assignedStoreIds: ["store-1"],
        periodType: "monthly",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.getActiveEmployeeAssignmentScope).not.toHaveBeenCalled();
  });
});
