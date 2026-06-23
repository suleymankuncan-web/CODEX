import { HttpException, HttpStatus, Logger } from "@nestjs/common";
import * as XLSX from "@e965/xlsx";
import {
  POWER_BI_EXPORT_MAX_SHEET_COLUMNS,
  POWER_BI_EXPORT_MAX_SHEET_ROWS,
  POWER_BI_EXPORT_PARSE_RETRY_AFTER_SECONDS,
  PowerBiExportUploadService,
} from "./power-bi-export-upload.service";
import { PowerBiExportParserService } from "./power-bi-export-parser.service";
import { PowerBiExportNormalizerService } from "./power-bi-export-normalizer.service";

type PowerBiExportParserServiceTestHooks = {
  readSheetRows: jest.Mock<
    Promise<Array<Record<string, unknown>>>,
    [unknown, unknown, AbortSignal]
  >;
};

function createWorkbookBuffer(rows: Array<Record<string, unknown>>): Buffer {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Store");
  return Buffer.from(XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }));
}

function createService(
  config: { uploadParseMaxConcurrency?: number; uploadParseTimeoutMs?: number } = {},
) {
  const kpiImportStoreReadRepository = {
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
  const appConfigService = {
    uploadParseMaxConcurrency: config.uploadParseMaxConcurrency ?? 1,
    uploadParseTimeoutMs: config.uploadParseTimeoutMs ?? 15000,
  };
  const parserService = new PowerBiExportParserService(appConfigService as never);
  const normalizerService = new PowerBiExportNormalizerService();
  const service = new PowerBiExportUploadService(
    parserService,
    kpiImportStoreReadRepository as never,
    integrationSourceRepository as never,
    integrationService as never,
    normalizerService,
  );

  return {
    appConfigService,
    parserService,
    kpiImportStoreReadRepository,
    integrationSourceRepository,
    integrationService,
    service,
  };
}

describe("PowerBiExportUploadService", () => {
  let loggerErrorSpy: jest.SpyInstance;
  let loggerLogSpy: jest.SpyInstance;

  beforeEach(() => {
    loggerErrorSpy = jest
      .spyOn(Logger.prototype, "error")
      .mockImplementation(() => undefined);
    loggerLogSpy = jest
      .spyOn(Logger.prototype, "log")
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    loggerLogSpy.mockRestore();
    loggerErrorSpy.mockRestore();
  });

  it("normalizes Turkish dotted and dotless characters for scope matching", () => {
    const normalizerService = new PowerBiExportNormalizerService();

    expect(normalizerService.normalizeKey("Diyarbakır İstinye")).toBe(
      "diyarbakiristinye",
    );
    expect(
      normalizerService.getText(
        {
          "Mağaza Adı": "Diyarbakır İstinye",
        },
        ["Magaza Adi"],
      ),
    ).toBe("Diyarbakır İstinye");
  });

  it("rejects concurrent Power BI parses with a retryable 503", async () => {
    const { parserService, service } = createService({
      uploadParseMaxConcurrency: 1,
      uploadParseTimeoutMs: 1000,
    });
    let releaseParse: (() => void) | undefined;
    const parseStarted = new Promise<void>((resolve) => {
      (parserService as unknown as PowerBiExportParserServiceTestHooks).readSheetRows = jest.fn(
        async (_file, _context, _signal) => {
          resolve();
          await new Promise<void>((release) => {
            releaseParse = release;
          });
          return [{ MagazaAdi: "Kadikoy", Ciro: 150000 }];
        },
      );
    });

    const firstUpload = service.upload({
      sourceCode: "POWER_BI",
      periodMonth: "2026-04",
      actorUserId: "user-1",
      storeFile: {
        originalname: "store.xlsx",
        buffer: createWorkbookBuffer([{ MagazaAdi: "Kadikoy", Ciro: 150000 }]),
      },
    });
    await parseStarted;

    let error: unknown;
    try {
      await service.upload({
        sourceCode: "POWER_BI",
        periodMonth: "2026-04",
        actorUserId: "user-2",
        storeFile: {
          originalname: "store.xlsx",
          buffer: createWorkbookBuffer([{ MagazaAdi: "Kadikoy", Ciro: 150000 }]),
        },
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    expect((error as HttpException).getResponse()).toMatchObject({
      message:
        "Power BI export isleme kapasitesi dolu; lutfen kisa sure sonra tekrar deneyin",
      retryAfterSeconds: POWER_BI_EXPORT_PARSE_RETRY_AFTER_SECONDS,
    });

    releaseParse?.();
    await firstUpload;
  });

  it("times out slow Power BI parsing with a retryable 503", async () => {
    const { parserService, service } = createService({
      uploadParseMaxConcurrency: 1,
      uploadParseTimeoutMs: 5,
    });
    (parserService as unknown as PowerBiExportParserServiceTestHooks).readSheetRows = jest.fn(
      async (_file, _context, _signal) =>
        new Promise<Array<Record<string, unknown>>>((resolve) => {
          setTimeout(() => resolve([{ MagazaAdi: "Kadikoy", Ciro: 150000 }]), 30);
        }),
    );

    let error: unknown;
    try {
      await service.upload({
        sourceCode: "POWER_BI",
        periodMonth: "2026-04",
        actorUserId: "user-1",
        storeFile: {
          originalname: "store.xlsx",
          buffer: createWorkbookBuffer([{ MagazaAdi: "Kadikoy", Ciro: 150000 }]),
        },
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    expect((error as HttpException).getResponse()).toMatchObject({
      message:
        "Power BI export dosyasi isleme suresi asildi; lutfen daha kucuk dosya yukleyin veya tekrar deneyin",
      retryAfterSeconds: POWER_BI_EXPORT_PARSE_RETRY_AFTER_SECONDS,
    });
  });

  it("keeps the parse slot occupied until timed-out parsing cleanup finishes", async () => {
    const { parserService, service } = createService({
      uploadParseMaxConcurrency: 1,
      uploadParseTimeoutMs: 5,
    });
    let releaseCleanup: (() => void) | undefined;
    const parseStarted = new Promise<void>((resolve) => {
      (parserService as unknown as PowerBiExportParserServiceTestHooks).readSheetRows = jest.fn(
        async (_file, _context, _signal) => {
          resolve();
          await new Promise<void>((release) => {
            releaseCleanup = release;
          });
          return [{ MagazaAdi: "Kadikoy", Ciro: 150000 }];
        },
      );
    });

    const firstUpload = service.upload({
      sourceCode: "POWER_BI",
      periodMonth: "2026-04",
      actorUserId: "user-1",
      storeFile: {
        originalname: "store.xlsx",
        buffer: createWorkbookBuffer([{ MagazaAdi: "Kadikoy", Ciro: 150000 }]),
      },
    });
    const firstUploadTimeout = expect(firstUpload).rejects.toMatchObject({
      status: HttpStatus.SERVICE_UNAVAILABLE,
      response: {
        message:
          "Power BI export dosyasi isleme suresi asildi; lutfen daha kucuk dosya yukleyin veya tekrar deneyin",
        retryAfterSeconds: POWER_BI_EXPORT_PARSE_RETRY_AFTER_SECONDS,
      },
    });
    await parseStarted;
    await new Promise((resolve) => setTimeout(resolve, 20));
    await firstUploadTimeout;

    await expect(
      service.upload({
        sourceCode: "POWER_BI",
        periodMonth: "2026-04",
        actorUserId: "user-2",
        storeFile: {
          originalname: "store.xlsx",
          buffer: createWorkbookBuffer([{ MagazaAdi: "Kadikoy", Ciro: 150000 }]),
        },
      }),
    ).rejects.toMatchObject({
      status: HttpStatus.SERVICE_UNAVAILABLE,
      response: {
        message:
          "Power BI export isleme kapasitesi dolu; lutfen kisa sure sonra tekrar deneyin",
        retryAfterSeconds: POWER_BI_EXPORT_PARSE_RETRY_AFTER_SECONDS,
      },
    });

    releaseCleanup?.();
  });

  it("rejects oversized Power BI export files before parsing", async () => {
    const { service } = createService();
    const oversizedBuffer = Buffer.alloc(9 * 1024 * 1024, 1);

    await expect(
      service.upload({
        sourceCode: "POWER_BI",
        periodMonth: "2026-04",
        actorUserId: "user-1",
        storeFile: {
          originalname: "store.xlsx",
          buffer: oversizedBuffer,
        },
      }),
    ).rejects.toThrow("Power BI export dosyasi en fazla 8 MB olabilir");
  });

  it("rejects unsupported Power BI export file names before parsing", async () => {
    const { service } = createService();

    await expect(
      service.upload({
        sourceCode: "POWER_BI",
        periodMonth: "2026-04",
        actorUserId: "user-1",
        storeFile: {
          originalname: "store.txt",
          buffer: Buffer.from("not a spreadsheet"),
        },
      }),
    ).rejects.toThrow("Power BI export dosyasi xlsx, xls veya csv olmali");
  });

  it("rejects Power BI sheets with too many rows before json conversion", async () => {
    const { service } = createService();
    const rows = Array.from({ length: POWER_BI_EXPORT_MAX_SHEET_ROWS + 1 }, (_, index) => ({
      MagazaAdi: index === 0 ? "Kadikoy" : "",
    }));

    await expect(
      service.upload({
        sourceCode: "POWER_BI",
        periodMonth: "2026-04",
        actorUserId: "user-1",
        storeFile: {
          originalname: "store.xlsx",
          buffer: createWorkbookBuffer(rows),
        },
      }),
    ).rejects.toThrow(
      `Power BI export dosyasi en fazla ${POWER_BI_EXPORT_MAX_SHEET_ROWS} satir olabilir`,
    );
  });

  it("rejects Power BI sheets with too many columns before json conversion", async () => {
    const { service } = createService();
    const row = Object.fromEntries(
      Array.from({ length: POWER_BI_EXPORT_MAX_SHEET_COLUMNS + 1 }, (_, index) => [
        `Col${index}`,
        "value",
      ]),
    );

    await expect(
      service.upload({
        sourceCode: "POWER_BI",
        periodMonth: "2026-04",
        actorUserId: "user-1",
        storeFile: {
          originalname: "store.xlsx",
          buffer: createWorkbookBuffer([row]),
        },
      }),
    ).rejects.toThrow(
      `Power BI export dosyasi en fazla ${POWER_BI_EXPORT_MAX_SHEET_COLUMNS} kolon olabilir`,
    );
  });

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
    const parseLog = loggerLogSpy.mock.calls
      .map(([message]) => String(message))
      .find((message) => message.includes("power_bi_export_upload.parse.completed"));
    expect(parseLog).toBeDefined();
    expect(parseLog).toContain('"fileRole":"store"');
    expect(parseLog).toContain('"fileType":"xlsx"');
    expect(parseLog).toContain('"fileSizeBytes"');
    expect(parseLog).toContain('"parseDurationMs"');
    expect(parseLog).toContain('"rowCount":1');
    expect(parseLog).not.toContain("store.xlsx");
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

  it("imports GSM Onayı reports by store code and keeps empty or unmatched rows visible", async () => {
    const { kpiImportStoreReadRepository, integrationService, service } = createService();
    kpiImportStoreReadRepository.listKpiImportStoreExternalRefs.mockResolvedValue([
      { external_ref: "SM182" },
      { external_ref: "SM183" },
    ]);
    const buffer = createWorkbookBuffer([
      {
        "Mağaza Kodu": "SM182",
        "Mağaza Adı": "Balıkesir 10 Burda AVM",
        "% GSM Onayi": 0.9120521172638436,
      },
      {
        "Mağaza Kodu": "SM183",
        "Mağaza Adı": "Boş GSM Mağazası",
        "% GSM Onayi": null,
      },
      {
        "Mağaza Kodu": "SM999",
        "Mağaza Adı": "Eşleşmeyen Mağaza",
        "% GSM Onayi": 0.5,
      },
    ]);

    const response = await service.upload({
      sourceCode: "POWER_BI",
      periodMonth: "2026-01",
      actorUserId: "user-1",
      storeFile: {
        originalname: "ocak-gsm.xlsx",
        buffer,
      },
    });

    const rows = (integrationService.createImportBatch.mock.calls[0][0].rows ??
      []) as Array<Record<string, unknown>>;

    expect(response.data.summary).toMatchObject({
      periodType: "monthly",
      periodMonth: "2026-01",
      storeRowsRead: 3,
      canonicalRowCount: 3,
    });
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kpiCode: "gsm_approval",
          sourceStoreId: "SM182",
          storeExternalRef: "Balıkesir 10 Burda AVM",
          actualValue: 91.2052,
          achievementRate: 0.912052,
          validationError: null,
          periodType: "monthly",
          periodStart: "2026-01-01",
          periodEnd: "2026-01-31",
        }),
        expect.objectContaining({
          kpiCode: "gsm_approval",
          sourceStoreId: "SM183",
          storeExternalRef: "Boş GSM Mağazası",
          actualValue: 0,
          achievementRate: null,
          validationError: "gsm_approval value is required",
        }),
        expect.objectContaining({
          kpiCode: "gsm_approval",
          sourceStoreId: "SM999",
          storeExternalRef: "Eşleşmeyen Mağaza",
          actualValue: 50,
          achievementRate: 0.5,
          validationError: "gsm_approval store reference is not mapped: SM999",
        }),
      ]),
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
        Adi: "Ali Can",
        MagazaAdi: "Kadikoy",
        PSatisAdeti: -1,
        SatisTutari: -1000,
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
      personnelRowsRead: 4,
      personnelGrossSalesRows: 1,
      negativePersonnelRowsIgnored: 3,
      canonicalRowCount: 5,
    });
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kpiCode: "NET_SALES",
          actualValue: 10000,
          scopeType: "employee",
          employeeExternalRef: "powerbi:Istanbul Marmara Park Avm:Ali Can",
          sourceRow: expect.objectContaining({
            personnelGrossSales: 10000,
          }),
        }),
        expect.objectContaining({
          kpiCode: "ITEM_COUNT",
          actualValue: 10,
          scopeType: "employee",
          employeeExternalRef: "powerbi:Istanbul Marmara Park Avm:Ali Can",
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
        expect.objectContaining({
          scopeType: "employee",
          sourceRow: expect.objectContaining({
            SatisTutari: -1000,
          }),
        }),
      ]),
    );
  });

  it("keeps same-name personnel separate across stores", async () => {
    const { kpiImportStoreReadRepository, integrationService, service } = createService();
    kpiImportStoreReadRepository.listKpiImportStoreExternalRefs.mockResolvedValue([
      { external_ref: "Istanbul Marmara Park Avm" },
      { external_ref: "Kadikoy" },
    ]);
    const buffer = createWorkbookBuffer([
      {
        Adi: "Ali Can",
        MagazaAdi: "Istanbul Marmara Park Avm",
        PSatisAdeti: 10,
        SatisTutari: 10000,
      },
      {
        Adi: "Ali Can",
        MagazaAdi: "Kadikoy",
        PSatisAdeti: 3,
        SatisTutari: 3000,
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
      personnelRowsRead: 2,
      personnelGrossSalesRows: 2,
      canonicalRowCount: 4,
    });
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kpiCode: "NET_SALES",
          actualValue: 10000,
          storeExternalRef: "Istanbul Marmara Park Avm",
          employeeExternalRef: "powerbi:Istanbul Marmara Park Avm:Ali Can",
        }),
        expect.objectContaining({
          kpiCode: "NET_SALES",
          actualValue: 3000,
          storeExternalRef: "Kadikoy",
          employeeExternalRef: "powerbi:Kadikoy:Ali Can",
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
          employeeExternalRef: "powerbi:Istanbul Marmara Park Avm:Ali Can",
        }),
        expect.objectContaining({
          kpiCode: "ATV",
          actualValue: 1000,
          scopeType: "employee",
          employeeExternalRef: "powerbi:Istanbul Marmara Park Avm:Ali Can",
        }),
        expect.objectContaining({
          kpiCode: "UPT",
          actualValue: 1,
          scopeType: "employee",
          employeeExternalRef: "powerbi:Istanbul Marmara Park Avm:Ali Can",
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
    const { kpiImportStoreReadRepository, integrationService, service } = createService();
    kpiImportStoreReadRepository.listKpiImportStoreExternalRefs.mockResolvedValue([
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
    expect(kpiImportStoreReadRepository.listKpiImportStoreExternalRefs).toHaveBeenCalledWith(
      {
        actorCompanyIds: [],
        integrationSourceId: "00000000-0000-0000-0000-000000000010",
      },
    );
  });
});
