import { buildAuthenticatedUser } from "../../auth/auth-context.service";
import { REQUIRED_ROLES_KEY } from "../../auth/decorators/roles.decorator";
import { REQUIRED_ACTION_SCOPE_KEY } from "../../auth/decorators/scope.decorator";
import { StoreActionPlanController } from "./store-action-plan.controller";

const assignedStoreId = "00000000-0000-4000-8000-000000000201";

function createHarness() {
  const storeActionPlanService = {
    listPlans: jest.fn(async () => ({ items: [], meta: { count: 0 } })),
    getPlan: jest.fn(async () => ({ data: { plan: { actionPlanId: "plan-1" } } })),
    createPlan: jest.fn(async () => ({ command: { status: "created" } })),
    updateStatus: jest.fn(async () => ({ command: { status: "updated" } })),
    closePlan: jest.fn(async () => ({ command: { status: "closed" } })),
    cancelPlan: jest.fn(async () => ({ command: { status: "cancelled" } })),
  };
  const controller = new StoreActionPlanController(storeActionPlanService as never);

  return {
    controller,
    storeActionPlanService,
  };
}

function createRequest() {
  return {
    user: buildAuthenticatedUser({
      userId: "00000000-0000-4000-8000-000000000901",
      roleCodes: ["STORE_MANAGER"],
      readScope: {
        companyIds: ["00000000-0000-4000-8000-000000000001"],
        regionIds: ["00000000-0000-4000-8000-000000000010"],
        storeIds: [assignedStoreId],
      },
      actionScope: {
        assignedStoreIds: [assignedStoreId],
      },
    }),
  };
}

function createRegionManagerRequest(assignedStoreIds: string[] = [assignedStoreId]) {
  return {
    user: buildAuthenticatedUser({
      userId: "00000000-0000-4000-8000-000000000902",
      roleCodes: ["REGION_MANAGER"],
      readScope: {
        companyIds: ["00000000-0000-4000-8000-000000000001"],
        regionIds: ["00000000-0000-4000-8000-000000000010"],
        storeIds: [
          assignedStoreId,
          "00000000-0000-4000-8000-000000000202",
          "00000000-0000-4000-8000-000000000203",
        ],
      },
      actionScope: {
        assignedStoreIds,
      },
    }),
  };
}

describe("StoreActionPlanController", () => {
  it("delegates list queries with actor action scope", async () => {
    const { controller, storeActionPlanService } = createHarness();

    await controller.listPlans(createRequest(), {
      storeId: assignedStoreId,
      status: "open",
      limit: 25,
      offset: 5,
    });

    expect(storeActionPlanService.listPlans).toHaveBeenCalledWith({
      actorActionScope: { assignedStoreIds: [assignedStoreId] },
      storeId: assignedStoreId,
      status: "open",
      limit: 25,
      offset: 5,
    });
  });

  it("delegates region manager read queries with action scope only", async () => {
    const { controller, storeActionPlanService } = createHarness();
    const request = createRegionManagerRequest();
    const actionPlanId = "00000000-0000-4000-8000-000000000701";

    await controller.listPlans(request, {
      status: "open",
      limit: 25,
      offset: 0,
    });
    await controller.getPlan(request, actionPlanId);

    expect(storeActionPlanService.listPlans).toHaveBeenCalledWith({
      actorActionScope: { assignedStoreIds: [assignedStoreId] },
      storeId: undefined,
      status: "open",
      limit: 25,
      offset: 0,
    });
    expect(storeActionPlanService.getPlan).toHaveBeenCalledWith({
      actorActionScope: { assignedStoreIds: [assignedStoreId] },
      actionPlanId,
    });
  });

  it("does not widen region manager plan reads from read scope when action stores are empty", async () => {
    const { controller, storeActionPlanService } = createHarness();

    await controller.listPlans(createRegionManagerRequest([]), {
      status: "open",
      limit: 25,
      offset: 0,
    });

    expect(storeActionPlanService.listPlans).toHaveBeenCalledWith({
      actorActionScope: { assignedStoreIds: [] },
      storeId: undefined,
      status: "open",
      limit: 25,
      offset: 0,
    });
  });

  it("delegates create commands with actor identity, read scope, and action scope", async () => {
    const { controller, storeActionPlanService } = createHarness();

    await controller.createPlan(createRequest(), {
      storeId: assignedStoreId,
      sourceType: "kpi_exception",
      sourceId: "snapshot-1:store-1:kpi-1",
      title: "Net sales off track",
      priority: "high",
      dueOn: "2026-06-01",
    });

    expect(storeActionPlanService.createPlan).toHaveBeenCalledWith({
      actorUserId: "00000000-0000-4000-8000-000000000901",
      actorScope: {
        companyIds: ["00000000-0000-4000-8000-000000000001"],
        regionIds: ["00000000-0000-4000-8000-000000000010"],
        storeIds: [assignedStoreId],
      },
      actorActionScope: { assignedStoreIds: [assignedStoreId] },
      storeId: assignedStoreId,
      sourceType: "kpi_exception",
      sourceId: "snapshot-1:store-1:kpi-1",
      title: "Net sales off track",
      priority: "high",
      dueOn: "2026-06-01",
    });
  });

  it("delegates lifecycle commands without relying on body store scope identifiers", async () => {
    const { controller, storeActionPlanService } = createHarness();
    const request = createRequest();

    await controller.updateStatus(request, "00000000-0000-4000-8000-000000000701", {
      status: "blocked",
      note: "Waiting for stock confirmation",
    });
    await controller.closePlan(request, "00000000-0000-4000-8000-000000000701", {
      resolutionNote: "Called the team and corrected the display plan",
    });
    await controller.cancelPlan(request, "00000000-0000-4000-8000-000000000701", {
      cancelReason: "Duplicate field coaching item",
    });

    expect(storeActionPlanService.updateStatus).toHaveBeenCalledWith({
      actorUserId: "00000000-0000-4000-8000-000000000901",
      actorActionScope: { assignedStoreIds: [assignedStoreId] },
      actionPlanId: "00000000-0000-4000-8000-000000000701",
      status: "blocked",
      note: "Waiting for stock confirmation",
    });
    expect(storeActionPlanService.closePlan).toHaveBeenCalledWith({
      actorUserId: "00000000-0000-4000-8000-000000000901",
      actorActionScope: { assignedStoreIds: [assignedStoreId] },
      actionPlanId: "00000000-0000-4000-8000-000000000701",
      resolutionNote: "Called the team and corrected the display plan",
    });
    expect(storeActionPlanService.cancelPlan).toHaveBeenCalledWith({
      actorUserId: "00000000-0000-4000-8000-000000000901",
      actorActionScope: { assignedStoreIds: [assignedStoreId] },
      actionPlanId: "00000000-0000-4000-8000-000000000701",
      cancelReason: "Duplicate field coaching item",
    });
  });

  it("requires store action scope only on create where the body carries storeId", () => {
    expect(Reflect.getMetadata(REQUIRED_ACTION_SCOPE_KEY, controllerMethod("createPlan"))).toBe(
      "store",
    );
    expect(Reflect.getMetadata(REQUIRED_ACTION_SCOPE_KEY, controllerMethod("updateStatus"))).toBe(
      undefined,
    );
    expect(Reflect.getMetadata(REQUIRED_ACTION_SCOPE_KEY, controllerMethod("closePlan"))).toBe(
      undefined,
    );
    expect(Reflect.getMetadata(REQUIRED_ACTION_SCOPE_KEY, controllerMethod("cancelPlan"))).toBe(
      undefined,
    );
  });

  it("limits command endpoints to store managers and super admins while allowing region manager reads", () => {
    expect(Reflect.getMetadata(REQUIRED_ROLES_KEY, controllerMethod("listPlans"))).toEqual([
      "STORE_MANAGER",
      "SUPER_ADMIN",
      "REGION_MANAGER",
    ]);
    expect(Reflect.getMetadata(REQUIRED_ROLES_KEY, controllerMethod("getPlan"))).toEqual([
      "STORE_MANAGER",
      "SUPER_ADMIN",
      "REGION_MANAGER",
    ]);
    expect(Reflect.getMetadata(REQUIRED_ROLES_KEY, controllerMethod("createPlan"))).toEqual([
      "STORE_MANAGER",
      "SUPER_ADMIN",
    ]);
    expect(Reflect.getMetadata(REQUIRED_ROLES_KEY, controllerMethod("updateStatus"))).toEqual([
      "STORE_MANAGER",
      "SUPER_ADMIN",
    ]);
    expect(Reflect.getMetadata(REQUIRED_ROLES_KEY, controllerMethod("closePlan"))).toEqual([
      "STORE_MANAGER",
      "SUPER_ADMIN",
    ]);
    expect(Reflect.getMetadata(REQUIRED_ROLES_KEY, controllerMethod("cancelPlan"))).toEqual([
      "STORE_MANAGER",
      "SUPER_ADMIN",
    ]);
  });
});

function controllerMethod(methodName: keyof StoreActionPlanController) {
  return StoreActionPlanController.prototype[methodName];
}
