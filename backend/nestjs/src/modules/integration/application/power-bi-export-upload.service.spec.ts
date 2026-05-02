import * as XLSX from "@e965/xlsx";
import { PowerBiExportUploadService } from "./power-bi-export-upload.service";

function createWorkbookBuffer(rows: Array<Record<string, unknown>>): Buffer {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Store");
  return Buffer.from(XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }));
}

function createService() {
  const databaseService = {
    query: jest.fn(async (sql: string) => {
      if (sql.includes("FROM ops.company c")) {
        return {
          rowCount: 1,
          rows: [
            {
              company_id: "00000000-0000-0000-0000-000000000001",
              region_id: "00000000-0000-0000-0000-000000000002",
            },
          ],
        };
      }

      return { rowCount: 0, rows: [] };
    }),
  };
  const integrationRepository = {
    listKpiImportStoreExternalRefs: jest.fn().mockResolvedValue([
      { external_ref: "Kadikoy" },
      { external_ref: "Istanbul Marmara Park Avm" },
    ]),
  };
  const integrationSourceRepository = {
    getIntegrationSourceByCodeAndEntity: jest.fn().mockResolvedValue({
      integration_source_id: "00000000-0000-0000-0000-000000000010",
      is_active: true,
      source_system: "power_bi",
    }),
  };
  const integrationService = {
    createImportBatch: jest.fn().mockResolvedValue({
      command: { status: "accepted" },
      data: { batch: { importBatchId: "batch-1" } },
      job: { backend: "in-memory", jobId: null, queueName: null, jobType: "import_batch" },
    }),
  };
  const service = new PowerBiExportUploadService(
    databaseService as never,
    integrationRepository as never,
    integrationSourceRepository as never,
    integrationService as never,
  );

  return {
    databaseService,
    integrationRepository,
    integrationSourceRepository,
    integrationService,
    service,
  };
}

describe("PowerBiExportUploadService", () => {
  it("reads uploaded store xlsx rows and creates canonical KPI import rows", async () => {
    const { integrationService, service } = createService();
    const buffer = createWorkbookBuffer([
      {
        MagazaAdi: "Kadikoy",
        Ciro: 150000,
        Hedef: 120000,
        SatisAdedi: 62,
        FaturaSayisi: 20,
        FF: 100,
        CR: 42,
        ATV: 950,
        UPT: 3.2,
      },
    ]);

    const response = await service.upload({
      sourceCode: "POWER_BI",
      periodMonth: "2026-04",
      actorUserId: "user-1",
      storeFile: {
        originalname: "store.xlsx",
        buffer,
      },
    });

    expect(response.data.summary).toMatchObject({
      storeRowsRead: 1,
      personnelRowsRead: 0,
      canonicalRowCount: 8,
      periodMonth: "2026-04",
      mappingMode: "strict_external_id_map",
    });
    expect(integrationService.createImportBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceCode: "POWER_BI",
        actorUserId: "user-1",
        rows: expect.arrayContaining([
          expect.objectContaining({
            kpiCode: "TARGET_ACHIEVEMENT",
            actualValue: 150000,
            targetValue: 120000,
            scopeType: "store",
            storeExternalRef: "Kadikoy",
            periodStart: "2026-04-01",
            periodEnd: "2026-04-30",
          }),
          expect.objectContaining({
            kpiCode: "ITEM_COUNT",
            actualValue: 62,
            scopeType: "store",
            storeExternalRef: "Kadikoy",
          }),
        ]),
      }),
    );
  });

  it("recomputes store ATV UPT and CR from base totals instead of trusting reported ratios", async () => {
    const { integrationService, service } = createService();
    const buffer = createWorkbookBuffer([
      {
        MagazaAdi: "Kadikoy",
        Ciro: 97294.51,
        Hedef: 100000,
        SatisAdedi: 66,
        FaturaSayisi: 22,
        FF: 100,
        CR: 0.1,
        ATV: 1,
        UPT: 1,
      },
    ]);

    const response = await service.upload({
      sourceCode: "POWER_BI",
      periodType: "custom",
      periodStart: "2026-03-01",
      periodEnd: "2026-03-02",
      actorUserId: "user-1",
      storeFile: {
        originalname: "store.xlsx",
        buffer,
      },
    });

    const rows = (integrationService.createImportBatch.mock.calls[0][0].rows ??
      []) as Array<Record<string, unknown>>;

    expect(response.data.summary).toMatchObject({
      periodType: "custom",
      periodStart: "2026-03-01",
      periodEnd: "2026-03-02",
      storeRowsRead: 1,
      canonicalRowCount: 8,
    });
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kpiCode: "NET_SALES",
          actualValue: 97294.51,
          scopeType: "store",
          storeExternalRef: "Kadikoy",
        }),
        expect.objectContaining({
          kpiCode: "ITEM_COUNT",
          actualValue: 66,
          scopeType: "store",
          storeExternalRef: "Kadikoy",
        }),
        expect.objectContaining({
          kpiCode: "TICKET_COUNT",
          actualValue: 22,
          scopeType: "store",
          storeExternalRef: "Kadikoy",
        }),
        expect.objectContaining({
          kpiCode: "FF",
          actualValue: 100,
          scopeType: "store",
          storeExternalRef: "Kadikoy",
        }),
        expect.objectContaining({
          kpiCode: "ATV",
          actualValue: 4422.4777,
          scopeType: "store",
          storeExternalRef: "Kadikoy",
        }),
        expect.objectContaining({
          kpiCode: "UPT",
          actualValue: 3,
          scopeType: "store",
          storeExternalRef: "Kadikoy",
        }),
        expect.objectContaining({
          kpiCode: "CR",
          actualValue: 0.22,
          scopeType: "store",
          storeExternalRef: "Kadikoy",
        }),
        expect.objectContaining({
          kpiCode: "TARGET_ACHIEVEMENT",
          actualValue: 97294.51,
          targetValue: 100000,
          scopeType: "store",
          storeExternalRef: "Kadikoy",
        }),
      ]),
    );
  });

  it("imports personnel gross sales from positive rows and ignores negative return rows", async () => {
    const { integrationService, service } = createService();
    const buffer = createWorkbookBuffer([
      {
        Adi: "Ali Can",
        MagazaAdi: "Istanbul Marmara Park Avm",
        PSatisAdeti: 10,
        SatisTutari: 10000,
        PATV: 1000,
        PUPT: 1,
      },
      {
        Adi: "Ali Can",
        MagazaAdi: "Istanbul Marmara Park Avm",
        PSatisAdeti: -2,
        SatisTutari: -2000,
        PATV: "",
        PUPT: "",
      },
      {
        Adi: "E-Store",
        MagazaAdi: "Istanbul Marmara Park Avm",
        PSatisAdeti: -1,
        SatisTutari: -500,
      },
    ]);

    const response = await service.upload({
      sourceCode: "POWER_BI",
      periodMonth: "2026-03",
      actorUserId: "user-1",
      personnelFile: {
        originalname: "personnel.xlsx",
        buffer,
      },
    });

    const rows = (integrationService.createImportBatch.mock.calls[0][0].rows ??
      []) as Array<Record<string, unknown>>;
    expect(response.data.summary).toMatchObject({
      personnelRowsRead: 3,
      personnelGrossSalesRows: 1,
      negativePersonnelRowsIgnored: 2,
      canonicalRowCount: 5,
    });
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kpiCode: "NET_SALES",
          actualValue: 10000,
          scopeType: "employee",
          employeeExternalRef: "powerbi:Ali Can",
          sourceRow: expect.objectContaining({
            personnelGrossSales: 10000,
          }),
        }),
        expect.objectContaining({
          kpiCode: "ITEM_COUNT",
          actualValue: 10,
          scopeType: "employee",
          employeeExternalRef: "powerbi:Ali Can",
        }),
      ]),
    );
    expect(rows).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scopeType: "employee",
          sourceRow: expect.objectContaining({
            SatisTutari: -2000,
          }),
        }),
      ]),
    );
  });

  it("derives personnel ticket count only when PATV and PUPT agree", async () => {
    const { integrationService, service } = createService();
    const buffer = createWorkbookBuffer([
      {
        Adi: "Ali Can",
        MagazaAdi: "Istanbul Marmara Park Avm",
        PSatisAdeti: 10,
        SatisTutari: 10000,
        PATV: 1000,
        PUPT: 1,
      },
    ]);

    await service.upload({
      sourceCode: "POWER_BI",
      periodMonth: "2026-03",
      actorUserId: "user-1",
      personnelFile: {
        originalname: "personnel.xlsx",
        buffer,
      },
    });

    const rows = (integrationService.createImportBatch.mock.calls[0][0].rows ??
      []) as Array<Record<string, unknown>>;

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kpiCode: "TICKET_COUNT",
          actualValue: 10,
          scopeType: "employee",
          employeeExternalRef: "powerbi:Ali Can",
        }),
        expect.objectContaining({
          kpiCode: "ATV",
          actualValue: 1000,
          scopeType: "employee",
          employeeExternalRef: "powerbi:Ali Can",
        }),
        expect.objectContaining({
          kpiCode: "UPT",
          actualValue: 1,
          scopeType: "employee",
          employeeExternalRef: "powerbi:Ali Can",
        }),
      ]),
    );
  });

  it("keeps store net sales as the store KPI source without applying personnel returns twice", async () => {
    const { integrationService, service } = createService();
    const storeBuffer = createWorkbookBuffer([
      {
        MagazaAdi: "Istanbul Marmara Park Avm",
        Hedef: 8500000,
        Ciro: 7765681.31,
        SatisAdedi: 6366,
        FaturaSayisi: 2167,
        FF: 19875,
        CR: 0.1090369326758579,
        ATV: 3583.6092801107425,
        UPT: 2.9377018920166127,
      },
    ]);
    const personnelBuffer = createWorkbookBuffer([
      {
        Adi: "EMRAH KARADEMIR",
        MagazaAdi: "Istanbul Marmara Park Avm",
        PSatisAdeti: 1346,
        SatisTutari: 1440513.86,
      },
      {
        Adi: "AYSE YILMAZ",
        MagazaAdi: "Istanbul Marmara Park Avm",
        PSatisAdeti: 5020,
        SatisTutari: 6558837.33,
      },
      {
        Adi: "E-Store",
        MagazaAdi: "Istanbul Marmara Park Avm",
        PSatisAdeti: -10,
        SatisTutari: -15099.9,
      },
      {
        Adi: "IADE HAREKETI",
        MagazaAdi: "Istanbul Marmara Park Avm",
        PSatisAdeti: -150,
        SatisTutari: -218569.98,
      },
    ]);

    const response = await service.upload({
      sourceCode: "POWER_BI",
      periodMonth: "2026-03",
      actorUserId: "user-1",
      storeFile: {
        originalname: "store.xlsx",
        buffer: storeBuffer,
      },
      personnelFile: {
        originalname: "personnel.xlsx",
        buffer: personnelBuffer,
      },
    });

    const rows = (integrationService.createImportBatch.mock.calls[0][0].rows ??
      []) as Array<Record<string, unknown>>;
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kpiCode: "NET_SALES",
          scopeType: "store",
          actualValue: 7765681.31,
          storeExternalRef: "Istanbul Marmara Park Avm",
          sourceRow: expect.objectContaining({
            storeNetSales: 7765681.31,
          }),
        }),
      ]),
    );
    expect(response.data.summary.reconciliation).toMatchObject({
      comparedStoreCount: 1,
      balancedStoreCount: 1,
      warningStoreCount: 0,
      items: [
        expect.objectContaining({
          storeExternalRef: "Istanbul Marmara Park Avm",
          storeNetSales: 7765681.31,
          personnelPositiveSales: 7999351.19,
          personnelNegativeMovements: -233669.88,
          personnelNetMovement: 7765681.31,
          reconciliationDelta: 0,
          status: "balanced",
        }),
      ],
    });
    expect(rows).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kpiCode: "NET_SALES",
          scopeType: "store",
          actualValue: 7750581.41,
        }),
      ]),
    );
  });

  it("uses a deterministic exact-payload source batch id for duplicate-safe reupload", async () => {
    const { integrationService, service } = createService();
    const buffer = createWorkbookBuffer([
      {
        MagazaAdi: "Kadikoy",
        Ciro: 100000,
        Hedef: 100000,
        SatisAdedi: 50,
        FaturaSayisi: 10,
        FF: 100,
      },
    ]);

    await service.upload({
      sourceCode: "POWER_BI",
      periodType: "daily",
      periodStart: "2026-03-01",
      periodEnd: "2026-03-01",
      actorUserId: "user-1",
      storeFile: {
        originalname: "store.xlsx",
        buffer,
      },
    });

    const firstCall = integrationService.createImportBatch.mock.calls[0][0];
    expect(firstCall.sourceBatchId).toMatch(
      /^power-bi-export:POWER_BI:daily:2026-03-01:2026-03-01:[a-f0-9]{12}$/,
    );
    expect(firstCall.idempotencyKey).toBe(firstCall.sourceBatchId);
  });

  it("limits Excel KPI import to stores enabled in the local store scope", async () => {
    const { integrationRepository, integrationService, service } = createService();
    integrationRepository.listKpiImportStoreExternalRefs.mockResolvedValue([
      { external_ref: "Istanbul Marmara Park Avm" },
    ]);
    const storeBuffer = createWorkbookBuffer([
      {
        MagazaAdi: "Istanbul Marmara Park Avm",
        Hedef: 8500000,
        Ciro: 7765681.31,
        SatisAdedi: 6366,
        FaturaSayisi: 2167,
        FF: 19875,
        CR: 0.109,
        ATV: 3583.6,
        UPT: 2.93,
      },
      {
        MagazaAdi: "Garaj Cadir Magaza",
        Hedef: 100000,
        Ciro: 50000,
        SatisAdedi: 50,
        FaturaSayisi: 10,
        FF: 200,
        CR: 0.05,
        ATV: 1000,
        UPT: 1.1,
      },
    ]);
    const personnelBuffer = createWorkbookBuffer([
      {
        Adi: "EMRAH KARADEMIR",
        MagazaAdi: "Istanbul Marmara Park Avm",
        PSatisAdeti: 1346,
        SatisTutari: 1440513.86,
      },
      {
        Adi: "GARAGE PERSON",
        MagazaAdi: "Garaj Cadir Magaza",
        PSatisAdeti: 40,
        SatisTutari: 50000,
      },
    ]);

    const response = await service.upload({
      sourceCode: "POWER_BI",
      periodMonth: "2026-03",
      actorUserId: "user-1",
      storeFile: {
        originalname: "store.xlsx",
        buffer: storeBuffer,
      },
      personnelFile: {
        originalname: "personnel.xlsx",
        buffer: personnelBuffer,
      },
    });

    const rows = (integrationService.createImportBatch.mock.calls[0][0].rows ??
      []) as Array<Record<string, unknown>>;
    expect(response.data.summary).toMatchObject({
      storeRowsRead: 2,
      personnelRowsRead: 2,
      scopeExcludedStoreRows: 1,
      scopeExcludedPersonnelRows: 1,
      canonicalRowCount: 10,
    });
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          storeExternalRef: "Istanbul Marmara Park Avm",
        }),
      ]),
    );
    expect(rows).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          storeExternalRef: "Garaj Cadir Magaza",
        }),
      ]),
    );
    expect(integrationRepository.listKpiImportStoreExternalRefs).toHaveBeenCalledWith(
      "00000000-0000-0000-0000-000000000010",
    );
  });
});
