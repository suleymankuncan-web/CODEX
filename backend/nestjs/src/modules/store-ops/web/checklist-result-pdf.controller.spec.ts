import "reflect-metadata";
import { StreamableFile } from "@nestjs/common";
import { buildAuthenticatedUser } from "../../auth/auth-context.service";
import { REQUIRED_ROLES_KEY } from "../../auth/decorators/roles.decorator";
import { REQUIRED_SCOPE_KEY } from "../../auth/decorators/scope.decorator";
import { ChecklistResultPdfController } from "./checklist-result-pdf.controller";

const instanceId = "00000000-0000-4000-8000-000000000001";

describe("ChecklistResultPdfController.downloadChecklistResultPdf", () => {
  it("keeps the route authenticated and limited to Report Viewer or Region Manager", () => {
    const handler = ChecklistResultPdfController.prototype.downloadChecklistResultPdf;
    expect(Reflect.getMetadata(REQUIRED_SCOPE_KEY, handler)).toBe("authenticated");
    expect(Reflect.getMetadata(REQUIRED_ROLES_KEY, handler)).toEqual([
      "REGION_MANAGER",
      "REPORT_VIEWER",
    ]);
  });

  it("derives the Report Viewer company scope for mixed-role downloads and sets private PDF headers", async () => {
    const service = {
      exportChecklistResultPdf: jest.fn().mockResolvedValue({
        buffer: Buffer.from("%PDF-1.7 test"),
        fileName: "checklist-result-2026-08-20.pdf",
      }),
    };
    const controller = new ChecklistResultPdfController(service as never);
    const response = { setHeader: jest.fn() };
    const user = buildAuthenticatedUser({
      userId: "00000000-0000-4000-8000-000000000005",
      roleCodes: ["REGION_MANAGER", "REPORT_VIEWER"],
      readScope: {
        companyIds: ["manager-company"],
        regionIds: ["manager-region"],
        storeIds: ["manager-store"],
      },
      actionScope: { assignedStoreIds: ["manager-store"] },
      roleScopes: {
        REPORT_VIEWER: { companyIds: ["viewer-company"], regionIds: [], storeIds: [] },
      },
    });

    const result = await controller.downloadChecklistResultPdf(
      { user },
      instanceId,
      response,
    );

    expect(service.exportChecklistResultPdf).toHaveBeenCalledWith({
      checklistInstanceId: instanceId,
      actorScope: user.scope,
      actorActionScope: user.actionScope,
      actorRoleCodes: ["REGION_MANAGER", "REPORT_VIEWER"],
      actorReadScope: { companyIds: ["viewer-company"], regionIds: [], storeIds: [] },
    });
    expect(response.setHeader).toHaveBeenCalledWith("Content-Type", "application/pdf");
    expect(response.setHeader).toHaveBeenCalledWith(
      "Content-Disposition",
      "attachment; filename=\"checklist-result-2026-08-20.pdf\"; filename*=UTF-8''checklist-result-2026-08-20.pdf",
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      "private, no-store, max-age=0",
    );
    expect(response.setHeader).toHaveBeenCalledWith("Pragma", "no-cache");
    expect(response.setHeader).toHaveBeenCalledWith("Expires", "0");
    expect(response.setHeader).toHaveBeenCalledWith("Vary", "Authorization, Cookie");
    expect(response.setHeader).toHaveBeenCalledWith("X-Content-Type-Options", "nosniff");
    expect(response.setHeader).toHaveBeenCalledWith("Content-Length", String(Buffer.from("%PDF-1.7 test").length));
    expect(result).toBeInstanceOf(StreamableFile);
    await expect(readStreamableFile(result as StreamableFile)).resolves.toEqual(
      Buffer.from("%PDF-1.7 test"),
    );
  });

  it("keeps pure Region Manager downloads on their existing scope", async () => {
    const service = {
      exportChecklistResultPdf: jest.fn().mockResolvedValue({
        buffer: Buffer.from("%PDF-1.7 test"),
        fileName: "checklist-result-2026-08-20.pdf",
      }),
    };
    const controller = new ChecklistResultPdfController(service as never);
    const user = buildAuthenticatedUser({
      userId: "00000000-0000-4000-8000-000000000005",
      roleCodes: ["REGION_MANAGER"],
      readScope: { companyIds: [], regionIds: ["region-1"], storeIds: [] },
      actionScope: { assignedStoreIds: ["store-1"] },
    });

    await controller.downloadChecklistResultPdf(
      { user },
      instanceId,
      { setHeader: jest.fn() },
    );

    expect(service.exportChecklistResultPdf).toHaveBeenCalledWith({
      checklistInstanceId: instanceId,
      actorScope: user.scope,
      actorActionScope: user.actionScope,
      actorRoleCodes: ["REGION_MANAGER"],
    });
  });
});

async function readStreamableFile(file: StreamableFile) {
  const chunks: Buffer[] = [];
  for await (const chunk of file.getStream()) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}
