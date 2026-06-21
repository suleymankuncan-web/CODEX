import type {
  SalesTargetIncentiveProjection,
  SalesTargetIncentiveRegionCorrection,
  SalesTargetIncentiveRegionWorkflow,
  SalesTargetIncentiveRow,
  SalesTargetIncentiveStoreReview,
} from '../features/incentives/api'
import { getPrimaryEarnedAmount } from './store-incentives-model'
import type { StoreSurfaceTone } from './store-surface-primitives'
export { normalizeMoneyInput } from './store-incentives-money-input'

export type StoreStatusFilter = 'all' | 'pending_review' | 'reviewed' | 'earning' | 'no_earning' | 'corrected'

export type SelectedIncentiveRow = {
  projection: SalesTargetIncentiveProjection
  row: SalesTargetIncentiveRow
}

export function getRegionSummary(projections: SalesTargetIncentiveProjection[]) {
  const rows = projections.flatMap((projection) => projection.rows)
  const payableTotal = sumMoney(rows.map(getRegionEffectiveEarnedAmount))
  const earningPersonnelCount = rows.filter(
    (row) => row.participantType === 'personnel' && isPositiveMoney(getRegionEffectiveEarnedAmount(row)),
  ).length
  const reviewedStoreCount = projections.filter(
    (projection) => getReviewState(projection.review).storeReviewStatus === 'reviewed',
  ).length
  const projectionOnlyCount = projections.filter(
    (projection) => getReviewState(projection.review).periodCloseStatus === 'projection_only',
  ).length
  const correctionCount = rows.filter(
    (row) => row.regionCorrection && row.regionCorrection.status !== 'voided',
  ).length

  return {
    payableTotal,
    earningPersonnelCount,
    storeCount: projections.length,
    reviewedStoreCount,
    pendingReviewCount: projections.length - reviewedStoreCount,
    projectionOnlyCount,
    correctionCount,
  }
}

export function matchesStoreFilter(
  projection: SalesTargetIncentiveProjection,
  search: string,
  statusFilter: StoreStatusFilter,
) {
  const normalizedSearch = search.trim().toLocaleLowerCase('tr-TR')
  if (
    normalizedSearch &&
    !projection.storeName.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
  ) {
    return false
  }

  if (statusFilter === 'all') return true
  const storeTotal = sumMoney(projection.rows.map(getRegionEffectiveEarnedAmount))

  if (statusFilter === 'pending_review') {
    return getReviewState(projection.review).storeReviewStatus !== 'reviewed'
  }
  if (statusFilter === 'reviewed') {
    return getReviewState(projection.review).storeReviewStatus === 'reviewed'
  }
  if (statusFilter === 'earning') return isPositiveMoney(storeTotal)
  if (statusFilter === 'no_earning') return !isPositiveMoney(storeTotal)
  if (statusFilter === 'corrected') {
    return projection.rows.some((row) => row.regionCorrection && row.regionCorrection.status !== 'voided')
  }

  return true
}

export function canReviewProjection(projection: SalesTargetIncentiveProjection) {
  const review = getReviewState(projection.review)
  return review.periodCloseStatus === 'closed' && !review.workflowLockedReason
}

export function getReviewState(review: SalesTargetIncentiveStoreReview | null): SalesTargetIncentiveStoreReview {
  return review ?? {
    storeReviewStatus: 'pending_review',
    reviewedByUserId: null,
    reviewedAt: null,
    periodCloseStatus: 'projection_only',
    workflowLockedReason: 'period_not_closed',
  }
}

export function getProjectionWorkflowStatus(projection: SalesTargetIncentiveProjection): {
  label: string
  tone: StoreSurfaceTone
} {
  const review = getReviewState(projection.review)
  if (review.periodCloseStatus === 'projection_only') {
    return { label: 'Ay kapanışı bekliyor', tone: 'warning' }
  }
  if (review.workflowLockedReason === 'package_submitted') {
    return { label: 'Admin onayında', tone: 'accent' }
  }
  if (review.workflowLockedReason === 'package_approved') {
    return { label: 'Onaylandı', tone: 'calm' }
  }
  if (review.storeReviewStatus === 'reviewed') {
    return { label: 'Kontrol edildi', tone: 'calm' }
  }
  return { label: 'Kontrol edilmeli', tone: 'warning' }
}

export function getPackageStatus(workflow: SalesTargetIncentiveRegionWorkflow | null): {
  label: string
  tone: StoreSurfaceTone
} {
  if (!workflow) return { label: 'Kontrol sürecinde', tone: 'neutral' }
  if (workflow.regionPackageStatus === 'submitted') return { label: 'Admin onayında', tone: 'accent' }
  if (workflow.regionPackageStatus === 'admin_approved') return { label: 'Admin onayladı', tone: 'calm' }
  if (workflow.regionPackageStatus === 'admin_returned') return { label: 'İade edildi', tone: 'warning' }
  return { label: 'Kontrol sürecinde', tone: 'neutral' }
}

export function getSubmitDisabledReason(input: {
  workflow: SalesTargetIncentiveRegionWorkflow | null
  allStoresReviewed: boolean
  allStoresClosed: boolean
}) {
  if (!input.workflow?.regionId) return 'Bölge seçimi tamamlanmadı'
  if (input.workflow.regionPackageStatus === 'submitted') return 'Admin onayında'
  if (input.workflow.regionPackageStatus === 'admin_approved') return 'Admin onayladı'
  if (!input.allStoresClosed) return 'Ay kapanışı bekleniyor'
  if (!input.allStoresReviewed) return 'Kontrol bekleyen mağaza var'
  return null
}

export function isPackageLocked(workflow: SalesTargetIncentiveRegionWorkflow | null) {
  return workflow?.regionPackageStatus === 'submitted' || workflow?.regionPackageStatus === 'admin_approved'
}

export function getCorrectionLabel(correction: SalesTargetIncentiveRegionCorrection) {
  if (correction.status === 'submitted') return 'Admin onayında'
  if (correction.status === 'admin_approved') return 'Onaylandı'
  if (correction.status === 'admin_returned') return 'İade edildi'
  if (correction.status === 'voided') return 'İptal edildi'
  return 'Taslak'
}

export function getCorrectionTone(correction: SalesTargetIncentiveRegionCorrection): StoreSurfaceTone {
  if (correction.status === 'admin_approved') return 'calm'
  if (correction.status === 'submitted') return 'accent'
  if (correction.status === 'admin_returned') return 'warning'
  if (correction.status === 'voided') return 'neutral'
  return 'warning'
}

export function getRegionEffectiveEarnedAmount(row: SalesTargetIncentiveRow | null) {
  if (row?.regionCorrection && row.regionCorrection.status !== 'voided') {
    return row.regionCorrection.finalAmount
  }

  return getPrimaryEarnedAmount(row)
}

export function sumMoney(values: Array<string | null | undefined>) {
  let totalCents = 0n

  for (const value of values) {
    if (!value) continue
    totalCents += decimalStringToCents(value)
  }

  const sign = totalCents < 0n ? '-' : ''
  const absolute = totalCents < 0n ? -totalCents : totalCents
  const integer = absolute / 100n
  const cents = absolute % 100n
  return `${sign}${integer.toString()}.${cents.toString().padStart(2, '0')}`
}

function isPositiveMoney(value: string | null | undefined) {
  if (!value) return false
  return decimalStringToCents(value) > 0n
}

function decimalStringToCents(value: string) {
  const trimmed = value.trim().replace(',', '.')
  const match = /^(-)?(\d+)(?:\.(\d+))?$/.exec(trimmed)
  if (!match) return 0n
  const integerText = match[2]
  if (!integerText) return 0n
  const sign = match[1] ? -1n : 1n
  const integer = BigInt(integerText)
  const fraction = (match[3] ?? '').padEnd(2, '0').slice(0, 2)
  return sign * ((integer * 100n) + BigInt(fraction || '0'))
}
