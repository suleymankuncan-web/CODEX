import { BadRequestException, ForbiddenException } from "@nestjs/common";
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
    const service = new ReportingService(
      reportingRepository as never,
      { getKpiConfigRows: jest.fn(async () => []) } as never,
      {} as never,
      {} as never,
    );

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
      getLatestEmployeeKpiPeriod: jest.fn(async () => ({
        period_start: "2026-03-01",
        period_end: "2026-03-31",
        store_id: targetStoreId,
      })),
      getEmployeePerformanceRows: jest.fn(async () => [
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
    return new ReportingService(
      repository as never,
      { getKpiConfigRows: jest.fn(async () => []) } as never,
      {} as never,
      {} as never,
    );
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
