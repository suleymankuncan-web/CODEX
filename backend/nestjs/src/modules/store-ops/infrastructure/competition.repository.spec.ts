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

describe("CompetitionRepository", () => {
  it("stores stage preset code in advancement rule and audit metadata", async () => {
    const { repository, client, executedParams } = createRepositoryHarness();
    client.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
      executedParams.push(params);

      if (sql.includes("INSERT INTO ops.competition_stage")) {
        return {
          rowCount: 1,
          rows: [
            {
              competition_stage_id: "22222222-2222-4222-8222-222222222222",
              competition_id: "11111111-1111-4111-8111-111111111111",
              stage_code: "REGION_LEAGUE",
              stage_name: "Regional League",
              stage_order: 1,
              stage_type: "league",
              starts_on: "2026-05-01",
              ends_on: "2026-05-31",
              lifecycle_state: "active",
              finalization_state: null,
            },
          ],
        };
      }

      if (sql.includes("INSERT INTO ops.competition_team ")) {
        return {
          rowCount: 1,
          rows: [
            {
              competition_team_id: "33333333-3333-4333-8333-333333333333",
            },
          ],
        };
      }

      return { rowCount: 1, rows: [] };
    });

    await repository.createStageWithTeams({
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

    const serializedParams = JSON.stringify(executedParams);
    expect(serializedParams).toContain("rank_all");
    expect(serializedParams).toContain("region_league");
    expect(serializedParams).toContain("stagePresetCode");
  });

  it("creates package stages in one transaction and writes package audit metadata", async () => {
    const { repository, databaseService, client, executedSql, executedParams } =
      createRepositoryHarness();
    let stageInsertCount = 0;
    let teamInsertCount = 0;

    client.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
      executedSql.push(sql);
      executedParams.push(params);

      if (sql.includes("INSERT INTO ops.competition_stage")) {
        stageInsertCount += 1;
        const isFinal = stageInsertCount === 2;

        return {
          rowCount: 1,
          rows: [
            {
              competition_stage_id: isFinal
                ? "33333333-3333-4333-8333-333333333333"
                : "22222222-2222-4222-8222-222222222222",
              competition_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              stage_code: isFinal ? "FINAL_SHOWDOWN" : "REGION_LEAGUE",
              stage_name: isFinal ? "Final Showdown" : "Regional League",
              stage_order: isFinal ? 2 : 1,
              stage_type: isFinal ? "final" : "league",
              starts_on: isFinal ? "2026-05-16" : "2026-05-01",
              ends_on: "2026-05-31",
              lifecycle_state: "active",
              finalization_state: null,
            },
          ],
        };
      }

      if (sql.includes("INSERT INTO ops.competition_team ")) {
        teamInsertCount += 1;

        return {
          rowCount: 1,
          rows: [
            {
              competition_team_id: `44444444-4444-4444-8444-44444444444${teamInsertCount}`,
            },
          ],
        };
      }

      return { rowCount: 1, rows: [] };
    });

    const stages = await repository.createStagePackage({
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

    const serializedParams = JSON.stringify(executedParams);

    expect(databaseService.withTransaction).toHaveBeenCalledTimes(1);
    expect(stageInsertCount).toBe(2);
    expect(stages).toHaveLength(2);
    expect(executedSql.join("\n")).toContain("INSERT INTO audit.event_log");
    expect(serializedParams).toContain("competition_stage_package.created");
    expect(serializedParams).toContain("league_then_final");
    expect(serializedParams).toContain("REGION_LEAGUE");
    expect(serializedParams).toContain("FINAL_SHOWDOWN");
  });
  it("rejects executing a draft stage package plan before approval", async () => {
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
      repository.executeStagePackagePlan({
        actorUserId: "11111111-1111-4111-8111-111111111111",
        planId: "55555555-5555-4555-8555-555555555555",
      }),
    ).rejects.toThrow("Stage package plan is not executable");

    expect(executedSql.join("\n")).not.toContain("INSERT INTO ops.competition_stage");
  });

  it("executes an approved stage package plan once in a transaction", async () => {
    const { repository, databaseService, client, executedSql, executedParams } =
      createRepositoryHarness();
    let stageInsertCount = 0;
    let teamInsertCount = 0;

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

      if (sql.includes("INSERT INTO ops.competition_stage")) {
        stageInsertCount += 1;
        const isFinal = stageInsertCount === 2;

        return {
          rowCount: 1,
          rows: [
            {
              competition_stage_id: isFinal
                ? "33333333-3333-4333-8333-333333333333"
                : "22222222-2222-4222-8222-222222222222",
              competition_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              stage_code: isFinal ? "FINAL_SHOWDOWN" : "REGION_LEAGUE",
              stage_name: isFinal ? "Final Showdown" : "Regional League",
              stage_order: isFinal ? 2 : 1,
              stage_type: isFinal ? "final" : "league",
              starts_on: isFinal ? "2026-05-16" : "2026-05-01",
              ends_on: "2026-05-31",
              lifecycle_state: "active",
              finalization_state: null,
            },
          ],
        };
      }

      if (sql.includes("INSERT INTO ops.competition_team ")) {
        teamInsertCount += 1;

        return {
          rowCount: 1,
          rows: [
            {
              competition_team_id: `44444444-4444-4444-8444-44444444444${teamInsertCount}`,
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

    const result = await repository.executeStagePackagePlan({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      planId: "55555555-5555-4555-8555-555555555555",
    });

    const sql = executedSql.join("\n");
    const serializedParams = JSON.stringify(executedParams);
    expect(databaseService.withTransaction).toHaveBeenCalledTimes(1);
    expect(sql).toContain("FOR UPDATE");
    expect(stageInsertCount).toBe(2);
    expect(result.stages).toHaveLength(2);
    expect(result.plan).toEqual(
      expect.objectContaining({
        planStatus: "executed",
        createdStageIds: [
          "22222222-2222-4222-8222-222222222222",
          "33333333-3333-4333-8333-333333333333",
        ],
      }),
    );
    expect(sql).toContain("INSERT INTO audit.event_log");
    expect(serializedParams).toContain("competition_stage_package_plan.executed");
    expect(serializedParams).toContain("55555555-5555-4555-8555-555555555555");
  });

  it("rejects executing a stage package plan that is already executed", async () => {
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
      repository.executeStagePackagePlan({
        actorUserId: "11111111-1111-4111-8111-111111111111",
        planId: "55555555-5555-4555-8555-555555555555",
      }),
    ).rejects.toThrow("Stage package plan is not executable");

    expect(executedSql.join("\n")).not.toContain("INSERT INTO ops.competition_stage");
  });

  it("recalculates stage scores from completed one-day store snapshots and checklist facts", async () => {
    const { repository, executedSql } = createRepositoryHarness();

    await repository.recalculateStage({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      stageId: "22222222-2222-4222-8222-222222222222",
    });

    const sql = executedSql.join("\n");
    const warningDeleteIndex = executedSql.findIndex((statement) =>
      statement.includes("DELETE FROM rpt.competition_stage_warning"),
    );
    const teamSnapshotDeleteIndex = executedSql.findIndex((statement) =>
      statement.includes("DELETE FROM rpt.competition_stage_score_snapshot"),
    );
    const storeSnapshotDeleteIndex = executedSql.findIndex((statement) =>
      statement.includes("DELETE FROM rpt.competition_stage_store_score_snapshot"),
    );
    expect(warningDeleteIndex).toBeGreaterThanOrEqual(0);
    expect(teamSnapshotDeleteIndex).toBeGreaterThan(warningDeleteIndex);
    expect(storeSnapshotDeleteIndex).toBeGreaterThan(teamSnapshotDeleteIndex);
    expect(sql).toContain("FROM rpt.snapshot_run run");
    expect(sql).toContain("run.period_start = run.period_end");
    expect(sql).toContain("('TARGET_ACHIEVEMENT', 35::numeric)");
    expect(sql).toContain("('CR', 20::numeric)");
    expect(sql).toContain("('ATV', 15::numeric)");
    expect(sql).toContain("('UPT', 15::numeric)");
    expect(sql).toContain("('BM_CHECKLIST', 5::numeric)");
    expect(sql).toContain("('VM_CHECKLIST', 5::numeric)");
    expect(sql).toContain("('gsm_approval', 5::numeric)");
    expect(sql).toContain("'BM_CHECKLIST'");
    expect(sql).toContain("'VM_CHECKLIST'");
    expect(sql).toContain("'gsm_approval'");
    expect(sql).toContain("CASE WHEN has_daily_data THEN score_value ELSE NULL END");
    expect(sql).toContain("SUM(CASE WHEN actual_value IS NULL AND achievement_rate IS NULL THEN 0 ELSE weight_percent END)");
    expect(sql).toContain("competition_stage_store_score_snapshot");
    expect(sql).toContain("competition_stage_warning");
    expect(sql).toContain("CASE WHEN warning.warning_code = 'missing_daily_store_data' THEN 'blocker' ELSE 'warning' END");
    expect(sql).toContain("AVG(score_value) FILTER (WHERE score_value IS NOT NULL)");
    expect(sql).toContain("CASE WHEN total_store_count = 0 THEN 0 ELSE valid_store_count::numeric / total_store_count::numeric END");
    expect(sql).toContain("DENSE_RANK()");
  });

  it("writes finalization audit metadata with unresolved warning count", async () => {
    const { repository, executedSql, executedParams } = createRepositoryHarness();

    await repository.finalizeStage({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      stageId: "22222222-2222-4222-8222-222222222222",
      finalizationState: "overridden",
      finalizationNote: "Checklist source was verified manually.",
      unresolvedWarningCount: 2,
    });

    expect(executedSql.join("\n")).toContain("INSERT INTO audit.event_log");
    expect(JSON.stringify(executedParams)).toContain("competition_stage.finalized");
    expect(JSON.stringify(executedParams)).toContain("unresolvedWarningCount");
    expect(JSON.stringify(executedParams)).toContain("Checklist source was verified manually.");
  });

  it("reads store contribution rows through the caller read scope", async () => {
    const { repository, databaseService } = createRepositoryHarness();
    databaseService.query.mockResolvedValue({
      rowCount: 1,
      rows: [
        {
          stage_id: "22222222-2222-4222-8222-222222222222",
          team_id: "33333333-3333-4333-8333-333333333333",
          team_code: "MARMARA",
          team_name: "Marmara",
          store_id: "44444444-4444-4444-8444-444444444444",
          store_code: "IST-001",
          store_name: "Visible Store",
          region_id: "55555555-5555-4555-8555-555555555555",
          snapshot_date: "2026-04-22",
          score_value: "93.5000",
          reported_weight_percent: "95.0000",
          expected_weight_percent: "100.0000",
          has_daily_data: true,
          missing_kpi_codes: ["BM_CHECKLIST"],
        },
      ],
    });

    const rows = await repository.listStoreContributionsForCompetition({
      competitionId: "11111111-1111-4111-8111-111111111111",
      companyIds: [],
      regionIds: ["55555555-5555-4555-8555-555555555555"],
      storeIds: ["44444444-4444-4444-8444-444444444444"],
    });

    const sql = databaseService.query.mock.calls[0][0] as string;
    const params = databaseService.query.mock.calls[0][1] as unknown[];
    expect(sql).toContain("FROM rpt.competition_stage_store_score_snapshot store_score");
    expect(sql).toContain("store.region_id = ANY($3::uuid[])");
    expect(sql).toContain("store.store_id = ANY($4::uuid[])");
    expect(params).toEqual([
      "11111111-1111-4111-8111-111111111111",
      [],
      ["55555555-5555-4555-8555-555555555555"],
      ["44444444-4444-4444-8444-444444444444"],
    ]);
    expect(rows).toEqual([
      expect.objectContaining({
        storeId: "44444444-4444-4444-8444-444444444444",
        scoreValue: 93.5,
        reportedWeightPercent: 95,
        missingKpiCodes: ["BM_CHECKLIST"],
      }),
    ]);
  });

  it("returns no competitions without querying when actor scope is empty", async () => {
    const { repository, databaseService } = createRepositoryHarness();

    await expect(
      repository.listCompetitions({
        companyIds: [],
        regionIds: [],
        storeIds: [],
        limit: 50,
        offset: 0,
      }),
    ).resolves.toEqual([]);

    expect(databaseService.query).not.toHaveBeenCalled();
  });

  it("compares owner user ids as text when listing owned competitions", async () => {
    const { repository, databaseService } = createRepositoryHarness();
    databaseService.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    await repository.listCompetitions({
      companyIds: [],
      regionIds: [],
      storeIds: [],
      actorUserId: "auth-provider-subject",
      limit: 50,
      offset: 0,
    });

    const sql = databaseService.query.mock.calls[0][0] as string;
    const params = databaseService.query.mock.calls[0][1] as unknown[];
    expect(sql).toContain("$6::text IS NOT NULL");
    expect(sql).toContain("competition.owner_user_id = $6::text");
    expect(sql).not.toContain("competition.owner_user_id = $6::uuid");
    expect(params[5]).toBe("auth-provider-subject");
  });

  it("compares owner user ids as text when reading owned competition details", async () => {
    const { repository, databaseService } = createRepositoryHarness();
    databaseService.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    await expect(
      repository.getCompetitionDetail({
        competitionId: "11111111-1111-4111-8111-111111111111",
        companyIds: [],
        regionIds: [],
        storeIds: [],
        actorUserId: "auth-provider-subject",
      }),
    ).resolves.toBeNull();

    const sql = databaseService.query.mock.calls[0][0] as string;
    const params = databaseService.query.mock.calls[0][1] as unknown[];
    expect(sql).toContain("$5::text IS NOT NULL");
    expect(sql).toContain("competition.owner_user_id = $5::text");
    expect(sql).not.toContain("competition.owner_user_id = $5::uuid");
    expect(params[4]).toBe("auth-provider-subject");
  });

  it("returns no competition detail or contribution rows without querying when actor scope is empty", async () => {
    const { repository, databaseService } = createRepositoryHarness();

    await expect(
      repository.getCompetitionDetail({
        competitionId: "11111111-1111-4111-8111-111111111111",
        companyIds: [],
        regionIds: [],
        storeIds: [],
      }),
    ).resolves.toBeNull();
    await expect(
      repository.listStoreContributionsForCompetition({
        competitionId: "11111111-1111-4111-8111-111111111111",
        companyIds: [],
        regionIds: [],
        storeIds: [],
      }),
    ).resolves.toEqual([]);

    expect(databaseService.query).not.toHaveBeenCalled();
  });
});
