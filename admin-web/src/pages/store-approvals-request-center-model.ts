import type { RequestCenterItem } from '../features/store-approvals/request-center-api'
import { normalizeDisplayLabel } from '../lib/display-labels'
import { formatDateTime } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import type { StoreApprovalsPersona } from './store-approvals-model'
import type { StoreSurfaceTone } from './store-surface-primitives'

export type RequestCenterTab = 'open' | 'done'
export type RequestCenterType = 'all' | 'target' | 'sellerCode' | 'offboarding'
export type RequestCenterStatus = 'all' | 'pending' | 'returned' | 'approved' | 'overdue'
export type RequestCenterSort = 'updatedDesc' | 'waitingDesc' | 'storeAsc' | 'typeAsc'

export type RequestCenterEvent = {
  id: string
  label: string
  occurredAt: string
  occurredLabel: string
  actorLabel: string
}

export type RequestCenterRow = {
  id: string
  type: Exclude<RequestCenterType, 'all'>
  title: string
  subtitle: string
  scopeTitle: string
  scopeSubtitle: string
  regionId: string
  regionName: string
  regionManagerNames: string[]
  status: string
  statusLabel: string
  statusTone: StoreSurfaceTone
  createdLabel: string
  updatedAt: string
  updatedLabel: string
  waitingSince: string | null
  waitingLabel: string
  nextOwnerLabel: string
  dueLabel: string
  isOverdue: boolean
  events: RequestCenterEvent[]
  eventTotal: number
  bucket: RequestCenterTab
  rowTone: 'neutral' | 'urgent' | 'returned'
  actionLabel: string
  actionTo: string
  actionPrimary: boolean
}

export const PAGE_SIZE = 15

export const requestCenterCopy = {
  tr: {
    aria: 'Talep Merkezi', title: 'Talep Merkezi',
    description: 'Hedef, personel sicil ve işten ayrılma taleplerini tek bir operasyon görünümünde izle.',
    loadingTitle: 'Talep merkezi yükleniyor', loadingCopy: 'Yetkili talep kayıtları hazırlanıyor.',
    errorTitle: 'Talep merkezi açılamadı', searchPlaceholder: 'Talep, mağaza veya kişi ara',
    allTypes: 'Tüm tipler', allStatuses: 'Tüm durumlar', periodAll: 'Tüm dönemler',
    allSorts: 'Son güncellenen', waitingSort: 'En uzun bekleyen', storeSort: 'Mağaza A-Z', typeSort: 'Talep tipi',
    resetFilters: 'Sıfırla', openTab: 'Aktif talepler', doneTab: 'Tamamlanan',
    regionTableTitle: 'Bölge talepleri', viewerTableTitle: 'Şirket talepleri', storeTableTitle: 'Mağaza taleplerim',
    tableDescription: 'Satıra dokunarak güvenli işlem geçmişini ve yetkili devam yolunu aç.',
    countOpen: '{count} aktif kayıt', countDone: '{count} tamamlanan', pager: '{from}-{to} / {total} kayıt',
    emptyTitle: 'Bu görünümde talep yok', emptyCopy: 'Filtreleri değiştirerek diğer kayıtları kontrol edebilirsin.',
    openMetric: 'Açık talepler', openMetricNote: 'Karar veya mağaza aksiyonu bekliyor.',
    completedMetric: 'Tamamlanan', completedMetricNote: 'Onaylanarak kapanan talepler.',
    returnedMetric: 'İade edilen', returnedMetricNote: 'Mağaza düzeltmesi bekliyor.',
    overdueMetric: 'Geciken', overdueMetricNote: 'Onaylı hizmet süresini aşan kayıtlar.',
    requestColumn: 'Talep', scopeColumnRegion: 'Mağaza', scopeColumnStore: 'Talep alanı',
    statusColumn: 'Durum', waitingColumn: 'Bekleme', ownerColumn: 'Sıradaki işlem', updatedColumn: 'Güncelleme',
    targetType: 'Hedef', sellerCodeType: 'Personel sicil', offboardingType: 'İşten ayrılma',
    targetAction: 'Hedefe git', workforceAction: 'Düzelt', workforceReadAction: 'Kaynağa git', detailAction: 'Kaynağı gör',
    pendingRegionStatus: 'Bölge onayı bekliyor', pendingHrStatus: 'İK onayı bekliyor', rejectedStatus: 'İade edildi',
    approvedStatus: 'Onaylandı', adjustedApprovedStatus: 'Düzenlenerek onaylandı', unknownStatus: 'Durum okunuyor',
    targetSubtitle: 'Toplam hedef ve personel dağılımı', sellerSubtitle: 'Yeni personel sicil kaydı',
    offboardingSubtitle: 'Personel işten ayrılma kaydı', targetScopeSubtitle: '{count} kişi hedefli',
    sellerScopeSubtitle: 'TC son 4 {last4}', offboardingScopeSubtitle: '{ref}', noReference: 'referans yok',
    unknownStore: 'Mağaza adı yok', regionSubtitle: 'Bölge talebi', storeSubtitle: 'Mağaza talebi',
    ownerStore: 'Mağaza', ownerRegion: 'Bölge müdürü', ownerHr: 'İK', ownerSystem: 'Sistem', ownerClosed: 'İşlem tamamlandı',
    noWaiting: 'Bekleme yok', overdueSuffix: 'gecikti', duePrefix: 'Son tarih',
    managerUnknown: 'Bölge yöneticisi tanımsız',
    groupCount: '{count} talep',
    drawerDescription: 'Talebin güvenli işlem izi ve mevcut sorumlusu', createdLabel: 'Oluşturuldu',
    factsType: 'Talep tipi', factsStore: 'Mağaza', factsWaiting: 'Bekleme', factsOwner: 'Sıradaki işlem',
    factsUpdated: 'Son güncelleme', factsDue: 'Hizmet süresi', timelineTitle: 'İşlem geçmişi',
    timelineRecent: 'Son 20 işlem gösteriliyor ({count} toplam)',
    eventCreated: 'Talep oluşturuldu', eventApproved: 'Talep onaylandı', eventReturned: 'Talep iade edildi',
    eventResubmitted: 'Talep yeniden gönderildi', actorUnknown: 'Sistem kaydı', close: 'Kapat',
  },
  en: {
    aria: 'Request Center', title: 'Request Center', description: 'Track target, personnel record and offboarding requests in one operational view.',
    loadingTitle: 'Loading request center', loadingCopy: 'Preparing authorized request records.', errorTitle: 'Request center could not be opened',
    searchPlaceholder: 'Search request, store, or person', allTypes: 'All types', allStatuses: 'All statuses', periodAll: 'All periods',
    allSorts: 'Recently updated', waitingSort: 'Longest waiting', storeSort: 'Store A-Z', typeSort: 'Request type', resetFilters: 'Reset',
    openTab: 'Active requests', doneTab: 'Completed', regionTableTitle: 'Region requests', viewerTableTitle: 'Company requests', storeTableTitle: 'My store requests',
    tableDescription: 'Open a row to inspect its safe history and authoritative continuation path.', countOpen: '{count} active records', countDone: '{count} completed',
    pager: '{from}-{to} / {total} records', emptyTitle: 'No requests in this view', emptyCopy: 'Change filters to inspect other records.',
    openMetric: 'Open requests', openMetricNote: 'Waiting for a decision or store action.', completedMetric: 'Completed', completedMetricNote: 'Approved and closed requests.',
    returnedMetric: 'Returned', returnedMetricNote: 'Waiting for store correction.', overdueMetric: 'Overdue', overdueMetricNote: 'Past the approved service window.',
    requestColumn: 'Request', scopeColumnRegion: 'Store', scopeColumnStore: 'Request area', statusColumn: 'Status', waitingColumn: 'Waiting',
    ownerColumn: 'Next action', updatedColumn: 'Updated', targetType: 'Target', sellerCodeType: 'Personnel record', offboardingType: 'Offboarding',
    targetAction: 'Go to targets', workforceAction: 'Correct', workforceReadAction: 'Open source', detailAction: 'View source',
    pendingRegionStatus: 'Waiting for region approval', pendingHrStatus: 'Waiting for HR approval', rejectedStatus: 'Returned', approvedStatus: 'Approved',
    adjustedApprovedStatus: 'Approved with edits', unknownStatus: 'Reading status', targetSubtitle: 'Total target and personnel distribution',
    sellerSubtitle: 'New personnel record', offboardingSubtitle: 'Employee offboarding record', targetScopeSubtitle: '{count} people targeted',
    sellerScopeSubtitle: 'National ID last 4 {last4}', offboardingScopeSubtitle: '{ref}', noReference: 'no reference', unknownStore: 'Store unavailable',
    regionSubtitle: 'Region request', storeSubtitle: 'Store request', ownerStore: 'Store', ownerRegion: 'Region manager', ownerHr: 'HR', ownerSystem: 'System',
    ownerClosed: 'Completed', noWaiting: 'No waiting', overdueSuffix: 'overdue', duePrefix: 'Due', drawerDescription: 'Safe request history and current owner',
    managerUnknown: 'Region manager unavailable',
    groupCount: '{count} requests',
    createdLabel: 'Created', factsType: 'Request type', factsStore: 'Store', factsWaiting: 'Waiting', factsOwner: 'Next action', factsUpdated: 'Last update',
    factsDue: 'Service window', timelineTitle: 'Request history', eventCreated: 'Request created', eventApproved: 'Request approved',
    timelineRecent: 'Showing the latest 20 events ({count} total)',
    eventReturned: 'Request returned', eventResubmitted: 'Request resubmitted', actorUnknown: 'System record', close: 'Close',
  },
} as const

export type RequestCenterCopy = (typeof requestCenterCopy)[AppLocale]

export function buildRequestCenterRows(input: { copy: RequestCenterCopy; locale: AppLocale; persona: StoreApprovalsPersona; items: RequestCenterItem[] }) {
  return input.items.map((item): RequestCenterRow => {
    const isApproved = item.status === 'approved'
    const isReturned = item.status === 'rejected'
    const status = item.requestType === 'target' && isApproved && item.approvalMode === 'adjusted'
      ? { label: input.copy.adjustedApprovedStatus, tone: 'calm' as StoreSurfaceTone }
      : resolveStatus(item.status, input.copy)
    const type = item.requestType
    const isTarget = type === 'target'
    const isSeller = type === 'sellerCode'
    const title = isTarget ? (item.targetLabel || input.copy.targetType) : (item.personDisplayName || (isSeller ? input.copy.sellerCodeType : input.copy.offboardingType))
    const subtitle = isTarget ? input.copy.targetSubtitle : isSeller ? input.copy.sellerSubtitle : input.copy.offboardingSubtitle
    const domainScopeSubtitle = isTarget
      ? (input.persona === 'storeManager' ? formatCopy(input.copy.targetScopeSubtitle, { count: String(item.allocationCount ?? 0) }) : input.copy.regionSubtitle)
      : isSeller
        ? formatCopy(input.copy.sellerScopeSubtitle, { last4: item.nationalIdLast4 ?? input.copy.noReference })
        : formatCopy(input.copy.offboardingScopeSubtitle, { ref: item.externalEmployeeRef ?? input.copy.noReference })
    const scopeSubtitle = input.persona === 'reportViewer'
      ? [item.regionManagerNames.length > 0 ? item.regionManagerNames.join(', ') : input.copy.managerUnknown, item.regionName].filter(Boolean).join(' · ')
      : domainScopeSubtitle
    const nextOwnerLabel = resolveOwner(item.nextOwner, input.copy)
    const events = [...(item.events ?? [])]
      .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime())
      .map((event) => ({ id: event.eventId, label: resolveEvent(event.type, input.copy), occurredAt: event.occurredAt, occurredLabel: formatDateTime(event.occurredAt, input.locale), actorLabel: event.actorDisplayName || input.copy.actorUnknown }))
    return {
      id: `${type}:${item.requestId}`, type, title, subtitle,
      scopeTitle: normalizeDisplayLabel(item.storeName, input.copy.unknownStore), scopeSubtitle,
      regionId: item.regionId, regionName: item.regionName || input.copy.noReference,
      regionManagerNames: item.regionManagerNames,
      status: item.status, statusLabel: status.label, statusTone: status.tone,
      createdLabel: formatDateTime(item.createdAt, input.locale), updatedAt: item.updatedAt, updatedLabel: formatDateTime(item.updatedAt, input.locale),
      waitingSince: item.waitingSince, waitingLabel: formatWaiting(item.waitingSince, item.isOverdue === true, input.locale, input.copy),
      nextOwnerLabel, dueLabel: item.dueAt ? `${input.copy.duePrefix}: ${formatDateTime(item.dueAt, input.locale)}` : input.copy.noWaiting,
      isOverdue: item.isOverdue === true, events, eventTotal: item.eventTotal, bucket: isApproved ? 'done' : 'open',
      rowTone: item.isOverdue ? 'urgent' : isReturned ? 'returned' : 'neutral',
      actionLabel: isTarget ? (isApproved ? input.copy.detailAction : input.copy.targetAction) : (isReturned ? input.copy.workforceAction : input.copy.workforceReadAction),
      actionTo: isTarget ? createTargetUrl(item, input.persona) : createWorkforceUrl(item, isReturned),
      actionPrimary: item.status === 'pending_region_approval' || isReturned,
    }
  })
}

export function filterAndSortRequestCenterRows(input: { rows: RequestCenterRow[]; tab: RequestCenterTab; query: string; type: RequestCenterType; status: RequestCenterStatus; period: string; sort: RequestCenterSort }) {
  const query = input.query.trim().toLocaleLowerCase('tr-TR')
  return input.rows
    .filter((row) => row.bucket === input.tab)
    .filter((row) => input.type === 'all' || row.type === input.type)
    .filter((row) => input.status === 'all' || (input.status === 'approved' ? row.status === 'approved' : input.status === 'returned' ? row.status === 'rejected' : input.status === 'overdue' ? row.isOverdue : row.status !== 'approved' && row.status !== 'rejected'))
    .filter((row) => input.period === 'all' || row.updatedAt.startsWith(input.period))
    .filter((row) => !query || `${row.title} ${row.subtitle} ${row.scopeTitle}`.toLocaleLowerCase('tr-TR').includes(query))
    .sort((a, b) => input.sort === 'storeAsc' ? a.scopeTitle.localeCompare(b.scopeTitle, 'tr') : input.sort === 'typeAsc' ? a.type.localeCompare(b.type) : input.sort === 'waitingDesc' ? (Date.parse(a.waitingSince ?? '') || Infinity) - (Date.parse(b.waitingSince ?? '') || Infinity) : Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
}

export function createPeriodOptions(periods: string[], locale: AppLocale) {
  return Array.from(new Set(periods)).filter(Boolean).sort((a, b) => b.localeCompare(a)).map((period) => ({ value: period, label: new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-US', { month: 'long', year: 'numeric' }).format(new Date(`${period}-01`)) }))
}

export function formatCopy(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce((result, [key, value]) => result.replaceAll(`{${key}}`, value), template)
}

function formatWaiting(value: string | null, overdue: boolean, locale: AppLocale, copy: RequestCenterCopy) {
  if (!value) return copy.noWaiting
  const days = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 86_400_000))
  const label = new Intl.NumberFormat(locale === 'tr' ? 'tr-TR' : 'en-US').format(days)
  const unit = locale === 'tr' ? 'gün' : 'days'
  return overdue ? `${label} ${unit} · ${copy.overdueSuffix}` : `${label} ${unit}`
}

function resolveOwner(owner: RequestCenterItem['nextOwner'], copy: RequestCenterCopy) {
  return owner === 'store' ? copy.ownerStore : owner === 'region' ? copy.ownerRegion : owner === 'hr' ? copy.ownerHr : owner === 'system' ? copy.ownerSystem : copy.ownerClosed
}

function resolveEvent(type: RequestCenterItem['events'][number]['type'], copy: RequestCenterCopy) {
  return type === 'created' ? copy.eventCreated : type === 'approved' ? copy.eventApproved : type === 'returned' ? copy.eventReturned : copy.eventResubmitted
}

function resolveStatus(status: string, copy: RequestCenterCopy) {
  if (status === 'approved') return { label: copy.approvedStatus, tone: 'calm' as StoreSurfaceTone }
  if (status === 'pending_region_approval') return { label: copy.pendingRegionStatus, tone: 'warning' as StoreSurfaceTone }
  if (status === 'pending_hr_approval') return { label: copy.pendingHrStatus, tone: 'accent' as StoreSurfaceTone }
  if (status === 'rejected') return { label: copy.rejectedStatus, tone: 'danger' as StoreSurfaceTone }
  return { label: copy.unknownStatus, tone: 'neutral' as StoreSurfaceTone }
}

function createTargetUrl(item: RequestCenterItem, persona: StoreApprovalsPersona) {
  const params = new URLSearchParams({ storeId: item.storeId })
  if (item.requestMonth) params.set('requestMonth', item.requestMonth.slice(0, 7))
  params.set('tab', item.status === 'approved' ? 'approved' : persona === 'storeManager' ? 'distribution' : 'approval')
  params.set('status', item.status === 'approved' ? 'approved' : 'pending')
  return `/store/targets?${params.toString()}`
}

function createWorkforceUrl(item: RequestCenterItem, returned: boolean) {
  const params = new URLSearchParams({ storeId: item.storeId })
  if (returned) { params.set('requestType', item.requestType); params.set('requestId', item.requestId) }
  return `/store/workforce?${params.toString()}`
}
