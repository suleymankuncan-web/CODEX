import { REQUIRED_ROLES_KEY } from "../../auth/decorators/roles.decorator";
import { TargetDistributionController } from "./target-distribution.controller";
import { TargetDistributionService } from "../application/target-distribution.service";
describe("regional target review access", () => {
  it("allows the region manager to read revision basis without granting report viewer action access", () => {
    expect(Reflect.getMetadata(REQUIRED_ROLES_KEY, TargetDistributionController.prototype.getRevisionBasis)).toEqual(["STORE_MANAGER", "REGION_MANAGER", "SUPER_ADMIN"]);
  });
  it("rejects an unassigned store before reading references", async () => {
    const repo = {getRevisionBasis:jest.fn()};
    const service = new TargetDistributionService(repo as never, {} as never);
    await expect(service.getRevisionBasis({actorScope:{companyIds:[],regionIds:[],storeIds:[]},actorActionScope:{assignedStoreIds:["own-store"]},storeId:"other-store",requestMonth:"2026-09-01"})).rejects.toThrow();
    expect(repo.getRevisionBasis).not.toHaveBeenCalled();
  });
});
