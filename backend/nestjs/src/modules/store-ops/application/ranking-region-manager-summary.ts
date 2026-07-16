import type { StoreRankingRow } from './ranking.contract'

export type RegionManagerSummaryRow = {
  userId: string | null
  displayName: string | null
  storeCount: number
  riskStoreCount: number
  averageScore: number | null
}

export function buildRegionManagerSummary(
  rows: StoreRankingRow[],
  page: { limit: number; offset: number; riskOffset?: number },
) {
  const groups = new Map<string, {
    userId: string | null
    displayName: string | null
    scores: number[]
    storeCount: number
    riskStoreCount: number
  }>()

  for (const row of rows) {
    const userId = row.regionManagerUserId ?? null
    const displayName = row.regionManagerName ?? null
    const key = userId ?? '__unassigned__'
    const current = groups.get(key) ?? {
      userId,
      displayName,
      scores: [],
      storeCount: 0,
      riskStoreCount: 0,
    }
    current.storeCount += 1
    if (Number.isFinite(row.scoreValue)) {
      current.scores.push(row.scoreValue)
      if (row.scoreValue < 75) current.riskStoreCount += 1
    }
    groups.set(key, current)
  }

  const allItems: RegionManagerSummaryRow[] = [...groups.values()]
    .map((group) => ({
      userId: group.userId,
      displayName: group.displayName,
      storeCount: group.storeCount,
      riskStoreCount: group.riskStoreCount,
      averageScore: group.scores.length > 0
        ? group.scores.reduce((sum, score) => sum + score, 0) / group.scores.length
        : null,
    }))
    .sort((left, right) => {
      if (left.displayName === null) return right.displayName === null ? 0 : 1
      if (right.displayName === null) return -1
      return left.displayName.localeCompare(right.displayName, 'tr') ||
        (left.userId ?? '').localeCompare(right.userId ?? '')
    })

  const riskItems = allItems.filter((item) => item.riskStoreCount > 0)
  const riskOffset = page.riskOffset ?? 0
  return {
    items: allItems.slice(page.offset, page.offset + page.limit),
    meta: { total: allItems.length, limit: page.limit, offset: page.offset },
    riskItems: riskItems.slice(riskOffset, riskOffset + page.limit),
    riskMeta: { total: riskItems.length, limit: page.limit, offset: riskOffset },
    riskStoreCount: allItems.reduce((sum, item) => sum + item.riskStoreCount, 0),
  }
}
