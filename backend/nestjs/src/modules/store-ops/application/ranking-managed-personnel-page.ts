import { applyPersonnelFilters, type RankedPersonnelRankingRow } from './ranking-list.helpers'

export function buildBoundedManagedPersonnelPage<Row>(
  rows: Row[],
  page: { limit: number; offset: number },
) {
  return {
    items: rows.slice(page.offset, page.offset + page.limit),
    meta: { total: rows.length, limit: page.limit, offset: page.offset },
  }
}

export function buildSearchedManagedPersonnelPage(
  rows: RankedPersonnelRankingRow[],
  assignmentByEmployeeId: ReadonlyMap<string, { store_id: string | null }>,
  managedStoreIds: string[],
  search: string | undefined,
  page: { limit: number; offset: number },
) {
  const assignedRows = rows.filter(row => {
    const activeStoreId = assignmentByEmployeeId.get(row.employeeId)?.store_id ?? null
    return activeStoreId !== null && managedStoreIds.includes(activeStoreId)
  })
  return buildBoundedManagedPersonnelPage(applyPersonnelFilters(assignedRows, { search }), page)
}
