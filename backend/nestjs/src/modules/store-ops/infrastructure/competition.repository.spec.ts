import { CompetitionRepository } from "./competition.repository";

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
  it("lists active team templates with store memberships", async () => {
    const { repository, databaseService } = createRepositoryHarness();
    databaseService.query.mockResolvedValue({
      rowCount: 2,
      rows: [
        {
          competition_team_template_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          template_code: "MARMARA_A",
          template_name: "Marmara A",
          description: "Marmara stores",
          is_active: true,
          store_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          store_code: "IST-001",
          store_name: "IstinyePark",
          region_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        },
        {
          competition_team_template_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          template_code: "MARMARA_A",
          template_name: "Marmara A",
          description: "Marmara stores",
          is_active: true,
          store_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          store_code: "IST-002",
          store_name: "Kadikoy",
          region_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        },
      ],
    });

    const rows = await repository.listTeamTemplates({ activeOnly: true });

    const sql = databaseService.query.mock.calls[0][0] as string;
    expect(sql).toContain("FROM ops.competition_team_template template");
    expect(sql).toContain("LEFT JOIN ops.competition_team_template_store template_store");
    expect(sql).toContain("template.is_active = TRUE");
    expect(rows).toEqual([
      expect.objectContaining({
        templateCode: "MARMARA_A",
        stores: [
          expect.objectContaining({ storeCode: "IST-001" }),
          expect.objectContaining({ storeCode: "IST-002" }),
        ],
      }),
    ]);
  });

  it("can list inactive team templates when active filter is disabled", async () => {
    const { repository, databaseService } = createRepositoryHarness();
    databaseService.query.mockResolvedValue({
      rowCount: 1,
      rows: [
        {
          competition_team_template_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          template_code: "OLD_MARMARA_A",
          template_name: "Old Marmara A",
          description: null,
          is_active: false,
          store_id: null,
          store_code: null,
          store_name: null,
          region_id: null,
        },
      ],
    });

    const rows = await repository.listTeamTemplates({ activeOnly: false });

    const sql = databaseService.query.mock.calls[0][0] as string;
    const params = databaseService.query.mock.calls[0][1] as unknown[];
    expect(sql).toContain("($1::boolean = FALSE OR template.is_active = TRUE)");
    expect(params).toEqual([false]);
    expect(rows).toEqual([
      expect.objectContaining({
        templateCode: "OLD_MARMARA_A",
        isActive: false,
      }),
    ]);
  });

  it("creates a team template and writes store memberships plus audit", async () => {
    const { repository, client, executedSql, executedParams } = createRepositoryHarness();
    client.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
      executedSql.push(sql);
      executedParams.push(params);

      if (sql.includes("INSERT INTO ops.competition_team_template ")) {
        return {
          rowCount: 1,
          rows: [
            {
              competition_team_template_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              template_code: "MARMARA_A",
              template_name: "Marmara A",
              description: null,
              is_active: true,
            },
          ],
        };
      }

      if (sql.includes("FROM ops.competition_team_template template")) {
        return {
          rowCount: 1,
          rows: [
            {
              competition_team_template_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              template_code: "MARMARA_A",
              template_name: "Marmara A",
              description: null,
              is_active: true,
              store_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              store_code: "IST-001",
              store_name: "IstinyePark",
              region_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            },
          ],
        };
      }

      return { rowCount: 1, rows: [] };
    });

    const template = await repository.createTeamTemplate({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      templateCode: "MARMARA_A",
      templateName: "Marmara A",
      storeIds: ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"],
    });

    const sql = executedSql.join("\n");
    expect(sql).toContain("INSERT INTO ops.competition_team_template");
    expect(sql).toContain("INSERT INTO ops.competition_team_template_store");
    expect(sql).toContain("INSERT INTO audit.event_log");
    expect(JSON.stringify(executedParams)).toContain("competition_team_template.created");
    expect(template).toEqual(
      expect.objectContaining({
        templateCode: "MARMARA_A",
        stores: [expect.objectContaining({ storeCode: "IST-001" })],
      }),
    );
  });

  it("deactivates a team template and writes audit metadata", async () => {
    const { repository, client, executedSql, executedParams } = createRepositoryHarness();
    client.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
      executedSql.push(sql);
      executedParams.push(params);

      if (sql.includes("UPDATE ops.competition_team_template")) {
        return {
          rowCount: 1,
          rows: [
            {
              competition_team_template_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            },
          ],
        };
      }

      if (sql.includes("FROM ops.competition_team_template template")) {
        return {
          rowCount: 1,
          rows: [
            {
              competition_team_template_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              template_code: "MARMARA_A",
              template_name: "Marmara A",
              description: null,
              is_active: false,
              store_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
              store_code: "IST-001",
              store_name: "IstinyePark",
              region_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
            },
          ],
        };
      }

      return { rowCount: 1, rows: [] };
    });

    const template = await repository.deactivateTeamTemplate({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      templateId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });

    const sql = executedSql.join("\n");
    expect(sql).toContain("UPDATE ops.competition_team_template");
    expect(sql).toContain("is_active = FALSE");
    expect(sql).toContain("INSERT INTO audit.event_log");
    expect(JSON.stringify(executedParams)).toContain("competition_team_template.deactivated");
    expect(template).toEqual(
      expect.objectContaining({
        templateCode: "MARMARA_A",
        isActive: false,
        stores: [expect.objectContaining({ storeCode: "IST-001" })],
      }),
    );
  });

  it("recalculates stage scores from completed one-day store snapshots and checklist facts", async () => {
    const { repository, executedSql } = createRepositoryHarness();

    await repository.recalculateStage({
      actorUserId: "11111111-1111-4111-8111-111111111111",
      stageId: "22222222-2222-4222-8222-222222222222",
    });

    const sql = executedSql.join("\n");
    expect(sql).toContain("FROM rpt.snapshot_run run");
    expect(sql).toContain("run.period_start = run.period_end");
    expect(sql).toContain("'BM_CHECKLIST'");
    expect(sql).toContain("'VM_CHECKLIST'");
    expect(sql).toContain("competition_stage_store_score_snapshot");
    expect(sql).toContain("competition_stage_warning");
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
});
