import { createIntegrationPeriodDefaults } from '../../pages/business-date-defaults'
import type { TranslateFunction } from '../localization/dictionary'
import type { NeedsActionItem } from './api'
import type {
  IntegrationDashboardAction,
  IntegrationDashboardState,
  IntegrationSortValue,
} from './integration-dashboard-surface-types'

const PAGE_SIZE = 12
const SEARCH_MAX_LENGTH = 128
const SEARCH_DEBOUNCE_MS = 250
const trNumberFormatter = new Intl.NumberFormat('tr-TR')

function createInitialIntegrationDashboardState(
  now: Date = new Date(),
): IntegrationDashboardState {
  const period = createIntegrationPeriodDefaults(now)
  return {
    activeTab: 'uploads',
    search: '',
    sortBy: 'priority',
    offset: 0,
    entityTypeFilter: '',
    statusFilter: '',
    createdBatchId: null,
    uploadedBatchId: null,
    templateSourceSystem: 'power_bi',
    selectedTemplateSourceCode: '',
    powerBiSourceCode: '',
    powerBiPeriodType: 'monthly',
    powerBiPeriodMonth: period.month,
    powerBiPeriodStart: period.start,
    powerBiPeriodEnd: period.end,
    personnelFile: null,
    storeFile: null,
  }
}

function integrationDashboardReducer(
  state: IntegrationDashboardState,
  action: IntegrationDashboardAction,
): IntegrationDashboardState {
  switch (action.type) {
    case 'setActiveTab':
      return { ...state, activeTab: action.value }
    case 'setSearch':
      return { ...state, search: action.value.slice(0, SEARCH_MAX_LENGTH), offset: 0 }
    case 'setSortBy':
      return { ...state, sortBy: action.value }
    case 'setQueueFilter':
      return { ...state, [action.field]: action.value, offset: 0 }
    case 'setOffset':
      return { ...state, offset: action.value }
    case 'clearQueueFilters':
      return { ...state, offset: 0, entityTypeFilter: '', statusFilter: '', search: '' }
    case 'retrySucceeded':
      return { ...state, createdBatchId: null }
    case 'batchCreated':
      return { ...state, createdBatchId: action.batchId }
    case 'uploadSucceeded':
      return { ...state, uploadedBatchId: action.batchId }
    case 'uploadFailed':
      return { ...state, uploadedBatchId: null }
    case 'setTemplateSourceSystem':
      return { ...state, templateSourceSystem: action.value, selectedTemplateSourceCode: '' }
    case 'setSelectedTemplateSourceCode':
      return { ...state, selectedTemplateSourceCode: action.value }
    case 'setPowerBiSourceCode':
      return { ...state, powerBiSourceCode: action.value }
    case 'setPowerBiPeriodType':
      return { ...state, powerBiPeriodType: action.value }
    case 'setPowerBiPeriodMonth':
      return { ...state, powerBiPeriodMonth: action.value }
    case 'setPowerBiPeriodStart':
      return {
        ...state,
        powerBiPeriodStart: action.value,
        powerBiPeriodEnd: action.syncEnd ? action.value : state.powerBiPeriodEnd,
      }
    case 'setPowerBiPeriodEnd':
      return { ...state, powerBiPeriodEnd: action.value }
    case 'setPersonnelFile':
      return { ...state, personnelFile: action.value }
    case 'setStoreFile':
      return { ...state, storeFile: action.value }
    default:
      return state
  }
}

function formatNumber(value: number) {
  return trNumberFormatter.format(value)
}

function formatOptionalBatch(value: string | null, t: TranslateFunction) {
  return value ?? t('adminIntegrations.none')
}

function sortNeedsActionItems(items: NeedsActionItem[], sortBy: IntegrationSortValue) {
  const sorted = [...items]
  if (sortBy === 'errors') {
    return sorted.sort((left, right) => right.errorCount - left.errorCount)
  }
  if (sortBy === 'records') {
    return sorted.sort((left, right) => right.recordCount - left.recordCount)
  }
  if (sortBy === 'entity') {
    return sorted.sort((left, right) => left.entityType.localeCompare(right.entityType))
  }

  const priority = (state: string) => {
    if (state === 'stuck') return 4
    if (state === 'needs_action') return 3
    if (state === 'blocked') return 2
    if (state === 'retry_ready') return 1
    return 0
  }

  return sorted.sort((left, right) => priority(right.healthState) - priority(left.healthState))
}

export {
  PAGE_SIZE,
  SEARCH_DEBOUNCE_MS,
  SEARCH_MAX_LENGTH,
  createInitialIntegrationDashboardState,
  formatNumber,
  formatOptionalBatch,
  integrationDashboardReducer,
  sortNeedsActionItems,
}
