import { MasterDataBootstrapService } from "./master-data-bootstrap.service";

describe("MasterDataBootstrapService", () => {
  it("stages bootstrap rows with normalized references and stable row hashes", async () => {
    const masterDataBootstrapRepository = {
      createBootstrapBatch: jest.fn(async (input) => ({
        batchId: "00000000-0000-4000-8000-000000000901",
        companyId: input.companyId,
        bootstrapEntity: input.bootstrapEntity,
        sourceLabel: input.sourceLabel,
        fileReference: input.fileReference,
        uploadedByUserId: input.uploadedByUserId,
        batchStatus: "uploaded",
        rowCount: input.rows.length,
        validCount: 0,
        needsReviewCount: 0,
        invalidCount: 0,
        promotedCount: 0,
        createdAt: "2026-04-29T12:00:00.000Z",
      })),
    };
    const service = new MasterDataBootstrapService(
      masterDataBootstrapRepository as never,
    );

    const result = await service.createBootstrapBatch({
      actorUserId: "hr-admin-user",
      actorScope: {
        companyIds: ["00000000-0000-4000-8000-000000000001"],
      },
      bootstrapEntity: "personnel",
      sourceLabel: "April personnel baseline",
      fileReference: "personel-master-data-april.xlsx",
      rows: [
        {
          storeCode: "SM-140",
          sellerCode: " fm8375 ",
          firstName: "Ada",
          lastName: "Kaya",
          positionCode: "SALES",
        },
      ],
    });

    expect(masterDataBootstrapRepository.createBootstrapBatch).toHaveBeenCalledWith({
      companyId: "00000000-0000-4000-8000-000000000001",
      bootstrapEntity: "personnel",
      sourceLabel: "April personnel baseline",
      fileReference: "personel-master-data-april.xlsx",
      uploadedByUserId: "hr-admin-user",
      rows: [
        {
          rowNumber: 1,
          rowHash: expect.stringMatching(/^[a-f0-9]{64}$/),
          sourceStoreCode: "SM140",
          sourceEmployeeCode: "FM8375",
          rawPayload: {
            storeCode: "SM-140",
            sellerCode: " fm8375 ",
            firstName: "Ada",
            lastName: "Kaya",
            positionCode: "SALES",
          },
          normalizedPayload: {
            normalizedStoreCode: "SM140",
            normalizedEmployeeCode: "FM8375",
            normalizedPositionCode: "SALES",
          },
          validationStatus: "pending",
        },
      ],
    });
    expect(result.command).toEqual({
      status: "uploaded",
      message: "Master data bootstrap batch staged for review",
    });
    expect(result.data.batch.rowCount).toBe(1);
  });

  it("validates personnel rows without promoting staged data", async () => {
    const masterDataBootstrapRepository = {
      getBootstrapBatchForActor: jest.fn(async () => ({
        batchId: "00000000-0000-4000-8000-000000000901",
        companyId: "00000000-0000-4000-8000-000000000001",
        bootstrapEntity: "personnel",
        sourceLabel: "April personnel baseline",
        fileReference: "personel-master-data-april.xlsx",
        uploadedByUserId: "hr-admin-user",
        batchStatus: "uploaded",
        rowCount: 4,
        validCount: 0,
        needsReviewCount: 0,
        invalidCount: 0,
        promotedCount: 0,
        createdAt: "2026-04-29T12:00:00.000Z",
        validatedAt: null,
        promotedAt: null,
      })),
      listBootstrapRows: jest.fn(async () => [
        {
          rowId: "row-missing-store",
          batchId: "00000000-0000-4000-8000-000000000901",
          rowNumber: 1,
          rowHash: "hash-1",
          sourceStoreCode: null,
          sourceEmployeeCode: "FM8375",
          rawPayload: { sellerCode: "FM8375", positionCode: "SALES" },
          normalizedPayload: {
            normalizedStoreCode: null,
            normalizedEmployeeCode: "FM8375",
            normalizedPositionCode: "SALES",
          },
          validationStatus: "pending",
          issueCode: null,
          issueMessage: null,
          resolvedCompanyId: null,
          resolvedRegionId: null,
          resolvedStoreId: null,
          resolvedEmployeeId: null,
          resolvedPositionId: null,
          createdAt: "2026-04-29T12:00:00.000Z",
          updatedAt: "2026-04-29T12:00:00.000Z",
        },
        {
          rowId: "row-unmapped-store",
          batchId: "00000000-0000-4000-8000-000000000901",
          rowNumber: 2,
          rowHash: "hash-2",
          sourceStoreCode: "SM999",
          sourceEmployeeCode: "FM8376",
          rawPayload: {
            storeCode: "SM999",
            sellerCode: "FM8376",
            positionCode: "SALES",
          },
          normalizedPayload: {
            normalizedStoreCode: "SM999",
            normalizedEmployeeCode: "FM8376",
            normalizedPositionCode: "SALES",
          },
          validationStatus: "pending",
          issueCode: null,
          issueMessage: null,
          resolvedCompanyId: null,
          resolvedRegionId: null,
          resolvedStoreId: null,
          resolvedEmployeeId: null,
          resolvedPositionId: null,
          createdAt: "2026-04-29T12:00:00.000Z",
          updatedAt: "2026-04-29T12:00:00.000Z",
        },
        {
          rowId: "row-unmapped-position",
          batchId: "00000000-0000-4000-8000-000000000901",
          rowNumber: 3,
          rowHash: "hash-3",
          sourceStoreCode: "SM140",
          sourceEmployeeCode: "FM8377",
          rawPayload: {
            storeCode: "SM140",
            sellerCode: "FM8377",
            positionCode: "UNKNOWN",
          },
          normalizedPayload: {
            normalizedStoreCode: "SM140",
            normalizedEmployeeCode: "FM8377",
            normalizedPositionCode: "UNKNOWN",
          },
          validationStatus: "pending",
          issueCode: null,
          issueMessage: null,
          resolvedCompanyId: null,
          resolvedRegionId: null,
          resolvedStoreId: null,
          resolvedEmployeeId: null,
          resolvedPositionId: null,
          createdAt: "2026-04-29T12:00:00.000Z",
          updatedAt: "2026-04-29T12:00:00.000Z",
        },
        {
          rowId: "row-valid",
          batchId: "00000000-0000-4000-8000-000000000901",
          rowNumber: 4,
          rowHash: "hash-4",
          sourceStoreCode: "SM140",
          sourceEmployeeCode: "FM8375",
          rawPayload: {
            storeCode: "SM140",
            sellerCode: "FM8375",
            positionCode: "SALES",
          },
          normalizedPayload: {
            normalizedStoreCode: "SM140",
            normalizedEmployeeCode: "FM8375",
            normalizedPositionCode: "SALES",
          },
          validationStatus: "pending",
          issueCode: null,
          issueMessage: null,
          resolvedCompanyId: null,
          resolvedRegionId: null,
          resolvedStoreId: null,
          resolvedEmployeeId: null,
          resolvedPositionId: null,
          createdAt: "2026-04-29T12:00:00.000Z",
          updatedAt: "2026-04-29T12:00:00.000Z",
        },
      ]),
      resolveStoreByCode: jest.fn(async (_companyId, storeCode) =>
        storeCode === "SM140"
          ? {
              storeId: "00000000-0000-4000-8000-000000000140",
              regionId: "00000000-0000-4000-8000-000000000240",
            }
          : null,
      ),
      resolveEmployeeByCode: jest.fn(async (_companyId, employeeCode) =>
        employeeCode === "FM8375"
          ? "00000000-0000-4000-8000-000000008375"
          : null,
      ),
      resolvePositionByCode: jest.fn(async (_companyId, positionCode) =>
        positionCode === "SALES"
          ? "00000000-0000-4000-8000-000000000501"
          : null,
      ),
      updateBootstrapRowValidationResults: jest.fn(async () => ({
        batchId: "00000000-0000-4000-8000-000000000901",
        batchStatus: "validated",
        rowCount: 4,
        validCount: 1,
        needsReviewCount: 2,
        invalidCount: 1,
        promotedCount: 0,
      })),
    };
    const service = new MasterDataBootstrapService(
      masterDataBootstrapRepository as never,
    );

    const result = await service.validateBootstrapBatch({
      actorScope: {
        companyIds: ["00000000-0000-4000-8000-000000000001"],
      },
      batchId: "00000000-0000-4000-8000-000000000901",
    });

    expect(
      masterDataBootstrapRepository.updateBootstrapRowValidationResults,
    ).toHaveBeenCalledWith({
      batchId: "00000000-0000-4000-8000-000000000901",
      results: [
        expect.objectContaining({
          rowId: "row-missing-store",
          validationStatus: "invalid",
          issueCode: "missing_store_code",
        }),
        expect.objectContaining({
          rowId: "row-unmapped-store",
          validationStatus: "needs_review",
          issueCode: "unmapped_store",
        }),
        expect.objectContaining({
          rowId: "row-unmapped-position",
          validationStatus: "needs_review",
          issueCode: "unmapped_position",
          resolvedStoreId: "00000000-0000-4000-8000-000000000140",
        }),
        expect.objectContaining({
          rowId: "row-valid",
          validationStatus: "valid",
          issueCode: null,
          resolvedStoreId: "00000000-0000-4000-8000-000000000140",
          resolvedEmployeeId: "00000000-0000-4000-8000-000000008375",
          resolvedPositionId: "00000000-0000-4000-8000-000000000501",
        }),
      ],
    });
    expect(result.command.status).toBe("validated");
    expect(result.data.batch.validCount).toBe(1);
    expect(result.data.batch.needsReviewCount).toBe(2);
    expect(result.data.batch.invalidCount).toBe(1);
  });

  it("marks unknown store types as review rows for store bootstrap batches", async () => {
    const masterDataBootstrapRepository = {
      getBootstrapBatchForActor: jest.fn(async () => ({
        batchId: "00000000-0000-4000-8000-000000000902",
        companyId: "00000000-0000-4000-8000-000000000001",
        bootstrapEntity: "store",
        sourceLabel: "April store baseline",
        fileReference: "store-master-data-april.xlsx",
        uploadedByUserId: "hr-admin-user",
        batchStatus: "uploaded",
        rowCount: 1,
        validCount: 0,
        needsReviewCount: 0,
        invalidCount: 0,
        promotedCount: 0,
        createdAt: "2026-04-29T12:00:00.000Z",
        validatedAt: null,
        promotedAt: null,
      })),
      listBootstrapRows: jest.fn(async () => [
        {
          rowId: "row-unknown-type",
          batchId: "00000000-0000-4000-8000-000000000902",
          rowNumber: 1,
          rowHash: "hash-store-1",
          sourceStoreCode: "SM140",
          sourceEmployeeCode: null,
          rawPayload: { storeCode: "SM140", storeType: "garage" },
          normalizedPayload: {
            normalizedStoreCode: "SM140",
            normalizedStoreType: "garage",
          },
          validationStatus: "pending",
          issueCode: null,
          issueMessage: null,
          resolvedCompanyId: null,
          resolvedRegionId: null,
          resolvedStoreId: null,
          resolvedEmployeeId: null,
          resolvedPositionId: null,
          createdAt: "2026-04-29T12:00:00.000Z",
          updatedAt: "2026-04-29T12:00:00.000Z",
        },
      ]),
      resolveStoreByCode: jest.fn(async () => null),
      resolveEmployeeByCode: jest.fn(async () => null),
      resolvePositionByCode: jest.fn(async () => null),
      updateBootstrapRowValidationResults: jest.fn(async () => ({
        batchId: "00000000-0000-4000-8000-000000000902",
        batchStatus: "validated",
        rowCount: 1,
        validCount: 0,
        needsReviewCount: 1,
        invalidCount: 0,
        promotedCount: 0,
      })),
    };
    const service = new MasterDataBootstrapService(
      masterDataBootstrapRepository as never,
    );

    await service.validateBootstrapBatch({
      actorScope: {
        companyIds: ["00000000-0000-4000-8000-000000000001"],
      },
      batchId: "00000000-0000-4000-8000-000000000902",
    });

    expect(
      masterDataBootstrapRepository.updateBootstrapRowValidationResults,
    ).toHaveBeenCalledWith({
      batchId: "00000000-0000-4000-8000-000000000902",
      results: [
        expect.objectContaining({
          rowId: "row-unknown-type",
          validationStatus: "needs_review",
          issueCode: "unknown_store_type",
        }),
      ],
    });
  });

  it("lists bootstrap batches with derived readiness and next action", async () => {
    const masterDataBootstrapRepository = {
      listBootstrapBatches: jest.fn(async () => ({
        rows: [
          {
            batchId: "batch-uploaded",
            companyId: "00000000-0000-4000-8000-000000000001",
            bootstrapEntity: "store",
            sourceLabel: "Store baseline",
            fileReference: "stores.xlsx",
            uploadedByUserId: "hr-admin-user",
            batchStatus: "uploaded",
            rowCount: 10,
            validCount: 0,
            needsReviewCount: 0,
            invalidCount: 0,
            promotedCount: 0,
            pendingCount: 10,
            createdAt: "2026-04-29T12:00:00.000Z",
            validatedAt: null,
            promotedAt: null,
          },
          {
            batchId: "batch-review",
            companyId: "00000000-0000-4000-8000-000000000001",
            bootstrapEntity: "personnel",
            sourceLabel: "Personnel baseline",
            fileReference: "personnel.xlsx",
            uploadedByUserId: "hr-admin-user",
            batchStatus: "validated",
            rowCount: 10,
            validCount: 7,
            needsReviewCount: 2,
            invalidCount: 1,
            promotedCount: 0,
            pendingCount: 0,
            createdAt: "2026-04-29T12:01:00.000Z",
            validatedAt: "2026-04-29T12:02:00.000Z",
            promotedAt: null,
          },
          {
            batchId: "batch-ready",
            companyId: "00000000-0000-4000-8000-000000000001",
            bootstrapEntity: "store",
            sourceLabel: "Ready store baseline",
            fileReference: "ready-stores.xlsx",
            uploadedByUserId: "hr-admin-user",
            batchStatus: "ready_to_promote",
            rowCount: 3,
            validCount: 3,
            needsReviewCount: 0,
            invalidCount: 0,
            promotedCount: 0,
            pendingCount: 0,
            createdAt: "2026-04-29T12:03:00.000Z",
            validatedAt: "2026-04-29T12:04:00.000Z",
            promotedAt: null,
          },
        ],
        total: 3,
      })),
    };
    const service = new MasterDataBootstrapService(
      masterDataBootstrapRepository as never,
    );

    const result = await service.listBootstrapBatches({
      actorScope: {
        companyIds: ["00000000-0000-4000-8000-000000000001"],
      },
      limit: 25,
      offset: 0,
    });

    expect(masterDataBootstrapRepository.listBootstrapBatches).toHaveBeenCalledWith({
      companyIds: ["00000000-0000-4000-8000-000000000001"],
      bootstrapEntity: undefined,
      batchStatus: undefined,
      readiness: undefined,
      q: undefined,
      limit: 25,
      offset: 0,
    });
    expect(result.items).toEqual([
      expect.objectContaining({
        batchId: "batch-uploaded",
        readiness: "needs_validation",
        nextAction: "validate_batch",
      }),
      expect.objectContaining({
        batchId: "batch-review",
        readiness: "needs_review",
        nextAction: "review_invalid_rows",
      }),
      expect.objectContaining({
        batchId: "batch-ready",
        readiness: "ready_to_promote",
        nextAction: "wait_for_promotion_decision",
      }),
    ]);
    expect(result.meta).toEqual({ count: 3, total: 3, limit: 25, offset: 0 });
  });

  it("lists bootstrap rows for review after checking scoped batch access", async () => {
    const masterDataBootstrapRepository = {
      getBootstrapBatchForActor: jest.fn(async () => ({
        batchId: "batch-1",
        companyId: "00000000-0000-4000-8000-000000000001",
        bootstrapEntity: "personnel",
        sourceLabel: "Personnel baseline",
        fileReference: "personnel.xlsx",
        uploadedByUserId: "hr-admin-user",
        batchStatus: "validated",
        rowCount: 1,
        validCount: 0,
        needsReviewCount: 0,
        invalidCount: 1,
        promotedCount: 0,
        createdAt: "2026-04-29T12:00:00.000Z",
        validatedAt: "2026-04-29T12:01:00.000Z",
        promotedAt: null,
      })),
      listBootstrapRowsForReview: jest.fn(async () => ({
        rows: [
          {
            rowId: "row-1",
            batchId: "batch-1",
            rowNumber: 1,
            rowHash: "hash-1",
            sourceStoreCode: "SM140",
            sourceEmployeeCode: "FM8375",
            rawPayload: { storeCode: "SM140" },
            normalizedPayload: { normalizedStoreCode: "SM140" },
            validationStatus: "invalid",
            issueCode: "missing_position_code",
            issueMessage: "Position code is required before promotion",
            resolvedCompanyId: "00000000-0000-4000-8000-000000000001",
            resolvedRegionId: null,
            resolvedStoreId: null,
            resolvedEmployeeId: null,
            resolvedPositionId: null,
            createdAt: "2026-04-29T12:00:00.000Z",
            updatedAt: "2026-04-29T12:01:00.000Z",
          },
        ],
        total: 1,
      })),
    };
    const service = new MasterDataBootstrapService(
      masterDataBootstrapRepository as never,
    );

    const result = await service.listBootstrapRowsForReview({
      actorScope: {
        companyIds: ["00000000-0000-4000-8000-000000000001"],
      },
      batchId: "batch-1",
      validationStatus: "invalid",
      limit: 10,
      offset: 0,
    });

    expect(masterDataBootstrapRepository.getBootstrapBatchForActor).toHaveBeenCalled();
    expect(masterDataBootstrapRepository.listBootstrapRowsForReview).toHaveBeenCalledWith({
      batchId: "batch-1",
      companyIds: ["00000000-0000-4000-8000-000000000001"],
      validationStatus: "invalid",
      issueCode: undefined,
      q: undefined,
      limit: 10,
      offset: 0,
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        rowId: "row-1",
        validationStatus: "invalid",
        issueCode: "missing_position_code",
      }),
    );
    expect(result.meta).toEqual({ count: 1, total: 1, limit: 10, offset: 0 });
  });
});
