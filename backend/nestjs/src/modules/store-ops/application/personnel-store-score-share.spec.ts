import { personnelStoreScoreShares } from "./personnel-store-score-share";
import { maskPersonnelRow } from "./ranking-list.helpers";
import type { PersonnelRankingRow } from "./ranking.contract";

describe("personnel store score allocation", () => {
  const row = (employeeId: string, allocationWeight: number | null, storeId = "store-1") => ({ employeeId, storeId, allocationWeight });

  it("allocates 43 of 95 points and uses each store's own complete denominator", () => {
    const result = personnelStoreScoreShares([row("x", 4300), row("y", 5200), row("other", 50000, "store-2")]);
    expect(result.get("x")! * 95).toBeCloseTo(43);
    expect(result.get("y")! * 95).toBeCloseTo(52);
    expect(result.get("other")).toBe(1);
  });

  it("does not renormalize the full-store share when displaying a page or sorting", () => {
    const rows = Array.from({ length: 60 }, (_, i) => row(String(i), 100));
    const shares = personnelStoreScoreShares(rows);
    expect(shares.get("59")).toBeCloseTo(1 / 60);
    expect(personnelStoreScoreShares([...rows].reverse()).get("59")).toBeCloseTo(1 / 60);
  });

  it.each([null, Number.NaN, Number.POSITIVE_INFINITY, -1])("keeps an incomplete or invalid store unavailable (%s)", value => {
    const result = personnelStoreScoreShares([row("x", value), row("y", 10), row("z", 2, "other")]);
    expect(result.get("x")).toBeNull();
    expect(result.get("y")).toBeNull();
    expect(result.get("z")).toBe(1);
  });

  it("distinguishes zero individual weight from a zero total pool", () => {
    expect(personnelStoreScoreShares([row("x", 0), row("y", 5)]).get("x")).toBe(0);
    expect(personnelStoreScoreShares([row("x", 0)]).get("x")).toBeNull();
  });

  it("never exposes an allocation share in masked personnel summaries", () => {
    const personnel = { employeeId: "x", storeScoreShare: 0.4, metrics: [] } as unknown as PersonnelRankingRow;
    expect(maskPersonnelRow(personnel, "summary")).not.toHaveProperty("storeScoreShare");
    expect(maskPersonnelRow(personnel, "detail").storeScoreShare).toBe(0.4);
  });
});
