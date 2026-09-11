import { buildCurrentStoreComparisons } from "./ranking-store-comparisons";
import type { StoreRankingRow } from "./ranking.contract";
import { rankStoreRows } from "./ranking-list.helpers";

const row = (id: string, region: string | null, sales: number | null, target: number, atv: number | null): StoreRankingRow & { metrics: NonNullable<StoreRankingRow['metrics']> } => ({
  subject: "store", storeId: id, storeName: id, regionId: region, regionName: region,
  regionManagerUserId: null, regionManagerName: null, rank: 1, population: 4, scoreValue: atv ?? 0, visibility: "detail",
  metrics: [{ code: "TARGET_ACHIEVEMENT", label: "HG", actualValue: sales, targetValue: target }, { code: "ATV", label: "ATV", actualValue: atv }],
});
describe("current store aggregate comparisons", () => {
  it("uses the leaderboard tie breakers for score ranks in both populations", () => {
    const peers = rankStoreRows([row("b", "r1", 100, 100, 70), row("a", "r1", 100, 100, 70), row("c", "r2", 100, 100, 80)]);
    for (const current of peers) {
      const comparison = buildCurrentStoreComparisons(peers, current)[0];
      expect(comparison.turkey.rank).toBe(current.rank);
      expect(comparison.region.rank).toBe(rankStoreRows(peers.filter(p => p.regionId === current.regionId)).find(p => p.storeId === current.storeId)?.rank);
    }
    expect(buildCurrentStoreComparisons(peers, peers.find(p => p.storeId === "b")!)[0].region.rank).toBe(2);
  });
  it("ranks by achievement ratio, includes all peers, and preserves ties and missing values", () => {
    const current = row("own", "r1", 110, 100, 30);
    const peers = [current, row("same", "r1", 220, 200, 30), row("other", "r2", 90, 50, 40), row("missing", "r1", null, 0, null)];
    const result = buildCurrentStoreComparisons(peers, current);
    expect(result.find(r => r.code === "TARGET_ACHIEVEMENT")).toEqual({ code: "TARGET_ACHIEVEMENT", turkey: { rank: 2, population: 3 }, region: { rank: 1, population: 2 } });
    expect(result.find(r => r.code === "ATV")?.region).toEqual({ rank: 1, population: 2 });
    expect(result.find(r => r.code === "CR")?.turkey).toEqual({ rank: null, population: 0 });
    expect(JSON.stringify(result)).not.toContain('"other"');
  });
  it("does not assign a region rank to an unassigned store", () => {
    const current = row("own", null, 0, 0, 30);
    expect(buildCurrentStoreComparisons([current], current)[0].region).toEqual({ rank: null, population: 0 });
    expect(buildCurrentStoreComparisons([current], current)[1].turkey.rank).toBeNull();
  });
});
