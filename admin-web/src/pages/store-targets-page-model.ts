import type { AuthSessionSummary } from '../features/auth/api'
import { hasAnyRole } from '../features/auth/authorization'
import { normalizeDisplayLabel } from '../lib/display-labels'
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
    title: 'Hedefler',
    description: 'Mağaza hedefleri, personel dağılımı ve bölge onayları.',
    contractReady: 'Bölge görünümü',
    periodBadge: 'dönemi',
    period: 'Dönem',
    store: 'Mağaza',
    search: 'Arama',
    searchPlaceholder: 'Mağaza veya personel ara',
    statusFilter: 'Durum',
    allStatuses: 'Tüm durumlar',
    pendingStatus: 'Onay bekleyen',
    approvedStatus: 'Onaylanan',
    resetFilters: 'Sıfırla',
    allStores: 'Tüm mağazalar',
    coverageRate: 'Tamamlanma oranı',
    personnelCoverage: 'Personel hedefi',
    storeCoverage: 'Mağaza hedefi',
    personnelMetric: 'Personel',
    storeMetric: 'Mağaza',
    decisionMetric: 'Karar',
    noRequestMetric: 'Talep yok',
    personnelWithTargets: 'personel hedefli',
    storesWithTargets: 'mağaza hedefli',
    storesWithoutTargets: 'Hedef kaydı olmayan mağaza',
    pendingStoreNote: 'Onay bekleyen mağaza',
    coveredPersonnel: 'Onaylı personel',
    pendingRequests: 'Onay bekleyen talep',
    coverageRisk: 'Eksik / riskli referans',
    totalPersonnel: 'Hedefli personel',
    targetApprovalQueue: 'Mağaza hedefleri',
    approvalQueueCopy: 'Onay bekleyen mağazaları kontrol et, gerekirse düzenleyerek onayla.',
    coverageTitle: 'Hedef referansları',
    coverageCopy: 'Seçili dönem hedefleri bu listeden takip edilir.',
    targetRequestTitle: 'Personel hedef dağıtımı',
    targetRequestCopy:
      'Mağaza müdürü toplam hedefi aktif personele dağıtır. Toplam tutar eşleşmeden gönderim yapılamaz.',
    readOnlyTitle: 'Okuma modu',
    readOnlyCopy: 'Bu rol hedef durumunu görür; hedef oluşturma ya da onay aksiyonu almaz.',
    approvalTab: 'Onay akışı',
    distributionTab: 'Dağıtım talebi',
    revisionTab: 'Revize Talebi',
    approvedTab: 'Onaylananlar',
    noPendingTitle: 'Onay bekleyen hedef talebi yok',
    noPendingCopy: 'Seçili dönem ve mağaza için karar bekleyen hedef talebi bulunmuyor.',
    noCoverageTitle: 'Hedef referans kaydı yok',
    noCoverageCopy: 'Seçili dönem için görüntülenecek personel hedef referansı bulunmuyor.',
    noPersonnelTitle: 'Hedef dağıtılacak personel yok',
    noPersonnelCopy: 'Seçili mağazada hedef dağıtımı için aktif personel bulunmuyor.',
    targetLabel: 'Hedef adı',
    targetLabelDefault: 'Aylık personel hedef dağıtımı',
    totalTarget: 'Toplam hedef',
    approvedRequests: 'Onaylananlar',
    approvedRequestsCopy: 'Onay akışı tamamlanan mağaza hedefleri burada izlenir.',
    revisionRequests: 'Revize talebi',
    revisionRequestsCopy:
      'Onaylanmış aylık hedef üzerinden yeni revize talebi oluşturulur.',
    revisionCreate: 'Revize oluştur',
    revisionSubmit: 'Revize talebi gönder',
    revisionNote: 'Revize notu',
    approvedTotal: 'Onaylı toplam',
    revisionTotal: 'Revize toplam',
    difference: 'Fark',
    noApprovedTitle: 'Onaylanan hedef yok',
    noApprovedCopy: 'Seçili mağaza ve dönemde onaylanan hedef talebi bulunmuyor.',
    revisionMismatch: 'Revize toplam onaylı toplamla eşleşmeli.',
    revisionNoChange: 'Gönderim için en az bir hedef tutarı değişmeli.',
    resetApprovalDraft: 'Eski değerlere dön',
    adjustedStatus: 'Düzenlendi',
    revisionLabelSuffix: 'revize',
    requestReason: 'Talep notu',
    approvalNote: 'Karar notu',
    optionalNote: 'Opsiyonel not',
    submitTarget: 'Onaya gönder',
    submitting: 'Gönderiliyor',
    approve: 'Onayla',
    approveAdjusted: 'Düzenleyerek onayla',
    approving: 'Onaylanıyor',
    approvalEditedNoteRequired: 'Düzenleme varsa karar notu zorunlu.',
    approvalPositiveTargets: 'Tüm personel hedefleri sıfırdan büyük olmalı.',
    cannotApprove: 'Bu mağaza için karar aksiyonu yok',
    allocationTotal: 'Dağıtılan toplam',
    remainingTarget: 'Kalan hedef',
    allocationMismatch: 'Dağıtılan hedef toplam hedefle eşleşmeli.',
    targetValue: 'Hedef',
    share: 'Pay',
    status: 'Durum',
    createdAt: 'Gönderim',
    storeName: 'Mağaza',
    personnel: 'Personel',
    approvedTarget: 'Onaylı hedef',
    pendingTarget: 'Bekleyen hedef',
    sellerCode: 'Kod',
    requestOwner: 'Gönderen',
    allocationCount: 'Kişi',
    reason: 'Not',
    loaded: 'Yüklendi',
    emptyValue: 'Yok',
    currentScope: 'Mevcut görünüm',
    storeManagerMode: 'Yazma akışı',
    regionMode: 'Karar akışı',
    viewerMode: 'Okuma akışı',
    success: 'İşlem tamamlandı',
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
      'Active period targets are tracked here. Missing targets are not guessed.',
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
    resetApprovalDraft: 'Restore original values',
    adjustedStatus: 'Edited',
    revisionLabelSuffix: 'revision',
    requestReason: 'Request note',
    approvalNote: 'Decision note',
    optionalNote: 'Optional note',
    submitTarget: 'Submit for approval',
    submitting: 'Submitting',
    approve: 'Approve',
    approveAdjusted: 'Approve with edits',
    approving: 'Approving',
    approvalEditedNoteRequired: 'Decision note is required when amounts are edited.',
    approvalPositiveTargets: 'All personnel targets must be greater than zero.',
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
    stores.set(storeId, normalizeDisplayLabel(null, 'Mağaza adı yok'))
  }

  for (const row of input.coverageRows) {
    stores.set(row.storeId, normalizeDisplayLabel(row.storeName, 'Mağaza adı yok'))
  }

  for (const request of input.targetRequests) {
    stores.set(request.storeId, normalizeDisplayLabel(request.storeName, 'Mağaza adı yok'))
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

export function createStoreTargetReferenceSummary(input: {
  coverageRows: TargetCoverageRow[]
  storeOptions: Array<{ storeId: string; storeName: string }>
}) {
  const stores = new Map<string, { covered: boolean; pending: boolean }>()

  for (const store of input.storeOptions) {
    if (store.storeId) {
      stores.set(store.storeId, { covered: false, pending: false })
    }
  }

  for (const row of input.coverageRows) {
    const current = stores.get(row.storeId) ?? { covered: false, pending: false }
    stores.set(row.storeId, {
      covered: current.covered || row.targetStatus === 'approved',
      pending:
        current.pending ||
        row.targetStatus === 'pending_region_approval' ||
        row.targetStatus === 'pending_change_conflict',
    })
  }

  const storeStates = Array.from(stores.values())
  const totalStores = storeStates.length
  const coveredStores = storeStates.filter((store) => store.covered).length
  const pendingStores = storeStates.filter((store) => !store.covered && store.pending).length
  const missingStores = storeStates.filter((store) => !store.covered && !store.pending).length

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
