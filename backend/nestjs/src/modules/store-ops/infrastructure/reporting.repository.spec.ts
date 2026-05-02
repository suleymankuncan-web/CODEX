import { ReportingRepository } from "./reporting.repository";

describe("ReportingRepository closed daily snapshot selection", () => {
  function createRepository() {
    const query = jest.fn(async (_sql: string, _params?: unknown[]) => ({ rowCount: 0, rows: [] }));
    const repository = new ReportingRepository({ query } as never);

    return { query, repository };
  }

  it("ignores multi-day daily snapshots when selecting the latest closed daily run", async () => {
    const { query, repository } = createRepository();

    await repository.getLatestCompletedSnapshotRunByType("daily");

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("($1 <> 'daily' OR sr.period_start = sr.period_end)"),
      ["daily"],
    );
  });

  it("only lists single-day daily snapshots for monthly closed rankings", async () => {
    const { query, repository } = createRepository();

    await repository.listCompletedDailySnapshotsInMonth({ monthStart: "2026-04-01" });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("sr.period_start = sr.period_end"),
      ["2026-04-01"],
    );
  });

  it("casts closed daily snapshot dates to API-safe date strings", async () => {
    const { query, repository } = createRepository();

    await repository.getLatestCompletedSnapshotRunByType("daily");
    await repository.getCompletedDailySnapshotByDate({ periodStart: "2026-04-24" });
    await repository.listCompletedDailySnapshotsInMonth({ monthStart: "2026-04-01" });

    for (const [sql] of query.mock.calls) {
      expect(String(sql)).toContain("sr.snapshot_date::text AS snapshot_date");
      expect(String(sql)).toContain("sr.period_start::text AS period_start");
      expect(String(sql)).toContain("sr.period_end::text AS period_end");
    }
  });
});

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

  it("returns empty report lists without querying when actor scope is empty", async () => {
    const { query, repository } = createRepository();

    await expect(
      repository.getWorkforceReport({
        snapshotRunId: "00000000-0000-4000-8000-000000000001",
        ...emptyScope,
      }),
    ).resolves.toEqual({ rows: [], total: 0 });
    await expect(
      repository.getKpiReport({
        snapshotRunId: "00000000-0000-4000-8000-000000000001",
        ...emptyScope,
      }),
    ).resolves.toEqual({ rows: [], total: 0 });
    await expect(
      repository.getChecklistReport({
        snapshotRunId: "00000000-0000-4000-8000-000000000001",
        ...emptyScope,
      }),
    ).resolves.toEqual({ rows: [], total: 0 });
    await expect(
      repository.getTurnoverReport({
        snapshotRunId: "00000000-0000-4000-8000-000000000001",
        ...emptyScope,
      }),
    ).resolves.toEqual({ rows: [], total: 0 });

    expect(query).not.toHaveBeenCalled();
  });

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

describe("ReportingRepository store monthly score breakdown queries", () => {
  function createRepository() {
    const query = jest.fn(async (_sql: string, _params?: unknown[]) => ({
      rowCount: 0,
      rows: [],
    }));
    const repository = new ReportingRepository({ query } as never);

    return { query, repository };
  }

  it("queries monthly KPI snapshot rows for a store and snapshot run", async () => {
    const { query, repository } = createRepository();

    await repository.getStoreKpiSnapshotRowsForScore({
      snapshotRunId: "00000000-0000-4000-8000-000000000001",
      storeId: "00000000-0000-4000-8000-000000000002",
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("FROM rpt.store_kpi_snapshot sks"),
      [
        "00000000-0000-4000-8000-000000000001",
        "00000000-0000-4000-8000-000000000002",
      ],
    );
  });

  it("queries completed BM checklist snapshot rows by template type", async () => {
    const { query, repository } = createRepository();

    await repository.getStoreChecklistSnapshotForScore({
      snapshotRunId: "00000000-0000-4000-8000-000000000001",
      storeId: "00000000-0000-4000-8000-000000000002",
      templateType: "BM_STORE_VISIT",
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("ct.template_type = $3"),
      [
        "00000000-0000-4000-8000-000000000001",
        "00000000-0000-4000-8000-000000000002",
        "BM_STORE_VISIT",
      ],
    );
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

  it("calculates store ATV UPT CR benchmarks from weighted totals", async () => {
    const { query, repository } = createRepository();

    await repository.getStoreTurkeyBenchmarkValues({
      periodType: "daily",
      periodStart: "2026-03-01",
      periodEnd: "2026-03-01",
      companyId: "00000000-0000-4000-8000-000000000001",
    });

    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain(
      "SUM(net_sales.actual_value) / NULLIF(SUM(ticket_count.actual_value), 0)",
    );
    expect(sql).toContain(
      "SUM(item_count.actual_value) / NULLIF(SUM(ticket_count.actual_value), 0)",
    );
    expect(sql).toContain(
      "(SUM(ticket_count.actual_value) / NULLIF(SUM(ff.actual_value), 0)) * 100",
    );
  });

  it("calculates personnel ATV UPT benchmarks for the same period", async () => {
    const { query, repository } = createRepository();

    await repository.getEmployeeTurkeyBenchmarkValues({
      periodStart: "2026-03-01",
      periodEnd: "2026-03-31",
      companyId: "00000000-0000-4000-8000-000000000001",
    });

    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("scope_type = 'employee'");
    expect(sql).toContain(
      "SUM(net_sales.actual_value) / NULLIF(SUM(ticket_count.actual_value), 0)",
    );
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
    expect(sql).toContain("kd.kpi_code = 'TARGET_ACHIEVEMENT'");
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
    expect(sql).toContain("kd.kpi_code = 'TARGET_ACHIEVEMENT'");
    expect(sql).toContain("ptr.target_value::text AS target_value");
    expect(sql).toContain(
      "ptr.personnel_target_reference_id::text AS personnel_target_reference_id",
    );
  });
});
