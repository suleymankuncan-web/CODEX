import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { CompetitionService } from "./competition.service";

const repository = () => ({
  listCompetitions: jest.fn(),
  getCompetitionDetail: jest.fn(),
  createCompetition: jest.fn(),
  createStageWithTeams: jest.fn(),
  recalculateStage: jest.fn(),
  listOpenWarnings: jest.fn(),
  finalizeStage: jest.fn(),
});

describe("CompetitionService", () => {
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

  it("blocks region manager store detail reads outside read scope", async () => {
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
              storeId: "outside-store",
              storeCode: "IST-999",
              storeName: "Outside",
              regionId: "outside-region",
            },
          ],
        },
      ],
      latestScores: [],
      warnings: [],
    });
    const service = new CompetitionService(repo as never);

    await expect(
      service.getCompetitionDetail({
        competitionId: "competition-1",
        actorScope: { companyIds: [], regionIds: [], storeIds: ["inside-store"] },
        includeStoreDetails: true,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
