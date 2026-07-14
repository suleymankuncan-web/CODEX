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
  status: ChecklistCommandStatus
  sort: ChecklistCommandSort
  query: string
  limit: number
  offset: number
}

export function buildChecklistCommandQuery(input: ChecklistCommandQueryInput) {
  const query = new URLSearchParams()
  query.set('period', input.period)
  if (input.status !== 'all') query.set('status', input.status)
  query.set('sort', input.sort)
  if (input.query.trim()) query.set('query', input.query.trim())
  query.set('limit', String(input.limit))
  query.set('offset', String(input.offset))
  return query
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
