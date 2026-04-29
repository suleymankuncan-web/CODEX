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

  it("updates bootstrap validation state and counters only in staging tables", async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            master_data_bootstrap_batch_id: "00000000-0000-4000-8000-000000000901",
            batch_status: "validated",
            row_count: 2,
            valid_count: 1,
            needs_review_count: 1,
            invalid_count: 0,
            promoted_count: 0,
          },
        ],
      });
    const withTransaction = jest.fn(async (callback) => callback({ query }));
    const repository = new MasterDataBootstrapRepository({
      withTransaction,
    } as never);

    const batch = await repository.updateBootstrapRowValidationResults({
      batchId: "00000000-0000-4000-8000-000000000901",
      results: [
        {
          rowId: "00000000-0000-4000-8000-000000000101",
          validationStatus: "valid",
          issueCode: null,
          issueMessage: null,
          resolvedCompanyId: "00000000-0000-4000-8000-000000000001",
          resolvedRegionId: "00000000-0000-4000-8000-000000000240",
          resolvedStoreId: "00000000-0000-4000-8000-000000000140",
          resolvedEmployeeId: "00000000-0000-4000-8000-000000008375",
          resolvedPositionId: "00000000-0000-4000-8000-000000000501",
        },
      ],
    });

    const sql = query.mock.calls.map(([statement]) => String(statement)).join("\n");
    expect(sql).toContain("UPDATE stg.master_data_bootstrap_row");
    expect(sql).toContain("UPDATE stg.master_data_bootstrap_batch");
    expect(sql).not.toContain("INSERT INTO ops.store");
    expect(sql).not.toContain("INSERT INTO ops.employee");
    expect(sql).not.toContain("UPDATE ops.store");
    expect(sql).not.toContain("UPDATE ops.employee");
    expect(query.mock.calls[0][1]).toEqual([
      "00000000-0000-4000-8000-000000000101",
      "00000000-0000-4000-8000-000000000901",
      "valid",
      null,
      null,
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000240",
      "00000000-0000-4000-8000-000000000140",
      "00000000-0000-4000-8000-000000008375",
      "00000000-0000-4000-8000-000000000501",
    ]);
    expect(batch).toEqual({
      batchId: "00000000-0000-4000-8000-000000000901",
      batchStatus: "validated",
      rowCount: 2,
      validCount: 1,
      needsReviewCount: 1,
      invalidCount: 0,
      promotedCount: 0,
    });
  });

  it("lists bootstrap batches from staging tables without mutating live master data", async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [{ total_count: "1" }] })
      .mockResolvedValueOnce({
        rows: [
          {
            master_data_bootstrap_batch_id: "batch-1",
            company_id: "00000000-0000-4000-8000-000000000001",
            bootstrap_entity: "store",
            source_label: "Store baseline",
            file_reference: "stores.xlsx",
            uploaded_by_user_id: "hr-admin-user",
            batch_status: "uploaded",
            row_count: 2,
            valid_count: 0,
            needs_review_count: 0,
            invalid_count: 0,
            promoted_count: 0,
            pending_count: 2,
            created_at: "2026-04-29T12:00:00.000Z",
            validated_at: null,
            promoted_at: null,
          },
        ],
      });
    const repository = new MasterDataBootstrapRepository({ query } as never);

    const result = await repository.listBootstrapBatches({
      companyIds: ["00000000-0000-4000-8000-000000000001"],
      readiness: "needs_validation",
      limit: 25,
      offset: 0,
    });

    const sql = query.mock.calls.map(([statement]) => String(statement)).join("\n");
    expect(sql).toContain("FROM stg.master_data_bootstrap_batch");
    expect(sql).not.toContain("INSERT INTO ops.store");
    expect(sql).not.toContain("UPDATE ops.store");
    expect(sql).not.toContain("INSERT INTO ops.employee");
    expect(sql).not.toContain("UPDATE ops.employee");
    expect(result.total).toBe(1);
    expect(result.rows[0]).toEqual(
      expect.objectContaining({
        batchId: "batch-1",
        pendingCount: 2,
      }),
    );
  });

  it("lists bootstrap review rows from staging tables with scoped batch guard", async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce({ rows: [{ total_count: "1" }] })
      .mockResolvedValueOnce({
        rows: [
          {
            master_data_bootstrap_row_id: "row-1",
            master_data_bootstrap_batch_id: "batch-1",
            row_number: 7,
            row_hash: "hash-1",
            source_store_code: "SM140",
            source_employee_code: "FM8375",
            raw_payload_json: { storeCode: "SM140" },
            normalized_payload_json: { normalizedStoreCode: "SM140" },
            validation_status: "invalid",
            issue_code: "missing_position_code",
            issue_message: "Position code is required before promotion",
            resolved_company_id: "00000000-0000-4000-8000-000000000001",
            resolved_region_id: null,
            resolved_store_id: null,
            resolved_employee_id: null,
            resolved_position_id: null,
            created_at: "2026-04-29T12:00:00.000Z",
            updated_at: "2026-04-29T12:01:00.000Z",
          },
        ],
      });
    const repository = new MasterDataBootstrapRepository({ query } as never);

    const result = await repository.listBootstrapRowsForReview({
      batchId: "batch-1",
      companyIds: ["00000000-0000-4000-8000-000000000001"],
      validationStatus: "invalid",
      limit: 10,
      offset: 0,
    });

    const sql = query.mock.calls.map(([statement]) => String(statement)).join("\n");
    expect(sql).toContain("FROM stg.master_data_bootstrap_row");
    expect(sql).toContain("INNER JOIN stg.master_data_bootstrap_batch");
    expect(sql).not.toContain("INSERT INTO ops.store");
    expect(sql).not.toContain("UPDATE ops.employee");
    expect(result.total).toBe(1);
    expect(result.rows[0]).toEqual(
      expect.objectContaining({
        rowId: "row-1",
        validationStatus: "invalid",
        issueCode: "missing_position_code",
      }),
    );
  });
});
