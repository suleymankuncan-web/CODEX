import { getBusinessDateInputValue } from '@/lib/business-date'
import type { TargetCommandStore } from './types'

export type StoreTargetDraft = {
  total: string
  note: string
  allocations: Record<string, string>
  distributionDays?: Record<string, string>
  fixedSales?: Record<string, string | null>
}

export function isDepartedForTarget(terminationDate: string | null | undefined, period: string, today = getBusinessDateInputValue()) {
  return Boolean(terminationDate && terminationDate <= today && terminationDate.slice(0, 7) <= period)
}

export function createStoreTargetDraft(
  store: TargetCommandStore | null,
  inheritedBasis: Array<{
    employeeId: string
    targetValue: string | number
  }> = [],
  options: { clearRequestNote?: boolean; revisionPeriod?: string; today?: string } = {},
): StoreTargetDraft {
  const pending = store?.request?.status === 'pending_region_approval'
  const allocations = pending && store.request
    ? store.request.allocations.map(item => [item.employeeId, item.targetValue] as const)
    : inheritedBasis.length
    ? inheritedBasis.map((item) => [item.employeeId, String(item.targetValue)] as const)
    : store?.request?.allocations.length
      ? store.request.allocations.map((item) => [item.employeeId, item.targetValue] as const)
      : (store?.personnel ?? []).map((item) => [item.employeeId, item.targetValue ?? ''] as const)
  const allocationValues = Object.fromEntries(allocations)
  const recordedDays = new Map(store?.request?.allocations.map(item => [item.employeeId, item.distributionDays]))
  const draft: StoreTargetDraft = {
    fixedSales: Object.fromEntries((store?.personnel ?? []).filter(person => options.revisionPeriod && isDepartedForTarget(person.terminationDate, options.revisionPeriod, options.today)).map(person => [person.employeeId, person.actualSales ?? null])),
    total: !pending && inheritedBasis.length
      ? String(inheritedBasis.reduce((sum, item) => sum + Number(item.targetValue), 0))
      : (store?.request?.totalTargetValue ?? ''),
    note: options.clearRequestNote ? '' : (store?.request?.requestReason ?? ''),
    allocations: {
      ...Object.fromEntries((store?.personnel ?? []).map(person => [
        person.employeeId, inheritedBasis.length || store?.request ? '0' : '',
      ])),
      ...allocationValues,
    },
    ...(store?.request?.allocations.some(item => item.distributionDays !== undefined) ? {
      distributionDays: Object.fromEntries((store.personnel ?? []).map(person => [
        person.employeeId,
        String(recordedDays.get(person.employeeId) ?? (Number(allocationValues[person.employeeId] ?? 0) > 0 ? '' : 0)),
      ])),
    } : {}),
  }
  const departureChanged = Object.entries(draft.fixedSales ?? {}).some(([id, sales]) => sales !== null && targetPrecisionUnits(sales) !== targetPrecisionUnits(draft.allocations[id]))
  return !pending && departureChanged && hasCompleteDistributionDays(draft, store?.personnel ?? [])
    ? distributeTargetByDays(draft, store?.personnel ?? []) : draft
}

export function targetPrecisionUnits(value: string | number | null | undefined) {
  const normalized = String(value ?? '')
    .trim()
    .replace(',', '.')
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return 0

  const [whole, fraction = ''] = normalized.split('.')
  const digits = fraction.padEnd(5, '0')
  const roundedFraction = Number(digits.slice(0, 4)) + (Number(digits[4]) >= 5 ? 1 : 0)
  return Number(whole) * 10_000 + roundedFraction
}

export function sanitizeTargetMoneyInput(value: string) {
  const normalized = value.replace(',', '.').replace(/[^0-9.]/g, '')
  const separator = normalized.indexOf('.')
  if (separator < 0) return normalized

  const whole = normalized.slice(0, separator) || '0'
  const fraction = normalized
    .slice(separator + 1)
    .replaceAll('.', '')
    .slice(0, 4)
  return `${whole}.${fraction}`
}

export function storeTargetDraftSummary(store: TargetCommandStore | null, draft: StoreTargetDraft) {
  const totalUnits = targetPrecisionUnits(draft.total)
  const allocationUnits = Object.values(draft.allocations).reduce((sum, value) => sum + targetPrecisionUnits(value), 0)
  const people = store?.personnel ?? []
  const valid = Boolean(
    Object.values(draft.fixedSales ?? {}).every(value => value !== null && Number(value) >= 0) &&
    store?.capabilities.canCreateRequest &&
    totalUnits > 0 &&
    people.length > 0 &&
    allocationUnits === totalUnits &&
    people.every(
      (person) =>
        person.eligibilityStatus === 'historical_allocation' ||
        person.employeeId in (draft.fixedSales ?? {}) ||
        draft.distributionDays?.[person.employeeId] === '0' ||
        targetPrecisionUnits(draft.allocations[person.employeeId]) > 0,
    ),
  )
  return {
    totalUnits,
    allocationUnits,
    balanceUnits: totalUnits - allocationUnits,
    valid,
  }
}

export function withHistoricalTargetPersonnel(
  store: TargetCommandStore | null,
  basis: Array<{
    employeeId: string
    displayName: string
    targetValue: string | number
  }>,
): TargetCommandStore | null {
  if (!store) return null

  const knownEmployeeIds = new Set(store.personnel.map((person) => person.employeeId))
  return {
    ...store,
    personnel: [
      ...store.personnel,
      ...basis
        .filter((item) => !knownEmployeeIds.has(item.employeeId))
        .map((item) => ({
          employeeId: item.employeeId,
          displayName: item.displayName,
          positionCode: null,
          positionLabel: null,
          targetValue: String(item.targetValue),
          eligibilityStatus: 'historical_allocation' as const,
        })),
    ],
  }
}

export function isApprovedTargetMonth(store: TargetCommandStore | null, period: string) {
  return store?.monthStatuses.some((month) => month.period === period && month.isApproved) ?? false
}

export function distributeTargetByDays(draft: StoreTargetDraft, people: Array<{ employeeId: string }>): StoreTargetDraft {
  const total = targetPrecisionUnits(draft.total)
  const days = people.map(person => {
    if (person.employeeId in (draft.fixedSales ?? {})) return 0
    const raw = draft.distributionDays?.[person.employeeId] ?? ''
    return /^\d+$/.test(raw) && Number.isSafeInteger(Number(raw)) ? Number(raw) : 0
  })
  const sum = days.reduce((a, b) => a + b, 0)
  const amounts = people.map(person => targetPrecisionUnits(draft.fixedSales?.[person.employeeId]))
  const remaining = total - amounts.reduce((sum, value) => sum + value, 0)
  if (sum > 0 && Number.isSafeInteger(sum) && Number.isSafeInteger(total) && remaining >= 0) {
    const denominator = BigInt(sum)
    const shares = days.map((day, index) => ({ index, numerator: BigInt(remaining) * BigInt(day) }))
    for (const share of shares) amounts[share.index]! += Number(share.numerator / denominator)
    let remainder = total - amounts.reduce((a, b) => a + b, 0)
    for (const share of shares.filter(share => days[share.index]! > 0).sort((a, b) => Number(b.numerator % denominator - a.numerator % denominator) || people[a.index]!.employeeId.localeCompare(people[b.index]!.employeeId))) {
      if (remainder-- <= 0) break
      amounts[share.index]! += 1
    }
  }
  return { ...draft, allocations: Object.fromEntries(people.map((person, index) => [person.employeeId, (amounts[index]! / 10000).toFixed(4)])) }
}

export function hasCompleteDistributionDays(draft: StoreTargetDraft, people: Array<{ employeeId: string }>) {
  return people.length > 0 && people.every(person => {
    if (person.employeeId in (draft.fixedSales ?? {})) return draft.fixedSales![person.employeeId] !== null
    const raw = draft.distributionDays?.[person.employeeId] ?? ''
    return /^\d+$/.test(raw) && Number.isSafeInteger(Number(raw))
  }) && Number.isSafeInteger(people.reduce((sum, person) => sum + Number(draft.distributionDays?.[person.employeeId] ?? 0), 0)) && people.some(person => Number(draft.distributionDays?.[person.employeeId] ?? 0) > 0)
}
