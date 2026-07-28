import { ForbiddenException, ServiceUnavailableException } from "@nestjs/common";
import { VmReferenceManagementService } from "./vm-reference-management.service";

const publisher = {
  actorUserId: "user-1",
  actorRoleCodes: ["VISUAL_MERCHANDISER"],
  actorScope: { companyIds: ["company-1"], regionIds: [], storeIds: [] },
  actorActionScope: { assignedStoreIds: [] },
  actorPermissionScopes: {
    VM_REFERENCE_PUBLISHER: { companyIds: ["company-1"], regionIds: [], storeIds: [] },
    VM_CAMPAIGN_WINDOW_AUTHORITY: { companyIds: ["company-1"], regionIds: [], storeIds: [] },
    VM_CAMPAIGN_SCOPE_AUTHORITY: { companyIds: ["company-1"], regionIds: [], storeIds: [] },
    VM_CAMPAIGN_EMERGENCY_AUTHORITY: { companyIds: ["company-1"], regionIds: [], storeIds: [] },
  },
};

describe("VmReferenceManagementService", () => {
  const repository = {
    createDraft: jest.fn(async (input) => input),
    createReferenceUploadIntent: jest.fn(async () => undefined),
    hasReferenceUploadIntent: jest.fn(async () => true),
    publish: jest.fn(async (input) => input),
    listPublisherReferences: jest.fn(async () => []),
    listPublisherOptions: jest.fn(async () => ({ stores: [], templates: [] })),
    listReviewerCampaigns: jest.fn(async () => []),
    listStoreAssignments: jest.fn(async () => []),
    getAssignmentScope: jest.fn(async () => ({ storeId: "store-1" })),
    getAssignmentReferenceAsset: jest.fn(async () => ({ mediaAssetId: "asset-1" })),
    createSubmissionUploadIntent: jest.fn(async () => undefined),
    hasSubmissionUploadIntent: jest.fn(async () => true),
    submit: jest.fn(async (input) => input),
    settleDueAssignments: jest.fn(async () => ({ opened: 0, missed: 0 })),
    reviseCampaign: jest.fn(async (input) => input),
    changeAssignmentState: jest.fn(async (input) => input),
    retireReference: jest.fn(async (input) => input),
  };
  const media = {
    initiateApprovedSyntheticFixtureUpload: jest.fn(async () => ({ mediaAssetId: "asset-1", state: "uploaded" })),
    finalizeSyntheticUpload: jest.fn(async () => ({ mediaAssetId: "asset-1", state: "ready" })),
  };
  const config = {
    vmReferencePublishingEnabled: true,
    vmCampaignSubmissionEnabled: true,
    vmCampaignDeadlineSettlementEnabled: true,
    photoMediaStorageEnabled: true,
    checklistEvidenceStorageHealthy: true,
  };

  beforeEach(() => jest.clearAllMocks());

  it("[FR-08][AC-02] requires both VM persona and company-scoped publisher permission", async () => {
    const service = new VmReferenceManagementService(repository as never, repository as never, media as never, config as never);
    await expect(service.createDraft({
      ...publisher,
      actorPermissionScopes: {},
      companyId: "company-1",
      referenceCode: "WINDOW-A",
      referenceName: "Vitrin A",
      instructions: "Referans yerleşim",
    })).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.createDraft).not.toHaveBeenCalled();
  });

  it("[FR-08][AC-07] publishes only empty variants and exactly one required asset", async () => {
    const service = new VmReferenceManagementService(repository as never, repository as never, media as never, config as never);
    await service.publish({
      ...publisher,
      companyId: "company-1",
      referenceSetId: "reference-1",
      expectedRevision: 0,
      idempotencyKey: "00000000-0000-4000-8000-000000000001",
      startsOn: "2026-07-05",
      endsOn: "2026-07-10",
      storeIds: ["store-1"],
      reason: "İlk yayın",
    });
    expect(repository.publish).toHaveBeenCalledWith(expect.objectContaining({
      requiredEvidenceCount: 1,
      allowedVariants: [],
      timezone: "Europe/Istanbul",
    }));
  });

  it("[FR-15][AC-15] binds a store campaign upload to the fresh own-store assignment", async () => {
    const service = new VmReferenceManagementService(repository as never, repository as never, media as never, config as never);
    await service.uploadCampaignEvidence({
      actorUserId: "manager-1",
      actorRoleCodes: ["STORE_MANAGER"],
      actorScope: { companyIds: ["company-1"], regionIds: ["region-1"], storeIds: ["store-1"] },
      actorActionScope: { assignedStoreIds: ["store-1"] },
      actorPermissionScopes: {},
      assignmentId: "assignment-1",
      referenceItemId: "item-1",
      contentType: "image/png",
      contentLength: 3,
      contentBody: Buffer.from("abc"),
    });
    expect(media.initiateApprovedSyntheticFixtureUpload).toHaveBeenCalledWith(expect.objectContaining({
      storeId: "store-1",
      classification: "vm_campaign_evidence",
    }));
    expect(repository.createSubmissionUploadIntent).toHaveBeenCalled();
  });

  it("[AC-14] fails closed while every PR6 runtime flag is disabled", async () => {
    const service = new VmReferenceManagementService(repository as never, repository as never, media as never, {
      ...config,
      vmReferencePublishingEnabled: false,
    } as never);
    await expect(service.createDraft({
      ...publisher,
      companyId: "company-1",
      referenceCode: "WINDOW-A",
      referenceName: "Vitrin A",
      instructions: "Referans yerleşim",
    })).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("[AC-19][EC-18] sends publisher lifecycle commands through the guarded repository boundary", async () => {
    const service = new VmReferenceManagementService(repository as never, repository as never, media as never, config as never);
    await service.reviseCampaign({ ...publisher, companyId: "company-1", referenceSetId: "reference-1",
      command: "extend", expectedRevision: 1, idempotencyKey: "00000000-0000-4000-8000-000000000003",
      reason: "Saha uygulaması için ek süre", startsOn: "2026-07-05", endsOn: "2026-07-12", storeIds: [] });
    expect(repository.reviseCampaign).toHaveBeenCalledWith(expect.objectContaining({ command: "extend" }));

    await service.changeAssignmentState({ ...publisher, companyId: "company-1", referenceSetId: "reference-1",
      assignmentId: "assignment-1", command: "hold", expectedVersion: 0,
      idempotencyKey: "00000000-0000-4000-8000-000000000004", reason: "Operasyon güvenliği" });
    expect(repository.changeAssignmentState).toHaveBeenCalledWith(expect.objectContaining({ command: "hold" }));
  });

  it("[AC-02][AC-19] denies lifecycle commands without their exact company authority", async () => {
    const service = new VmReferenceManagementService(repository as never, repository as never, media as never, config as never);
    await expect(service.reviseCampaign({ ...publisher,
      actorPermissionScopes: { VM_REFERENCE_PUBLISHER: publisher.actorPermissionScopes.VM_REFERENCE_PUBLISHER },
      companyId: "company-1", referenceSetId: "reference-1", command: "extend",
      expectedRevision: 1, idempotencyKey: "00000000-0000-4000-8000-000000000005",
      reason: "Yetki ayrımı", startsOn: "2026-07-05", endsOn: "2026-07-12", storeIds: [],
    })).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.reviseCampaign).not.toHaveBeenCalled();
  });

  it("[AC-02][EC-18] denies scope and emergency commands without their distinct authorities", async () => {
    const service = new VmReferenceManagementService(repository as never, repository as never, media as never, config as never);
    const publisherOnly = { ...publisher,
      actorPermissionScopes: { VM_REFERENCE_PUBLISHER: publisher.actorPermissionScopes.VM_REFERENCE_PUBLISHER } };
    await expect(service.reviseCampaign({ ...publisherOnly,
      companyId: "company-1", referenceSetId: "reference-1", command: "scope_add",
      expectedRevision: 1, idempotencyKey: "00000000-0000-4000-8000-000000000006",
      reason: "Kapsam ayrımı", startsOn: "2026-07-05", endsOn: "2026-07-12", storeIds: ["store-2"],
    })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.changeAssignmentState({ ...publisherOnly,
      companyId: "company-1", referenceSetId: "reference-1", assignmentId: "assignment-1",
      command: "withdraw", expectedVersion: 0,
      idempotencyKey: "00000000-0000-4000-8000-000000000007", reason: "Kapsam ayrımı",
    })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.changeAssignmentState({ ...publisherOnly,
      companyId: "company-1", referenceSetId: "reference-1", assignmentId: "assignment-1",
      command: "hold", expectedVersion: 0,
      idempotencyKey: "00000000-0000-4000-8000-000000000008", reason: "Acil durum ayrımı",
    })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.retireReference({ ...publisherOnly,
      companyId: "company-1", referenceSetId: "reference-1", expectedRevision: 1,
      idempotencyKey: "00000000-0000-4000-8000-000000000009", reason: "Acil durum ayrımı",
    })).rejects.toBeInstanceOf(ForbiddenException);
  });
});
