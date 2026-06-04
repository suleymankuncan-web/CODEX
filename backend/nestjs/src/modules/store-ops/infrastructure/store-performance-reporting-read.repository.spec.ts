import { StorePerformanceReportingReadRepository } from "./store-performance-reporting-read.repository";

describe("StorePerformanceReportingReadRepository benchmark queries", () => {
  function createRepository() {
    const query = jest.fn(async (_sql: string, _params?: unknown[]) => ({
      rowCount: 0,
      rows: [],
    }));
    const repository = new StorePerformanceReportingReadRepository({ query } as never);

    return { query, repository };
  }

  it("calculates store ATV UPT CR benchmarks with PowerBI metric-specific aggregation", async () => {
    const { query, repository } = createRepository();

    await repository.getStoreTurkeyBenchmarkValues({
      periodType: "daily",
      periodStart: "2026-03-01",
      periodEnd: "2026-03-01",
      companyId: "00000000-0000-4000-8000-000000000001",
    });

    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("store.kpi_import_enabled = TRUE");
    expect(sql).toContain("SELECT 'ATV' AS kpi_code");
    expect(sql).toContain("AVG(scoped_actual.actual_value)::text AS benchmark_value");
    expect(sql).toContain("SUM(item_count.actual_value) / NULLIF(SUM(ticket_count.actual_value), 0)");
    expect(sql).toContain("SUM(ticket_count.actual_value) / NULLIF(SUM(ff.actual_value), 0)");
  });

  it("excludes demo seed KPI rows from store benchmark queries", async () => {
    const { query, repository } = createRepository();

    await repository.getStoreTurkeyBenchmarkValues({
      periodType: "monthly",
      periodStart: "2026-03-01",
      periodEnd: "2026-03-31",
    });

    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("COALESCE(ka.source_type, '') <> 'demo_seed'");
  });

  it("reads store scope for selected store access checks", async () => {
    const { query, repository } = createRepository();

    await repository.getStoreScopeById("00000000-0000-4000-8000-000000000101");

    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("company_id::text AS company_id");
    expect(sql).toContain("region_id::text AS region_id");
    expect(sql).toContain("WHERE store_id = $1::uuid");
    expect(query).toHaveBeenCalledWith(expect.any(String), [
      "00000000-0000-4000-8000-000000000101",
    ]);
  });

  it("checks active region-manager assignment before selected store access", async () => {
    const { query, repository } = createRepository();

    await repository.canRegionManagerReadStore({
      userId: "00000000-0000-4000-8000-000000000201",
      storeId: "00000000-0000-4000-8000-000000000101",
    });

    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("company.status = 'active'");
    expect(sql).toContain("region.status = 'active'");
    expect(sql).toContain("store.status = 'active'");
    expect(sql).toContain("role.role_code = 'REGION_MANAGER'");
    expect(sql).toContain("ura.company_id = store.company_id");
    expect(sql).toContain("ura.scope_type = 'region'");
    expect(sql).toContain("ura.region_id = store.region_id");
    expect(sql).toContain("ura.scope_type = 'store'");
    expect(sql).toContain("ura.store_id = store.store_id");
    expect(sql).toContain("ura.user_id = $1::uuid");
    expect(sql).toContain("store.store_id = $2::uuid");
    expect(sql).toContain("ura.start_at <= NOW()");
    expect(query).toHaveBeenCalledWith(expect.any(String), [
      "00000000-0000-4000-8000-000000000201",
      "00000000-0000-4000-8000-000000000101",
    ]);
  });
});
