import { useDeferredValue, useMemo, useReducer, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  Building2,
  DatabaseZap,
  History,
  Save,
  Search,
  UserRound,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'
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
  MasterDataBootstrapRow,
  PersonnelMasterLookups,
  PersonnelMasterItem,
  StoreMasterLookups,
  StoreMasterItem,
} from '../features/integrations/api'
import type { TranslateFunction } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import { formatDateTime, getErrorMessage } from '../lib/format'
import {
  AdminActionRow,
  AdminFilterBar,
  AdminStatePanel,
  AdminSurfaceBadge,
  AdminSurfaceEmpty,
  AdminSurfacePage,
  AdminSurfaceSection,
  type AdminSurfaceTone,
} from './admin-surface-primitives'
import { AdminOperationalHeader, AdminOperationalMetrics, AdminOperationalPage } from './admin-operational-primitives'
import {
  PAGE_SIZE,
  dateInputValue,
  formatMasterDataEntity,
  formatMasterDataState,
  formatNumber,
  getBatchDisplayTimestamp,
  initialMasterDataPageState,
  mapReadinessTone,
  masterDataPageReducer,
  mergePersonnelPatch,
  mergeStoreMasterPatch,
  normalizeEmploymentType,
  normalizePersonnelStatus,
  normalizeStoreStatus,
  normalizeStoreType,
  type EffectivePersonnelMasterItem,
  type MasterDataBootstrapEntityFilter,
  type MasterDataBootstrapReadinessFilter,
  type MasterDataCommandTab,
  type MasterDataTab,
  type PersonnelMasterPatch,
  type PersonnelStatusFilter,
  type StoreMasterEnabledFilter,
  type StoreMasterPatch,
  type StoreMasterStatusFilter,
} from './master-data-bootstrap-model'
import { BatchDetailPanel } from './master-data-bootstrap-batch-detail-panel'
import { MasterDataReadinessStrip } from './master-data-readiness-strip'

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
        ...(input.entityFilter === 'all' ? {} : { bootstrapEntity: input.entityFilter }),
        ...(input.readinessFilter === 'all' ? {} : { readiness: input.readinessFilter }),
        ...(deferredBatchSearch ? { q: deferredBatchSearch } : {}),
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
        ...(deferredStoreSearch ? { q: deferredStoreSearch } : {}),
        ...(input.storeEnabledFilter === 'all'
          ? {}
          : { enabled: input.storeEnabledFilter === 'enabled' }),
        ...(input.storeStatusFilter === 'all' ? {} : { status: input.storeStatusFilter }),
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
        ...(deferredPersonnelSearch ? { q: deferredPersonnelSearch } : {}),
        ...(input.personnelStatusFilter === 'all' ? {} : { status: input.personnelStatusFilter }),
        ...(input.personnelStoreFilter === 'all' ? {} : { storeId: input.personnelStoreFilter }),
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
    return (
      <AdminSurfacePage>
        <AdminStatePanel
          isLoading
          title={t('adminMasterData.loadingTitle')}
          description={t('adminMasterData.loadingCopy')}
        />
      </AdminSurfacePage>
    )
  }

  if (batchesQuery.isError) {
    return (
      <AdminSurfacePage>
        <AdminStatePanel
          title={t('adminMasterData.errorTitle')}
          description={getErrorMessage(batchesQuery.error)}
          tone="danger"
        />
      </AdminSurfacePage>
    )
  }

  const tabs: MasterDataCommandTab[] = [
    {
      id: 'batches',
      label: t('adminMasterData.tabBatches'),
      ...(batchesQuery.data?.meta.total === undefined ? {} : { count: batchesQuery.data.meta.total }),
    },
    {
      id: 'stores',
      label: t('adminMasterData.tabStores'),
      ...(storeMasterQuery.data?.meta.total === undefined ? {} : { count: storeMasterQuery.data.meta.total }),
    },
    {
      id: 'personnel',
      label: t('adminMasterData.tabPersonnel'),
      ...(personnelMasterQuery.data?.meta.total === undefined
        ? {}
        : { count: personnelMasterQuery.data.meta.total }),
    },
    { id: 'history', label: t('adminMasterData.tabHistory') },
  ]
  const promotedRows =
    promotionResult?.promotedRows.length
      ? promotionResult.promotedRows
      : promotionResult?.batch.promotedRows ?? []

  return (
    <AdminOperationalPage ariaLabel={t('adminMasterData.title')}>
      <MasterDataCommandHero t={t} />

      <MasterDataCommandMetrics
        batchTotal={batchesQuery.data?.meta.total ?? 0}
        personnelTotal={personnelMasterQuery.data?.meta.total}
        storeTotal={storeMasterQuery.data?.meta.total}
        t={t}
      />

      <MasterDataReadinessStrip batches={batches} t={t} />

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
    </AdminOperationalPage>
  )
}

function MasterDataCommandHero(input: { t: TranslateFunction }) {
  const { t } = input

  return (
    <AdminOperationalHeader
      eyebrow={t('adminMasterData.heroEyebrow')}
      title={t('adminMasterData.title')}
      description={t('adminMasterData.heroCopy')}
      icon={<DatabaseZap size={18} />}
      meta={
        <>
          <AdminSurfaceBadge tone="success">{t('adminMasterData.liveMaster')}</AdminSurfaceBadge>
          <AdminSurfaceBadge tone="cyan">{t('adminMasterData.backendControlled')}</AdminSurfaceBadge>
        </>
      }
      actions={
        <Button type="button">
          <DatabaseZap aria-hidden="true" />
          {t('adminMasterData.newBatch')}
        </Button>
      }
    />
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
    <AdminOperationalMetrics
      className="tw:xl:grid-cols-4"
      items={[
        {
          id: 'batches',
          icon: <DatabaseZap size={18} />,
          label: t('adminMasterData.batchMetric'),
          value: formatNumber(input.batchTotal),
          description: t('adminMasterData.batchMetricNote'),
          tone: 'accent',
        },
        {
          id: 'stores',
          icon: <Building2 size={18} />,
          label: t('adminMasterData.storeMetric'),
          value: input.storeTotal === undefined ? '-' : formatNumber(input.storeTotal),
          description:
            input.storeTotal === undefined
              ? t('adminMasterData.openTabForCount')
              : t('adminMasterData.storeMetricNote'),
          tone: 'cyan',
        },
        {
          id: 'personnel',
          icon: <UserRound size={18} />,
          label: t('adminMasterData.personnelMetric'),
          value: input.personnelTotal === undefined ? '-' : formatNumber(input.personnelTotal),
          description:
            input.personnelTotal === undefined
              ? t('adminMasterData.openTabForCount')
              : t('adminMasterData.personnelMetricNote'),
          tone: 'success',
        },
        {
          id: 'audit',
          icon: <History size={18} />,
          label: t('adminMasterData.auditMetric'),
          value: 'Audit',
          description: t('adminMasterData.auditMetricNote'),
          tone: 'neutral',
        },
      ]}
    />
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
    <AdminStatePanel title={input.feedback} tone="accent">
      {input.promotedRows.length ? (
        <div
          className="tw:mt-2 tw:flex tw:flex-wrap tw:gap-2"
          aria-label={input.t('adminMasterData.promotionCommandResultAria')}
        >
          {input.promotedRows.map((row) => (
            <AdminSurfaceBadge tone="accent" key={row.rowId}>
              {input.t('adminMasterData.promotedRow')}: {row.rowId} / {row.promotedEntityId}
              {row.assignmentId ? ' / ' + row.assignmentId : ''}
            </AdminSurfaceBadge>
          ))}
        </div>
      ) : null}
    </AdminStatePanel>
  )
}

function MasterDataCommandTabs(input: {
  activeTab: MasterDataTab
  tabs: MasterDataCommandTab[]
  t: TranslateFunction
  onSelectTab: (tab: MasterDataTab) => void
}) {
  return (
    <nav
      className="tw:grid tw:grid-cols-1 tw:gap-2 tw:rounded-xl tw:border tw:border-border tw:bg-card/80 tw:p-2 tw:shadow-sm tw:sm:grid-cols-2 tw:xl:grid-cols-4"
      aria-label={input.t('adminMasterData.tabsAria')}
    >
      {input.tabs.map((tab) => (
        <Button
          className="tw:h-auto tw:justify-between tw:py-3"
          key={tab.id}
          type="button"
          variant={input.activeTab === tab.id ? 'default' : 'outline'}
          onClick={() => input.onSelectTab(tab.id)}
        >
          <span>{tab.label}</span>
          {tab.count !== undefined ? <AdminSurfaceBadge tone="neutral">{formatNumber(tab.count)}</AdminSurfaceBadge> : null}
        </Button>
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
    <AdminSurfaceSection
      ariaLabel={t('adminMasterData.batchesTabAria')}
      eyebrow={t('adminMasterData.reviewQueue')}
      title={t('adminMasterData.bootstrapBatches')}
      description={t('adminMasterData.reviewQueueCopy')}
      actions={
        <AdminFilterBar className="tw:w-full tw:md:w-auto">
          <label className="tw:flex tw:min-w-56 tw:flex-1 tw:items-center tw:gap-2">
            <Search aria-hidden="true" />
            <span className="sr-only">{t('adminMasterData.searchBatches')}</span>
            <Input
              value={input.search}
              onChange={(event) => input.onSearchChange(event.target.value)}
              placeholder={t('adminMasterData.searchPlaceholder')}
            />
          </label>
          <label className="tw:grid tw:gap-1">
            <span className="sr-only">{t('adminMasterData.entityFilter')}</span>
            <select
              className={nativeSelectClass()}
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
          <label className="tw:grid tw:gap-1">
            <span className="sr-only">{t('adminMasterData.readinessFilter')}</span>
            <select
              className={nativeSelectClass()}
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
        </AdminFilterBar>
      }
    >
      {input.batches.length === 0 ? (
        <AdminSurfaceEmpty title={t('adminMasterData.emptyBatchesTitle')} copy={t('adminMasterData.emptyBatchesCopy')} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('adminMasterData.bootstrapBatches')}</TableHead>
              <TableHead>{t('adminMasterData.entity')}</TableHead>
              <TableHead>{t('adminMasterData.rows')}</TableHead>
              <TableHead>{t('adminMasterData.readiness')}</TableHead>
              <TableHead>{t('adminMasterData.file')}</TableHead>
              <TableHead className="tw:text-right">{t('adminMasterData.openEvidence')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {input.batches.map((batch) => (
              <TableRow key={batch.batchId}>
                <TableCell>
                  <div className="tw:grid tw:gap-1">
                    <strong className="tw:text-sm tw:font-medium">{batch.sourceLabel}</strong>
                    <span className="tw:max-w-72 tw:truncate tw:text-xs tw:text-muted-foreground">{batch.batchId}</span>
                    <span className="tw:text-xs tw:text-muted-foreground">{formatDateTime(getBatchDisplayTimestamp(batch), input.locale)}</span>
                  </div>
                </TableCell>
                <TableCell>{formatMasterDataEntity(batch.bootstrapEntity, t)}</TableCell>
                <TableCell>{t('adminMasterData.rowsSuffix', { count: batch.rowCount })}</TableCell>
                <TableCell>
                  <MasterDataPill tone={mapReadinessTone(batch.readiness ?? batch.batchStatus)}>
                    {formatMasterDataState(batch.readiness ?? batch.batchStatus, t)}
                  </MasterDataPill>
                </TableCell>
                <TableCell className="tw:max-w-64 tw:truncate">{batch.fileReference ?? t('adminMasterData.noFileReference')}</TableCell>
                <TableCell>
                  <div className="tw:flex tw:justify-end">
                    <Button asChild size="sm" variant="outline">
                      <Link to={'/admin/master-data/' + batch.batchId}>
                        {t('adminMasterData.openEvidence')}
                        <ArrowRight aria-hidden="true" />
                      </Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
    </AdminSurfaceSection>
  )
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
          ...(nextPersonnel.externalEmployeeRef
            ? { externalEmployeeRef: nextPersonnel.externalEmployeeRef }
            : {}),
          employmentStatus: normalizePersonnelStatus(nextPersonnel.employmentStatus),
          employmentType: normalizeEmploymentType(nextPersonnel.employmentType),
          hireDate: nextPersonnel.hireDate,
          storeId: nextPersonnel.storeId,
          positionId: nextPersonnel.positionId,
          ...(nextPersonnel.assignmentStartDate
            ? { assignmentStartDate: nextPersonnel.assignmentStartDate }
            : {}),
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
    <AdminSurfaceSection
      ariaLabel={t('adminMasterData.storeTabAria')}
      eyebrow={t('adminMasterData.tabStores')}
      title={t('adminMasterData.storePanelTitle')}
      description={t('adminMasterData.storePanelCopy')}
      actions={
        <AdminFilterBar className="tw:w-full tw:md:w-auto">
          <label className="tw:flex tw:min-w-56 tw:flex-1 tw:items-center tw:gap-2">
            <Search aria-hidden="true" />
            <span className="sr-only">{t('adminMasterData.searchStores')}</span>
            <Input
              value={input.search}
              onChange={(event) => input.onSearchChange(event.target.value)}
              placeholder={t('adminMasterData.searchStoreOrManager')}
            />
          </label>
          <select
            aria-label={t('adminMasterData.filterStoreImportScope')}
            className={nativeSelectClass()}
            value={input.enabledFilter}
            onChange={(event) => input.onEnabledFilterChange(event.target.value as StoreMasterEnabledFilter)}
          >
            <option value="all">{t('adminMasterData.allStores')}</option>
            <option value="enabled">{t('adminMasterData.included')}</option>
            <option value="disabled">{t('adminMasterData.excluded')}</option>
          </select>
          <select
            aria-label={t('adminMasterData.filterStoreStatus')}
            className={nativeSelectClass()}
            value={input.statusFilter}
            onChange={(event) => input.onStatusFilterChange(event.target.value as StoreMasterStatusFilter)}
          >
            <option value="all">{t('adminMasterData.allStatuses')}</option>
            <option value="active">{t('adminMasterData.storeStatus.active')}</option>
            <option value="inactive">{t('adminMasterData.storeStatus.inactive')}</option>
            <option value="closed">{t('adminMasterData.storeStatus.closed')}</option>
          </select>
        </AdminFilterBar>
      }
    >
      {input.feedback ? <AdminStatePanel title={input.feedback} tone="accent" /> : null}
      {input.isLoading ? (
        <AdminStatePanel isLoading title={t('adminMasterData.loadingStoreMaster')} />
      ) : input.isError ? (
        <AdminStatePanel title={t('adminMasterData.errorTitle')} description={getErrorMessage(input.error)} tone="danger" />
      ) : input.items.length === 0 ? (
        <AdminSurfaceEmpty title={t('adminMasterData.noStoresTitle')} copy={t('adminMasterData.noStoresCopy')} />
      ) : (
        <>
          <MasterDataBulkSaveBar
            disabled={input.pendingCount === 0 || input.isSaving}
            isSaving={input.isSaving}
            pendingCount={input.pendingCount}
            t={t}
            onSave={input.onSave}
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('adminMasterData.store')}</TableHead>
                <TableHead>{t('adminMasterData.type')}</TableHead>
                <TableHead>{t('adminMasterData.regionalManager')}</TableHead>
                <TableHead>{t('adminMasterData.status')}</TableHead>
                <TableHead>{t('adminMasterData.kpiImport')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {input.items.map((store) => {
                const effectiveStore = input.getEffectiveStore(store)
                const saving = input.savingStoreIds.has(store.storeId)

                return (
                  <TableRow key={store.storeId}>
                    <TableCell>
                      <div className="tw:grid tw:gap-1">
                        <strong className="tw:text-sm tw:font-medium">{store.storeName}</strong>
                        <span className="tw:text-xs tw:text-muted-foreground">{store.storeCode}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <select
                        aria-label={t('adminMasterData.storeTypeAria', { storeName: store.storeName })}
                        className={nativeSelectClass()}
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
                    </TableCell>
                    <TableCell>
                      <select
                        aria-label={t('adminMasterData.storeRegionalManagerAria', { storeName: store.storeName })}
                        className={nativeSelectClass()}
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
                    </TableCell>
                    <TableCell>
                      <select
                        aria-label={t('adminMasterData.storeStatusAria', { storeName: store.storeName })}
                        className={nativeSelectClass()}
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
                    </TableCell>
                    <TableCell>
                      <label className="tw:flex tw:items-center tw:gap-2 tw:text-sm">
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
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          <MasterDataPager
            offset={input.offset}
            total={input.total}
            onPrevious={input.onPreviousPage}
            onNext={input.onNextPage}
          />
        </>
      )}
    </AdminSurfaceSection>
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
    <AdminSurfaceSection
      ariaLabel={t('adminMasterData.personnelTabAria')}
      eyebrow={t('adminMasterData.tabPersonnel')}
      title={t('adminMasterData.personnelPanelTitle')}
      description={t('adminMasterData.personnelPanelCopy')}
      actions={
        <AdminFilterBar className="tw:w-full tw:md:w-auto">
          <label className="tw:flex tw:min-w-56 tw:flex-1 tw:items-center tw:gap-2">
            <Search aria-hidden="true" />
            <span className="sr-only">{t('adminMasterData.searchPersonnel')}</span>
            <Input
              value={input.search}
              onChange={(event) => input.onSearchChange(event.target.value)}
              placeholder={t('adminMasterData.searchPersonnelPlaceholder')}
            />
          </label>
          <select
            aria-label={t('adminMasterData.filterPersonnelStatus')}
            className={nativeSelectClass()}
            value={input.statusFilter}
            onChange={(event) => input.onStatusFilterChange(event.target.value as PersonnelStatusFilter)}
          >
            <option value="all">{t('adminMasterData.allStatuses')}</option>
            <option value="active">{t('adminMasterData.employmentStatus.active')}</option>
            <option value="inactive">{t('adminMasterData.employmentStatus.inactive')}</option>
            <option value="terminated">{t('adminMasterData.employmentStatus.terminated')}</option>
          </select>
          <select
            aria-label={t('adminMasterData.filterPersonnelStore')}
            className={nativeSelectClass()}
            value={input.storeFilter}
            onChange={(event) => input.onStoreFilterChange(event.target.value)}
          >
            <option value="all">{t('adminMasterData.allStores')}</option>
            {input.lookups?.stores.map((store) => (
              <option key={store.storeId} value={store.storeId}>
                {store.storeName}
              </option>
            ))}
          </select>
        </AdminFilterBar>
      }
    >
      {input.feedback ? <AdminStatePanel title={input.feedback} tone="accent" /> : null}
      {input.isLoading ? (
        <AdminStatePanel isLoading title={t('adminMasterData.loadingPersonnelMaster')} />
      ) : input.isError ? (
        <AdminStatePanel title={t('adminMasterData.errorTitle')} description={getErrorMessage(input.error)} tone="danger" />
      ) : input.items.length === 0 ? (
        <AdminSurfaceEmpty title={t('adminMasterData.noPersonnelTitle')} copy={t('adminMasterData.noPersonnelCopy')} />
      ) : (
        <>
          <MasterDataBulkSaveBar
            disabled={input.pendingCount === 0 || input.isSaving}
            isSaving={input.isSaving}
            pendingCount={input.pendingCount}
            t={t}
            onSave={input.onSave}
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('adminMasterData.employee')}</TableHead>
                <TableHead>{t('adminMasterData.sellerCode')}</TableHead>
                <TableHead>{t('adminMasterData.store')}</TableHead>
                <TableHead>{t('adminMasterData.position')}</TableHead>
                <TableHead>{t('adminMasterData.employment')}</TableHead>
                <TableHead>{t('adminMasterData.assignmentStart')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {input.items.map((personnel) => {
                const effectivePersonnel = input.getEffectivePersonnel(personnel)
                const saving = input.savingPersonnelIds.has(personnel.employeeId)
                const personnelName = getPersonnelMasterRowLabel(personnel)

                return (
                  <TableRow key={personnel.employeeId}>
                    <TableCell>
                      <div className="tw:grid tw:min-w-44 tw:grid-cols-1 tw:gap-2 tw:lg:grid-cols-2">
                        <Input
                          aria-label={t('adminMasterData.personnelFirstNameAria', { personnelName })}
                          disabled={saving}
                          value={effectivePersonnel.firstName}
                          onChange={(event) =>
                            input.onUpdateDraft(personnel.employeeId, { firstName: event.target.value })
                          }
                        />
                        <Input
                          aria-label={t('adminMasterData.personnelLastNameAria', { personnelName })}
                          disabled={saving}
                          value={effectivePersonnel.lastName}
                          onChange={(event) =>
                            input.onUpdateDraft(personnel.employeeId, { lastName: event.target.value })
                          }
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input
                        aria-label={t('adminMasterData.personnelSellerCodeAria', { personnelName })}
                        className="tw:min-w-36"
                        disabled={saving}
                        value={effectivePersonnel.externalEmployeeRef}
                        onChange={(event) =>
                          input.onUpdateDraft(personnel.employeeId, {
                            externalEmployeeRef: event.target.value,
                          })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <select
                        aria-label={t('adminMasterData.personnelStoreAria', { personnelName })}
                        className={nativeSelectClass('tw:min-w-44')}
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
                    </TableCell>
                    <TableCell>
                      <select
                        aria-label={t('adminMasterData.personnelPositionAria', { personnelName })}
                        className={nativeSelectClass('tw:min-w-44')}
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
                    </TableCell>
                    <TableCell>
                      <div className="tw:grid tw:min-w-44 tw:grid-cols-1 tw:gap-2">
                        <select
                          aria-label={t('adminMasterData.personnelEmploymentStatusAria', { personnelName })}
                          className={nativeSelectClass()}
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
                          aria-label={t('adminMasterData.personnelEmploymentTypeAria', { personnelName })}
                          className={nativeSelectClass()}
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
                    </TableCell>
                    <TableCell>
                      <div className="tw:grid tw:min-w-44 tw:grid-cols-1 tw:gap-2">
                        <Input
                          aria-label={t('adminMasterData.personnelHireDateAria', { personnelName })}
                          disabled={saving}
                          type="date"
                          value={dateInputValue(effectivePersonnel.hireDate)}
                          onChange={(event) =>
                            input.onUpdateDraft(personnel.employeeId, { hireDate: event.target.value })
                          }
                        />
                        <Input
                          aria-label={t('adminMasterData.personnelAssignmentStartAria', { personnelName })}
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
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          <MasterDataPager
            offset={input.offset}
            total={input.total}
            onPrevious={input.onPreviousPage}
            onNext={input.onNextPage}
          />
        </>
      )}
    </AdminSurfaceSection>
  )
}


function getPersonnelMasterRowLabel(personnel: PersonnelMasterItem) {
  const displayName = personnel.displayName.trim()
  if (displayName) {
    return displayName
  }

  const fullName = [personnel.firstName, personnel.lastName].filter(Boolean).join(' ').trim()
  return fullName || personnel.externalEmployeeRef || personnel.employeeId
}

function MasterDataHistoryPanel(input: { t: TranslateFunction }) {
  const { t } = input

  return (
    <AdminSurfaceSection
      ariaLabel={t('adminMasterData.historyTabAria')}
      eyebrow={t('adminMasterData.tabHistory')}
      title={t('adminMasterData.historyPanelTitle')}
      description={t('adminMasterData.historyPanelCopy')}
    >
      <div className="tw:grid tw:gap-2">
        <MasterDataHistoryRow label={t('adminMasterData.historyStoreEvent')} eventType="store_master_data.updated" />
        <MasterDataHistoryRow label={t('adminMasterData.historyPersonnelEvent')} eventType="personnel_master_data.updated" />
        <MasterDataHistoryRow label={t('adminMasterData.historyBootstrapEvent')} eventType="master_data_bootstrap.promoted" />
      </div>
    </AdminSurfaceSection>
  )
}

function MasterDataPill(input: { children: ReactNode; tone?: 'accent' | 'calm' | 'warning' | 'danger' | 'neutral' }) {
  return <AdminSurfaceBadge tone={toMasterDataSurfaceTone(input.tone)}>{input.children}</AdminSurfaceBadge>
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
    <AdminActionRow className="tw:justify-between">
      <AdminSurfaceBadge tone="neutral">
        {formatNumber(from)}-{formatNumber(to)} / {formatNumber(input.total)}
      </AdminSurfaceBadge>
      <AdminActionRow>
        <Button type="button" variant="outline" disabled={input.offset === 0} onClick={input.onPrevious}>
          {t('adminIntegrations.previous')}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={input.offset + PAGE_SIZE >= input.total}
          onClick={input.onNext}
        >
          {t('adminIntegrations.next')}
        </Button>
      </AdminActionRow>
    </AdminActionRow>
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
    <AdminStatePanel
      title={input.t('adminMasterData.pendingChanges', { count: input.pendingCount })}
      tone={input.pendingCount > 0 ? 'warning' : 'neutral'}
      action={
        <Button disabled={input.disabled} type="button" onClick={input.onSave}>
          <Save aria-hidden="true" />
          {input.isSaving ? input.t('adminMasterData.saving') : input.t('adminMasterData.saveChanges')}
        </Button>
      }
    />
  )
}

function MasterDataHistoryRow(input: { label: string; eventType: string }) {
  return (
    <div className="tw:flex tw:flex-col tw:gap-2 tw:rounded-lg tw:border tw:border-border tw:bg-background/60 tw:p-3 tw:sm:flex-row tw:sm:items-center tw:sm:justify-between">
      <div className="tw:grid tw:gap-1">
        <span className="tw:text-xs tw:font-medium tw:text-muted-foreground">Audit</span>
        <strong className="tw:text-sm tw:font-medium">{input.label}</strong>
      </div>
      <MasterDataPill tone="accent">{input.eventType}</MasterDataPill>
    </div>
  )
}

function nativeSelectClass(className = '') {
  return [
    'tw:h-8 tw:min-w-40 tw:rounded-lg tw:border tw:border-input tw:bg-background tw:px-2.5 tw:text-sm tw:text-foreground tw:outline-none tw:transition-colors tw:focus-visible:border-ring tw:focus-visible:ring-3 tw:focus-visible:ring-ring/50 tw:disabled:cursor-not-allowed tw:disabled:opacity-50',
    className,
  ]
    .filter(Boolean)
    .join(' ')
}

function toMasterDataSurfaceTone(input?: 'accent' | 'calm' | 'warning' | 'danger' | 'neutral'): AdminSurfaceTone {
  if (input === 'calm') return 'success'
  if (input === 'accent') return 'accent'
  if (input === 'warning') return 'warning'
  if (input === 'danger') return 'danger'
  return 'neutral'
}
