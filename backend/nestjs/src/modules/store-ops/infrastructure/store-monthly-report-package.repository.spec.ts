import { StoreMonthlyReportPackageRepository } from "./store-monthly-report-package.repository";

describe("StoreMonthlyReportPackageRepository", () => {
  function createRepository() {
    const query = jest.fn(async (_sql: string, _params?: unknown[]) => ({ rowCount: 0, rows: [] }));
    const repository = new StoreMonthlyReportPackageRepository({ query } as never);

    return { query, repository };
  }

  it("does not query without company, region, store or region-manager scope", async () => {
    const { query, repository } = createRepository();

    await expect(
      repository.getStoreMonthlyReportPackageRows({
        periodStart: "2026-06-01",
        periodEnd: "2026-06-14",
        companyIds: [],
        regionIds: [],
        storeIds: [],
      }),
    ).resolves.toEqual([]);

    expect(query).not.toHaveBeenCalled();
  });

  it("uses scoped_stores as the first CTE and applies all supported scope sources", async () => {
    const { query, repository } = createRepository();

    await repository.getStoreMonthlyReportPackageRows({
      periodStart: "2026-06-01",
      periodEnd: "2026-06-14",
      companyIds: ["00000000-0000-4000-8000-000000000001"],
      regionIds: ["00000000-0000-4000-8000-000000000010"],
      storeIds: ["00000000-0000-4000-8000-000000000100"],
      regionManagerUserId: "00000000-0000-4000-8000-000000000900",
    });

    const sql = String(query.mock.calls[0][0]);
    const params = query.mock.calls[0][1];

    expect(sql.trimStart().startsWith("WITH scoped_stores AS")).toBe(true);
    expect(sql).toContain("store.company_id = ANY($3::uuid[])");
    expect(sql).toContain("store.region_id = ANY($4::uuid[])");
    expect(sql).toContain("store.store_id = ANY($5::uuid[])");
    expect(sql).toContain("ops.user_action_store_assignment action_scope");
    expect(sql).toContain("action_scope.user_id = $6::uuid");
    expect(params).toEqual([
      "2026-06-01",
      "2026-06-14",
      ["00000000-0000-4000-8000-000000000001"],
      ["00000000-0000-4000-8000-000000000010"],
      ["00000000-0000-4000-8000-000000000100"],
      "00000000-0000-4000-8000-000000000900",
    ]);
  });

  it("allows region manager assignment scope without broad org ids", async () => {
    const { query, repository } = createRepository();

    await repository.getStoreMonthlyReportPackageRows({
      periodStart: "2026-06-01",
      periodEnd: "2026-06-14",
      companyIds: [],
      regionIds: [],
      storeIds: [],
      regionManagerUserId: "00000000-0000-4000-8000-000000000900",
    });

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][1]).toEqual([
      "2026-06-01",
      "2026-06-14",
      [],
      [],
      [],
      "00000000-0000-4000-8000-000000000900",
    ]);
  });

  it("resolves report region manager names from active role assignments, not action assignments", async () => {
    const { query, repository } = createRepository();

    await repository.getStoreMonthlyReportPackageRows({
      periodStart: "2026-06-01",
      periodEnd: "2026-06-14",
      companyIds: [],
      regionIds: [],
      storeIds: [],
      regionManagerUserId: "00000000-0000-4000-8000-000000000900",
    });

    const sql = String(query.mock.calls[0][0]);
    const managerNameCte = sql.slice(sql.indexOf("region_manager_names AS"));

    expect(managerNameCte).toContain("ops.user_role_assignment");
    expect(managerNameCte).toContain("role.role_code = 'REGION_MANAGER'");
    expect(managerNameCte).toContain("ROW_NUMBER() OVER");
    expect(managerNameCte).not.toContain("ops.user_action_store_assignment action_scope");
  });
});
