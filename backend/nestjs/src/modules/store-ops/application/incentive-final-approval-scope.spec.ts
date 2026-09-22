import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { buildAuthenticatedUser } from "../../auth/auth-context.service";
import { incentiveFinalApprovalCompanyIds } from "./incentive-final-approval-scope";
import { SalesTargetIncentiveAdminPackageWorkflowService } from "./sales-target-incentive-admin-package-workflow.service";

const scope = (companyIds: string[]) => ({ companyIds, regionIds: [], storeIds: [] });
const viewer = (roles = ["REPORT_VIEWER"], grants = ["a"], companies = ["a"]) => buildAuthenticatedUser({
  userId: "viewer", roleCodes: roles, readScope: scope(["a", "b"]),
  roleScopes: { REPORT_VIEWER: scope(companies) }, permissionScopes: { INCENTIVE_FINAL_APPROVAL: scope(grants) },
});

describe("individual incentive approval", () => {
  it("returns the exact submitted package with the existing permission and trimmed note", async () => {
    const approval = { reviewRegionPackage: jest.fn().mockResolvedValue({ sales_target_incentive_region_package_id: "package", package_status: "admin_returned", reviewed_at: "2026-09-01" }) };
    const service = new SalesTargetIncentiveAdminPackageWorkflowService({} as never, approval as never);
    await service.approveFinalPackage({ actor: viewer(), periodKey: "2026-09", regionId: "region", regionPackageId: "package", submittedAt: "2026-09-01T00:00:00Z", decision: "return", reviewNote: "  Kontrol gerekli  " });
    expect(approval.reviewRegionPackage).toHaveBeenCalledWith({ periodKey: "2026-09", regionId: "region", actorUserId: "viewer", packageStatus: "admin_returned", reviewNote: "Kontrol gerekli", finalApproval: { companyIds: ["a"], regionPackageId: "package", submittedAt: "2026-09-01T00:00:00Z" } });
  });
  it("rejects a return without a meaningful note before any write", async () => {
    const approval = { reviewRegionPackage: jest.fn() };
    const service = new SalesTargetIncentiveAdminPackageWorkflowService({} as never, approval as never);
    await expect(service.approveFinalPackage({ actor: viewer(), periodKey: "2026-09", regionId: "region", regionPackageId: "package", submittedAt: "2026-09-01T00:00:00Z", decision: "return", reviewNote: "   " })).rejects.toThrow(BadRequestException);
    expect(approval.reviewRegionPackage).not.toHaveBeenCalled();
  });
  it("omitting the decision preserves existing approval clients", async () => {
    const approval = { reviewRegionPackage: jest.fn().mockResolvedValue({}) };
    const service = new SalesTargetIncentiveAdminPackageWorkflowService({} as never, approval as never);
    await service.approveFinalPackage({ actor: viewer(), periodKey: "2026-09", regionId: "region", regionPackageId: "package", submittedAt: "2026-09-01T00:00:00Z" });
    expect(approval.reviewRegionPackage).toHaveBeenCalledWith(expect.objectContaining({ packageStatus: "admin_approved", reviewNote: null }));
  });
  it.each([
    ["plain viewer", ["REPORT_VIEWER"], [], ["a"]],
    ["admin without viewer", ["SUPER_ADMIN"], ["a"], ["a"]],
    ["region manager", ["REGION_MANAGER"], ["a"], ["a"]],
    ["different company", ["REPORT_VIEWER"], ["b"], ["a"]],
    ["missing own role scope", ["REPORT_VIEWER"], ["a"], []],
  ])("denies %s", (_name, roles, grants, companies) => {
    expect(() => incentiveFinalApprovalCompanyIds(viewer(roles as string[], grants as string[], companies as string[]))).toThrow(ForbiddenException);
  });
  it("intersects role and explicit grant instead of unioning mixed-role read scope", () => {
    expect(incentiveFinalApprovalCompanyIds(viewer(["REPORT_VIEWER", "SUPER_ADMIN"], ["a", "c"], ["a", "b"]))).toEqual(["a"]);
  });
  it("never invokes the write repository for an ungranted viewer", async () => {
    const approval = { reviewRegionPackage: jest.fn() };
    const service = new SalesTargetIncentiveAdminPackageWorkflowService({} as never, approval as never);
    await expect(service.approveFinalPackage({ actor: viewer(["REPORT_VIEWER"], []), periodKey: "2026-09", regionId: "region", regionPackageId: "package", submittedAt: "2026-09-01T00:00:00Z" })).rejects.toThrow(ForbiddenException);
    expect(approval.reviewRegionPackage).not.toHaveBeenCalled();
  });
  it("lists only granted companies and never enables global scope", async () => {
    const read = { listRegionPackageSummaries: jest.fn().mockResolvedValue([]) };
    const service = new SalesTargetIncentiveAdminPackageWorkflowService(read as never, {} as never);
    await service.listFinalApprovalPackages({ actor: viewer(), periodKey: "2026-09" });
    expect(read.listRegionPackageSummaries).toHaveBeenCalledWith({ periodKey: "2026-09", companyIds: ["a"], regionIds: [], storeIds: [], allowGlobalScope: false });
  });
});
