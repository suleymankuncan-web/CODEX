import type { AuthSessionSummary } from '../features/auth/api'
import { hasAnyRole } from '../features/auth/authorization'
import type {
  TargetCoverageRow,
  TargetCoverageSummary,
  TargetDistributionRequest,
} from '../features/targets/api'
import type { AppLocale } from '../lib/i18n'
import type { StoreSurfaceTone } from './store-surface-primitives'

export type TargetAllocationDraft = {
  targetValue: number
  note: string
}

export type TargetWorkflowTab = 'approval' | 'distribution' | 'revision' | 'approved'
export type TargetStatusFilter = 'all' | 'pending' | 'approved'

export const targetCopy = {
  tr: {
    aria: 'Hedefler',
    eyebrow: 'Hedefler',
    title: 'Hedef kontrol masasi',
    description:
      'Magaza hedef dagitimi, onay bekleyen talepler ve personel hedef durumu ayni ritimde okunur. Rolun aksiyonu net kalir; eksik hedef icin tahmin uretilmez.',
    contractReady: 'Canli veri',
    periodBadge: 'donemi',
    period: 'Donem',
    store: 'Magaza',
    search: 'Arama',
    searchPlaceholder: 'Magaza veya personel ara',
    statusFilter: 'Durum',
    allStatuses: 'Tum durumlar',
    pendingStatus: 'Onay bekleyen',
    approvedStatus: 'Onaylanan',
    resetFilters: 'Sifirla',
    allStores: 'Tum yetkili magazalar',
    coverageRate: 'Tamamlanma orani',
    personnelCoverage: 'Personel hedefi',
    storeCoverage: 'Magaza hedefi',
    personnelMetric: 'Personel',
    storeMetric: 'Magaza',
    decisionMetric: 'Karar',
    noRequestMetric: 'Talep yok',
    personnelWithTargets: 'personel hedefli',
    storesWithTargets: 'Magaza hedefli',
    storesWithoutTargets: 'Aktif hedef kaydi olmayan magaza',
    pendingStoreNote: 'Onay bekleyen magaza',
    coveredPersonnel: 'Onayli personel',
    pendingRequests: 'Onay bekleyen talep',
    coverageRisk: 'Eksik / riskli referans',
    totalPersonnel: 'Hedefli personel',
    targetApprovalQueue: 'Onay akisi',
    approvalQueueCopy:
      'Bolge ve super admin rolleri, yalnizca karar yetkisi olan magazalar icin onay aksiyonu alir.',
    coverageTitle: 'Hedef referanslari',
    coverageCopy:
      'Skorlamaya girecek hedef referanslari bu listeden takip edilir. Eksik hedef icin sistem tahmin uretmez.',
    targetRequestTitle: 'Personel hedef dagitimi',
    targetRequestCopy:
      'Magaza muduru toplam hedefi aktif personele dagitir. Toplam tutar eslesmeden istek gonderilemez.',
    readOnlyTitle: 'Okuma modu',
    readOnlyCopy:
      'Bu rol hedef durumunu ve riskleri gorur; hedef olusturma ya da onay aksiyonu almaz.',
    approvalTab: 'Onay akisi',
    distributionTab: 'Dagitim talebi',
    revisionTab: 'Revize Talebi',
    approvedTab: 'Onaylananlar',
    noPendingTitle: 'Onay bekleyen hedef talebi yok',
    noPendingCopy: 'Secili donem ve magaza icin bolge karari bekleyen hedef talebi bulunmuyor.',
    noCoverageTitle: 'Hedef referans kaydi yok',
    noCoverageCopy: 'Secili donem icin goruntulenecek personel hedef referansi bulunmuyor.',
    noPersonnelTitle: 'Hedef dagitilacak personel yok',
    noPersonnelCopy: 'Secili magazada hedef dagitimi icin aktif personel donmedi.',
    targetLabel: 'Hedef adi',
    targetLabelDefault: 'Aylik personel hedef dagitimi',
    totalTarget: 'Toplam hedef',
    approvedRequests: 'Onaylananlar',
    approvedRequestsCopy: 'Onay akisi tamamlanan magaza hedefleri burada izlenir.',
    revisionRequests: 'Revize talebi',
    revisionRequestsCopy:
      'Onaylanmis aylik hedef snapshoti uzerinden yeni revize talebi olusturulur.',
    revisionCreate: 'Revize olustur',
    revisionSubmit: 'Revize talebi gonder',
    revisionNote: 'Revize notu',
    approvedTotal: 'Onayli toplam',
    revisionTotal: 'Revize toplam',
    difference: 'Fark',
    noApprovedTitle: 'Onaylanan hedef yok',
    noApprovedCopy: 'Secili magaza ve donemde onaylanan hedef talebi bulunmuyor.',
    revisionMismatch: 'Revize toplam onayli toplamla eslesmeli.',
    revisionNoChange: 'Gonderim icin en az bir hedef tutari degismeli.',
    revisionLabelSuffix: 'revize',
    requestReason: 'Talep notu',
    approvalNote: 'Karar notu',
    optionalNote: 'Opsiyonel not',
    submitTarget: 'Onaya gonder',
    submitting: 'Gonderiliyor',
    approve: 'Onayla',
    approving: 'Onaylaniyor',
    cannotApprove: 'Bu magaza icin karar aksiyonu yok',
    allocationTotal: 'Dagitilan toplam',
    remainingTarget: 'Kalan hedef',
    allocationMismatch: 'Dagitilan hedef toplam hedefle eslesmeli.',
    targetValue: 'Hedef',
    share: 'Pay',
    status: 'Durum',
    createdAt: 'Gonderim',
    storeName: 'Magaza',
    personnel: 'Personel',
    approvedTarget: 'Onayli hedef',
    pendingTarget: 'Bekleyen hedef',
    sellerCode: 'Kod',
    requestOwner: 'Gonderen',
    allocationCount: 'Kisi',
    reason: 'Not',
    loaded: 'Yuklendi',
    emptyValue: 'Yok',
    currentScope: 'Mevcut gorunum',
    storeManagerMode: 'Yazma akisi',
    regionMode: 'Karar akisi',
    viewerMode: 'Okuma akisi',
    success: 'Islem tamamlandi',
  },
  en: {
    aria: 'Targets',
    eyebrow: 'Targets',
    title: 'Target control desk',
    description:
      'Store target distribution, pending requests, and personnel target status are read in one rhythm. The active role stays clear; missing targets are never guessed.',
    contractReady: 'Live data',
    periodBadge: 'period',
    period: 'Period',
    store: 'Store',
    search: 'Search',
    searchPlaceholder: 'Search store or personnel',
    statusFilter: 'Status',
    allStatuses: 'All statuses',
    pendingStatus: 'Pending approval',
    approvedStatus: 'Approved',
    resetFilters: 'Reset',
    allStores: 'All authorized stores',
    coverageRate: 'Completion rate',
    personnelCoverage: 'Personnel targets',
    storeCoverage: 'Store targets',
    personnelMetric: 'Personnel',
    storeMetric: 'Store',
    decisionMetric: 'Decision',
    noRequestMetric: 'No request',
    personnelWithTargets: 'personnel targeted',
    storesWithTargets: 'Stores targeted',
    storesWithoutTargets: 'Stores without active target record',
    pendingStoreNote: 'Stores waiting for approval',
    coveredPersonnel: 'Approved personnel',
    pendingRequests: 'Pending requests',
    coverageRisk: 'Missing / risky references',
    totalPersonnel: 'Targeted personnel',
    targetApprovalQueue: 'Approval flow',
    approvalQueueCopy:
      'Region and super admin roles can approve only stores covered by their decision authority.',
    coverageTitle: 'Target references',
    coverageCopy:
      'Target references used by scoring are tracked here. The system does not guess missing targets.',
    targetRequestTitle: 'Personnel target distribution',
    targetRequestCopy:
      'The store manager distributes the store total across active personnel. Submission stays blocked until totals match.',
    readOnlyTitle: 'Observation mode',
    readOnlyCopy:
      'This role sees target status and risks, but cannot create or approve targets.',
    approvalTab: 'Approval flow',
    distributionTab: 'Distribution request',
    revisionTab: 'Revision request',
    approvedTab: 'Approved',
    noPendingTitle: 'No target requests waiting for approval',
    noPendingCopy: 'No target request is waiting for region decision in the selected period and store.',
    noCoverageTitle: 'No target references',
    noCoverageCopy: 'No personnel target reference is visible for the selected period.',
    noPersonnelTitle: 'No personnel available for target distribution',
    noPersonnelCopy: 'The selected store did not return active personnel for target distribution.',
    targetLabel: 'Target label',
    targetLabelDefault: 'Monthly personnel target distribution',
    totalTarget: 'Total target',
    approvedRequests: 'Approved',
    approvedRequestsCopy: 'Store targets completed in the approval flow are shown here.',
    revisionRequests: 'Revision request',
    revisionRequestsCopy:
      'Create a new revision request from an approved monthly target snapshot.',
    revisionCreate: 'Create revision',
    revisionSubmit: 'Submit revision request',
    revisionNote: 'Revision note',
    approvedTotal: 'Approved total',
    revisionTotal: 'Revision total',
    difference: 'Difference',
    noApprovedTitle: 'No approved targets',
    noApprovedCopy: 'No approved target request exists for the selected store and period.',
    revisionMismatch: 'Revision total must match the approved total.',
    revisionNoChange: 'At least one target amount must change before submission.',
    revisionLabelSuffix: 'revision',
    requestReason: 'Request note',
    approvalNote: 'Decision note',
    optionalNote: 'Optional note',
    submitTarget: 'Submit for approval',
    submitting: 'Submitting',
    approve: 'Approve',
    approving: 'Approving',
    cannotApprove: 'No decision action for this store',
    allocationTotal: 'Allocated total',
    remainingTarget: 'Remaining target',
    allocationMismatch: 'Allocated target must match the total target.',
    targetValue: 'Target',
    share: 'Share',
    status: 'Status',
    createdAt: 'Submitted',
    storeName: 'Store',
    personnel: 'Personnel',
    approvedTarget: 'Approved target',
    pendingTarget: 'Pending target',
    sellerCode: 'Code',
    requestOwner: 'Submitted by',
    allocationCount: 'People',
    reason: 'Note',
    loaded: 'Loaded',
    emptyValue: 'None',
    currentScope: 'Current view',
    storeManagerMode: 'Write flow',
    regionMode: 'Decision flow',
    viewerMode: 'Read flow',
    success: 'Completed',
  },
} as const

type TargetPageCopy = (typeof targetCopy)[AppLocale]

type TargetWorkflowTabOption = {
  id: TargetWorkflowTab
  label: string
  count: number
  tone: StoreSurfaceTone
}

export function createStoreOptions(input: {
  assignedStoreIds: string[]
  coverageRows: TargetCoverageRow[]
  targetRequests: TargetDistributionRequest[]
}) {
  const stores = new Map<string, string>()

  for (const storeId of input.assignedStoreIds) {
    stores.set(storeId, storeId)
  }

  for (const row of input.coverageRows) {
    stores.set(row.storeId, row.storeName || row.storeId)
  }

  for (const request of input.targetRequests) {
    stores.set(request.storeId, request.storeName || request.storeId)
  }

  return Array.from(stores, ([storeId, storeName]) => ({ storeId, storeName })).sort((a, b) =>
    a.storeName.localeCompare(b.storeName),
  )
}

export function resolveTargetUserMode(authSummary: AuthSessionSummary | null, canCreateForStore: boolean) {
  if (hasAnyRole(authSummary, ['REGION_MANAGER', 'SUPER_ADMIN'])) {
    return { badgeKey: 'regionMode' as const, tone: 'warning' as StoreSurfaceTone }
  }

  if (canCreateForStore) {
    return { badgeKey: 'storeManagerMode' as const, tone: 'accent' as StoreSurfaceTone }
  }

  return { badgeKey: 'viewerMode' as const, tone: 'neutral' as StoreSurfaceTone }
}

export function createEmptyCoverageSummary(requestMonth: string): TargetCoverageSummary {
  return {
    requestMonth,
    totalEmployees: 0,
    coveredEmployees: 0,
    missingEmployees: 0,
    pendingEmployees: 0,
    conflictEmployees: 0,
    staleEmployees: 0,
    uncoveredEmployees: 0,
    coverageRate: 0,
  }
}

export function createStoreCoverageSummary(coverageRows: TargetCoverageRow[]) {
  const stores = new Map<string, { approved: boolean; pending: boolean }>()

  for (const row of coverageRows) {
    const current = stores.get(row.storeId) ?? { approved: false, pending: false }

    stores.set(row.storeId, {
      approved: current.approved || row.targetStatus === 'approved',
      pending:
        current.pending ||
        row.targetStatus === 'pending_region_approval' ||
        row.targetStatus === 'pending_change_conflict',
    })
  }

  const storeStates = Array.from(stores.values())
  const totalStores = storeStates.length
  const coveredStores = storeStates.filter((store) => store.approved).length
  const pendingStores = storeStates.filter((store) => !store.approved && store.pending).length
  const missingStores = storeStates.filter((store) => !store.approved && !store.pending).length

  return {
    totalStores,
    coveredStores,
    pendingStores,
    missingStores,
    coverageRate: totalStores > 0 ? coveredStores / totalStores : 0,
  }
}

export function createStoreRequestSummary(input: {
  requestMonthStart: string
  storeOptions: Array<{ storeId: string; storeName: string }>
  targetRequests: TargetDistributionRequest[]
}) {
  const storeIds = new Set(input.storeOptions.map((store) => store.storeId).filter(Boolean))
  const latestRequestByStore = new Map<string, TargetDistributionRequest>()

  for (const request of input.targetRequests) {
    if (getTargetRequestMonthStart(request.requestMonth) !== input.requestMonthStart) {
      continue
    }

    if (storeIds.size > 0 && !storeIds.has(request.storeId)) {
      continue
    }

    const current = latestRequestByStore.get(request.storeId)

    if (!current || getRequestSortKey(request) > getRequestSortKey(current)) {
      latestRequestByStore.set(request.storeId, request)
    }
  }

  const latestRequests = Array.from(latestRequestByStore.values())
  const approvedStores = latestRequests.filter((request) => request.status === 'approved').length
  const pendingStores = latestRequests.filter(
    (request) => request.status === 'pending_region_approval',
  ).length
  const totalStores = Math.max(storeIds.size, latestRequestByStore.size)
  const activeStores = approvedStores + pendingStores
  const missingStores = Math.max(totalStores - activeStores, 0)

  return {
    totalStores,
    approvedStores,
    pendingStores,
    missingStores,
    coverageRate: totalStores > 0 ? approvedStores / totalStores : 0,
  }
}

function getTargetRequestMonthStart(value: string) {
  const datePart = value.trim().slice(0, 10)

  return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : value
}

function getRequestSortKey(request: TargetDistributionRequest) {
  return `${request.updatedAt ?? ''}|${request.createdAt ?? ''}|${request.requestId}`
}

export function isTargetRequestWorkflowVisible(request: TargetDistributionRequest) {
  return request.status === 'approved' || request.status === 'pending_region_approval'
}

export function isTargetRequestInScope(input: {
  effectiveSelectedStoreId: string
  request: TargetDistributionRequest
  requestMonthStart: string
  searchQuery: string
  statusFilter: TargetStatusFilter
}) {
  if (getTargetRequestMonthStart(input.request.requestMonth) !== input.requestMonthStart) {
    return false
  }

  if (input.effectiveSelectedStoreId && input.request.storeId !== input.effectiveSelectedStoreId) {
    return false
  }

  if (input.statusFilter === 'pending' && input.request.status !== 'pending_region_approval') {
    return false
  }

  if (input.statusFilter === 'approved' && input.request.status !== 'approved') {
    return false
  }

  const normalizedSearch = input.searchQuery.trim().toLocaleLowerCase('tr-TR')

  if (!normalizedSearch) {
    return true
  }

  const searchableValues = [
    input.request.storeId,
    input.request.storeName,
    input.request.targetLabel,
    input.request.requestReason,
    ...input.request.allocations.map((allocation) => allocation.assigneeLabel),
  ]

  return searchableValues
    .filter(Boolean)
    .some((value) => value?.toLocaleLowerCase('tr-TR').includes(normalizedSearch))
}

export function createAvailableTargetTabs(input: {
  approvedCount: number
  canApproveTargets: boolean
  canCreateForStore: boolean
  copy: Pick<TargetPageCopy, 'approvalTab' | 'approvedTab' | 'distributionTab' | 'revisionTab'>
  pendingCount: number
}): TargetWorkflowTabOption[] {
  const tabs: TargetWorkflowTabOption[] = []

  if (input.canApproveTargets) {
    tabs.push({
      id: 'approval',
      label: input.copy.approvalTab,
      count: input.pendingCount,
      tone: input.pendingCount > 0 ? 'warning' : 'neutral',
    })
  }

  if (input.canCreateForStore) {
    tabs.push({
      id: 'distribution',
      label: input.copy.distributionTab,
      count: 1,
      tone: 'accent',
    })
    tabs.push({
      id: 'revision',
      label: input.copy.revisionTab,
      count: input.approvedCount,
      tone: input.approvedCount > 0 ? 'accent' : 'neutral',
    })
  }

  tabs.push({
    id: 'approved',
    label: input.copy.approvedTab,
    count: input.approvedCount,
    tone: input.approvedCount > 0 ? 'calm' : 'neutral',
  })

  return tabs
}

export function resolveDefaultTargetWorkflowTab(
  availableTabs: Array<{ id: TargetWorkflowTab; count: number }>,
) {
  const pendingApprovalTab = availableTabs.find((tab) => tab.id === 'approval' && tab.count > 0)

  if (pendingApprovalTab) {
    return pendingApprovalTab.id
  }

  const distributionTab = availableTabs.find((tab) => tab.id === 'distribution')

  if (distributionTab) {
    return distributionTab.id
  }

  const approvedTab = availableTabs.find((tab) => tab.id === 'approved' && tab.count > 0)

  return approvedTab?.id ?? availableTabs[0]?.id ?? 'approved'
}

export function getCurrentMonthInput() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')

  return `${now.getFullYear()}-${month}`
}

export function formatMonthLabel(monthInput: string, locale: AppLocale) {
  const parts = monthInput.split('-').map(Number)
  const safeYear = Number.isFinite(parts[0]) ? parts[0] : new Date().getFullYear()
  const safeMonth = Number.isFinite(parts[1]) ? parts[1] : 1
  const date = new Date(safeYear ?? new Date().getFullYear(), (safeMonth ?? 1) - 1, 1)

  return new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-US', {
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export function formatCoverageRate(rate: number) {
  if (!Number.isFinite(rate)) {
    return '0%'
  }

  return `${Math.round(rate * 100)}%`
}
