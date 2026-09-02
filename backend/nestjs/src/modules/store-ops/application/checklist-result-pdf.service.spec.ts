import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { ChecklistService } from "./checklist.service";
import { ChecklistResultPdfRenderer } from "./checklist-result-pdf.renderer";
import { ChecklistResultPdfService } from "./checklist-result-pdf.service";

const instanceId = "00000000-0000-4000-8000-000000000001";

function completedResult(overrides: Record<string, unknown> = {}) {
  return {
    checklistInstanceId: instanceId,
    checklistTemplateId: "00000000-0000-4000-8000-000000000002",
    templateName: "BM Store Visit",
    templateType: "BM_STORE_VISIT",
    category: "Marka",
    storeId: "00000000-0000-4000-8000-000000000003",
    storeName: "Marmara Park",
    completedByUserId: "00000000-0000-4000-8000-000000000004",
    completedByDisplayName: "Ayşe Yılmaz",
    completedAt: "2026-08-20T10:30:00.000Z",
    status: "completed",
    totalScore: 86,
    complianceRate: 0.86,
    responses: [],
    acknowledgement: null,
    ...overrides,
  };
}

function createService(overrides: {
  page?: { items: unknown[]; total: number };
  render?: jest.Mock;
} = {}) {
  const listChecklistAcknowledgements = jest.fn().mockResolvedValue(
    overrides.page ?? { items: [completedResult()], total: 1 },
  );
  const checklistService = {
    listChecklistAcknowledgements,
  } as unknown as ChecklistService;
  const renderer = {
    render: overrides.render ?? jest.fn().mockResolvedValue(Buffer.from("%PDF-1.7")),
    fileName: jest.fn().mockReturnValue("checklist-result-2026-08-20.pdf"),
  } as unknown as ChecklistResultPdfRenderer;
  const service = new ChecklistResultPdfService(checklistService, renderer);
  return { service, listChecklistAcknowledgements, renderer };
}

const managerScope = {
  companyIds: ["manager-company"],
  regionIds: ["manager-region"],
  storeIds: ["manager-store"],
};

describe("ChecklistResultPdfService", () => {
  it("uses the Report Viewer company scope for mixed Report Viewer and Region Manager actors", async () => {
    const { service, listChecklistAcknowledgements } = createService();

    await service.exportChecklistResultPdf({
      checklistInstanceId: instanceId,
      actorScope: managerScope,
      actorReadScope: {
        companyIds: ["viewer-company"],
        regionIds: [],
        storeIds: [],
      },
      actorActionScope: { assignedStoreIds: ["manager-store"] },
      actorRoleCodes: ["REPORT_VIEWER", "REGION_MANAGER"],
    });

    expect(listChecklistAcknowledgements).toHaveBeenCalledTimes(1);
    expect(listChecklistAcknowledgements).toHaveBeenCalledWith({
      actorScope: managerScope,
      actorReadScope: {
        companyIds: ["viewer-company"],
        regionIds: [],
        storeIds: [],
      },
      actorActionScope: { assignedStoreIds: ["manager-store"] },
      actorRoleCodes: ["REPORT_VIEWER", "REGION_MANAGER"],
      checklistInstanceId: instanceId,
      includeResponses: true,
      limit: 1,
      offset: 0,
    });
  });

  it("uses the existing list method for pure Region Manager scope and template allowlist", async () => {
    const { service, listChecklistAcknowledgements } = createService();
    const input = {
      checklistInstanceId: instanceId,
      actorScope: { companyIds: [], regionIds: ["region-1"], storeIds: [] },
      actorActionScope: { assignedStoreIds: ["store-1", "store-2"] },
      actorRoleCodes: ["REGION_MANAGER"],
    };

    await service.exportChecklistResultPdf(input);

    expect(listChecklistAcknowledgements).toHaveBeenCalledWith({
      ...input,
      checklistInstanceId: instanceId,
      includeResponses: true,
      limit: 1,
      offset: 0,
    });
  });

  it.each(["STORE_MANAGER", "VISUAL_MERCHANDISER", "AUDITOR", "SUPER_ADMIN"])(
    "forbids non-export role %s without querying the list service",
    async (roleCode) => {
      const { service, listChecklistAcknowledgements } = createService();

      await expect(
        service.exportChecklistResultPdf({
          checklistInstanceId: instanceId,
          actorScope: { companyIds: [], regionIds: [], storeIds: ["store-1"] },
          actorRoleCodes: [roleCode],
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(listChecklistAcknowledgements).not.toHaveBeenCalled();
    },
  );

  it("returns one indistinguishable not-found result for missing, incomplete, mismatched, or null-dated rows", async () => {
    for (const page of [
      { items: [], total: 0 },
      { items: [completedResult({ status: "pending_acknowledgement" })], total: 1 },
      { items: [completedResult({ checklistInstanceId: "00000000-0000-4000-8000-000000000099" })], total: 1 },
      { items: [completedResult({ completedAt: null })], total: 1 },
      { items: [completedResult({ completedAt: "not-a-date" })], total: 1 },
    ]) {
      const { service } = createService({ page });
      await expect(
        service.exportChecklistResultPdf({
          checklistInstanceId: instanceId,
          actorScope: { companyIds: ["company-1"], regionIds: [], storeIds: [] },
          actorRoleCodes: ["REPORT_VIEWER"],
          actorReadScope: { companyIds: ["company-1"], regionIds: [], storeIds: [] },
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    }
  });

  it("rejects malformed ids before any scoped list lookup", async () => {
    const { service, listChecklistAcknowledgements } = createService();

    await expect(
      service.exportChecklistResultPdf({
        checklistInstanceId: "not-a-uuid",
        actorScope: { companyIds: ["company-1"], regionIds: [], storeIds: [] },
        actorRoleCodes: ["REPORT_VIEWER"],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(listChecklistAcknowledgements).not.toHaveBeenCalled();
  });

  it("maps renderer failures to JSON-safe 500 errors", async () => {
    const render = jest.fn().mockRejectedValue(new Error("font failure"));
    const { service } = createService({ render });

    await expect(
      service.exportChecklistResultPdf({
        checklistInstanceId: instanceId,
        actorScope: { companyIds: ["company-1"], regionIds: [], storeIds: [] },
        actorRoleCodes: ["REPORT_VIEWER"],
        actorReadScope: { companyIds: ["company-1"], regionIds: [], storeIds: [] },
      }),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });
});
