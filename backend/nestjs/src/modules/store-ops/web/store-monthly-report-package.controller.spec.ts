import { StreamableFile } from "@nestjs/common";
import { StoreMonthlyReportPackageController } from "./store-monthly-report-package.controller";

describe("StoreMonthlyReportPackageController", () => {
  function createController() {
    const service = {
      getSummary: jest.fn(async () => ({ ok: true })),
      buildWorkbook: jest.fn(async () => ({
        buffer: Buffer.from("xlsx"),
        fileName: "magaza-izleyis-2026-06.xlsx",
      })),
    };
    const controller = new StoreMonthlyReportPackageController(service as never);

    return { controller, service };
  }

  it("delegates region manager package reads with action scope and user assignment fallback", async () => {
    const { controller, service } = createController();

    await controller.getStoreMonthlyReportPackage(
      {
        user: {
          userId: "region-manager-1",
          roleCodes: ["REGION_MANAGER"],
          scope: {
            companyIds: ["company-1"],
            regionIds: ["region-1"],
            storeIds: [],
          },
          actionScope: {
            assignedStoreIds: ["store-1"],
          },
        },
      },
      { period: "2026-06" },
    );

    expect(service.getSummary).toHaveBeenCalledWith({
      period: "2026-06",
      companyIds: [],
      regionIds: [],
      storeIds: ["store-1"],
      regionManagerUserId: "region-manager-1",
    });
  });

  it("sets download headers and returns the workbook as a raw streamable file", async () => {
    const { controller, service } = createController();
    const response = {
      setHeader: jest.fn(),
    };

    const result = await controller.downloadStoreMonthlyReportPackage(
      {
        user: {
          userId: "admin-1",
          roleCodes: ["SUPER_ADMIN"],
          scope: {
            companyIds: ["company-1"],
            regionIds: [],
            storeIds: [],
          },
          actionScope: {
            assignedStoreIds: [],
          },
        },
      },
      { period: "2026-06" },
      response,
    );

    expect(service.buildWorkbook).toHaveBeenCalledWith({
      period: "2026-06",
      companyIds: ["company-1"],
      regionIds: [],
      storeIds: [],
      regionManagerUserId: undefined,
    });
    expect(response.setHeader).toHaveBeenCalledWith(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      "Content-Disposition",
      'attachment; filename="magaza-izleyis-2026-06.xlsx"',
    );
    expect(result).toBeInstanceOf(StreamableFile);
    await expect(readStreamableFile(result)).resolves.toEqual(Buffer.from("xlsx"));
  });
});

async function readStreamableFile(file: StreamableFile): Promise<Buffer> {
  const chunks: Buffer[] = [];

  for await (const chunk of file.getStream()) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}
