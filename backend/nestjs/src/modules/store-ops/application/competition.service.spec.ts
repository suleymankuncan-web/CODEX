import { BadRequestException } from "@nestjs/common";
import { CompetitionService } from "./competition.service";

const repository = () => ({
  listCompetitions: jest.fn(),
  getCompetitionDetail: jest.fn(),
  listStoreContributionsForCompetition: jest.fn(),
  listTeamTemplates: jest.fn(),
  createCompetition: jest.fn(),
  createTeamTemplate: jest.fn(),
  createStageWithTeams: jest.fn(),
  recalculateStage: jest.fn(),
  listOpenWarnings: jest.fn(),
  finalizeStage: jest.fn(),
});

describe("CompetitionService", () => {
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

  it("creates a draft competition through the repository", async () => {
    const repo = repository();
    repo.createCompetition.mockResolvedValue({
      competitionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      competitionCode: "MAY_REGION_CHALLENGE",
      competitionName: "May Region Challenge",
      description: null,
      competitionType: "region_challenge",
      lifecycleState: "draft",
      startsOn: "2026-05-01",
      endsOn: "2026-05-31",
    });
    const service = new CompetitionService(repo as never);

    const result = await service.createCompetition({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      competitionCode: "MAY_REGION_CHALLENGE",
      competitionName: "May Region Challenge",
      competitionType: "region_challenge",
      startsOn: "2026-05-01",
      endsOn: "2026-05-31",
    });

    expect(result.data.competition.competitionCode).toBe("MAY_REGION_CHALLENGE");
    expect(repo.createCompetition).toHaveBeenCalledWith(
      expect.objectContaining({
        competitionCode: "MAY_REGION_CHALLENGE",
        ownerUserId: "11111111-1111-4111-8111-111111111111",
      }),
    );
  });

  it("rejects finalization with open warnings unless override justification is written", async () => {
    const repo = repository();
    repo.listOpenWarnings.mockResolvedValue([
      {
        warningId: "w1",
        stageId: "stage-1",
        teamId: "team-1",
        storeId: "store-1",
        warningCode: "missing_bm_checklist",
        warningLevel: "warning",
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
        message: "BM checklist missing",
        resolvedAt: null,
      },
    ]);
    const service = new CompetitionService(repo as never);

    await expect(
      service.finalizeStage({
        actorUserId: "11111111-1111-4111-8111-111111111111",
        stageId: "22222222-2222-4222-8222-222222222222",
        allowOverride: false,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("finalizes with overridden state when warnings exist and justification is present", async () => {
    const repo = repository();
    repo.listOpenWarnings.mockResolvedValue([
      {
        warningId: "w1",
        stageId: "stage-1",
        teamId: "team-1",
        storeId: "store-1",
        warningCode: "missing_vm_checklist",
        warningLevel: "warning",
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
        message: "VM checklist missing",
        resolvedAt: null,
      },
    ]);
    repo.finalizeStage.mockResolvedValue({
      competitionStageId: "22222222-2222-4222-8222-222222222222",
      finalizationState: "overridden",
    });
    const service = new CompetitionService(repo as never);

    const result = await service.finalizeStage({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      stageId: "22222222-2222-4222-8222-222222222222",
      allowOverride: true,
      overrideJustification: "April BM record was verified outside the source export.",
    });

    expect(result.command.status).toBe("finalized");
    expect(repo.finalizeStage).toHaveBeenCalledWith(
      expect.objectContaining({
        finalizationState: "overridden",
        finalizationNote: "April BM record was verified outside the source export.",
        unresolvedWarningCount: 1,
      }),
    );
  });

  it("redacts out-of-scope team stores while returning scoped store contributions", async () => {
    const repo = repository();
    repo.getCompetitionDetail.mockResolvedValue({
      competition: {
        competitionId: "competition-1",
        competitionCode: "APRIL",
        competitionName: "April",
        description: null,
        competitionType: "region_challenge",
        lifecycleState: "active",
        startsOn: "2026-04-01",
        endsOn: "2026-04-30",
      },
      stages: [],
      teams: [
        {
          competitionTeamId: "team-1",
          teamCode: "MARMARA",
          teamName: "Marmara",
          teamOrder: 1,
          stores: [
            {
              storeId: "visible-store",
              storeCode: "IST-001",
              storeName: "Visible Store",
              regionId: "visible-region",
            },
            {
              storeId: "outside-store",
              storeCode: "KRD-001",
              storeName: "Outside Store",
              regionId: "outside-region",
            },
          ],
        },
      ],
      latestScores: [
        {
          stageId: "stage-1",
          teamId: "team-1",
          teamCode: "MARMARA",
          teamName: "Marmara",
          snapshotDate: "2026-04-22",
          scoreValue: 91.25,
          validStoreCount: 2,
          totalStoreCount: 2,
          coverageRate: 1,
          rankPosition: 1,
          rankingPopulation: 2,
        },
      ],
      warnings: [],
    });
    repo.listStoreContributionsForCompetition.mockResolvedValue([
      {
        stageId: "stage-1",
        teamId: "team-1",
        teamCode: "MARMARA",
        teamName: "Marmara",
        storeId: "visible-store",
        storeCode: "IST-001",
        storeName: "Visible Store",
        regionId: "visible-region",
        snapshotDate: "2026-04-22",
        scoreValue: 93.5,
        reportedWeightPercent: 95,
        expectedWeightPercent: 100,
        hasDailyData: true,
        missingKpiCodes: ["BM_CHECKLIST"],
      },
    ]);
    const service = new CompetitionService(repo as never);

    const result = await service.getCompetitionDetail({
      competitionId: "competition-1",
      actorScope: {
        companyIds: [],
        regionIds: ["visible-region"],
        storeIds: [],
      },
      includeStoreDetails: true,
    });

    expect(result.teams[0].stores).toEqual([
      {
        storeId: "visible-store",
        storeCode: "IST-001",
        storeName: "Visible Store",
        regionId: "visible-region",
      },
    ]);
    expect(result.latestScores).toHaveLength(1);
    expect(result.storeContributions).toEqual([
      expect.objectContaining({
        storeId: "visible-store",
        storeName: "Visible Store",
        scoreValue: 93.5,
        missingKpiCodes: ["BM_CHECKLIST"],
      }),
    ]);
    expect(repo.listStoreContributionsForCompetition).toHaveBeenCalledWith({
      competitionId: "competition-1",
      companyIds: [],
      regionIds: ["visible-region"],
      storeIds: [],
    });
  });
});
