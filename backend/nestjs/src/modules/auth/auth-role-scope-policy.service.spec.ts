import { AuthRoleScopePolicyService } from "./auth-role-scope-policy.service";

describe("AuthRoleScopePolicyService", () => {
  const service = new AuthRoleScopePolicyService();

  it("allows region manager role assignments to be narrowed to store scope", () => {
    expect(() =>
      service.validateRoleScope({
        roleCode: "REGION_MANAGER",
        roleScopeType: "region",
        assignmentScopeType: "store",
      }),
    ).not.toThrow();
  });

  it("rejects report viewer assignments narrowed to store scope", () => {
    expect(() =>
      service.validateRoleScope({
        roleCode: "REPORT_VIEWER",
        roleScopeType: "company",
        assignmentScopeType: "store",
      }),
    ).toThrow("Role scope type does not match assignment scope");
  });
});
