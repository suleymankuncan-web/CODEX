import type {
  MasterDataBootstrapBatchItem,
  MasterDataBootstrapEntity,
  MasterDataBootstrapPromotionReadinessResponse,
  MasterDataBootstrapPromotionResponse,
  MasterDataBootstrapReadiness,
  MasterDataBootstrapRow,
  PersonnelMasterItem,
  StoreMasterItem,
  StoreMasterLookups,
} from '../features/integrations/api'
import type { TranslateFunction } from '../features/localization/dictionary'

export const PAGE_SIZE = 50
const trNumberFormatter = new Intl.NumberFormat('tr-TR')

export type MasterDataTab = 'batches' | 'stores' | 'personnel' | 'history'
export type MasterDataCommandTab = { id: MasterDataTab; label: string; count?: number }
export type MasterDataBootstrapEntityFilter = 'all' | MasterDataBootstrapEntity
export type MasterDataBootstrapReadinessFilter =
  | 'all'
  | 'needs_validation'
  | 'needs_review'
  | 'ready_to_promote'
  | 'closed'
type StoreMasterType = 'company' | 'franchise' | 'operator'
type StoreMasterStatus = 'active' | 'inactive' | 'closed'
export type StoreMasterEnabledFilter = 'all' | 'enabled' | 'disabled'
export type StoreMasterStatusFilter = 'all' | StoreMasterStatus
type PersonnelStatus = 'active' | 'inactive' | 'terminated'
type PersonnelEmploymentType = 'full_time' | 'part_time' | 'temporary'
export type PersonnelStatusFilter = 'all' | PersonnelStatus

export type StoreMasterPatch = {
  storeType?: StoreMasterType
  regionId?: string
  status?: StoreMasterStatus
  kpiImportEnabled?: boolean
}

export type PersonnelMasterPatch = Partial<{
  firstName: string
  lastName: string
  externalEmployeeRef: string
  employmentStatus: PersonnelStatus
  employmentType: PersonnelEmploymentType
  hireDate: string
  storeId: string
  positionId: string
  assignmentStartDate: string
}>

type MasterDataPageState = {
  activeTab: MasterDataTab
  batchSearch: string
  entityFilter: MasterDataBootstrapEntityFilter
  readinessFilter: MasterDataBootstrapReadinessFilter
  feedback: string | null
  promotionResult: MasterDataBootstrapPromotionResponse['data'] | null
  storeSearch: string
  storeEnabledFilter: StoreMasterEnabledFilter
  storeStatusFilter: StoreMasterStatusFilter
  storeOffset: number
  storeFeedback: string | null
  storeDrafts: Record<string, StoreMasterPatch>
  savingStoreIds: ReadonlySet<string>
  personnelSearch: string
  personnelStatusFilter: PersonnelStatusFilter
  personnelStoreFilter: string
  personnelOffset: number
  personnelFeedback: string | null
  personnelDrafts: Record<string, PersonnelMasterPatch>
  savingPersonnelIds: ReadonlySet<string>
}

type MasterDataPageAction =
  | { type: 'selectTab'; tab: MasterDataTab }
  | { type: 'setBatchSearch'; value: string }
  | { type: 'setEntityFilter'; value: MasterDataBootstrapEntityFilter }
  | { type: 'setReadinessFilter'; value: MasterDataBootstrapReadinessFilter }
  | { type: 'setFeedback'; value: string | null }
  | { type: 'setPromotionResult'; value: MasterDataBootstrapPromotionResponse['data'] | null }
  | { type: 'setStoreSearch'; value: string }
  | { type: 'setStoreEnabledFilter'; value: StoreMasterEnabledFilter }
  | { type: 'setStoreStatusFilter'; value: StoreMasterStatusFilter }
  | { type: 'shiftStoreOffset'; delta: number }
  | { type: 'setStoreFeedback'; value: string | null }
  | { type: 'setStoreSaving'; storeId: string; isSaving: boolean }
  | { type: 'updateStoreDraft'; storeId: string; patch: StoreMasterPatch }
  | { type: 'clearStoreDraft'; storeId: string }
  | { type: 'setPersonnelSearch'; value: string }
  | { type: 'setPersonnelStatusFilter'; value: PersonnelStatusFilter }
  | { type: 'setPersonnelStoreFilter'; value: string }
  | { type: 'shiftPersonnelOffset'; delta: number }
  | { type: 'setPersonnelFeedback'; value: string | null }
  | { type: 'setPersonnelSaving'; employeeId: string; isSaving: boolean }
  | { type: 'updatePersonnelDraft'; employeeId: string; patch: PersonnelMasterPatch }
  | { type: 'clearPersonnelDraft'; employeeId: string }

export const initialMasterDataPageState: MasterDataPageState = {
  activeTab: 'batches',
  batchSearch: '',
  entityFilter: 'all',
  readinessFilter: 'all',
  feedback: null,
  promotionResult: null,
  storeSearch: '',
  storeEnabledFilter: 'all',
  storeStatusFilter: 'all',
  storeOffset: 0,
  storeFeedback: null,
  storeDrafts: {},
  savingStoreIds: new Set(),
  personnelSearch: '',
  personnelStatusFilter: 'all',
  personnelStoreFilter: 'all',
  personnelOffset: 0,
  personnelFeedback: null,
  personnelDrafts: {},
  savingPersonnelIds: new Set(),
}

export function masterDataPageReducer(
  state: MasterDataPageState,
  action: MasterDataPageAction,
): MasterDataPageState {
  switch (action.type) {
    case 'selectTab':
      return { ...state, activeTab: action.tab }
    case 'setBatchSearch':
      return { ...state, batchSearch: action.value }
    case 'setEntityFilter':
      return { ...state, entityFilter: action.value }
    case 'setReadinessFilter':
      return { ...state, readinessFilter: action.value }
    case 'setFeedback':
      return { ...state, feedback: action.value }
    case 'setPromotionResult':
      return { ...state, promotionResult: action.value }
    case 'setStoreSearch':
      return { ...state, storeSearch: action.value, storeOffset: 0 }
    case 'setStoreEnabledFilter':
      return { ...state, storeEnabledFilter: action.value, storeOffset: 0 }
    case 'setStoreStatusFilter':
      return { ...state, storeStatusFilter: action.value, storeOffset: 0 }
    case 'shiftStoreOffset':
      return { ...state, storeOffset: Math.max(0, state.storeOffset + action.delta) }
    case 'setStoreFeedback':
      return { ...state, storeFeedback: action.value }
    case 'setStoreSaving': {
      const savingStoreIds = new Set(state.savingStoreIds)
      if (action.isSaving) {
        savingStoreIds.add(action.storeId)
      } else {
        savingStoreIds.delete(action.storeId)
      }
      return { ...state, savingStoreIds }
    }
    case 'updateStoreDraft':
      return {
        ...state,
        storeDrafts: {
          ...state.storeDrafts,
          [action.storeId]: {
            ...(state.storeDrafts[action.storeId] ?? {}),
            ...action.patch,
          },
        },
      }
    case 'clearStoreDraft': {
      const storeDrafts = { ...state.storeDrafts }
      delete storeDrafts[action.storeId]
      return { ...state, storeDrafts }
    }
    case 'setPersonnelSearch':
      return { ...state, personnelSearch: action.value, personnelOffset: 0 }
    case 'setPersonnelStatusFilter':
      return { ...state, personnelStatusFilter: action.value, personnelOffset: 0 }
    case 'setPersonnelStoreFilter':
      return { ...state, personnelStoreFilter: action.value, personnelOffset: 0 }
    case 'shiftPersonnelOffset':
      return { ...state, personnelOffset: Math.max(0, state.personnelOffset + action.delta) }
    case 'setPersonnelFeedback':
      return { ...state, personnelFeedback: action.value }
    case 'setPersonnelSaving': {
      const savingPersonnelIds = new Set(state.savingPersonnelIds)
      if (action.isSaving) {
        savingPersonnelIds.add(action.employeeId)
      } else {
        savingPersonnelIds.delete(action.employeeId)
      }
      return { ...state, savingPersonnelIds }
    }
    case 'updatePersonnelDraft':
      return {
        ...state,
        personnelDrafts: {
          ...state.personnelDrafts,
          [action.employeeId]: {
            ...(state.personnelDrafts[action.employeeId] ?? {}),
            ...action.patch,
          },
        },
      }
    case 'clearPersonnelDraft': {
      const personnelDrafts = { ...state.personnelDrafts }
      delete personnelDrafts[action.employeeId]
      return { ...state, personnelDrafts }
    }
    default:
      return state
  }
}

export function normalizeStoreType(value: string): StoreMasterType {
  if (value === 'franchise' || value === 'operator') {
    return value
  }

  return 'company'
}

export function normalizeStoreStatus(value: string): StoreMasterStatus {
  if (value === 'inactive' || value === 'closed') {
    return value
  }

  return 'active'
}

export function normalizePersonnelStatus(value: string): PersonnelStatus {
  if (value === 'inactive' || value === 'terminated') {
    return value
  }

  return 'active'
}

export function normalizeEmploymentType(value: string): PersonnelEmploymentType {
  if (value === 'part_time' || value === 'temporary') {
    return value
  }

  return 'full_time'
}

export function formatNumber(value: number) {
  return trNumberFormatter.format(value)
}

export function dateInputValue(value: string | null | undefined) {
  return value ? value.slice(0, 10) : ''
}

export type EffectivePersonnelMasterItem = PersonnelMasterItem & {
  externalEmployeeRef: string
  hireDate: string
  storeId: string
  positionId: string
  assignmentStartDate: string
}

function resolveRegionName(
  lookups: StoreMasterLookups | undefined,
  regionId: string | null,
  fallback: string | null,
) {
  if (!regionId) {
    return fallback
  }

  return lookups?.regions.find((region) => region.regionId === regionId)?.regionName ?? fallback
}

export function mergeStoreMasterPatch(
  store: StoreMasterItem,
  patch: StoreMasterPatch,
  lookups: StoreMasterLookups | undefined,
): StoreMasterItem {
  const regionId = patch.regionId ?? store.regionId

  return {
    ...store,
    storeType: patch.storeType ?? normalizeStoreType(store.storeType),
    regionId,
    regionName: patch.regionId === undefined ? store.regionName : resolveRegionName(lookups, regionId, store.regionName),
    status: patch.status ?? normalizeStoreStatus(store.status),
    kpiImportEnabled: patch.kpiImportEnabled ?? store.kpiImportEnabled,
  }
}

export function mergePersonnelPatch(
  personnel: PersonnelMasterItem,
  patch: PersonnelMasterPatch,
): EffectivePersonnelMasterItem {
  return {
    ...personnel,
    firstName: patch.firstName ?? personnel.firstName,
    lastName: patch.lastName ?? personnel.lastName,
    externalEmployeeRef: patch.externalEmployeeRef ?? personnel.externalEmployeeRef ?? '',
    employmentStatus: patch.employmentStatus ?? normalizePersonnelStatus(personnel.employmentStatus),
    employmentType: patch.employmentType ?? normalizeEmploymentType(personnel.employmentType),
    hireDate: patch.hireDate ?? dateInputValue(personnel.hireDate),
    storeId: patch.storeId ?? personnel.storeId ?? '',
    positionId: patch.positionId ?? personnel.positionId ?? '',
    assignmentStartDate: patch.assignmentStartDate ?? dateInputValue(personnel.assignmentStartDate ?? personnel.hireDate),
  }
}

export function getBatchDisplayTimestamp(batch: MasterDataBootstrapBatchItem) {
  return batch.updatedAt ?? batch.promotedAt ?? batch.validatedAt ?? batch.createdAt
}

export function resolveRowName(row: MasterDataBootstrapRow) {
  const firstName = readPayloadString(row.normalizedPayload, 'normalizedFirstName')
  const lastName = readPayloadString(row.normalizedPayload, 'normalizedLastName')
  const storeName = readPayloadString(row.normalizedPayload, 'normalizedStoreName')
  const parts = [firstName, lastName].filter(Boolean)

  return parts.length > 0 ? parts.join(' ') : storeName ?? row.sourceStoreCode ?? row.rowId
}

function readPayloadString(payload: Record<string, unknown>, key: string) {
  const value = payload[key]
  return typeof value === 'string' && value.trim() ? value : null
}

export function resolveDryRunRowLabel(
  row: MasterDataBootstrapPromotionReadinessResponse['rows']['items'][number],
) {
  return row.sourceEmployeeCode ?? row.sourceStoreCode ?? row.rowId
}

export function formatMasterDataEntity(entity: MasterDataBootstrapEntity, t: TranslateFunction) {
  switch (entity) {
    case 'store':
      return t('adminMasterData.entity.store')
    case 'personnel':
      return t('adminMasterData.entity.personnel')
    default:
      return entity
  }
}

export function formatMasterDataState(value: string, t: TranslateFunction) {
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

export function mapPromotionReadinessTone(value: string) {
  if (value === 'ready') {
    return 'accent'
  }
  if (value === 'already_promoted') {
    return 'calm'
  }
  if (value === 'needs_validation' || value === 'needs_review' || value === 'waiting_batch') {
    return 'warning'
  }
  if (value === 'blocked') {
    return 'danger'
  }

  return 'neutral'
}

export function mapReadinessTone(value: MasterDataBootstrapReadiness | string) {
  if (value === 'ready_to_promote' || value === 'promote_ready_rows' || value === 'can promote') {
    return 'accent'
  }
  if (value === 'closed' || value === 'promoted' || value === 'already_closed') {
    return 'calm'
  }
  if (value === 'needs_review' || value === 'review_rows' || value === 'needs_validation') {
    return 'warning'
  }
  if (value === 'blocked') {
    return 'danger'
  }

  return 'neutral'
}

export function mapValidationTone(value: string) {
  if (value === 'promoted' || value === 'valid') {
    return 'calm'
  }
  if (value === 'needs_review' || value === 'pending') {
    return 'warning'
  }
  if (value === 'invalid') {
    return 'danger'
  }

  return 'neutral'
}
