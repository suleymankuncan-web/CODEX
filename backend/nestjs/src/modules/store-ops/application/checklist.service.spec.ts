import { BadRequestException } from "@nestjs/common";
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
      listChecklistAcknowledgements: jest.fn().mockResolvedValue([]),
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
    ).resolves.toEqual({ data: today });

    expect(checklistRepository.getMobileChecklistToday).toHaveBeenCalledWith({
      actorUserId: "user-1",
      assignedStoreIds: ["store-1"],
      readStoreIds: ["read-store-1"],
      readRegionIds: [],
      readCompanyIds: [],
      allowedTemplateTypes: ["BM_STORE_VISIT"],
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
    });
  });
});
