import { buildAuthenticatedUser } from "../../auth/auth-context.service";
import { REQUIRED_ROLES_KEY } from "../../auth/decorators/roles.decorator";
import { REQUIRED_SCOPE_KEY } from "../../auth/decorators/scope.decorator";
import { TargetWorkspaceController } from "./target-workspace.controller";

// Traceability: TGT-FR-001/005, NFR-005, AC-TGT-003, EC-017/022.

describe("TargetWorkspaceController", () => {
  it("delegates only period, history year and bounded pagination", async () => {
    const service = { getWorkspace: jest.fn().mockResolvedValue({ companies: [] }) };
    const controller = new TargetWorkspaceController(service as never);
    const user = buildAuthenticatedUser({ userId: "00000000-0000-4000-8000-000000000901", roleCodes: ["REPORT_VIEWER"] });
    await controller.getWorkspace({ user }, { period: "2026-07", historyYear: 2026, limit: 50, offset: 10 });
    expect(service.getWorkspace).toHaveBeenCalledWith({ actor: user, periodKey: "2026-07", historyYear: 2026, limit: 50, offset: 10 });
  });

  it("allows exactly the three Store personas on the authenticated read path", () => {
    const handler = TargetWorkspaceController.prototype.getWorkspace;
    expect(Reflect.getMetadata(REQUIRED_ROLES_KEY, handler)).toEqual(["REPORT_VIEWER", "REGION_MANAGER", "STORE_MANAGER"]);
    expect(Reflect.getMetadata(REQUIRED_SCOPE_KEY, handler)).toBe("authenticated");
  });
});
