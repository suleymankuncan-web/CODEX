import type {
  TargetCoverageRow,
  TargetDistributionAllocation,
  TargetDistributionRequest,
} from '../features/targets/api'
import { normalizeDisplayLabel } from '../lib/display-labels'
import { formatNumber } from '../lib/format'
import type { AppLocale } from '../lib/i18n'

export type TargetCommandStatus = 'pending' | 'approved' | 'adjusted-approved' | 'missing' | 'draft' | 'returned'

export type StoreOption = {
  storeId: string
  storeName: string
}

export type RegionTargetRow = {
  id: string
  storeId: string
  storeName: string
  subtitle: string
  status: TargetCommandStatus
  storeTarget: number | null
  totalDistributed: number | null
  submittedAt: string
  people: number
  allocations: TargetDistributionAllocation[]
  request: TargetDistributionRequest | null
}

export type ApprovalDraft = {
  allocations?: Record<string, number>
  totalTargetValue?: number
}

export const statusCopy: Record<TargetCommandStatus, { action: string; label: string; tone: string }> = {
  approved: { action: 'İncele', label: 'Onaylandı', tone: 'success' },
  'adjusted-approved': { action: 'Değişikliği gör', label: 'Düzenlenerek onaylandı', tone: 'success' },
  draft: { action: 'Devam et', label: 'Taslak', tone: 'warning' },
  missing: { action: 'Bekleniyor', label: 'Hedef yok', tone: 'danger' },
  pending: { action: 'Karar ver', label: 'Onay bekliyor', tone: 'info' },
  returned: { action: 'Düzeltmeyi gör', label: 'İade edildi', tone: 'warning' },
}

export const filterOptions: Array<{ id: TargetCommandStatus | 'all'; label: string }> = [
  { id: 'all', label: 'Tümü' },
  { id: 'pending', label: 'Onay bekleyen' },
  { id: 'returned', label: 'İade edilen' },
  { id: 'missing', label: 'Hedef yok' },
  { id: 'approved', label: 'Onaylanan' },
  { id: 'adjusted-approved', label: 'Düzenlenen' },
]

export const decisionCopy: Record<TargetCommandStatus, string> = {
  approved: 'Bu mağaza hedefi onaylandı. Yeni değişiklik için revizyon talebi beklenir.',
  'adjusted-approved': 'Bu mağaza hedefi bölge müdürü düzenlemesiyle onaylandı.',
  draft: 'Taslak tamamlandığında bölge müdürü kararına düşer.',
  missing: 'Bu mağaza için gönderilmiş hedef yok. Önce mağaza hedefi beklenir.',
  pending: 'Bu mağaza karar bekliyor.',
  returned: 'Talep iade edildi. Mağaza müdürü düzeltip tekrar gönderebilir.',
}

export function createRegionTargetRows(input: {
  assignedStoreIds: string[]
  coverageRows: TargetCoverageRow[]
  locale: AppLocale
  month: string
  storeOptions: StoreOption[]
  targetRequests: TargetDistributionRequest[]
}): RegionTargetRow[] {
  const rowsByStore = new Map<string, RegionTargetRow>()
  const coverageByStore = groupCoverageByStore(input.coverageRows)
  const requestsByStore = groupRequestsByStore(input.targetRequests, `${input.month}-01`)
  const optionMap = new Map(input.storeOptions.map((store) => [store.storeId, store.storeName]))

  for (const storeId of input.assignedStoreIds) {
    optionMap.set(storeId, normalizeDisplayLabel(optionMap.get(storeId), 'Mağaza adı yok'))
  }

  for (const [storeId, storeName] of optionMap) {
    rowsByStore.set(
      storeId,
      createRegionTargetRow({
        coverageRows: coverageByStore.get(storeId) ?? [],
        locale: input.locale,
        request: requestsByStore.get(storeId) ?? null,
        storeId,
        storeName,
      }),
    )
  }

  for (const request of input.targetRequests) {
    if (requestMonthStart(request.requestMonth) !== `${input.month}-01` || rowsByStore.has(request.storeId)) {
      continue
    }

    rowsByStore.set(
      request.storeId,
      createRegionTargetRow({
        coverageRows: coverageByStore.get(request.storeId) ?? [],
        locale: input.locale,
        request,
        storeId: request.storeId,
        storeName: normalizeDisplayLabel(request.storeName, 'Mağaza adı yok'),
      }),
    )
  }

  return Array.from(rowsByStore.values()).sort((left, right) => {
    const statusOrder = statusSortOrder(left.status) - statusSortOrder(right.status)

    if (statusOrder !== 0) return statusOrder
    return left.storeName.localeCompare(right.storeName, 'tr-TR')
  })
}

export function resolveApprovalState(store: RegionTargetRow, draft: ApprovalDraft | undefined) {
  const originalTotal = Number(store.storeTarget || 0)
  const effectiveTotal = Number.isFinite(draft?.totalTargetValue) ? Number(draft?.totalTargetValue) : originalTotal
  const allocations = store.allocations.map((allocation) => {
    const originalValue = Number(allocation.targetValue || 0)
    const draftValue = draft?.allocations?.[allocation.employeeId]
    const targetValue = Number.isFinite(draftValue) ? Number(draftValue) : originalValue

    return { ...allocation, delta: targetValue - originalValue, originalValue, targetValue }
  })
  const allocationTotal = allocations.reduce((sum, allocation) => sum + Number(allocation.targetValue || 0), 0)
  const difference = allocationTotal - effectiveTotal
  const progress = effectiveTotal > 0 ? Math.min(100, Math.max(0, (allocationTotal / effectiveTotal) * 100)) : 0
  const totalDelta = effectiveTotal - originalTotal

  return {
    allocationTotal,
    allocations,
    difference,
    effectiveTotal,
    hasEditedTargets: Math.abs(totalDelta) > 0.0001 || allocations.some((allocation) => Math.abs(allocation.delta) > 0.0001),
    hasEveryTarget: allocations.every((allocation) => Number(allocation.targetValue || 0) > 0),
    originalTotal,
    progress,
    totalDelta,
    totalsAligned: Math.abs(difference) < 0.0001,
  }
}

export function createPeoplePreview(store: RegionTargetRow) {
  const first = store.allocations[0]?.assigneeLabel ?? 'Personel bekleniyor'
  const second = store.allocations[1]?.assigneeLabel
  const remaining = Math.max(0, store.people - 2)

  return {
    primary: first,
    secondary: second ? `${second} · +${remaining} kişi` : `${store.people} kişi`,
  }
}

export function formatMoney(value: number | null, locale: AppLocale) {
  if (value === null || !Number.isFinite(value)) return 'Yok'
  return `${formatNumber(value, locale, { maximumFractionDigits: 0 })} TL`
}

export function formatPlainNumber(value: number | null, locale: AppLocale) {
  if (value === null || !Number.isFinite(value)) return ''
  return formatNumber(value, locale, { maximumFractionDigits: 0 })
}

export function formatDelta(value: number, locale: AppLocale) {
  if (!Number.isFinite(value) || Math.abs(value) < 0.0001) return 'Yok'
  return `${value > 0 ? '+' : '-'}${formatMoney(Math.abs(value), locale)}`
}

export function parseCurrencyInputValue(value: string) {
  return Number(value.replace(/\D/g, '')) || 0
}

export function formatTargetShare(value: number, total: number, locale: AppLocale) {
  if (!Number.isFinite(total) || total <= 0) return '0%'
  return `%${formatNumber((value / total) * 100, locale, { maximumFractionDigits: 1 })}`
}

export function formatCoveragePercent(value: number) {
  if (!Number.isFinite(value)) return '0%'
  return `%${Math.round(value * 100)}`
}

export function formatDateLabel(value: string | null | undefined, locale: AppLocale) {
  if (!value) return 'Yok'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-US', {
    day: 'numeric',
    month: 'long',
  }).format(date)
}

function createRegionTargetRow(input: {
  coverageRows: TargetCoverageRow[]
  locale: AppLocale
  request: TargetDistributionRequest | null
  storeId: string
  storeName: string
}): RegionTargetRow {
  const request = input.request
  const allocations = request?.allocations ?? createAllocationsFromCoverage(input.coverageRows)
  const storeTarget = request
    ? Number(request.totalTargetValue || 0)
    : sumNullable(input.coverageRows.map((row) => row.targetValue ?? row.pendingTargetValue))
  const totalDistributed = allocations.length > 0
    ? allocations.reduce((sum, allocation) => sum + Number(allocation.targetValue || 0), 0)
    : storeTarget
  const people = request?.allocationCount ?? input.coverageRows.length
  const subtitle = request?.targetLabel || input.coverageRows[0]?.displayName || 'Müdür bilgisi yok'

  return {
    id: request?.requestId ?? input.storeId,
    allocations,
    people,
    request,
    status: resolveRowStatus(request, input.coverageRows),
    storeId: input.storeId,
    storeName: normalizeDisplayLabel(request?.storeName ?? input.storeName, 'Mağaza adı yok'),
    storeTarget,
    submittedAt: request ? formatDateLabel(request.createdAt, input.locale) : 'Yok',
    subtitle,
    totalDistributed,
  }
}

function createAllocationsFromCoverage(rows: TargetCoverageRow[]): TargetDistributionAllocation[] {
  return rows
    .filter((row) => Number(row.targetValue ?? row.pendingTargetValue ?? 0) > 0)
    .map((row) => {
      const note = row.externalEmployeeRef?.trim()

      return {
        employeeId: row.employeeId,
        assigneeLabel: row.displayName,
        targetValue: Number(row.targetValue ?? row.pendingTargetValue ?? 0),
        ...(note ? { note } : {}),
      }
    })
}

function groupCoverageByStore(rows: TargetCoverageRow[]) {
  const grouped = new Map<string, TargetCoverageRow[]>()

  for (const row of rows) grouped.set(row.storeId, [...(grouped.get(row.storeId) ?? []), row])
  return grouped
}

function groupRequestsByStore(requests: TargetDistributionRequest[], requestMonth: string) {
  const grouped = new Map<string, TargetDistributionRequest>()

  for (const request of requests) {
    if (requestMonthStart(request.requestMonth) !== requestMonth) continue

    const current = grouped.get(request.storeId)
    if (!current || requestSortKey(request) > requestSortKey(current)) grouped.set(request.storeId, request)
  }

  return grouped
}

function resolveRowStatus(request: TargetDistributionRequest | null, coverageRows: TargetCoverageRow[]): TargetCommandStatus {
  if (request?.status === 'pending_region_approval') return 'pending'
  if (request?.status === 'approved') return 'approved'
  if (request?.status === 'rejected') return 'returned'
  if (request?.status === 'pending_change_conflict') return 'draft'
  if (coverageRows.some((row) => row.targetStatus === 'pending_region_approval')) return 'pending'
  if (coverageRows.some((row) => row.targetStatus === 'approved')) return 'approved'

  return 'missing'
}

function sumNullable(values: Array<number | null | undefined>) {
  const numericValues = values.filter((value): value is number => Number.isFinite(value))

  if (numericValues.length === 0) return null
  return numericValues.reduce((sum, value) => sum + Number(value || 0), 0)
}

function statusSortOrder(status: TargetCommandStatus) {
  if (status === 'pending') return 0
  if (status === 'returned') return 1
  if (status === 'missing') return 2
  if (status === 'draft') return 3
  return 4
}

function requestMonthStart(value: string) {
  const normalized = value.trim().slice(0, 10)

  if (/^\d{4}-\d{2}$/.test(normalized)) return `${normalized}-01`
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : value
}

function requestSortKey(request: TargetDistributionRequest) {
  return `${request.updatedAt ?? ''}|${request.createdAt ?? ''}|${request.requestId}`
}
