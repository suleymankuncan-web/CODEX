import * as XLSX from "@e965/xlsx";
import { PowerBiExportUploadService } from "./power-bi-export-upload.service";

function createWorkbookBuffer(rows: Array<Record<string, unknown>>): Buffer {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Store");
  return Buffer.from(XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }));
}

describe("PowerBiExportUploadService", () => {
  it("reads uploaded store xlsx rows and creates canonical KPI import rows", async () => {
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
      integrationService as never,
    );
    const buffer = createWorkbookBuffer([
      {
        MagazaAdi: "Kadikoy",
        Ciro: 150000,
        Hedef: 120000,
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
      canonicalRowCount: 5,
      periodMonth: "2026-04",
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
        ]),
      }),
    );
  });
});
