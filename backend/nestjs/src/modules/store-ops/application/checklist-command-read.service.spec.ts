import { ChecklistCommandReadService } from "./checklist-command-read.service";

describe("ChecklistCommandReadService", () => {
  it("returns bounded Report Viewer region aggregates from only the role company scope", async () => {
    const repository = {
      list: jest.fn(),
      listRegions: jest.fn(async () => ({
        period: "2026-07",
        metrics: {
          totalStores: 40,
          missingVisitStores: 7,
          storesWithOpenActions: 5,
          openActionCount: 8,
          completedCoverageStores: 33,
        },
        items: [{ regionId: "region-1" }],
        total: 1,
      })),
    };
    const service = new ChecklistCommandReadService(repository as never);

    await expect(
      service.listRegions({
        actorRoleCodes: ["REPORT_VIEWER"],
        actorReadScope: { companyIds: ["aggregate-company"], regionIds: [], storeIds: [] },
        roleScopes: {
          REPORT_VIEWER: { companyIds: ["viewer-company"], regionIds: [], storeIds: [] },
        },
        period: "2026-07",
        query: "  Marmara ",
        signal: "missing_visit",
        sort: "missing_desc",
        limit: 20,
        offset: 0,
      }),
    ).resolves.toEqual(expect.objectContaining({
      view: "report_viewer",
      page: { total: 1, limit: 20, offset: 0, hasMore: false },
    }));
    expect(repository.listRegions).toHaveBeenCalledWith(expect.objectContaining({
      companyIds: ["viewer-company"],
      query: "  Marmara ",
      signal: "missing_visit",
    }));
  });

  it("rejects non Report Viewer roles from region aggregates", async () => {
    const repository = { list: jest.fn(), listRegions: jest.fn() };
    const service = new ChecklistCommandReadService(repository as never);

    await expect(service.listRegions({
      actorRoleCodes: ["REGION_MANAGER"],
      actorReadScope: { companyIds: [], regionIds: ["region-1"], storeIds: [] },
      roleScopes: {
        REGION_MANAGER: { companyIds: [], regionIds: ["region-1"], storeIds: [] },
      },
    })).rejects.toThrow("Report Viewer");
    expect(repository.listRegions).not.toHaveBeenCalled();
  });

  it("does not let Report Viewer select stores through a legacy region identifier", async () => {
    const repository = { list: jest.fn(), listRegions: jest.fn() };
    const service = new ChecklistCommandReadService(repository as never);

    await expect(service.list({
      actorRoleCodes: ["REPORT_VIEWER"],
      actorReadScope: { companyIds: [], regionIds: [], storeIds: [] },
      roleScopes: { REPORT_VIEWER: { companyIds: ["viewer-company"], regionIds: [], storeIds: [] } },
      regionId: "33333333-3333-4333-8333-333333333333",
    })).rejects.toThrow("Region Manager identity");
    expect(repository.list).not.toHaveBeenCalled();
  });

  it("fails closed without querying when Report Viewer company scope is empty", async () => {
    const repository = { list: jest.fn(), listRegions: jest.fn() };
    const service = new ChecklistCommandReadService(repository as never);

    await expect(service.listRegions({
      actorRoleCodes: ["REPORT_VIEWER"],
      actorReadScope: { companyIds: ["aggregate-company-must-not-leak"], regionIds: [], storeIds: [] },
      roleScopes: {
        REPORT_VIEWER: { companyIds: [], regionIds: [], storeIds: [] },
      },
      period: "2026-07",
    })).resolves.toEqual(expect.objectContaining({
      metrics: {
        totalStores: 0,
        missingVisitStores: 0,
        storesWithOpenActions: 0,
        openActionCount: 0,
        completedCoverageStores: 0,
      },
      items: [],
      page: { total: 0, limit: 20, offset: 0, hasMore: false },
    }));
    expect(repository.listRegions).not.toHaveBeenCalled();
  });

  it("returns a Region Manager page from only the Region Manager role scope", async () => {
    const repository = {
      list: jest.fn(async () => ({
        period: "2026-07",
        metrics: {
          totalStores: 1,
          needsVisit: 1,
          active: 0,
          pending: 0,
          completed: 0,
        },
        items: [{ storeId: "store-1" }],
        total: 1,
      })),
    };
    const service = new ChecklistCommandReadService(repository as never);

    await expect(
      service.list({
        actorRoleCodes: ["REGION_MANAGER"],
        actorReadScope: {
          companyIds: ["aggregate-company"],
          regionIds: ["aggregate-region"],
          storeIds: [],
        },
        roleScopes: {
          REGION_MANAGER: {
            companyIds: [],
            regionIds: [],
            storeIds: ["manager-store"],
          },
        },
        period: "2026-07",
        status: "all",
        sort: "store_asc",
        limit: 30,
        offset: 0,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        period: "2026-07",
        view: "region_manager",
        capabilities: {
          weeklyVisitPlanningAvailable: false,
          canMaintainWeeklyVisitPlan: false,
        },
        page: { total: 1, limit: 30, offset: 0, hasMore: false },
      }),
    );
    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({
        companyIds: [],
        regionIds: [],
        storeIds: ["manager-store"],
      }),
    );
  });

  it("fails closed without querying when a Report Viewer role scope is missing", async () => {
    const repository = { list: jest.fn() };
    const service = new ChecklistCommandReadService(repository as never);

    await expect(
      service.list({
        actorRoleCodes: ["REPORT_VIEWER"],
        actorReadScope: {
          companyIds: ["aggregate-company-must-not-leak"],
          regionIds: ["aggregate-region-must-not-leak"],
          storeIds: ["aggregate-store-must-not-leak"],
        },
        period: "2026-07",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        view: "report_viewer",
        metrics: {
          totalStores: 0,
          needsVisit: 0,
          active: 0,
          pending: 0,
          completed: 0,
        },
        items: [],
      }),
    );
    expect(repository.list).not.toHaveBeenCalled();
  });
});
