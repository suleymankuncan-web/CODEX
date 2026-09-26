import { buildAuthenticatedUser } from "../../auth/auth-context.service";
import { REQUIRED_ROLES_KEY } from "../../auth/decorators/roles.decorator";
import { WorkflowInboxController } from "./workflow-inbox.controller";

describe("WorkflowInboxController request center", () => {
  it("delegates a bounded page with read and action scopes kept separate", async () => {
    const workflowInboxService = {
      listRequestCenter: jest.fn(async () => ({ items: [], meta: { total: 0 } })),
    };
    const controller = new WorkflowInboxController(workflowInboxService as never);
    const request = {
      user: buildAuthenticatedUser({
        userId: "00000000-0000-4000-8000-000000000901",
        roleCodes: ["REGION_MANAGER"],
        roleScopes: { REGION_MANAGER: { companyIds: [], regionIds: [], storeIds: ["00000000-0000-4000-8000-000000000201"] } },
        readScope: {
          companyIds: [],
          regionIds: ["00000000-0000-4000-8000-000000000010"],
          storeIds: [],
        },
        actionScope: {
          assignedStoreIds: ["00000000-0000-4000-8000-000000000201"],
        },
      }),
    };

    await controller.listRequestCenter(request, {
      bucket: "done",
      type: "target",
      status: "approved",
      period: "2026-07",
      storeId: "00000000-0000-4000-8000-000000000201",
      q: "July",
      limit: 15,
      offset: 30,
    });

    expect(workflowInboxService.listRequestCenter).toHaveBeenCalledWith({
      actorRoles: ["REGION_MANAGER"],
      actorScope: {
        companyIds: [],
        regionIds: ["00000000-0000-4000-8000-000000000010"],
        storeIds: [],
      },
      actorActionScope: {
        assignedStoreIds: ["00000000-0000-4000-8000-000000000201"],
      },
      bucket: "done",
      type: "target",
      status: "approved",
      period: "2026-07",
      storeId: "00000000-0000-4000-8000-000000000201",
      query: "July",
      limit: 15,
      offset: 30,
    });
  });

  it("keeps the request-center role contract aligned with the Store route", () => {
    expect(
      Reflect.getMetadata(
        REQUIRED_ROLES_KEY,
        WorkflowInboxController.prototype.listRequestCenter,
      ),
    ).toEqual(["STORE_MANAGER", "SUPER_ADMIN", "REPORT_VIEWER", "REGION_MANAGER"]);
  });
});
