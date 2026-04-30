import { MasterDataBootstrapService } from "./master-data-bootstrap.service";

describe("MasterDataBootstrapService staging", () => {
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
            normalizedFirstName: "Ada",
            normalizedLastName: "Kaya",
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

  it("normalizes personnel national id evidence into a hash for preflight checks", async () => {
    const masterDataBootstrapRepository = {
      createBootstrapBatch: jest.fn(async (input) => ({
        batchId: "00000000-0000-4000-8000-000000000903",
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

    await service.createBootstrapBatch({
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
          sellerCode: "fm8375",
          nationalId: "123 456 789 01",
          positionCode: "Sales Advisor",
        },
      ],
    });

    const stagedRow =
      masterDataBootstrapRepository.createBootstrapBatch.mock.calls[0][0].rows[0];
    expect(stagedRow.normalizedPayload).toEqual(
      expect.objectContaining({
        normalizedStoreCode: "SM140",
        normalizedEmployeeCode: "FM8375",
        normalizedPositionCode: "SALES_ADVISOR",
        normalizedNationalIdHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
    expect(stagedRow.normalizedPayload.normalizedNationalIdHash).not.toBe(
      "12345678901",
    );
  });

  it("stages personnel rows with normalized promotion metadata", async () => {
    const masterDataBootstrapRepository = {
      createBootstrapBatch: jest.fn(async (input) => ({
        batchId: "00000000-0000-4000-8000-000000000909",
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

    await service.createBootstrapBatch({
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
          nationalId: "12345678901",
          hireDate: "2026-04-01",
          positionCode: "Sales Advisor",
          employmentType: "part time",
        },
      ],
    });

    const stagedRow =
      masterDataBootstrapRepository.createBootstrapBatch.mock.calls[0][0].rows[0];
    expect(stagedRow.normalizedPayload).toEqual(
      expect.objectContaining({
        normalizedStoreCode: "SM140",
        normalizedEmployeeCode: "FM8375",
        normalizedFirstName: "Ada",
        normalizedLastName: "Kaya",
        normalizedNationalIdHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        normalizedHireDate: "2026-04-01",
        normalizedPositionCode: "SALES_ADVISOR",
        normalizedEmploymentType: "part_time",
      }),
    );
  });

  it("stages store rows with normalized promotion metadata", async () => {
    const masterDataBootstrapRepository = {
      createBootstrapBatch: jest.fn(async (input) => ({
        batchId: "00000000-0000-4000-8000-000000000908",
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

    await service.createBootstrapBatch({
      actorUserId: "hr-admin-user",
      actorScope: {
        companyIds: ["00000000-0000-4000-8000-000000000001"],
      },
      bootstrapEntity: "store",
      sourceLabel: "April store baseline",
      fileReference: "store-master-data-april.xlsx",
      rows: [
        {
          storeCode: "SM-140",
          storeName: "Marmara Park",
          storeType: "Şirket",
          regionCode: "MARMARA",
          storeStatus: "Aktif",
          kpiImportEnabled: "evet",
        },
      ],
    });

    const stagedRow =
      masterDataBootstrapRepository.createBootstrapBatch.mock.calls[0][0].rows[0];
    expect(stagedRow.normalizedPayload).toEqual(
      expect.objectContaining({
        normalizedStoreCode: "SM140",
        normalizedStoreName: "Marmara Park",
        normalizedStoreType: "company",
        normalizedRegionCode: "MARMARA",
        normalizedStoreStatus: "active",
        kpiImportEnabled: true,
      }),
    );
  });
});
