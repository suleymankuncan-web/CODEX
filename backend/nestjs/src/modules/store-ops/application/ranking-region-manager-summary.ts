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
  page: { limit: number; offset: number; riskOffset?: number; search?: string },
  managers: Array<{ id: string; label: string; storeIds?: string[] }> = [],
) {
  const groups = new Map<string, {
    userId: string | null
    displayName: string | null
    scores: number[]
    storeIds: Set<string>
    riskStoreCount: number
  }>()
  const managerIdsByStore = new Map<string, string[]>()

  for (const manager of managers) {
    groups.set(manager.id, {
      userId: manager.id,
      displayName: manager.label,
      scores: [],
      storeIds: new Set(manager.storeIds ?? []),
      riskStoreCount: 0,
    })
    for (const storeId of manager.storeIds ?? []) {
      managerIdsByStore.set(storeId, [
        ...(managerIdsByStore.get(storeId) ?? []),
        manager.id,
      ])
    }
  }

  for (const row of rows) {
    const directManagerIds = managerIdsByStore.get(row.storeId) ?? []
    if (directManagerIds.length > 0) {
      for (const managerId of directManagerIds) {
        const current = groups.get(managerId)
        if (!current) continue
        current.storeIds.add(row.storeId)
        if (Number.isFinite(row.scoreValue)) {
          current.scores.push(row.scoreValue)
          if (row.scoreValue < 52.5) current.riskStoreCount += 1
        }
      }
      continue
    }

    const userId = row.regionManagerUserId ?? null
    const displayName = row.regionManagerName ?? null
    const key = userId ?? '__unassigned__'
    const current = groups.get(key) ?? {
      userId,
      displayName,
      scores: [],
      storeIds: new Set<string>(),
      riskStoreCount: 0,
    }
    current.storeIds.add(row.storeId)
    if (Number.isFinite(row.scoreValue)) {
      current.scores.push(row.scoreValue)
      if (row.scoreValue < 52.5) current.riskStoreCount += 1
    }
    groups.set(key, current)
  }

  const allItems: RegionManagerSummaryRow[] = [...groups.values()]
    .map((group) => ({
      userId: group.userId,
      displayName: group.displayName,
      storeCount: group.storeIds.size,
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

  const search = page.search?.trim().toLocaleLowerCase('tr-TR') ?? ''
  const matchingItems = search
    ? allItems.filter((item) => item.displayName?.toLocaleLowerCase('tr-TR').includes(search))
    : allItems
  const riskItems = matchingItems.filter((item) => item.riskStoreCount > 0)
  const riskOffset = page.riskOffset ?? 0
  return {
    items: matchingItems.slice(page.offset, page.offset + page.limit),
    meta: { total: matchingItems.length, limit: page.limit, offset: page.offset },
    riskItems: riskItems.slice(riskOffset, riskOffset + page.limit),
    riskMeta: { total: riskItems.length, limit: page.limit, offset: riskOffset },
    riskStoreCount: matchingItems.reduce((sum, item) => sum + item.riskStoreCount, 0),
  }
}
