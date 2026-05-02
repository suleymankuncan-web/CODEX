import { BadRequestException } from "@nestjs/common";
import { CompetitionService } from "./competition.service";

const repository = () => ({
  listCompetitions: jest.fn(),
  getCompetitionDetail: jest.fn(),
  listStoreContributionsForCompetition: jest.fn(),
  listTeamTemplates: jest.fn(),
  createCompetition: jest.fn(),
  createTeamTemplate: jest.fn(),
  updateTeamTemplate: jest.fn(),
  cloneTeamTemplate: jest.fn(),
  deactivateTeamTemplate: jest.fn(),
  createStageWithTeams: jest.fn(),
  createStagePackage: jest.fn(),
  listStagePackagePlans: jest.fn(),
  createStagePackagePlan: jest.fn(),
  cloneStagePackagePlan: jest.fn(),
  submitStagePackagePlan: jest.fn(),
  approveStagePackagePlan: jest.fn(),
  rejectStagePackagePlan: jest.fn(),
  executeStagePackagePlan: jest.fn(),
  updateStagePackagePlan: jest.fn(),
  cancelStagePackagePlan: jest.fn(),
  listStagePackagePlanAudit: jest.fn(),
  recalculateStage: jest.fn(),
  listOpenWarnings: jest.fn(),
  finalizeStage: jest.fn(),
});

describe("CompetitionService team templates", () => {
  it("lists active competition team templates", async () => {
    const repo = repository();
    repo.listTeamTemplates.mockResolvedValue([
      {
        templateId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        templateCode: "MARMARA_A",
        templateName: "Marmara A",
        description: "Marmara challenge stores",
        isActive: true,
        stores: [
          {
            storeId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            storeCode: "IST-001",
            storeName: "IstinyePark",
            regionId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          },
        ],
      },
    ]);
    const service = new CompetitionService(repo as never);

    const result = await service.listTeamTemplates();

    expect(result.items).toEqual([
      expect.objectContaining({
        templateCode: "MARMARA_A",
        stores: [
          expect.objectContaining({
            storeCode: "IST-001",
          }),
        ],
      }),
    ]);
    expect(result.meta.total).toBe(1);
    expect(repo.listTeamTemplates).toHaveBeenCalledWith({ activeOnly: true });
  });

  it("lists inactive competition team templates when requested", async () => {
    const repo = repository();
    repo.listTeamTemplates.mockResolvedValue([
      {
        templateId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        templateCode: "OLD_MARMARA_A",
        templateName: "Old Marmara A",
        description: null,
        isActive: false,
        stores: [],
      },
    ]);
    const service = new CompetitionService(repo as never);

    const result = await service.listTeamTemplates({ activeOnly: false });

    expect(result.items).toEqual([
      expect.objectContaining({
        templateCode: "OLD_MARMARA_A",
        isActive: false,
      }),
    ]);
    expect(repo.listTeamTemplates).toHaveBeenCalledWith({ activeOnly: false });
  });

  it("rejects team template creation without stores", async () => {
    const repo = repository();
    const service = new CompetitionService(repo as never);

    await expect(
      service.createTeamTemplate({
        actorUserId: "11111111-1111-4111-8111-111111111111",
        templateCode: "EMPTY_TEMPLATE",
        templateName: "Empty Template",
        storeIds: [],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("creates a reusable competition team template", async () => {
    const repo = repository();
    repo.createTeamTemplate.mockResolvedValue({
      templateId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      templateCode: "MARMARA_A",
      templateName: "Marmara A",
      description: null,
      isActive: true,
      stores: [
        {
          storeId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          storeCode: "IST-001",
          storeName: "IstinyePark",
          regionId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        },
      ],
    });
    const service = new CompetitionService(repo as never);

    const result = await service.createTeamTemplate({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      templateCode: "MARMARA_A",
      templateName: "Marmara A",
      storeIds: ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"],
    });

    expect(result.command.status).toBe("created");
    expect(result.data.template.templateCode).toBe("MARMARA_A");
    expect(repo.createTeamTemplate).toHaveBeenCalledWith({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      templateCode: "MARMARA_A",
      templateName: "Marmara A",
      storeIds: ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"],
    });
  });

  it("deactivates a competition team template", async () => {
    const repo = repository();
    repo.deactivateTeamTemplate.mockResolvedValue({
      templateId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      templateCode: "MARMARA_A",
      templateName: "Marmara A",
      description: null,
      isActive: false,
      stores: [
        {
          storeId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          storeCode: "IST-001",
          storeName: "IstinyePark",
          regionId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        },
      ],
    });
    const service = new CompetitionService(repo as never);

    const result = await service.deactivateTeamTemplate({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      templateId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });

    expect(result.command.status).toBe("deactivated");
    expect(result.data.template.isActive).toBe(false);
    expect(repo.deactivateTeamTemplate).toHaveBeenCalledWith({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      templateId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
  });

  it("updates a competition team template with unique store membership", async () => {
    const repo = repository();
    repo.updateTeamTemplate.mockResolvedValue({
      templateId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      templateCode: "MARMARA_A_REV",
      templateName: "Marmara A Revised",
      description: "Rebalanced stores",
      isActive: true,
      stores: [
        {
          storeId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          storeCode: "IST-001",
          storeName: "IstinyePark",
          regionId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        },
        {
          storeId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          storeCode: "IST-002",
          storeName: "Kadikoy",
          regionId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        },
      ],
    });
    const service = new CompetitionService(repo as never);

    const result = await service.updateTeamTemplate({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      templateId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      templateCode: "MARMARA_A_REV",
      templateName: "Marmara A Revised",
      description: "Rebalanced stores",
      storeIds: [
        "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      ],
    });

    expect(result.command.status).toBe("updated");
    expect(result.data.template.templateCode).toBe("MARMARA_A_REV");
    expect(repo.updateTeamTemplate).toHaveBeenCalledWith({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      templateId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      templateCode: "MARMARA_A_REV",
      templateName: "Marmara A Revised",
      description: "Rebalanced stores",
      storeIds: [
        "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      ],
    });
  });

  it("rejects team template update without stores", async () => {
    const repo = repository();
    const service = new CompetitionService(repo as never);

    await expect(
      service.updateTeamTemplate({
        actorUserId: "11111111-1111-4111-8111-111111111111",
        templateId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        templateCode: "MARMARA_A_REV",
        templateName: "Marmara A Revised",
        storeIds: [],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("clones a competition team template", async () => {
    const repo = repository();
    repo.cloneTeamTemplate.mockResolvedValue({
      templateId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      templateCode: "MARMARA_A_COPY",
      templateName: "Marmara A Copy",
      description: "Copy for May",
      isActive: true,
      stores: [
        {
          storeId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          storeCode: "IST-001",
          storeName: "IstinyePark",
          regionId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        },
      ],
    });
    const service = new CompetitionService(repo as never);

    const result = await service.cloneTeamTemplate({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      sourceTemplateId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      templateCode: "MARMARA_A_COPY",
      templateName: "Marmara A Copy",
      description: "Copy for May",
    });

    expect(result.command.status).toBe("created");
    expect(result.command.message).toBe("Competition team template cloned");
    expect(result.data.template.templateCode).toBe("MARMARA_A_COPY");
    expect(repo.cloneTeamTemplate).toHaveBeenCalledWith({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      sourceTemplateId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      templateCode: "MARMARA_A_COPY",
      templateName: "Marmara A Copy",
      description: "Copy for May",
    });
  });
});
