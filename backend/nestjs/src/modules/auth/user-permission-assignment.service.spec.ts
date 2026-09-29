import { ConflictException, ForbiddenException } from "@nestjs/common";
import { AuthAdminService } from "./auth-admin.service";
import { AuthUserPermissionService } from "./auth-user-permission.service";

describe("AuthUserPermissionService user capability grants", () => {
  const context = {
    user_role_assignment_id: "assignment-1",
    user_id: "user-1",
    role_id: "role-1",
    role_code: "REPORT_VIEWER",
    role_scope_type: "company",
    scope_type: "company",
    company_id: "company-1",
    region_id: null,
    store_id: null,
    start_at: "2026-01-01T00:00:00.000Z",
    end_at: null,
  };
  const permissionRepository = {
    getGrantContext: jest.fn(async () => context),
    getPermissionByCode: jest.fn(async (permissionCode: string) => ({
      permission_id: "permission-1",
      permission_code: permissionCode,
      resource_name: "incentive",
      action_name: "approve",
    })),
    roleHasPermission: jest.fn(async () => false),
    hasOverlappingSuperAssignment: jest.fn(async () => false),
    hasConflictingApprovalStage: jest.fn(async () => false),
    grant: jest.fn(async () => ({
      user_permission_assignment_id: "grant-1",
      user_role_assignment_id: "assignment-1",
      user_id: "user-1",
      role_code: "REPORT_VIEWER",
      permission_code: "INCENTIVE_SALES_DIRECTOR_APPROVAL",
      resource_name: "incentive",
      action_name: "approve",
      scope_type: "company",
      company_id: "company-1",
      region_id: null,
      store_id: null,
      starts_at: "2026-09-29T00:00:00.000Z",
      ends_at: null,
      grant_reason: "Sales director assignment",
      created_at: "2026-09-29T00:00:00.000Z",
      revoked_at: null,
      revoke_reason: null,
    })),
  };
  const lookupRepository = {
    getCompanyLookupById: jest.fn(async () => ({ company_id: "company-1" })),
  };
  const scopePolicy = { validateAssignmentScope: jest.fn() };
  const service = new AuthUserPermissionService(
    lookupRepository as never,
    scopePolicy as never,
    permissionRepository as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it("grants a company-scoped Sales Director capability to Report Viewer", async () => {
    await expect(service.grant({
      roleAssignmentId: "assignment-1",
      permissionCode: "INCENTIVE_SALES_DIRECTOR_APPROVAL",
      scopeType: "company",
      companyId: "company-1",
      reason: "Sales director assignment",
      actorUserId: "admin-1",
    })).resolves.toMatchObject({ data: { assignment: { permissionCode: "INCENTIVE_SALES_DIRECTOR_APPROVAL" } } });
    expect(permissionRepository.grant).toHaveBeenCalled();
  });

  it("rejects self-grants and fixed Super Admin grants", async () => {
    await expect(service.grant({
      roleAssignmentId: "assignment-1", permissionCode: "reports.read", scopeType: "company",
      companyId: "company-1", reason: "self", actorUserId: "user-1",
    })).rejects.toBeInstanceOf(ForbiddenException);
    permissionRepository.getGrantContext.mockResolvedValueOnce({ ...context, role_code: "SUPER_ADMIN" });
    await expect(service.grant({
      roleAssignmentId: "assignment-1", permissionCode: "reports.read", scopeType: "company",
      companyId: "company-1", reason: "fixed", actorUserId: "admin-1",
    })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects conflicting executive approval stages", async () => {
    permissionRepository.hasConflictingApprovalStage.mockResolvedValueOnce(true);
    await expect(service.grant({
      roleAssignmentId: "assignment-1",
      permissionCode: "INCENTIVE_GENERAL_MANAGER_APPROVAL",
      scopeType: "company",
      companyId: "company-1",
      reason: "General manager assignment",
      actorUserId: "admin-1",
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects incentive stage capabilities in role defaults", async () => {
    const rolePermissionService = new AuthAdminService(
      { grantRolePermission: jest.fn() } as never,
      {
        getRoleById: jest.fn(async () => ({ role_id: "role-1", role_code: "REPORT_VIEWER" })),
        getPermissionByCode: jest.fn(async () => ({
          permission_id: "permission-1",
          permission_code: "INCENTIVE_GENERAL_MANAGER_APPROVAL",
        })),
      } as never,
      {} as never, {} as never, scopePolicy as never, {} as never,
    );
    await expect(rolePermissionService.grantRolePermission({
      roleId: "role-1",
      permissionCode: "INCENTIVE_GENERAL_MANAGER_APPROVAL",
      actorUserId: "admin-1",
    })).rejects.toBeInstanceOf(ForbiddenException);
  });
});
