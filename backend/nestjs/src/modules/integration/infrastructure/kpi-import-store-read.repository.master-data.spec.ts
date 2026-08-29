import { KpiImportStoreReadRepository } from "./kpi-import-store-read.repository";

describe("KpiImportStoreReadRepository master data identities", () => {
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
    expect(sql).toContain("ura.end_at IS NULL OR ura.end_at > NOW()");
  });
});
