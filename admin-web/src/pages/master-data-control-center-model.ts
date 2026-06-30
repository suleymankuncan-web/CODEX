import type {
  MasterDataBootstrapBatchItem,
  MasterDataBootstrapEntity,
  MasterDataQualityAuditItem,
  MasterDataQualityIssueItem,
  PersonnelMasterItem,
  StoreMasterItem,
} from '../features/integrations/api'
import type { TranslateFunction } from '../features/localization/dictionary'
import type { QueryClient } from '@tanstack/react-query'
import type { MasterDataImpactModule } from './master-data-impact-rules'

const CONTROL_CENTER_PAGE_SIZE = 50

type StoreMasterType = 'company' | 'franchise' | 'operator'
type StoreMasterStatus = 'active' | 'inactive' | 'closed'
type PersonnelStatus = 'active' | 'inactive' | 'terminated'

export type MasterDataWorkbenchTab = 'issues' | 'stores' | 'personnel' | 'imports' | 'history'
export type MasterDataIssueSeverityFilter = 'all' | 'critical' | 'warning' | 'info'
export type MasterDataIssueEntityFilter = 'all' | 'store' | 'personnel' | 'assignment' | 'import'
export type MasterDataAuditEntityFilter = 'all' | 'store' | 'personnel' | 'import'
export type { MasterDataImpactModule }

export type MasterDataIssueRow = {
  id: string
  issueCode: string
  severity: 'critical' | 'warning' | 'info'
  entityType: 'store' | 'personnel' | 'assignment' | 'import'
  entityId: string
  title: string
  subtitle: string
  problem: string
  action: string
  affectedModules: string[]
  sourceLabel: string
  lastSeenAt: string
}

export type MasterDataAuditRow = {
  id: string
  eventType: string
  entityType: 'store' | 'personnel' | 'import'
  entityId: string | null
  title: string
  actor: string
  occurredAt: string
  summary: string
  metadata: Record<string, unknown>
}

export type MasterDataStoreWorkbenchRow = {
  id: string
  title: string
  subtitle: string
  region: string
  typeLabel: string
  statusLabel: string
  kpiLabel: string
  updatedAt: string | null
  record: StoreMasterItem
}

export type MasterDataPersonnelWorkbenchRow = {
  id: string
  title: string
  subtitle: string
  store: string
  position: string
  statusLabel: string
  sellerCodeLabel: string
  updatedAt: string | null
  record: PersonnelMasterItem
}

export type MasterDataImportWorkbenchRow = {
  id: string
  title: string
  subtitle: string
  entityLabel: string
  statusLabel: string
  readinessLabel: string
  updatedAt: string
  record: MasterDataBootstrapBatchItem
}

export type MasterDataConflictState = {
  isConflict: boolean
  message: string
}

export const masterDataQueryKeys = {
  issues(input: {
    activeTab: MasterDataWorkbenchTab
    search?: string
    entityType?: MasterDataIssueEntityFilter
    severity?: MasterDataIssueSeverityFilter
    selectedEntityId?: string | null
    limit?: number
    offset?: number
  }) {
    return [
      'master-data-quality-issues',
      input.activeTab,
      input.search ?? '',
      input.entityType ?? 'all',
      input.severity ?? 'all',
      input.selectedEntityId ?? '',
      input.limit ?? CONTROL_CENTER_PAGE_SIZE,
      input.offset ?? 0,
    ] as const
  },
  audit(input: {
    activeTab: MasterDataWorkbenchTab
    entityType?: MasterDataAuditEntityFilter
    selectedEntityId?: string | null
    limit?: number
    offset?: number
  }) {
    return [
      'master-data-quality-audit',
      input.activeTab,
      input.entityType ?? 'all',
      input.selectedEntityId ?? '',
      input.limit ?? 30,
      input.offset ?? 0,
    ] as const
  },
  imports(input: {
    activeTab: MasterDataWorkbenchTab
    search?: string
    entityFilter?: 'all' | MasterDataBootstrapEntity
    readinessFilter?: string
    selectedEntityId?: string | null
    limit?: number
    offset?: number
  }) {
    return [
      'master-data-bootstrap-batches',
      input.activeTab,
      input.search ?? '',
      input.entityFilter ?? 'all',
      input.readinessFilter ?? 'all',
      input.selectedEntityId ?? '',
      input.limit ?? CONTROL_CENTER_PAGE_SIZE,
      input.offset ?? 0,
    ] as const
  },
  storeList(input: {
    activeTab: MasterDataWorkbenchTab
    search?: string
    enabledFilter?: string
    statusFilter?: string
    selectedEntityId?: string | null
    limit?: number
    offset?: number
  }) {
    return [
      'master-data-store-master',
      input.activeTab,
      input.search ?? '',
      input.enabledFilter ?? 'all',
      input.statusFilter ?? 'all',
      input.selectedEntityId ?? '',
      input.limit ?? CONTROL_CENTER_PAGE_SIZE,
      input.offset ?? 0,
    ] as const
  },
  personnelList(input: {
    activeTab: MasterDataWorkbenchTab
    search?: string
    statusFilter?: string
    storeFilter?: string
    selectedEntityId?: string | null
    limit?: number
    offset?: number
  }) {
    return [
      'master-data-personnel-master',
      input.activeTab,
      input.search ?? '',
      input.statusFilter ?? 'all',
      input.storeFilter ?? 'all',
      input.selectedEntityId ?? '',
      input.limit ?? CONTROL_CENTER_PAGE_SIZE,
      input.offset ?? 0,
    ] as const
  },
  importDetail(batchId: string | null) {
    return ['master-data-bootstrap-detail', batchId ?? ''] as const
  },
  importReadiness(batchId: string | null) {
    return ['master-data-bootstrap-readiness', batchId ?? ''] as const
  },
}

export function invalidateMasterDataQualityFamily(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['master-data-quality-issues'] }),
    queryClient.invalidateQueries({ queryKey: ['master-data-quality-audit'] }),
  ])
}

export function invalidateMasterDataImportFamily(queryClient: QueryClient, batchId: string | null) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['master-data-bootstrap-batches'] }),
    batchId
      ? queryClient.invalidateQueries({ queryKey: masterDataQueryKeys.importDetail(batchId) })
      : Promise.resolve(),
    batchId
      ? queryClient.invalidateQueries({ queryKey: masterDataQueryKeys.importReadiness(batchId) })
      : Promise.resolve(),
    invalidateMasterDataQualityFamily(queryClient),
  ])
}

export function invalidateStoreMasterDataFamily(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['master-data-store-master'] }),
    invalidateMasterDataQualityFamily(queryClient),
  ])
}

export function invalidatePersonnelMasterDataFamily(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['master-data-personnel-master'] }),
    invalidateMasterDataQualityFamily(queryClient),
  ])
}

export function mapMasterDataIssueToRow(issue: MasterDataQualityIssueItem): MasterDataIssueRow {
  return {
    id: issue.id,
    issueCode: issue.issueCode,
    severity: issue.severity,
    entityType: issue.entityType,
    entityId: issue.entityId,
    title: issue.entityLabel || 'İsim bulunamadı',
    subtitle: issue.secondaryLabel ?? formatIssueEntityType(issue.entityType),
    problem: issue.problemLabel,
    action: issue.recommendedAction,
    affectedModules: issue.affectedModules,
    sourceLabel: formatIssueSource(issue.source, issue.entityType),
    lastSeenAt: issue.lastSeenAt,
  }
}

export function mapMasterDataAuditToRow(event: MasterDataQualityAuditItem): MasterDataAuditRow {
  return {
    id: event.eventId,
    eventType: event.eventType,
    entityType: event.entityType,
    entityId: event.entityId,
    title: event.entityLabel || 'Kayıt',
    actor: event.actorLabel || 'Sistem',
    occurredAt: event.occurredAt,
    summary: event.summary,
    metadata: event.metadata,
  }
}

export function mapStoreMasterToWorkbenchRow(store: StoreMasterItem): MasterDataStoreWorkbenchRow {
  return {
    id: store.storeId,
    title: store.storeName || 'İsim bulunamadı',
    subtitle: store.storeCode || 'Mağaza kaydı',
    region: store.regionName ?? 'Bölge seçilmedi',
    typeLabel: formatStoreTypeLabel(normalizeStoreType(store.storeType)),
    statusLabel: formatStoreStatusLabel(normalizeStoreStatus(store.status)),
    kpiLabel: store.kpiImportEnabled ? 'KPI aktarımı açık' : 'KPI aktarımı kapalı',
    updatedAt: store.updatedAt,
    record: store,
  }
}

export function mapPersonnelMasterToWorkbenchRow(
  personnel: PersonnelMasterItem,
): MasterDataPersonnelWorkbenchRow {
  const fullName = [personnel.firstName, personnel.lastName].filter(Boolean).join(' ')

  return {
    id: personnel.employeeId,
    title: fullName || 'İsim bulunamadı',
    subtitle: personnel.externalEmployeeRef ?? 'Satıcı kodu yok',
    store: personnel.storeName ?? 'Mağaza seçilmedi',
    position: personnel.positionName ?? 'Pozisyon seçilmedi',
    statusLabel: formatPersonnelStatusLabel(normalizePersonnelStatus(personnel.employmentStatus)),
    sellerCodeLabel: personnel.externalEmployeeRef ?? 'Satıcı kodu yok',
    updatedAt: personnel.updatedAt,
    record: personnel,
  }
}

export function mapMasterDataBootstrapBatchToImportRow(
  batch: MasterDataBootstrapBatchItem,
  t: TranslateFunction,
): MasterDataImportWorkbenchRow {
  return {
    id: batch.batchId,
    title: batch.sourceLabel,
    subtitle: batch.fileReference ?? 'İçe aktarım',
    entityLabel: formatMasterDataEntity(batch.bootstrapEntity, t),
    statusLabel: formatMasterDataState(batch.readiness, t),
    readinessLabel: formatMasterDataState(batch.readiness, t),
    updatedAt: batch.updatedAt ?? batch.promotedAt ?? batch.validatedAt ?? batch.createdAt,
    record: batch,
  }
}

export function mapMasterDataConflict(error: unknown): MasterDataConflictState {
  const status =
    typeof error === 'object' && error !== null && 'status' in error
      ? Number((error as { status?: unknown }).status)
      : null
  const rawMessage = error instanceof Error ? error.message : ''

  if (status === 409) {
    return {
      isConflict: true,
      message: 'Kayıt güncellendi, tekrar kontrol edin.',
    }
  }

  return {
    isConflict: false,
    message: rawMessage || 'Değişiklik kaydedilemedi.',
  }
}

export function findMasterDataConflict(results: PromiseSettledResult<unknown>[]) {
  return results
    .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    .map((result) => mapMasterDataConflict(result.reason))
    .find((result) => result.isConflict)
}

function normalizeStoreType(value: string): StoreMasterType {
  if (value === 'franchise' || value === 'operator') {
    return value
  }

  return 'company'
}

function normalizeStoreStatus(value: string): StoreMasterStatus {
  if (value === 'inactive' || value === 'closed') {
    return value
  }

  return 'active'
}

function normalizePersonnelStatus(value: string): PersonnelStatus {
  if (value === 'inactive' || value === 'terminated') {
    return value
  }

  return 'active'
}

function formatIssueEntityType(entityType: MasterDataIssueRow['entityType']) {
  switch (entityType) {
    case 'store':
      return 'Mağaza kaydı'
    case 'personnel':
      return 'Personel kaydı'
    case 'assignment':
      return 'Atama kaydı'
    case 'import':
      return 'İçe aktarım'
    default:
      return 'Kayıt'
  }
}

function formatIssueSource(source: string, entityType: MasterDataIssueRow['entityType']) {
  const normalized = source.toLowerCase()
  if (normalized.includes('store')) {
    return 'Mağaza kaydı'
  }
  if (normalized.includes('personnel') || normalized.includes('employee')) {
    return 'Personel kaydı'
  }
  if (normalized.includes('import') || normalized.includes('batch')) {
    return 'İçe aktarım'
  }

  return formatIssueEntityType(entityType)
}

function formatStoreTypeLabel(value: StoreMasterType) {
  switch (value) {
    case 'franchise':
      return 'Bayi'
    case 'operator':
      return 'İşletme'
    case 'company':
    default:
      return 'Şirket mağazası'
  }
}

function formatStoreStatusLabel(value: StoreMasterStatus) {
  switch (value) {
    case 'inactive':
      return 'Pasif'
    case 'closed':
      return 'Kapalı'
    case 'active':
    default:
      return 'Aktif'
  }
}

function formatPersonnelStatusLabel(value: PersonnelStatus) {
  switch (value) {
    case 'inactive':
      return 'Pasif'
    case 'terminated':
      return 'Ayrıldı'
    case 'active':
    default:
      return 'Aktif'
  }
}

function formatMasterDataEntity(entity: MasterDataBootstrapEntity, t: TranslateFunction) {
  switch (entity) {
    case 'store':
      return t('adminMasterData.entity.store')
    case 'personnel':
      return t('adminMasterData.entity.personnel')
    default:
      return entity
  }
}

function formatMasterDataState(value: string, t: TranslateFunction) {
  switch (value) {
    case 'ready_to_promote':
      return t('adminMasterData.status.ready_to_promote')
    case 'promote_ready_rows':
      return t('adminMasterData.status.promote_ready_rows')
    case 'closed':
      return t('adminMasterData.status.closed')
    case 'promoted':
      return t('adminMasterData.status.promoted')
    case 'already_closed':
      return t('adminMasterData.status.already_closed')
    case 'needs_review':
      return t('adminMasterData.status.needs_review')
    case 'review_rows':
      return t('adminMasterData.status.review_rows')
    case 'needs_validation':
      return t('adminMasterData.status.needs_validation')
    case 'blocked':
      return t('adminMasterData.status.blocked')
    case 'ready':
      return t('adminMasterData.status.ready')
    case 'already_promoted':
      return t('adminMasterData.status.already_promoted')
    case 'waiting_batch':
      return t('adminMasterData.status.waiting_batch')
    case 'valid':
      return t('adminMasterData.status.valid')
    case 'pending':
      return t('adminMasterData.status.pending')
    case 'invalid':
      return t('adminMasterData.status.invalid')
    default:
      return value
  }
}
