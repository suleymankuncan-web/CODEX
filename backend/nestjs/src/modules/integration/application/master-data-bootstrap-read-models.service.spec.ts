import { MasterDataBootstrapService } from "./master-data-bootstrap.service";

describe("MasterDataBootstrapService read models", () => {
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

  it("reports pending rows as needing validation before promotion", async () => {
    const masterDataBootstrapRepository = {
      getBootstrapBatchForActor: jest.fn(async () => ({
        batchId: "batch-pending",
        companyId: "00000000-0000-4000-8000-000000000001",
        bootstrapEntity: "store",
        sourceLabel: "Store baseline",
        fileReference: "stores.xlsx",
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
        buildBootstrapReadinessRow({
          rowId: "row-pending",
          rowNumber: 1,
          validationStatus: "pending",
        }),
      ]),
    };
    const service = new MasterDataBootstrapService(
      masterDataBootstrapRepository as never,
    );

    const result = await service.getBootstrapPromotionReadiness({
      actorScope: {
        companyIds: ["00000000-0000-4000-8000-000000000001"],
      },
      batchId: "batch-pending",
    });

    expect(result.summary).toEqual(
      expect.objectContaining({
        batchId: "batch-pending",
        canPromote: false,
        nextAction: "validate_batch",
        needsValidationCount: 1,
      }),
    );
    expect(result.rows.items[0]).toEqual(
      expect.objectContaining({
        rowId: "row-pending",
        promotionReadiness: "needs_validation",
        blockReason: "validation_pending",
      }),
    );
  });

  it("reports invalid and needs-review rows as blocking promotion", async () => {
    const masterDataBootstrapRepository = {
      getBootstrapBatchForActor: jest.fn(async () => ({
        batchId: "batch-review",
        companyId: "00000000-0000-4000-8000-000000000001",
        bootstrapEntity: "personnel",
        sourceLabel: "Personnel baseline",
        fileReference: "personnel.xlsx",
        uploadedByUserId: "hr-admin-user",
        batchStatus: "validated",
        rowCount: 2,
        validCount: 0,
        needsReviewCount: 1,
        invalidCount: 1,
        promotedCount: 0,
        createdAt: "2026-04-29T12:00:00.000Z",
        validatedAt: "2026-04-29T12:01:00.000Z",
        promotedAt: null,
      })),
      listBootstrapRows: jest.fn(async () => [
        buildBootstrapReadinessRow({
          rowId: "row-invalid",
          rowNumber: 1,
          validationStatus: "invalid",
          issueCode: "missing_store_code",
          issueMessage: "Store code is required before this row can be reviewed",
        }),
        buildBootstrapReadinessRow({
          rowId: "row-review",
          rowNumber: 2,
          validationStatus: "needs_review",
          issueCode: "employee_identity_conflict",
          issueMessage:
            "Seller code and national id evidence point to different employee identities",
        }),
      ]),
    };
    const service = new MasterDataBootstrapService(
      masterDataBootstrapRepository as never,
    );

    const result = await service.getBootstrapPromotionReadiness({
      actorScope: {
        companyIds: ["00000000-0000-4000-8000-000000000001"],
      },
      batchId: "batch-review",
    });

    expect(result.summary).toEqual(
      expect.objectContaining({
        canPromote: false,
        nextAction: "review_rows",
        blockedCount: 1,
        needsReviewCount: 1,
      }),
    );
    expect(result.rows.items).toEqual([
      expect.objectContaining({
        rowId: "row-invalid",
        promotionReadiness: "blocked",
        blockReason: "missing_store_code",
      }),
      expect.objectContaining({
        rowId: "row-review",
        promotionReadiness: "needs_review",
        blockReason: "employee_identity_conflict",
      }),
    ]);
  });

  it("reports ready rows when the batch is ready to promote", async () => {
    const masterDataBootstrapRepository = {
      getBootstrapBatchForActor: jest.fn(async () => ({
        batchId: "batch-ready",
        companyId: "00000000-0000-4000-8000-000000000001",
        bootstrapEntity: "store",
        sourceLabel: "Ready stores",
        fileReference: "ready-stores.xlsx",
        uploadedByUserId: "hr-admin-user",
        batchStatus: "ready_to_promote",
        rowCount: 2,
        validCount: 2,
        needsReviewCount: 0,
        invalidCount: 0,
        promotedCount: 0,
        createdAt: "2026-04-29T12:00:00.000Z",
        validatedAt: "2026-04-29T12:01:00.000Z",
        promotedAt: null,
      })),
      listBootstrapRows: jest.fn(async () => [
        buildBootstrapReadinessRow({
          rowId: "row-ready-1",
          rowNumber: 1,
          validationStatus: "valid",
          resolvedStoreId: "00000000-0000-4000-8000-000000000140",
        }),
        buildBootstrapReadinessRow({
          rowId: "row-ready-2",
          rowNumber: 2,
          validationStatus: "valid",
          resolvedStoreId: "00000000-0000-4000-8000-000000000141",
        }),
      ]),
    };
    const service = new MasterDataBootstrapService(
      masterDataBootstrapRepository as never,
    );

    const result = await service.getBootstrapPromotionReadiness({
      actorScope: {
        companyIds: ["00000000-0000-4000-8000-000000000001"],
      },
      batchId: "batch-ready",
    });

    expect(result.summary).toEqual(
      expect.objectContaining({
        canPromote: true,
        nextAction: "promote_ready_rows",
        readyCount: 2,
        blockedCount: 0,
      }),
    );
    expect(result.rows.items).toEqual([
      expect.objectContaining({
        rowId: "row-ready-1",
        promotionReadiness: "ready",
        blockReason: null,
      }),
      expect.objectContaining({
        rowId: "row-ready-2",
        promotionReadiness: "ready",
        blockReason: null,
      }),
    ]);
  });

  it("reports promoted rows as already promoted and not ready again", async () => {
    const masterDataBootstrapRepository = {
      getBootstrapBatchForActor: jest.fn(async () => ({
        batchId: "batch-promoted",
        companyId: "00000000-0000-4000-8000-000000000001",
        bootstrapEntity: "personnel",
        sourceLabel: "Promoted personnel",
        fileReference: "promoted-personnel.xlsx",
        uploadedByUserId: "hr-admin-user",
        batchStatus: "promoted",
        rowCount: 1,
        validCount: 0,
        needsReviewCount: 0,
        invalidCount: 0,
        promotedCount: 1,
        createdAt: "2026-04-29T12:00:00.000Z",
        validatedAt: "2026-04-29T12:01:00.000Z",
        promotedAt: "2026-04-29T12:02:00.000Z",
      })),
      listBootstrapRows: jest.fn(async () => [
        buildBootstrapReadinessRow({
          rowId: "row-promoted",
          rowNumber: 1,
          validationStatus: "promoted",
          promotedEntityId: "00000000-0000-4000-8000-000000008375",
        }),
      ]),
    };
    const service = new MasterDataBootstrapService(
      masterDataBootstrapRepository as never,
    );

    const result = await service.getBootstrapPromotionReadiness({
      actorScope: {
        companyIds: ["00000000-0000-4000-8000-000000000001"],
      },
      batchId: "batch-promoted",
    });

    expect(result.summary).toEqual(
      expect.objectContaining({
        canPromote: false,
        nextAction: "already_closed",
        readyCount: 0,
        alreadyPromotedCount: 1,
      }),
    );
    expect(result.rows.items[0]).toEqual(
      expect.objectContaining({
        rowId: "row-promoted",
        promotionReadiness: "already_promoted",
        blockReason: "already_promoted",
        promotedEntityId: "00000000-0000-4000-8000-000000008375",
      }),
    );
  });
});

function buildBootstrapReadinessRow(input: {
  rowId: string;
  rowNumber: number;
  validationStatus: "pending" | "valid" | "needs_review" | "invalid" | "promoted";
  issueCode?: string | null;
  issueMessage?: string | null;
  resolvedStoreId?: string | null;
  resolvedEmployeeId?: string | null;
  resolvedPositionId?: string | null;
  promotedEntityId?: string | null;
}) {
  return {
    rowId: input.rowId,
    batchId: "batch-readiness",
    rowNumber: input.rowNumber,
    rowHash: `hash-readiness-${input.rowNumber}`,
    sourceStoreCode: "SM140",
    sourceEmployeeCode: "FM8375",
    rawPayload: { storeCode: "SM140", sellerCode: "FM8375" },
    normalizedPayload: {
      normalizedStoreCode: "SM140",
      normalizedEmployeeCode: "FM8375",
      normalizedPositionCode: "SALES",
    },
    validationStatus: input.validationStatus,
    issueCode: input.issueCode ?? null,
    issueMessage: input.issueMessage ?? null,
    resolvedCompanyId: "00000000-0000-4000-8000-000000000001",
    resolvedRegionId: "00000000-0000-4000-8000-000000000240",
    resolvedStoreId: input.resolvedStoreId ?? null,
    resolvedEmployeeId: input.resolvedEmployeeId ?? null,
    resolvedPositionId: input.resolvedPositionId ?? null,
    promotedEntityId: input.promotedEntityId ?? null,
    createdAt: "2026-04-29T12:00:00.000Z",
    updatedAt: "2026-04-29T12:00:00.000Z",
  };
}
