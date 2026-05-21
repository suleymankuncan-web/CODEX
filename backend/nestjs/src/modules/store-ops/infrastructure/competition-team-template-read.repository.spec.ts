import { CompetitionTeamTemplateReadRepository } from "./competition-team-template-read.repository";

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
    repository: new CompetitionTeamTemplateReadRepository(databaseService as never),
    databaseService,
  };
}

describe("CompetitionTeamTemplateReadRepository", () => {
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
});
