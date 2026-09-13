import { ForbiddenException } from "@nestjs/common";
import { buildAuthenticatedUser } from "../../auth/auth-context.service";
import { RegionManagerDirectoryService } from "./region-manager-directory.service";
const scope = (companyIds: string[]) => ({ companyIds, regionIds: [], storeIds: [] });
function setup() {
  const repository = { listCompanyRegionManagerDirectory: jest.fn().mockResolvedValue([
    { id: "manager-a", label: "Manager A", storeIds: ["store-a"] },
    { id: "manager-empty", label: "Manager Empty", storeIds: [] },
  ]) };
  return { repository, service: new RegionManagerDirectoryService(repository as never) };
}
describe("RegionManagerDirectoryService", () => {
  it("includes managers without stores and uses only the viewer company role", async () => {
    const { service, repository } = setup();
    const actor = buildAuthenticatedUser({ userId: "viewer", roleCodes: ["REPORT_VIEWER", "REGION_MANAGER"], readScope: scope(["other"]), roleScopes: { REPORT_VIEWER: scope(["company-a"]), REGION_MANAGER: scope(["other"]) } });
    expect(await service.list(actor)).toEqual({ items: [
      { userId: "manager-a", displayName: "Manager A", storeIds: ["store-a"] },
      { userId: "manager-empty", displayName: "Manager Empty", storeIds: [] },
    ] });
    expect(repository.listCompanyRegionManagerDirectory).toHaveBeenCalledWith({ companyIds: ["company-a"] });
  });
  it.each(["REGION_MANAGER", "STORE_MANAGER", "STORE_PERSONNEL"])("denies %s", async role => {
    const { service, repository } = setup();
    await expect(service.list(buildAuthenticatedUser({ userId: "actor", roleCodes: [role], readScope: scope(["company-a"]) }))).rejects.toThrow(ForbiddenException);
    expect(repository.listCompanyRegionManagerDirectory).not.toHaveBeenCalled();
  });
  it.each(["REPORT_VIEWER", "SUPER_ADMIN"])("fails closed on empty %s scope", async role => {
    const { service, repository } = setup();
    expect(await service.list(buildAuthenticatedUser({ userId: "actor", roleCodes: [role], roleScopes: { [role]: scope([]) } }))).toEqual({ items: [] });
    expect(repository.listCompanyRegionManagerDirectory).not.toHaveBeenCalled();
  });
  it("never falls back from a missing viewer role into another role", async () => {
    const { service, repository } = setup();
    expect(await service.list(buildAuthenticatedUser({ userId: "actor", roleCodes: ["REPORT_VIEWER", "SUPER_ADMIN"], readScope: scope(["other"]), roleScopes: { SUPER_ADMIN: scope(["other"]) } }))).toEqual({ items: [] });
    expect(repository.listCompanyRegionManagerDirectory).not.toHaveBeenCalled();
  });
});
