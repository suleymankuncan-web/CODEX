import { useDeferredValue, useMemo, useReducer } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  DatabaseZap,
  FileJson,
  FileSpreadsheet,
  RefreshCw,
  Search,
  ShieldCheck,
  Store,
  UploadCloud,
} from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { downloadCsv } from '../lib/download-csv'
import { createIntegrationPeriodDefaults } from './business-date-defaults'
import {
  IntegrationEvidenceValue,
  IntegrationField,
  IntegrationSelect,
  IntegrationUploadDrop,
  UploadSummaryGrid,
} from '../features/integrations/integration-dashboard-surface-controls'
import type {
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
} from '../features/integrations/integration-dashboard-surface-types'
import { toAdminTone } from '../features/integrations/integration-surface-tone'
import { IntegrationLifecycleStrip } from './integration-lifecycle-strip'
import {
  createImportBatch,
  getImportOverview,
  getIntegrationLookups,
  getNeedsAction,
  getImportPayloadTemplate,
  type ImportOverview,
  type NeedsActionItem,
  retryImportBatch,
  uploadPowerBiExport,
} from '../features/integrations/api'
import type { TranslateFunction } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import { actionToast } from '../lib/action-toast'
import { formatState, getErrorMessage, mapHealthTone } from '../lib/format'
import {
  AdminActionRow,
  AdminKeyValue,
  AdminKeyValueGrid,
  AdminStatePanel,
  AdminSurfaceBadge,
  AdminSurfaceEmpty,
  AdminSurfacePage,
  AdminSurfaceSection,
  type AdminMetricStripItem,
} from './admin-surface-primitives'
import { AdminOperationalHeader, AdminOperationalMetrics, AdminOperationalPage } from './admin-operational-primitives'

const PAGE_SIZE = 12
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
      return { ...state, search: action.value }
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

export function IntegrationDashboardPage() {
  const { t } = useLocalization()
  const [pageState, dispatchPageState] = useReducer(
    integrationDashboardReducer,
    undefined,
    createInitialIntegrationDashboardState,
  )
  const {
    activeTab,
    search,
    sortBy,
    offset,
    entityTypeFilter,
    statusFilter,
    createdBatchId,
    uploadedBatchId,
    templateSourceSystem,
    selectedTemplateSourceCode,
    powerBiSourceCode,
    powerBiPeriodType,
    powerBiPeriodMonth,
    powerBiPeriodStart,
    powerBiPeriodEnd,
    personnelFile,
    storeFile,
  } = pageState
  const deferredSearch = useDeferredValue(search)
  const queryClient = useQueryClient()

  const overviewQuery = useQuery({
    queryKey: ['integration-overview'],
    queryFn: getImportOverview,
    staleTime: 30_000,
  })
  const needsActionQuery = useQuery({
    queryKey: ['integration-needs-action', offset, entityTypeFilter, statusFilter],
    queryFn: () =>
      getNeedsAction({
        limit: PAGE_SIZE,
        offset,
        ...(entityTypeFilter ? { entityType: entityTypeFilter } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      }),
    staleTime: 30_000,
  })
  const importTemplateQuery = useQuery({
    queryKey: ['integration-import-template', templateSourceSystem],
    queryFn: () =>
      getImportPayloadTemplate({
        entityType: 'kpi',
        sourceSystem: templateSourceSystem,
      }),
    staleTime: 30_000,
  })
  const lookupsQuery = useQuery({
    queryKey: ['integration-lookups'],
    queryFn: getIntegrationLookups,
    staleTime: 30_000,
  })
  const retryMutation = useMutation({
    mutationFn: retryImportBatch,
    onSuccess: async (response) => {
      actionToast.success(response.command.message)
      dispatchPageState({ type: 'retrySucceeded' })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['integration-needs-action'] }),
        queryClient.invalidateQueries({ queryKey: ['integration-overview'] }),
      ])
    },
    onError: (error) => actionToast.error(error, 'Tekrar deneme başlatılamadı.'),
  })
  const createBatchMutation = useMutation({
    mutationFn: createImportBatch,
    onSuccess: async (response) => {
      actionToast.success(response.command.message)
      dispatchPageState({
        type: 'batchCreated',
        batchId: response.data.batch.batchId,
      })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['integration-needs-action'] }),
        queryClient.invalidateQueries({ queryKey: ['integration-overview'] }),
      ])
    },
    onError: (error) => actionToast.error(error, 'Aktarım partisi oluşturulamadı.'),
  })
  const uploadPowerBiMutation = useMutation({
    mutationFn: uploadPowerBiExport,
    onSuccess: async (response) => {
      actionToast.success(response.command.message)
      dispatchPageState({
        type: 'uploadSucceeded',
        batchId: response.data.batch.batchId,
      })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['integration-needs-action'] }),
        queryClient.invalidateQueries({ queryKey: ['integration-overview'] }),
      ])
    },
    onError: (error) => {
      actionToast.error(error, 'Dosya yüklenemedi.')
      dispatchPageState({ type: 'uploadFailed' })
    },
  })

  const compatibleSources = useMemo(() => {
    return (lookupsQuery.data?.activeSources ?? []).filter(
      (item) => item.entityType === 'kpi' && item.sourceSystem === templateSourceSystem,
    )
  }, [lookupsQuery.data?.activeSources, templateSourceSystem])
  const powerBiSources = useMemo(() => {
    return (lookupsQuery.data?.activeSources ?? []).filter(
      (item) => item.entityType === 'kpi' && item.sourceSystem === 'power_bi',
    )
  }, [lookupsQuery.data?.activeSources])

  const resolvedTemplateSourceCode =
    selectedTemplateSourceCode || compatibleSources[0]?.sourceCode || ''
  const resolvedPowerBiSourceCode = powerBiSourceCode || powerBiSources[0]?.sourceCode || ''

  const submitSampleImport = () => {
    if (!resolvedTemplateSourceCode || !importTemplateQuery.data) {
      return
    }

    const timestamp = new Date().toISOString()
    const requestBody = importTemplateQuery.data.requestBody
    createBatchMutation.mutate({
      sourceCode: resolvedTemplateSourceCode,
      entityType: String(requestBody.entityType ?? 'kpi'),
      fileReference: `sample-${templateSourceSystem}-${timestamp}.json`,
      sourceBatchId: `${resolvedTemplateSourceCode}-${timestamp}`,
      sourceCapturedAt: String(requestBody.sourceCapturedAt ?? timestamp),
      sourceWindowStartedAt: String(requestBody.sourceWindowStartedAt ?? timestamp),
      sourceWindowEndedAt: String(requestBody.sourceWindowEndedAt ?? timestamp),
      rows: Array.isArray(requestBody.rows)
        ? (requestBody.rows as Record<string, unknown>[])
        : [],
    })
  }

  const filteredItems = useMemo(() => {
    const input = deferredSearch.trim().toLowerCase()
    const items = needsActionQuery.data?.items ?? []

    if (!input) {
      return items
    }

    return items.filter((item) =>
      [
        item.batchId,
        item.sourceCode,
        item.sourceName,
        item.entityType,
        item.healthState,
        item.actionReason,
      ]
        .join(' ')
        .toLowerCase()
        .includes(input),
    )
  }, [deferredSearch, needsActionQuery.data?.items])

  const sortedItems = useMemo(() => {
    const items = [...filteredItems]
    if (sortBy === 'errors') {
      return items.sort((left, right) => right.errorCount - left.errorCount)
    }
    if (sortBy === 'records') {
      return items.sort((left, right) => right.recordCount - left.recordCount)
    }
    if (sortBy === 'entity') {
      return items.sort((left, right) => left.entityType.localeCompare(right.entityType))
    }

    const priority = (state: string) => {
      if (state === 'stuck') return 4
      if (state === 'needs_action') return 3
      if (state === 'blocked') return 2
      if (state === 'retry_ready') return 1
      return 0
    }

    return items.sort((left, right) => priority(right.healthState) - priority(left.healthState))
  }, [filteredItems, sortBy])

  if (overviewQuery.isLoading || needsActionQuery.isLoading || lookupsQuery.isLoading) {
    return (
      <AdminSurfacePage>
        <AdminStatePanel
          title={t('adminIntegrations.loadingTitle')}
          description={t('adminIntegrations.loadingCopy')}
          isLoading
        />
      </AdminSurfacePage>
    )
  }

  if (overviewQuery.isError) {
    return (
      <AdminSurfacePage>
        <AdminStatePanel
          title={t('adminIntegrations.dashboardUnavailableTitle')}
          description={getErrorMessage(overviewQuery.error)}
          tone="danger"
        />
      </AdminSurfacePage>
    )
  }

  if (needsActionQuery.isError) {
    return (
      <AdminSurfacePage>
        <AdminStatePanel
          title={t('adminIntegrations.needsActionUnavailableTitle')}
          description={getErrorMessage(needsActionQuery.error)}
          tone="danger"
        />
      </AdminSurfacePage>
    )
  }

  if (lookupsQuery.isError) {
    return (
      <AdminSurfacePage>
        <AdminStatePanel
          title={t('adminIntegrations.lookupsUnavailableTitle')}
          description={getErrorMessage(lookupsQuery.error)}
          tone="danger"
        />
      </AdminSurfacePage>
    )
  }

  const overview = overviewQuery.data
  if (!overview) {
    return (
      <AdminSurfacePage>
        <AdminStatePanel
          title={t('adminIntegrations.overviewUnavailableTitle')}
          description={t('adminIntegrations.overviewUnavailableCopy')}
          tone="danger"
        />
      </AdminSurfacePage>
    )
  }

  const meta = needsActionQuery.data?.meta
  const canGoBack = offset > 0
  const canGoForward = meta ? offset + PAGE_SIZE < meta.total : false
  const isPowerBiPeriodValid =
    powerBiPeriodType === 'monthly'
      ? Boolean(powerBiPeriodMonth)
      : Boolean(powerBiPeriodStart && powerBiPeriodEnd && powerBiPeriodEnd >= powerBiPeriodStart)
  const powerBiUploadBlockers = [
    powerBiSources.length === 0 ? t('adminIntegrations.noPowerBiSource') : null,
    !personnelFile && !storeFile ? t('adminIntegrations.choosePersonnelOrStoreFile') : null,
    powerBiSources.length > 0 && !resolvedPowerBiSourceCode
      ? t('adminIntegrations.choosePowerBiSource')
      : null,
    !isPowerBiPeriodValid ? t('adminIntegrations.invalidPeriod') : null,
  ].filter((item): item is string => Boolean(item))
  const isPowerBiUploadDisabled =
    uploadPowerBiMutation.isPending || powerBiUploadBlockers.length > 0
  const actionCount = overview.healthTotals.blocked + overview.healthTotals.needsAction + overview.healthTotals.stuck
  const evidenceState = overview.latest.completedBatchId ? t('adminIntegrations.ready') : t('adminIntegrations.waiting')

  return (
    <IntegrationDashboardLoadedContent
      activeTab={activeTab}
      actionCount={actionCount}
      canGoBack={canGoBack}
      canGoForward={canGoForward}
      compatibleSources={compatibleSources}
      createBatchMutation={createBatchMutation}
      createdBatchId={createdBatchId}
      dispatchPageState={dispatchPageState}
      entityTypeFilter={entityTypeFilter}
      evidenceState={evidenceState}
      importTemplateQuery={importTemplateQuery}
      isPowerBiUploadDisabled={isPowerBiUploadDisabled}
      meta={meta}
      offset={offset}
      overview={overview}
      personnelFile={personnelFile}
      powerBiPeriodEnd={powerBiPeriodEnd}
      powerBiPeriodMonth={powerBiPeriodMonth}
      powerBiPeriodStart={powerBiPeriodStart}
      powerBiPeriodType={powerBiPeriodType}
      powerBiSources={powerBiSources}
      powerBiUploadBlockers={powerBiUploadBlockers}
      resolvedPowerBiSourceCode={resolvedPowerBiSourceCode}
      resolvedTemplateSourceCode={resolvedTemplateSourceCode}
      retryMutation={retryMutation}
      search={search}
      sortBy={sortBy}
      sortedItems={sortedItems}
      statusFilter={statusFilter}
      storeFile={storeFile}
      submitSampleImport={submitSampleImport}
      t={t}
      templateSourceSystem={templateSourceSystem}
      uploadedBatchId={uploadedBatchId}
      uploadPowerBiMutation={uploadPowerBiMutation}
    />
  )
}

type IntegrationDashboardLoadedContentProps = {
  activeTab: IntegrationTab
  actionCount: number
  canGoBack: boolean
  canGoForward: boolean
  compatibleSources: IntegrationSource[]
  createBatchMutation: CreateBatchMutationState
  createdBatchId: string | null
  dispatchPageState: IntegrationDispatch
  entityTypeFilter: string
  evidenceState: string
  importTemplateQuery: ImportTemplateQueryState
  isPowerBiUploadDisabled: boolean
  meta: IntegrationListMeta | undefined
  offset: number
  overview: ImportOverview
  personnelFile: File | null
  powerBiPeriodEnd: string
  powerBiPeriodMonth: string
  powerBiPeriodStart: string
  powerBiPeriodType: PowerBiPeriodType
  powerBiSources: IntegrationSource[]
  powerBiUploadBlockers: string[]
  resolvedPowerBiSourceCode: string
  resolvedTemplateSourceCode: string
  retryMutation: RetryMutationState
  search: string
  sortBy: IntegrationSortValue
  sortedItems: NeedsActionItem[]
  statusFilter: string
  storeFile: File | null
  submitSampleImport: () => void
  t: TranslateFunction
  templateSourceSystem: IntegrationTemplateSourceSystem
  uploadedBatchId: string | null
  uploadPowerBiMutation: PowerBiUploadMutationState
}

function IntegrationDashboardLoadedContent(input: IntegrationDashboardLoadedContentProps) {
  const {
    activeTab,
    actionCount,
    canGoBack,
    canGoForward,
    compatibleSources,
    createBatchMutation,
    createdBatchId,
    dispatchPageState,
    entityTypeFilter,
    evidenceState,
    importTemplateQuery,
    isPowerBiUploadDisabled,
    meta,
    offset,
    overview,
    personnelFile,
    powerBiPeriodEnd,
    powerBiPeriodMonth,
    powerBiPeriodStart,
    powerBiPeriodType,
    powerBiSources,
    powerBiUploadBlockers,
    resolvedPowerBiSourceCode,
    resolvedTemplateSourceCode,
    retryMutation,
    search,
    sortBy,
    sortedItems,
    statusFilter,
    storeFile,
    submitSampleImport,
    t,
    templateSourceSystem,
    uploadedBatchId,
    uploadPowerBiMutation,
  } = input

  const tabs: IntegrationTabOption[] = [
    { id: 'uploads', label: t('adminIntegrations.tabUploads') },
    { id: 'evidence', label: t('adminIntegrations.tabEvidence') },
    { id: 'errors', label: t('adminIntegrations.tabErrors'), count: actionCount },
  ]
  const metricItems: AdminMetricStripItem[] = [
    {
      id: 'status',
      label: t('adminIntegrations.status'),
      value: actionCount === 0 ? t('adminIntegrations.controlled') : t('adminIntegrations.needsReview'),
      description:
        actionCount === 0
          ? t('adminIntegrations.noCriticalBlock')
          : t('adminIntegrations.actionCount', { count: actionCount }),
      tone: actionCount === 0 ? 'success' : 'warning',
    },
    {
      id: 'healthy',
      label: t('adminIntegrations.healthy'),
      value: formatNumber(overview.healthTotals.healthy),
      description: t('adminIntegrations.healthyNote', { count: overview.totals.completed }),
      icon: <CheckCircle2 size={18} />,
      tone: 'success',
    },
    {
      id: 'needs-action',
      label: t('adminIntegrations.needsAction'),
      value: formatNumber(actionCount),
      description: t('adminIntegrations.actionSummaryNote'),
      icon: <AlertTriangle size={18} />,
      tone: actionCount === 0 ? 'neutral' : 'danger',
    },
    {
      id: 'retry-ready',
      label: t('adminIntegrations.retryReady'),
      value: formatNumber(overview.healthTotals.retryReady),
      description: t('adminIntegrations.retryReadyNote'),
      icon: <RefreshCw size={18} />,
      tone: overview.healthTotals.retryReady > 0 ? 'warning' : 'neutral',
    },
    {
      id: 'evidence',
      label: t('adminIntegrations.evidence'),
      value: evidenceState,
      description: formatOptionalBatch(overview.latest.completedBatchId, t),
      icon: <ShieldCheck size={18} />,
      tone: overview.latest.completedBatchId ? 'cyan' : 'neutral',
    },
  ]

  return (
    <AdminOperationalPage ariaLabel={t('adminIntegrations.heroEyebrow')}>
      <AdminOperationalHeader
        eyebrow={t('adminIntegrations.heroEyebrow')}
        title={t('adminIntegrations.title')}
        description={t('adminIntegrations.heroCopy')}
        icon={<DatabaseZap size={18} />}
        meta={
          <>
            <AdminSurfaceBadge tone="neutral">
              {t('adminIntegrations.totalBatches')}: {formatNumber(overview.totals.all)}
            </AdminSurfaceBadge>
            <AdminSurfaceBadge tone={actionCount === 0 ? 'success' : 'warning'}>
              {actionCount === 0
                ? t('adminIntegrations.controlled')
                : t('adminIntegrations.needsReview')}
            </AdminSurfaceBadge>
          </>
        }
        actions={
          <Button
            type="button"
            onClick={() => dispatchPageState({ type: 'setActiveTab', value: 'uploads' })}
          >
            <UploadCloud aria-hidden="true" />
            {t('adminIntegrations.newUpload')}
          </Button>
        }
      />

      <AdminOperationalMetrics
        className="tw:xl:grid-cols-5"
        items={metricItems}
      />

      <IntegrationLifecycleStrip actionCount={actionCount} overview={overview} primaryItem={sortedItems[0]} t={t} onOpenIssues={() => dispatchPageState({ type: 'setActiveTab', value: 'errors' })} />
      {(createdBatchId || uploadedBatchId) ? (
        <div className="tw:grid tw:grid-cols-1 tw:gap-3 tw:lg:grid-cols-2">
          {createdBatchId ? (
            <Button asChild variant="outline">
              <Link to={`/admin/integrations/${createdBatchId}`}>
                {t('adminIntegrations.openBatchDetail')}
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          ) : null}
          {uploadedBatchId ? (
            <Button asChild variant="outline">
              <Link to={`/admin/integrations/${uploadedBatchId}`}>
                {t('adminIntegrations.openBatchDetail')}
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          ) : null}
        </div>
      ) : null}

      <AdminActionRow
        className="tw:rounded-xl tw:border tw:border-border tw:bg-card/80 tw:p-2 tw:shadow-sm"
      >
        {tabs.map((tab) => (
          <Button
            aria-pressed={activeTab === tab.id}
            key={tab.id}
            variant={activeTab === tab.id ? 'default' : 'outline'}
            type="button"
            onClick={() => dispatchPageState({ type: 'setActiveTab', value: tab.id })}
          >
            <span>{tab.label}</span>
            {typeof tab.count === 'number' ? (
              <AdminSurfaceBadge tone={tab.count > 0 ? 'warning' : 'neutral'}>
                {formatNumber(tab.count)}
              </AdminSurfaceBadge>
            ) : null}
          </Button>
        ))}
      </AdminActionRow>

      {activeTab === 'uploads' ? (
        <IntegrationUploadsPanel
          dispatchPageState={dispatchPageState}
          isPowerBiUploadDisabled={isPowerBiUploadDisabled}
          overview={overview}
          personnelFile={personnelFile}
          powerBiPeriodEnd={powerBiPeriodEnd}
          powerBiPeriodMonth={powerBiPeriodMonth}
          powerBiPeriodStart={powerBiPeriodStart}
          powerBiPeriodType={powerBiPeriodType}
          powerBiSources={powerBiSources}
          powerBiUploadBlockers={powerBiUploadBlockers}
          resolvedPowerBiSourceCode={resolvedPowerBiSourceCode}
          storeFile={storeFile}
          t={t}
          uploadPowerBiMutation={uploadPowerBiMutation}
        />
      ) : null}

      {activeTab === 'evidence' ? (
        <IntegrationEvidencePanel
          compatibleSources={compatibleSources}
          createBatchMutation={createBatchMutation}
          createdBatchId={createdBatchId}
          dispatchPageState={dispatchPageState}
          evidenceState={evidenceState}
          importTemplateQuery={importTemplateQuery}
          overview={overview}
          resolvedTemplateSourceCode={resolvedTemplateSourceCode}
          submitSampleImport={submitSampleImport}
          t={t}
          templateSourceSystem={templateSourceSystem}
        />
      ) : null}

      {activeTab === 'errors' ? (
        <IntegrationErrorsPanel
          canGoBack={canGoBack}
          canGoForward={canGoForward}
          dispatchPageState={dispatchPageState}
          entityTypeFilter={entityTypeFilter}
          meta={meta}
          offset={offset}
          retryMutation={retryMutation}
          search={search}
          sortBy={sortBy}
          sortedItems={sortedItems}
          statusFilter={statusFilter}
          t={t}
        />
      ) : null}
    </AdminOperationalPage>
  )
}

type IntegrationUploadsPanelProps = {
  dispatchPageState: IntegrationDispatch
  isPowerBiUploadDisabled: boolean
  overview: ImportOverview
  personnelFile: File | null
  powerBiPeriodEnd: string
  powerBiPeriodMonth: string
  powerBiPeriodStart: string
  powerBiPeriodType: PowerBiPeriodType
  powerBiSources: IntegrationSource[]
  powerBiUploadBlockers: string[]
  resolvedPowerBiSourceCode: string
  storeFile: File | null
  t: TranslateFunction
  uploadPowerBiMutation: PowerBiUploadMutationState
}

function IntegrationUploadsPanel(input: IntegrationUploadsPanelProps) {
  const {
    dispatchPageState,
    isPowerBiUploadDisabled,
    overview,
    personnelFile,
    powerBiPeriodEnd,
    powerBiPeriodMonth,
    powerBiPeriodStart,
    powerBiPeriodType,
    powerBiSources,
    powerBiUploadBlockers,
    resolvedPowerBiSourceCode,
    storeFile,
    t,
    uploadPowerBiMutation,
  } = input

  return (
    <AdminSurfaceSection
      ariaLabel={t('adminIntegrations.uploadsTabAria')}
      badge={
        <AdminSurfaceBadge tone={powerBiUploadBlockers.length === 0 ? 'success' : 'warning'}>
          {powerBiUploadBlockers.length === 0
            ? t('adminIntegrations.ready')
            : t('adminIntegrations.waiting')}
        </AdminSurfaceBadge>
      }
      description={t('adminIntegrations.uploadPanelCopy')}
      eyebrow={t('adminIntegrations.tabUploads')}
      title={t('adminIntegrations.uploadPanelTitle')}
    >
      <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:xl:grid-cols-[minmax(0,1.6fr)_minmax(20rem,0.8fr)]">
        <section className="tw:grid tw:gap-4">
          <div className="tw:flex tw:min-w-0 tw:gap-3 tw:rounded-lg tw:border tw:border-border tw:bg-background/60 tw:p-3">
            <span className="tw:grid tw:size-10 tw:shrink-0 tw:place-items-center tw:rounded-lg tw:bg-primary/10 tw:text-primary">
              <UploadCloud size={18} aria-hidden="true" />
            </span>
            <div className="tw:min-w-0">
              <h3 className="tw:m-0 tw:text-base tw:font-medium tw:text-foreground">
                {t('adminIntegrations.newUpload')}
              </h3>
              <p className="tw:mt-1 tw:text-sm tw:leading-6 tw:text-muted-foreground">
                {t('adminIntegrations.separateFilesCopy')}
              </p>
            </div>
          </div>

          <div className="tw:grid tw:grid-cols-1 tw:gap-3 tw:md:grid-cols-2">
            <IntegrationField label={t('adminIntegrations.powerBiKpiSource')}>
              <IntegrationSelect
                value={resolvedPowerBiSourceCode}
                onChange={(event) =>
                  dispatchPageState({
                    type: 'setPowerBiSourceCode',
                    value: event.target.value,
                  })
                }
                disabled={powerBiSources.length === 0}
              >
                {powerBiSources.length === 0 ? (
                  <option value="">{t('adminIntegrations.noActiveKpiSource')}</option>
                ) : null}
                {powerBiSources.map((item) => (
                  <option key={item.sourceId} value={item.sourceCode}>
                    {item.sourceCode} - {item.sourceName}
                  </option>
                ))}
              </IntegrationSelect>
            </IntegrationField>

            <IntegrationField label={t('adminIntegrations.periodType')}>
              <IntegrationSelect
                aria-label={t('adminIntegrations.periodType')}
                value={powerBiPeriodType}
                onChange={(event) =>
                  dispatchPageState({
                    type: 'setPowerBiPeriodType',
                    value: event.target.value as PowerBiPeriodType,
                  })
                }
              >
                <option value="monthly">{t('adminIntegrations.monthlySnapshot')}</option>
                <option value="daily">{t('adminIntegrations.dailyData')}</option>
                <option value="custom">{t('adminIntegrations.customDateRange')}</option>
              </IntegrationSelect>
            </IntegrationField>

            {powerBiPeriodType === 'monthly' ? (
              <IntegrationField label={t('adminIntegrations.periodMonth')}>
                <Input
                  type="month"
                  value={powerBiPeriodMonth}
                  onChange={(event) =>
                    dispatchPageState({
                      type: 'setPowerBiPeriodMonth',
                      value: event.target.value,
                    })
                  }
                />
              </IntegrationField>
            ) : (
              <>
                <IntegrationField label={t('adminIntegrations.start')}>
                  <Input
                    aria-label={t('adminIntegrations.start')}
                    type="date"
                    value={powerBiPeriodStart}
                    onChange={(event) =>
                      dispatchPageState({
                        type: 'setPowerBiPeriodStart',
                        value: event.target.value,
                        syncEnd: powerBiPeriodType === 'daily',
                      })
                    }
                  />
                </IntegrationField>
                <IntegrationField label={t('adminIntegrations.end')}>
                  <Input
                    aria-label={t('adminIntegrations.end')}
                    type="date"
                    value={powerBiPeriodType === 'daily' ? powerBiPeriodStart : powerBiPeriodEnd}
                    disabled={powerBiPeriodType === 'daily'}
                    onChange={(event) =>
                      dispatchPageState({
                        type: 'setPowerBiPeriodEnd',
                        value: event.target.value,
                      })
                    }
                  />
                </IntegrationField>
              </>
            )}
          </div>

          <div className="tw:grid tw:grid-cols-1 tw:gap-3 tw:md:grid-cols-2">
            <IntegrationUploadDrop
              icon={<FileSpreadsheet size={20} aria-hidden="true" />}
              title={t('adminIntegrations.personnelExport')}
              fileName={personnelFile?.name ?? t('adminIntegrations.noFileSelected')}
              onFileChange={(file) =>
                dispatchPageState({
                  type: 'setPersonnelFile',
                  value: file,
                })
              }
            />
            <IntegrationUploadDrop
              icon={<Store size={20} aria-hidden="true" />}
              title={t('adminIntegrations.storeExport')}
              fileName={storeFile?.name ?? t('adminIntegrations.noFileSelected')}
              onFileChange={(file) =>
                dispatchPageState({
                  type: 'setStoreFile',
                  value: file,
                })
              }
            />
          </div>

          <AdminActionRow>
            <Button
              type="button"
              disabled={isPowerBiUploadDisabled}
              onClick={() =>
                uploadPowerBiMutation.mutate({
                  sourceCode: resolvedPowerBiSourceCode,
                  periodType: powerBiPeriodType,
                  ...(powerBiPeriodType === 'monthly' && powerBiPeriodMonth
                    ? { periodMonth: powerBiPeriodMonth }
                    : {}),
                  ...(powerBiPeriodType !== 'monthly' && powerBiPeriodStart
                    ? { periodStart: powerBiPeriodStart }
                    : {}),
                  ...(powerBiPeriodType !== 'monthly'
                    ? {
                        periodEnd:
                          powerBiPeriodType === 'daily' ? powerBiPeriodStart : powerBiPeriodEnd,
                      }
                    : {}),
                  personnelFile,
                  storeFile,
                })
              }
            >
              {uploadPowerBiMutation.isPending
                ? t('adminIntegrations.uploading')
                : t('adminIntegrations.uploadPowerBiExport')}
            </Button>
          </AdminActionRow>

          {powerBiUploadBlockers.length > 0 ? (
            <AdminStatePanel
              title={t('adminIntegrations.powerBiNotReady')}
              description={powerBiUploadBlockers.join(' ')}
              tone="warning"
            />
          ) : (
            <AdminStatePanel
              title={t('adminIntegrations.powerBiReadyCopy')}
              tone="neutral"
            />
          )}
        </section>

        <aside
          className="tw:rounded-xl tw:border tw:border-border tw:bg-background/60 tw:p-4"
          aria-label={t('adminIntegrations.uploadDecisionTitle')}
        >
          <div className="tw:mb-3">
            <div className="tw:text-[0.7rem] tw:font-medium tw:tracking-[0.08em] tw:text-muted-foreground tw:uppercase">
              {t('adminIntegrations.uploadDecisionEyebrow')}
            </div>
            <h3 className="tw:mt-1 tw:text-base tw:font-medium tw:text-foreground">
              {t('adminIntegrations.uploadDecisionTitle')}
            </h3>
            <p className="tw:mt-1 tw:text-sm tw:leading-6 tw:text-muted-foreground">
              {t('adminIntegrations.uploadDecisionCopy')}
            </p>
          </div>
          <AdminKeyValueGrid className="tw:lg:grid-cols-1">
            <AdminKeyValue
              label={t('adminIntegrations.latestCompleted')}
              value={formatOptionalBatch(overview.latest.completedBatchId, t)}
            />
            <AdminKeyValue
              label={t('adminIntegrations.retryReady')}
              value={formatNumber(overview.healthTotals.retryReady)}
            />
            <AdminKeyValue
              label={t('adminIntegrations.blocked')}
              value={formatNumber(overview.healthTotals.blocked)}
            />
          </AdminKeyValueGrid>
        </aside>
      </div>

      {uploadPowerBiMutation.data?.data.summary ? (
        <UploadSummaryGrid summary={uploadPowerBiMutation.data.data.summary} t={t} />
      ) : null}
    </AdminSurfaceSection>
  )
}

type IntegrationEvidencePanelProps = {
  compatibleSources: IntegrationSource[]
  createBatchMutation: CreateBatchMutationState
  createdBatchId: string | null
  dispatchPageState: IntegrationDispatch
  evidenceState: string
  importTemplateQuery: ImportTemplateQueryState
  overview: ImportOverview
  resolvedTemplateSourceCode: string
  submitSampleImport: () => void
  t: TranslateFunction
  templateSourceSystem: IntegrationTemplateSourceSystem
}
function IntegrationEvidencePanel(input: IntegrationEvidencePanelProps) {
  const {
    compatibleSources,
    createBatchMutation,
    createdBatchId,
    dispatchPageState,
    evidenceState,
    importTemplateQuery,
    overview,
    resolvedTemplateSourceCode,
    submitSampleImport,
    t,
    templateSourceSystem,
  } = input

  return (
    <AdminSurfaceSection
      ariaLabel={t('adminIntegrations.evidenceTabAria')}
      actions={
        <IntegrationSelect
          aria-label={t('adminIntegrations.templateSourceSystem')}
          value={templateSourceSystem}
          onChange={(event) =>
            dispatchPageState({
              type: 'setTemplateSourceSystem',
              value: event.target.value as IntegrationTemplateSourceSystem,
            })
          }
        >
          <option value="power_bi">Power BI</option>
          <option value="nebim_v3">Nebim V3</option>
        </IntegrationSelect>
      }
      description={t('adminIntegrations.evidencePanelCopy')}
      eyebrow={t('adminIntegrations.tabEvidence')}
      title={t('adminIntegrations.evidencePanelTitle')}
    >
      <AdminKeyValueGrid className="tw:lg:grid-cols-3">
        <IntegrationEvidenceValue
          icon={<FileJson size={18} />}
          label={t('adminIntegrations.payloadEvidence')}
          description={t('adminIntegrations.payloadEvidenceCopy')}
          value={importTemplateQuery.data?.entityType ?? 'kpi'}
        />
        <IntegrationEvidenceValue
          icon={<ClipboardCheck size={18} />}
          label={t('adminIntegrations.auditEvidence')}
          description={t('adminIntegrations.auditEvidenceCopy')}
          value={formatOptionalBatch(overview.latest.completedBatchId, t)}
        />
        <IntegrationEvidenceValue
          icon={<DatabaseZap size={18} />}
          label={t('adminIntegrations.reconciliationEvidence')}
          description={t('adminIntegrations.reconciliationEvidenceCopy')}
          value={evidenceState}
        />
      </AdminKeyValueGrid>

      {importTemplateQuery.isLoading ? (
        <AdminStatePanel
          title={t('adminIntegrations.loadingTemplate')}
          isLoading
        />
      ) : importTemplateQuery.isError ? (
        <AdminStatePanel
          title={getErrorMessage(importTemplateQuery.error)}
          tone="danger"
        />
      ) : importTemplateQuery.data ? (
        <div className="tw:grid tw:gap-3">
          <AdminActionRow>
            <IntegrationSelect
              aria-label={t('adminIntegrations.executionSource')}
              value={resolvedTemplateSourceCode}
              onChange={(event) =>
                dispatchPageState({
                  type: 'setSelectedTemplateSourceCode',
                  value: event.target.value,
                })
              }
              disabled={compatibleSources.length === 0}
            >
              {compatibleSources.length === 0 ? (
                <option value="">{t('adminIntegrations.noActiveKpiSource')}</option>
              ) : null}
              {compatibleSources.map((item) => (
                <option key={item.sourceId} value={item.sourceCode}>
                  {item.sourceCode} - {item.sourceName}
                </option>
              ))}
            </IntegrationSelect>
            <Button
              type="button"
              disabled={compatibleSources.length === 0 || createBatchMutation.isPending}
              onClick={submitSampleImport}
            >
              {createBatchMutation.isPending
                ? t('adminIntegrations.running')
                : t('adminIntegrations.createEvidenceSample')}
            </Button>
          </AdminActionRow>

          {compatibleSources.length === 0 ? (
            <AdminStatePanel
              title={t('adminIntegrations.sourceSystemNeedsKpiSource')}
              tone="warning"
            />
          ) : null}

          <AdminKeyValueGrid className="tw:lg:grid-cols-3">
            <AdminKeyValue label={t('adminIntegrations.entity')} value={importTemplateQuery.data.entityType} />
            <AdminKeyValue label={t('adminIntegrations.source')} value={importTemplateQuery.data.sourceSystem} />
            <AdminKeyValue
              label={t('adminIntegrations.executionSource')}
              value={resolvedTemplateSourceCode || t('adminIntegrations.none')}
            />
          </AdminKeyValueGrid>

          {createdBatchId ? (
            <AdminStatePanel
              title={`${t('adminIntegrations.latestCreatedBatch')}: ${createdBatchId}`}
              tone="neutral"
            />
          ) : null}

          {importTemplateQuery.data.normalizedBehavior?.length ? (
            <ul className="tw:grid tw:gap-2 tw:rounded-lg tw:border tw:border-border tw:bg-background/60 tw:p-3 tw:text-sm tw:text-muted-foreground">
              {importTemplateQuery.data.normalizedBehavior.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}

          <pre
            className="tw:max-h-96 tw:overflow-auto tw:rounded-lg tw:border tw:border-border tw:bg-slate-950 tw:p-3 tw:text-xs tw:leading-5 tw:text-slate-100"
            data-testid="integration-code-block"
          >
            {JSON.stringify(importTemplateQuery.data.requestBody, null, 2)}
          </pre>
        </div>
      ) : null}
    </AdminSurfaceSection>
  )
}

type IntegrationErrorsPanelProps = {
  canGoBack: boolean
  canGoForward: boolean
  dispatchPageState: IntegrationDispatch
  entityTypeFilter: string
  meta: IntegrationListMeta | undefined
  offset: number
  retryMutation: RetryMutationState
  search: string
  sortBy: IntegrationSortValue
  sortedItems: NeedsActionItem[]
  statusFilter: string
  t: TranslateFunction
}
function IntegrationErrorsPanel(input: IntegrationErrorsPanelProps) {
  const {
    canGoBack,
    canGoForward,
    dispatchPageState,
    entityTypeFilter,
    meta,
    offset,
    retryMutation,
    search,
    sortBy,
    sortedItems,
    statusFilter,
    t,
  } = input

  return (
    <AdminSurfaceSection
      ariaLabel={t('adminIntegrations.errorsTabAria')}
      actions={
        <AdminActionRow className="tw:justify-start tw:sm:justify-end">
          <IntegrationSelect
            aria-label={t('adminIntegrations.sortPriority')}
            value={sortBy}
            onChange={(event) =>
              dispatchPageState({ type: 'setSortBy', value: event.target.value as IntegrationSortValue })
            }
          >
            <option value="priority">{t('adminIntegrations.sortPriority')}</option>
            <option value="errors">{t('adminIntegrations.sortErrors')}</option>
            <option value="records">{t('adminIntegrations.sortRecords')}</option>
            <option value="entity">{t('adminIntegrations.sortEntity')}</option>
          </IntegrationSelect>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              downloadCsv({
                filename: 'integration-needs-action.csv',
                columns: ['batchId', 'sourceCode', 'sourceName', 'entityType', 'healthState', 'recordCount', 'errorCount', 'retryCount', 'actionReason', 'recommendedAction'],
                rows: sortedItems.map((item) => [
                  item.batchId,
                  item.sourceCode,
                  item.sourceName,
                  item.entityType,
                  item.healthState,
                  item.recordCount,
                  item.errorCount,
                  item.retryCount,
                  item.actionReason,
                  item.recommendedAction,
                ]),
              })
            }
          >
            {t('adminIntegrations.exportQueue')}
          </Button>
        </AdminActionRow>
      }
      description={t('adminIntegrations.errorsPanelCopy')}
      eyebrow={t('adminIntegrations.tabErrors')}
      title={t('adminIntegrations.errorsPanelTitle')}
    >
      <div className="tw:grid tw:grid-cols-1 tw:gap-2 tw:lg:grid-cols-[minmax(16rem,1fr)_12rem_12rem_auto]">
        <label className="tw:relative tw:block">
          <Search
            aria-hidden="true"
            className="tw:pointer-events-none tw:absolute tw:left-3 tw:top-1/2 tw:size-4 tw:-translate-y-1/2 tw:text-muted-foreground"
          />
          <span className="tw:sr-only">{t('adminIntegrations.filterQueue')}</span>
          <Input
            className="tw:pl-9"
            value={search}
            onChange={(event) =>
              dispatchPageState({ type: 'setSearch', value: event.target.value })
            }
            placeholder={t('adminIntegrations.searchQueuePlaceholder')}
          />
        </label>
        <IntegrationSelect
          aria-label={t('adminIntegrations.filterEntityType')}
          value={entityTypeFilter}
          onChange={(event) =>
            dispatchPageState({
              type: 'setQueueFilter',
              field: 'entityTypeFilter',
              value: event.target.value,
            })
          }
        >
          <option value="">{t('adminIntegrations.allEntities')}</option>
          {['employee', 'store', 'kpi', 'assignment', 'position', 'company', 'region'].map((entity) => (
            <option key={entity} value={entity}>{entity}</option>
          ))}
        </IntegrationSelect>
        <IntegrationSelect
          aria-label={t('adminIntegrations.filterStatus')}
          value={statusFilter}
          onChange={(event) =>
            dispatchPageState({
              type: 'setQueueFilter',
              field: 'statusFilter',
              value: event.target.value,
            })
          }
        >
          <option value="">{t('adminIntegrations.allStatuses')}</option>
          {['pending', 'queued', 'processing', 'completed', 'completed_with_errors', 'failed'].map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </IntegrationSelect>
        <Button
          type="button"
          variant="outline"
          onClick={() => dispatchPageState({ type: 'clearQueueFilters' })}
        >
          {t('adminIntegrations.clearFilters')}
        </Button>
      </div>

      {sortedItems.length === 0 ? (
        <AdminSurfaceEmpty
          title={t('adminIntegrations.noQueueItemsTitle')}
          copy={t('adminIntegrations.noQueueItemsCopy')}
        />
      ) : (
        <div className="tw:grid tw:gap-2">
          {sortedItems.map((item) => (
            <article
              className="tw:grid tw:gap-3 tw:rounded-xl tw:border tw:border-border tw:bg-background/70 tw:p-3 tw:shadow-sm tw:lg:grid-cols-[minmax(0,1fr)_auto] tw:lg:items-center"
              key={item.batchId}
            >
              <Link
                className="tw:block tw:min-w-0 tw:no-underline"
                to={`/admin/integrations/${item.batchId}`}
              >
                <div className="tw:flex tw:min-w-0 tw:flex-wrap tw:items-center tw:gap-2">
                  <div className="tw:min-w-0 tw:font-medium tw:text-foreground">
                    {item.sourceCode} / {item.entityType}
                  </div>
                  <AdminSurfaceBadge tone={toAdminTone(mapHealthTone(item.healthState))}>
                    {formatState(item.healthState)}
                  </AdminSurfaceBadge>
                </div>
                <div className="tw:mt-1 tw:break-all tw:text-xs tw:text-muted-foreground">{item.batchId}</div>
                <p className="tw:mt-2 tw:text-sm tw:leading-6 tw:text-muted-foreground">
                  {item.actionReason}
                </p>
                <div className="tw:mt-3 tw:flex tw:flex-wrap tw:gap-2 tw:text-xs tw:text-muted-foreground">
                  <AdminSurfaceBadge tone="neutral">
                    {t('adminIntegrations.records', { count: item.recordCount })}
                  </AdminSurfaceBadge>
                  <AdminSurfaceBadge tone={item.errorCount > 0 ? 'danger' : 'neutral'}>
                    {t('adminIntegrations.errors', { count: item.errorCount })}
                  </AdminSurfaceBadge>
                  <AdminSurfaceBadge tone="neutral">
                    {t('adminIntegrations.retryCount', { count: item.retryCount })}
                  </AdminSurfaceBadge>
                  {item.recommendedNextEntityType ? (
                    <AdminSurfaceBadge tone="warning">
                      {t('adminIntegrations.nextImport', { entity: item.recommendedNextEntityType })}
                    </AdminSurfaceBadge>
                  ) : null}
                </div>
                <div className="tw:mt-3 tw:flex tw:items-center tw:gap-2 tw:text-sm tw:font-medium tw:text-primary">
                  <span>{item.recommendedAction}</span>
                  <ArrowRight className="tw:size-4" aria-hidden="true" />
                </div>
              </Link>
              {item.canRetryNow ? (
                <AdminActionRow className="tw:lg:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => retryMutation.mutate(item.batchId)}
                    disabled={retryMutation.isPending}
                  >
                    {retryMutation.isPending ? t('adminIntegrations.retrying') : t('adminIntegrations.retryBatch')}
                  </Button>
                </AdminActionRow>
              ) : null}
            </article>
          ))}
        </div>
      )}

      <AdminActionRow className="tw:justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            dispatchPageState({ type: 'setOffset', value: Math.max(0, offset - PAGE_SIZE) })
          }
          disabled={!canGoBack}
        >
          {t('adminIntegrations.previous')}
        </Button>
        <AdminSurfaceBadge tone="neutral">
          {meta ? `${offset + 1}-${Math.min(offset + PAGE_SIZE, meta.total)} / ${meta.total}` : t('adminIntegrations.zeroResults')}
        </AdminSurfaceBadge>
        <Button
          type="button"
          variant="outline"
          onClick={() => dispatchPageState({ type: 'setOffset', value: offset + PAGE_SIZE })}
          disabled={!canGoForward}
        >
          {t('adminIntegrations.next')}
        </Button>
      </AdminActionRow>
    </AdminSurfaceSection>
  )
}
