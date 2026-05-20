import { ReportingRepository } from "./reporting.repository";

describe("ReportingRepository access scope contract", () => {
  function createRepository() {
    const query = jest.fn(async (_sql: string, _params?: unknown[]) => ({ rowCount: 0, rows: [] }));
    const repository = new ReportingRepository({ query } as never);

    return { query, repository };
  }

  const emptyScope = {
    companyIds: [],
    regionIds: [],
    storeIds: [],
  };

  it("returns empty employee KPI period lookups without querying when actor scope is empty", async () => {
    const { query, repository } = createRepository();

    await expect(
      repository.getLatestEmployeeKpiPeriod({
        employeeId: "00000000-0000-4000-8000-000000000010",
        metricCodes: ["UPT"],
        ...emptyScope,
      }),
    ).resolves.toBeNull();
    await expect(
      repository.listEmployeeKpiPeriods({
        employeeId: "00000000-0000-4000-8000-000000000010",
        metricCodes: ["UPT"],
        ...emptyScope,
      }),
    ).resolves.toEqual([]);

    expect(query).not.toHaveBeenCalled();
  });

  it("allows explicit global employee KPI period lookups for super-admin profile reads", async () => {
    const { query, repository } = createRepository();

    await repository.getLatestEmployeeKpiPeriod({
      employeeId: "00000000-0000-4000-8000-000000000010",
      metricCodes: ["UPT"],
      ...emptyScope,
      allowGlobalScope: true,
    });
    await repository.listEmployeeKpiPeriods({
      employeeId: "00000000-0000-4000-8000-000000000010",
      metricCodes: ["UPT"],
      ...emptyScope,
      allowGlobalScope: true,
    });

    expect(query).toHaveBeenCalledTimes(2);
    for (const [, params] of query.mock.calls) {
      expect(params).toEqual([
        "00000000-0000-4000-8000-000000000010",
        ["UPT"],
      ]);
    }
  });

  it("uses active assignment fallback when scoping live employee KPI period lookups", async () => {
    const { query, repository } = createRepository();

    await repository.getLatestEmployeeKpiPeriod({
      employeeId: "00000000-0000-4000-8000-000000000010",
      metricCodes: ["UPT"],
      companyIds: [],
      regionIds: [],
      storeIds: ["00000000-0000-4000-8000-000000000100"],
    });
    await repository.listEmployeeKpiPeriods({
      employeeId: "00000000-0000-4000-8000-000000000010",
      metricCodes: ["UPT"],
      companyIds: [],
      regionIds: ["00000000-0000-4000-8000-000000000010"],
      storeIds: [],
    });

    const latestSql = String(query.mock.calls[0][0]);
    const listSql = String(query.mock.calls[1][0]);

    expect(latestSql).toContain("LEFT JOIN LATERAL");
    expect(latestSql).toContain("assignment_status = 'active'");
    expect(latestSql).toContain("COALESCE(ka.store_id, assignment.store_id)");
    expect(latestSql).toContain("COALESCE(ka.store_id, assignment.store_id)::text AS store_id");
    expect(listSql).toContain("LEFT JOIN LATERAL");
    expect(listSql).toContain("assignment_status = 'active'");
    expect(listSql).toContain(
      "COALESCE(ka.region_id, assignment.region_id, store.region_id)",
    );
  });

  it("does not resolve external employee references without company scope", async () => {
    const { query, repository } = createRepository();

    await expect(
      repository.getEmployeeIdByExternalRef({
        externalEmployeeRef: "seller-001",
        companyIds: [],
      }),
    ).resolves.toBeNull();

    expect(query).not.toHaveBeenCalled();
  });

  it("accepts deterministic seed employee UUIDs without resolving them as external refs", async () => {
    const { query, repository } = createRepository();

    await expect(
      repository.resolveEmployeeIdForAuthIdentity({
        userId: "80000000-0000-0000-0000-000000000900",
        employeeId: "00000000-0000-0000-0000-000000000201",
        companyIds: ["00000000-0000-0000-0000-000000000001"],
      }),
    ).resolves.toBe("00000000-0000-0000-0000-000000000201");

    expect(query).not.toHaveBeenCalled();
  });
});

describe("ReportingRepository benchmark queries", () => {
  function createRepository() {
    const query = jest.fn(async (_sql: string, _params?: unknown[]) => ({
      rowCount: 0,
      rows: [],
    }));
    const repository = new ReportingRepository({ query } as never);

    return { query, repository };
  }

  it("calculates personnel ATV UPT benchmarks from PowerBI-compatible KPI averages", async () => {
    const { query, repository } = createRepository();

    await repository.getEmployeeTurkeyBenchmarkValues({
      periodStart: "2026-03-01",
      periodEnd: "2026-03-31",
      companyId: "00000000-0000-4000-8000-000000000001",
    });

    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("scope_type = 'employee'");
    expect(sql).toContain("AVG(ka.actual_value)::text AS benchmark_value");
    expect(sql).toContain("kd.kpi_code IN ('ATV', 'UPT')");
    expect(sql).not.toContain("SUM(net_sales.actual_value)");
    expect(sql).not.toContain("SUM(item_count.actual_value)");
    expect(sql).not.toContain("SUM(ticket_count.actual_value)");
  });

  it("excludes demo seed KPI rows from personnel ranking Turkey benchmarks", async () => {
    const { query, repository } = createRepository();

    await repository.getEmployeeTurkeyBenchmarkValues({
      periodType: "monthly",
      periodStart: "2026-03-01",
      periodEnd: "2026-03-31",
    });

    for (const [sql] of query.mock.calls) {
      expect(String(sql)).toContain("COALESCE(ka.source_type, '') <> 'demo_seed'");
    }
  });
});

describe("ReportingRepository personnel target reference queries", () => {
  function createRepository() {
    const query = jest.fn(async (_sql: string, _params?: unknown[]) => ({
      rowCount: 0,
      rows: [],
    }));
    const repository = new ReportingRepository({ query } as never);

    return { query, repository };
  }

  it("joins approved personnel target references for live employee performance rows", async () => {
    const { query, repository } = createRepository();

    await repository.getEmployeePerformanceRows({
      employeeId: "00000000-0000-4000-8000-000000000010",
      metricCodes: ["TARGET_ACHIEVEMENT"],
      periodStart: "2026-03-01",
      periodEnd: "2026-03-31",
    });

    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("LEFT JOIN ops.personnel_target_reference ptr");
    expect(sql).toContain("ptr.employee_id = ka.employee_id");
    expect(sql).toContain("ptr.period_start <= ka.period_start");
    expect(sql).toContain("ptr.period_end >= ka.period_end");
    expect(sql).toContain("ptr.target_type = 'monthly_sales_target'");
    expect(sql).toContain("ptr.status = 'approved'");
    expect(sql).toContain(
      "kd.kpi_code IN ('TARGET_ACHIEVEMENT', 'NET_SALES', 'STORE_SALES', 'SALES_TARGET_ACHIEVEMENT')",
    );
    expect(sql).toContain("ptr.target_value::text AS target_value");
    expect(sql).toContain(
      "ptr.personnel_target_reference_id::text AS personnel_target_reference_id",
    );
  });

  it("joins approved personnel target references for live peer employee performance rows", async () => {
    const { query, repository } = createRepository();

    await repository.getPeerEmployeePerformanceRows({
      metricCodes: ["TARGET_ACHIEVEMENT"],
      companyId: "00000000-0000-4000-8000-000000000001",
      storeId: null,
      periodStart: "2026-03-01",
      periodEnd: "2026-03-31",
    });

    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("LEFT JOIN ops.personnel_target_reference ptr");
    expect(sql).toContain("ptr.employee_id = ka.employee_id");
    expect(sql).toContain("ptr.period_start <= ka.period_start");
    expect(sql).toContain("ptr.period_end >= ka.period_end");
    expect(sql).toContain("ptr.target_type = 'monthly_sales_target'");
    expect(sql).toContain("ptr.status = 'approved'");
    expect(sql).toContain(
      "kd.kpi_code IN ('TARGET_ACHIEVEMENT', 'NET_SALES', 'STORE_SALES', 'SALES_TARGET_ACHIEVEMENT')",
    );
    expect(sql).toContain("ptr.target_value::text AS target_value");
    expect(sql).toContain(
      "ptr.personnel_target_reference_id::text AS personnel_target_reference_id",
    );
  });

});

describe("ReportingRepository personnel period compatibility", () => {
  function createRepository() {
    const query = jest.fn(async (_sql: string, _params?: unknown[]) => ({
      rowCount: 0,
      rows: [],
    }));
    const repository = new ReportingRepository({ query } as never);

    return { query, repository };
  }

  it("lets monthly personnel profile lookups find custom imported periods for the same month", async () => {
    const { query, repository } = createRepository();

    await repository.getLatestEmployeeKpiPeriod({
      employeeId: "00000000-0000-4000-8000-000000000010",
      metricCodes: ["NET_SALES"],
      companyIds: ["00000000-0000-4000-8000-000000000001"],
      regionIds: [],
      storeIds: [],
      periodType: "monthly",
      periodStart: "2026-03-01",
    });

    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("ka.period_type = ");
    expect(sql).toContain("ka.period_type = 'custom'");
    expect(sql).toContain("ka.period_start = ");
    expect(sql).toContain("DATE_TRUNC('month', ka.period_start)::date");
  });
});
