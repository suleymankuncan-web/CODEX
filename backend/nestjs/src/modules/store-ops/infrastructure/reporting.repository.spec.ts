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
});
