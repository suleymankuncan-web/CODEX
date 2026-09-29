import { UserPermissionAssignmentRepository } from "./user-permission-assignment.repository";

const row = {
  user_permission_assignment_id: "grant-1",
  user_role_assignment_id: "role-assignment-1",
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
  grant_reason: "Business assignment",
  created_at: "2026-09-29T00:00:00.000Z",
  revoked_at: null,
  revoke_reason: null,
};

describe("UserPermissionAssignmentRepository", () => {
  it("writes grant audit evidence using the production audit schema", async () => {
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [{ exists: true }] })
      .mockResolvedValueOnce({ rows: [{ exists: true }] })
      .mockResolvedValueOnce({ rows: [row] })
      .mockResolvedValueOnce({ rows: [] });
    const repository = new UserPermissionAssignmentRepository({
      withTransaction: (callback: (client: { query: typeof query }) => unknown) => callback({ query }),
    } as never);

    await repository.grant({
      roleAssignmentId: "role-assignment-1", userId: "user-1", permissionId: "permission-1",
      scopeType: "company", companyId: "company-1", regionId: null, storeId: null,
      startsAt: null, endsAt: null, reason: "Business assignment", actorUserId: "admin-1",
    });

    const auditSql = String(query.mock.calls[3][0]);
    expect(auditSql).toContain("entity_name");
    expect(auditSql).toContain("metadata_json");
    expect(auditSql).toContain("company_id");
    expect(auditSql).not.toContain("entity_type");
    expect(auditSql).not.toContain("event_data");
  });
});
