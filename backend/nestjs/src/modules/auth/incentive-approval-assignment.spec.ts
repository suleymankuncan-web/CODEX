import { AuthAdminService } from "./auth-admin.service";
import { AuthRoleAssignmentCommandRepository } from "./auth-role-assignment-command.repository";
import { AuthAuthorizationRepository } from "./auth-authorization.repository";
import { ForbiddenException } from "@nestjs/common";

describe("individual prim grant assignment", () => {
  it.each(["SUPER_ADMIN", "REGION_MANAGER", "STORE_MANAGER"])("rejects grants on %s at creation", async (roleCode) => {
    const service = new AuthAdminService({} as never, {} as never, {} as never, {} as never, {} as never, {} as never);
    await expect(service.createRoleAssignment({ userId: "user", roleCode, scopeType: "company", incentiveApproval: true, actorUserId: "admin" })).rejects.toThrow(ForbiddenException);
  });
  it("updates only an active company viewer assignment under a row lock, with audit", async () => {
    const before = { user_role_assignment_id: "assignment", role_code: "REPORT_VIEWER", incentive_approval: false, company_id: "company" };
    const query = jest.fn().mockResolvedValueOnce({ rows: [before] }).mockResolvedValueOnce({ rows: [{ ...before, incentive_approval: true }] }).mockResolvedValue({ rows: [] });
    const repo = new AuthRoleAssignmentCommandRepository({ withTransaction: async (fn: (client: { query: typeof query }) => Promise<unknown>) => fn({ query }) } as never);
    await expect(repo.updateIncentiveApproval({ assignmentId: "assignment", enabled: true, actorUserId: "admin" })).resolves.toMatchObject({ incentive_approval: true });
    expect(query.mock.calls[0][0]).toContain("r.role_code = 'REPORT_VIEWER'");
    expect(query.mock.calls[0][0]).toContain("ura.end_at > NOW()");
    expect(query.mock.calls[0][0]).toContain("FOR UPDATE OF ura");
    expect(query.mock.calls[2][0]).toContain("incentive_approval_updated");
  });
  it("does not mutate a missing, revoked or ineligible assignment", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const repo = new AuthRoleAssignmentCommandRepository({ withTransaction: async (fn: (client: { query: typeof query }) => Promise<unknown>) => fn({ query }) } as never);
    await expect(repo.updateIncentiveApproval({ assignmentId: "assignment", enabled: true, actorUserId: "admin" })).resolves.toBeNull();
    expect(query).toHaveBeenCalledTimes(1);
  });
  it("derives this permission from the individual assignment, excluding global role grants", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const repo = new AuthAuthorizationRepository({ query } as never);
    await repo.getActiveRoleAssignments("00000000-0000-4000-8000-000000000001");
    const sql = query.mock.calls[0][0];
    expect(sql).toContain("permission.permission_code <> 'INCENTIVE_FINAL_APPROVAL'");
    expect(sql).toContain("ura.incentive_approval AND r.role_code = 'REPORT_VIEWER'");
  });
});
