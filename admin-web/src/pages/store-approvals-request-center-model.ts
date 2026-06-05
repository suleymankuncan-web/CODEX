import type { TargetDistributionRequest } from '../features/targets/api'
import type { OffboardingRequest, SellerCodeRequest } from '../features/workforce/api'
import { formatDateTime } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import type { StoreApprovalsPersona } from './store-approvals-model'
import type { StoreSurfaceTone } from './store-surface-primitives'

export type RequestCenterTab = 'open' | 'done'
export type RequestCenterType = 'all' | 'target' | 'sellerCode' | 'offboarding'
export type RequestCenterStatus = 'all' | 'pending' | 'returned' | 'approved'

export type RequestCenterRow = {
  id: string
  type: Exclude<RequestCenterType, 'all'>
  title: string
  subtitle: string
  scopeTitle: string
  scopeSubtitle: string
  status: string
  statusLabel: string
  statusTone: StoreSurfaceTone
  sourceLabel: string
  updatedAt: string
  updatedLabel: string
  bucket: RequestCenterTab
  rowTone: 'neutral' | 'urgent' | 'returned'
  actionLabel: string
  actionTo: string
  actionPrimary: boolean
}

export const PAGE_SIZE = 15

export const requestCenterCopy = {
  tr: {
    aria: 'Talep Merkezi',
    title: 'Talep Merkezi',
    description:
      'Hedef girişi bu sayfadan çıkar; burada açılmış talepler, durumlar ve doğru işlem yolu okunur.',
    loadingTitle: 'Talep merkezi yükleniyor',
    loadingCopy: 'Açılmış hedef ve personel talepleri alınıyor.',
    errorTitle: 'Talep merkezi açılamadı',
    searchPlaceholder: 'Talep, mağaza veya kişi ara',
    allTypes: 'Tüm tipler',
    allStatuses: 'Tüm durumlar',
    periodAll: 'Tüm dönemler',
    resetFilters: 'Sıfırla',
    openTab: 'Açık / Bekleyen',
    doneTab: 'Tamamlanan',
    regionTableTitle: 'Bölge talep kuyruğu',
    storeTableTitle: 'Mağaza taleplerim',
    tableDescription:
      'Her satır gerçek bir talep kaydını temsil eder; liste sayfa başına en fazla 15 kayıt gösterir.',
    countOpen: '{count} açık kayıt',
    countDone: '{count} tamamlanan',
    pager: '{from}-{to} / {total} kayıt gösteriliyor',
    emptyTitle: 'Seçili görünümde talep yok',
    emptyCopy: 'Filtreleri değiştirerek açık veya tamamlanan talepleri kontrol edebilirsin.',
    pendingMetric: 'Karar bekleyen',
    pendingMetricNote: 'Açık hedef ve personel talepleri.',
    returnedMetric: 'Düzeltme dönen',
    returnedMetricNote: 'Mağaza aksiyonu bekleyen kayıtlar.',
    completedMetric: 'Tamamlanan',
    completedMetricNote: 'Bu kapsamda kapanmış talepler.',
    requestColumn: 'Talep',
    scopeColumnRegion: 'Mağaza',
    scopeColumnStore: 'Kapsam',
    statusColumn: 'Durum',
    sourceColumn: 'Kaynak',
    updatedColumn: 'Güncellendi',
    actionColumn: 'Aksiyon',
    targetType: 'Hedef',
    sellerCodeType: 'Satıcı kodu',
    offboardingType: 'Personel çıkış',
    targetSource: 'Hedef akışı',
    workforceSource: 'Personel talebi',
    targetAction: 'Hedefe git',
    workforceAction: 'Düzelt',
    workforceReadAction: 'Durumu oku',
    detailAction: 'Detay',
    pendingRegionStatus: 'Bölge onayı bekliyor',
    pendingHrStatus: 'HR onayı bekliyor',
    rejectedStatus: 'İade edildi',
    approvedStatus: 'Onaylandı',
    unknownStatus: 'Durum okunuyor',
    targetSubtitle: 'Toplam hedef ve personel dağılımı',
    sellerSubtitle: 'Yeni personel kod kaydı',
    offboardingSubtitle: 'Personel çıkış kaydı',
    targetScopeSubtitle: '{count} kişi hedefli',
    sellerScopeSubtitle: 'TC son 4 {last4}',
    offboardingScopeSubtitle: '{ref}',
    noReference: 'referans yok',
    regionSubtitle: 'BM kapsam satırı',
    storeSubtitle: 'Mağaza hedef talebi',
  },
  en: {
    aria: 'Request Center',
    title: 'Request Center',
    description:
      'Target entry no longer lives here; this page reads opened requests, status, and the right action path.',
    loadingTitle: 'Loading request center',
    loadingCopy: 'Opened target and personnel requests are being loaded.',
    errorTitle: 'Request center could not be opened',
    searchPlaceholder: 'Search request, store, or person',
    allTypes: 'All types',
    allStatuses: 'All statuses',
    periodAll: 'All periods',
    resetFilters: 'Reset',
    openTab: 'Open / Pending',
    doneTab: 'Completed',
    regionTableTitle: 'Region request queue',
    storeTableTitle: 'My store requests',
    tableDescription:
      'Each row represents a real request record; the list shows at most 15 rows per page.',
    countOpen: '{count} open records',
    countDone: '{count} completed',
    pager: 'Showing {from}-{to} / {total} records',
    emptyTitle: 'No requests in this view',
    emptyCopy: 'Change filters to check open or completed requests.',
    pendingMetric: 'Awaiting decision',
    pendingMetricNote: 'Open target and personnel requests.',
    returnedMetric: 'Returned corrections',
    returnedMetricNote: 'Records waiting for store action.',
    completedMetric: 'Completed',
    completedMetricNote: 'Closed requests in this scope.',
    requestColumn: 'Request',
    scopeColumnRegion: 'Store',
    scopeColumnStore: 'Scope',
    statusColumn: 'Status',
    sourceColumn: 'Source',
    updatedColumn: 'Updated',
    actionColumn: 'Action',
    targetType: 'Target',
    sellerCodeType: 'Seller code',
    offboardingType: 'Employee exit',
    targetSource: 'Target flow',
    workforceSource: 'Personnel request',
    targetAction: 'Go to targets',
    workforceAction: 'Correct',
    workforceReadAction: 'Read status',
    detailAction: 'Detail',
    pendingRegionStatus: 'Waiting for region approval',
    pendingHrStatus: 'Waiting for HR approval',
    rejectedStatus: 'Returned',
    approvedStatus: 'Approved',
    unknownStatus: 'Reading status',
    targetSubtitle: 'Total target and personnel distribution',
    sellerSubtitle: 'New personnel code record',
    offboardingSubtitle: 'Employee exit record',
    targetScopeSubtitle: '{count} people targeted',
    sellerScopeSubtitle: 'National ID last 4 {last4}',
    offboardingScopeSubtitle: '{ref}',
    noReference: 'no reference',
    regionSubtitle: 'Region scope row',
    storeSubtitle: 'Store target request',
  },
} as const

export type RequestCenterCopy = (typeof requestCenterCopy)[AppLocale]

export function buildRequestRows(input: {
  copy: RequestCenterCopy
  locale: AppLocale
  offboardingRequests: OffboardingRequest[]
  persona: StoreApprovalsPersona
  scopeStoreIds: string[]
  sellerCodeRequests: SellerCodeRequest[]
  targetRequests: TargetDistributionRequest[]
}) {
  const scopeStoreSet = new Set(input.scopeStoreIds)
  const scopedTargetRequests = input.targetRequests.filter((request) =>
    scopeStoreSet.size === 0 || scopeStoreSet.has(request.storeId),
  )
  const scopedSellerRequests = input.sellerCodeRequests.filter((request) =>
    scopeStoreSet.size === 0 || scopeStoreSet.has(request.storeId),
  )
  const scopedOffboardingRequests = input.offboardingRequests.filter((request) =>
    scopeStoreSet.size === 0 || scopeStoreSet.has(request.storeId),
  )
  const targetRows = scopedTargetRequests.map((request) =>
    mapTargetRequestToRow({
      copy: input.copy,
      locale: input.locale,
      persona: input.persona,
      request,
    }),
  )
  const sellerRows = scopedSellerRequests.map((request) =>
    mapSellerCodeRequestToRow({
      copy: input.copy,
      locale: input.locale,
      request,
    }),
  )
  const offboardingRows = scopedOffboardingRequests.map((request) =>
    mapOffboardingRequestToRow({
      copy: input.copy,
      locale: input.locale,
      request,
    }),
  )

  return [...targetRows, ...sellerRows, ...offboardingRows].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )
}

export function matchesStatusFilter(status: string, filter: RequestCenterStatus) {
  if (filter === 'all') return true
  if (filter === 'approved') return status === 'approved'
  if (filter === 'returned') return status === 'rejected'
  return status !== 'approved' && status !== 'rejected'
}

export function createPeriodOptions(rows: RequestCenterRow[], locale: AppLocale) {
  const periods = Array.from(new Set(rows.map((row) => row.updatedAt.slice(0, 7)))).filter(Boolean)

  return periods
    .sort((a, b) => b.localeCompare(a))
    .map((period) => ({
      value: period,
      label: new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-US', {
        month: 'long',
        year: 'numeric',
      }).format(new Date(`${period}-01`)),
    }))
}

export function formatCopy(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, value),
    template,
  )
}

function mapTargetRequestToRow(input: {
  copy: RequestCenterCopy
  locale: AppLocale
  persona: StoreApprovalsPersona
  request: TargetDistributionRequest
}): RequestCenterRow {
  const isApproved = input.request.status === 'approved'
  const status = resolveStatus(input.request.status, input.copy)

  return {
    id: `target:${input.request.requestId}`,
    type: 'target',
    title: input.request.targetLabel || input.copy.targetType,
    subtitle: input.copy.targetSubtitle,
    scopeTitle: input.request.storeName || input.request.storeId,
    scopeSubtitle:
      input.persona === 'regionManager'
        ? input.copy.regionSubtitle
        : formatCopy(input.copy.targetScopeSubtitle, {
          count: String(input.request.allocationCount),
        }),
    status: input.request.status,
    statusLabel: status.label,
    statusTone: status.tone,
    sourceLabel: input.copy.targetSource,
    updatedAt: input.request.updatedAt,
    updatedLabel: formatDateTime(input.request.updatedAt, input.locale),
    bucket: isApproved ? 'done' : 'open',
    rowTone: input.request.status === 'pending_region_approval' ? 'urgent' : 'neutral',
    actionLabel: isApproved ? input.copy.detailAction : input.copy.targetAction,
    actionTo: createTargetHandoffUrl(input.request),
    actionPrimary: input.request.status === 'pending_region_approval',
  }
}

function mapSellerCodeRequestToRow(input: {
  copy: RequestCenterCopy
  locale: AppLocale
  request: SellerCodeRequest
}): RequestCenterRow {
  const isApproved = input.request.status === 'approved'
  const isReturned = input.request.status === 'rejected'
  const status = resolveStatus(input.request.status, input.copy)

  return {
    id: `sellerCode:${input.request.requestId}`,
    type: 'sellerCode',
    title: `${input.request.firstName} ${input.request.lastName}`.trim() || input.copy.sellerCodeType,
    subtitle: input.copy.sellerSubtitle,
    scopeTitle: input.request.storeName || input.request.storeId,
    scopeSubtitle: formatCopy(input.copy.sellerScopeSubtitle, {
      last4: input.request.nationalIdLast4,
    }),
    status: input.request.status,
    statusLabel: status.label,
    statusTone: status.tone,
    sourceLabel: input.copy.workforceSource,
    updatedAt: input.request.updatedAt,
    updatedLabel: formatDateTime(input.request.updatedAt, input.locale),
    bucket: isApproved ? 'done' : 'open',
    rowTone: isReturned ? 'returned' : 'neutral',
    actionLabel: isReturned ? input.copy.workforceAction : input.copy.workforceReadAction,
    actionTo: createWorkforceHandoffUrl({
      ...(isReturned ? { requestId: input.request.requestId } : {}),
      storeId: input.request.storeId,
      type: 'sellerCode',
    }),
    actionPrimary: isReturned,
  }
}

function mapOffboardingRequestToRow(input: {
  copy: RequestCenterCopy
  locale: AppLocale
  request: OffboardingRequest
}): RequestCenterRow {
  const isApproved = input.request.status === 'approved'
  const isReturned = input.request.status === 'rejected'
  const status = resolveStatus(input.request.status, input.copy)

  return {
    id: `offboarding:${input.request.requestId}`,
    type: 'offboarding',
    title: input.request.displayName || input.copy.offboardingType,
    subtitle: input.copy.offboardingSubtitle,
    scopeTitle: input.request.storeName || input.request.storeId,
    scopeSubtitle: formatCopy(input.copy.offboardingScopeSubtitle, {
      ref: input.request.externalEmployeeRef ?? input.copy.noReference,
    }),
    status: input.request.status,
    statusLabel: status.label,
    statusTone: status.tone,
    sourceLabel: input.copy.workforceSource,
    updatedAt: input.request.updatedAt,
    updatedLabel: formatDateTime(input.request.updatedAt, input.locale),
    bucket: isApproved ? 'done' : 'open',
    rowTone: isReturned ? 'returned' : 'neutral',
    actionLabel: isReturned ? input.copy.workforceAction : input.copy.workforceReadAction,
    actionTo: createWorkforceHandoffUrl({
      ...(isReturned ? { requestId: input.request.requestId } : {}),
      storeId: input.request.storeId,
      type: 'offboarding',
    }),
    actionPrimary: isReturned,
  }
}

function resolveStatus(status: string, copy: RequestCenterCopy) {
  switch (status) {
    case 'approved':
      return { label: copy.approvedStatus, tone: 'calm' as StoreSurfaceTone }
    case 'pending_region_approval':
      return { label: copy.pendingRegionStatus, tone: 'warning' as StoreSurfaceTone }
    case 'pending_hr_approval':
      return { label: copy.pendingHrStatus, tone: 'accent' as StoreSurfaceTone }
    case 'rejected':
      return { label: copy.rejectedStatus, tone: 'danger' as StoreSurfaceTone }
    default:
      return { label: copy.unknownStatus, tone: 'neutral' as StoreSurfaceTone }
  }
}

function createTargetHandoffUrl(request: TargetDistributionRequest) {
  const params = new URLSearchParams({
    requestMonth: request.requestMonth.slice(0, 7),
    storeId: request.storeId,
  })

  if (request.status === 'approved') {
    params.set('status', 'approved')
    params.set('tab', 'approved')
  } else {
    params.set('status', 'pending')
    params.set('tab', 'approval')
  }

  return `/store/targets?${params.toString()}`
}

function createWorkforceHandoffUrl(input: {
  requestId?: string
  storeId: string
  type: 'sellerCode' | 'offboarding'
}) {
  const params = new URLSearchParams({
    storeId: input.storeId,
  })

  if (input.requestId) {
    params.set('requestType', input.type)
    params.set('requestId', input.requestId)
  }

  return `/store/workforce?${params.toString()}`
}
