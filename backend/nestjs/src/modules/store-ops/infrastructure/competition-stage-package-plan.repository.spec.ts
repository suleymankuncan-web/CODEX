import { CompetitionRepository } from "./competition.repository";

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

function createRepositoryHarness() {
  const executedSql: string[] = [];
  const executedParams: unknown[][] = [];
  const queryMock = jest.fn(
    async (
      sql: string,
      params: unknown[] = [],
    ): Promise<{ rowCount: number; rows: Record<string, unknown>[] }> => {
      executedSql.push(sql);
      executedParams.push(params);

      if (sql.includes("UPDATE ops.competition_stage")) {
        return {
          rowCount: 1,
          rows: [
            {
              competition_stage_id: "22222222-2222-4222-8222-222222222222",
              competition_id: "11111111-1111-4111-8111-111111111111",
              stage_code: "QUALIFIER",
              stage_name: "Qualifier",
              stage_order: 1,
              stage_type: "qualifier",
              starts_on: "2026-04-01",
              ends_on: "2026-04-15",
              lifecycle_state: "finalized",
              finalization_state: "overridden",
            },
          ],
        };
      }

      return { rowCount: 2, rows: [] };
    },
  );
  const client = {
    query: queryMock,
  };
  const databaseService = {
    withTransaction: jest.fn(async (work: (transactionClient: typeof client) => Promise<unknown>) =>
      work(client),
    ),
    query: jest.fn(),
  };

  return {
    repository: new CompetitionRepository(databaseService as never),
    databaseService,
    client,
    executedSql,
    executedParams,
  };
}

describe("CompetitionRepository stage package plans", () => {
  it("lists stage package plan drafts for a competition", async () => {
    const { repository, databaseService } = createRepositoryHarness();
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

  it("saves a stage package plan draft and writes audit metadata", async () => {
    const { repository, client, executedSql, executedParams } = createRepositoryHarness();

    client.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
      executedSql.push(sql);
      executedParams.push(params);

      if (sql.includes("INSERT INTO ops.competition_stage_package_plan")) {
        return {
          rowCount: 1,
          rows: [
            {
              competition_stage_package_plan_id:
                "55555555-5555-4555-8555-555555555555",
              competition_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              package_code: "league_then_final",
              plan_name: "April regional package",
              plan_status: "draft",
              stage_drafts_json: validStagePackageStages,
              created_stage_ids: [],
              created_at: "2026-04-25T10:00:00.000Z",
              updated_at: "2026-04-25T10:00:00.000Z",
              executed_at: null,
            },
          ],
        };
      }

      return { rowCount: 1, rows: [] };
    });

    const plan = await repository.createStagePackagePlan({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      competitionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      packageCode: "league_then_final",
      planName: "April regional package",
      stages: validStagePackageStages,
    });

    const sql = executedSql.join("\n");
    const serializedParams = JSON.stringify(executedParams);
    expect(sql).toContain("INSERT INTO ops.competition_stage_package_plan");
    expect(sql).toContain("INSERT INTO audit.event_log");
    expect(serializedParams).toContain("competition_stage_package_plan.saved");
    expect(serializedParams).toContain("April regional package");
    expect(plan).toEqual(
      expect.objectContaining({
        planName: "April regional package",
        planStatus: "draft",
        createdStageIds: [],
      }),
    );
  });

  it("updates a draft stage package plan and writes audit metadata", async () => {
    const { repository, databaseService, client, executedSql, executedParams } =
      createRepositoryHarness();
    const updatedStages = validStagePackageStages.map((stage) =>
      stage.stageOrder === 2
        ? { ...stage, stageName: "Revised Final Showdown" }
        : stage,
    );

    client.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
      executedSql.push(sql);
      executedParams.push(params);

      if (
        sql.includes("FROM ops.competition_stage_package_plan") &&
        sql.includes("FOR UPDATE")
      ) {
        return {
          rowCount: 1,
          rows: [
            {
              competition_stage_package_plan_id:
                "55555555-5555-4555-8555-555555555555",
              competition_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              package_code: "league_then_final",
              plan_name: "April regional package",
              plan_status: "draft",
              stage_drafts_json: validStagePackageStages,
              created_stage_ids: [],
              created_at: "2026-04-25T10:00:00.000Z",
              updated_at: "2026-04-25T10:00:00.000Z",
              executed_at: null,
            },
          ],
        };
      }

      if (sql.includes("UPDATE ops.competition_stage_package_plan")) {
        return {
          rowCount: 1,
          rows: [
            {
              competition_stage_package_plan_id:
                "55555555-5555-4555-8555-555555555555",
              competition_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              package_code: "league_then_final",
              plan_name: "April regional package revised",
              plan_status: "draft",
              stage_drafts_json: updatedStages,
              created_stage_ids: [],
              created_at: "2026-04-25T10:00:00.000Z",
              updated_at: "2026-04-25T10:10:00.000Z",
              executed_at: null,
            },
          ],
        };
      }

      return { rowCount: 1, rows: [] };
    });

    const plan = await repository.updateStagePackagePlan({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      planId: "55555555-5555-4555-8555-555555555555",
      packageCode: "league_then_final",
      planName: "April regional package revised",
      stages: updatedStages,
    });

    const sql = executedSql.join("\n");
    const serializedParams = JSON.stringify(executedParams);
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain("UPDATE ops.competition_stage_package_plan");
    expect(sql).toContain("INSERT INTO audit.event_log");
    expect(serializedParams).toContain("competition_stage_package_plan.updated");
    expect(serializedParams).toContain("Revised Final Showdown");
    expect(plan).toEqual(
      expect.objectContaining({
        planName: "April regional package revised",
        planStatus: "draft",
        stageDrafts: updatedStages,
      }),
    );
  });

  it("rejects updating an executed stage package plan", async () => {
    const { repository, client, executedSql } = createRepositoryHarness();

    client.query.mockImplementation(async (sql: string, _params: unknown[] = []) => {
      executedSql.push(sql);

      if (
        sql.includes("FROM ops.competition_stage_package_plan") &&
        sql.includes("FOR UPDATE")
      ) {
        return {
          rowCount: 1,
          rows: [
            {
              competition_stage_package_plan_id:
                "55555555-5555-4555-8555-555555555555",
              competition_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              package_code: "league_then_final",
              plan_name: "April regional package",
              plan_status: "executed",
              stage_drafts_json: validStagePackageStages,
              created_stage_ids: [
                "22222222-2222-4222-8222-222222222222",
                "33333333-3333-4333-8333-333333333333",
              ],
              created_at: "2026-04-25T10:00:00.000Z",
              updated_at: "2026-04-25T10:05:00.000Z",
              executed_at: "2026-04-25T10:05:00.000Z",
            },
          ],
        };
      }

      return { rowCount: 1, rows: [] };
    });

    await expect(
      repository.updateStagePackagePlan({
        actorUserId: "11111111-1111-4111-8111-111111111111",
        planId: "55555555-5555-4555-8555-555555555555",
        packageCode: "league_then_final",
        planName: "April regional package revised",
        stages: validStagePackageStages,
      }),
    ).rejects.toThrow("Stage package plan is not editable");

    expect(executedSql.join("\n")).not.toContain("UPDATE ops.competition_stage_package_plan");
  });

  it("cancels a draft stage package plan and writes audit metadata", async () => {
    const { repository, client, executedSql, executedParams } = createRepositoryHarness();

    client.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
      executedSql.push(sql);
      executedParams.push(params);

      if (
        sql.includes("FROM ops.competition_stage_package_plan") &&
        sql.includes("FOR UPDATE")
      ) {
        return {
          rowCount: 1,
          rows: [
            {
              competition_stage_package_plan_id:
                "55555555-5555-4555-8555-555555555555",
              competition_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              package_code: "league_then_final",
              plan_name: "April regional package",
              plan_status: "draft",
              stage_drafts_json: validStagePackageStages,
              created_stage_ids: [],
              created_at: "2026-04-25T10:00:00.000Z",
              updated_at: "2026-04-25T10:00:00.000Z",
              executed_at: null,
            },
          ],
        };
      }

      if (sql.includes("UPDATE ops.competition_stage_package_plan")) {
        return {
          rowCount: 1,
          rows: [
            {
              competition_stage_package_plan_id:
                "55555555-5555-4555-8555-555555555555",
              competition_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              package_code: "league_then_final",
              plan_name: "April regional package",
              plan_status: "cancelled",
              stage_drafts_json: validStagePackageStages,
              created_stage_ids: [],
              created_at: "2026-04-25T10:00:00.000Z",
              updated_at: "2026-04-25T10:12:00.000Z",
              executed_at: null,
            },
          ],
        };
      }

      return { rowCount: 1, rows: [] };
    });

    const plan = await repository.cancelStagePackagePlan({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      planId: "55555555-5555-4555-8555-555555555555",
    });

    const sql = executedSql.join("\n");
    const serializedParams = JSON.stringify(executedParams);
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain("plan_status = $2");
    expect(sql).toContain("INSERT INTO audit.event_log");
    expect(serializedParams).toContain("cancelled");
    expect(serializedParams).toContain("competition_stage_package_plan.cancelled");
    expect(plan).toEqual(
      expect.objectContaining({
        planName: "April regional package",
        planStatus: "cancelled",
      }),
    );
  });

  it("submits a draft stage package plan and writes audit metadata", async () => {
    const { repository, client, executedSql, executedParams } = createRepositoryHarness();

    client.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
      executedSql.push(sql);
      executedParams.push(params);

      if (
        sql.includes("FROM ops.competition_stage_package_plan") &&
        sql.includes("FOR UPDATE")
      ) {
        return {
          rowCount: 1,
          rows: [
            {
              competition_stage_package_plan_id:
                "55555555-5555-4555-8555-555555555555",
              competition_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              package_code: "league_then_final",
              plan_name: "April regional package",
              plan_status: "draft",
              stage_drafts_json: validStagePackageStages,
              created_stage_ids: [],
              created_at: "2026-04-25T10:00:00.000Z",
              updated_at: "2026-04-25T10:00:00.000Z",
              executed_at: null,
            },
          ],
        };
      }

      if (sql.includes("UPDATE ops.competition_stage_package_plan")) {
        return {
          rowCount: 1,
          rows: [
            {
              competition_stage_package_plan_id:
                "55555555-5555-4555-8555-555555555555",
              competition_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              package_code: "league_then_final",
              plan_name: "April regional package",
              plan_status: "submitted",
              stage_drafts_json: validStagePackageStages,
              created_stage_ids: [],
              submitted_by_user_id: "11111111-1111-4111-8111-111111111111",
              submitted_at: "2026-04-25T10:15:00.000Z",
              reviewed_by_user_id: null,
              reviewed_at: null,
              review_note: null,
              created_at: "2026-04-25T10:00:00.000Z",
              updated_at: "2026-04-25T10:15:00.000Z",
              executed_at: null,
            },
          ],
        };
      }

      return { rowCount: 1, rows: [] };
    });

    const plan = await repository.submitStagePackagePlan({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      planId: "55555555-5555-4555-8555-555555555555",
    });

    const sql = executedSql.join("\n");
    const serializedParams = JSON.stringify(executedParams);
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain("plan_status = $2");
    expect(sql).toContain("submitted_by_user_id = $3");
    expect(sql).toContain("INSERT INTO audit.event_log");
    expect(serializedParams).toContain("submitted");
    expect(serializedParams).toContain("competition_stage_package_plan.submitted");
    expect(plan).toEqual(
      expect.objectContaining({
        planStatus: "submitted",
        submittedByUserId: "11111111-1111-4111-8111-111111111111",
      }),
    );
  });

  it("approves a submitted stage package plan and writes audit metadata", async () => {
    const { repository, databaseService, client, executedSql, executedParams } =
      createRepositoryHarness();

    client.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
      executedSql.push(sql);
      executedParams.push(params);

      if (
        sql.includes("FROM ops.competition_stage_package_plan") &&
        sql.includes("FOR UPDATE")
      ) {
        return {
          rowCount: 1,
          rows: [
            {
              competition_stage_package_plan_id:
                "55555555-5555-4555-8555-555555555555",
              competition_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              package_code: "league_then_final",
              plan_name: "April regional package",
              plan_status: "submitted",
              stage_drafts_json: validStagePackageStages,
              created_stage_ids: [],
              submitted_by_user_id: "11111111-1111-4111-8111-111111111111",
              submitted_at: "2026-04-25T10:15:00.000Z",
              reviewed_by_user_id: null,
              reviewed_at: null,
              review_note: null,
              created_at: "2026-04-25T10:00:00.000Z",
              updated_at: "2026-04-25T10:15:00.000Z",
              executed_at: null,
            },
          ],
        };
      }

      if (sql.includes("UPDATE ops.competition_stage_package_plan")) {
        return {
          rowCount: 1,
          rows: [
            {
              competition_stage_package_plan_id:
                "55555555-5555-4555-8555-555555555555",
              competition_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              package_code: "league_then_final",
              plan_name: "April regional package",
              plan_status: "approved",
              stage_drafts_json: validStagePackageStages,
              created_stage_ids: [],
              submitted_by_user_id: "11111111-1111-4111-8111-111111111111",
              submitted_at: "2026-04-25T10:15:00.000Z",
              reviewed_by_user_id: "22222222-2222-4222-8222-222222222222",
              reviewed_at: "2026-04-25T10:20:00.000Z",
              review_note: "Reviewed in planning meeting.",
              created_at: "2026-04-25T10:00:00.000Z",
              updated_at: "2026-04-25T10:20:00.000Z",
              executed_at: null,
            },
          ],
        };
      }

      return { rowCount: 1, rows: [] };
    });

    const plan = await repository.approveStagePackagePlan({
      actorUserId: "22222222-2222-4222-8222-222222222222",
      planId: "55555555-5555-4555-8555-555555555555",
      reviewNote: "Reviewed in planning meeting.",
    });

    const sql = executedSql.join("\n");
    const serializedParams = JSON.stringify(executedParams);
    expect(databaseService.withTransaction).toHaveBeenCalledTimes(1);
    expect(executedSql[0]).toContain("FOR UPDATE");
    expect(executedSql[1]).toContain("UPDATE ops.competition_stage_package_plan");
    expect(executedSql[2]).toContain("INSERT INTO audit.event_log");
    expect(executedParams[1]).toEqual([
      "55555555-5555-4555-8555-555555555555",
      "approved",
      "22222222-2222-4222-8222-222222222222",
      "Reviewed in planning meeting.",
    ]);
    expect(sql).toContain("plan_status = $2");
    expect(sql).toContain("reviewed_by_user_id = $3");
    expect(sql).toContain("review_note = $4");
    expect(serializedParams).toContain("approved");
    expect(serializedParams).toContain("competition_stage_package_plan.approved");
    expect(plan).toEqual(
      expect.objectContaining({
        planStatus: "approved",
        reviewedByUserId: "22222222-2222-4222-8222-222222222222",
        reviewNote: "Reviewed in planning meeting.",
      }),
    );
  });

  it("rejects a submitted stage package plan and writes audit metadata", async () => {
    const { repository, databaseService, client, executedSql, executedParams } =
      createRepositoryHarness();

    client.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
      executedSql.push(sql);
      executedParams.push(params);

      if (
        sql.includes("FROM ops.competition_stage_package_plan") &&
        sql.includes("FOR UPDATE")
      ) {
        return {
          rowCount: 1,
          rows: [
            {
              competition_stage_package_plan_id:
                "55555555-5555-4555-8555-555555555555",
              competition_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              package_code: "league_then_final",
              plan_name: "April regional package",
              plan_status: "submitted",
              stage_drafts_json: validStagePackageStages,
              created_stage_ids: [],
              created_at: "2026-04-25T10:00:00.000Z",
              updated_at: "2026-04-25T10:15:00.000Z",
              executed_at: null,
            },
          ],
        };
      }

      if (sql.includes("UPDATE ops.competition_stage_package_plan")) {
        return {
          rowCount: 1,
          rows: [
            {
              competition_stage_package_plan_id:
                "55555555-5555-4555-8555-555555555555",
              competition_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              package_code: "league_then_final",
              plan_name: "April regional package",
              plan_status: "rejected",
              stage_drafts_json: validStagePackageStages,
              created_stage_ids: [],
              reviewed_by_user_id: "22222222-2222-4222-8222-222222222222",
              reviewed_at: "2026-04-25T10:20:00.000Z",
              review_note: "Dates need another pass.",
              created_at: "2026-04-25T10:00:00.000Z",
              updated_at: "2026-04-25T10:20:00.000Z",
              executed_at: null,
            },
          ],
        };
      }

      return { rowCount: 1, rows: [] };
    });

    const plan = await repository.rejectStagePackagePlan({
      actorUserId: "22222222-2222-4222-8222-222222222222",
      planId: "55555555-5555-4555-8555-555555555555",
      reviewNote: "Dates need another pass.",
    });

    const sql = executedSql.join("\n");
    const serializedParams = JSON.stringify(executedParams);
    expect(databaseService.withTransaction).toHaveBeenCalledTimes(1);
    expect(executedSql[0]).toContain("FOR UPDATE");
    expect(executedSql[1]).toContain("UPDATE ops.competition_stage_package_plan");
    expect(executedSql[2]).toContain("INSERT INTO audit.event_log");
    expect(executedParams[1]).toEqual([
      "55555555-5555-4555-8555-555555555555",
      "rejected",
      "22222222-2222-4222-8222-222222222222",
      "Dates need another pass.",
    ]);
    expect(sql).toContain("plan_status = $2");
    expect(sql).toContain("INSERT INTO audit.event_log");
    expect(serializedParams).toContain("rejected");
    expect(serializedParams).toContain("competition_stage_package_plan.rejected");
    expect(plan).toEqual(
      expect.objectContaining({
        planStatus: "rejected",
        reviewNote: "Dates need another pass.",
      }),
    );
  });

  it("clones a rejected stage package plan as a clean draft and writes audit metadata", async () => {
    const { repository, client, executedSql, executedParams } = createRepositoryHarness();

    client.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
      executedSql.push(sql);
      executedParams.push(params);

      if (
        sql.includes("FROM ops.competition_stage_package_plan") &&
        sql.includes("FOR UPDATE")
      ) {
        return {
          rowCount: 1,
          rows: [
            {
              competition_stage_package_plan_id:
                "55555555-5555-4555-8555-555555555555",
              competition_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              package_code: "league_then_final",
              plan_name: "April regional package",
              plan_status: "rejected",
              stage_drafts_json: validStagePackageStages,
              created_stage_ids: [],
              submitted_by_user_id: "11111111-1111-4111-8111-111111111111",
              submitted_at: "2026-04-25T10:15:00.000Z",
              reviewed_by_user_id: "22222222-2222-4222-8222-222222222222",
              reviewed_at: "2026-04-25T10:20:00.000Z",
              review_note: "Dates need another pass.",
              created_at: "2026-04-25T10:00:00.000Z",
              updated_at: "2026-04-25T10:20:00.000Z",
              executed_at: null,
            },
          ],
        };
      }

      if (sql.includes("INSERT INTO ops.competition_stage_package_plan")) {
        return {
          rowCount: 1,
          rows: [
            {
              competition_stage_package_plan_id:
                "66666666-6666-4666-8666-666666666666",
              competition_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              package_code: "league_then_final",
              plan_name: "April regional package revision",
              plan_status: "draft",
              stage_drafts_json: validStagePackageStages,
              created_stage_ids: [],
              submitted_by_user_id: null,
              submitted_at: null,
              reviewed_by_user_id: null,
              reviewed_at: null,
              review_note: null,
              created_at: "2026-04-25T10:25:00.000Z",
              updated_at: "2026-04-25T10:25:00.000Z",
              executed_at: null,
            },
          ],
        };
      }

      return { rowCount: 1, rows: [] };
    });

    const plan = await repository.cloneStagePackagePlan({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      sourcePlanId: "55555555-5555-4555-8555-555555555555",
    });

    const sql = executedSql.join("\n");
    const serializedParams = JSON.stringify(executedParams);
    expect(sql).toContain("FOR UPDATE");
    expect(sql).toContain("INSERT INTO ops.competition_stage_package_plan");
    expect(serializedParams).toContain("April regional package revision");
    expect(serializedParams).toContain("competition_stage_package_plan.cloned_to_draft");
    expect(serializedParams).toContain("competition_stage_package_plan.cloned_from_returned");
    expect(plan).toEqual(
      expect.objectContaining({
        planId: "66666666-6666-4666-8666-666666666666",
        planName: "April regional package revision",
        planStatus: "draft",
        createdStageIds: [],
        submittedByUserId: null,
        reviewedByUserId: null,
      }),
    );
  });

  it("rejects cloning a non-rejected stage package plan", async () => {
    const { repository, client, executedSql } = createRepositoryHarness();

    client.query.mockImplementation(async (sql: string) => {
      executedSql.push(sql);

      if (
        sql.includes("FROM ops.competition_stage_package_plan") &&
        sql.includes("FOR UPDATE")
      ) {
        return {
          rowCount: 1,
          rows: [
            {
              competition_stage_package_plan_id:
                "55555555-5555-4555-8555-555555555555",
              competition_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              package_code: "league_then_final",
              plan_name: "April regional package",
              plan_status: "draft",
              stage_drafts_json: validStagePackageStages,
              created_stage_ids: [],
              created_at: "2026-04-25T10:00:00.000Z",
              updated_at: "2026-04-25T10:00:00.000Z",
              executed_at: null,
            },
          ],
        };
      }

      return { rowCount: 1, rows: [] };
    });

    await expect(
      repository.cloneStagePackagePlan({
        actorUserId: "11111111-1111-4111-8111-111111111111",
        sourcePlanId: "55555555-5555-4555-8555-555555555555",
      }),
    ).rejects.toThrow("Stage package plan is not cloneable");

    expect(executedSql.join("\n")).not.toContain(
      "INSERT INTO ops.competition_stage_package_plan",
    );
  });

  it("lists stage package plan audit events", async () => {
    const { repository, databaseService } = createRepositoryHarness();

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
