import type { Dispatch } from 'react'
import type {
  ImportPayloadTemplate,
  IntegrationLookups,
  ListResponse,
  NeedsActionItem,
  PowerBiExportUploadResponse,
  uploadPowerBiExport,
} from './api'

type IntegrationTab = 'uploads' | 'evidence' | 'errors'
type PowerBiPeriodType = 'daily' | 'monthly' | 'custom'
type IntegrationSortValue = 'priority' | 'errors' | 'records' | 'entity'
type IntegrationTemplateSourceSystem = 'nebim_v3' | 'power_bi'
type IntegrationQueueFilter = 'entityTypeFilter' | 'statusFilter'
type IntegrationSource = IntegrationLookups['activeSources'][number]
type IntegrationTabOption = { id: IntegrationTab; label: string; count?: number }
type IntegrationDispatch = Dispatch<IntegrationDashboardAction>
type IntegrationListMeta = ListResponse<NeedsActionItem>['meta']

type IntegrationDashboardState = {
  activeTab: IntegrationTab
  search: string
  sortBy: IntegrationSortValue
  offset: number
  entityTypeFilter: string
  statusFilter: string
  createdBatchId: string | null
  uploadedBatchId: string | null
  templateSourceSystem: IntegrationTemplateSourceSystem
  selectedTemplateSourceCode: string
  powerBiSourceCode: string
  powerBiPeriodType: PowerBiPeriodType
  powerBiPeriodMonth: string
  powerBiPeriodStart: string
  powerBiPeriodEnd: string
  personnelFile: File | null
  storeFile: File | null
}

type IntegrationDashboardAction =
  | { type: 'setActiveTab'; value: IntegrationTab }
  | { type: 'setSearch'; value: string }
  | { type: 'setSortBy'; value: IntegrationSortValue }
  | { type: 'setQueueFilter'; field: IntegrationQueueFilter; value: string }
  | { type: 'setOffset'; value: number }
  | { type: 'clearQueueFilters' }
  | { type: 'retrySucceeded' }
  | { type: 'batchCreated'; batchId: string }
  | { type: 'uploadSucceeded'; batchId: string }
  | { type: 'uploadFailed' }
  | { type: 'setTemplateSourceSystem'; value: IntegrationTemplateSourceSystem }
  | { type: 'setSelectedTemplateSourceCode'; value: string }
  | { type: 'setPowerBiSourceCode'; value: string }
  | { type: 'setPowerBiPeriodType'; value: PowerBiPeriodType }
  | { type: 'setPowerBiPeriodMonth'; value: string }
  | { type: 'setPowerBiPeriodStart'; value: string; syncEnd: boolean }
  | { type: 'setPowerBiPeriodEnd'; value: string }
  | { type: 'setPersonnelFile'; value: File | null }
  | { type: 'setStoreFile'; value: File | null }

type PowerBiUploadMutationState = {
  data: PowerBiExportUploadResponse | undefined
  isPending: boolean
  mutate: (input: Parameters<typeof uploadPowerBiExport>[0]) => void
}

type ImportTemplateQueryState = {
  data: ImportPayloadTemplate | undefined
  error: unknown
  isError: boolean
  isLoading: boolean
}

type CreateBatchMutationState = {
  isPending: boolean
}

type RetryMutationState = {
  isPending: boolean
  mutate: (batchId: string) => void
}

export type {
  CreateBatchMutationState,
  ImportTemplateQueryState,
  IntegrationDashboardAction,
  IntegrationDashboardState,
  IntegrationDispatch,
  IntegrationListMeta,
  IntegrationSortValue,
  IntegrationSource,
  IntegrationTab,
  IntegrationTabOption,
  IntegrationTemplateSourceSystem,
  PowerBiPeriodType,
  PowerBiUploadMutationState,
  RetryMutationState,
}
