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

const validStagePackageStages = [
  {
    stagePresetCode: "region_league" as const,
    stageCode: "REGION_LEAGUE",
    stageName: "Regional League",
    stageOrder: 1,
    stageType: "league" as const,
    startsOn: "2026-05-01",
    endsOn: "2026-05-31",
    teams: [
      {
        teamCode: "MARMARA_A",
        teamName: "Marmara A",
        sourceTemplateId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        storeIds: ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"],
      },
      {
        teamCode: "MARMARA_B",
        teamName: "Marmara B",
        sourceTemplateId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        storeIds: ["dddddddd-dddd-4ddd-8ddd-dddddddddddd"],
      },
    ],
  },
  {
    stagePresetCode: "final_showdown" as const,
    stageCode: "FINAL_SHOWDOWN",
    stageName: "Final Showdown",
    stageOrder: 2,
    stageType: "final" as const,
    startsOn: "2026-05-16",
    endsOn: "2026-05-31",
    teams: [
      {
        teamCode: "MARMARA_A",
        teamName: "Marmara A",
        sourceTemplateId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        storeIds: ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"],
      },
      {
        teamCode: "MARMARA_B",
        teamName: "Marmara B",
        sourceTemplateId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        storeIds: ["dddddddd-dddd-4ddd-8ddd-dddddddddddd"],
      },
    ],
  },
];

describe("CompetitionService", () => {
  it("creates a stage with a format preset code", async () => {
    const repo = repository();
    repo.createStageWithTeams.mockResolvedValue({
      competitionStageId: "22222222-2222-4222-8222-222222222222",
      competitionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      stageCode: "REGION_LEAGUE",
      stageName: "Regional League",
      stageOrder: 1,
      stageType: "league",
      startsOn: "2026-05-01",
      endsOn: "2026-05-31",
      lifecycleState: "active",
      finalizationState: null,
    });
    const service = new CompetitionService(repo as never);

    const result = await service.createStage({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      competitionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      stagePresetCode: "region_league",
      stageCode: "REGION_LEAGUE",
      stageName: "Regional League",
      stageOrder: 1,
      stageType: "league",
      startsOn: "2026-05-01",
      endsOn: "2026-05-31",
      teams: [
        {
          teamCode: "MARMARA_A",
          teamName: "Marmara A",
          storeIds: ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"],
        },
        {
          teamCode: "MARMARA_B",
          teamName: "Marmara B",
          storeIds: ["dddddddd-dddd-4ddd-8ddd-dddddddddddd"],
        },
      ],
    });

    expect(result.command.status).toBe("created");
    expect(repo.createStageWithTeams).toHaveBeenCalledWith(
      expect.objectContaining({
        stagePresetCode: "region_league",
        stageType: "league",
      }),
    );
  });

  it("creates a stage package through the repository", async () => {
    const repo = repository();
    repo.createStagePackage.mockResolvedValue([
      {
        competitionStageId: "22222222-2222-4222-8222-222222222222",
        competitionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        stageCode: "REGION_LEAGUE",
        stageName: "Regional League",
        stageOrder: 1,
        stageType: "league",
        startsOn: "2026-05-01",
        endsOn: "2026-05-31",
        lifecycleState: "active",
        finalizationState: null,
      },
      {
        competitionStageId: "33333333-3333-4333-8333-333333333333",
        competitionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        stageCode: "FINAL_SHOWDOWN",
        stageName: "Final Showdown",
        stageOrder: 2,
        stageType: "final",
        startsOn: "2026-05-16",
        endsOn: "2026-05-31",
        lifecycleState: "active",
        finalizationState: null,
      },
    ]);
    const service = new CompetitionService(repo as never);

    const result = await service.createStagePackage({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      competitionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      packageCode: "league_then_final",
      stages: [
        {
          stagePresetCode: "region_league",
          stageCode: "REGION_LEAGUE",
          stageName: "Regional League",
          stageOrder: 1,
          stageType: "league",
          startsOn: "2026-05-01",
          endsOn: "2026-05-31",
          teams: [
            {
              teamCode: "MARMARA_A",
              teamName: "Marmara A",
              sourceTemplateId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              storeIds: ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"],
            },
            {
              teamCode: "MARMARA_B",
              teamName: "Marmara B",
              sourceTemplateId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
              storeIds: ["dddddddd-dddd-4ddd-8ddd-dddddddddddd"],
            },
          ],
        },
        {
          stagePresetCode: "final_showdown",
          stageCode: "FINAL_SHOWDOWN",
          stageName: "Final Showdown",
          stageOrder: 2,
          stageType: "final",
          startsOn: "2026-05-16",
          endsOn: "2026-05-31",
          teams: [
            {
              teamCode: "MARMARA_A",
              teamName: "Marmara A",
              sourceTemplateId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              storeIds: ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"],
            },
            {
              teamCode: "MARMARA_B",
              teamName: "Marmara B",
              sourceTemplateId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
              storeIds: ["dddddddd-dddd-4ddd-8ddd-dddddddddddd"],
            },
          ],
        },
      ],
    });

    expect(result.command.status).toBe("created");
    expect(result.command.message).toBe("Competition stage package created");
    expect(result.data.stages).toHaveLength(2);
    expect(repo.createStagePackage).toHaveBeenCalledWith(
      expect.objectContaining({
        packageCode: "league_then_final",
        stages: [
          expect.objectContaining({ stagePresetCode: "region_league" }),
          expect.objectContaining({ stagePresetCode: "final_showdown" }),
        ],
      }),
    );
  });

  it("lists saved stage package plans for a competition", async () => {
    const repo = repository();
    repo.listStagePackagePlans.mockResolvedValue([
      {
        planId: "55555555-5555-4555-8555-555555555555",
        competitionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        packageCode: "league_then_final",
        planName: "April regional package",
        planStatus: "draft",
        stageDrafts: validStagePackageStages,
        createdStageIds: [],
        createdAt: "2026-04-25T10:00:00.000Z",
        updatedAt: "2026-04-25T10:00:00.000Z",
        executedAt: null,
      },
    ]);
    const service = new CompetitionService(repo as never);

    const result = await service.listStagePackagePlans({
      competitionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });

    expect(result.items).toEqual([
      expect.objectContaining({
        planName: "April regional package",
        planStatus: "draft",
      }),
    ]);
    expect(result.meta.total).toBe(1);
    expect(repo.listStagePackagePlans).toHaveBeenCalledWith({
      competitionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
  });

  it("saves a stage package plan draft without creating stages", async () => {
    const repo = repository();
    repo.createStagePackagePlan.mockResolvedValue({
      planId: "55555555-5555-4555-8555-555555555555",
      competitionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      packageCode: "league_then_final",
      planName: "April regional package",
      planStatus: "draft",
      stageDrafts: validStagePackageStages,
      createdStageIds: [],
      createdAt: "2026-04-25T10:00:00.000Z",
      updatedAt: "2026-04-25T10:00:00.000Z",
      executedAt: null,
    });
    const service = new CompetitionService(repo as never);

    const result = await service.createStagePackagePlan({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      competitionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      packageCode: "league_then_final",
      planName: "April regional package",
      stages: validStagePackageStages,
    });

    expect(result.command.status).toBe("created");
    expect(result.command.message).toBe("Competition stage package plan saved");
    expect(result.data.plan).toEqual(
      expect.objectContaining({
        planName: "April regional package",
        planStatus: "draft",
        createdStageIds: [],
      }),
    );
    expect(repo.createStagePackagePlan).toHaveBeenCalledWith({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      competitionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      packageCode: "league_then_final",
      planName: "April regional package",
      stages: validStagePackageStages,
    });
    expect(repo.createStagePackage).not.toHaveBeenCalled();
  });

  it("executes a saved stage package plan through the repository", async () => {
    const repo = repository();
    repo.executeStagePackagePlan.mockResolvedValue({
      plan: {
        planId: "55555555-5555-4555-8555-555555555555",
        competitionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        packageCode: "league_then_final",
        planName: "April regional package",
        planStatus: "executed",
        stageDrafts: validStagePackageStages,
        createdStageIds: [
          "22222222-2222-4222-8222-222222222222",
          "33333333-3333-4333-8333-333333333333",
        ],
        createdAt: "2026-04-25T10:00:00.000Z",
        updatedAt: "2026-04-25T10:05:00.000Z",
        executedAt: "2026-04-25T10:05:00.000Z",
      },
      stages: [
        {
          competitionStageId: "22222222-2222-4222-8222-222222222222",
          competitionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          stageCode: "REGION_LEAGUE",
          stageName: "Regional League",
          stageOrder: 1,
          stageType: "league",
          startsOn: "2026-05-01",
          endsOn: "2026-05-31",
          lifecycleState: "active",
          finalizationState: null,
        },
        {
          competitionStageId: "33333333-3333-4333-8333-333333333333",
          competitionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          stageCode: "FINAL_SHOWDOWN",
          stageName: "Final Showdown",
          stageOrder: 2,
          stageType: "final",
          startsOn: "2026-05-16",
          endsOn: "2026-05-31",
          lifecycleState: "active",
          finalizationState: null,
        },
      ],
    });
    const service = new CompetitionService(repo as never);

    const result = await service.executeStagePackagePlan({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      planId: "55555555-5555-4555-8555-555555555555",
    });

    expect(result.command.status).toBe("executed");
    expect(result.command.message).toBe("Competition stage package plan executed");
    expect(result.data.plan).toEqual(
      expect.objectContaining({
        planStatus: "executed",
        createdStageIds: [
          "22222222-2222-4222-8222-222222222222",
          "33333333-3333-4333-8333-333333333333",
        ],
      }),
    );
    expect(result.data.stages).toHaveLength(2);
    expect(repo.executeStagePackagePlan).toHaveBeenCalledWith({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      planId: "55555555-5555-4555-8555-555555555555",
    });
  });

  it("updates a draft stage package plan through the repository", async () => {
    const repo = repository();
    repo.updateStagePackagePlan.mockResolvedValue({
      planId: "55555555-5555-4555-8555-555555555555",
      competitionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      packageCode: "league_then_final",
      planName: "April regional package revised",
      planStatus: "draft",
      stageDrafts: validStagePackageStages,
      createdStageIds: [],
      createdAt: "2026-04-25T10:00:00.000Z",
      updatedAt: "2026-04-25T10:10:00.000Z",
      executedAt: null,
    });
    const service = new CompetitionService(repo as never);

    const result = await service.updateStagePackagePlan({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      planId: "55555555-5555-4555-8555-555555555555",
      packageCode: "league_then_final",
      planName: "April regional package revised",
      stages: validStagePackageStages,
    });

    expect(result.command.status).toBe("updated");
    expect(result.command.message).toBe("Competition stage package plan updated");
    expect(result.data.plan.planName).toBe("April regional package revised");
    expect(repo.updateStagePackagePlan).toHaveBeenCalledWith({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      planId: "55555555-5555-4555-8555-555555555555",
      packageCode: "league_then_final",
      planName: "April regional package revised",
      stages: validStagePackageStages,
    });
  });

  it("submits a draft stage package plan for review", async () => {
    const repo = repository();
    repo.submitStagePackagePlan.mockResolvedValue({
      planId: "55555555-5555-4555-8555-555555555555",
      competitionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      packageCode: "league_then_final",
      planName: "April regional package",
      planStatus: "submitted",
      stageDrafts: validStagePackageStages,
      createdStageIds: [],
      submittedByUserId: "11111111-1111-4111-8111-111111111111",
      submittedAt: "2026-04-25T10:15:00.000Z",
      reviewedByUserId: null,
      reviewedAt: null,
      reviewNote: null,
      createdAt: "2026-04-25T10:00:00.000Z",
      updatedAt: "2026-04-25T10:15:00.000Z",
      executedAt: null,
    });
    const service = new CompetitionService(repo as never);

    const result = await service.submitStagePackagePlan({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      planId: "55555555-5555-4555-8555-555555555555",
    });

    expect(result.command.status).toBe("submitted");
    expect(result.command.message).toBe("Competition stage package plan submitted for review");
    expect(result.data.plan.planStatus).toBe("submitted");
    expect(repo.submitStagePackagePlan).toHaveBeenCalledWith({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      planId: "55555555-5555-4555-8555-555555555555",
    });
  });

  it("approves a submitted stage package plan", async () => {
    const repo = repository();
    repo.approveStagePackagePlan.mockResolvedValue({
      planId: "55555555-5555-4555-8555-555555555555",
      competitionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      packageCode: "league_then_final",
      planName: "April regional package",
      planStatus: "approved",
      stageDrafts: validStagePackageStages,
      createdStageIds: [],
      submittedByUserId: "11111111-1111-4111-8111-111111111111",
      submittedAt: "2026-04-25T10:15:00.000Z",
      reviewedByUserId: "22222222-2222-4222-8222-222222222222",
      reviewedAt: "2026-04-25T10:20:00.000Z",
      reviewNote: "Reviewed in planning meeting.",
      createdAt: "2026-04-25T10:00:00.000Z",
      updatedAt: "2026-04-25T10:20:00.000Z",
      executedAt: null,
    });
    const service = new CompetitionService(repo as never);

    const result = await service.approveStagePackagePlan({
      actorUserId: "22222222-2222-4222-8222-222222222222",
      planId: "55555555-5555-4555-8555-555555555555",
      reviewNote: "Reviewed in planning meeting.",
    });

    expect(result.command.status).toBe("approved");
    expect(result.command.message).toBe("Competition stage package plan approved");
    expect(result.data.plan.planStatus).toBe("approved");
    expect(repo.approveStagePackagePlan).toHaveBeenCalledWith({
      actorUserId: "22222222-2222-4222-8222-222222222222",
      planId: "55555555-5555-4555-8555-555555555555",
      reviewNote: "Reviewed in planning meeting.",
    });
  });

  it("rejects a submitted stage package plan", async () => {
    const repo = repository();
    repo.rejectStagePackagePlan.mockResolvedValue({
      planId: "55555555-5555-4555-8555-555555555555",
      competitionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      packageCode: "league_then_final",
      planName: "April regional package",
      planStatus: "rejected",
      stageDrafts: validStagePackageStages,
      createdStageIds: [],
      submittedByUserId: "11111111-1111-4111-8111-111111111111",
      submittedAt: "2026-04-25T10:15:00.000Z",
      reviewedByUserId: "22222222-2222-4222-8222-222222222222",
      reviewedAt: "2026-04-25T10:20:00.000Z",
      reviewNote: "Dates need another pass.",
      createdAt: "2026-04-25T10:00:00.000Z",
      updatedAt: "2026-04-25T10:20:00.000Z",
      executedAt: null,
    });
    const service = new CompetitionService(repo as never);

    const result = await service.rejectStagePackagePlan({
      actorUserId: "22222222-2222-4222-8222-222222222222",
      planId: "55555555-5555-4555-8555-555555555555",
      reviewNote: "Dates need another pass.",
    });

    expect(result.command.status).toBe("rejected");
    expect(result.command.message).toBe("Competition stage package plan rejected");
    expect(result.data.plan.planStatus).toBe("rejected");
    expect(repo.rejectStagePackagePlan).toHaveBeenCalledWith({
      actorUserId: "22222222-2222-4222-8222-222222222222",
      planId: "55555555-5555-4555-8555-555555555555",
      reviewNote: "Dates need another pass.",
    });
  });

  it("clones a rejected stage package plan as a new draft", async () => {
    const repo = repository();
    repo.cloneStagePackagePlan.mockResolvedValue({
      planId: "66666666-6666-4666-8666-666666666666",
      competitionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      packageCode: "league_then_final",
      planName: "April regional package revision",
      planStatus: "draft",
      stageDrafts: validStagePackageStages,
      createdStageIds: [],
      submittedByUserId: null,
      submittedAt: null,
      reviewedByUserId: null,
      reviewedAt: null,
      reviewNote: null,
      createdAt: "2026-04-25T10:25:00.000Z",
      updatedAt: "2026-04-25T10:25:00.000Z",
      executedAt: null,
    });
    const service = new CompetitionService(repo as never);

    const result = await service.cloneStagePackagePlan({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      sourcePlanId: "55555555-5555-4555-8555-555555555555",
    });

    expect(result.command.status).toBe("created");
    expect(result.command.message).toBe(
      "Competition stage package plan cloned as draft",
    );
    expect(result.data.plan).toEqual(
      expect.objectContaining({
        planId: "66666666-6666-4666-8666-666666666666",
        planName: "April regional package revision",
        planStatus: "draft",
        createdStageIds: [],
        submittedByUserId: null,
        reviewedByUserId: null,
      }),
    );
    expect(repo.cloneStagePackagePlan).toHaveBeenCalledWith({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      sourcePlanId: "55555555-5555-4555-8555-555555555555",
    });
  });

  it("cancels a draft stage package plan through the repository", async () => {
    const repo = repository();
    repo.cancelStagePackagePlan.mockResolvedValue({
      planId: "55555555-5555-4555-8555-555555555555",
      competitionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      packageCode: "league_then_final",
      planName: "April regional package",
      planStatus: "cancelled",
      stageDrafts: validStagePackageStages,
      createdStageIds: [],
      createdAt: "2026-04-25T10:00:00.000Z",
      updatedAt: "2026-04-25T10:12:00.000Z",
      executedAt: null,
    });
    const service = new CompetitionService(repo as never);

    const result = await service.cancelStagePackagePlan({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      planId: "55555555-5555-4555-8555-555555555555",
    });

    expect(result.command.status).toBe("cancelled");
    expect(result.command.message).toBe("Competition stage package plan cancelled");
    expect(result.data.plan.planStatus).toBe("cancelled");
    expect(repo.cancelStagePackagePlan).toHaveBeenCalledWith({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      planId: "55555555-5555-4555-8555-555555555555",
    });
  });

  it("lists stage package plan audit events", async () => {
    const repo = repository();
    repo.listStagePackagePlanAudit.mockResolvedValue([
      {
        eventLogId: "99999999-9999-4999-8999-999999999999",
        occurredAt: "2026-04-25T10:00:00.000Z",
        actorUserId: null,
        eventType: "competition_stage_package_plan.saved",
        metadata: { planName: "April regional package" },
      },
    ]);
    const service = new CompetitionService(repo as never);

    const result = await service.listStagePackagePlanAudit({
      planId: "55555555-5555-4555-8555-555555555555",
    });

    expect(result.items).toEqual([
      expect.objectContaining({
        eventType: "competition_stage_package_plan.saved",
      }),
    ]);
    expect(result.meta.total).toBe(1);
    expect(repo.listStagePackagePlanAudit).toHaveBeenCalledWith({
      planId: "55555555-5555-4555-8555-555555555555",
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
        storeName: "Store One",
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

  it("finalizes cleanly without persisting override note when no warnings remain", async () => {
    const repo = repository();
    repo.listOpenWarnings.mockResolvedValue([]);
    repo.finalizeStage.mockResolvedValue({
      competitionStageId: "22222222-2222-4222-8222-222222222222",
      finalizationState: "clean",
    });
    const service = new CompetitionService(repo as never);

    const result = await service.finalizeStage({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      stageId: "22222222-2222-4222-8222-222222222222",
      allowOverride: true,
      overrideJustification: "This text must not be persisted for clean finalization.",
    });

    expect(result.command.status).toBe("finalized");
    expect(result.command.message).toBe("Competition stage finalized cleanly");
    expect(result.data.unresolvedWarnings).toEqual([]);
    expect(repo.finalizeStage).toHaveBeenCalledWith(
      expect.objectContaining({
        finalizationState: "clean",
        finalizationNote: null,
        unresolvedWarningCount: 0,
      }),
    );
  });

  it("finalizes with overridden state when warnings exist and justification is present", async () => {
    const repo = repository();
    repo.listOpenWarnings.mockResolvedValue([
      {
        warningId: "w1",
        stageId: "stage-1",
        teamId: "team-1",
        storeId: "store-1",
        storeName: "Store One",
        warningCode: "missing_vm_checklist",
        warningLevel: "warning",
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
        message: "VM checklist missing",
        resolvedAt: null,
      },
      {
        warningId: "w2",
        stageId: "stage-1",
        teamId: "team-1",
        storeId: "store-2",
        storeName: "Store Two",
        warningCode: "missing_daily_store_data",
        warningLevel: "blocker",
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
        message: "Daily store data missing",
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
      overrideJustification: "  April BM record was verified outside the source export.  ",
    });

    expect(result.command.status).toBe("finalized");
    expect(repo.finalizeStage).toHaveBeenCalledWith(
      expect.objectContaining({
        finalizationState: "overridden",
        finalizationNote: "April BM record was verified outside the source export.",
        unresolvedWarningCount: 2,
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
              companyId: "company-1",
              regionId: "visible-region",
            },
            {
              storeId: "outside-store",
              storeCode: "KRD-001",
              storeName: "Outside Store",
              companyId: "company-2",
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
      actorRoleCodes: ["REGION_MANAGER"],
      actorActionScope: { assignedStoreIds: ["visible-store"] },
      includeStoreDetails: true,
    });

    expect(result.teams[0].stores).toEqual([
      {
        storeId: "visible-store",
        storeCode: "IST-001",
        storeName: "Visible Store",
        companyId: "company-1",
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
      regionIds: [],
      storeIds: ["visible-store"],
    });
  });

  it("keeps store manager competition detail limited to assigned stores even when company scope is present", async () => {
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
              companyId: "company-1",
              regionId: "visible-region",
            },
            {
              storeId: "outside-store",
              storeCode: "KRD-001",
              storeName: "Outside Store",
              companyId: "company-2",
              regionId: "outside-region",
            },
          ],
        },
      ],
      latestScores: [],
      warnings: [],
    });
    repo.listStoreContributionsForCompetition.mockResolvedValue([]);
    const service = new CompetitionService(repo as never);

    const result = await service.getCompetitionDetail({
      competitionId: "competition-1",
      actorScope: {
        companyIds: ["company-1"],
        regionIds: ["visible-region"],
        storeIds: ["visible-store"],
      },
      actorActionScope: {
        assignedStoreIds: ["visible-store"],
      },
      actorRoleCodes: ["STORE_MANAGER"],
      includeStoreDetails: true,
    });

    expect(repo.getCompetitionDetail).toHaveBeenCalledWith({
      competitionId: "competition-1",
      companyIds: [],
      regionIds: [],
      storeIds: ["visible-store"],
    });
    expect(result.teams[0].stores).toEqual([
      {
        storeId: "visible-store",
        storeCode: "IST-001",
        storeName: "Visible Store",
        companyId: "company-1",
        regionId: "visible-region",
      },
    ]);
  });

  it("redacts team stores from other companies for company-scoped competition detail", async () => {
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
              companyId: "company-1",
              regionId: "visible-region",
            },
            {
              storeId: "outside-company-store",
              storeCode: "ANK-001",
              storeName: "Outside Company Store",
              companyId: "company-2",
              regionId: "outside-region",
            },
          ],
        },
      ],
      latestScores: [],
      warnings: [],
    });
    repo.listStoreContributionsForCompetition.mockResolvedValue([]);
    const service = new CompetitionService(repo as never);

    const result = await service.getCompetitionDetail({
      competitionId: "competition-1",
      actorScope: {
        companyIds: ["company-1"],
        regionIds: [],
        storeIds: [],
      },
      actorRoleCodes: ["REPORT_VIEWER"],
      includeStoreDetails: true,
    });

    expect(result.teams[0].stores).toEqual([
      {
        storeId: "visible-store",
        storeCode: "IST-001",
        storeName: "Visible Store",
        companyId: "company-1",
        regionId: "visible-region",
      },
    ]);
  });
});
