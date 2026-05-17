import { useDeferredValue, useMemo, useReducer, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  DatabaseZap,
  History,
  ListChecks,
  Save,
  Search,
  ShieldCheck,
  UserRound,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { EmptyState, ScreenState } from '../components/dashboard-primitives'
import {
  getMasterDataBootstrapBatches,
  getMasterDataBootstrapBatchDetail,
  getMasterDataBootstrapPromotionReadiness,
  getPersonnelMasterData,
  getPersonnelMasterLookups,
  getStoreMasterData,
  getStoreMasterLookups,
  promoteMasterDataBootstrapPersonnel,
  promoteMasterDataBootstrapStores,
  updatePersonnelMasterData,
  updateStoreMasterData,
  validateMasterDataBootstrapBatch,
} from '../features/integrations/api'
import type {
  ListResponse,
  MasterDataBootstrapBatchDetail,
  MasterDataBootstrapBatchItem,
  MasterDataBootstrapEntity,
  MasterDataBootstrapPromotionReadinessResponse,
  MasterDataBootstrapPromotionResponse,
  MasterDataBootstrapReadiness,
  MasterDataBootstrapRow,
  PersonnelMasterLookups,
  PersonnelMasterItem,
  StoreMasterLookups,
  StoreMasterItem,
} from '../features/integrations/api'
import type { TranslateFunction } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import { formatDateTime, getErrorMessage } from '../lib/format'

const PAGE_SIZE = 50
const trNumberFormatter = new Intl.NumberFormat('tr-TR')

type MasterDataTab = 'batches' | 'stores' | 'personnel' | 'history'
type MasterDataCommandTab = { id: MasterDataTab; label: string; count?: number }
type MasterDataBootstrapEntityFilter = 'all' | MasterDataBootstrapEntity
type MasterDataBootstrapReadinessFilter =
  | 'all'
  | 'needs_validation'
  | 'needs_review'
  | 'ready_to_promote'
  | 'closed'
type StoreMasterType = 'company' | 'franchise' | 'operator'
type StoreMasterStatus = 'active' | 'inactive' | 'closed'
type StoreMasterEnabledFilter = 'all' | 'enabled' | 'disabled'
type StoreMasterStatusFilter = 'all' | StoreMasterStatus
type PersonnelStatus = 'active' | 'inactive' | 'terminated'
type PersonnelEmploymentType = 'full_time' | 'part_time' | 'temporary'
type PersonnelStatusFilter = 'all' | PersonnelStatus

type StoreMasterPatch = {
  storeType?: StoreMasterType
  regionId?: string
  status?: StoreMasterStatus
  kpiImportEnabled?: boolean
}

type PersonnelMasterPatch = Partial<{
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

const initialMasterDataPageState: MasterDataPageState = {
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

function masterDataPageReducer(
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

function normalizeEmploymentType(value: string): PersonnelEmploymentType {
  if (value === 'part_time' || value === 'temporary') {
    return value
  }

  return 'full_time'
}

function formatNumber(value: number) {
  return trNumberFormatter.format(value)
}

function dateInputValue(value: string | null | undefined) {
  return value ? value.slice(0, 10) : ''
}

function useMasterDataBootstrapQueries(input: {
  activeTab: MasterDataTab
  batchId: string | null
  batchSearch: string
  entityFilter: MasterDataBootstrapEntityFilter
  personnelOffset: number
  personnelSearch: string
  personnelStatusFilter: PersonnelStatusFilter
  personnelStoreFilter: string
  readinessFilter: MasterDataBootstrapReadinessFilter
  storeEnabledFilter: StoreMasterEnabledFilter
  storeOffset: number
  storeSearch: string
  storeStatusFilter: StoreMasterStatusFilter
}) {
  const deferredBatchSearch = useDeferredValue(input.batchSearch)
  const deferredStoreSearch = useDeferredValue(input.storeSearch)
  const deferredPersonnelSearch = useDeferredValue(input.personnelSearch)

  const batchesQuery = useQuery({
    queryKey: ['master-data-bootstrap-batches', input.entityFilter, input.readinessFilter, deferredBatchSearch],
    queryFn: () =>
      getMasterDataBootstrapBatches({
        bootstrapEntity: input.entityFilter === 'all' ? undefined : input.entityFilter,
        readiness: input.readinessFilter === 'all' ? undefined : input.readinessFilter,
        q: deferredBatchSearch || undefined,
        limit: PAGE_SIZE,
        offset: 0,
      }),
    staleTime: 30_000,
  })
  const detailQuery = useQuery({
    queryKey: ['master-data-bootstrap-detail', input.batchId],
    queryFn: () => getMasterDataBootstrapBatchDetail(input.batchId ?? ''),
    enabled: Boolean(input.batchId),
  })
  const readinessQuery = useQuery({
    queryKey: ['master-data-bootstrap-readiness', input.batchId],
    queryFn: () => getMasterDataBootstrapPromotionReadiness(input.batchId ?? ''),
    enabled: Boolean(input.batchId),
  })
  const storeMasterQuery = useQuery({
    queryKey: [
      'master-data-store-master',
      deferredStoreSearch,
      input.storeEnabledFilter,
      input.storeStatusFilter,
      input.storeOffset,
    ],
    queryFn: () =>
      getStoreMasterData({
        q: deferredStoreSearch || undefined,
        enabled: input.storeEnabledFilter === 'all' ? undefined : input.storeEnabledFilter === 'enabled',
        status: input.storeStatusFilter === 'all' ? undefined : input.storeStatusFilter,
        limit: PAGE_SIZE,
        offset: input.storeOffset,
      }),
    enabled: input.activeTab === 'stores',
  })
  const storeMasterLookupsQuery = useQuery({
    queryKey: ['master-data-store-master-lookups'],
    queryFn: getStoreMasterLookups,
    enabled: input.activeTab === 'stores',
  })
  const personnelMasterQuery = useQuery({
    queryKey: [
      'master-data-personnel-master',
      deferredPersonnelSearch,
      input.personnelStatusFilter,
      input.personnelStoreFilter,
      input.personnelOffset,
    ],
    queryFn: () =>
      getPersonnelMasterData({
        q: deferredPersonnelSearch || undefined,
        status: input.personnelStatusFilter === 'all' ? undefined : input.personnelStatusFilter,
        storeId: input.personnelStoreFilter === 'all' ? undefined : input.personnelStoreFilter,
        limit: PAGE_SIZE,
        offset: input.personnelOffset,
      }),
    enabled: input.activeTab === 'personnel',
  })
  const personnelMasterLookupsQuery = useQuery({
    queryKey: ['master-data-personnel-master-lookups'],
    queryFn: getPersonnelMasterLookups,
    enabled: input.activeTab === 'personnel',
  })

  return {
    batchesQuery,
    detailQuery,
    personnelMasterLookupsQuery,
    personnelMasterQuery,
    readinessQuery,
    storeMasterLookupsQuery,
    storeMasterQuery,
  }
}

function useMasterDataBootstrapMutations(input: {
  batchId: string | null
  queryClient: ReturnType<typeof useQueryClient>
  setFeedback: (value: string | null) => void
  setPromotionResult: (value: MasterDataBootstrapPromotionResponse['data'] | null) => void
}) {
  const validateMutation = useMutation({
    mutationFn: validateMasterDataBootstrapBatch,
    onSuccess: async (response) => {
      input.setFeedback(response.command.message)
      input.setPromotionResult(null)
      await Promise.all([
        input.queryClient.invalidateQueries({ queryKey: ['master-data-bootstrap-batches'] }),
        input.batchId
          ? input.queryClient.invalidateQueries({ queryKey: ['master-data-bootstrap-detail', input.batchId] })
          : Promise.resolve(),
        input.batchId
          ? input.queryClient.invalidateQueries({ queryKey: ['master-data-bootstrap-readiness', input.batchId] })
          : Promise.resolve(),
      ])
    },
    onError: (error) => {
      input.setFeedback(getErrorMessage(error))
      input.setPromotionResult(null)
    },
  })
  const promoteMutation = useMutation({
    mutationFn: (mutationInput: { batchId: string; entity: MasterDataBootstrapEntity }) =>
      mutationInput.entity === 'store'
        ? promoteMasterDataBootstrapStores(mutationInput.batchId)
        : promoteMasterDataBootstrapPersonnel(mutationInput.batchId),
    onSuccess: async (response) => {
      const resultRows = response.data.promotedRows.length
        ? response.data.promotedRows
        : response.data.batch.promotedRows ?? []
      const promotedTrail = resultRows
        .map((row) => [row.rowId, row.promotedEntityId, row.assignmentId].filter(Boolean).join(' / '))
        .join(' · ')
      input.setFeedback([response.command.message, promotedTrail].filter(Boolean).join(' — '))
      input.setPromotionResult(response.data)
      await Promise.all([
        input.queryClient.invalidateQueries({ queryKey: ['master-data-bootstrap-batches'] }),
        input.batchId
          ? input.queryClient.invalidateQueries({ queryKey: ['master-data-bootstrap-detail', input.batchId] })
          : Promise.resolve(),
        input.batchId
          ? input.queryClient.invalidateQueries({ queryKey: ['master-data-bootstrap-readiness', input.batchId] })
          : Promise.resolve(),
      ])
    },
    onError: (error) => {
      input.setFeedback(getErrorMessage(error))
      input.setPromotionResult(null)
    },
  })

  return { promoteMutation, validateMutation }
}

export function MasterDataBootstrapPage() {
  const { locale, t } = useLocalization()
  const params = useParams()
  const batchId = params.batchId ?? null
  const queryClient = useQueryClient()

  const [state, dispatch] = useReducer(masterDataPageReducer, initialMasterDataPageState)
  const {
    activeTab,
    batchSearch,
    entityFilter,
    readinessFilter,
    feedback,
    promotionResult,
    storeSearch,
    storeEnabledFilter,
    storeStatusFilter,
    storeOffset,
    storeFeedback,
    storeDrafts,
    savingStoreIds,
    personnelSearch,
    personnelStatusFilter,
    personnelStoreFilter,
    personnelOffset,
    personnelFeedback,
    personnelDrafts,
    savingPersonnelIds,
  } = state

  const {
    batchesQuery,
    detailQuery,
    personnelMasterLookupsQuery,
    personnelMasterQuery,
    readinessQuery,
    storeMasterLookupsQuery,
    storeMasterQuery,
  } = useMasterDataBootstrapQueries({
    activeTab,
    batchId,
    batchSearch,
    entityFilter,
    personnelOffset,
    personnelSearch,
    personnelStatusFilter,
    personnelStoreFilter,
    readinessFilter,
    storeEnabledFilter,
    storeOffset,
    storeSearch,
    storeStatusFilter,
  })

  const { promoteMutation, validateMutation } = useMasterDataBootstrapMutations({
    batchId,
    queryClient,
    setFeedback: (value) => dispatch({ type: 'setFeedback', value }),
    setPromotionResult: (value) => dispatch({ type: 'setPromotionResult', value }),
  })
  const batches = useMemo(() => batchesQuery.data?.items ?? [], [batchesQuery.data?.items])
  const summary = detailQuery.data?.summary ?? null
  const readiness = readinessQuery.data?.summary ?? null
  const readinessRows = readinessQuery.data?.rows.items ?? []
  const rows = detailQuery.data?.rows.items ?? []
  const storeMasterItems = storeMasterQuery.data?.items ?? []
  const personnelMasterItems = personnelMasterQuery.data?.items ?? []
  const pendingStoreCount = storeMasterItems.filter((store) => Boolean(storeDrafts[store.storeId])).length
  const pendingPersonnelCount = personnelMasterItems.filter((personnel) =>
    Boolean(personnelDrafts[personnel.employeeId]),
  ).length
  const isSavingStores = savingStoreIds.size > 0
  const isSavingPersonnel = savingPersonnelIds.size > 0

  function getEffectiveStoreMaster(store: StoreMasterItem) {
    return mergeStoreMasterPatch(store, storeDrafts[store.storeId] ?? {}, storeMasterLookupsQuery.data)
  }

  function setStoreSaving(storeId: string, isSaving: boolean) {
    dispatch({ type: 'setStoreSaving', storeId, isSaving })
  }

  function clearStoreDraft(storeId: string) {
    dispatch({ type: 'clearStoreDraft', storeId })
  }

  function updateStoreDraft(storeId: string, patch: StoreMasterPatch) {
    dispatch({ type: 'updateStoreDraft', storeId, patch })
  }

  async function submitStoreDrafts() {
    await submitStoreMasterDrafts({
      drafts: storeDrafts,
      getEffectiveStore: getEffectiveStoreMaster,
      isSaving: isSavingStores,
      items: storeMasterItems,
      t,
      clearDraft: clearStoreDraft,
      invalidateMasterData: () => queryClient.invalidateQueries({ queryKey: ['master-data-store-master'] }),
      setFeedback: (value) => dispatch({ type: 'setStoreFeedback', value }),
      setSaving: setStoreSaving,
      updateCache: (store) => setStoreMasterQueryCache(queryClient, store),
    })
  }

  function getEffectivePersonnel(personnel: PersonnelMasterItem) {
    return mergePersonnelPatch(personnel, personnelDrafts[personnel.employeeId] ?? {})
  }

  function setPersonnelSaving(employeeId: string, isSaving: boolean) {
    dispatch({ type: 'setPersonnelSaving', employeeId, isSaving })
  }

  function clearPersonnelDraft(employeeId: string) {
    dispatch({ type: 'clearPersonnelDraft', employeeId })
  }

  function updatePersonnelDraft(employeeId: string, patch: PersonnelMasterPatch) {
    dispatch({ type: 'updatePersonnelDraft', employeeId, patch })
  }

  async function submitPersonnelDrafts() {
    await submitPersonnelMasterDrafts({
      drafts: personnelDrafts,
      getEffectivePersonnel,
      isSaving: isSavingPersonnel,
      items: personnelMasterItems,
      t,
      clearDraft: clearPersonnelDraft,
      invalidateMasterData: () => queryClient.invalidateQueries({ queryKey: ['master-data-personnel-master'] }),
      setFeedback: (value) => dispatch({ type: 'setPersonnelFeedback', value }),
      setSaving: setPersonnelSaving,
      updateCache: (personnel) => setPersonnelMasterQueryCache(queryClient, personnel),
    })
  }

  if (batchesQuery.isLoading) {
    return <ScreenState title={t('adminMasterData.loadingTitle')} copy={t('adminMasterData.loadingCopy')} />
  }

  if (batchesQuery.isError) {
    return (
      <ScreenState
        title={t('adminMasterData.errorTitle')}
        copy={getErrorMessage(batchesQuery.error)}
        tone="error"
      />
    )
  }

  const tabs: MasterDataCommandTab[] = [
    { id: 'batches', label: t('adminMasterData.tabBatches'), count: batchesQuery.data?.meta.total },
    { id: 'stores', label: t('adminMasterData.tabStores'), count: storeMasterQuery.data?.meta.total },
    { id: 'personnel', label: t('adminMasterData.tabPersonnel'), count: personnelMasterQuery.data?.meta.total },
    { id: 'history', label: t('adminMasterData.tabHistory') },
  ]
  const promotedRows =
    promotionResult?.promotedRows.length
      ? promotionResult.promotedRows
      : promotionResult?.batch.promotedRows ?? []

  return (
    <section className="master-data-command-page">
      <MasterDataCommandHero t={t} />

      <MasterDataCommandMetrics
        batchTotal={batchesQuery.data?.meta.total ?? 0}
        personnelTotal={personnelMasterQuery.data?.meta.total}
        storeTotal={storeMasterQuery.data?.meta.total}
        t={t}
      />

      <MasterDataPromotionFeedback feedback={feedback} promotedRows={promotedRows} t={t} />

      <MasterDataCommandTabs
        activeTab={activeTab}
        tabs={tabs}
        t={t}
        onSelectTab={(tab) => dispatch({ type: 'selectTab', tab })}
      />

      {activeTab === 'batches' ? (
        <MasterDataBootstrapBatchesPanel
          batchId={batchId}
          batches={batches}
          detailError={detailQuery.error}
          detailIsError={detailQuery.isError}
          detailLoading={detailQuery.isLoading}
          entityFilter={entityFilter}
          locale={locale}
          readiness={readiness}
          readinessError={readinessQuery.error}
          readinessFilter={readinessFilter}
          readinessIsError={readinessQuery.isError}
          readinessLoading={readinessQuery.isLoading}
          readinessRows={readinessRows}
          rows={rows}
          search={batchSearch}
          summary={summary}
          t={t}
          promoting={promoteMutation.isPending}
          validating={validateMutation.isPending}
          onEntityFilterChange={(value) => dispatch({ type: 'setEntityFilter', value })}
          onPromote={() => {
            if (!batchId || !summary) {
              return
            }
            promoteMutation.mutate({
              batchId,
              entity: summary.bootstrapEntity,
            })
          }}
          onReadinessFilterChange={(value) => dispatch({ type: 'setReadinessFilter', value })}
          onSearchChange={(value) => dispatch({ type: 'setBatchSearch', value })}
          onValidate={() => {
            if (batchId) {
              validateMutation.mutate(batchId)
            }
          }}
        />
      ) : null}

      {activeTab === 'stores' ? (
        <StoreMasterPanel
          error={storeMasterQuery.error}
          feedback={storeFeedback}
          isError={storeMasterQuery.isError}
          isLoading={storeMasterQuery.isLoading || storeMasterLookupsQuery.isLoading}
          isSaving={isSavingStores}
          items={storeMasterItems}
          lookups={storeMasterLookupsQuery.data}
          pendingCount={pendingStoreCount}
          savingStoreIds={savingStoreIds}
          search={storeSearch}
          enabledFilter={storeEnabledFilter}
          statusFilter={storeStatusFilter}
          total={storeMasterQuery.data?.meta.total ?? 0}
          offset={storeOffset}
          t={t}
          getEffectiveStore={getEffectiveStoreMaster}
          onEnabledFilterChange={(value) => dispatch({ type: 'setStoreEnabledFilter', value })}
          onNextPage={() => dispatch({ type: 'shiftStoreOffset', delta: PAGE_SIZE })}
          onPreviousPage={() => dispatch({ type: 'shiftStoreOffset', delta: -PAGE_SIZE })}
          onSave={() => void submitStoreDrafts()}
          onSearchChange={(value) => dispatch({ type: 'setStoreSearch', value })}
          onStatusFilterChange={(value) => dispatch({ type: 'setStoreStatusFilter', value })}
          onUpdateDraft={updateStoreDraft}
        />
      ) : null}

      {activeTab === 'personnel' ? (
        <PersonnelMasterPanel
          error={personnelMasterQuery.error}
          feedback={personnelFeedback}
          isError={personnelMasterQuery.isError}
          isLoading={personnelMasterQuery.isLoading || personnelMasterLookupsQuery.isLoading}
          isSaving={isSavingPersonnel}
          items={personnelMasterItems}
          lookups={personnelMasterLookupsQuery.data}
          pendingCount={pendingPersonnelCount}
          savingPersonnelIds={savingPersonnelIds}
          search={personnelSearch}
          statusFilter={personnelStatusFilter}
          storeFilter={personnelStoreFilter}
          total={personnelMasterQuery.data?.meta.total ?? 0}
          offset={personnelOffset}
          t={t}
          getEffectivePersonnel={getEffectivePersonnel}
          onNextPage={() => dispatch({ type: 'shiftPersonnelOffset', delta: PAGE_SIZE })}
          onPreviousPage={() => dispatch({ type: 'shiftPersonnelOffset', delta: -PAGE_SIZE })}
          onSave={() => void submitPersonnelDrafts()}
          onSearchChange={(value) => dispatch({ type: 'setPersonnelSearch', value })}
          onStatusFilterChange={(value) => dispatch({ type: 'setPersonnelStatusFilter', value })}
          onStoreFilterChange={(value) => dispatch({ type: 'setPersonnelStoreFilter', value })}
          onUpdateDraft={updatePersonnelDraft}
        />
      ) : null}

      {activeTab === 'history' ? <MasterDataHistoryPanel t={t} /> : null}
    </section>
  )
}

function MasterDataCommandHero(input: { t: TranslateFunction }) {
  const { t } = input

  return (
    <header className="master-data-command-hero">
      <div>
        <div className="eyebrow">{t('adminMasterData.heroEyebrow')}</div>
        <h2 className="master-data-command-title">{t('adminMasterData.title')}</h2>
        <p className="master-data-command-copy">{t('adminMasterData.heroCopy')}</p>
      </div>
      <div className="master-data-command-hero-actions">
        <span className="master-data-command-chip">{t('adminMasterData.liveMaster')}</span>
        <span className="master-data-command-chip">{t('adminMasterData.backendControlled')}</span>
        <button className="control-button master-data-command-primary-button" type="button">
          {t('adminMasterData.newBatch')}
        </button>
      </div>
    </header>
  )
}

function MasterDataCommandMetrics(input: {
  batchTotal: number
  personnelTotal: number | undefined
  storeTotal: number | undefined
  t: TranslateFunction
}) {
  const { t } = input

  return (
    <section className="master-data-command-metrics" aria-label={t('adminMasterData.summaryAria')}>
      <MasterDataMetric
        icon={<DatabaseZap size={18} />}
        title={t('adminMasterData.batchMetric')}
        value={formatNumber(input.batchTotal)}
        note={t('adminMasterData.batchMetricNote')}
        tone="primary"
      />
      <MasterDataMetric
        icon={<Building2 size={18} />}
        title={t('adminMasterData.storeMetric')}
        value={input.storeTotal === undefined ? '—' : formatNumber(input.storeTotal)}
        note={
          input.storeTotal === undefined
            ? t('adminMasterData.openTabForCount')
            : t('adminMasterData.storeMetricNote')
        }
      />
      <MasterDataMetric
        icon={<UserRound size={18} />}
        title={t('adminMasterData.personnelMetric')}
        value={input.personnelTotal === undefined ? '—' : formatNumber(input.personnelTotal)}
        note={
          input.personnelTotal === undefined
            ? t('adminMasterData.openTabForCount')
            : t('adminMasterData.personnelMetricNote')
        }
      />
      <MasterDataMetric
        icon={<History size={18} />}
        title={t('adminMasterData.auditMetric')}
        value="Audit"
        note={t('adminMasterData.auditMetricNote')}
      />
    </section>
  )
}

function MasterDataPromotionFeedback(input: {
  feedback: string | null
  promotedRows: MasterDataBootstrapPromotionResponse['data']['promotedRows']
  t: TranslateFunction
}) {
  if (!input.feedback) {
    return null
  }

  return (
    <section className="master-data-command-feedback">
      <div className="inline-state inline-state-accent">{input.feedback}</div>
      {input.promotedRows.length ? (
        <div
          className="master-data-command-evidence-meta"
          aria-label={input.t('adminMasterData.promotionCommandResultAria')}
        >
          {input.promotedRows.map((row) => (
            <span className="master-data-command-chip" key={row.rowId}>
              {input.t('adminMasterData.promotedRow')}: {row.rowId} / {row.promotedEntityId}
              {row.assignmentId ? ` / ${row.assignmentId}` : ''}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  )
}

function MasterDataCommandTabs(input: {
  activeTab: MasterDataTab
  tabs: MasterDataCommandTab[]
  t: TranslateFunction
  onSelectTab: (tab: MasterDataTab) => void
}) {
  return (
    <nav className="master-data-command-tabs" aria-label={input.t('adminMasterData.tabsAria')}>
      {input.tabs.map((tab) => (
        <button
          className={`master-data-command-tab${input.activeTab === tab.id ? ' master-data-command-tab-active' : ''}`}
          key={tab.id}
          type="button"
          onClick={() => input.onSelectTab(tab.id)}
        >
          <strong>{tab.label}</strong>
          {tab.count !== undefined ? <span>{formatNumber(tab.count)}</span> : null}
        </button>
      ))}
    </nav>
  )
}

function MasterDataBootstrapBatchesPanel(input: {
  batchId: string | null
  batches: MasterDataBootstrapBatchItem[]
  detailError: unknown
  detailIsError: boolean
  detailLoading: boolean
  entityFilter: MasterDataBootstrapEntityFilter
  locale: ReturnType<typeof useLocalization>['locale']
  readiness: MasterDataBootstrapPromotionReadinessResponse['summary'] | null
  readinessError: unknown
  readinessFilter: MasterDataBootstrapReadinessFilter
  readinessIsError: boolean
  readinessLoading: boolean
  readinessRows: MasterDataBootstrapPromotionReadinessResponse['rows']['items']
  rows: MasterDataBootstrapRow[]
  search: string
  summary: MasterDataBootstrapBatchDetail['summary'] | null
  t: TranslateFunction
  promoting: boolean
  validating: boolean
  onEntityFilterChange: (value: MasterDataBootstrapEntityFilter) => void
  onPromote: () => void
  onReadinessFilterChange: (value: MasterDataBootstrapReadinessFilter) => void
  onSearchChange: (value: string) => void
  onValidate: () => void
}) {
  const { t } = input

  return (
    <section className="master-data-command-panel" aria-label={t('adminMasterData.batchesTabAria')}>
      <div className="master-data-command-panel-head">
        <div>
          <div className="eyebrow">{t('adminMasterData.reviewQueue')}</div>
          <h3>{t('adminMasterData.bootstrapBatches')}</h3>
          <p className="master-data-command-panel-copy">{t('adminMasterData.reviewQueueCopy')}</p>
        </div>
        <div className="master-data-command-toolbar">
          <label className="search-field master-data-command-search">
            <Search size={16} />
            <span className="sr-only">{t('adminMasterData.searchBatches')}</span>
            <input
              value={input.search}
              onChange={(event) => input.onSearchChange(event.target.value)}
              placeholder={t('adminMasterData.searchPlaceholder')}
            />
          </label>
          <label className="control-select">
            <span className="sr-only">{t('adminMasterData.entityFilter')}</span>
            <select
              value={input.entityFilter}
              onChange={(event) =>
                input.onEntityFilterChange(event.target.value as MasterDataBootstrapEntityFilter)
              }
            >
              <option value="all">{t('adminMasterData.allEntities')}</option>
              <option value="store">{t('adminMasterData.stores')}</option>
              <option value="personnel">{t('adminMasterData.personnel')}</option>
            </select>
          </label>
          <label className="control-select">
            <span className="sr-only">{t('adminMasterData.readinessFilter')}</span>
            <select
              value={input.readinessFilter}
              onChange={(event) =>
                input.onReadinessFilterChange(event.target.value as MasterDataBootstrapReadinessFilter)
              }
            >
              <option value="all">{t('adminMasterData.allReadiness')}</option>
              <option value="needs_validation">{t('adminMasterData.needsValidation')}</option>
              <option value="needs_review">{t('adminMasterData.needsReview')}</option>
              <option value="ready_to_promote">{t('adminMasterData.readyToPromote')}</option>
              <option value="closed">{t('adminMasterData.closed')}</option>
            </select>
          </label>
        </div>
      </div>

      {input.batches.length === 0 ? (
        <EmptyState title={t('adminMasterData.emptyBatchesTitle')} copy={t('adminMasterData.emptyBatchesCopy')} />
      ) : (
        <div className="master-data-command-list">
          {input.batches.map((batch) => (
            <Link className="master-data-command-row-link" key={batch.batchId} to={`/admin/master-data/${batch.batchId}`}>
              <div>
                <strong>{batch.sourceLabel}</strong>
                <small>{batch.batchId}</small>
              </div>
              <span>{formatMasterDataEntity(batch.bootstrapEntity, t)}</span>
              <span>{t('adminMasterData.rowsSuffix', { count: batch.rowCount })}</span>
              <MasterDataPill tone={mapReadinessTone(batch.readiness ?? batch.batchStatus)}>
                {formatMasterDataState(batch.readiness ?? batch.batchStatus, t)}
              </MasterDataPill>
              <span>{batch.fileReference ?? t('adminMasterData.noFileReference')}</span>
              <span>{formatDateTime(getBatchDisplayTimestamp(batch), input.locale)}</span>
              <span className="master-data-command-row-action">
                {t('adminMasterData.openEvidence')} <ArrowRight size={15} />
              </span>
            </Link>
          ))}
        </div>
      )}

      {input.batchId ? (
        <BatchDetailPanel
          batchId={input.batchId}
          detailLoading={input.detailLoading}
          detailError={input.detailError}
          detailIsError={input.detailIsError}
          readinessLoading={input.readinessLoading}
          readinessError={input.readinessError}
          readinessIsError={input.readinessIsError}
          summary={input.summary}
          readiness={input.readiness}
          readinessRows={input.readinessRows}
          rows={input.rows}
          validating={input.validating}
          promoting={input.promoting}
          onValidate={input.onValidate}
          onPromote={input.onPromote}
        />
      ) : null}
    </section>
  )
}

type EffectivePersonnelMasterItem = PersonnelMasterItem & {
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

function mergeStoreMasterPatch(
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

function mergePersonnelPatch(
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

async function submitStoreMasterDrafts(input: {
  drafts: Record<string, StoreMasterPatch>
  getEffectiveStore: (store: StoreMasterItem) => StoreMasterItem
  isSaving: boolean
  items: StoreMasterItem[]
  t: TranslateFunction
  clearDraft: (storeId: string) => void
  invalidateMasterData: () => void | Promise<unknown>
  setFeedback: (value: string | null) => void
  setSaving: (storeId: string, isSaving: boolean) => void
  updateCache: (store: StoreMasterItem) => void
}) {
  const changedStores = input.items.filter((store) => Boolean(input.drafts[store.storeId]))
  if (changedStores.length === 0 || input.isSaving) {
    return
  }

  const invalidStore = changedStores.find((store) => !input.getEffectiveStore(store).regionId)
  if (invalidStore) {
    input.setFeedback(input.t('adminMasterData.storeRegionRequired'))
    return
  }

  input.setFeedback(null)
  const results = await Promise.allSettled(
    changedStores.map(async (store) => {
      const nextStore = input.getEffectiveStore(store)
      input.setSaving(store.storeId, true)
      try {
        const response = await updateStoreMasterData({
          storeId: store.storeId,
          storeType: normalizeStoreType(nextStore.storeType),
          regionId: nextStore.regionId ?? '',
          status: normalizeStoreStatus(nextStore.status),
          kpiImportEnabled: nextStore.kpiImportEnabled,
        })
        input.updateCache(response.data.storeMaster)
        input.clearDraft(store.storeId)
        return response
      } finally {
        input.setSaving(store.storeId, false)
      }
    }),
  )
  const failedCount = results.filter((result) => result.status === 'rejected').length
  const savedCount = changedStores.length - failedCount

  input.setFeedback(
    failedCount > 0
      ? input.t('adminMasterData.bulkSavePartial', { saved: savedCount, failed: failedCount })
      : input.t('adminMasterData.bulkSaveSuccess', { count: savedCount }),
  )
  void input.invalidateMasterData()
}

async function submitPersonnelMasterDrafts(input: {
  drafts: Record<string, PersonnelMasterPatch>
  getEffectivePersonnel: (personnel: PersonnelMasterItem) => EffectivePersonnelMasterItem
  isSaving: boolean
  items: PersonnelMasterItem[]
  t: TranslateFunction
  clearDraft: (employeeId: string) => void
  invalidateMasterData: () => void | Promise<unknown>
  setFeedback: (value: string | null) => void
  setSaving: (employeeId: string, isSaving: boolean) => void
  updateCache: (personnel: PersonnelMasterItem) => void
}) {
  const changedPersonnel = input.items.filter((personnel) => Boolean(input.drafts[personnel.employeeId]))
  if (changedPersonnel.length === 0 || input.isSaving) {
    return
  }

  const missingStore = changedPersonnel.find((personnel) => !input.getEffectivePersonnel(personnel).storeId)
  if (missingStore) {
    input.setFeedback(input.t('adminMasterData.personnelStoreRequired'))
    return
  }
  const missingPosition = changedPersonnel.find((personnel) => !input.getEffectivePersonnel(personnel).positionId)
  if (missingPosition) {
    input.setFeedback(input.t('adminMasterData.personnelPositionRequired'))
    return
  }

  input.setFeedback(null)
  const results = await Promise.allSettled(
    changedPersonnel.map(async (personnel) => {
      const nextPersonnel = input.getEffectivePersonnel(personnel)
      input.setSaving(personnel.employeeId, true)
      try {
        const response = await updatePersonnelMasterData({
          employeeId: personnel.employeeId,
          firstName: nextPersonnel.firstName,
          lastName: nextPersonnel.lastName,
          externalEmployeeRef: nextPersonnel.externalEmployeeRef || undefined,
          employmentStatus: normalizePersonnelStatus(nextPersonnel.employmentStatus),
          employmentType: normalizeEmploymentType(nextPersonnel.employmentType),
          hireDate: nextPersonnel.hireDate,
          storeId: nextPersonnel.storeId,
          positionId: nextPersonnel.positionId,
          assignmentStartDate: nextPersonnel.assignmentStartDate || undefined,
        })
        input.updateCache(response.data.personnelMaster)
        input.clearDraft(personnel.employeeId)
        return response
      } finally {
        input.setSaving(personnel.employeeId, false)
      }
    }),
  )
  const failedCount = results.filter((result) => result.status === 'rejected').length
  const savedCount = changedPersonnel.length - failedCount

  input.setFeedback(
    failedCount > 0
      ? input.t('adminMasterData.bulkSavePartial', { saved: savedCount, failed: failedCount })
      : input.t('adminMasterData.bulkSaveSuccess', { count: savedCount }),
  )
  void input.invalidateMasterData()
}

function setStoreMasterQueryCache(
  queryClient: ReturnType<typeof useQueryClient>,
  updatedStore: StoreMasterItem,
) {
  queryClient.setQueriesData<ListResponse<StoreMasterItem>>(
    { queryKey: ['master-data-store-master'] },
    (current) => {
      if (!current) {
        return current
      }

      return {
        ...current,
        items: current.items.map((item) => (item.storeId === updatedStore.storeId ? updatedStore : item)),
      }
    },
  )
}

function setPersonnelMasterQueryCache(
  queryClient: ReturnType<typeof useQueryClient>,
  updatedPersonnel: PersonnelMasterItem,
) {
  queryClient.setQueriesData<ListResponse<PersonnelMasterItem>>(
    { queryKey: ['master-data-personnel-master'] },
    (current) => {
      if (!current) {
        return current
      }

      return {
        ...current,
        items: current.items.map((item) =>
          item.employeeId === updatedPersonnel.employeeId ? updatedPersonnel : item,
        ),
      }
    },
  )
}

function StoreMasterPanel(input: {
  error: unknown
  feedback: string | null
  isError: boolean
  isLoading: boolean
  isSaving: boolean
  items: StoreMasterItem[]
  lookups: StoreMasterLookups | undefined
  pendingCount: number
  savingStoreIds: ReadonlySet<string>
  search: string
  enabledFilter: StoreMasterEnabledFilter
  statusFilter: StoreMasterStatusFilter
  total: number
  offset: number
  t: TranslateFunction
  getEffectiveStore: (store: StoreMasterItem) => StoreMasterItem
  onEnabledFilterChange: (value: StoreMasterEnabledFilter) => void
  onNextPage: () => void
  onPreviousPage: () => void
  onSave: () => void
  onSearchChange: (value: string) => void
  onStatusFilterChange: (value: StoreMasterStatusFilter) => void
  onUpdateDraft: (storeId: string, patch: StoreMasterPatch) => void
}) {
  const { t } = input

  return (
    <section className="master-data-command-panel" aria-label={t('adminMasterData.storeTabAria')}>
      <div className="master-data-command-panel-head">
        <div>
          <div className="eyebrow">{t('adminMasterData.tabStores')}</div>
          <h3>{t('adminMasterData.storePanelTitle')}</h3>
          <p className="master-data-command-panel-copy">{t('adminMasterData.storePanelCopy')}</p>
        </div>
        <div className="master-data-command-toolbar">
          <label className="search-field master-data-command-search">
            <Search size={16} />
            <span className="sr-only">{t('adminMasterData.searchStores')}</span>
            <input
              value={input.search}
              onChange={(event) => input.onSearchChange(event.target.value)}
              placeholder={t('adminMasterData.searchStoreOrManager')}
            />
          </label>
          <label className="control-select">
            <span className="sr-only">{t('adminMasterData.filterStoreImportScope')}</span>
            <select
              value={input.enabledFilter}
              onChange={(event) => input.onEnabledFilterChange(event.target.value as StoreMasterEnabledFilter)}
            >
              <option value="all">{t('adminMasterData.allStores')}</option>
              <option value="enabled">{t('adminMasterData.included')}</option>
              <option value="disabled">{t('adminMasterData.excluded')}</option>
            </select>
          </label>
          <label className="control-select">
            <span className="sr-only">{t('adminMasterData.filterStoreStatus')}</span>
            <select
              value={input.statusFilter}
              onChange={(event) => input.onStatusFilterChange(event.target.value as StoreMasterStatusFilter)}
            >
              <option value="all">{t('adminMasterData.allStatuses')}</option>
              <option value="active">{t('adminMasterData.storeStatus.active')}</option>
              <option value="inactive">{t('adminMasterData.storeStatus.inactive')}</option>
              <option value="closed">{t('adminMasterData.storeStatus.closed')}</option>
            </select>
          </label>
        </div>
      </div>

      {input.feedback ? <div className="master-data-command-feedback">{input.feedback}</div> : null}
      {input.isLoading ? (
        <div className="inline-state inline-state-neutral">{t('adminMasterData.loadingStoreMaster')}</div>
      ) : input.isError ? (
        <ScreenState title={t('adminMasterData.errorTitle')} copy={getErrorMessage(input.error)} tone="error" />
      ) : input.items.length === 0 ? (
        <EmptyState title={t('adminMasterData.noStoresTitle')} copy={t('adminMasterData.noStoresCopy')} />
      ) : (
        <>
          <MasterDataBulkSaveBar
            disabled={input.pendingCount === 0 || input.isSaving}
            isSaving={input.isSaving}
            pendingCount={input.pendingCount}
            t={t}
            onSave={input.onSave}
          />
          <div className="master-data-command-table-wrap">
            <table className="master-data-command-table">
              <thead>
                <tr>
                  <th>{t('adminMasterData.store')}</th>
                  <th>{t('adminMasterData.type')}</th>
                  <th>{t('adminMasterData.regionalManager')}</th>
                  <th>{t('adminMasterData.status')}</th>
                  <th>{t('adminMasterData.kpiImport')}</th>
                </tr>
              </thead>
              <tbody>
                {input.items.map((store) => {
                  const effectiveStore = input.getEffectiveStore(store)
                  const saving = input.savingStoreIds.has(store.storeId)

                  return (
                    <tr key={store.storeId}>
                      <td>
                        <strong>{store.storeName}</strong>
                        <small>{store.storeCode}</small>
                      </td>
                      <td>
                        <select
                          aria-label={t('adminMasterData.storeTypeAria', { storeName: store.storeName })}
                          className="master-data-command-row-control"
                          disabled={saving}
                          value={normalizeStoreType(effectiveStore.storeType)}
                          onChange={(event) =>
                            input.onUpdateDraft(store.storeId, { storeType: normalizeStoreType(event.target.value) })
                          }
                        >
                          <option value="company">{t('adminMasterData.storeType.company')}</option>
                          <option value="franchise">{t('adminMasterData.storeType.franchise')}</option>
                          <option value="operator">{t('adminMasterData.storeType.operator')}</option>
                        </select>
                      </td>
                      <td>
                        <select
                          aria-label={t('adminMasterData.storeRegionalManagerAria', { storeName: store.storeName })}
                          className="master-data-command-row-control"
                          disabled={saving}
                          value={effectiveStore.regionId ?? ''}
                          onChange={(event) => input.onUpdateDraft(store.storeId, { regionId: event.target.value })}
                        >
                          {input.lookups?.regions.length === 0 ? (
                            <option value="">{t('adminMasterData.noActiveRegionalManagers')}</option>
                          ) : null}
                          {input.lookups?.regions.map((region) => (
                            <option key={region.regionId} value={region.regionId}>
                              {region.regionName}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          aria-label={t('adminMasterData.storeStatusAria', { storeName: store.storeName })}
                          className="master-data-command-row-control"
                          disabled={saving}
                          value={normalizeStoreStatus(effectiveStore.status)}
                          onChange={(event) =>
                            input.onUpdateDraft(store.storeId, { status: normalizeStoreStatus(event.target.value) })
                          }
                        >
                          <option value="active">{t('adminMasterData.storeStatus.active')}</option>
                          <option value="inactive">{t('adminMasterData.storeStatus.inactive')}</option>
                          <option value="closed">{t('adminMasterData.storeStatus.closed')}</option>
                        </select>
                      </td>
                      <td>
                        <label className="master-data-command-toggle">
                          <input
                            aria-label={t('adminMasterData.storeKpiImportEnabledAria', { storeName: store.storeName })}
                            checked={effectiveStore.kpiImportEnabled}
                            disabled={saving}
                            type="checkbox"
                            onChange={(event) =>
                              input.onUpdateDraft(store.storeId, {
                                kpiImportEnabled: event.target.checked,
                              })
                            }
                          />
                          <span>
                            {effectiveStore.kpiImportEnabled
                              ? t('adminMasterData.included')
                              : t('adminMasterData.excluded')}
                          </span>
                        </label>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <MasterDataPager
            offset={input.offset}
            total={input.total}
            onPrevious={input.onPreviousPage}
            onNext={input.onNextPage}
          />
        </>
      )}
    </section>
  )
}

function PersonnelMasterPanel(input: {
  error: unknown
  feedback: string | null
  isError: boolean
  isLoading: boolean
  isSaving: boolean
  items: PersonnelMasterItem[]
  lookups: PersonnelMasterLookups | undefined
  pendingCount: number
  savingPersonnelIds: ReadonlySet<string>
  search: string
  statusFilter: PersonnelStatusFilter
  storeFilter: string
  total: number
  offset: number
  t: TranslateFunction
  getEffectivePersonnel: (personnel: PersonnelMasterItem) => EffectivePersonnelMasterItem
  onNextPage: () => void
  onPreviousPage: () => void
  onSave: () => void
  onSearchChange: (value: string) => void
  onStatusFilterChange: (value: PersonnelStatusFilter) => void
  onStoreFilterChange: (value: string) => void
  onUpdateDraft: (employeeId: string, patch: PersonnelMasterPatch) => void
}) {
  const { t } = input

  return (
    <section className="master-data-command-panel" aria-label={t('adminMasterData.personnelTabAria')}>
      <div className="master-data-command-panel-head">
        <div>
          <div className="eyebrow">{t('adminMasterData.tabPersonnel')}</div>
          <h3>{t('adminMasterData.personnelPanelTitle')}</h3>
          <p className="master-data-command-panel-copy">{t('adminMasterData.personnelPanelCopy')}</p>
        </div>
        <div className="master-data-command-toolbar">
          <label className="search-field master-data-command-search">
            <Search size={16} />
            <span className="sr-only">{t('adminMasterData.searchPersonnel')}</span>
            <input
              value={input.search}
              onChange={(event) => input.onSearchChange(event.target.value)}
              placeholder={t('adminMasterData.searchPersonnelPlaceholder')}
            />
          </label>
          <label className="control-select">
            <span className="sr-only">{t('adminMasterData.filterPersonnelStatus')}</span>
            <select
              value={input.statusFilter}
              onChange={(event) => input.onStatusFilterChange(event.target.value as PersonnelStatusFilter)}
            >
              <option value="all">{t('adminMasterData.allStatuses')}</option>
              <option value="active">{t('adminMasterData.employmentStatus.active')}</option>
              <option value="inactive">{t('adminMasterData.employmentStatus.inactive')}</option>
              <option value="terminated">{t('adminMasterData.employmentStatus.terminated')}</option>
            </select>
          </label>
          <label className="control-select">
            <span className="sr-only">{t('adminMasterData.filterPersonnelStore')}</span>
            <select value={input.storeFilter} onChange={(event) => input.onStoreFilterChange(event.target.value)}>
              <option value="all">{t('adminMasterData.allStores')}</option>
              {input.lookups?.stores.map((store) => (
                <option key={store.storeId} value={store.storeId}>
                  {store.storeName}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {input.feedback ? <div className="master-data-command-feedback">{input.feedback}</div> : null}
      {input.isLoading ? (
        <div className="inline-state inline-state-neutral">{t('adminMasterData.loadingPersonnelMaster')}</div>
      ) : input.isError ? (
        <ScreenState title={t('adminMasterData.errorTitle')} copy={getErrorMessage(input.error)} tone="error" />
      ) : input.items.length === 0 ? (
        <EmptyState title={t('adminMasterData.noPersonnelTitle')} copy={t('adminMasterData.noPersonnelCopy')} />
      ) : (
        <>
          <MasterDataBulkSaveBar
            disabled={input.pendingCount === 0 || input.isSaving}
            isSaving={input.isSaving}
            pendingCount={input.pendingCount}
            t={t}
            onSave={input.onSave}
          />
          <div className="master-data-command-table-wrap">
            <table className="master-data-command-table master-data-command-personnel-table">
              <thead>
                <tr>
                  <th>{t('adminMasterData.employee')}</th>
                  <th>{t('adminMasterData.sellerCode')}</th>
                  <th>{t('adminMasterData.store')}</th>
                  <th>{t('adminMasterData.position')}</th>
                  <th>{t('adminMasterData.employment')}</th>
                  <th>{t('adminMasterData.assignmentStart')}</th>
                </tr>
              </thead>
              <tbody>
                {input.items.map((personnel) => {
                  const effectivePersonnel = input.getEffectivePersonnel(personnel)
                  const saving = input.savingPersonnelIds.has(personnel.employeeId)

                  return (
                    <tr key={personnel.employeeId}>
                      <td>
                        <div className="master-data-command-name-grid">
                          <input
                            aria-label={t('adminMasterData.firstName')}
                            className="master-data-command-row-control"
                            disabled={saving}
                            value={effectivePersonnel.firstName}
                            onChange={(event) =>
                              input.onUpdateDraft(personnel.employeeId, { firstName: event.target.value })
                            }
                          />
                          <input
                            aria-label={t('adminMasterData.lastName')}
                            className="master-data-command-row-control"
                            disabled={saving}
                            value={effectivePersonnel.lastName}
                            onChange={(event) =>
                              input.onUpdateDraft(personnel.employeeId, { lastName: event.target.value })
                            }
                          />
                        </div>
                      </td>
                      <td>
                        <input
                          aria-label={t('adminMasterData.sellerCode')}
                          className="master-data-command-row-control"
                          disabled={saving}
                          value={effectivePersonnel.externalEmployeeRef}
                          onChange={(event) =>
                            input.onUpdateDraft(personnel.employeeId, {
                              externalEmployeeRef: event.target.value,
                            })
                          }
                        />
                      </td>
                      <td>
                        <select
                          className="master-data-command-row-control"
                          disabled={saving}
                          value={effectivePersonnel.storeId}
                          onChange={(event) =>
                            input.onUpdateDraft(personnel.employeeId, { storeId: event.target.value })
                          }
                        >
                          <option value="">{t('adminMasterData.allStores')}</option>
                          {input.lookups?.stores.map((store) => (
                            <option key={store.storeId} value={store.storeId}>
                              {store.storeName}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          className="master-data-command-row-control"
                          disabled={saving}
                          value={effectivePersonnel.positionId}
                          onChange={(event) =>
                            input.onUpdateDraft(personnel.employeeId, { positionId: event.target.value })
                          }
                        >
                          <option value="">{t('adminMasterData.position')}</option>
                          {input.lookups?.positions.map((position) => (
                            <option key={position.positionId} value={position.positionId}>
                              {position.positionName}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <div className="master-data-command-name-grid">
                          <select
                            className="master-data-command-row-control"
                            disabled={saving}
                            value={normalizePersonnelStatus(effectivePersonnel.employmentStatus)}
                            onChange={(event) =>
                              input.onUpdateDraft(personnel.employeeId, {
                                employmentStatus: normalizePersonnelStatus(event.target.value),
                              })
                            }
                          >
                            <option value="active">{t('adminMasterData.employmentStatus.active')}</option>
                            <option value="inactive">{t('adminMasterData.employmentStatus.inactive')}</option>
                            <option value="terminated">{t('adminMasterData.employmentStatus.terminated')}</option>
                          </select>
                          <select
                            className="master-data-command-row-control"
                            disabled={saving}
                            value={normalizeEmploymentType(effectivePersonnel.employmentType)}
                            onChange={(event) =>
                              input.onUpdateDraft(personnel.employeeId, {
                                employmentType: normalizeEmploymentType(event.target.value),
                              })
                            }
                          >
                            <option value="full_time">{t('adminMasterData.employmentType.full_time')}</option>
                            <option value="part_time">{t('adminMasterData.employmentType.part_time')}</option>
                            <option value="temporary">{t('adminMasterData.employmentType.temporary')}</option>
                          </select>
                        </div>
                      </td>
                      <td>
                        <div className="master-data-command-name-grid">
                          <input
                            aria-label={t('adminMasterData.hireDate')}
                            className="master-data-command-row-control"
                            disabled={saving}
                            type="date"
                            value={dateInputValue(effectivePersonnel.hireDate)}
                            onChange={(event) =>
                              input.onUpdateDraft(personnel.employeeId, { hireDate: event.target.value })
                            }
                          />
                          <input
                            aria-label={t('adminMasterData.assignmentStart')}
                            className="master-data-command-row-control"
                            disabled={saving}
                            type="date"
                            value={dateInputValue(effectivePersonnel.assignmentStartDate)}
                            onChange={(event) =>
                              input.onUpdateDraft(personnel.employeeId, {
                                assignmentStartDate: event.target.value,
                              })
                            }
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <MasterDataPager
            offset={input.offset}
            total={input.total}
            onPrevious={input.onPreviousPage}
            onNext={input.onNextPage}
          />
        </>
      )}
    </section>
  )
}

function MasterDataHistoryPanel(input: { t: TranslateFunction }) {
  const { t } = input

  return (
    <section className="master-data-command-panel" aria-label={t('adminMasterData.historyTabAria')}>
      <div className="master-data-command-panel-head">
        <div>
          <div className="eyebrow">{t('adminMasterData.tabHistory')}</div>
          <h3>{t('adminMasterData.historyPanelTitle')}</h3>
          <p className="master-data-command-panel-copy">{t('adminMasterData.historyPanelCopy')}</p>
        </div>
      </div>
      <div className="master-data-command-history">
        <MasterDataHistoryRow label={t('adminMasterData.historyStoreEvent')} eventType="store_master_data.updated" />
        <MasterDataHistoryRow label={t('adminMasterData.historyPersonnelEvent')} eventType="personnel_master_data.updated" />
        <MasterDataHistoryRow label={t('adminMasterData.historyBootstrapEvent')} eventType="master_data_bootstrap.promoted" />
      </div>
    </section>
  )
}

function MasterDataMetric(input: {
  icon: ReactNode
  title: string
  value: string
  note: string
  tone?: 'primary'
}) {
  return (
    <article className={`master-data-command-metric${input.tone === 'primary' ? ' master-data-command-metric-primary' : ''}`}>
      <div className="master-data-command-metric-icon">{input.icon}</div>
      <span>{input.title}</span>
      <strong>{input.value}</strong>
      <p>{input.note}</p>
    </article>
  )
}

function MasterDataPill(input: { children: ReactNode; tone?: 'accent' | 'calm' | 'warning' | 'danger' | 'neutral' }) {
  return (
    <span className={`master-data-command-pill master-data-command-pill-${input.tone ?? 'neutral'}`}>
      {input.children}
    </span>
  )
}

function MasterDataPager(input: {
  offset: number
  total: number
  onPrevious: () => void
  onNext: () => void
}) {
  const { t } = useLocalization()
  const from = input.total === 0 ? 0 : input.offset + 1
  const to = Math.min(input.offset + PAGE_SIZE, input.total)

  return (
    <div className="master-data-command-pager">
      <span>
        {formatNumber(from)}-{formatNumber(to)} / {formatNumber(input.total)}
      </span>
      <div>
        <button className="control-button" type="button" disabled={input.offset === 0} onClick={input.onPrevious}>
          {t('adminIntegrations.previous')}
        </button>
        <button
          className="control-button"
          type="button"
          disabled={input.offset + PAGE_SIZE >= input.total}
          onClick={input.onNext}
        >
          {t('adminIntegrations.next')}
        </button>
      </div>
    </div>
  )
}

function MasterDataBulkSaveBar(input: {
  disabled: boolean
  isSaving: boolean
  pendingCount: number
  t: TranslateFunction
  onSave: () => void
}) {
  return (
    <div className="master-data-command-bulk-actions">
      <span>{input.t('adminMasterData.pendingChanges', { count: input.pendingCount })}</span>
      <button
        className="control-button master-data-command-primary-button"
        disabled={input.disabled}
        type="button"
        onClick={input.onSave}
      >
        <Save size={16} />
        {input.isSaving ? input.t('adminMasterData.saving') : input.t('adminMasterData.saveChanges')}
      </button>
    </div>
  )
}

function MasterDataHistoryRow(input: { label: string; eventType: string }) {
  return (
    <div className="master-data-command-history-row">
      <span>Audit</span>
      <strong>{input.label}</strong>
      <MasterDataPill tone="accent">{input.eventType}</MasterDataPill>
    </div>
  )
}

function getBatchDisplayTimestamp(batch: MasterDataBootstrapBatchItem) {
  return batch.updatedAt ?? batch.promotedAt ?? batch.validatedAt ?? batch.createdAt
}

function BatchDetailPanel(input: {
  batchId: string
  detailLoading: boolean
  detailError: unknown
  detailIsError: boolean
  readinessLoading: boolean
  readinessError: unknown
  readinessIsError: boolean
  summary: MasterDataBootstrapBatchDetail['summary'] | null
  readiness: MasterDataBootstrapPromotionReadinessResponse['summary'] | null
  readinessRows: MasterDataBootstrapPromotionReadinessResponse['rows']['items']
  rows: MasterDataBootstrapRow[]
  validating: boolean
  promoting: boolean
  onValidate: () => void
  onPromote: () => void
}) {
  const { t } = useLocalization()

  if (input.detailLoading || input.readinessLoading) {
    return (
      <ScreenState
        title={t('adminMasterData.detailLoadingTitle')}
        copy={t('adminMasterData.detailLoadingCopy')}
      />
    )
  }

  if (input.detailIsError) {
    return (
      <ScreenState
        title={t('adminMasterData.batchUnavailableTitle')}
        copy={getErrorMessage(input.detailError)}
        tone="error"
      />
    )
  }

  if (input.readinessIsError) {
    return (
      <ScreenState
        title={t('adminMasterData.readinessUnavailableTitle')}
        copy={getErrorMessage(input.readinessError)}
        tone="error"
      />
    )
  }

  if (!input.summary || !input.readiness) {
    return (
      <ScreenState
        title={t('adminMasterData.batchUnavailableTitle')}
        copy={t('adminMasterData.missingEvidenceCopy')}
        tone="error"
      />
    )
  }

  const promoteLabel =
    input.summary.bootstrapEntity === 'store'
      ? t('adminMasterData.promoteStores')
      : t('adminMasterData.promotePersonnel')
  const promotedLabel = `${input.summary.promotedCount} / ${input.summary.rowCount}`

  return (
    <section className="master-data-command-detail">
      <div className="master-data-command-metrics master-data-command-detail-metrics">
        <MasterDataMetric
          title={t('adminMasterData.readyRows')}
          value={formatNumber(input.readiness.readyCount)}
          note={t('adminMasterData.nextAction', {
            action: formatMasterDataState(input.readiness.nextAction, t),
          })}
          icon={<ListChecks size={18} />}
          tone="primary"
        />
        <MasterDataMetric
          title={t('adminMasterData.promotedRows')}
          value={formatNumber(input.summary.promotedCount)}
          note={promotedLabel}
          icon={<ShieldCheck size={18} />}
        />
        <MasterDataMetric
          title={t('adminMasterData.needsValidationMetric')}
          value={formatNumber(input.readiness.needsValidationCount)}
          note={formatMasterDataState(input.readiness.nextAction, t)}
          icon={<DatabaseZap size={18} />}
        />
        <MasterDataMetric
          title={t('adminMasterData.blockedRows')}
          value={formatNumber(input.readiness.blockedCount + input.readiness.needsReviewCount)}
          note={formatMasterDataState(input.readiness.nextAction, t)}
          icon={<CheckCircle2 size={18} />}
        />
      </div>

      <section className="master-data-command-split">
        <article className="master-data-command-card">
          <div className="master-data-command-card-head">
            <div>
              <div className="eyebrow">{t('adminMasterData.selectedBatch')}</div>
              <h4>{input.summary.sourceLabel}</h4>
            </div>
            <MasterDataPill tone={mapReadinessTone(input.readiness.nextAction)}>
              {formatMasterDataState(input.readiness.nextAction, t)}
            </MasterDataPill>
          </div>
          <div className="master-data-command-key-grid">
            <KeyTile label={t('adminMasterData.batch')} value={input.batchId} />
            <KeyTile label={t('adminMasterData.entity')} value={formatMasterDataEntity(input.summary.bootstrapEntity, t)} />
            <KeyTile label={t('adminMasterData.status')} value={formatMasterDataState(input.summary.batchStatus, t)} />
            <KeyTile
              label={t('adminMasterData.readiness')}
              value={input.readiness.canPromote ? t('adminMasterData.canPromote') : t('adminMasterData.blocked')}
            />
            <KeyTile label={t('adminMasterData.promotedRows')} value={promotedLabel} />
            <KeyTile label={t('adminMasterData.file')} value={input.summary.fileReference ?? t('adminMasterData.noFileReference')} />
          </div>
        </article>

        <article className="master-data-command-card">
          <div className="master-data-command-card-head">
            <div>
              <div className="eyebrow">{t('adminMasterData.actions')}</div>
              <h4>{t('adminMasterData.commandPanelTitle')}</h4>
            </div>
          </div>
          <p>{t('adminMasterData.commandPanelCopy')}</p>
          <div className="master-data-command-toolbar">
            <button
              className="control-button master-data-command-primary-button"
              type="button"
              disabled={input.validating}
              onClick={input.onValidate}
            >
              {input.validating ? t('adminMasterData.validating') : t('adminMasterData.validateBatch')}
            </button>
            <button
              className="control-button master-data-command-primary-button"
              type="button"
              disabled={!input.readiness.canPromote || input.promoting}
              onClick={input.onPromote}
            >
              {input.promoting ? t('adminMasterData.promoting') : promoteLabel}
            </button>
          </div>
          {!input.readiness.canPromote ? (
            <div className="inline-state inline-state-warning">
              {t('adminMasterData.promotionDisabled')}
            </div>
          ) : null}
        </article>
      </section>

      <EvidenceList
        ariaLabel={t('adminMasterData.promotionDryRunEvidenceAria')}
        eyebrow={t('adminMasterData.dryRun')}
        title={t('adminMasterData.dryRunTitle')}
        copy={t('adminMasterData.dryRunCopy')}
        emptyCopy={t('adminMasterData.dryRunEmpty')}
        rows={input.readinessRows.map((row) => ({
          key: row.rowId,
          title: `#${row.rowNumber} ${resolveDryRunRowLabel(row)}`,
          pill: formatMasterDataState(row.promotionReadiness, t),
          tone: mapPromotionReadinessTone(row.promotionReadiness),
          chips: [
            [t('adminMasterData.storeCode'), row.sourceStoreCode],
            [t('adminMasterData.employeeCode'), row.sourceEmployeeCode],
            [t('adminMasterData.promotedEntity'), row.promotedEntityId],
            [t('adminMasterData.blockReason'), row.blockReason],
          ],
        }))}
      />

      <EvidenceList
        ariaLabel={t('adminMasterData.bootstrapRowEvidenceAria')}
        eyebrow={t('adminMasterData.rowEvidence')}
        title={t('adminMasterData.rowEvidenceTitle')}
        emptyCopy={t('adminMasterData.rowEvidenceEmpty')}
        rows={input.rows.map((row) => ({
          key: row.rowId,
          title: `#${row.rowNumber} ${resolveRowName(row)}`,
          pill: formatMasterDataState(row.validationStatus, t),
          tone: mapValidationTone(row.validationStatus),
          copy: row.issueMessage,
          chips: [
            [t('adminMasterData.storeCode'), row.sourceStoreCode],
            [t('adminMasterData.employeeCode'), row.sourceEmployeeCode],
            [t('adminMasterData.resolvedStore'), row.resolvedStoreId],
            [t('adminMasterData.resolvedEmployee'), row.resolvedEmployeeId],
            [t('adminMasterData.resolvedPosition'), row.resolvedPositionId],
            [t('adminMasterData.promotedEntity'), row.promotedEntityId],
          ],
        }))}
      />
    </section>
  )
}

function KeyTile(input: { label: string; value: string }) {
  return (
    <div className="master-data-command-key-tile">
      <span>{input.label}</span>
      <strong>{input.value}</strong>
    </div>
  )
}

function EvidenceList(input: {
  ariaLabel: string
  eyebrow: string
  title: string
  copy?: string
  emptyCopy: string
  rows: Array<{
    key: string
    title: string
    pill: string
    tone: 'accent' | 'calm' | 'warning' | 'danger' | 'neutral'
    copy?: string | null
    chips: Array<[string, string | null | undefined]>
  }>
}) {
  const { t } = useLocalization()

  return (
    <section className="master-data-command-card" aria-label={input.ariaLabel}>
      <div className="master-data-command-card-head">
        <div>
          <div className="eyebrow">{input.eyebrow}</div>
          <h4>{input.title}</h4>
          {input.copy ? <p>{input.copy}</p> : null}
        </div>
      </div>
      {input.rows.length === 0 ? (
        <EmptyState copy={input.emptyCopy} />
      ) : (
        <div className="master-data-command-evidence-list">
          {input.rows.map((row) => (
            <div className="master-data-command-evidence-row" key={row.key}>
              <div className="master-data-command-evidence-row-head">
                <strong>{row.title}</strong>
                <MasterDataPill tone={row.tone}>{row.pill}</MasterDataPill>
              </div>
              {row.copy ? <p>{row.copy}</p> : null}
              <div className="master-data-command-evidence-meta">
                {row.chips.map(([label, value]) => (
                  <span className="master-data-command-chip" key={`${row.key}-${label}`}>
                    {label}: <code>{value ?? t('adminMasterData.notResolved')}</code>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function resolveRowName(row: MasterDataBootstrapRow) {
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

function resolveDryRunRowLabel(
  row: MasterDataBootstrapPromotionReadinessResponse['rows']['items'][number],
) {
  return row.sourceEmployeeCode ?? row.sourceStoreCode ?? row.rowId
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

function mapPromotionReadinessTone(value: string) {
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

function mapReadinessTone(value: MasterDataBootstrapReadiness | string) {
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

function mapValidationTone(value: string) {
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
