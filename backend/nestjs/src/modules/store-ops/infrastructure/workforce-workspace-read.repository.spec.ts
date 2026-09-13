import { WorkforceWorkspaceReadRepository } from "./workforce-workspace-read.repository";

describe("WorkforceWorkspaceReadRepository", () => {
  it("reads a bounded store page and keeps active personnel separate from history", async () => {
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const repository = new WorkforceWorkspaceReadRepository({ query } as never);

    await repository.listStorePage({
      scope: { companyIds: [], regionIds: [], storeIds: ["11111111-1111-4111-8111-111111111111"] },
      limit: 50, offset: 0, query: "", status: "all", sort: "store", direction: "ascending",
    });
    await repository.listActivePersonnel({
      scope: { companyIds: [], regionIds: [], storeIds: ["11111111-1111-4111-8111-111111111111"] },
      storeId: "11111111-1111-4111-8111-111111111111",
      limit: 50,
      offset: 0,
    });
    await repository.listHistory({
      scope: { companyIds: [], regionIds: [], storeIds: ["11111111-1111-4111-8111-111111111111"] },
      storeId: "11111111-1111-4111-8111-111111111111",
      limit: 20,
      offset: 0,
    });

    const storeSql = String(query.mock.calls[0][0]);
    const activeSql = String(query.mock.calls[1][0]);
    const historySql = String(query.mock.calls[2][0]);
    expect(storeSql).toContain("Europe/Istanbul");
    expect(storeSql).toContain("LIMIT $4 OFFSET $5");
    expect(storeSql).toContain("COUNT(*)::text FROM filtered_store");
    expect(activeSql).toContain("COALESCE(assignment.start_date, employee.hire_date) <= clock.business_today");
    expect(activeSql).toContain("assignment.end_date >= clock.business_today");
    expect(activeSql).toContain("INNER JOIN scoped_store");
    expect(activeSql).toContain("LIMIT $3 OFFSET $4");
    expect(historySql).toContain("SUM(new_period)");
    expect(historySql).toContain("BOOL_OR(exit_date IS NULL)");
    expect(historySql).toContain("INNER JOIN scoped_store");
    expect(historySql).toContain("COUNT(*)::text FROM presence_periods");
    expect(historySql).not.toContain("kpi_actual");
    expect(historySql).not.toContain("score");
  });
  it("intersects the manager's current direct portfolio with the authorized scope before paging and summary", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const repository = new WorkforceWorkspaceReadRepository({ query } as never);
    const scope = { companyIds: ["company-a"], regionIds: [], storeIds: [] };
    await repository.listStorePage({ scope, regionManagerUserId: "manager-user", limit: 50, offset: 50, query: "", status: "all", sort: "store", direction: "ascending" });
    await repository.summarizeScope({ scope, regionManagerUserId: "manager-user" });
    for (const [sql, params] of query.mock.calls) {
      expect(sql).toContain("store.company_id = ANY($1::uuid[])");
      expect(sql).toContain("AND EXISTS (");
      expect(sql).toContain("manager_store.store_id = store.store_id");
      expect(sql).toContain("manager_store.user_id = $2::uuid");
      expect(sql).toContain("manager_account.is_active = TRUE");
      expect(sql).toContain("role.role_code = 'REGION_MANAGER'");
      expect(sql).toContain("manager_store.end_at > NOW()");
      expect(sql).toContain("manager_role.end_at >= NOW()");
      expect(params.slice(0, 2)).toEqual([["company-a"], "manager-user"]);
    }
    expect(query.mock.calls[0][0]).toContain("LIMIT $5 OFFSET $6");
  });

  it("does not use a region role assignment to infer the displayed store manager", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const repository = new WorkforceWorkspaceReadRepository({ query } as never);
    await repository.listStorePage({ scope: { companyIds: [], regionIds: [], storeIds: [] }, limit: 50, offset: 0, query: "", status: "all", sort: "store", direction: "ascending" });
    const sql = query.mock.calls[0][0];
    expect(sql).toContain("WHERE FALSE");
    expect(sql).toContain("manager_store.store_id = scoped_store.store_id");
    expect(sql).not.toContain("role_assignment.region_id = scoped_store.region_id");
  });

});
