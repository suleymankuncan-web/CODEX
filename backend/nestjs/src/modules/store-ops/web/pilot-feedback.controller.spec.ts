import { buildAuthenticatedUser } from "../../auth/auth-context.service";
import { REQUIRED_ROLES_KEY } from "../../auth/decorators/roles.decorator";
import { PilotFeedbackController } from "./pilot-feedback.controller";

function createHarness() {
  const pilotFeedbackService = {
    createFeedback: jest.fn(async () => ({ command: { status: "created" } })),
    listFeedback: jest.fn(async () => ({ items: [], meta: { count: 0 } })),
    classifyFeedback: jest.fn(async () => ({ command: { status: "triaged" } })),
  };
  const controller = new PilotFeedbackController(pilotFeedbackService as never);

  return {
    controller,
    pilotFeedbackService,
  };
}

function createRequest(roleCodes = ["STORE_MANAGER"]) {
  return {
    user: buildAuthenticatedUser({
      userId: "00000000-0000-4000-8000-000000000901",
      roleCodes,
      readScope: {
        companyIds: ["00000000-0000-4000-8000-000000000001"],
        regionIds: ["00000000-0000-4000-8000-000000000010"],
        storeIds: ["00000000-0000-4000-8000-000000000201"],
      },
      actionScope: {
        assignedStoreIds: ["00000000-0000-4000-8000-000000000201"],
      },
    }),
  };
}

describe("PilotFeedbackController", () => {
  it("delegates feedback creation with actor identity and roles", async () => {
    const { controller, pilotFeedbackService } = createHarness();

    await controller.createFeedback(createRequest(), {
      feedbackType: "friction",
      severitySuggestion: "p2",
      routePath: "/store/tasks",
      pageTitle: "Tasks",
      title: "Action plan copy is unclear",
      description: "The next step after closing an action plan is unclear.",
    });

    expect(pilotFeedbackService.createFeedback).toHaveBeenCalledWith({
      actorUserId: "00000000-0000-4000-8000-000000000901",
      actorRoles: ["STORE_MANAGER"],
      feedbackType: "friction",
      severitySuggestion: "p2",
      routePath: "/store/tasks",
      pageTitle: "Tasks",
      title: "Action plan copy is unclear",
      description: "The next step after closing an action plan is unclear.",
    });
  });

  it("keeps feedback queue and classification super-admin only in the first slice", async () => {
    const { controller, pilotFeedbackService } = createHarness();

    await controller.listFeedback({
      status: "new",
      classification: undefined,
      limit: 25,
      offset: 0,
    });
    await controller.classifyFeedback(
      createRequest(["SUPER_ADMIN"]),
      "00000000-0000-4000-8000-000000000501",
      {
        classification: "p1_pilot_blocker",
        note: "Fix before next pilot session.",
      },
    );

    expect(pilotFeedbackService.listFeedback).toHaveBeenCalledWith({
      status: "new",
      classification: undefined,
      limit: 25,
      offset: 0,
    });
    expect(pilotFeedbackService.classifyFeedback).toHaveBeenCalledWith({
      actorUserId: "00000000-0000-4000-8000-000000000901",
      actorRoles: ["SUPER_ADMIN"],
      feedbackId: "00000000-0000-4000-8000-000000000501",
      classification: "p1_pilot_blocker",
      note: "Fix before next pilot session.",
    });
  });

  it("limits admin feedback queue endpoints to super admin", () => {
    expect(Reflect.getMetadata(REQUIRED_ROLES_KEY, controllerMethod("listFeedback"))).toEqual([
      "SUPER_ADMIN",
    ]);
    expect(Reflect.getMetadata(REQUIRED_ROLES_KEY, controllerMethod("classifyFeedback"))).toEqual([
      "SUPER_ADMIN",
    ]);
    expect(Reflect.getMetadata(REQUIRED_ROLES_KEY, controllerMethod("createFeedback"))).toBe(
      undefined,
    );
  });
});

function controllerMethod(methodName: keyof PilotFeedbackController) {
  return PilotFeedbackController.prototype[methodName];
}
