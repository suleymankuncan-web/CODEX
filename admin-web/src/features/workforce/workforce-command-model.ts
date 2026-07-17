import type { WorkforceCommandStore } from './api'

export type WorkforceRail = 'all' | 'active' | 'gap' | 'tenure'
export type WorkforceStoreSort = 'store' | 'active' | 'norm' | 'status' | 'shortage' | 'tenure'
export type WorkforcePersonSort = 'person' | 'position' | 'start' | 'tenure' | 'status'
export type SortDirection = 'ascending' | 'descending'

export function workforceWorkspaceQueryKey(input: {
  scopeSignature: string
  offset: number
  personnelOffset: number
  query: string
  status: 'all' | 'shortage' | 'balanced' | 'surplus' | 'unconfigured'
  sort: WorkforceStoreSort
  direction: SortDirection
  rail: WorkforceRail
}) {
  return [
    'store-workforce-command',
    input.scopeSignature,
    input.offset,
    input.personnelOffset,
    input.query,
    input.status,
    input.sort,
    input.direction,
    input.rail,
  ] as const
}

export function filterAndSortStores(input: {
  stores: WorkforceCommandStore[]
  query: string
  status: 'all' | 'shortage' | 'balanced' | 'surplus' | 'unconfigured'
  rail: WorkforceRail
  sort: WorkforceStoreSort
  direction: SortDirection
}) {
  const query = normalize(input.query)
  return input.stores
    .filter((store) => query === '' || normalize([
      store.storeName,
      store.storeCode,
      store.regionName ?? '',
      store.regionManagerName ?? '',
    ].join(' ')).includes(query))
    .filter((store) => input.status === 'all' || workforceStoreStatus(store) === input.status)
    .filter((store) => input.rail !== 'gap' || (store.gap ?? 0) > 0)
    .sort((left, right) => compareNullable(
      storeSortValue(left, input.sort),
      storeSortValue(right, input.sort),
      input.direction,
    ) || left.storeId.localeCompare(right.storeId))
}

export function filterAndSortPersonnel(input: {
  personnel: WorkforceCommandStore['personnel']
  query: string
  position: string
  sort: WorkforcePersonSort
  direction: SortDirection
  now: Date
}) {
  const query = normalize(input.query)
  return input.personnel
    .filter((person) => query === '' || normalize([
      person.displayName,
      person.positionName,
      person.positionCode,
    ].join(' ')).includes(query))
    .filter((person) => input.position === 'all' || person.positionName === input.position)
    .sort((left, right) => compareNullable(
      personSortValue(left, input.sort, input.now),
      personSortValue(right, input.sort, input.now),
      input.direction,
    ) || left.employeeId.localeCompare(right.employeeId))
}

export function workforceStoreStatus(store: WorkforceCommandStore) {
  if (store.norm === null || store.gap === null) return 'unconfigured' as const
  if (store.gap > 0) return 'shortage' as const
  if (store.gap < 0) return 'surplus' as const
  return 'balanced' as const
}

export function tenureDays(startDate: string | null, now: Date) {
  if (!startDate) return null
  const start = new Date(`${startDate}T00:00:00`)
  if (Number.isNaN(start.getTime())) return null
  return Math.max(0, Math.floor((now.getTime() - start.getTime()) / 86_400_000))
}

export function averageTenureDays(stores: WorkforceCommandStore[], now: Date) {
  const values = stores.flatMap((store) => store.personnel)
    .map((person) => tenureDays(person.assignmentStartDate, now))
    .filter((value): value is number => value !== null)
  return values.length === 0 ? null : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function personSortValue(
  person: WorkforceCommandStore['personnel'][number],
  sort: WorkforcePersonSort,
  now: Date,
) {
  if (sort === 'person') return normalize(person.displayName)
  if (sort === 'position') return normalize(person.positionName)
  if (sort === 'start') return person.assignmentStartDate
  if (sort === 'tenure') return tenureDays(person.assignmentStartDate, now)
  return person.employmentStatus
}

function storeSortValue(store: WorkforceCommandStore, sort: WorkforceStoreSort) {
  if (sort === 'store') return normalize(store.storeName)
  if (sort === 'active') return store.active
  if (sort === 'norm') return store.norm
  if (sort === 'shortage') return store.shortageDays
  if (sort === 'tenure') return store.averageTenureDays
  return workforceStoreStatus(store)
}

function compareNullable(
  left: string | number | null,
  right: string | number | null,
  direction: SortDirection,
) {
  if (left === null && right === null) return 0
  if (left === null) return 1
  if (right === null) return -1
  const result = typeof left === 'number' && typeof right === 'number'
    ? left - right
    : String(left).localeCompare(String(right), 'tr-TR')
  return direction === 'ascending' ? result : -result
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase('tr-TR')
}
