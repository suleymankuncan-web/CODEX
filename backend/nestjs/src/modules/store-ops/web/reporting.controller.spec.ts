import { ReportingController } from "./reporting.controller";
import { REQUIRED_ROLES_KEY } from "../../auth/decorators/roles.decorator";

describe("ReportingController", () => {
  const createController = () => {
    const reportingService = {
      getStoreKpiHighlights: jest.fn(async () => ({ ok: true })),
      getStoreMonthlyScoreBreakdown: jest.fn(async () => ({ ok: true })),
      getPersonnelPerformance: jest.fn(async () => ({ ok: true })),
      getRankings: jest.fn(async () => ({ ok: true })),
    };
    const rankingService = {};

    return {
      controller: new ReportingController(
        reportingService as never,
        rankingService as never,
      ),
      reportingService,
    };
  };

  it("keeps store manager live KPI highlights limited to assigned stores", async () => {
    const { controller, reportingService } = createController();

    await controller.getStoreKpiHighlights(
      {
        user: {
          roleCodes: ["STORE_MANAGER"],
          scope: {
            companyIds: ["company-1"],
            regionIds: ["region-1"],
            storeIds: [],
          },
          actionScope: {
            assignedStoreIds: ["store-1"],
          },
        },
      },
      {
        periodType: "monthly",
        periodStart: "2026-04-01",
      },
    );

    expect(reportingService.getStoreKpiHighlights).toHaveBeenCalledWith({
      companyIds: [],
      regionIds: [],
      storeIds: ["store-1"],
      periodType: "monthly",
      periodStart: "2026-04-01",
      storeId: undefined,
      regionManagerUserId: undefined,
    });
  });

  it("keeps dual-role store manager KPI highlights defaulting to assigned stores", async () => {
    const { controller, reportingService } = createController();

    await controller.getStoreKpiHighlights(
      {
        user: {
          userId: "dual-role-user",
          roleCodes: ["REGION_MANAGER", "STORE_MANAGER"],
          scope: {
            companyIds: ["company-1"],
            regionIds: ["region-1"],
            storeIds: ["store-from-role-union"],
          },
          actionScope: {
            assignedStoreIds: ["assigned-store-1"],
          },
        },
      },
      {
        periodType: "monthly",
        periodStart: "2026-04-01",
      },
    );

    expect(reportingService.getStoreKpiHighlights).toHaveBeenCalledWith({
      companyIds: [],
      regionIds: [],
      storeIds: ["assigned-store-1"],
      periodType: "monthly",
      periodStart: "2026-04-01",
      storeId: undefined,
      regionManagerUserId: "dual-role-user",
    });
  });

  it("passes selected store KPI highlights through region scope for region managers", async () => {
    const { controller, reportingService } = createController();

    await controller.getStoreKpiHighlights(
      {
        user: {
          userId: "region-manager-user",
          roleCodes: ["REGION_MANAGER"],
          scope: {
            companyIds: ["company-1"],
            regionIds: ["region-1"],
            storeIds: [],
          },
          actionScope: {
            assignedStoreIds: [],
          },
        },
      },
      {
        periodType: "monthly",
        periodStart: "2026-04-01",
        storeId: "00000000-0000-4000-8000-000000000101",
      },
    );

    expect(reportingService.getStoreKpiHighlights).toHaveBeenCalledWith({
      companyIds: [],
      regionIds: [],
      storeIds: [],
      periodType: "monthly",
      periodStart: "2026-04-01",
      storeId: "00000000-0000-4000-8000-000000000101",
      regionManagerUserId: "region-manager-user",
    });
  });

  it("does not select a default store for region manager KPI highlights without storeId", async () => {
    const { controller, reportingService } = createController();

    await controller.getStoreKpiHighlights(
      {
        user: {
          userId: "region-manager-user",
          roleCodes: ["REGION_MANAGER"],
          scope: {
            companyIds: ["company-1"],
            regionIds: ["region-1"],
            storeIds: [],
          },
          actionScope: {
            assignedStoreIds: [],
          },
        },
      },
      {
        periodType: "monthly",
        periodStart: "2026-04-01",
      },
    );

    expect(reportingService.getStoreKpiHighlights).toHaveBeenCalledWith({
      companyIds: [],
      regionIds: [],
      storeIds: [],
      periodType: "monthly",
      periodStart: "2026-04-01",
      storeId: undefined,
      regionManagerUserId: "region-manager-user",
    });
  });

  it("keeps store manager score breakdown limited to assigned stores", async () => {
    const { controller, reportingService } = createController();

    await controller.getStoreScoreBreakdown(
      {
        user: {
          roleCodes: ["STORE_MANAGER"],
          scope: {
            companyIds: ["company-1"],
            regionIds: ["region-1"],
            storeIds: [],
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

  it("preserves region scope for region manager personnel profile reads", async () => {
    const { controller, reportingService } = createController();

    await controller.getPersonnelPerformance(
      {
        user: {
          userId: "region-manager-user",
          employeeId: "manager-employee",
          roleCodes: ["REGION_MANAGER"],
          scope: {
            companyIds: ["company-1"],
            regionIds: ["region-1"],
            storeIds: [],
          },
          actionScope: {
            assignedStoreIds: ["store-1"],
          },
        },
      },
      "employee-in-region",
      {
        mode: "live",
        periodType: "monthly",
        periodStart: "2026-05-01",
      },
    );

    expect(reportingService.getPersonnelPerformance).toHaveBeenCalledWith(
      expect.objectContaining({
        roleCodes: ["REGION_MANAGER"],
        identityCompanyIds: ["company-1"],
        companyIds: [],
        regionIds: ["region-1"],
        storeIds: [],
        assignedStoreIds: ["store-1"],
        targetEmployeeId: "employee-in-region",
      }),
    );
  });

  it("allows ranking detail roles to load closed day snapshot options", () => {
    const { controller } = createController();

    const roles = Reflect.getMetadata(
      REQUIRED_ROLES_KEY,
      controller.listSnapshotRuns,
    );

    expect(roles).toEqual(expect.arrayContaining(["REGION_MANAGER", "SUPER_ADMIN"]));
  });

  it("allows region managers to request selected store KPI highlights", () => {
    const { controller } = createController();

    const roles = Reflect.getMetadata(
      REQUIRED_ROLES_KEY,
      controller.getStoreKpiHighlights,
    );

    expect(roles).toEqual(expect.arrayContaining(["STORE_MANAGER", "REGION_MANAGER"]));
  });

  it("uses the Report Viewer role company scope for KPI highlights", async () => {
    const { controller, reportingService } = createController();

    await controller.getStoreKpiHighlights(
      {
        user: {
          userId: "report-viewer-user",
          roleCodes: ["STORE_MANAGER", "REPORT_VIEWER"],
          scope: {
            companyIds: ["company-from-manager"],
            regionIds: ["region-from-manager"],
            storeIds: ["store-from-manager"],
          },
          roleScopes: {
            REPORT_VIEWER: {
              companyIds: ["company-a"],
              regionIds: [],
              storeIds: [],
            },
          },
          actionScope: { assignedStoreIds: ["store-from-manager"] },
        },
      },
      { periodType: "monthly", storeId: "store-a" },
    );

    expect(reportingService.getStoreKpiHighlights).toHaveBeenCalledWith(
      expect.objectContaining({
        companyIds: ["company-a"],
        regionIds: [],
        storeIds: [],
        storeId: "store-a",
      }),
    );
  });

  it("uses the Report Viewer company scope for personnel detail", async () => {
    const { controller, reportingService } = createController();

    await controller.getPersonnelPerformance(
      {
        user: {
          userId: "report-viewer-user",
          roleCodes: ["REPORT_VIEWER"],
          scope: {
            companyIds: ["company-b"],
            regionIds: [],
            storeIds: [],
          },
          roleScopes: {
            REPORT_VIEWER: {
              companyIds: ["company-a"],
              regionIds: [],
              storeIds: [],
            },
          },
          actionScope: { assignedStoreIds: [] },
        },
      },
      "employee-a",
      { mode: "live", periodType: "monthly" },
    );

    expect(reportingService.getPersonnelPerformance).toHaveBeenCalledWith(
      expect.objectContaining({
        identityCompanyIds: ["company-a"],
        companyIds: ["company-a"],
        regionIds: [],
        storeIds: [],
      }),
    );
  });
});
