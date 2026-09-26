import { TargetDistributionController } from "./target-distribution.controller";

describe("TargetDistributionController Region Manager scope", () => {
  it.each(["STORE_MANAGER", "REPORT_VIEWER"])("passes only profile-assigned stores to manager reads and approval with %s role", async (otherRole) => {
    const service = {
      getRevisionBasis: jest.fn(), listRequests: jest.fn(), getTargetCoverage: jest.fn(), approveRequest: jest.fn(),
    };
    const controller = new TargetDistributionController(service as never);
    const user = {
      userId: "manager-user",
      roleCodes: ["REGION_MANAGER", otherRole],
      roleScopes: { REGION_MANAGER: { companyIds: [], regionIds: [], storeIds: ["manager-store"] } },
      scope: { companyIds: [], regionIds: ["legacy-region"], storeIds: ["other-role-store"] },
      actionScope: { assignedStoreIds: ["manager-store", "other-role-store"] },
    };

    await controller.getRevisionBasis({ user } as never, { storeId: "manager-store", requestMonth: "2026-09" } as never);
    await controller.listRequests({ user } as never, { requestMonth: "2026-09" } as never);
    await controller.getTargetCoverage({ user } as never, { requestMonth: "2026-09" } as never);
    await controller.approveRequest({ user, params: { requestId: "request-1" } } as never, {} as never);

    for (const command of [service.getRevisionBasis, service.listRequests, service.getTargetCoverage, service.approveRequest]) {
      expect(command).toHaveBeenCalledWith(expect.objectContaining({
        actorActionScope: { assignedStoreIds: ["manager-store"] },
      }));
    }
  });
});
