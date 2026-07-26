import type { StoreRankingRow } from '../features/reports/api'

export type KpiReferenceClassification = {
  kind: 'good' | 'watch' | 'action' | 'unavailable'
  label: 'good' | 'watch' | 'action' | 'unavailable'
  ratio: number | null
}

// Historical highlights can express the weighted score either as a ratio
// (0.98 = 98 points) or directly on the 100-point scale (91.5 = 91.5 points).
// Normalize both transport shapes at the presentation boundary.
export function toHundredPointLiveStoreScore(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return null
  const normalized = Math.abs(value) <= 2 ? value * 100 : value
  return Number(normalized.toFixed(4))
}

// KPI-FR-003 / AC-KPI-003: this classifier is deliberately separate from
// store risk and personnel performance classifications.
export function classifyKpiReference(input: {
  actual: number | null
  reference: number | null
}): KpiReferenceClassification {
  if (input.reference === null || input.reference === 0) {
    return { kind: 'unavailable', label: 'unavailable', ratio: null }
  }
  if (input.actual === null) {
    return { kind: 'action', label: 'action', ratio: null }
  }

  const ratio = input.actual / Math.abs(input.reference)
  if (ratio >= 1) return { kind: 'good', label: 'good', ratio }
  if (ratio > 0.8) return { kind: 'watch', label: 'watch', ratio }
  return { kind: 'action', label: 'action', ratio }
}

// KPI-FR-003: personnel status remains independent from reference status.
export function classifyPersonnelPerformance(score: number | null) {
  if (score === null || !Number.isFinite(score)) return 'unavailable' as const
  if (score >= 85) return 'strong' as const
  if (score >= 75) return 'watch' as const
  return 'behind' as const
}

// KPI-FR-005 / AC-KPI-004: missing months remain null and are never rendered
// as a fabricated zero score.
export function buildKpiMonthlyHistory(input: {
  year: number
  rows: Array<{ periodStart: string; score: number | null }>
}) {
  const scoreByMonth = new Map(
    input.rows
      .filter((row) => row.periodStart.startsWith(`${input.year}-`))
      .map((row) => [row.periodStart.slice(0, 7), row.score] as const),
  )

  return Array.from({ length: 12 }, (_, index) => {
    const month = String(index + 1).padStart(2, '0')
    const periodStart = `${input.year}-${month}-01`
    return {
      periodStart,
      score: scoreByMonth.get(periodStart.slice(0, 7)) ?? null,
    }
  })
}

export type KpiRegionManagerGroup = {
  key: string
  manager: { displayName: string; userId: string } | null
  stores: StoreRankingRow[]
}

// KPI-FR-001: groups only the already scoped, bounded server page. Missing
// Region Manager identity stays explicit instead of becoming a fake actor.
export function groupKpiStoresByRegionManager(rows: StoreRankingRow[]) {
  const groups = new Map<string, KpiRegionManagerGroup>()

  for (const row of rows) {
    const hasManager = Boolean(row.regionManagerUserId && row.regionManagerName)
    const key = hasManager ? row.regionManagerUserId as string : 'unavailable'
    const current = groups.get(key) ?? {
      key,
      manager: hasManager
        ? { displayName: row.regionManagerName as string, userId: row.regionManagerUserId as string }
        : null,
      stores: [],
    }
    current.stores.push(row)
    groups.set(key, current)
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      stores: [...group.stores].sort((left, right) =>
        (left.storeName ?? '').localeCompare(right.storeName ?? '', 'tr'),
      ),
    }))
    .sort((left, right) => {
      if (left.manager === null) return right.manager === null ? 0 : 1
      if (right.manager === null) return -1
      return left.manager.displayName.localeCompare(right.manager.displayName, 'tr')
    })
}

export type KpiStoreSortKey =
  | 'score'
  | 'TARGET_ACHIEVEMENT'
  | 'UPT'
  | 'ATV'
  | 'CR'
  | 'gsm_approval'
  | 'BM_CHECKLIST'
  | 'VM_CHECKLIST'

// SH-FR-006/007: sorting is local to the already bounded server page. Nulls
// remain last in both directions and the store ID is the stable tie-breaker.
export function sortKpiStoreRows(
  rows: StoreRankingRow[],
  sortKey: KpiStoreSortKey,
  direction: 'asc' | 'desc',
) {
  return [...rows].sort((left, right) => {
    const leftValue = getKpiStoreSortValue(left, sortKey)
    const rightValue = getKpiStoreSortValue(right, sortKey)
    if (leftValue === null && rightValue === null) return left.storeId.localeCompare(right.storeId)
    if (leftValue === null) return 1
    if (rightValue === null) return -1
    const comparison = leftValue - rightValue
    return comparison === 0
      ? left.storeId.localeCompare(right.storeId)
      : direction === 'asc' ? comparison : -comparison
  })
}

function getKpiStoreSortValue(row: StoreRankingRow, sortKey: KpiStoreSortKey) {
  if (sortKey === 'score') return Number.isFinite(row.scoreValue) ? row.scoreValue : null
  const normalizedKey = normalizeMetricCode(sortKey)
  const metric = row.metrics?.find((item) => normalizeMetricCode(item.code) === normalizedKey)
  if (!metric || metric.actualValue === null || !Number.isFinite(metric.actualValue)) return null
  if (sortKey !== 'TARGET_ACHIEVEMENT') return metric.actualValue
  const reference = metric.targetValue ?? metric.benchmarkValue
  return reference === null || reference === undefined || !Number.isFinite(reference) || reference === 0
    ? null
    : metric.actualValue / Math.abs(reference)
}

function normalizeMetricCode(value: string) {
  const normalized = value.trim().toLowerCase()
  return normalized === 'gsm_onay' ? 'gsm_approval' : normalized
}
