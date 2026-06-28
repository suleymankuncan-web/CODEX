import { ReportingController } from "./reporting.controller";

describe("ReportingController store score breakdown", () => {
  it("passes snapshot, store, and store scope to the reporting service", async () => {
    const reportingService = {
      getStoreMonthlyScoreBreakdown: jest.fn(async () => ({
        totalScore: 100,
      })),
    };
    const controller = new ReportingController(
      reportingService as never,
      { getRankings: jest.fn() } as never,
      {} as never,
    );

    await controller.getStoreScoreBreakdown(
      {
        user: {
          roleCodes: ["STORE_MANAGER"],
          scope: {
            companyIds: [],
            regionIds: [],
            storeIds: ["store-1"],
          },
          actionScope: {
            assignedStoreIds: ["store-1"],
          },
        },
      },
      {
        snapshotRunId: "snapshot-1",
        storeId: "store-1",
      },
    );

    expect(reportingService.getStoreMonthlyScoreBreakdown).toHaveBeenCalledWith({
      snapshotRunId: "snapshot-1",
      storeId: "store-1",
      storeIds: ["store-1"],
    });
  });

  it("passes scoped personnel profile requests to the reporting service", async () => {
    const reportingService = {
      getPersonnelPerformance: jest.fn(async () => ({
        employee: { employeeId: "employee-2" },
      })),
    };
    const controller = new ReportingController(
      reportingService as never,
      { getRankings: jest.fn() } as never,
      {} as never,
    );

    await controller.getPersonnelPerformance(
      {
        user: {
          userId: "manager-1",
          employeeId: "manager-employee",
          roleCodes: ["STORE_MANAGER"],
          scope: {
            companyIds: ["company-1"],
            regionIds: ["region-1"],
            storeIds: ["store-raw"],
          },
          actionScope: {
            assignedStoreIds: ["store-1"],
          },
        },
      },
      "employee-2",
      {
        mode: "live",
        periodType: "monthly",
        periodStart: "2026-03-01",
      },
    );

    expect(reportingService.getPersonnelPerformance).toHaveBeenCalledWith({
      userId: "manager-1",
      employeeId: "manager-employee",
      targetEmployeeId: "employee-2",
      roleCodes: ["STORE_MANAGER"],
      identityCompanyIds: ["company-1"],
      companyIds: [],
      regionIds: [],
      storeIds: ["store-1"],
      assignedStoreIds: ["store-1"],
      mode: "live",
      snapshotDate: undefined,
      periodType: "monthly",
      periodStart: "2026-03-01",
    });
  });

  it("keeps broad personnel profile reads at company scope when company and region scopes coexist", async () => {
    const reportingService = {
      getPersonnelPerformance: jest.fn(async () => ({
        employee: { employeeId: "employee-2" },
      })),
    };
    const controller = new ReportingController(
      reportingService as never,
      { getRankings: jest.fn() } as never,
      {} as never,
    );

    await controller.getPersonnelPerformance(
      {
        user: {
          userId: "admin-1",
          employeeId: "admin-employee",
          roleCodes: ["SUPER_ADMIN", "REGION_MANAGER"],
          scope: {
            companyIds: ["company-1"],
            regionIds: ["region-1"],
            storeIds: ["store-raw"],
          },
          actionScope: {
            assignedStoreIds: ["store-1"],
          },
        },
      },
      "employee-2",
      {
        mode: "live",
        periodType: "monthly",
        periodStart: "2026-03-01",
      },
    );

    expect(reportingService.getPersonnelPerformance).toHaveBeenCalledWith(
      expect.objectContaining({
        companyIds: ["company-1"],
        regionIds: [],
        storeIds: [],
      }),
    );
  });
});
