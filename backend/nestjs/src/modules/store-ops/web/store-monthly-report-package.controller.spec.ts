import { ForbiddenException, StreamableFile } from "@nestjs/common";
import { StoreMonthlyReportPackageController } from "./store-monthly-report-package.controller";

describe("StoreMonthlyReportPackageController", () => {
  it.each([false, true])("restricts store manager %s exports to assigned stores even with company scope", async (download) => {
    const { controller, service } = createController();
    const request = { user: { userId: "sm-1", roleCodes: ["STORE_MANAGER"], scope: { companyIds: ["company-1"], regionIds: ["region-1"], storeIds: ["read-store"] }, actionScope: { assignedStoreIds: ["own-store"] } } };
    if (download) await controller.downloadStoreMonthlyReportPackage(request, { period: "2026-06" }, { setHeader: jest.fn() });
    else await controller.getStoreMonthlyReportPackage(request, { period: "2026-06" });
    expect(download ? service.buildWorkbook : service.getSummary).toHaveBeenCalledWith(expect.objectContaining({ companyIds: [], regionIds: [], storeIds: ["own-store"], regionManagerUserId: undefined }));
  });

  it("does not grant company access to a store manager with no assigned store", async () => {
    const { controller, service } = createController();
    await controller.getStoreMonthlyReportPackage({ user: { userId: "sm-1", roleCodes: ["STORE_MANAGER"], scope: { companyIds: ["company-1"], regionIds: ["region-1"], storeIds: [] }, actionScope: { assignedStoreIds: [] } } }, { period: "2026-06" });
    expect(service.getSummary).toHaveBeenCalledWith(expect.objectContaining({ companyIds: [], regionIds: [], storeIds: [], regionManagerUserId: undefined }));
  });

  it.each(["STORE_MANAGER", "REGION_MANAGER"])("rejects manager selection by %s", async role => {
    const { controller, service } = createController();
    const request = { user: { userId: "user-1", roleCodes: [role], scope: { companyIds: ["company-1"], regionIds: [], storeIds: ["own-store"] } } };
    await expect(controller.getStoreMonthlyReportPackage(request, { period: "2026-06", regionManagerUserId: "other-manager" })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.downloadStoreMonthlyReportPackage(request, { period: "2026-06", regionManagerUserId: "other-manager" }, { setHeader: jest.fn() })).rejects.toBeInstanceOf(ForbiddenException);
    expect(service.getSummary).not.toHaveBeenCalled();
    expect(service.buildWorkbook).not.toHaveBeenCalled();
  });

  it("uses the viewer's own company role scope for selected managers", async () => {
    const { controller, service } = createController();
    await controller.getStoreMonthlyReportPackage({ user: { userId: "viewer", roleCodes: ["REPORT_VIEWER", "SUPER_ADMIN"], scope: { companyIds: ["other-company"], regionIds: [], storeIds: [] }, roleScopes: { REPORT_VIEWER: { companyIds: ["viewer-company"], regionIds: [], storeIds: [] } } } }, { period: "2026-06", regionManagerUserId: "manager-1" });
    expect(service.getSummary).toHaveBeenCalledWith(expect.objectContaining({ companyIds: ["viewer-company"], regionIds: [], storeIds: [], requestedRegionManagerUserId: "manager-1" }));
  });
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
      rankingContext: {
        userId: "region-manager-1",
        employeeId: undefined,
        roleCodes: ["REGION_MANAGER"],
        companyIds: ["company-1"],
        regionIds: ["region-1"],
        storeIds: [],
        assignedStoreIds: ["store-1"],
      },
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
      rankingContext: {
        userId: "admin-1",
        employeeId: undefined,
        roleCodes: ["SUPER_ADMIN"],
        companyIds: ["company-1"],
        regionIds: [],
        storeIds: [],
        assignedStoreIds: [],
      },
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
