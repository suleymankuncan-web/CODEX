import { SalesTargetIncentiveAdminPackageReadRepository } from "./sales-target-incentive-admin-package-read.repository";

function createRepository() {
  const query = jest.fn(async (_sql: string, _params?: unknown[]) => ({
    rowCount: 0,
    rows: [],
  }));
  const repository = new SalesTargetIncentiveAdminPackageReadRepository({ query } as never);

  return { query, repository };
}

describe("SalesTargetIncentiveAdminPackageReadRepository", () => {
  it("counts only active company stores in current admin package summaries", async () => {
    const { query, repository } = createRepository();

    await repository.listRegionPackageSummaries({
      periodKey: "2026-05",
      companyIds: ["00000000-0000-4000-8000-000000000001"],
      regionIds: [],
      storeIds: [],
      allowGlobalScope: false,
    });

    const [sql, params] = query.mock.calls[0];
    const text = String(sql);

    expect(text).toContain("WHERE store.store_type = 'company'");
    expect(text).toContain("AND store.status = 'active'");
    expect(text).toContain("AND store.region_id IS NOT NULL");
    expect(text).toContain("INNER JOIN ops.user_action_store_assignment manager_store");
    expect(text).toContain("assigned_store.region_id = base_region.region_id");
    expect(text).not.toContain("role_assignment.region_id = base_region.region_id");
    expect(params).toEqual([
      "2026-05",
      ["00000000-0000-4000-8000-000000000001"],
      [],
      [],
      false,
    ]);
  });
});
