import type { StoreRankingRow } from "./ranking.contract";
import { getMetricComparableValue, rankStoreRows } from "./ranking-list.helpers";

/** Only aggregate positions for the authorized current store; no peer details. */
export function buildCurrentStoreComparisons(rows: StoreRankingRow[], current: StoreRankingRow) {
  const codes = ["score", "TARGET_ACHIEVEMENT", "ATV", "UPT", "CR", "gsm_approval", "BM_CHECKLIST", "VM_CHECKLIST"];
  return codes.map(code => {
    const value = (row: StoreRankingRow) => code === "score"
      ? row.metrics?.some(metric => metric.actualValue !== null) && Number.isFinite(row.scoreValue) ? row.scoreValue : null
      : getMetricComparableValue(row.metrics ?? [], code);
    const actual = value(current);
    const rank = (population: StoreRankingRow[]) => {
      if (code === "score") {
        const ranked = rankStoreRows(population.filter(row => value(row) !== null).map(row => ({ ...row, metrics: row.metrics ?? [] })));
        return { rank: actual === null ? null : ranked.find(row => row.storeId === current.storeId)?.rank ?? null, population: ranked.length };
      }
      const values = population.map(value).filter((v): v is number => v !== null && Number.isFinite(v));
      return { rank: actual === null ? null : 1 + values.filter(v => v > actual).length, population: values.length };
    };
    return { code, turkey: rank(rows), region: current.regionId ? rank(rows.filter(row => row.regionId === current.regionId)) : { rank: null, population: 0 } };
  });
}
