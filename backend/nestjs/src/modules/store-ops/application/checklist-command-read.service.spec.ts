import { ChecklistCommandReadService } from "./checklist-command-read.service";

describe("ChecklistCommandReadService", () => {
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
            companyIds: ["manager-company"],
            regionIds: ["manager-region"],
            storeIds: [],
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
        regionIds: ["manager-region"],
        storeIds: [],
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
