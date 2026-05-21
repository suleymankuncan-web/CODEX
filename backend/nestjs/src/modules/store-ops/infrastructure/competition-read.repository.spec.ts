import { CompetitionReadRepository } from "./competition-read.repository";

function createRepositoryHarness() {
  const queryMock = jest.fn(
    async (
      sql: string,
      params: unknown[] = [],
    ): Promise<{ rowCount: number; rows: Record<string, unknown>[] }> => {
      void sql;
      void params;
      return { rowCount: 0, rows: [] };
    },
  );
  const databaseService = {
    query: queryMock,
  };

  return {
    repository: new CompetitionReadRepository(databaseService as never),
    databaseService,
  };
}

describe("CompetitionReadRepository", () => {
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
