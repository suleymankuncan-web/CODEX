import { WorkforceController } from "./workforce.controller";

describe("WorkforceController manager read scope", () => {
  it("passes only manager-profile stores to headcount and employee reads", async () => {
    const service = { getStoreHeadcountGap: jest.fn(), listActiveStoreEmployees: jest.fn() };
    const controller = new WorkforceController(service as never);
    const request = { user: {
      roleCodes: ["REGION_MANAGER", "STORE_MANAGER"],
      scope: { companyIds: [], regionIds: ["legacy-region"], storeIds: ["other-store"] },
      roleScopes: { REGION_MANAGER: { companyIds: [], regionIds: [], storeIds: ["manager-store"] } },
      actionScope: { assignedStoreIds: ["manager-store", "other-store"] },
    } };

    await controller.getHeadcountGap(request, {} as never);
    await controller.listStoreEmployees(request, {} as never);

    for (const read of [service.getStoreHeadcountGap, service.listActiveStoreEmployees]) {
      expect(read).toHaveBeenCalledWith(expect.objectContaining({
        actorActionScope: { assignedStoreIds: ["manager-store"] },
      }));
    }
  });
});
