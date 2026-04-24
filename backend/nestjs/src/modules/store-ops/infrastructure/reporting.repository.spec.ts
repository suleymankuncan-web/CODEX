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
