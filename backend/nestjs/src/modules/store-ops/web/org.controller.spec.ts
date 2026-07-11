import { OrgController } from "./org.controller";

describe("OrgController", () => {
  it("keeps store-scoped users limited to assigned stores when listing stores", async () => {
    const orgService = {
      listStoresByScope: jest.fn(async () => ({ items: [] })),
    };
    const controller = new OrgController(orgService as never);

    await controller.listStores(
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
      {},
    );

    expect(orgService.listStoresByScope).toHaveBeenCalledWith({
      companyIds: [],
      regionIds: [],
      storeIds: ["store-1"],
      companyId: undefined,
      regionId: undefined,
      storeId: undefined,
    });
  });

  it("preserves broad org scope for company and region roles", async () => {
    const orgService = {
      listStoresByScope: jest.fn(async () => ({ items: [] })),
    };
    const controller = new OrgController(orgService as never);

    await controller.listStores(
      {
        user: {
          roleCodes: ["REGION_MANAGER"],
          scope: {
            companyIds: [],
            regionIds: ["region-1"],
            storeIds: [],
          },
          actionScope: {
            assignedStoreIds: ["store-1"],
          },
        },
      },
      {
        regionId: "region-1",
      },
    );

    expect(orgService.listStoresByScope).toHaveBeenCalledWith({
      companyIds: [],
      regionIds: ["region-1"],
      storeIds: [],
      companyId: undefined,
      regionId: "region-1",
      storeId: undefined,
    });
  });

  it("uses only Report Viewer role companies for the store portfolio", async () => {
    const orgService = {
      listStoresByScope: jest.fn(async () => ({ items: [] })),
    };
    const controller = new OrgController(orgService as never);

    await controller.listStores(
      {
        user: {
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
      {},
    );

    expect(orgService.listStoresByScope).toHaveBeenCalledWith(
      expect.objectContaining({
        companyIds: ["company-a"],
        regionIds: [],
        storeIds: [],
      }),
    );
  });
});
