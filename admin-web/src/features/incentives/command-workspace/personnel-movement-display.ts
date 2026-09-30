import { getBusinessDateInputValue } from '@/lib/business-date'
import { sumMoney } from './model'
import type { IncentiveRow, IncentiveStore } from './types'

type ReturnMovement = NonNullable<IncentiveStore['outOfRosterReturns']>[number]

function amount(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function hasAssignedIncentiveTarget(row: IncentiveRow, storeTarget: string | null) {
  const target = row.participantType === 'store_manager' ? storeTarget : row.target
  return (amount(target) ?? 0) > 0
}

export function isDepartedIncentiveRow(row: IncentiveRow, today = getBusinessDateInputValue()) {
  return row.currentEmploymentStatus === 'terminated'
    && Boolean(row.terminationDate)
    && row.terminationDate! <= today
}

export function personnelMovementDisplay(store: IncentiveStore, available: boolean) {
  const visibleRows = store.rows
  const targetlessCount = store.rows.filter(row => !hasAssignedIncentiveTarget(row, store.storeTarget)).length

  if (!available) return { visibleRows, targetlessCount, returns: [], returnsTotal: null }

  const candidates: ReturnMovement[] = [
    ...(store.outOfRosterReturns ?? []),
    ...store.rows.map(row => ({
      employeeId: row.employeeId, personnelCode: null, displayName: row.displayName,
      saleAmount: row.trackedSaleAmount ?? null, returnAmount: row.trackedReturnAmount ?? null,
      netAmount: row.trackedNetAmount ?? null,
    })),
  ]
  const identity = (item: ReturnMovement, index: number) => item.employeeId
    ? `employee:${item.employeeId}` : item.personnelCode ? `code:${item.personnelCode}` : `unknown:${index}`
  const sellers = new Set(candidates.flatMap((item, index) =>
    (amount(item.saleAmount) ?? 0) > 0 ? [identity(item, index)] : []))
  const returnsByPerson = new Map<string, ReturnMovement>()
  candidates.forEach((item, index) => {
    const key = identity(item, index)
    const sale = amount(item.saleAmount)
    if (sale === null || sale > 0 || sellers.has(key) || (amount(item.returnAmount) ?? 0) >= 0 || (amount(item.netAmount) ?? 0) >= 0) return
    // The API can include a person both in the frozen rows and movement detail.
    // Prefer the movement record (with personnel code), but never sum it twice.
    if (!returnsByPerson.has(key)) returnsByPerson.set(key, item)
  })
  const returns = [...returnsByPerson.values()]
  return { visibleRows, targetlessCount, returns, returnsTotal: returns.length ? sumMoney(returns.map(item => item.returnAmount)) : '0.00' }
}
