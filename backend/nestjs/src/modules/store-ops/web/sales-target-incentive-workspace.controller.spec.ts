import { buildAuthenticatedUser } from "../../auth/auth-context.service";
import { REQUIRED_ROLES_KEY } from "../../auth/decorators/roles.decorator";
import { REQUIRED_SCOPE_KEY } from "../../auth/decorators/scope.decorator";
import { SalesTargetIncentiveWorkspaceController } from "./sales-target-incentive-workspace.controller";

describe("SalesTargetIncentiveWorkspaceController", () => {
  it("delegates the additive workspace read with actor and period", async () => {
    const service = { getWorkspace: jest.fn().mockResolvedValue({ regions: [] }) };
    const controller = new SalesTargetIncentiveWorkspaceController(service as never, {} as never);
    const user = buildAuthenticatedUser({
      userId: "00000000-0000-4000-8000-000000000901",
      roleCodes: ["REPORT_VIEWER"],
      readScope: { companyIds: ["00000000-0000-4000-8000-000000000001"], regionIds: [], storeIds: [] },
      roleScopes: {
        REPORT_VIEWER: { companyIds: ["00000000-0000-4000-8000-000000000001"], regionIds: [], storeIds: [] },
      },
    });

    await controller.getWorkspace({ user }, { period: "2026-05" });

    expect(service.getWorkspace).toHaveBeenCalledWith({ actor: user, periodKey: "2026-05", throughDate: undefined });
  });

  it("allows only Report Viewer and Region Manager on the new read path", () => {
    expect(Reflect.getMetadata(
      REQUIRED_ROLES_KEY,
      SalesTargetIncentiveWorkspaceController.prototype.getWorkspace,
    )).toEqual(["REPORT_VIEWER", "REGION_MANAGER"]);
    expect(Reflect.getMetadata(
      REQUIRED_SCOPE_KEY,
      SalesTargetIncentiveWorkspaceController.prototype.getWorkspace,
    )).toBe("authenticated");
  });

  it("keeps participation writes Region Manager-only and derives the actor from authentication", async () => {
    const participation = { setParticipation: jest.fn().mockResolvedValue({ data: { revision: 1 } }) };
    const controller = new SalesTargetIncentiveWorkspaceController({} as never, participation as never);
    const user = buildAuthenticatedUser({ userId: "00000000-0000-4000-8000-000000000901", roleCodes: ["REGION_MANAGER"] });
    const body = { period: "2026-05", storeId: "00000000-0000-4000-8000-000000000201", employeeId: "00000000-0000-4000-8000-000000000801", included: false,
      reasonNote: "Approved exclusion", expectedRevision: 0, expectedSnapshotId: "00000000-0000-4000-8000-000000000401" };
    await controller.setParticipation({ user }, body);
    expect(participation.setParticipation).toHaveBeenCalledWith({ ...body, actor: user });
    expect(Reflect.getMetadata(REQUIRED_ROLES_KEY, controller.setParticipation)).toEqual(["REGION_MANAGER"]);
    expect(Reflect.getMetadata(REQUIRED_SCOPE_KEY, controller.setParticipation)).toBe("authenticated");
  });
});
