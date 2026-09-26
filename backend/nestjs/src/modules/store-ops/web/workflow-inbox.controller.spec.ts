import { WorkflowInboxController } from "./workflow-inbox.controller";

describe("WorkflowInboxController manager scope", () => {
  it("passes only manager-profile stores to inbox and request-center reads", async () => {
    const service = { listInbox: jest.fn(), listRequestCenter: jest.fn() };
    const controller = new WorkflowInboxController(service as never);
    const request = { user: {
      roleCodes: ["REGION_MANAGER", "STORE_MANAGER"],
      scope: { companyIds: [], regionIds: ["legacy-region"], storeIds: ["other-store"] },
      roleScopes: { REGION_MANAGER: { companyIds: [], regionIds: [], storeIds: ["manager-store"] } },
      actionScope: { assignedStoreIds: ["manager-store", "other-store"] },
    } };

    await controller.listInbox(request);
    await controller.listRequestCenter(request, {} as never);

    for (const read of [service.listInbox, service.listRequestCenter]) {
      expect(read).toHaveBeenCalledWith(expect.objectContaining({
        actorActionScope: { assignedStoreIds: ["manager-store"] },
      }));
    }
  });
});
