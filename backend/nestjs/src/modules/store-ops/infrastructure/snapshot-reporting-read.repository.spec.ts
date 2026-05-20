import { SnapshotReportingReadRepository } from "./snapshot-reporting-read.repository";

describe("SnapshotReportingReadRepository access scope contract", () => {
  function createRepository() {
    const query = jest.fn(async (_sql: string, _params?: unknown[]) => ({ rowCount: 0, rows: [] }));
    const repository = new SnapshotReportingReadRepository({ query } as never);

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
});
