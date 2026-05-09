import { ClosedRankingRepository } from "./closed-ranking.repository";

describe("ClosedRankingRepository closed ranking queries", () => {
  function createRepository() {
    const query = jest.fn(async (_sql: string, _params?: unknown[]) => ({
      rowCount: 0,
      rows: [],
    }));
    const repository = new ClosedRankingRepository({ query } as never);

    return { query, repository };
  }

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

    await repository.listCompletedDailySnapshotsInMonth({ monthStart: "2026-04-01" });

    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("sr.snapshot_date::text AS snapshot_date");
    expect(sql).toContain("sr.period_start::text AS period_start");
    expect(sql).toContain("sr.period_end::text AS period_end");
  });

  it("keeps company and store filters on closed daily personnel rank rows", async () => {
    const { query, repository } = createRepository();

    await repository.listClosedDailyPersonnelRankRows({
      snapshotRunId: "00000000-0000-4000-8000-000000000001",
      companyId: "00000000-0000-4000-8000-000000000002",
      storeId: "00000000-0000-4000-8000-000000000003",
      limit: 10,
    });

    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("/* closed_personnel_daily_rank_rows */");
    expect(sql).toContain("store.company_id = $2::uuid");
    expect(sql).toContain("eps.store_id = $3::uuid");
    expect(query).toHaveBeenCalledWith(expect.any(String), [
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000002",
      "00000000-0000-4000-8000-000000000003",
      10,
    ]);
  });

  it("keeps empty metric inputs query-free", async () => {
    const { query, repository } = createRepository();

    await expect(
      repository.listClosedDailyMetricRankRows({
        snapshotRunId: "00000000-0000-4000-8000-000000000001",
        employeeIds: [],
      }),
    ).resolves.toEqual([]);
    await expect(
      repository.listClosedMonthlyMetricRankRows({
        snapshotRunIds: [],
        employeeIds: ["00000000-0000-4000-8000-000000000002"],
      }),
    ).resolves.toEqual([]);

    expect(query).not.toHaveBeenCalled();
  });
});
