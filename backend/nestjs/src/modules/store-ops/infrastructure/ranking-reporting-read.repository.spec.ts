import { RankingReportingReadRepository } from "./ranking-reporting-read.repository";

describe("RankingReportingReadRepository source filters", () => {
  function createRepository() {
    const query = jest.fn(async (_sql: string, _params?: unknown[]) => ({
      rowCount: 0,
      rows: [],
    }));
    const repository = new RankingReportingReadRepository({ query } as never);

    return { query, repository };
  }

  it("excludes demo seed KPI rows from ranking period selection and lists", async () => {
    const { query, repository } = createRepository();

    await repository.getLatestRankingPeriod({
      metricCodes: ["ATV"],
      periodType: "monthly",
    });
    await repository.listRankingAvailablePeriods({
      metricCodes: ["ATV"],
    });
    await repository.listRankingStoreKpiRows({
      metricCodes: ["ATV"],
      companyIds: [],
      periodType: "monthly",
      periodStart: "2026-03-01",
      periodEnd: "2026-03-31",
    });
    await repository.listRankingPersonnelKpiRows({
      metricCodes: ["ATV"],
      companyIds: [],
      periodType: "monthly",
      periodStart: "2026-03-01",
      periodEnd: "2026-03-31",
    });
    await repository.listRankingFilterOptions({
      companyIds: [],
      periodType: "monthly",
      periodStart: "2026-03-01",
      periodEnd: "2026-03-31",
    });

    for (const [sql] of query.mock.calls) {
      if (!String(sql).includes("ops.kpi_actual ka")) {
        continue;
      }

      expect(String(sql)).toContain("COALESCE(ka.source_type, '') <> 'demo_seed'");
    }
  });

  it("selects the requested daily ranking period and lists daily plus monthly periods", async () => {
    const { query, repository } = createRepository();

    await repository.getLatestRankingPeriod({
      metricCodes: ["UPT"],
      periodType: "daily",
      periodStart: "2026-05-15",
    });
    await repository.listRankingAvailablePeriods({
      metricCodes: ["UPT"],
    });

    const [periodSql, periodParams] = query.mock.calls[0];
    expect(String(periodSql)).toContain("ka.period_type = $2");
    expect(String(periodSql)).toContain("ka.period_start = $3::date");
    expect(periodParams).toEqual([["UPT"], "daily", "2026-05-15"]);

    const [availableSql, availableParams] = query.mock.calls[1];
    expect(String(availableSql)).toContain("ka.period_type IN ('daily', 'monthly')");
    expect(availableParams).toEqual([["UPT"]]);
  });

  it("uses KPI import enabled stores for ranking lists and filter options", async () => {
    const { query, repository } = createRepository();

    await repository.listRankingStoreKpiRows({
      metricCodes: ["ATV"],
      companyIds: [],
      periodType: "monthly",
      periodStart: "2026-03-01",
      periodEnd: "2026-03-31",
    });
    await repository.listRankingPersonnelKpiRows({
      metricCodes: ["ATV"],
      companyIds: [],
      periodType: "monthly",
      periodStart: "2026-03-01",
      periodEnd: "2026-03-31",
    });
    await repository.listRankingFilterOptions({
      companyIds: [],
      periodType: "monthly",
      periodStart: "2026-03-01",
      periodEnd: "2026-03-31",
    });

    const storeScopedQueries = query.mock.calls
      .map(([sql]) => String(sql))
      .filter((sql) => sql.includes("ops.store store"));

    expect(storeScopedQueries.length).toBeGreaterThan(0);
    for (const sql of storeScopedQueries) {
      expect(sql).toContain("store.kpi_import_enabled = TRUE");
    }
  });

  it("reads completed BM and VM checklist averages for live store rankings", async () => {
    const { query, repository } = createRepository();

    await repository.listRankingStoreChecklistRows({
      companyIds: ["00000000-0000-4000-8000-000000000001"],
      periodStart: "2026-03-01",
      periodEnd: "2026-03-31",
    });

    const [sql, params] = query.mock.calls[0];

    expect(String(sql)).toContain("FROM ops.checklist_instance ci");
    expect(String(sql)).toContain("INNER JOIN ops.checklist_template ct");
    expect(String(sql)).toContain("ci.status = 'completed'");
    expect(String(sql)).toContain("ci.completed_at >= ($1::date::timestamp AT TIME ZONE 'Europe/Istanbul') AND ci.completed_at < (($2::date + 1)::timestamp AT TIME ZONE 'Europe/Istanbul')");
    expect(String(sql)).toContain("WHEN 'BM_STORE_VISIT' THEN 'BM_CHECKLIST'");
    expect(String(sql)).toContain("WHEN 'VM_STORE_VISIT' THEN 'VM_CHECKLIST'");
    expect(String(sql)).toContain("store.kpi_import_enabled = TRUE");
    expect(String(sql)).toContain("store.company_id = ANY($3::uuid[])");
    expect(params).toEqual([
      "2026-03-01",
      "2026-03-31",
      ["00000000-0000-4000-8000-000000000001"],
    ]);
  });

  it("attributes KPI stores to active Region Manager roles through direct store assignments", async () => {
    const { query, repository } = createRepository();

    await repository.listRankingStoreKpiRows({
      metricCodes: ["ATV"],
      companyIds: ["00000000-0000-4000-8000-000000000001"],
      periodType: "monthly",
      periodStart: "2026-03-01",
      periodEnd: "2026-03-31",
    });
    await repository.listRankingStoreChecklistRows({
      companyIds: ["00000000-0000-4000-8000-000000000001"],
      periodStart: "2026-03-01",
      periodEnd: "2026-03-31",
    });
    await repository.listRankingPersonnelKpiRows({
      metricCodes: ["ATV"],
      companyIds: ["00000000-0000-4000-8000-000000000001"],
      periodType: "monthly",
      periodStart: "2026-03-01",
      periodEnd: "2026-03-31",
    });

    for (const [sql] of query.mock.calls) {
      expect(String(sql)).toContain("FROM ops.user_action_store_assignment manager_store");
      expect(String(sql)).toContain("manager_store.store_id = store.store_id");
      expect(String(sql)).toContain("role.role_code = 'REGION_MANAGER'");
      expect(String(sql)).not.toContain("WHERE ura.region_id = store.region_id");
    }
  });

  it("lists every active company Region Manager, including managers reached through direct stores", async () => {
    const { query, repository } = createRepository();

    await repository.listRankingFilterOptions({
      companyIds: ["00000000-0000-4000-8000-000000000001"],
      periodType: "monthly",
      periodStart: "2026-03-01",
      periodEnd: "2026-03-31",
    });

    const managerSql = String(query.mock.calls[0][0]);
    expect(managerSql).toContain("role.role_code = 'REGION_MANAGER'");
    expect(managerSql).toContain("ops.user_action_store_assignment manager_store");
    expect(managerSql).toContain("assigned_store.company_id = ANY($1::uuid[])");
    expect(managerSql).toContain("ARRAY_AGG(DISTINCT assigned_store.store_id::text)");
    expect(managerSql).toContain("ua.is_active = TRUE");
    expect(managerSql).not.toContain("employee.employment_status = 'active'");
  });

  it("joins approved personnel target references for ranking personnel NET_SALES rows", async () => {
    const { query, repository } = createRepository();

    await repository.listRankingPersonnelKpiRows({
      metricCodes: ["NET_SALES"],
      companyIds: [],
      periodType: "monthly",
      periodStart: "2026-03-01",
      periodEnd: "2026-03-31",
    });

    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("FROM ops.personnel_target_reference ptr");
    expect(sql).toContain("ptr.employee_id = employee.employee_id");
    expect(sql).toContain("ptr.store_id = store.store_id");
    expect(sql).toContain("ptr.target_type = 'monthly_sales_target'");
    expect(sql).toContain("ptr.status = 'approved'");
    expect(sql).toContain(
      "kd.kpi_code IN ('TARGET_ACHIEVEMENT', 'NET_SALES', 'STORE_SALES', 'SALES_TARGET_ACHIEVEMENT')",
    );
    expect(sql).toContain("THEN monthly_target.value END::text AS target_value");
  });

  it("projects personnel position and sales totals for official ranking eligibility", async () => {
    const { query, repository } = createRepository();

    await repository.listRankingPersonnelKpiRows({
      metricCodes: ["TARGET_ACHIEVEMENT"],
      companyIds: [],
      periodType: "monthly",
      periodStart: "2026-03-01",
      periodEnd: "2026-03-31",
    });

    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("position.position_code");
    expect(sql).toContain("employee_sales.net_sales_value::text AS net_sales_value");
    expect(sql).toContain(
      "store_sales.store_net_sales_value::text AS store_net_sales_value",
    );
    expect(sql).toContain("AND net_kd.kpi_code = 'NET_SALES'");
    expect(sql).toContain("net_ka.employee_id = ka.employee_id");
    expect(sql).toContain("net_ka.store_id = store.store_id");
  });
});
