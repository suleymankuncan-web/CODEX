import { AuthAuthorizationRepository } from "./auth-authorization.repository";

describe("AuthAuthorizationRepository", () => {
  it("queries role assignments for deterministic seed UUIDs accepted by Postgres", async () => {
    const databaseService = {
      query: jest.fn(async (_sql: string, _params?: unknown[]) => ({ rows: [] })),
    };
    const repository = new AuthAuthorizationRepository(databaseService as never);

    await repository.getActiveRoleAssignments("80000000-0000-0000-0000-000000000900");

    expect(databaseService.query).toHaveBeenCalledTimes(1);
  });

  it("filters role assignments through active organization hierarchy", async () => {
    const databaseService = {
      query: jest.fn(async (_sql: string, _params?: unknown[]) => ({ rows: [] })),
    };
    const repository = new AuthAuthorizationRepository(databaseService as never);

    await repository.getActiveRoleAssignments("80000000-0000-0000-0000-000000000900");

    const sql = String(databaseService.query.mock.calls[0][0]);
    expect(sql).toContain("LEFT JOIN ops.company c");
    expect(sql).toContain("region.company_id = ura.company_id");
    expect(sql).toContain("store.region_id = ura.region_id");
    expect(sql).toContain("store.company_id = ura.company_id");
    expect(sql).toContain("(ura.scope_type = 'company' AND c.status = 'active')");
    expect(sql).toContain("region.status = 'active'");
    expect(sql).toContain("store.status = 'active'");
    expect(sql).toContain("ops.role_permission");
    expect(sql).toContain("permission_codes");
  });

  it("filters action store assignments through active organization hierarchy", async () => {
    const databaseService = {
      query: jest.fn(async (_sql: string, _params?: unknown[]) => ({ rows: [] })),
    };
    const repository = new AuthAuthorizationRepository(databaseService as never);

    await repository.getActiveActionStoreAssignments("80000000-0000-0000-0000-000000000900");

    const sql = String(databaseService.query.mock.calls[0][0]);
    expect(sql).toContain("INNER JOIN ops.region r");
    expect(sql).toContain("r.company_id = s.company_id");
    expect(sql).toContain("INNER JOIN ops.company c");
    expect(sql).toContain("s.status = 'active'");
    expect(sql).toContain("r.status = 'active'");
    expect(sql).toContain("c.status = 'active'");
  });
});
