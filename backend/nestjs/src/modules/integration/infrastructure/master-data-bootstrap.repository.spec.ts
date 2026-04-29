import { MasterDataBootstrapRepository } from "./master-data-bootstrap.repository";

describe("MasterDataBootstrapRepository", () => {
  it("inserts bootstrap batches and rows only into staging tables", async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            master_data_bootstrap_batch_id: "00000000-0000-4000-8000-000000000901",
            company_id: "00000000-0000-4000-8000-000000000001",
            bootstrap_entity: "store",
            source_label: "April store baseline",
            file_reference: "store-master-data-april.xlsx",
            uploaded_by_user_id: "hr-admin-user",
            batch_status: "uploaded",
            row_count: 1,
            valid_count: 0,
            needs_review_count: 0,
            invalid_count: 0,
            promoted_count: 0,
            created_at: "2026-04-29T12:00:00.000Z",
          },
        ],
      })
      .mockResolvedValue({ rows: [] });
    const withTransaction = jest.fn(async (callback) => callback({ query }));
    const repository = new MasterDataBootstrapRepository({
      withTransaction,
    } as never);

    await repository.createBootstrapBatch({
      companyId: "00000000-0000-4000-8000-000000000001",
      bootstrapEntity: "store",
      sourceLabel: "April store baseline",
      fileReference: "store-master-data-april.xlsx",
      uploadedByUserId: "hr-admin-user",
      rows: [
        {
          rowNumber: 1,
          rowHash: "hash-1",
          sourceStoreCode: "SM140",
          sourceEmployeeCode: null,
          rawPayload: { storeCode: "SM-140" },
          normalizedPayload: { normalizedStoreCode: "SM140" },
          validationStatus: "pending",
        },
      ],
    });

    const sql = query.mock.calls.map(([statement]) => String(statement)).join("\n");
    expect(sql).toContain("INSERT INTO stg.master_data_bootstrap_batch");
    expect(sql).toContain("INSERT INTO stg.master_data_bootstrap_row");
    expect(sql).not.toContain("INSERT INTO ops.store");
    expect(sql).not.toContain("INSERT INTO ops.employee");
    expect(query.mock.calls[1][1]).toEqual([
      "00000000-0000-4000-8000-000000000901",
      1,
      "hash-1",
      "SM140",
      null,
      JSON.stringify({ storeCode: "SM-140" }),
      JSON.stringify({ normalizedStoreCode: "SM140" }),
      "pending",
    ]);
  });
});
