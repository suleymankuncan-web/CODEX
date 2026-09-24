import type {
  IncentiveManagerGroup,
  IncentiveRow,
  IncentiveStatusFilter,
  IncentiveStore,
  IncentiveWorkspace,
} from './types'
import type { RegionManagerDirectoryItem } from '@/features/org/region-manager-directory'

export function buildIncentiveMetrics(workspace: IncentiveWorkspace) {
  const stores = workspace.managerGroups.flatMap((region) => region.stores)
  const rows = stores.flatMap((store) => store.rows)
  return {
    finalTotal: sumMoney(rows.map((row) => row.finalAmount)),
    pendingReviewCount: stores.filter((store) => store.review.status === 'pending_review').length,
    correctionCount: rows.filter((row) => row.status === 'corrected' || row.status === 'adjusted').length,
    reviewedStoreCount: stores.filter((store) => store.review.status === 'reviewed').length,
    storeCount: stores.length,
    managerCount: workspace.managerGroups.length,
  }
}

export function scopeIncentiveWorkspaceToManager(
  workspace: IncentiveWorkspace,
  manager: RegionManagerDirectoryItem | null,
): IncentiveWorkspace {
  if (!manager) return workspace
  return {
    ...workspace,
    managerGroups: workspace.managerGroups
      .filter((group) => group.managerUserId === manager.userId),
  }
}

export function filterIncentiveWorkspace(
  workspace: IncentiveWorkspace,
  input: { search: string; status: IncentiveStatusFilter },
): IncentiveWorkspace {
  const search = normalize(input.search)
  const managerGroups = workspace.managerGroups
    .map((group) => filterManagerGroup(group, search, input.status))
    .filter((group): group is IncentiveManagerGroup => group !== null)
  return { ...workspace, managerGroups }
}

export function getSubmitManagerOptions(workspace: IncentiveWorkspace, fallbackLabel = 'Unassigned manager') {
  return workspace.managerGroups
    .filter((group) => group.managerUserId && (group.package.status === 'not_submitted' || group.package.status === 'admin_returned'))
    .map((group) => ({
      companyId: group.companyId,
      managerUserId: group.managerUserId!,
      label: group.managerName?.trim() || fallbackLabel,
    }))
}

export function isIncentiveManagerGroupSubmitReady(region: IncentiveManagerGroup | undefined) {
  return Boolean(
    region
    && region.capabilities.canSubmitPackage
    && region.stores.length > 0
    && region.stores.every((store) => (
      store.review.status === 'reviewed'
      && store.review.periodCloseStatus === 'closed'
    )),
  )
}

export function calculateRateProposal(actual: string | null, rate: string | null) {
  if (actual === null || rate === null) return null
  const left = parseDecimal(actual)
  const right = parseDecimal(rate)
  if (!left || !right) return null
  return formatDecimal(left.units * right.units, left.scale + right.scale, 2)
}

export function sumMoney(values: Array<string | null | undefined>) {
  let total = 0n
  let validValueCount = 0
  for (const value of values) {
    if (value === null || value === undefined) continue
    const decimal = parseDecimal(value)
    if (!decimal) continue
    total += scaleUnits(decimal.units, decimal.scale, 2)
    validValueCount += 1
  }
  return validValueCount === 0 ? null : formatScaled(total, 2)
}

export function hasIncentiveAmountChange(calculated: string | null, final: string | null) {
  if (calculated === null || final === null) return false
  const baseline = parseDecimal(calculated), current = parseDecimal(final)
  return Boolean(baseline && current && scaleUnits(baseline.units, baseline.scale, 2) !== scaleUnits(current.units, current.scale, 2))
}

export function countAdjustedIncentivePersonnel(rows: IncentiveRow[]) {
  return new Set(rows.filter(row => hasIncentiveAmountChange(row.calculatedAmount, row.finalAmount)).map(row => row.employeeId)).size
}

export function isBelowIncentiveThreshold(achievementPct: string | null) {
  if (!achievementPct?.trim()) return false
  const achievement = Number(achievementPct)
  return Number.isFinite(achievement) && achievement < 80
}

export function isEarnedAtIncentiveThreshold(finalAmount: string | null, achievementPct: string | null) {
  if (finalAmount === null || achievementPct === null) return false
  const amount = Number(finalAmount), achievement = Number(achievementPct)
  return Number.isFinite(amount) && Number.isFinite(achievement) && amount > 0 && achievement >= 80
}

function filterManagerGroup(
  group: IncentiveManagerGroup,
  search: string,
  status: IncentiveStatusFilter,
): IncentiveManagerGroup | null {
  const stores = group.stores.filter((store) => matchesStore(store, search, status))
  const managerMatchesSearch = Boolean(search) && normalize(group.managerName).includes(search)
  if (stores.length > 0) return { ...group, stores }
  if (status === 'all' && managerMatchesSearch) return group
  return null
}

function matchesStore(store: IncentiveStore, search: string, status: IncentiveStatusFilter) {
  const textMatches = !search || [store.storeName, store.storeCode, store.city, ...store.rows.map((row) => row.displayName)]
    .some((value) => normalize(value).includes(search))
  if (!textMatches) return false
  if (status === 'all') return true
  if (status === 'pending_review' || status === 'reviewed') return store.review.status === status
  const changed = store.rows.some((row) => row.status === 'corrected' || row.status === 'adjusted')
  if (status === 'corrected') return changed
  return store.rows.some((row) => Number(row.finalAmount ?? 0) > 0)
}

function normalize(value: string | null | undefined) {
  return (value ?? '').toLocaleLowerCase('tr-TR').trim()
}

function parseDecimal(value: string) {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value.trim().replace(',', '.'))
  if (!match) return null
  const fraction = match[3] ?? ''
  const units = BigInt(`${match[2]}${fraction}`) * (match[1] ? -1n : 1n)
  return { units, scale: fraction.length }
}

function formatDecimal(units: bigint, sourceScale: number, outputScale: number) {
  return formatScaled(scaleUnits(units, sourceScale, outputScale), outputScale)
}

function scaleUnits(units: bigint, sourceScale: number, outputScale: number) {
  return outputScale >= sourceScale
    ? units * (10n ** BigInt(outputScale - sourceScale))
    : units / (10n ** BigInt(sourceScale - outputScale))
}

function formatScaled(units: bigint, scale: number) {
  const sign = units < 0n ? '-' : ''
  const absolute = units < 0n ? -units : units
  const digits = absolute.toString().padStart(scale + 1, '0')
  return `${sign}${digits.slice(0, -scale)}.${digits.slice(-scale)}`
}
