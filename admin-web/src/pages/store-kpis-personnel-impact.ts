import type { PersonnelRankingRow } from '../features/reports/api'

export function personnelStoreScoreImpact(row: PersonnelRankingRow, storeId: string | undefined, storeScore: number | null) {
  const share = row.storeScoreShare
  if (!storeId || row.storeId !== storeId || row.visibility !== 'detail' ||
    storeScore === null || !Number.isFinite(storeScore) || storeScore < 0 ||
    share == null || !Number.isFinite(share) || share < 0 || share > 1) return null
  return storeScore * share
}
