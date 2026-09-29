import { KpiImportStoreReadRepository } from "./kpi-import-store-read.repository";

describe("KpiImportStoreReadRepository store master enrichment", () => {
  it("keeps expensive ingest/contact enrichment out of the count query", async () => {
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [{ total_count: "1" }] })
      .mockResolvedValueOnce({ rows: [] });
    const repository = new KpiImportStoreReadRepository({ query } as never);

    await repository.listKpiImportStoreScope({ actorCompanyIds: ["company-1"] });

    const countSql = String(query.mock.calls[0][0]);
    const listSql = String(query.mock.calls[1][0]);
    expect(countSql).not.toContain("ops.store_contact_email");
    expect(countSql).not.toContain("ops.company_daily_kpi_store_sales");
    expect(listSql).toContain("ops.store_contact_email");
    expect(listSql).toContain("ops.company_daily_kpi_store_sales");
    expect(listSql).toContain("last_successful_kpi_date");
    expect(listSql).toContain("WITH store_page AS MATERIALIZED");
    expect(listSql.indexOf("LIMIT")).toBeLessThan(listSql.indexOf("ops.store_contact_email"));
  });

  it("searches region managers without referencing the paged enrichment alias", async () => {
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [{ total_count: "0" }] })
      .mockResolvedValueOnce({ rows: [] });
    const repository = new KpiImportStoreReadRepository({ query } as never);

    await repository.listKpiImportStoreScope({ actorCompanyIds: ["company-1"], q: "Eda" });

    const countSql = String(query.mock.calls[0][0]);
    expect(countSql).toContain("manager_store_search")
    expect(countSql).toContain("manager_role_catalog.role_code='REGION_MANAGER'")
    expect(countSql).not.toContain("region_manager.region_manager_name")
  });
});
