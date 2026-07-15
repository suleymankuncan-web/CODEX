export const checklistCommandStatuses = ['all', 'needs_visit', 'active', 'pending', 'completed'] as const
export type ChecklistCommandStatus = (typeof checklistCommandStatuses)[number]

export const checklistCommandSorts = [
  'store_asc',
  'store_desc',
  'bm_score_desc',
  'vm_score_desc',
  'last_visit_asc',
  'last_visit_desc',
  'open_actions_desc',
  'status_asc',
  'status_desc',
] as const
export type ChecklistCommandSort = (typeof checklistCommandSorts)[number]
export type ChecklistCommandSortKey = 'store' | 'bm' | 'vm' | 'last_visit' | 'open_actions' | 'status'

export type ChecklistCommandQueryInput = {
  period: string
  regionId?: string
  status: ChecklistCommandStatus
  sort: ChecklistCommandSort
  query: string
  limit: number
  offset: number
}

export const checklistCommandSignals = [
  'all',
  'missing_visit',
  'open_actions',
  'completed_coverage',
] as const
export type ChecklistCommandSignal = (typeof checklistCommandSignals)[number]

export const checklistCommandRegionSorts = [
  'manager_asc',
  'manager_desc',
  'stores_desc',
  'missing_desc',
  'open_actions_desc',
  'score_desc',
] as const
export type ChecklistCommandRegionSort = (typeof checklistCommandRegionSorts)[number]

export type ChecklistCommandRegionsQueryInput = {
  period: string
  signal: ChecklistCommandSignal
  sort: ChecklistCommandRegionSort
  limit: number
  offset: number
}

export function buildChecklistCommandRegionsQuery(input: ChecklistCommandRegionsQueryInput) {
  const query = new URLSearchParams({ period: input.period })
  if (input.signal !== 'all') query.set('signal', input.signal)
  query.set('sort', input.sort)
  query.set('limit', String(input.limit))
  query.set('offset', String(input.offset))
  return query
}

export const checklistOperationalHistoryRanges = ['3m', '6m', '12m', 'all'] as const
export type ChecklistOperationalHistoryRange = (typeof checklistOperationalHistoryRanges)[number]

export const checklistOperationalHistoryKinds = [
  'checklist_completed',
  'acknowledgement',
  'task_assigned',
  'task_resolved',
  'visit_plan_revised',
] as const
export type ChecklistOperationalHistoryKind = (typeof checklistOperationalHistoryKinds)[number]

export type ChecklistOperationalHistoryQueryInput = {
  range: ChecklistOperationalHistoryRange
  kinds: readonly ChecklistOperationalHistoryKind[]
  cursor?: string
}

export function buildChecklistOperationalHistoryQuery(input: ChecklistOperationalHistoryQueryInput) {
  const query = new URLSearchParams({ range: input.range })
  const kinds = [...new Set(input.kinds)].sort()
  if (kinds.length > 0) query.set('kinds', kinds.join(','))
  if (input.cursor?.trim()) query.set('cursor', input.cursor.trim())
  return query
}

export function buildChecklistCommandQuery(input: ChecklistCommandQueryInput) {
  const query = new URLSearchParams()
  query.set('period', input.period)
  if (input.regionId) query.set('regionId', input.regionId)
  if (input.status !== 'all') query.set('status', input.status)
  query.set('sort', input.sort)
  if (input.query.trim()) query.set('query', input.query.trim())
  query.set('limit', String(input.limit))
  query.set('offset', String(input.offset))
  return query
}

export type ChecklistPlanningDay = {
  isoDate: string
  dayLabel: string
  shortLabel: string
  dateLabel: string
}

export type VisitPlanDraftItem = {
  storeId: string
  plannedDate: string
  displayOrder: number
}

export type ChecklistVisitPlanRisk = 'all' | 'high' | 'medium' | 'low'
export type ChecklistVisitPlanStatus = 'all' | 'unplanned' | 'waiting' | 'missed' | 'completed' | 'mixed'
export type ChecklistVisitPlanSort = 'risk_desc' | 'store_asc' | 'store_desc' | 'last_visit_asc' | 'last_visit_desc' | 'next_plan_asc' | 'next_plan_desc'

export type ChecklistVisitPlanPeriodQueryInput = {
  regionId: string
  period: string
  query: string
  risk: ChecklistVisitPlanRisk
  planStatus: ChecklistVisitPlanStatus
  sort: ChecklistVisitPlanSort
  limit: number
  offset: number
}

export function buildChecklistVisitPlanPeriodQuery(input: ChecklistVisitPlanPeriodQueryInput) {
  const query = new URLSearchParams({ regionId: input.regionId, period: input.period })
  if (input.query.trim()) query.set('query', input.query.trim())
  if (input.risk !== 'all') query.set('risk', input.risk)
  if (input.planStatus !== 'all') query.set('planStatus', input.planStatus)
  query.set('sort', input.sort)
  query.set('limit', String(input.limit))
  query.set('offset', String(input.offset))
  return query
}

export function buildChecklistVisitPlanCandidateQuery(input: {
  regionId: string
  query: string
  limit: number
  offset: number
}) {
  const query = new URLSearchParams({ regionId: input.regionId })
  if (input.query.trim()) query.set('query', input.query.trim())
  query.set('limit', String(input.limit))
  query.set('offset', String(input.offset))
  return query
}

export function buildChecklistVisitPlanRegionOptionsQuery(input: {
  query: string
  limit: number
  offset: number
}) {
  const query = new URLSearchParams()
  if (input.query.trim()) query.set('query', input.query.trim())
  query.set('limit', String(input.limit))
  query.set('offset', String(input.offset))
  return query
}

export type StableVisitPlanSubmission = { fingerprint: string; idempotencyKey: string }

export function getStableVisitPlanSubmission(
  current: StableVisitPlanSubmission | null,
  fingerprint: string,
  createKey: () => string = () => crypto.randomUUID(),
) {
  return current?.fingerprint === fingerprint
    ? current
    : { fingerprint, idempotencyKey: createKey() }
}

const planningDayLabels = {
  tr: [
    ['Pazartesi', 'Pzt'],
    ['Salı', 'Sal'],
    ['Çarşamba', 'Çar'],
    ['Perşembe', 'Per'],
    ['Cuma', 'Cum'],
    ['Cumartesi', 'Cmt'],
  ],
  en: [
    ['Monday', 'Mon'],
    ['Tuesday', 'Tue'],
    ['Wednesday', 'Wed'],
    ['Thursday', 'Thu'],
    ['Friday', 'Fri'],
    ['Saturday', 'Sat'],
  ],
} as const

export function getIstanbulWeekStart(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const localDate = new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)))
  const mondayOffset = (localDate.getUTCDay() + 6) % 7
  localDate.setUTCDate(localDate.getUTCDate() - mondayOffset)
  return formatUtcDate(localDate)
}

export function shiftChecklistWeek(weekStart: string, offset: number) {
  const date = parseIsoDate(weekStart)
  date.setUTCDate(date.getUTCDate() + Math.trunc(offset) * 7)
  return formatUtcDate(date)
}

export function buildChecklistPlanningDays(
  weekStart: string,
  locale: 'tr' | 'en',
): ChecklistPlanningDay[] {
  const start = parseIsoDate(weekStart)
  const dateFormatter = new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-US', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
  return planningDayLabels[locale].map(([dayLabel, shortLabel], index) => {
    const date = new Date(start)
    date.setUTCDate(start.getUTCDate() + index)
    return {
      isoDate: formatUtcDate(date),
      dayLabel,
      shortLabel,
      dateLabel: dateFormatter.format(date).replace('.', ''),
    }
  })
}

export function buildVisitPlanDraftFingerprint(items: readonly VisitPlanDraftItem[]) {
  return items
    .map((item) => `${item.storeId}:${item.plannedDate}:${item.displayOrder}`)
    .sort()
    .join('|')
}

export type VisitPlanDraftReconciliation = {
  items: VisitPlanDraftItem[]
  conflictingStoreIds: string[]
}

/**
 * Reapplies local store-level changes onto the latest server snapshot.
 * A store is the smallest safe identity because the write contract does not
 * expose stable plan-item ids in a draft. Concurrent changes to the same
 * store therefore require an explicit owner choice instead of an implicit
 * last-write-wins merge.
 */
export function reconcileVisitPlanDrafts(
  baseline: readonly VisitPlanDraftItem[],
  local: readonly VisitPlanDraftItem[],
  latest: readonly VisitPlanDraftItem[],
): VisitPlanDraftReconciliation {
  const storeIds = new Set([
    ...baseline.map((item) => item.storeId),
    ...local.map((item) => item.storeId),
    ...latest.map((item) => item.storeId),
  ])
  const items: VisitPlanDraftItem[] = []
  const conflictingStoreIds: string[] = []

  for (const storeId of [...storeIds].sort()) {
    const baselineItems = draftItemsForStore(baseline, storeId)
    const localItems = draftItemsForStore(local, storeId)
    const latestItems = draftItemsForStore(latest, storeId)
    const baselineFingerprint = storeDraftFingerprint(baselineItems)
    const localFingerprint = storeDraftFingerprint(localItems)
    const latestFingerprint = storeDraftFingerprint(latestItems)
    const locallyChanged = localFingerprint !== baselineFingerprint
    const remotelyChanged = latestFingerprint !== baselineFingerprint

    if (locallyChanged && remotelyChanged && localFingerprint !== latestFingerprint) {
      conflictingStoreIds.push(storeId)
      items.push(...latestItems)
      continue
    }
    items.push(...(locallyChanged ? localItems : latestItems))
  }

  return { items: normalizeReconciledDraft(items), conflictingStoreIds }
}

export function resolveVisitPlanDraftConflicts(
  reconciled: readonly VisitPlanDraftItem[],
  selected: readonly VisitPlanDraftItem[],
  conflictingStoreIds: readonly string[],
) {
  const conflicts = new Set(conflictingStoreIds)
  return normalizeReconciledDraft([
    ...reconciled.filter((item) => !conflicts.has(item.storeId)),
    ...selected.filter((item) => conflicts.has(item.storeId)),
  ])
}

function draftItemsForStore(items: readonly VisitPlanDraftItem[], storeId: string) {
  return items.filter((item) => item.storeId === storeId)
}

function storeDraftFingerprint(items: readonly VisitPlanDraftItem[]) {
  return items.map((item) => item.plannedDate).sort().join('|')
}

function normalizeReconciledDraft(items: readonly VisitPlanDraftItem[]) {
  return [...items]
    .sort((left, right) => left.plannedDate.localeCompare(right.plannedDate) || left.displayOrder - right.displayOrder)
    .map((item, displayOrder) => ({ ...item, displayOrder }))
}

function parseIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) throw new Error('Invalid ISO date')
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
}

function formatUtcDate(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

export function createChecklistCommandPeriod(year: number, month: number) {
  const safeMonth = Math.min(12, Math.max(1, Math.trunc(month)))
  return `${Math.trunc(year)}-${String(safeMonth).padStart(2, '0')}`
}

const sortByKey: Record<ChecklistCommandSortKey, ChecklistCommandSort> = {
  bm: 'bm_score_desc',
  last_visit: 'last_visit_desc',
  open_actions: 'open_actions_desc',
  status: 'status_asc',
  store: 'store_asc',
  vm: 'vm_score_desc',
}

export function toggleChecklistCommandSort(
  current: ChecklistCommandSort,
  key: ChecklistCommandSortKey,
): ChecklistCommandSort {
  if (key === 'store') return current === 'store_asc' ? 'store_desc' : 'store_asc'
  if (key === 'last_visit') return current === 'last_visit_desc' ? 'last_visit_asc' : 'last_visit_desc'
  if (key === 'status') return current === 'status_asc' ? 'status_desc' : 'status_asc'
  return sortByKey[key]
}

export function getChecklistCommandSortLabel(
  label: string,
  key: ChecklistCommandSortKey,
  current: ChecklistCommandSort,
) {
  const selected =
    (key === 'store' && current.startsWith('store_')) ||
    (key === 'bm' && current === 'bm_score_desc') ||
    (key === 'vm' && current === 'vm_score_desc') ||
    (key === 'last_visit' && current.startsWith('last_visit_')) ||
    (key === 'open_actions' && current === 'open_actions_desc') ||
    (key === 'status' && current.startsWith('status_'))
  if (!selected) return label
  return `${label} ${current.endsWith('_asc') ? '↑' : '↓'}`
}

export function getChecklistCommandStatusLabel(
  status: Exclude<ChecklistCommandStatus, 'all'>,
  locale: 'tr' | 'en',
) {
  const labels = locale === 'tr'
    ? {
        needs_visit: 'Ziyaret gerekli',
        active: 'Aksiyon Takipte',
        pending: 'Kabul bekliyor',
        completed: 'Tamamlandı',
      }
    : {
        needs_visit: 'Visit required',
        active: 'Action in progress',
        pending: 'Awaiting acknowledgement',
        completed: 'Completed',
      }
  return labels[status]
}
