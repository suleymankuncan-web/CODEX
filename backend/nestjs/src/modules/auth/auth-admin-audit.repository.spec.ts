import { AuthAdminAuditRepository } from "./auth-admin-audit.repository";

describe("AuthAdminAuditRepository", () => {
  const assignmentId = "11111111-1111-4111-8111-111111111111";
  const userId = "22222222-2222-4222-8222-222222222222";
  const event = {
    event_log_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    occurred_at: "2026-04-17T20:00:00.000Z",
    actor_user_id: userId,
    event_type: "user_role_assignment.created",
    metadata_json: { changedFields: ["roleId"] },
  };

  it.each([
    ["role assignment", "getRoleAssignmentAudit", "ops.user_role_assignment", { assignmentId }],
    [
      "action-store assignment",
      "getActionStoreAssignmentAudit",
      "ops.user_action_store_assignment",
      { assignmentId },
    ],
    ["user account", "getUserAccountAudit", "ops.user_account", { userId }],
  ])(
    "returns a page and truthful total for %s from one bounded query",
    async (_label, method, entityName, input) => {
      const query = jest.fn().mockResolvedValue({
        rowCount: 1,
        rows: [{ ...event, total_count: "3" }],
      });
      const repository = new AuthAdminAuditRepository({ query } as never);

      const result = await (repository[method as keyof AuthAdminAuditRepository] as Function)({
        ...input,
        limit: 1,
        offset: 2,
      });

      expect(query).toHaveBeenCalledTimes(1);
      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain("WITH filtered AS");
      expect(sql).toContain("COUNT(*)::text AS total_count");
      expect(sql).toContain("UNION ALL");
      expect(sql).toContain(`entity_name = '${entityName}'`);
      expect(sql).toContain("ORDER BY occurred_at ASC, event_log_id ASC");
      expect(sql).toContain("LIMIT $2 OFFSET $3");
      expect(params).toEqual([Object.values(input)[0], 1, 2]);
      expect(result).toEqual({ rows: [event], total: 3 });
    },
  );

  it("defaults audit pages to 50 rows at offset zero", async () => {
    const query = jest.fn().mockResolvedValue({
      rowCount: 0,
      rows: [],
    });
    const repository = new AuthAdminAuditRepository({ query } as never);

    await repository.getUserAccountAudit({ userId });

    expect(query).toHaveBeenCalledWith(expect.stringContaining("LIMIT $2 OFFSET $3"), [
      userId,
      50,
      0,
    ]);
  });

  it("keeps a nonzero total when the requested page is empty", async () => {
    const query = jest.fn().mockResolvedValue({
      rowCount: 1,
      rows: [
        {
          row_kind: "meta",
          event_log_id: null,
          occurred_at: null,
          actor_user_id: null,
          event_type: null,
          metadata_json: null,
          total_count: "3",
        },
      ],
    });
    const repository = new AuthAdminAuditRepository({ query } as never);

    const result = await repository.getUserAccountAudit({
      userId,
      limit: 1,
      offset: 3,
    });

    expect(result).toEqual({ rows: [], total: 3 });
    expect(query).toHaveBeenCalledTimes(1);
  });
});
