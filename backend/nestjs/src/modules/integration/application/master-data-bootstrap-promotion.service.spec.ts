import { MasterDataBootstrapService } from "./master-data-bootstrap.service";

describe("MasterDataBootstrapService promotion", () => {
  it("rejects personnel batch store promotion", async () => {
    const masterDataBootstrapRepository = {
      getBootstrapBatchForActor: jest.fn(async () =>
        buildBootstrapBatch({
          bootstrapEntity: "personnel",
          batchId: "batch-personnel",
          batchStatus: "ready_to_promote",
        }),
      ),
    };
    const service = new MasterDataBootstrapService(
      masterDataBootstrapRepository as never,
    );

    await expect(
      service.promoteStoreBootstrapBatch({
        actorScope: {
          companyIds: ["00000000-0000-4000-8000-000000000001"],
        },
        batchId: "batch-personnel",
      }),
    ).rejects.toThrow("Store bootstrap promotion only supports store batches");
  });

  it("rejects store promotion before the batch is ready", async () => {
    const masterDataBootstrapRepository = {
      getBootstrapBatchForActor: jest.fn(async () =>
        buildBootstrapBatch({
          bootstrapEntity: "store",
          batchId: "batch-store",
          batchStatus: "validated",
        }),
      ),
    };
    const service = new MasterDataBootstrapService(
      masterDataBootstrapRepository as never,
    );

    await expect(
      service.promoteStoreBootstrapBatch({
        actorScope: {
          companyIds: ["00000000-0000-4000-8000-000000000001"],
        },
        batchId: "batch-store",
      }),
    ).rejects.toThrow("Store bootstrap batch must be ready_to_promote");
  });

  it("promotes only ready store rows and skips already promoted rows", async () => {
    const masterDataBootstrapRepository = {
      getBootstrapBatchForActor: jest.fn(async () =>
        buildBootstrapBatch({
          bootstrapEntity: "store",
          batchId: "batch-store",
          batchStatus: "ready_to_promote",
          rowCount: 2,
          validCount: 1,
          promotedCount: 1,
        }),
      ),
      listBootstrapRows: jest.fn(async () => [
        buildStoreRow({
          rowId: "row-ready-store",
          rowNumber: 1,
          validationStatus: "valid",
          resolvedRegionId: "00000000-0000-4000-8000-000000000240",
          normalizedPayload: {
            normalizedStoreCode: "SM140",
            normalizedStoreName: "Marmara Park",
            normalizedStoreType: "company",
            normalizedRegionCode: "MARMARA",
            normalizedStoreStatus: "active",
            kpiImportEnabled: true,
          },
        }),
        buildStoreRow({
          rowId: "row-promoted-store",
          rowNumber: 2,
          validationStatus: "promoted",
          resolvedRegionId: "00000000-0000-4000-8000-000000000240",
          promotedEntityId: "00000000-0000-4000-8000-000000000141",
          normalizedPayload: {
            normalizedStoreCode: "SM141",
            normalizedStoreName: "Existing Store",
            normalizedStoreType: "franchise",
          },
        }),
      ]),
      promoteStoreBootstrapRows: jest.fn(async () => ({
        batchId: "batch-store",
        batchStatus: "promoted",
        rowCount: 2,
        validCount: 0,
        needsReviewCount: 0,
        invalidCount: 0,
        promotedCount: 2,
        promotedRows: [
          {
            rowId: "row-ready-store",
            promotedEntityId: "00000000-0000-4000-8000-000000000140",
          },
        ],
      })),
    };
    const service = new MasterDataBootstrapService(
      masterDataBootstrapRepository as never,
    );

    const result = await service.promoteStoreBootstrapBatch({
      actorScope: {
        companyIds: ["00000000-0000-4000-8000-000000000001"],
      },
      batchId: "batch-store",
    });

    expect(masterDataBootstrapRepository.promoteStoreBootstrapRows).toHaveBeenCalledWith({
      batchId: "batch-store",
      rows: [
        {
          rowId: "row-ready-store",
          companyId: "00000000-0000-4000-8000-000000000001",
          regionId: "00000000-0000-4000-8000-000000000240",
          storeCode: "SM140",
          storeName: "Marmara Park",
          storeType: "company",
          status: "active",
          kpiImportEnabled: true,
        },
      ],
    });
    expect(result).toEqual({
      command: {
        status: "promoted",
        message: "Store bootstrap rows promoted",
      },
      data: {
        batch: {
          batchId: "batch-store",
          batchStatus: "promoted",
          rowCount: 2,
          validCount: 0,
          needsReviewCount: 0,
          invalidCount: 0,
          promotedCount: 2,
          promotedRows: [
            {
              rowId: "row-ready-store",
              promotedEntityId: "00000000-0000-4000-8000-000000000140",
            },
          ],
        },
        promotedRows: [
          {
            rowId: "row-ready-store",
            promotedEntityId: "00000000-0000-4000-8000-000000000140",
          },
        ],
      },
    });
  });

  it("rejects stale store promotion when any non-promoted row is not ready", async () => {
    const masterDataBootstrapRepository = {
      getBootstrapBatchForActor: jest.fn(async () =>
        buildBootstrapBatch({
          bootstrapEntity: "store",
          batchId: "batch-store",
          batchStatus: "ready_to_promote",
          rowCount: 2,
          validCount: 1,
          needsReviewCount: 1,
        }),
      ),
      listBootstrapRows: jest.fn(async () => [
        buildStoreRow({
          rowId: "row-ready-store",
          rowNumber: 1,
          validationStatus: "valid",
          resolvedRegionId: "00000000-0000-4000-8000-000000000240",
          normalizedPayload: {
            normalizedStoreCode: "SM140",
            normalizedStoreName: "Marmara Park",
            normalizedStoreType: "company",
          },
        }),
        buildStoreRow({
          rowId: "row-needs-review-store",
          rowNumber: 2,
          validationStatus: "needs_review",
          normalizedPayload: {
            normalizedStoreCode: "SM141",
            normalizedStoreName: "Needs Review Store",
            normalizedStoreType: "franchise",
          },
        }),
      ]),
      promoteStoreBootstrapRows: jest.fn(async () => ({
        batchId: "batch-store",
        batchStatus: "ready_to_promote",
        rowCount: 2,
        validCount: 1,
        needsReviewCount: 1,
        invalidCount: 0,
        promotedCount: 0,
        promotedRows: [],
      })),
    };
    const service = new MasterDataBootstrapService(
      masterDataBootstrapRepository as never,
    );

    await expect(
      service.promoteStoreBootstrapBatch({
        actorScope: {
          companyIds: ["00000000-0000-4000-8000-000000000001"],
        },
        batchId: "batch-store",
      }),
    ).rejects.toThrow("Store bootstrap batch has non-promotable rows");
    expect(
      masterDataBootstrapRepository.promoteStoreBootstrapRows,
    ).not.toHaveBeenCalled();
  });

  it("rejects store batch personnel promotion", async () => {
    const masterDataBootstrapRepository = {
      getBootstrapBatchForActor: jest.fn(async () =>
        buildBootstrapBatch({
          bootstrapEntity: "store",
          batchId: "batch-store",
          batchStatus: "ready_to_promote",
        }),
      ),
    };
    const service = new MasterDataBootstrapService(
      masterDataBootstrapRepository as never,
    );

    await expect(
      service.promotePersonnelBootstrapBatch({
        actorScope: {
          companyIds: ["00000000-0000-4000-8000-000000000001"],
        },
        batchId: "batch-store",
      }),
    ).rejects.toThrow("Personnel bootstrap promotion only supports personnel batches");
  });

  it("rejects personnel promotion before the batch is ready", async () => {
    const masterDataBootstrapRepository = {
      getBootstrapBatchForActor: jest.fn(async () =>
        buildBootstrapBatch({
          bootstrapEntity: "personnel",
          batchId: "batch-personnel",
          batchStatus: "validated",
        }),
      ),
    };
    const service = new MasterDataBootstrapService(
      masterDataBootstrapRepository as never,
    );

    await expect(
      service.promotePersonnelBootstrapBatch({
        actorScope: {
          companyIds: ["00000000-0000-4000-8000-000000000001"],
        },
        batchId: "batch-personnel",
      }),
    ).rejects.toThrow("Personnel bootstrap batch must be ready_to_promote");
  });

  it("promotes only ready personnel rows and skips already promoted rows", async () => {
    const masterDataBootstrapRepository = {
      getBootstrapBatchForActor: jest.fn(async () =>
        buildBootstrapBatch({
          bootstrapEntity: "personnel",
          batchId: "batch-personnel",
          batchStatus: "ready_to_promote",
          rowCount: 2,
          validCount: 1,
          promotedCount: 1,
        }),
      ),
      listBootstrapRows: jest.fn(async () => [
        buildPersonnelRow("row-ready-personnel", 1, "FM8375", undefined, {
          validationStatus: "valid",
          normalizedPayload: {
            normalizedNationalIdHash: null,
          },
          resolvedStoreId: "00000000-0000-4000-8000-000000000140",
          resolvedRegionId: "00000000-0000-4000-8000-000000000240",
          resolvedEmployeeId: null,
          resolvedPositionId: "00000000-0000-4000-8000-000000000501",
        }),
        buildPersonnelRow("row-promoted-personnel", 2, "FM8376", undefined, {
          validationStatus: "promoted",
          resolvedStoreId: "00000000-0000-4000-8000-000000000140",
          resolvedRegionId: "00000000-0000-4000-8000-000000000240",
          resolvedEmployeeId: "00000000-0000-4000-8000-000000008376",
          resolvedPositionId: "00000000-0000-4000-8000-000000000501",
          promotedEntityId: "00000000-0000-4000-8000-000000008376",
        }),
      ]),
      promotePersonnelBootstrapRows: jest.fn(async () => ({
        batchId: "batch-personnel",
        batchStatus: "promoted",
        rowCount: 2,
        validCount: 0,
        needsReviewCount: 0,
        invalidCount: 0,
        promotedCount: 2,
        promotedRows: [
          {
            rowId: "row-ready-personnel",
            promotedEntityId: "00000000-0000-4000-8000-000000008375",
            assignmentId: "00000000-0000-4000-8000-000000009375",
          },
        ],
      })),
    };
    const service = new MasterDataBootstrapService(
      masterDataBootstrapRepository as never,
    );

    const result = await service.promotePersonnelBootstrapBatch({
      actorScope: {
        companyIds: ["00000000-0000-4000-8000-000000000001"],
      },
      batchId: "batch-personnel",
    });

    expect(
      masterDataBootstrapRepository.promotePersonnelBootstrapRows,
    ).toHaveBeenCalledWith({
      batchId: "batch-personnel",
      rows: [
        {
          rowId: "row-ready-personnel",
          companyId: "00000000-0000-4000-8000-000000000001",
          storeId: "00000000-0000-4000-8000-000000000140",
          regionId: "00000000-0000-4000-8000-000000000240",
          positionId: "00000000-0000-4000-8000-000000000501",
          employeeId: null,
          employeeCode: "FM8375",
          firstName: "Ada",
          lastName: "Kaya",
          nationalIdHash: null,
          hireDate: "2026-04-01",
          employmentType: "full_time",
        },
      ],
    });
    expect(result).toEqual({
      command: {
        status: "promoted",
        message: "Personnel bootstrap rows promoted",
      },
      data: {
        batch: {
          batchId: "batch-personnel",
          batchStatus: "promoted",
          rowCount: 2,
          validCount: 0,
          needsReviewCount: 0,
          invalidCount: 0,
          promotedCount: 2,
          promotedRows: [
            {
              rowId: "row-ready-personnel",
              promotedEntityId: "00000000-0000-4000-8000-000000008375",
              assignmentId: "00000000-0000-4000-8000-000000009375",
            },
          ],
        },
        promotedRows: [
          {
            rowId: "row-ready-personnel",
            promotedEntityId: "00000000-0000-4000-8000-000000008375",
            assignmentId: "00000000-0000-4000-8000-000000009375",
          },
        ],
      },
    });
  });

  it("rejects stale personnel promotion when any non-promoted row is not ready", async () => {
    const masterDataBootstrapRepository = {
      getBootstrapBatchForActor: jest.fn(async () =>
        buildBootstrapBatch({
          bootstrapEntity: "personnel",
          batchId: "batch-personnel",
          batchStatus: "ready_to_promote",
          rowCount: 2,
          validCount: 1,
          invalidCount: 1,
        }),
      ),
      listBootstrapRows: jest.fn(async () => [
        buildPersonnelRow("row-ready-personnel", 1, "FM8375", undefined, {
          validationStatus: "valid",
          resolvedStoreId: "00000000-0000-4000-8000-000000000140",
          resolvedRegionId: "00000000-0000-4000-8000-000000000240",
          resolvedEmployeeId: null,
          resolvedPositionId: "00000000-0000-4000-8000-000000000501",
        }),
        buildPersonnelRow("row-invalid-personnel", 2, "FM8376", undefined, {
          validationStatus: "invalid",
          resolvedStoreId: "00000000-0000-4000-8000-000000000140",
          resolvedRegionId: "00000000-0000-4000-8000-000000000240",
          resolvedPositionId: "00000000-0000-4000-8000-000000000501",
        }),
      ]),
      promotePersonnelBootstrapRows: jest.fn(async () => ({
        batchId: "batch-personnel",
        batchStatus: "ready_to_promote",
        rowCount: 2,
        validCount: 1,
        needsReviewCount: 0,
        invalidCount: 1,
        promotedCount: 0,
        promotedRows: [],
      })),
    };
    const service = new MasterDataBootstrapService(
      masterDataBootstrapRepository as never,
    );

    await expect(
      service.promotePersonnelBootstrapBatch({
        actorScope: {
          companyIds: ["00000000-0000-4000-8000-000000000001"],
        },
        batchId: "batch-personnel",
      }),
    ).rejects.toThrow("Personnel bootstrap batch has non-promotable rows");
    expect(
      masterDataBootstrapRepository.promotePersonnelBootstrapRows,
    ).not.toHaveBeenCalled();
  });

  it("rejects ready personnel promotion when required evidence is missing", async () => {
    const masterDataBootstrapRepository = {
      getBootstrapBatchForActor: jest.fn(async () =>
        buildBootstrapBatch({
          bootstrapEntity: "personnel",
          batchId: "batch-personnel",
          batchStatus: "ready_to_promote",
          rowCount: 1,
          validCount: 1,
        }),
      ),
      listBootstrapRows: jest.fn(async () => [
        buildPersonnelRow("row-missing-evidence", 1, "FM8375", undefined, {
          validationStatus: "valid",
          resolvedStoreId: "00000000-0000-4000-8000-000000000140",
          resolvedRegionId: "00000000-0000-4000-8000-000000000240",
          resolvedPositionId: null,
        }),
      ]),
    };
    const service = new MasterDataBootstrapService(
      masterDataBootstrapRepository as never,
    );

    await expect(
      service.promotePersonnelBootstrapBatch({
        actorScope: {
          companyIds: ["00000000-0000-4000-8000-000000000001"],
        },
        batchId: "batch-personnel",
      }),
    ).rejects.toThrow("Ready personnel row is missing promotion evidence");
  });
});

function buildPersonnelRow(
  rowId: string,
  rowNumber: number,
  employeeCode: string,
  nationalIdHash?: string,
  input: {
    validationStatus?: "pending" | "valid" | "needs_review" | "invalid" | "promoted";
    normalizedPayload?: Record<string, unknown>;
    resolvedStoreId?: string | null;
    resolvedRegionId?: string | null;
    resolvedEmployeeId?: string | null;
    resolvedPositionId?: string | null;
    promotedEntityId?: string | null;
  } = {},
) {
  const effectiveNationalIdHash =
    nationalIdHash ?? String(rowNumber).repeat(64).slice(0, 64);
  const normalizedPayload = {
    normalizedStoreCode: "SM140",
    normalizedEmployeeCode: employeeCode,
    normalizedPositionCode: "SALES",
    normalizedFirstName: "Ada",
    normalizedLastName: "Kaya",
    normalizedNationalIdHash: effectiveNationalIdHash,
    normalizedHireDate: "2026-04-01",
    normalizedEmploymentType: "full_time",
    ...(input.normalizedPayload ?? {}),
  };

  return {
    rowId,
    batchId: "00000000-0000-4000-8000-000000000905",
    rowNumber,
    rowHash: `hash-${rowNumber}`,
    sourceStoreCode: "SM140",
    sourceEmployeeCode: employeeCode,
    rawPayload: {
      storeCode: "SM140",
      sellerCode: employeeCode,
      positionCode: "SALES",
      firstName: "Ada",
      lastName: "Kaya",
      nationalIdHash: effectiveNationalIdHash,
      hireDate: "2026-04-01",
      employmentType: "full_time",
    },
    normalizedPayload,
    validationStatus: input.validationStatus ?? "pending",
    issueCode: null,
    issueMessage: null,
    resolvedCompanyId: "00000000-0000-4000-8000-000000000001",
    resolvedRegionId: input.resolvedRegionId ?? null,
    resolvedStoreId: input.resolvedStoreId ?? null,
    resolvedEmployeeId: input.resolvedEmployeeId ?? null,
    resolvedPositionId: input.resolvedPositionId ?? null,
    promotedEntityId: input.promotedEntityId ?? null,
    createdAt: "2026-04-29T12:00:00.000Z",
    updatedAt: "2026-04-29T12:00:00.000Z",
  };
}

function buildBootstrapBatch(input: {
  batchId: string;
  bootstrapEntity: "store" | "personnel";
  batchStatus?: string;
  rowCount?: number;
  validCount?: number;
  needsReviewCount?: number;
  invalidCount?: number;
  promotedCount?: number;
}) {
  return {
    batchId: input.batchId,
    companyId: "00000000-0000-4000-8000-000000000001",
    bootstrapEntity: input.bootstrapEntity,
    sourceLabel: "Bootstrap baseline",
    fileReference: "bootstrap.xlsx",
    uploadedByUserId: "hr-admin-user",
    batchStatus: input.batchStatus ?? "uploaded",
    rowCount: input.rowCount ?? 1,
    validCount: input.validCount ?? 0,
    needsReviewCount: input.needsReviewCount ?? 0,
    invalidCount: input.invalidCount ?? 0,
    promotedCount: input.promotedCount ?? 0,
    createdAt: "2026-04-29T12:00:00.000Z",
    validatedAt: null,
    promotedAt: null,
  };
}

function buildStoreRow(input: {
  rowId: string;
  rowNumber: number;
  validationStatus?: "pending" | "valid" | "needs_review" | "invalid" | "promoted";
  normalizedPayload: Record<string, unknown>;
  resolvedRegionId?: string | null;
  resolvedStoreId?: string | null;
  promotedEntityId?: string | null;
}) {
  return {
    rowId: input.rowId,
    batchId: "batch-store",
    rowNumber: input.rowNumber,
    rowHash: `hash-store-${input.rowNumber}`,
    sourceStoreCode:
      typeof input.normalizedPayload.normalizedStoreCode === "string"
        ? input.normalizedPayload.normalizedStoreCode
        : null,
    sourceEmployeeCode: null,
    rawPayload: {
      storeCode: input.normalizedPayload.normalizedStoreCode,
      storeName: input.normalizedPayload.normalizedStoreName,
      storeType: input.normalizedPayload.normalizedStoreType,
      regionCode: input.normalizedPayload.normalizedRegionCode,
    },
    normalizedPayload: input.normalizedPayload,
    validationStatus: input.validationStatus ?? "pending",
    issueCode: null,
    issueMessage: null,
    resolvedCompanyId: "00000000-0000-4000-8000-000000000001",
    resolvedRegionId: input.resolvedRegionId ?? null,
    resolvedStoreId: input.resolvedStoreId ?? null,
    resolvedEmployeeId: null,
    resolvedPositionId: null,
    promotedEntityId: input.promotedEntityId ?? null,
    createdAt: "2026-04-29T12:00:00.000Z",
    updatedAt: "2026-04-29T12:00:00.000Z",
  };
}
