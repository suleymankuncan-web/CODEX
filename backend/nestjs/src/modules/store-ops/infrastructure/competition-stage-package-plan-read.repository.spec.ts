import { CompetitionStagePackagePlanReadRepository } from "./competition-stage-package-plan-read.repository";

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

function createReadRepositoryHarness() {
  const databaseService = {
    query: jest.fn(),
  };

  return {
    repository: new CompetitionStagePackagePlanReadRepository(
      databaseService as never,
    ),
    databaseService,
  };
}

describe("CompetitionStagePackagePlanReadRepository", () => {
  it("lists stage package plan drafts for a competition", async () => {
    const { repository, databaseService } = createReadRepositoryHarness();
    databaseService.query.mockResolvedValue({
      rowCount: 1,
      rows: [
        {
          competition_stage_package_plan_id: "55555555-5555-4555-8555-555555555555",
          competition_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          package_code: "league_then_final",
          plan_name: "April regional package",
          plan_status: "draft",
          stage_drafts_json: validStagePackageStages,
          created_stage_ids: [],
          created_at: "2026-04-25T10:00:00.000Z",
          updated_at: "2026-04-25T10:00:00.000Z",
          executed_at: null,
          source_plan_id: "44444444-4444-4444-8444-444444444444",
          source_plan_name: "April regional package",
        },
      ],
    });

    const rows = await repository.listStagePackagePlans({
      competitionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });

    const sql = databaseService.query.mock.calls[0][0] as string;
    const params = databaseService.query.mock.calls[0][1] as unknown[];
    expect(sql).toContain("FROM ops.competition_stage_package_plan");
    expect(sql).toContain("competition_id = $1::uuid");
    expect(sql).toContain("competition_stage_package_plan.cloned_from_returned");
    expect(params).toEqual(["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"]);
    expect(rows).toEqual([
      expect.objectContaining({
        planName: "April regional package",
        planStatus: "draft",
        sourcePlan: {
          planId: "44444444-4444-4444-8444-444444444444",
          planName: "April regional package",
        },
        stageDrafts: validStagePackageStages,
      }),
    ]);
  });

  it("lists stage package plan audit events", async () => {
    const { repository, databaseService } = createReadRepositoryHarness();

    databaseService.query.mockResolvedValue({
      rowCount: 2,
      rows: [
        {
          event_log_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          occurred_at: "2026-04-25T10:00:00.000Z",
          actor_user_id: "11111111-1111-4111-8111-111111111111",
          event_type: "competition_stage_package_plan.saved",
          metadata_json: { planName: "April regional package" },
        },
        {
          event_log_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          occurred_at: "2026-04-25T10:10:00.000Z",
          actor_user_id: "11111111-1111-4111-8111-111111111111",
          event_type: "competition_stage_package_plan.updated",
          metadata_json: { planName: "April regional package revised" },
        },
      ],
    });

    const events = await repository.listStagePackagePlanAudit({
      planId: "55555555-5555-4555-8555-555555555555",
    });

    const sql = databaseService.query.mock.calls[0][0] as string;
    const params = databaseService.query.mock.calls[0][1] as unknown[];
    expect(sql).toContain("FROM audit.event_log");
    expect(sql).toContain("entity_name = 'ops.competition_stage_package_plan'");
    expect(params).toEqual(["55555555-5555-4555-8555-555555555555"]);
    expect(events).toEqual([
      expect.objectContaining({
        eventType: "competition_stage_package_plan.saved",
        metadata: { planName: "April regional package" },
      }),
      expect.objectContaining({
        eventType: "competition_stage_package_plan.updated",
        metadata: { planName: "April regional package revised" },
      }),
    ]);
  });
});
