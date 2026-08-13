import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";
import { ChecklistService } from "./checklist.service";

describe("ChecklistService", () => {
  const storeOpsRepository = {};
  const checklistAcknowledgementRepository = {};
  const superAdminActor = {
    actorRoleCodes: ["SUPER_ADMIN"],
    actorReadScope: {
      companyIds: [],
      regionIds: [],
      storeIds: [],
    },
  };
  const hrCompanyActor = {
    actorRoleCodes: ["HR_ADMIN"],
    actorReadScope: {
      companyIds: ["company-1"],
      regionIds: [],
      storeIds: [],
    },
  };

  function createService(checklistRepository: {
    getDraftTemplateForPublish?: jest.Mock;
    publishTemplate?: jest.Mock;
    createTemplate?: jest.Mock;
    getPublishedTemplateForStore?: jest.Mock;
    startMobileChecklistInstance?: jest.Mock;
    getMobileChecklistInstanceScope?: jest.Mock;
    saveMobileChecklistResponse?: jest.Mock;
    calculateMobileChecklistCompletion?: jest.Mock;
    completeMobileChecklistInstance?: jest.Mock;
    getMobileChecklistToday?: jest.Mock;
  }) {
    return new ChecklistService(
      storeOpsRepository as never,
      checklistAcknowledgementRepository as never,
      checklistRepository as never,
    );
  }

  function draftTemplate(overrides?: {
    companyId?: string;
    effectiveFrom?: string;
    effectiveTo?: string | null;
    weights?: number[];
  }) {
    return {
      checklistTemplateId: "template-1",
      companyId: overrides?.companyId ?? "company-1",
      effectiveFrom: overrides?.effectiveFrom ?? "2026-05-01",
      effectiveTo: overrides?.effectiveTo ?? null,
      items: (overrides?.weights ?? [60, 40]).map((weight, index) => ({
        templateItemId: `item-${index + 1}`,
        weight,
      })),
    };
  }

  it("keeps store manager checklist acknowledgement lists limited to assigned stores even when company scope is present", async () => {
    const acknowledgementRepository = {
      listChecklistAcknowledgements: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    };
    const service = new ChecklistService(
      storeOpsRepository as never,
      acknowledgementRepository as never,
      {} as never,
    );

    await service.listChecklistAcknowledgements({
      actorScope: {
        companyIds: ["company-1"],
        regionIds: ["region-1"],
        storeIds: ["store-1"],
      },
      actorActionScope: {
        assignedStoreIds: ["store-1"],
      },
      actorRoleCodes: ["STORE_MANAGER"],
    });

    expect(acknowledgementRepository.listChecklistAcknowledgements).toHaveBeenCalledWith({
      companyIds: [],
      regionIds: [],
      storeIds: ["store-1"],
      allowedTemplateTypes: ["BM_STORE_VISIT", "VM_STORE_VISIT"],
      includeResponses: true,
      limit: 50,
      offset: 0,
    });
  });

  it("lets region managers read BM and VM checklist results for their assigned stores", async () => {
    const acknowledgementRepository = {
      listChecklistAcknowledgements: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    };
    const service = new ChecklistService(
      storeOpsRepository as never,
      acknowledgementRepository as never,
      {} as never,
    );

    await service.listChecklistAcknowledgements({
      actorScope: {
        companyIds: [],
        regionIds: ["region-1"],
        storeIds: [],
      },
      actorActionScope: {
        assignedStoreIds: ["store-1", "store-2"],
      },
      actorRoleCodes: ["REGION_MANAGER"],
    });

    expect(acknowledgementRepository.listChecklistAcknowledgements).toHaveBeenCalledWith({
      companyIds: [],
      regionIds: [],
      storeIds: ["store-1", "store-2"],
      allowedTemplateTypes: ["BM_STORE_VISIT", "VM_STORE_VISIT"],
      includeResponses: true,
      limit: 50,
      offset: 0,
    });
  });

  it("passes the existing authenticated checklist content route to photo read-url creation", async () => {
    const checklistRepository = {
      getMobileChecklistInstanceScope: jest.fn().mockResolvedValue({
        storeId: "44444444-4444-4444-8444-444444444444",
        templateType: "BM_STORE_VISIT",
        status: "in_progress",
      }),
      assertMobileChecklistItemEvidenceLink: jest.fn().mockResolvedValue(undefined),
    };
    const photoMediaStorageService = {
      createSignedRead: jest.fn().mockResolvedValue({ url: "signed", expiresInSeconds: 120 }),
    };
    const service = new ChecklistService(
      storeOpsRepository as never,
      checklistAcknowledgementRepository as never,
      checklistRepository as never,
      undefined,
      undefined,
      photoMediaStorageService as never,
    );
    const checklistInstanceId = "11111111-1111-4111-8111-111111111111";
    const templateItemId = "22222222-2222-4222-8222-222222222222";
    const mediaAssetId = "33333333-3333-4333-8333-333333333333";

    await service.readMobileChecklistItemEvidence({
      checklistInstanceId,
      templateItemId,
      mediaAssetId,
      variant: "thumbnail",
      actorUserId: "55555555-5555-4555-8555-555555555555",
      actorRoleCodes: ["REGION_MANAGER"],
      actorScope: { companyIds: [], regionIds: [], storeIds: ["44444444-4444-4444-8444-444444444444"] },
      actorActionScope: { assignedStoreIds: ["44444444-4444-4444-8444-444444444444"] },
    });

    expect(photoMediaStorageService.createSignedRead).toHaveBeenCalledWith(expect.objectContaining({
      mediaAssetId,
      contentPath: `/api/mobile/checklists/instances/${checklistInstanceId}/items/${templateItemId}/evidence/${mediaAssetId}/content/thumbnail`,
    }));
  });

  it("creates checklist remediation action plans from acknowledged non-compliant rows", async () => {
    const acknowledgementRepository = {
      getChecklistInstanceScope: jest.fn().mockResolvedValue({
        checklistInstanceId: "instance-1",
        storeId: "store-1",
      }),
      acknowledgeChecklist: jest.fn().mockResolvedValue({
        checklistAcknowledgementId: "ack-1",
        acknowledgedByUserId: "user-1",
        acknowledgementNote: "Kabul edildi",
        acknowledgedAt: "2026-05-20T12:36:00.000Z",
      }),
      getChecklistRemediationSource: jest.fn().mockResolvedValue({
        checklistInstanceId: "instance-1",
        checklistTemplateId: "template-1",
        templateName: "BM Store Visit",
        templateType: "BM_STORE_VISIT",
        category: "BM",
        storeId: "store-1",
        storeName: "Bursa Marka Park",
        completedAt: "2026-05-20T12:00:00.000Z",
        responses: [
          {
            templateItemId: "item-1",
            sectionName: "Kasa",
            itemNo: 3,
            itemText: "Kasa duzeni standartlara uygun mu?",
            responseType: "score",
            weight: 20,
            maxScore: 10,
            scoreValue: 2,
            commentText: "Kasa alani duzensiz",
            isNonCompliant: true,
          },
          {
            templateItemId: "item-2",
            sectionName: "Ekip",
            itemNo: 4,
            itemText: "Ekip standartlari uygun mu?",
            responseType: "yes_no",
            weight: 10,
            maxScore: 1,
            scoreValue: 1,
            commentText: null,
            isNonCompliant: false,
          },
        ],
      }),
    };
    const storeActionPlanService = {
      createPlan: jest.fn().mockResolvedValue({ command: { status: "created" } }),
    };
    const service = new ChecklistService(
      storeOpsRepository as never,
      acknowledgementRepository as never,
      {} as never,
      storeActionPlanService as never,
    );

    const result = await service.acknowledgeChecklist({
      checklistInstanceId: "instance-1",
      actorUserId: "user-1",
      actorActionScope: {
        assignedStoreIds: ["store-1"],
      },
      acknowledgementNote: "Kabul edildi",
    });

    expect(result.command.status).toBe("acknowledged");
    expect(result.data.remediation).toEqual({
      status: "created", createdCount: 1, duplicateCount: 0, blockedCount: 0,
    });
    expect(acknowledgementRepository.acknowledgeChecklist).toHaveBeenCalledWith({
      checklistInstanceId: "instance-1",
      actorUserId: "user-1",
      acknowledgementNote: "Kabul edildi",
    });
    expect(storeActionPlanService.createPlan).toHaveBeenCalledTimes(1);
    expect(storeActionPlanService.createPlan).toHaveBeenCalledWith({
      actorUserId: "user-1",
      actorScope: {
        companyIds: [],
        regionIds: [],
        storeIds: ["store-1"],
      },
      actorActionScope: {
        assignedStoreIds: ["store-1"],
      },
      storeId: "store-1",
      sourceType: "checklist_remediation",
      sourceId: "checklist:instance-1:item:item-1",
      sourceDeepLink: "/store/checklists?overlay=result&checklistInstanceId=instance-1",
      title: "Kasa checklist bulgusu",
      summary:
        "BM Store Visit - Kasa duzeni standartlara uygun mu? - Not: Kasa alani duzensiz",
      priority: "high",
      dueOn: "2026-05-27",
      trustedChecklistFinding: {
        checklistInstanceId: "instance-1",
        templateItemId: "item-1",
      },
    });
  });

  it("does not create checklist remediation plans when acknowledged rows are compliant", async () => {
    const acknowledgementRepository = {
      getChecklistInstanceScope: jest.fn().mockResolvedValue({
        checklistInstanceId: "instance-1",
        storeId: "store-1",
      }),
      acknowledgeChecklist: jest.fn().mockResolvedValue({
        checklistAcknowledgementId: "ack-1",
        acknowledgedByUserId: "user-1",
        acknowledgementNote: null,
        acknowledgedAt: "2026-05-20T12:36:00.000Z",
      }),
      getChecklistRemediationSource: jest.fn().mockResolvedValue({
        checklistInstanceId: "instance-1",
        checklistTemplateId: "template-1",
        templateName: "BM Store Visit",
        templateType: "BM_STORE_VISIT",
        category: "BM",
        storeId: "store-1",
        storeName: "Bursa Marka Park",
        completedAt: "2026-05-20T12:00:00.000Z",
        responses: [
          {
            templateItemId: "item-1",
            sectionName: "Kasa",
            itemNo: 3,
            itemText: "Kasa duzeni standartlara uygun mu?",
            responseType: "score",
            weight: 20,
            maxScore: 10,
            scoreValue: 10,
            commentText: null,
            isNonCompliant: false,
          },
        ],
      }),
    };
    const storeActionPlanService = {
      createPlan: jest.fn(),
    };
    const service = new ChecklistService(
      storeOpsRepository as never,
      acknowledgementRepository as never,
      {} as never,
      storeActionPlanService as never,
    );

    const result = await service.acknowledgeChecklist({
      checklistInstanceId: "instance-1",
      actorUserId: "user-1",
      actorActionScope: {
        assignedStoreIds: ["store-1"],
      },
    });

    expect(storeActionPlanService.createPlan).not.toHaveBeenCalled();
    expect(result.data.remediation).toEqual({
      status: "zero_findings", createdCount: 0, duplicateCount: 0, blockedCount: 0,
    });
  });

  it("reports blocked remediation when the acknowledged checklist source is missing", async () => {
    const acknowledgementRepository = {
      getChecklistInstanceScope: jest.fn().mockResolvedValue({
        checklistInstanceId: "instance-1", storeId: "store-1",
      }),
      acknowledgeChecklist: jest.fn().mockResolvedValue({
        checklistAcknowledgementId: "ack-1",
        acknowledgedByUserId: "user-1",
        acknowledgementNote: null,
        acknowledgedAt: "2026-05-20T12:36:00.000Z",
      }),
      getChecklistRemediationSource: jest.fn().mockResolvedValue(null),
    };
    const storeActionPlanService = { createPlan: jest.fn() };
    const service = new ChecklistService(
      storeOpsRepository as never,
      acknowledgementRepository as never,
      {} as never,
      storeActionPlanService as never,
    );

    const result = await service.acknowledgeChecklist({
      checklistInstanceId: "instance-1",
      actorUserId: "user-1",
      actorActionScope: { assignedStoreIds: ["store-1"] },
    });

    expect(result.data.remediation).toEqual({
      status: "blocked", createdCount: 0, duplicateCount: 0, blockedCount: 1,
    });
    expect(storeActionPlanService.createPlan).not.toHaveBeenCalled();
  });

  it("keeps checklist acknowledgement idempotent when remediation source already has an active plan", async () => {
    const acknowledgementRepository = {
      getChecklistInstanceScope: jest.fn().mockResolvedValue({
        checklistInstanceId: "instance-1",
        storeId: "store-1",
      }),
      acknowledgeChecklist: jest.fn().mockResolvedValue({
        checklistAcknowledgementId: "ack-1",
        acknowledgedByUserId: "user-1",
        acknowledgementNote: null,
        acknowledgedAt: "2026-05-20T12:36:00.000Z",
      }),
      getChecklistRemediationSource: jest.fn().mockResolvedValue({
        checklistInstanceId: "instance-1",
        checklistTemplateId: "template-1",
        templateName: "BM Store Visit",
        templateType: "BM_STORE_VISIT",
        category: "BM",
        storeId: "store-1",
        storeName: "Bursa Marka Park",
        completedAt: "2026-05-20T12:00:00.000Z",
        responses: [
          {
            templateItemId: "item-1",
            sectionName: "Kasa",
            itemNo: 3,
            itemText: "Kasa duzeni standartlara uygun mu?",
            responseType: "score",
            weight: 20,
            maxScore: 10,
            scoreValue: 2,
            commentText: null,
            isNonCompliant: true,
          },
        ],
      }),
    };
    const storeActionPlanService = {
      createPlan: jest
        .fn()
        .mockRejectedValue(
          new ConflictException("Active store action plan already exists for this source"),
        ),
    };
    const service = new ChecklistService(
      storeOpsRepository as never,
      acknowledgementRepository as never,
      {} as never,
      storeActionPlanService as never,
    );

    const result = await (
      service.acknowledgeChecklist({
        checklistInstanceId: "instance-1",
        actorUserId: "user-1",
        actorActionScope: {
          assignedStoreIds: ["store-1"],
        },
      })
    );

    expect(storeActionPlanService.createPlan).toHaveBeenCalledTimes(1);
    expect(result.data.remediation).toEqual({
      status: "duplicate", createdCount: 0, duplicateCount: 1, blockedCount: 0,
    });
  });

  it("retries partial remediation without due-date drift or duplicate plans", async () => {
    const acknowledgement = {
      checklistAcknowledgementId: "ack-1",
      acknowledgedByUserId: "user-1",
      acknowledgementNote: null,
      acknowledgedAt: "2026-05-20T12:36:00.000Z",
    };
    const acknowledgementRepository = {
      getChecklistInstanceScope: jest.fn().mockResolvedValue({
        checklistInstanceId: "instance-1", storeId: "store-1",
      }),
      acknowledgeChecklist: jest.fn().mockResolvedValue(acknowledgement),
      getChecklistRemediationSource: jest.fn().mockResolvedValue({
        checklistInstanceId: "instance-1",
        checklistTemplateId: "template-1",
        templateName: "BM Store Visit",
        templateType: "BM_STORE_VISIT",
        category: "BM",
        storeId: "store-1",
        storeName: "Bursa Marka Park",
        completedAt: "2026-05-20T12:00:00.000Z",
        responses: [
          { templateItemId: "item-1", sectionName: "Kasa", itemNo: 1, itemText: "Kasa", responseType: "score", weight: 50, maxScore: 10, scoreValue: 2, commentText: null, isNonCompliant: true },
          { templateItemId: "item-2", sectionName: "Vitrin", itemNo: 2, itemText: "Vitrin", responseType: "score", weight: 50, maxScore: 10, scoreValue: 3, commentText: null, isNonCompliant: true },
        ],
      }),
    };
    const storeActionPlanService = {
      createPlan: jest.fn()
        .mockResolvedValueOnce({ command: { status: "created" } })
        .mockRejectedValueOnce(new Error("transient plan write failure"))
        .mockRejectedValueOnce(new ConflictException("Active store action plan already exists for this source"))
        .mockResolvedValueOnce({ command: { status: "created" } }),
    };
    const service = new ChecklistService(
      storeOpsRepository as never,
      acknowledgementRepository as never,
      {} as never,
      storeActionPlanService as never,
    );
    const command = {
      checklistInstanceId: "instance-1",
      actorUserId: "user-1",
      actorActionScope: { assignedStoreIds: ["store-1"] },
    };

    await expect(service.acknowledgeChecklist(command)).rejects.toThrow("transient plan write failure");
    const retry = await service.acknowledgeChecklist(command);

    expect(retry.data.remediation).toEqual({
      status: "created", createdCount: 1, duplicateCount: 1, blockedCount: 0,
    });
    expect(acknowledgementRepository.acknowledgeChecklist).toHaveBeenCalledTimes(2);
    expect(storeActionPlanService.createPlan).toHaveBeenCalledTimes(4);
    expect(storeActionPlanService.createPlan.mock.calls.map(([input]) => input.dueOn)).toEqual([
      "2026-05-27", "2026-05-27", "2026-05-27", "2026-05-27",
    ]);
  });

  it("does not acknowledge or create remediation outside assigned stores", async () => {
    const acknowledgementRepository = {
      getChecklistInstanceScope: jest.fn().mockResolvedValue({
        checklistInstanceId: "instance-1",
        storeId: "store-2",
      }),
      acknowledgeChecklist: jest.fn(),
      getChecklistRemediationSource: jest.fn(),
    };
    const storeActionPlanService = {
      createPlan: jest.fn(),
    };
    const service = new ChecklistService(
      storeOpsRepository as never,
      acknowledgementRepository as never,
      {} as never,
      storeActionPlanService as never,
    );

    await expect(
      service.acknowledgeChecklist({
        checklistInstanceId: "instance-1",
        actorUserId: "user-1",
        actorActionScope: {
          assignedStoreIds: ["store-1"],
        },
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(acknowledgementRepository.acknowledgeChecklist).not.toHaveBeenCalled();
    expect(acknowledgementRepository.getChecklistRemediationSource).not.toHaveBeenCalled();
    expect(storeActionPlanService.createPlan).not.toHaveBeenCalled();
  });

  it("lets region managers read BM and VM checklist visit coverage without granting VM mutation", async () => {
    const checklistRepository = {
      getMobileChecklistToday: jest.fn().mockResolvedValue({
        stores: [],
        templates: [],
        activeInstances: [],
        completedThisMonth: [],
        pendingAcknowledgements: [],
        monthlySummaries: [],
      }),
    };
    const service = createService(checklistRepository);

    await service.getMobileChecklistToday({
      actorUserId: "region-user-1",
      actorScope: {
        companyIds: [],
        regionIds: ["region-1"],
        storeIds: ["store-1"],
      },
      actorActionScope: {
        assignedStoreIds: ["store-1"],
      },
      actorRoleCodes: ["REGION_MANAGER"],
    });

    expect(checklistRepository.getMobileChecklistToday).toHaveBeenCalledWith({
      actorUserId: "region-user-1",
      assignedStoreIds: ["store-1"],
      readStoreIds: ["store-1"],
      readRegionIds: ["region-1"],
      readCompanyIds: [],
      allowedTemplateTypes: ["BM_STORE_VISIT", "VM_STORE_VISIT"],
    });
  });

  it("reports capture unavailable when no approved synthetic fixture digest is configured", async () => {
    const checklistRepository = {
      getMobileChecklistToday: jest.fn().mockResolvedValue({
        stores: [], templates: [], activeInstances: [], completedThisMonth: [],
        pendingAcknowledgements: [], monthlySummaries: [],
      }),
    };
    const service = new ChecklistService(
      storeOpsRepository as never,
      checklistAcknowledgementRepository as never,
      checklistRepository as never,
      undefined,
      {
        checklistEvidenceCaptureEnabled: true,
        checklistEvidenceStorageHealthy: true,
        photoMediaStorageEnabled: true,
        photoMediaSyntheticFixtureSha256Allowlist: [],
      } as never,
    );

    await expect(service.getMobileChecklistToday({
      actorUserId: "region-user-1",
      actorScope: { companyIds: [], regionIds: [], storeIds: ["store-1"] },
      actorActionScope: { assignedStoreIds: ["store-1"] },
      actorRoleCodes: ["REGION_MANAGER"],
    })).resolves.toMatchObject({
      data: {
        evidenceCapabilities: {
          captureAvailable: false,
          syntheticFixtureOnly: true,
          unavailableReason: "synthetic_fixture_unavailable",
        },
      },
    });
  });

  it("limits visual merchandisers to VM checklist results", async () => {
    const acknowledgementRepository = {
      listChecklistAcknowledgements: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    };
    const service = new ChecklistService(
      storeOpsRepository as never,
      acknowledgementRepository as never,
      {} as never,
    );

    await service.listChecklistAcknowledgements({
      actorScope: {
        companyIds: [],
        regionIds: [],
        storeIds: ["store-1"],
      },
      actorActionScope: {
        assignedStoreIds: ["store-1"],
      },
      actorRoleCodes: ["VISUAL_MERCHANDISER"],
    });

    expect(acknowledgementRepository.listChecklistAcknowledgements).toHaveBeenCalledWith({
      companyIds: [],
      regionIds: [],
      storeIds: ["store-1"],
      allowedTemplateTypes: ["VM_STORE_VISIT"],
      includeResponses: true,
      limit: 50,
      offset: 0,
    });
  });

  it("keeps broad checklist result readers unrestricted by template type", async () => {
    const acknowledgementRepository = {
      listChecklistAcknowledgements: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    };
    const service = new ChecklistService(
      storeOpsRepository as never,
      acknowledgementRepository as never,
      {} as never,
    );

    await service.listChecklistAcknowledgements({
      actorScope: {
        companyIds: ["company-1"],
        regionIds: [],
        storeIds: [],
      },
      actorRoleCodes: ["REPORT_VIEWER"],
      actorReadScope: {
        companyIds: ["company-1"],
        regionIds: [],
        storeIds: [],
      },
    });

    expect(acknowledgementRepository.listChecklistAcknowledgements).toHaveBeenCalledWith({
      companyIds: ["company-1"],
      regionIds: [],
      storeIds: [],
      allowedTemplateTypes: undefined,
      includeResponses: true,
      limit: 50,
      offset: 0,
    });
  });

  it("rejects publishing a draft checklist template when item weights do not total 100", async () => {
    const checklistRepository = {
      getDraftTemplateForPublish: jest
        .fn()
        .mockResolvedValue(draftTemplate({ weights: [40, 40] })),
      publishTemplate: jest.fn(),
    };
    const service = createService(checklistRepository);

    await expect(
      service.publishChecklistTemplate({
        checklistTemplateId: "template-1",
        actorUserId: "user-1",
        ...superAdminActor,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(checklistRepository.publishTemplate).not.toHaveBeenCalled();
  });

  it("publishes a draft checklist template when item weights total 100", async () => {
    const checklistRepository = {
      getDraftTemplateForPublish: jest.fn().mockResolvedValue(draftTemplate()),
      publishTemplate: jest.fn().mockResolvedValue({
        checklistTemplateId: "template-1",
        status: "published",
      }),
    };
    const service = createService(checklistRepository);

    const result = await service.publishChecklistTemplate({
      checklistTemplateId: "template-1",
      actorUserId: "user-1",
      ...hrCompanyActor,
      effectiveFrom: "2026-05-01",
      effectiveTo: "2026-12-31",
    });

    expect(result.command.status).toBe("published");
    expect(checklistRepository.publishTemplate).toHaveBeenCalledWith({
      checklistTemplateId: "template-1",
      actorUserId: "user-1",
      ...hrCompanyActor,
      effectiveFrom: "2026-05-01",
      effectiveTo: "2026-12-31",
    });
  });

  it("rejects required evidence publication when no approved synthetic fixture is configured", async () => {
    const requiredDraft = {
      ...draftTemplate(),
      items: draftTemplate().items.map((item) => ({
        ...item,
        evidencePolicy: "required" as const,
        maxEvidenceCount: 1,
      })),
    };
    const checklistRepository = {
      getDraftTemplateForPublish: jest.fn().mockResolvedValue(requiredDraft),
      publishTemplate: jest.fn(),
    };
    const service = new ChecklistService(
      storeOpsRepository as never,
      checklistAcknowledgementRepository as never,
      checklistRepository as never,
      undefined,
      {
        checklistEvidenceCaptureEnabled: true,
        checklistRequiredEvidenceEnforcementEnabled: true,
        checklistEvidenceStorageHealthy: true,
        photoMediaStorageEnabled: true,
        photoMediaSyntheticFixtureSha256Allowlist: [],
      } as never,
    );

    await expect(service.publishChecklistTemplate({
      checklistTemplateId: "template-1",
      actorUserId: "user-1",
      ...superAdminActor,
    })).rejects.toThrow("Required checklist evidence cannot be published");
    expect(checklistRepository.publishTemplate).not.toHaveBeenCalled();
  });

  it("rejects publishing when the provided effective date range is invalid", async () => {
    const checklistRepository = {
      getDraftTemplateForPublish: jest.fn().mockResolvedValue(draftTemplate()),
      publishTemplate: jest.fn(),
    };
    const service = createService(checklistRepository);

    await expect(
      service.publishChecklistTemplate({
        checklistTemplateId: "template-1",
        actorUserId: "user-1",
        ...superAdminActor,
        effectiveFrom: "2026-12-31",
        effectiveTo: "2026-05-01",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(checklistRepository.publishTemplate).not.toHaveBeenCalled();
  });

  it("rejects publishing when partial date overrides break the draft date range", async () => {
    const checklistRepository = {
      getDraftTemplateForPublish: jest
        .fn()
        .mockResolvedValue(draftTemplate({ effectiveFrom: "2026-06-01" })),
      publishTemplate: jest.fn(),
    };
    const service = createService(checklistRepository);

    await expect(
      service.publishChecklistTemplate({
        checklistTemplateId: "template-1",
        actorUserId: "user-1",
        ...superAdminActor,
        effectiveTo: "2026-05-01",
      }),
    ).rejects.toThrow("Checklist template effectiveTo must be on or after effectiveFrom");

    expect(checklistRepository.publishTemplate).not.toHaveBeenCalled();
  });

  it("rejects publishing a draft template outside the actor company scope", async () => {
    const checklistRepository = {
      getDraftTemplateForPublish: jest.fn().mockResolvedValue(draftTemplate({ companyId: "company-2" })),
      publishTemplate: jest.fn(),
    };
    const service = createService(checklistRepository);

    await expect(
      service.publishChecklistTemplate({
        checklistTemplateId: "template-1",
        actorUserId: "user-1",
        ...hrCompanyActor,
      }),
    ).rejects.toThrow("Checklist template company is outside actor scope");

    expect(checklistRepository.publishTemplate).not.toHaveBeenCalled();
  });

  it("creates a checklist template draft without publishing it", async () => {
    const checklistTemplate = {
      checklistTemplateId: "template-1",
      status: "draft",
    };
    const checklistRepository = {
      createTemplate: jest.fn().mockResolvedValue(checklistTemplate),
      publishTemplate: jest.fn(),
    };
    const service = createService(checklistRepository);

    const input = {
      companyId: "company-1",
      templateCode: "HR_OPENING",
      templateName: "HR Opening",
      templateType: "HR_STORE_VISIT",
      category: "HR",
      effectiveFrom: "2026-05-01",
      items: [
        {
          sectionName: "People",
          itemNo: 1,
          itemText: "Review staffing",
          responseType: "score" as const,
          weight: 100,
          maxScore: 5,
        },
      ],
      actorUserId: "user-1",
      ...hrCompanyActor,
    };

    const result = await service.createChecklistTemplate(input);

    expect(result.command.status).toBe("created");
    expect(checklistRepository.createTemplate).toHaveBeenCalledWith(input);
    expect(checklistRepository.publishTemplate).not.toHaveBeenCalled();
  });

  it("rejects creating a checklist template when the provided effective date range is invalid", async () => {
    const checklistRepository = {
      createTemplate: jest.fn(),
    };
    const service = createService(checklistRepository);

    await expect(
      service.createChecklistTemplate({
        companyId: "company-1",
        templateCode: "HR_OPENING",
        templateName: "HR Opening",
        templateType: "HR_STORE_VISIT",
        category: "HR",
        effectiveFrom: "2026-12-31",
        effectiveTo: "2026-05-01",
        items: [
          {
            sectionName: "People",
            itemNo: 1,
            itemText: "Review staffing",
            responseType: "score",
            weight: 100,
            maxScore: 5,
          },
        ],
        actorUserId: "user-1",
        ...superAdminActor,
      }),
    ).rejects.toThrow("Checklist template effectiveTo must be on or after effectiveFrom");

    expect(checklistRepository.createTemplate).not.toHaveBeenCalled();
  });

  it("rejects creating a checklist template outside the actor company scope", async () => {
    const checklistRepository = {
      createTemplate: jest.fn(),
    };
    const service = createService(checklistRepository);

    await expect(
      service.createChecklistTemplate({
        companyId: "company-2",
        templateCode: "HR_OPENING",
        templateName: "HR Opening",
        templateType: "HR_STORE_VISIT",
        category: "HR",
        effectiveFrom: "2026-05-01",
        items: [
          {
            sectionName: "People",
            itemNo: 1,
            itemText: "Review staffing",
            responseType: "score",
            weight: 100,
            maxScore: 5,
          },
        ],
        actorUserId: "user-1",
        ...hrCompanyActor,
      }),
    ).rejects.toThrow("Checklist template company is outside actor scope");

    expect(checklistRepository.createTemplate).not.toHaveBeenCalled();
  });

  it("starts a mobile checklist instance for an assigned store", async () => {
    const checklistRepository = {
      getPublishedTemplateForStore: jest.fn().mockResolvedValue({
        templateType: "BM_STORE_VISIT",
      }),
      startMobileChecklistInstance: jest.fn().mockResolvedValue({
        checklist_instance_id: "instance-1",
        status: "in_progress",
      }),
    };
    const service = createService(checklistRepository);

    const result = await service.startMobileChecklistInstance({
      checklistTemplateId: "template-1",
      storeId: "store-1",
      actorUserId: "user-1",
      actorRoleCodes: ["REGION_MANAGER"],
      actorActionScope: {
        assignedStoreIds: ["store-1"],
      },
    });

    expect(result.command.status).toBe("created");
    expect(checklistRepository.startMobileChecklistInstance).toHaveBeenCalledWith({
      checklistTemplateId: "template-1",
      storeId: "store-1",
      actorUserId: "user-1",
      actorRoleCodes: ["REGION_MANAGER"],
      actorActionScope: {
        assignedStoreIds: ["store-1"],
      },
    });
  });

  it("rejects starting a mobile checklist instance outside assigned stores", async () => {
    const checklistRepository = {
      startMobileChecklistInstance: jest.fn(),
    };
    const service = createService(checklistRepository);

    await expect(
      service.startMobileChecklistInstance({
        checklistTemplateId: "template-1",
        storeId: "store-2",
        actorUserId: "user-1",
        actorActionScope: {
          assignedStoreIds: ["store-1"],
        },
      }),
    ).rejects.toThrow("Requested store is outside assigned action stores");

    expect(checklistRepository.startMobileChecklistInstance).not.toHaveBeenCalled();
  });

  it("returns mobile checklist today from assigned stores before read stores", async () => {
    const today = {
      stores: [{ storeId: "store-1", storeName: "Marmara Park" }],
      templates: [],
      activeInstances: [],
      completedThisMonth: [],
      pendingAcknowledgements: [],
      monthlySummaries: [],
    };
    const checklistRepository = {
      getMobileChecklistToday: jest.fn().mockResolvedValue(today),
    };
    const service = createService(checklistRepository);

    await expect(
      service.getMobileChecklistToday({
        actorUserId: "user-1",
        actorScope: {
          storeIds: ["read-store-1"],
        },
        actorRoleCodes: ["REGION_MANAGER"],
        actorActionScope: {
          assignedStoreIds: ["store-1"],
        },
      }),
    ).resolves.toEqual({
      data: {
        ...today,
        evidenceCapabilities: {
          captureAvailable: false,
          syntheticFixtureOnly: true,
          unavailableReason: "feature_disabled",
        },
      },
    });

    expect(checklistRepository.getMobileChecklistToday).toHaveBeenCalledWith({
      actorUserId: "user-1",
      assignedStoreIds: ["store-1"],
      readStoreIds: ["read-store-1"],
      readRegionIds: [],
      readCompanyIds: [],
      allowedTemplateTypes: ["BM_STORE_VISIT", "VM_STORE_VISIT"],
    });
  });

  it("rejects saving responses on completed mobile checklist instances", async () => {
    const checklistRepository = {
      getMobileChecklistInstanceScope: jest.fn().mockResolvedValue({
        checklistInstanceId: "instance-1",
        storeId: "store-1",
        status: "completed",
      }),
      saveMobileChecklistResponse: jest.fn(),
    };
    const service = createService(checklistRepository);

    await expect(
      service.saveMobileChecklistResponse({
        checklistInstanceId: "instance-1",
        templateItemId: "item-1",
        scoreValue: 8,
        actorUserId: "user-1",
        actorActionScope: {
          assignedStoreIds: ["store-1"],
        },
      }),
    ).rejects.toThrow("Completed checklist instances are locked");

    expect(checklistRepository.saveMobileChecklistResponse).not.toHaveBeenCalled();
  });

  it("rejects completing a mobile checklist when mandatory responses are missing", async () => {
    const checklistRepository = {
      getMobileChecklistInstanceScope: jest.fn().mockResolvedValue({
        checklistInstanceId: "instance-1",
        storeId: "store-1",
        status: "in_progress",
        templateType: "BM_STORE_VISIT",
      }),
      completeMobileChecklistInstance: jest
        .fn()
        .mockRejectedValue(new BadRequestException("Mandatory checklist responses are missing")),
    };
    const service = createService(checklistRepository);

    await expect(
      service.completeMobileChecklistInstance({
        checklistInstanceId: "instance-1",
        actorUserId: "user-1",
        actorRoleCodes: ["REGION_MANAGER"],
        actorActionScope: {
          assignedStoreIds: ["store-1"],
        },
      }),
    ).rejects.toThrow("Mandatory checklist responses are missing");
  });

  it("completes a mobile checklist with calculated score and compliance rate", async () => {
    const checklistRepository = {
      getMobileChecklistInstanceScope: jest.fn().mockResolvedValue({
        checklistInstanceId: "instance-1",
        storeId: "store-1",
        status: "in_progress",
        templateType: "BM_STORE_VISIT",
      }),
      completeMobileChecklistInstance: jest.fn().mockResolvedValue({
        checklist_instance_id: "instance-1",
        status: "completed",
        total_score: "86.00",
        compliance_rate: "1.0000",
      }),
    };
    const service = createService(checklistRepository);

    const result = await service.completeMobileChecklistInstance({
      checklistInstanceId: "instance-1",
      actorUserId: "user-1",
      actorRoleCodes: ["REGION_MANAGER"],
      actorActionScope: {
        assignedStoreIds: ["store-1"],
      },
    });

    expect(result.command.status).toBe("completed");
    expect(checklistRepository.completeMobileChecklistInstance).toHaveBeenCalledWith({
      checklistInstanceId: "instance-1",
      actorUserId: "user-1",
      actorRoleCodes: ["REGION_MANAGER"],
      actorActionScope: { assignedStoreIds: ["store-1"] },
    });
  });
});
