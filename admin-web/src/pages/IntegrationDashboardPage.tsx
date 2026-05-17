import { useDeferredValue, useMemo, useReducer, type Dispatch, type ReactNode } from 'react'
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
import { Link } from 'react-router-dom'
import { EmptyState, ScreenState, StatusPill } from '../components/dashboard-primitives'
import { ReportingToolbar } from '../components/reporting-tools'
import { downloadCsv } from '../lib/download-csv'
import {
  createImportBatch,
  getImportOverview,
  getIntegrationLookups,
  getNeedsAction,
  getImportPayloadTemplate,
  type ImportOverview,
  type ImportPayloadTemplate,
  type IntegrationLookups,
  type ListResponse,
  type NeedsActionItem,
  type PowerBiExportUploadResponse,
  retryImportBatch,
  uploadPowerBiExport,
} from '../features/integrations/api'
import type { TranslateFunction } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import { formatState, getErrorMessage, mapHealthTone } from '../lib/format'

const PAGE_SIZE = 12
const trNumberFormatter = new Intl.NumberFormat('tr-TR')

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
  feedback: string | null
  createdBatchId: string | null
  uploadFeedback: string | null
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
  | { type: 'retrySucceeded'; message: string }
  | { type: 'batchCreated'; message: string; batchId: string }
  | { type: 'uploadSucceeded'; message: string; batchId: string }
  | { type: 'uploadFailed'; message: string }
  | { type: 'setTemplateSourceSystem'; value: IntegrationTemplateSourceSystem }
  | { type: 'setSelectedTemplateSourceCode'; value: string }
  | { type: 'setPowerBiSourceCode'; value: string }
  | { type: 'setPowerBiPeriodType'; value: PowerBiPeriodType }
  | { type: 'setPowerBiPeriodMonth'; value: string }
  | { type: 'setPowerBiPeriodStart'; value: string; syncEnd: boolean }
  | { type: 'setPowerBiPeriodEnd'; value: string }
  | { type: 'setPersonnelFile'; value: File | null }
  | { type: 'setStoreFile'; value: File | null }

function getCurrentIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function getCurrentIsoMonth() {
  return getCurrentIsoDate().slice(0, 7)
}

function createInitialIntegrationDashboardState(): IntegrationDashboardState {
  return {
    activeTab: 'uploads',
    search: '',
    sortBy: 'priority',
    offset: 0,
    entityTypeFilter: '',
    statusFilter: '',
    feedback: null,
    createdBatchId: null,
    uploadFeedback: null,
    uploadedBatchId: null,
    templateSourceSystem: 'power_bi',
    selectedTemplateSourceCode: '',
    powerBiSourceCode: '',
    powerBiPeriodType: 'monthly',
    powerBiPeriodMonth: getCurrentIsoMonth(),
    powerBiPeriodStart: getCurrentIsoDate(),
    powerBiPeriodEnd: getCurrentIsoDate(),
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
      return { ...state, feedback: action.message, createdBatchId: null }
    case 'batchCreated':
      return { ...state, feedback: action.message, createdBatchId: action.batchId }
    case 'uploadSucceeded':
      return { ...state, uploadFeedback: action.message, uploadedBatchId: action.batchId }
    case 'uploadFailed':
      return { ...state, uploadFeedback: action.message, uploadedBatchId: null }
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
    feedback,
    createdBatchId,
    uploadFeedback,
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
        entityType: entityTypeFilter || undefined,
        status: statusFilter || undefined,
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
      dispatchPageState({ type: 'retrySucceeded', message: response.command.message })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['integration-needs-action'] }),
        queryClient.invalidateQueries({ queryKey: ['integration-overview'] }),
      ])
    },
  })
  const createBatchMutation = useMutation({
    mutationFn: createImportBatch,
    onSuccess: async (response) => {
      dispatchPageState({
        type: 'batchCreated',
        message: response.command.message,
        batchId: response.data.batch.batchId,
      })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['integration-needs-action'] }),
        queryClient.invalidateQueries({ queryKey: ['integration-overview'] }),
      ])
    },
  })
  const uploadPowerBiMutation = useMutation({
    mutationFn: uploadPowerBiExport,
    onSuccess: async (response) => {
      dispatchPageState({
        type: 'uploadSucceeded',
        message: response.command.message,
        batchId: response.data.batch.batchId,
      })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['integration-needs-action'] }),
        queryClient.invalidateQueries({ queryKey: ['integration-overview'] }),
      ])
    },
    onError: (error) => {
      dispatchPageState({ type: 'uploadFailed', message: getErrorMessage(error) })
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
      <ScreenState
        title={t('adminIntegrations.loadingTitle')}
        copy={t('adminIntegrations.loadingCopy')}
      />
    )
  }

  if (overviewQuery.isError) {
    return (
      <ScreenState
        title={t('adminIntegrations.dashboardUnavailableTitle')}
        copy={getErrorMessage(overviewQuery.error)}
        tone="error"
      />
    )
  }

  if (needsActionQuery.isError) {
    return (
      <ScreenState
        title={t('adminIntegrations.needsActionUnavailableTitle')}
        copy={getErrorMessage(needsActionQuery.error)}
        tone="error"
      />
    )
  }

  if (lookupsQuery.isError) {
    return (
      <ScreenState
        title={t('adminIntegrations.lookupsUnavailableTitle')}
        copy={getErrorMessage(lookupsQuery.error)}
        tone="error"
      />
    )
  }

  const overview = overviewQuery.data
  if (!overview) {
    return (
      <ScreenState
        title={t('adminIntegrations.overviewUnavailableTitle')}
        copy={t('adminIntegrations.overviewUnavailableCopy')}
        tone="error"
      />
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
      feedback={feedback}
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
      uploadFeedback={uploadFeedback}
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
  feedback: string | null
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
  uploadFeedback: string | null
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
    feedback,
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
    uploadFeedback,
    uploadedBatchId,
    uploadPowerBiMutation,
  } = input

  const tabs: IntegrationTabOption[] = [
    { id: 'uploads', label: t('adminIntegrations.tabUploads') },
    { id: 'evidence', label: t('adminIntegrations.tabEvidence') },
    { id: 'errors', label: t('adminIntegrations.tabErrors'), count: actionCount },
  ]

  return (
    <section className="integration-management-page">
      <header className="integration-management-hero">
        <div>
          <div className="eyebrow">{t('adminIntegrations.heroEyebrow')}</div>
          <h2 className="integration-management-title">{t('adminIntegrations.title')}</h2>
          <p className="integration-management-copy">{t('adminIntegrations.heroCopy')}</p>
        </div>
        <div className="integration-management-hero-actions">
          <span className="integration-management-chip">
            {t('adminIntegrations.totalBatches')}: {formatNumber(overview.totals.all)}
          </span>
          <button
            className="control-button integration-management-primary-button"
            type="button"
            onClick={() => dispatchPageState({ type: 'setActiveTab', value: 'uploads' })}
          >
            {t('adminIntegrations.newUpload')}
          </button>
        </div>
      </header>

      <section className="integration-management-metrics" aria-label={t('adminIntegrations.summaryAria')}>
        <IntegrationMetric
          title={t('adminIntegrations.status')}
          value={actionCount === 0 ? t('adminIntegrations.controlled') : t('adminIntegrations.needsReview')}
          note={actionCount === 0 ? t('adminIntegrations.noCriticalBlock') : t('adminIntegrations.actionCount', { count: actionCount })}
          tone="primary"
        />
        <IntegrationMetric
          title={t('adminIntegrations.healthy')}
          value={formatNumber(overview.healthTotals.healthy)}
          note={t('adminIntegrations.healthyNote', { count: overview.totals.completed })}
          icon={<CheckCircle2 size={18} />}
        />
        <IntegrationMetric
          title={t('adminIntegrations.needsAction')}
          value={formatNumber(actionCount)}
          note={t('adminIntegrations.actionSummaryNote')}
          icon={<AlertTriangle size={18} />}
        />
        <IntegrationMetric
          title={t('adminIntegrations.retryReady')}
          value={formatNumber(overview.healthTotals.retryReady)}
          note={t('adminIntegrations.retryReadyNote')}
          icon={<RefreshCw size={18} />}
        />
        <IntegrationMetric
          title={t('adminIntegrations.evidence')}
          value={evidenceState}
          note={formatOptionalBatch(overview.latest.completedBatchId, t)}
          icon={<ShieldCheck size={18} />}
        />
      </section>

      {(feedback || uploadFeedback) ? (
        <section className="integration-management-feedback">
          {feedback ? <div className="inline-state inline-state-accent">{feedback}</div> : null}
          {createdBatchId ? (
            <Link className="back-link" to={`/admin/integrations/${createdBatchId}`}>
              <span>{t('adminIntegrations.openBatchDetail')}</span>
            </Link>
          ) : null}
          {uploadFeedback ? <div className="inline-state inline-state-accent">{uploadFeedback}</div> : null}
          {uploadedBatchId ? (
            <Link className="back-link" to={`/admin/integrations/${uploadedBatchId}`}>
              <span>{t('adminIntegrations.openBatchDetail')}</span>
            </Link>
          ) : null}
        </section>
      ) : null}

      <nav className="integration-management-tabs" aria-label={t('adminIntegrations.tabsAria')}>
        {tabs.map((tab) => (
          <button
            className={`integration-management-tab${activeTab === tab.id ? ' integration-management-tab-active' : ''}`}
            key={tab.id}
            type="button"
            onClick={() => dispatchPageState({ type: 'setActiveTab', value: tab.id })}
          >
            <span>{tab.label}</span>
            {typeof tab.count === 'number' ? <strong>{formatNumber(tab.count)}</strong> : null}
          </button>
        ))}
      </nav>

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
    </section>
  )
}

type PowerBiUploadMutationState = {
  data?: PowerBiExportUploadResponse
  isPending: boolean
  mutate: (input: Parameters<typeof uploadPowerBiExport>[0]) => void
}

type ImportTemplateQueryState = {
  data?: ImportPayloadTemplate
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
<section className="integration-management-panel" aria-label={t('adminIntegrations.uploadsTabAria')}>
          <div className="integration-management-panel-head">
            <div>
              <div className="eyebrow">{t('adminIntegrations.tabUploads')}</div>
              <h3>{t('adminIntegrations.uploadPanelTitle')}</h3>
              <p className="integration-management-panel-copy">{t('adminIntegrations.uploadPanelCopy')}</p>
            </div>
            <div className="toolbar-cluster">
              <span className="integration-management-chip">{t('adminIntegrations.powerBiKpiSource')}</span>
              <StatusPill tone={powerBiUploadBlockers.length === 0 ? 'calm' : 'warning'}>
                {powerBiUploadBlockers.length === 0 ? t('adminIntegrations.ready') : t('adminIntegrations.waiting')}
              </StatusPill>
            </div>
          </div>

          <div className="integration-management-split">
            <div className="integration-management-card">
              <div className="integration-management-card-head">
                <div className="integration-management-card-icon"><UploadCloud size={18} /></div>
                <div>
                  <h4>{t('adminIntegrations.newUpload')}</h4>
                  <p>{t('adminIntegrations.separateFilesCopy')}</p>
                </div>
              </div>

              <div className="integration-management-form-grid">
                <label className="field-block">
                  <span>{t('adminIntegrations.powerBiKpiSource')}</span>
                  <select
                    value={resolvedPowerBiSourceCode}
                    onChange={(event) =>
                      dispatchPageState({
                        type: 'setPowerBiSourceCode',
                        value: event.target.value,
                      })
                    }
                    disabled={powerBiSources.length === 0}
                  >
                    {powerBiSources.length === 0 ? <option value="">{t('adminIntegrations.noActiveKpiSource')}</option> : null}
                    {powerBiSources.map((item) => (
                      <option key={item.sourceId} value={item.sourceCode}>
                        {item.sourceCode} - {item.sourceName}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field-block">
                  <span>{t('adminIntegrations.periodType')}</span>
                  <select
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
                  </select>
                </label>

                {powerBiPeriodType === 'monthly' ? (
                  <label className="field-block">
                    <span>{t('adminIntegrations.periodMonth')}</span>
                    <input
                      type="month"
                      value={powerBiPeriodMonth}
                      onChange={(event) =>
                        dispatchPageState({
                          type: 'setPowerBiPeriodMonth',
                          value: event.target.value,
                        })
                      }
                    />
                  </label>
                ) : (
                  <>
                    <label className="field-block">
                      <span>{t('adminIntegrations.start')}</span>
                      <input
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
                    </label>
                    <label className="field-block">
                      <span>{t('adminIntegrations.end')}</span>
                      <input
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
                    </label>
                  </>
                )}
              </div>

              <div className="integration-management-upload-pair">
                <label className="integration-management-upload-drop">
                  <FileSpreadsheet size={20} aria-hidden="true" />
                  <strong>{t('adminIntegrations.personnelExport')}</strong>
                  <span>{personnelFile?.name ?? t('adminIntegrations.noFileSelected')}</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(event) =>
                      dispatchPageState({
                        type: 'setPersonnelFile',
                        value: event.target.files?.[0] ?? null,
                      })
                    }
                  />
                </label>
                <label className="integration-management-upload-drop">
                  <Store size={20} aria-hidden="true" />
                  <strong>{t('adminIntegrations.storeExport')}</strong>
                  <span>{storeFile?.name ?? t('adminIntegrations.noFileSelected')}</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(event) =>
                      dispatchPageState({
                        type: 'setStoreFile',
                        value: event.target.files?.[0] ?? null,
                      })
                    }
                  />
                </label>
              </div>

              <div className="toolbar-cluster">
                <button
                  className="control-button integration-management-primary-button"
                  type="button"
                  disabled={isPowerBiUploadDisabled}
                  onClick={() =>
                    uploadPowerBiMutation.mutate({
                      sourceCode: resolvedPowerBiSourceCode,
                      periodType: powerBiPeriodType,
                      periodMonth: powerBiPeriodType === 'monthly' ? powerBiPeriodMonth : undefined,
                      periodStart: powerBiPeriodType === 'monthly' ? undefined : powerBiPeriodStart,
                      periodEnd:
                        powerBiPeriodType === 'monthly'
                          ? undefined
                          : powerBiPeriodType === 'daily'
                            ? powerBiPeriodStart
                            : powerBiPeriodEnd,
                      personnelFile,
                      storeFile,
                    })
                  }
                >
                  {uploadPowerBiMutation.isPending ? t('adminIntegrations.uploading') : t('adminIntegrations.uploadPowerBiExport')}
                </button>
                {powerBiUploadBlockers.length > 0 ? (
                  <span className="inline-state inline-state-warning" role="status">
                    <strong>{t('adminIntegrations.powerBiNotReady')}</strong>: {powerBiUploadBlockers.join(' ')}
                  </span>
                ) : (
                  <span className="inline-state inline-state-neutral">
                    {t('adminIntegrations.powerBiReadyCopy')}
                  </span>
                )}
              </div>
            </div>

            <aside className="integration-management-card integration-management-decision-card">
              <div className="eyebrow">{t('adminIntegrations.uploadDecisionEyebrow')}</div>
              <h3>{t('adminIntegrations.uploadDecisionTitle')}</h3>
              <p>{t('adminIntegrations.uploadDecisionCopy')}</p>
              <div className="integration-management-decision-list">
                <DecisionRow label={t('adminIntegrations.latestCompleted')} value={formatOptionalBatch(overview.latest.completedBatchId, t)} />
                <DecisionRow label={t('adminIntegrations.retryReady')} value={formatNumber(overview.healthTotals.retryReady)} />
                <DecisionRow label={t('adminIntegrations.blocked')} value={formatNumber(overview.healthTotals.blocked)} />
              </div>
            </aside>
          </div>

          {uploadPowerBiMutation.data?.data.summary ? (
            <UploadSummaryGrid summary={uploadPowerBiMutation.data.data.summary} t={t} />
          ) : null}
        </section>
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
<section className="integration-management-panel" aria-label={t('adminIntegrations.evidenceTabAria')}>
          <div className="integration-management-panel-head">
            <div>
              <div className="eyebrow">{t('adminIntegrations.tabEvidence')}</div>
              <h3>{t('adminIntegrations.evidencePanelTitle')}</h3>
              <p className="integration-management-panel-copy">{t('adminIntegrations.evidencePanelCopy')}</p>
            </div>
            <div className="toolbar-cluster">
              <label className="control-select">
                <span className="sr-only">{t('adminIntegrations.templateSourceSystem')}</span>
                <select
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
                </select>
              </label>
            </div>
          </div>

          <div className="integration-management-evidence-grid">
            <EvidenceCard
              icon={<FileJson size={18} />}
              title={t('adminIntegrations.payloadEvidence')}
              copy={t('adminIntegrations.payloadEvidenceCopy')}
              value={importTemplateQuery.data?.entityType ?? 'kpi'}
            />
            <EvidenceCard
              icon={<ClipboardCheck size={18} />}
              title={t('adminIntegrations.auditEvidence')}
              copy={t('adminIntegrations.auditEvidenceCopy')}
              value={formatOptionalBatch(overview.latest.completedBatchId, t)}
            />
            <EvidenceCard
              icon={<DatabaseZap size={18} />}
              title={t('adminIntegrations.reconciliationEvidence')}
              copy={t('adminIntegrations.reconciliationEvidenceCopy')}
              value={evidenceState}
            />
          </div>

          {importTemplateQuery.isLoading ? (
            <div className="inline-state inline-state-neutral">{t('adminIntegrations.loadingTemplate')}</div>
          ) : importTemplateQuery.isError ? (
            <div className="inline-state inline-state-danger">{getErrorMessage(importTemplateQuery.error)}</div>
          ) : importTemplateQuery.data ? (
            <div className="integration-management-evidence-detail">
              <div className="toolbar-cluster">
                <label className="control-select">
                  <span className="sr-only">{t('adminIntegrations.executionSource')}</span>
                  <select
                    value={resolvedTemplateSourceCode}
                    onChange={(event) =>
                      dispatchPageState({
                        type: 'setSelectedTemplateSourceCode',
                        value: event.target.value,
                      })
                    }
                    disabled={compatibleSources.length === 0}
                  >
                    {compatibleSources.length === 0 ? <option value="">{t('adminIntegrations.noActiveKpiSource')}</option> : null}
                    {compatibleSources.map((item) => (
                      <option key={item.sourceId} value={item.sourceCode}>
                        {item.sourceCode} - {item.sourceName}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="control-button"
                  type="button"
                  disabled={compatibleSources.length === 0 || createBatchMutation.isPending}
                  onClick={submitSampleImport}
                >
                  {createBatchMutation.isPending ? t('adminIntegrations.running') : t('adminIntegrations.createEvidenceSample')}
                </button>
              </div>
              {compatibleSources.length === 0 ? (
                <div className="inline-state inline-state-warning">
                  {t('adminIntegrations.sourceSystemNeedsKpiSource')}
                </div>
              ) : null}
              <div className="integration-management-evidence-meta">
                <span>{t('adminIntegrations.entity')}: {importTemplateQuery.data.entityType}</span>
                <span>{t('adminIntegrations.source')}: {importTemplateQuery.data.sourceSystem}</span>
                <span>{t('adminIntegrations.executionSource')}: {resolvedTemplateSourceCode || t('adminIntegrations.none')}</span>
              </div>
              {createdBatchId ? (
                <div className="inline-state inline-state-neutral">
                  {t('adminIntegrations.latestCreatedBatch')}: <code>{createdBatchId}</code>
                </div>
              ) : null}
              {importTemplateQuery.data.normalizedBehavior?.length ? (
                <ul className="audit-list">
                  {importTemplateQuery.data.normalizedBehavior.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
              <pre className="integration-management-code-block">
                {JSON.stringify(importTemplateQuery.data.requestBody, null, 2)}
              </pre>
            </div>
          ) : null}
        </section>
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
<section className="integration-management-panel" aria-label={t('adminIntegrations.errorsTabAria')}>
          <div className="integration-management-panel-head">
            <div>
              <div className="eyebrow">{t('adminIntegrations.tabErrors')}</div>
              <h3>{t('adminIntegrations.errorsPanelTitle')}</h3>
              <p className="integration-management-panel-copy">{t('adminIntegrations.errorsPanelCopy')}</p>
            </div>
            <ReportingToolbar
              sortValue={sortBy}
              onSortChange={(value) =>
                dispatchPageState({ type: 'setSortBy', value: value as IntegrationSortValue })
              }
              sortOptions={[
                { value: 'priority', label: t('adminIntegrations.sortPriority') },
                { value: 'errors', label: t('adminIntegrations.sortErrors') },
                { value: 'records', label: t('adminIntegrations.sortRecords') },
                { value: 'entity', label: t('adminIntegrations.sortEntity') },
              ]}
              onExport={() =>
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
              <label className="search-field integration-management-search">
                <Search size={16} aria-hidden="true" />
                <span className="sr-only">{t('adminIntegrations.filterQueue')}</span>
                <input
                  value={search}
                  onChange={(event) =>
                    dispatchPageState({ type: 'setSearch', value: event.target.value })
                  }
                  placeholder={t('adminIntegrations.searchQueuePlaceholder')}
                />
              </label>
            </ReportingToolbar>
          </div>

          <div className="toolbar-cluster">
            <label className="control-select">
              <span className="sr-only">{t('adminIntegrations.filterEntityType')}</span>
              <select
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
              </select>
            </label>
            <label className="control-select">
              <span className="sr-only">{t('adminIntegrations.filterStatus')}</span>
              <select
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
              </select>
            </label>
            <button
              className="control-button"
              type="button"
              onClick={() => dispatchPageState({ type: 'clearQueueFilters' })}
            >
              {t('adminIntegrations.clearFilters')}
            </button>
          </div>

          {sortedItems.length === 0 ? (
            <EmptyState title={t('adminIntegrations.noQueueItemsTitle')} copy={t('adminIntegrations.noQueueItemsCopy')} />
          ) : (
            <div className="integration-management-queue-list">
              {sortedItems.map((item) => (
                <div className="integration-management-queue-row" key={item.batchId}>
                  <Link to={`/admin/integrations/${item.batchId}`}>
                    <div className="queue-row-head">
                      <div>
                        <div className="queue-title">{item.sourceCode} / {item.entityType}</div>
                        <div className="queue-subtitle">{item.batchId}</div>
                      </div>
                      <StatusPill tone={mapHealthTone(item.healthState)}>{formatState(item.healthState)}</StatusPill>
                    </div>

                    <p className="queue-reason">{item.actionReason}</p>

                    <div className="queue-meta">
                      <span>{t('adminIntegrations.records', { count: item.recordCount })}</span>
                      <span>{t('adminIntegrations.errors', { count: item.errorCount })}</span>
                      <span>{t('adminIntegrations.retryCount', { count: item.retryCount })}</span>
                      {item.recommendedNextEntityType ? <span>{t('adminIntegrations.nextImport', { entity: item.recommendedNextEntityType })}</span> : null}
                    </div>

                    <div className="queue-footer">
                      <span>{item.recommendedAction}</span>
                      <ArrowRight size={16} />
                    </div>
                  </Link>
                  {item.canRetryNow ? (
                    <div className="action-cluster">
                      <button
                        className="control-button"
                        type="button"
                        onClick={() => retryMutation.mutate(item.batchId)}
                        disabled={retryMutation.isPending}
                      >
                        {retryMutation.isPending ? t('adminIntegrations.retrying') : t('adminIntegrations.retryBatch')}
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}

          <div className="toolbar-cluster">
            <button
              className="control-button"
              type="button"
              onClick={() =>
                dispatchPageState({ type: 'setOffset', value: Math.max(0, offset - PAGE_SIZE) })
              }
              disabled={!canGoBack}
            >
              {t('adminIntegrations.previous')}
            </button>
            <span className="inline-state inline-state-neutral">
              {meta ? `${offset + 1}-${Math.min(offset + PAGE_SIZE, meta.total)} / ${meta.total}` : t('adminIntegrations.zeroResults')}
            </span>
            <button
              className="control-button"
              type="button"
              onClick={() => dispatchPageState({ type: 'setOffset', value: offset + PAGE_SIZE })}
              disabled={!canGoForward}
            >
              {t('adminIntegrations.next')}
            </button>
          </div>
        </section>
  )
}

function IntegrationMetric(input: {
  title: string
  value: string
  note: string
  tone?: 'primary'
  icon?: ReactNode
}) {
  return (
    <article className={`integration-management-metric${input.tone === 'primary' ? ' integration-management-metric-primary' : ''}`}>
      {input.icon ? <div className="integration-management-metric-icon">{input.icon}</div> : null}
      <span>{input.title}</span>
      <strong>{input.value}</strong>
      <p>{input.note}</p>
    </article>
  )
}

function DecisionRow(input: { label: string; value: string }) {
  return (
    <div className="integration-management-decision-row">
      <span>{input.label}</span>
      <strong>{input.value}</strong>
    </div>
  )
}

function EvidenceCard(input: { icon: ReactNode; title: string; copy: string; value: string }) {
  return (
    <article className="integration-management-evidence-card">
      <div className="integration-management-card-icon">{input.icon}</div>
      <h4>{input.title}</h4>
      <p>{input.copy}</p>
      <strong>{input.value}</strong>
    </article>
  )
}

function UploadSummaryGrid(input: {
  summary: {
    periodMonth: string | null
    periodStart: string
    periodEnd: string
    canonicalRowCount: number
    personnelRowsRead: number
    ignoredPersonnelRows: number
    scopeExcludedPersonnelRows: number
    personnelGrossSalesRows: number
    negativePersonnelRowsIgnored: number
    storeRowsRead: number
    scopeExcludedStoreRows: number
    mappingMode: string
    reconciliation: {
      comparedStoreCount: number
      balancedStoreCount: number
      warningStoreCount: number
      items: Array<unknown>
    }
  }
  t: TranslateFunction
}) {
  const summaryItems = [
    {
      label: input.t('adminIntegrations.period'),
      value: input.summary.periodMonth ?? `${input.summary.periodStart} / ${input.summary.periodEnd}`,
    },
    { label: input.t('adminIntegrations.canonicalKpiRows'), value: formatNumber(input.summary.canonicalRowCount) },
    { label: input.t('adminIntegrations.personnelRowsRead'), value: formatNumber(input.summary.personnelRowsRead) },
    { label: input.t('adminIntegrations.ignoredPersonnelRows'), value: formatNumber(input.summary.ignoredPersonnelRows) },
    { label: input.t('adminIntegrations.scopeExcludedPersonnelRows'), value: formatNumber(input.summary.scopeExcludedPersonnelRows) },
    { label: input.t('adminIntegrations.personnelGrossSalesRows'), value: formatNumber(input.summary.personnelGrossSalesRows) },
    { label: input.t('adminIntegrations.negativePersonnelRowsIgnored'), value: formatNumber(input.summary.negativePersonnelRowsIgnored) },
    { label: input.t('adminIntegrations.storeRowsRead'), value: formatNumber(input.summary.storeRowsRead) },
    { label: input.t('adminIntegrations.scopeExcludedStoreRows'), value: formatNumber(input.summary.scopeExcludedStoreRows) },
    { label: input.t('adminIntegrations.mappingMode'), value: input.summary.mappingMode },
  ]

  return (
    <section className="integration-management-summary-grid" aria-label={input.t('adminIntegrations.uploadResultAria')}>
      {summaryItems.map((item) => (
        <div className="key-item" key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </div>
      ))}
      {input.summary.reconciliation.items.length > 0 ? (
        <>
          <div className="key-item">
            <span>{input.t('adminIntegrations.comparedStores')}</span>
            <strong>{formatNumber(input.summary.reconciliation.comparedStoreCount)}</strong>
          </div>
          <div className="key-item">
            <span>{input.t('adminIntegrations.balancedStores')}</span>
            <strong>{formatNumber(input.summary.reconciliation.balancedStoreCount)}</strong>
          </div>
          <div className="key-item">
            <span>{input.t('adminIntegrations.warningStores')}</span>
            <strong>{formatNumber(input.summary.reconciliation.warningStoreCount)}</strong>
          </div>
        </>
      ) : null}
    </section>
  )
}
