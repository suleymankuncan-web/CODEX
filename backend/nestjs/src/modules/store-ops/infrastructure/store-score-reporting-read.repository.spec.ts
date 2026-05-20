import { StoreScoreReportingReadRepository } from "./store-score-reporting-read.repository";

describe("StoreScoreReportingReadRepository store monthly score breakdown queries", () => {
  function createRepository() {
    const query = jest.fn(async (_sql: string, _params?: unknown[]) => ({
      rowCount: 0,
      rows: [],
    }));
    const repository = new StoreScoreReportingReadRepository({ query } as never);

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
