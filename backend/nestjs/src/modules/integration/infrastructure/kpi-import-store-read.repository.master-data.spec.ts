import { KpiImportStoreReadRepository } from "./kpi-import-store-read.repository";

describe("KpiImportStoreReadRepository master data identities", () => {
  it("resolves each store manager from an active direct store assignment", async () => {
    const query = jest.fn().mockResolvedValueOnce({ rows: [{ total_count: "0" }] }).mockResolvedValueOnce({ rows: [] });
    const repository = new KpiImportStoreReadRepository({ query } as never);

    await repository.listKpiImportStoreScope({ actorCompanyIds: ["company-1"] });

    const sql = query.mock.calls.map(([statement]) => String(statement)).join("\n");
    expect(sql).toContain("FROM ops.user_action_store_assignment manager_store");
    expect(sql).toContain("manager_store.store_id = s.store_id");
    expect(sql).toContain("role.role_code = 'REGION_MANAGER'");
    expect(sql).not.toContain("ura.region_id = s.region_id");
  });

  it("lists only active region-manager identities inside the actor company scope", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const repository = new KpiImportStoreReadRepository({ query } as never);

    await repository.listStoreMasterRegionManagers({
      actorCompanyIds: ["company-1"],
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("role.role_code = 'REGION_MANAGER'"),
      [["company-1"]],
    );
    const sql = String(query.mock.calls[0]?.[0]);
    expect(sql).toContain("ua.is_active = TRUE");
    expect(sql).toContain("ura.company_id = ANY($1::uuid[])");
    expect(sql).toContain("ops.user_action_store_assignment manager_store");
    expect(sql).toContain("ura.end_at IS NULL OR ura.end_at > NOW()");
  });
});
