import type { TargetCommandStore } from './types'

export type StoreTargetDraft = {
  total: string
  note: string
  allocations: Record<string, string>
}

export function createStoreTargetDraft(
  store: TargetCommandStore | null,
  inheritedBasis: Array<{
    employeeId: string
    targetValue: string | number
  }> = [],
  options: { clearRequestNote?: boolean } = {},
): StoreTargetDraft {
  const allocations = inheritedBasis.length
    ? inheritedBasis.map((item) => [item.employeeId, String(item.targetValue)] as const)
    : store?.request?.allocations.length
      ? store.request.allocations.map((item) => [item.employeeId, item.targetValue] as const)
      : (store?.personnel ?? []).map((item) => [item.employeeId, item.targetValue ?? ''] as const)
  return {
    total: inheritedBasis.length
      ? String(inheritedBasis.reduce((sum, item) => sum + Number(item.targetValue), 0))
      : (store?.request?.totalTargetValue ?? ''),
    note: options.clearRequestNote ? '' : (store?.request?.requestReason ?? ''),
    allocations: Object.fromEntries(allocations),
  }
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
    store?.capabilities.canCreateRequest &&
    totalUnits > 0 &&
    people.length > 0 &&
    allocationUnits === totalUnits &&
    people.every(
      (person) =>
        person.eligibilityStatus === 'historical_allocation' ||
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
) {
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
