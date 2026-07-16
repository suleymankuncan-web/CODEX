import { RankingService } from "./ranking.service";

describe("RankingService fail-closed scope", () => {
  const repository = () => ({
    resolveEmployeeIdForAuthIdentity: jest.fn(),
    listRankingStoreKpiRows: jest.fn(),
  });

  const input = {
    userId: "actor-1",
    companyIds: [] as string[],
    regionIds: [] as string[],
    storeIds: [] as string[],
    assignedStoreIds: [] as string[],
    periodType: "monthly" as const,
  };

  it.each([
    { roleCodes: ["REPORT_VIEWER"], companyIds: [] },
    { roleCodes: ["REPORT_VIEWER", "SUPER_ADMIN"], companyIds: [] },
    { roleCodes: ["REGION_MANAGER"], companyIds: ["company-1"] },
  ])("EC-001/002 returns no rankings before repository access for $roleCodes", async (scope) => {
    const readRepository = repository();
    const service = new RankingService(
      readRepository as never,
      { getKpiConfigRows: jest.fn() } as never,
      readRepository as never,
      readRepository as never,
    );

    const result = await service.getRankings({ ...input, ...scope });

    expect(result.storeLeaderboard.items).toEqual([]);
    expect(result.personnelLeaderboard.items).toEqual([]);
    expect(result.regionManagerLeaderboard.items).toEqual([]);
    expect(readRepository.resolveEmployeeIdForAuthIdentity).not.toHaveBeenCalled();
    expect(readRepository.listRankingStoreKpiRows).not.toHaveBeenCalled();
  });
});
