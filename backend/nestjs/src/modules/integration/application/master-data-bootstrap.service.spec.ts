import { MasterDataBootstrapService } from "./master-data-bootstrap.service";

describe("MasterDataBootstrapService", () => {
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
            firstName: "Ada",
            lastName: "Kaya",
            nationalIdHash:
              "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            hireDate: "2026-04-01",
          },
          normalizedPayload: {
            normalizedStoreCode: "SM140",
            normalizedEmployeeCode: "FM8377",
            normalizedPositionCode: "UNKNOWN",
            normalizedFirstName: "Ada",
            normalizedLastName: "Kaya",
            normalizedNationalIdHash:
              "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            normalizedHireDate: "2026-04-01",
            normalizedEmploymentType: "full_time",
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
            firstName: "Ada",
            lastName: "Kaya",
            nationalIdHash:
              "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            hireDate: "2026-04-01",
          },
          normalizedPayload: {
            normalizedStoreCode: "SM140",
            normalizedEmployeeCode: "FM8375",
            normalizedPositionCode: "SALES",
            normalizedFirstName: "Ada",
            normalizedLastName: "Kaya",
            normalizedNationalIdHash:
              "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            normalizedHireDate: "2026-04-01",
            normalizedEmploymentType: "full_time",
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
      resolveEmployeeByNationalIdHash: jest.fn(async () => null),
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

  it("allows personnel rows without national id evidence when required live-write metadata is present", async () => {
    const masterDataBootstrapRepository = {
      getBootstrapBatchForActor: jest.fn(async () =>
        buildBootstrapBatch({
          bootstrapEntity: "personnel",
          batchId: "batch-personnel-validation",
        }),
      ),
      listBootstrapRows: jest.fn(async () => [
        buildPersonnelRow("row-missing-first-name", 1, "FM8375", undefined, {
          normalizedPayload: {
            normalizedFirstName: null,
          },
        }),
        buildPersonnelRow("row-missing-national-id", 2, "FM8376", undefined, {
          normalizedPayload: {
            normalizedNationalIdHash: null,
          },
        }),
        buildPersonnelRow("row-invalid-hire-date", 3, "FM8377", undefined, {
          normalizedPayload: {
            normalizedHireDate: "01.04.2026",
          },
        }),
      ]),
      resolveStoreByCode: jest.fn(async () => ({
        storeId: "00000000-0000-4000-8000-000000000140",
        regionId: "00000000-0000-4000-8000-000000000240",
      })),
      resolveEmployeeByCode: jest.fn(async () => null),
      resolveEmployeeByNationalIdHash: jest.fn(async () => null),
      resolvePositionByCode: jest.fn(
        async () => "00000000-0000-4000-8000-000000000501",
      ),
      updateBootstrapRowValidationResults: jest.fn(async () => ({
        batchId: "batch-personnel-validation",
        batchStatus: "validated",
        rowCount: 3,
        validCount: 1,
        needsReviewCount: 0,
        invalidCount: 2,
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
      batchId: "batch-personnel-validation",
    });

    expect(
      masterDataBootstrapRepository.updateBootstrapRowValidationResults,
    ).toHaveBeenCalledWith({
      batchId: "batch-personnel-validation",
      results: [
        expect.objectContaining({
          rowId: "row-missing-first-name",
          validationStatus: "invalid",
          issueCode: "missing_first_name",
        }),
        expect.objectContaining({
          rowId: "row-missing-national-id",
          validationStatus: "valid",
          issueCode: null,
        }),
        expect.objectContaining({
          rowId: "row-invalid-hire-date",
          validationStatus: "invalid",
          issueCode: "invalid_hire_date",
        }),
      ],
    });
    expect(
      masterDataBootstrapRepository.resolveEmployeeByNationalIdHash,
    ).not.toHaveBeenCalled();
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

  it("marks new store rows without region code as review rows", async () => {
    const masterDataBootstrapRepository = {
      getBootstrapBatchForActor: jest.fn(async () =>
        buildBootstrapBatch({ bootstrapEntity: "store", batchId: "batch-store" }),
      ),
      listBootstrapRows: jest.fn(async () => [
        buildStoreRow({
          rowId: "row-missing-region",
          rowNumber: 1,
          normalizedPayload: {
            normalizedStoreCode: "SM140",
            normalizedStoreName: "Marmara Park",
            normalizedStoreType: "company",
          },
        }),
      ]),
      resolveStoreByCode: jest.fn(async () => null),
      resolveRegionByCode: jest.fn(async () => null),
      updateBootstrapRowValidationResults: jest.fn(async () => ({
        batchId: "batch-store",
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
      batchId: "batch-store",
    });

    expect(
      masterDataBootstrapRepository.updateBootstrapRowValidationResults,
    ).toHaveBeenCalledWith({
      batchId: "batch-store",
      results: [
        expect.objectContaining({
          rowId: "row-missing-region",
          validationStatus: "needs_review",
          issueCode: "missing_region_code",
        }),
      ],
    });
  });

  it("marks new store rows with unknown region code as review rows", async () => {
    const masterDataBootstrapRepository = {
      getBootstrapBatchForActor: jest.fn(async () =>
        buildBootstrapBatch({ bootstrapEntity: "store", batchId: "batch-store" }),
      ),
      listBootstrapRows: jest.fn(async () => [
        buildStoreRow({
          rowId: "row-unmapped-region",
          rowNumber: 1,
          normalizedPayload: {
            normalizedStoreCode: "SM140",
            normalizedStoreName: "Marmara Park",
            normalizedStoreType: "company",
            normalizedRegionCode: "MARMARA",
          },
        }),
      ]),
      resolveStoreByCode: jest.fn(async () => null),
      resolveRegionByCode: jest.fn(async () => null),
      updateBootstrapRowValidationResults: jest.fn(async () => ({
        batchId: "batch-store",
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
      batchId: "batch-store",
    });

    expect(masterDataBootstrapRepository.resolveRegionByCode).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000001",
      "MARMARA",
    );
    expect(
      masterDataBootstrapRepository.updateBootstrapRowValidationResults,
    ).toHaveBeenCalledWith({
      batchId: "batch-store",
      results: [
        expect.objectContaining({
          rowId: "row-unmapped-region",
          validationStatus: "needs_review",
          issueCode: "unmapped_region",
        }),
      ],
    });
  });

  it("validates new store rows when region code resolves", async () => {
    const masterDataBootstrapRepository = {
      getBootstrapBatchForActor: jest.fn(async () =>
        buildBootstrapBatch({ bootstrapEntity: "store", batchId: "batch-store" }),
      ),
      listBootstrapRows: jest.fn(async () => [
        buildStoreRow({
          rowId: "row-valid-new-store",
          rowNumber: 1,
          normalizedPayload: {
            normalizedStoreCode: "SM140",
            normalizedStoreName: "Marmara Park",
            normalizedStoreType: "company",
            normalizedRegionCode: "MARMARA",
          },
        }),
      ]),
      resolveStoreByCode: jest.fn(async () => null),
      resolveRegionByCode: jest.fn(
        async () => "00000000-0000-4000-8000-000000000240",
      ),
      updateBootstrapRowValidationResults: jest.fn(async () => ({
        batchId: "batch-store",
        batchStatus: "ready_to_promote",
        rowCount: 1,
        validCount: 1,
        needsReviewCount: 0,
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
      batchId: "batch-store",
    });

    expect(
      masterDataBootstrapRepository.updateBootstrapRowValidationResults,
    ).toHaveBeenCalledWith({
      batchId: "batch-store",
      results: [
        expect.objectContaining({
          rowId: "row-valid-new-store",
          validationStatus: "valid",
          issueCode: null,
          resolvedRegionId: "00000000-0000-4000-8000-000000000240",
        }),
      ],
    });
  });

  it("marks normalized duplicate store codes as review issues before store promotion", async () => {
    const masterDataBootstrapRepository = {
      getBootstrapBatchForActor: jest.fn(async () => ({
        batchId: "00000000-0000-4000-8000-000000000904",
        companyId: "00000000-0000-4000-8000-000000000001",
        bootstrapEntity: "store",
        sourceLabel: "April store baseline",
        fileReference: "store-master-data-april.xlsx",
        uploadedByUserId: "hr-admin-user",
        batchStatus: "uploaded",
        rowCount: 2,
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
          rowId: "row-store-1",
          batchId: "00000000-0000-4000-8000-000000000904",
          rowNumber: 1,
          rowHash: "hash-store-1",
          sourceStoreCode: "SM140",
          sourceEmployeeCode: null,
          rawPayload: { storeCode: "SM-140", storeType: "company" },
          normalizedPayload: {
            normalizedStoreCode: "SM140",
            normalizedStoreType: "company",
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
          rowId: "row-store-2",
          batchId: "00000000-0000-4000-8000-000000000904",
          rowNumber: 2,
          rowHash: "hash-store-2",
          sourceStoreCode: "SM140",
          sourceEmployeeCode: null,
          rawPayload: { storeCode: "SM140", storeType: "franchise" },
          normalizedPayload: {
            normalizedStoreCode: "SM140",
            normalizedStoreType: "franchise",
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
        batchId: "00000000-0000-4000-8000-000000000904",
        batchStatus: "validated",
        rowCount: 2,
        validCount: 0,
        needsReviewCount: 2,
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
      batchId: "00000000-0000-4000-8000-000000000904",
    });

    expect(masterDataBootstrapRepository.resolveStoreByCode).not.toHaveBeenCalled();
    expect(
      masterDataBootstrapRepository.updateBootstrapRowValidationResults,
    ).toHaveBeenCalledWith({
      batchId: "00000000-0000-4000-8000-000000000904",
      results: [
        expect.objectContaining({
          rowId: "row-store-1",
          validationStatus: "needs_review",
          issueCode: "duplicate_store_code_in_batch",
        }),
        expect.objectContaining({
          rowId: "row-store-2",
          validationStatus: "needs_review",
          issueCode: "duplicate_store_code_in_batch",
        }),
      ],
    });
  });

  it("marks normalized duplicate personnel seller codes as review issues", async () => {
    const masterDataBootstrapRepository = {
      getBootstrapBatchForActor: jest.fn(async () => ({
        batchId: "00000000-0000-4000-8000-000000000905",
        companyId: "00000000-0000-4000-8000-000000000001",
        bootstrapEntity: "personnel",
        sourceLabel: "April personnel baseline",
        fileReference: "personnel-master-data-april.xlsx",
        uploadedByUserId: "hr-admin-user",
        batchStatus: "uploaded",
        rowCount: 2,
        validCount: 0,
        needsReviewCount: 0,
        invalidCount: 0,
        promotedCount: 0,
        createdAt: "2026-04-29T12:00:00.000Z",
        validatedAt: null,
        promotedAt: null,
      })),
      listBootstrapRows: jest.fn(async () => [
        buildPersonnelRow("row-personnel-1", 1, "FM8375"),
        buildPersonnelRow("row-personnel-2", 2, "FM8375"),
      ]),
      resolveStoreByCode: jest.fn(async () => null),
      resolveEmployeeByCode: jest.fn(async () => null),
      resolvePositionByCode: jest.fn(async () => null),
      updateBootstrapRowValidationResults: jest.fn(async () => ({
        batchId: "00000000-0000-4000-8000-000000000905",
        batchStatus: "validated",
        rowCount: 2,
        validCount: 0,
        needsReviewCount: 2,
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
      batchId: "00000000-0000-4000-8000-000000000905",
    });

    expect(masterDataBootstrapRepository.resolveStoreByCode).not.toHaveBeenCalled();
    expect(
      masterDataBootstrapRepository.updateBootstrapRowValidationResults,
    ).toHaveBeenCalledWith({
      batchId: "00000000-0000-4000-8000-000000000905",
      results: [
        expect.objectContaining({
          rowId: "row-personnel-1",
          validationStatus: "needs_review",
          issueCode: "duplicate_employee_code_in_batch",
        }),
        expect.objectContaining({
          rowId: "row-personnel-2",
          validationStatus: "needs_review",
          issueCode: "duplicate_employee_code_in_batch",
        }),
      ],
    });
  });

  it("marks duplicate personnel national id hashes as review issues", async () => {
    const nationalIdHash =
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const masterDataBootstrapRepository = {
      getBootstrapBatchForActor: jest.fn(async () => ({
        batchId: "00000000-0000-4000-8000-000000000906",
        companyId: "00000000-0000-4000-8000-000000000001",
        bootstrapEntity: "personnel",
        sourceLabel: "April personnel baseline",
        fileReference: "personnel-master-data-april.xlsx",
        uploadedByUserId: "hr-admin-user",
        batchStatus: "uploaded",
        rowCount: 2,
        validCount: 0,
        needsReviewCount: 0,
        invalidCount: 0,
        promotedCount: 0,
        createdAt: "2026-04-29T12:00:00.000Z",
        validatedAt: null,
        promotedAt: null,
      })),
      listBootstrapRows: jest.fn(async () => [
        buildPersonnelRow("row-personnel-1", 1, "FM8375", nationalIdHash),
        buildPersonnelRow("row-personnel-2", 2, "FM8376", nationalIdHash),
      ]),
      resolveStoreByCode: jest.fn(async () => null),
      resolveEmployeeByCode: jest.fn(async () => null),
      resolvePositionByCode: jest.fn(async () => null),
      updateBootstrapRowValidationResults: jest.fn(async () => ({
        batchId: "00000000-0000-4000-8000-000000000906",
        batchStatus: "validated",
        rowCount: 2,
        validCount: 0,
        needsReviewCount: 2,
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
      batchId: "00000000-0000-4000-8000-000000000906",
    });

    expect(masterDataBootstrapRepository.resolveStoreByCode).not.toHaveBeenCalled();
    expect(
      masterDataBootstrapRepository.updateBootstrapRowValidationResults,
    ).toHaveBeenCalledWith({
      batchId: "00000000-0000-4000-8000-000000000906",
      results: [
        expect.objectContaining({
          rowId: "row-personnel-1",
          validationStatus: "needs_review",
          issueCode: "duplicate_national_id_in_batch",
        }),
        expect.objectContaining({
          rowId: "row-personnel-2",
          validationStatus: "needs_review",
          issueCode: "duplicate_national_id_in_batch",
        }),
      ],
    });
  });

  it("marks existing employee seller code and national id mismatches as review issues", async () => {
    const nationalIdHash =
      "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    const masterDataBootstrapRepository = {
      getBootstrapBatchForActor: jest.fn(async () => ({
        batchId: "00000000-0000-4000-8000-000000000907",
        companyId: "00000000-0000-4000-8000-000000000001",
        bootstrapEntity: "personnel",
        sourceLabel: "April personnel baseline",
        fileReference: "personnel-master-data-april.xlsx",
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
        buildPersonnelRow("row-personnel-conflict", 1, "FM8375", nationalIdHash),
      ]),
      resolveStoreByCode: jest.fn(async () => ({
        storeId: "00000000-0000-4000-8000-000000000140",
        regionId: "00000000-0000-4000-8000-000000000240",
      })),
      resolveEmployeeByCode: jest.fn(
        async () => "00000000-0000-4000-8000-000000008375",
      ),
      resolveEmployeeByNationalIdHash: jest.fn(
        async () => "00000000-0000-4000-8000-000000008999",
      ),
      resolvePositionByCode: jest.fn(
        async () => "00000000-0000-4000-8000-000000000501",
      ),
      updateBootstrapRowValidationResults: jest.fn(async () => ({
        batchId: "00000000-0000-4000-8000-000000000907",
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
      batchId: "00000000-0000-4000-8000-000000000907",
    });

    expect(
      masterDataBootstrapRepository.updateBootstrapRowValidationResults,
    ).toHaveBeenCalledWith({
      batchId: "00000000-0000-4000-8000-000000000907",
      results: [
        expect.objectContaining({
          rowId: "row-personnel-conflict",
          validationStatus: "needs_review",
          issueCode: "employee_identity_conflict",
          resolvedEmployeeId: "00000000-0000-4000-8000-000000008375",
        }),
      ],
    });
  });

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
    expect(result.command.status).toBe("promoted");
    expect(result.data.batch.promotedCount).toBe(2);
    expect(result.data.promotedRows).toEqual([
      {
        rowId: "row-ready-store",
        promotedEntityId: "00000000-0000-4000-8000-000000000140",
      },
    ]);
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
    expect(result.command.status).toBe("promoted");
    expect(result.data.batch.promotedCount).toBe(2);
    expect(result.data.promotedRows).toEqual([
      {
        rowId: "row-ready-personnel",
        promotedEntityId: "00000000-0000-4000-8000-000000008375",
        assignmentId: "00000000-0000-4000-8000-000000009375",
      },
    ]);
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
