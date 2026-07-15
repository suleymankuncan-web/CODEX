import type {
  IncentiveRegion,
  IncentiveStatusFilter,
  IncentiveStore,
  IncentiveWorkspace,
} from './types'

export function buildIncentiveMetrics(workspace: IncentiveWorkspace) {
  const stores = workspace.regions.flatMap((region) => region.stores)
  const rows = stores.flatMap((store) => store.rows)
  return {
    finalTotal: sumMoney(rows.map((row) => row.finalAmount)),
    pendingReviewCount: stores.filter((store) => store.review.status === 'pending_review').length,
    correctionCount: rows.filter((row) => row.status === 'corrected' || row.status === 'adjusted').length,
    reviewedStoreCount: stores.filter((store) => store.review.status === 'reviewed').length,
    storeCount: stores.length,
    regionCount: workspace.regions.length,
  }
}

export function filterIncentiveWorkspace(
  workspace: IncentiveWorkspace,
  input: { search: string; status: IncentiveStatusFilter },
): IncentiveWorkspace {
  const search = normalize(input.search)
  const regions = workspace.regions
    .map((region) => filterRegion(region, search, input.status))
    .filter((region): region is IncentiveRegion => region !== null)
  return { ...workspace, regions }
}

export function getSubmitRegionOptions(workspace: IncentiveWorkspace, fallbackLabel = 'Unassigned region') {
  return workspace.regions
    .filter((region) => region.capabilities.canSubmitPackage)
    .filter((region) => region.package.status === 'not_submitted' || region.package.status === 'admin_returned')
    .map((region) => ({
      regionId: region.regionId,
      label: region.regionName?.trim() || region.regionManager.displayName?.trim() || fallbackLabel,
    }))
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

function filterRegion(
  region: IncentiveRegion,
  search: string,
  status: IncentiveStatusFilter,
): IncentiveRegion | null {
  const stores = region.stores.filter((store) => matchesStore(store, search, status))
  const regionMatchesSearch = Boolean(search) && (
    normalize(region.regionName).includes(search) || normalize(region.regionManager.displayName).includes(search)
  )
  if (stores.length > 0) return { ...region, stores }
  if (status === 'all' && regionMatchesSearch) return { ...region, stores: region.stores }
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
