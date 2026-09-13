import { RegionManagerDirectoryController } from "./region-manager-directory.controller";
import { REQUIRED_ROLES_KEY } from "../../auth/decorators/roles.decorator";
import { REQUIRED_SCOPE_KEY } from "../../auth/decorators/scope.decorator";
import { buildAuthenticatedUser } from "../../auth/auth-context.service";

describe("RegionManagerDirectoryController", () => {
  it("requires authentication and company reporting roles", () => {
    expect(Reflect.getMetadata(REQUIRED_SCOPE_KEY, RegionManagerDirectoryController.prototype.list)).toBe("authenticated");
    expect(Reflect.getMetadata(REQUIRED_ROLES_KEY, RegionManagerDirectoryController.prototype.list)).toEqual(["REPORT_VIEWER", "SUPER_ADMIN"]);
  });
  it("passes the full actor to the role-scoped service", async () => {
    const service = { list: jest.fn().mockResolvedValue({ items: [] }) };
    const actor = buildAuthenticatedUser({ userId: "viewer", roleCodes: ["REPORT_VIEWER"] });
    expect(await new RegionManagerDirectoryController(service as never).list({ user: actor })).toEqual({ items: [] });
    expect(service.list).toHaveBeenCalledWith(actor);
  });
});
