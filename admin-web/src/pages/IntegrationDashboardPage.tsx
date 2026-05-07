import { useDeferredValue, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowRight, Clock3, Layers2, ShieldAlert, TimerReset } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  EmptyState,
  KeyValue,
  MetricAccent,
  MetricCard,
  ScreenState,
  StatusBar,
  StatusPill,
} from '../components/dashboard-primitives'
import { ReportingToolbar } from '../components/reporting-tools'
import { downloadCsv } from '../lib/download-csv'
import {
  createImportBatch,
  getImportOverview,
  getIntegrationLookups,
  getNeedsAction,
  getImportPayloadTemplate,
  getStoreMasterData,
  getStoreMasterLookups,
  retryImportBatch,
  updateStoreMasterData,
  uploadPowerBiExport,
} from '../features/integrations/api'
import type { StoreMasterItem } from '../features/integrations/api'
import type { TranslateFunction } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import { formatState, getErrorMessage, mapHealthTone } from '../lib/format'

const PAGE_SIZE = 12
type StoreMasterType = 'company' | 'franchise' | 'operator'
type StoreMasterStatus = 'active' | 'inactive' | 'closed'

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

export function IntegrationDashboardPage() {
  const { t } = useLocalization()
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'priority' | 'errors' | 'records' | 'entity'>('priority')
  const [offset, setOffset] = useState(0)
  const [entityTypeFilter, setEntityTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [createdBatchId, setCreatedBatchId] = useState<string | null>(null)
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null)
  const [uploadedBatchId, setUploadedBatchId] = useState<string | null>(null)
  const [templateSourceSystem, setTemplateSourceSystem] = useState<'nebim_v3' | 'power_bi'>('nebim_v3')
  const [selectedTemplateSourceCode, setSelectedTemplateSourceCode] = useState('')
  const [powerBiSourceCode, setPowerBiSourceCode] = useState('')
  const [powerBiPeriodType, setPowerBiPeriodType] = useState<'daily' | 'monthly' | 'custom'>('monthly')
  const [powerBiPeriodMonth, setPowerBiPeriodMonth] = useState(new Date().toISOString().slice(0, 7))
  const [powerBiPeriodStart, setPowerBiPeriodStart] = useState(new Date().toISOString().slice(0, 10))
  const [powerBiPeriodEnd, setPowerBiPeriodEnd] = useState(new Date().toISOString().slice(0, 10))
  const [personnelFile, setPersonnelFile] = useState<File | null>(null)
  const [storeFile, setStoreFile] = useState<File | null>(null)
  const [storeMasterSearch, setStoreMasterSearch] = useState('')
  const [storeMasterEnabledFilter, setStoreMasterEnabledFilter] = useState<'all' | 'enabled' | 'disabled'>('all')
  const [storeMasterStatusFilter, setStoreMasterStatusFilter] = useState<'all' | StoreMasterStatus>('all')
  const [storeMasterFeedback, setStoreMasterFeedback] = useState<string | null>(null)
  const deferredSearch = useDeferredValue(search)
  const deferredStoreMasterSearch = useDeferredValue(storeMasterSearch)
  const queryClient = useQueryClient()

  const overviewQuery = useQuery({
    queryKey: ['integration-overview'],
    queryFn: getImportOverview,
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
  })
  const importTemplateQuery = useQuery({
    queryKey: ['integration-import-template', templateSourceSystem],
    queryFn: () =>
      getImportPayloadTemplate({
        entityType: 'kpi',
        sourceSystem: templateSourceSystem,
      }),
  })
  const lookupsQuery = useQuery({
    queryKey: ['integration-lookups'],
    queryFn: getIntegrationLookups,
  })
  const storeMasterQuery = useQuery({
    queryKey: [
      'store-master',
      deferredStoreMasterSearch,
      storeMasterEnabledFilter,
      storeMasterStatusFilter,
    ],
    queryFn: () =>
      getStoreMasterData({
        q: deferredStoreMasterSearch || undefined,
        enabled:
          storeMasterEnabledFilter === 'all'
            ? undefined
            : storeMasterEnabledFilter === 'enabled',
        status: storeMasterStatusFilter === 'all' ? undefined : storeMasterStatusFilter,
        limit: 200,
        offset: 0,
      }),
  })
  const storeMasterLookupsQuery = useQuery({
    queryKey: ['store-master-lookups'],
    queryFn: getStoreMasterLookups,
  })
  const retryMutation = useMutation({
    mutationFn: retryImportBatch,
    onSuccess: async (response) => {
      setFeedback(response.command.message)
      setCreatedBatchId(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['integration-needs-action'] }),
        queryClient.invalidateQueries({ queryKey: ['integration-overview'] }),
      ])
    },
  })
  const createBatchMutation = useMutation({
    mutationFn: createImportBatch,
    onSuccess: async (response) => {
      setFeedback(response.command.message)
      setCreatedBatchId(response.data.batch.batchId)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['integration-needs-action'] }),
        queryClient.invalidateQueries({ queryKey: ['integration-overview'] }),
      ])
    },
  })
  const uploadPowerBiMutation = useMutation({
    mutationFn: uploadPowerBiExport,
    onSuccess: async (response) => {
      setUploadFeedback(response.command.message)
      setUploadedBatchId(response.data.batch.batchId)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['integration-needs-action'] }),
        queryClient.invalidateQueries({ queryKey: ['integration-overview'] }),
      ])
    },
    onError: (error) => {
      setUploadFeedback(getErrorMessage(error))
      setUploadedBatchId(null)
    },
  })
  const updateStoreMasterMutation = useMutation({
    mutationFn: updateStoreMasterData,
    onSuccess: async (response) => {
      setStoreMasterFeedback(response.command.message)
      await queryClient.invalidateQueries({ queryKey: ['store-master'] })
    },
    onError: (error) => {
      setStoreMasterFeedback(getErrorMessage(error))
    },
  })

  const submitStoreMasterUpdate = (
    store: StoreMasterItem,
    patch: Partial<{
      storeType: StoreMasterType
      regionId: string
      status: StoreMasterStatus
      kpiImportEnabled: boolean
    }>,
  ) => {
    const regionId = patch.regionId ?? store.regionId

    if (!regionId) {
      setStoreMasterFeedback(t('adminIntegrations.storeRegionRequired'))
      return
    }

    updateStoreMasterMutation.mutate({
      storeId: store.storeId,
      storeType: patch.storeType ?? normalizeStoreType(store.storeType),
      regionId,
      status: patch.status ?? normalizeStoreStatus(store.status),
      kpiImportEnabled: patch.kpiImportEnabled ?? store.kpiImportEnabled,
    })
  }

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
  const storeTypeOptions = storeMasterLookupsQuery.data?.storeTypes ?? [
    { value: 'company' as const, label: t('adminIntegrations.storeType.company') },
    { value: 'franchise' as const, label: t('adminIntegrations.storeType.franchise') },
    { value: 'operator' as const, label: t('adminIntegrations.storeType.operator') },
  ]
  const storeStatusOptions = storeMasterLookupsQuery.data?.statuses ?? [
    { value: 'active' as const, label: t('adminIntegrations.storeStatus.active') },
    { value: 'inactive' as const, label: t('adminIntegrations.storeStatus.inactive') },
    { value: 'closed' as const, label: t('adminIntegrations.storeStatus.closed') },
  ]
  const regionOptions = storeMasterLookupsQuery.data?.regions ?? []
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

  return (
    <section className="page-stack">
      <section className="hero-panel">
        <div>
          <div className="eyebrow">{t('adminIntegrations.heroEyebrow')}</div>
          <h2 className="hero-title">{t('adminIntegrations.title')}</h2>
          <p className="hero-copy">{t('adminIntegrations.heroCopy')}</p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label={t('adminIntegrations.totalBatches')} value={String(overview.totals.all)} />
          <MetricAccent label={t('adminIntegrations.needsAction')} value={String(overview.healthTotals.needsAction)} />
          <MetricAccent label={t('adminIntegrations.retryReady')} value={String(overview.healthTotals.retryReady)} />
        </div>
      </section>

      {feedback ? (
        <section className="panel">
          <div className="toolbar-cluster">
            <div className="inline-state inline-state-accent">{feedback}</div>
            {createdBatchId ? (
              <Link className="back-link" to={`/admin/integrations/${createdBatchId}`}>
                <span>{t('adminIntegrations.openBatchDetail')}</span>
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="metric-grid">
        <MetricCard title={t('adminIntegrations.healthy')} value={overview.healthTotals.healthy} note={t('adminIntegrations.healthyNote', { count: overview.totals.completed })} icon={<Layers2 size={18} />} tone="calm" />
        <MetricCard title={t('adminIntegrations.blocked')} value={overview.healthTotals.blocked} note={t('adminIntegrations.blockedNote')} icon={<ShieldAlert size={18} />} tone="warning" />
        <MetricCard title={t('adminIntegrations.retryReady')} value={overview.healthTotals.retryReady} note={t('adminIntegrations.retryReadyNote')} icon={<TimerReset size={18} />} tone="accent" />
        <MetricCard title={t('adminIntegrations.needsAction')} value={overview.healthTotals.needsAction} note={t('adminIntegrations.needsActionNote')} icon={<AlertTriangle size={18} />} tone="danger" />
        <MetricCard title={t('adminIntegrations.stuck')} value={overview.healthTotals.stuck} note={t('adminIntegrations.stuckNote')} icon={<Clock3 size={18} />} tone="danger" />
      </section>

      <section className="two-up-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t('adminIntegrations.latestPointers')}</div>
              <h3>{t('adminIntegrations.latestTitle')}</h3>
            </div>
          </div>
          <div className="key-grid">
            <KeyValue label={t('adminIntegrations.latestCompleted')} value={overview.latest.completedBatchId ?? t('adminIntegrations.noCompletedBatch')} />
            <KeyValue label={t('adminIntegrations.latestFailed')} value={overview.latest.failedBatchId ?? t('adminIntegrations.noFailedBatch')} />
            <KeyValue label={t('adminIntegrations.latestInProgress')} value={overview.latest.inProgressBatchId ?? t('adminIntegrations.noActiveBatch')} />
            <KeyValue label={t('adminIntegrations.latestStuck')} value={overview.latest.stuckBatchId ?? t('adminIntegrations.noStuckBatch')} />
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t('adminIntegrations.systemReading')}</div>
              <h3>{t('adminIntegrations.batchFlowBalance')}</h3>
            </div>
          </div>
          <StatusBar label={t('adminIntegrations.healthy')} value={overview.healthTotals.healthy} total={overview.totals.all} tone="calm" />
          <StatusBar label={t('adminIntegrations.inProgress')} value={overview.healthTotals.inProgress} total={overview.totals.all} tone="neutral" />
          <StatusBar label={t('adminIntegrations.retryReady')} value={overview.healthTotals.retryReady} total={overview.totals.all} tone="accent" />
          <StatusBar label={t('adminIntegrations.blockedNeedsAction')} value={overview.healthTotals.blocked + overview.healthTotals.needsAction} total={overview.totals.all} tone="danger" />
        </article>
      </section>

      <section className="panel">
        <div className="panel-heading panel-heading-spread">
          <div>
            <div className="eyebrow">{t('adminIntegrations.importContract')}</div>
            <h3>{t('adminIntegrations.testPayloadTemplate')}</h3>
            <p className="panel-copy">{t('adminIntegrations.importContractCopy')}</p>
          </div>
          <label className="control-select">
            <span className="sr-only">{t('adminIntegrations.templateSourceSystem')}</span>
            <select
              value={templateSourceSystem}
              onChange={(event) => {
                setTemplateSourceSystem(event.target.value as 'nebim_v3' | 'power_bi')
                setSelectedTemplateSourceCode('')
              }}
            >
              <option value="nebim_v3">Nebim V3</option>
              <option value="power_bi">Power BI</option>
            </select>
          </label>
        </div>

        {importTemplateQuery.isLoading ? (
          <div className="inline-state inline-state-neutral">{t('adminIntegrations.loadingTemplate')}</div>
        ) : importTemplateQuery.isError ? (
          <div className="inline-state inline-state-danger">{getErrorMessage(importTemplateQuery.error)}</div>
        ) : importTemplateQuery.data ? (
          <div className="stacked-layout">
            <div className="toolbar-cluster">
              <label className="control-select">
                <span className="sr-only">{t('adminIntegrations.executionSource')}</span>
                <select
                  value={resolvedTemplateSourceCode}
                  onChange={(event) => setSelectedTemplateSourceCode(event.target.value)}
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
                onClick={() => {
                  if (!resolvedTemplateSourceCode) {
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
                }}
              >
                {createBatchMutation.isPending ? t('adminIntegrations.running') : t('adminIntegrations.runSampleImport')}
              </button>
            </div>
            {compatibleSources.length === 0 ? (
              <div className="inline-state inline-state-warning">
                {t('adminIntegrations.sourceSystemNeedsKpiSource')}
              </div>
            ) : null}
            <div className="queue-meta">
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
            {importTemplateQuery.data.note ? (
              <div className="inline-state inline-state-neutral">{importTemplateQuery.data.note}</div>
            ) : null}
            <pre className="code-block">
              {JSON.stringify(importTemplateQuery.data.requestBody, null, 2)}
            </pre>
          </div>
        ) : null}
      </section>

      <section className="panel" aria-label={t('adminIntegrations.storeMasterAria')}>
        <div className="panel-heading panel-heading-spread">
          <div>
            <div className="eyebrow">{t('adminIntegrations.masterData')}</div>
            <h3>{t('adminIntegrations.storeMasterData')}</h3>
            <p className="panel-copy">{t('adminIntegrations.storeMasterCopy')}</p>
          </div>
          <div className="toolbar-cluster">
            <label className="search-field">
              <span className="sr-only">{t('adminIntegrations.searchStores')}</span>
              <input
                value={storeMasterSearch}
                onChange={(event) => setStoreMasterSearch(event.target.value)}
                placeholder={t('adminIntegrations.searchStoreOrRegion')}
              />
            </label>
            <label className="control-select">
              <span className="sr-only">{t('adminIntegrations.filterStoreImportScope')}</span>
              <select
                value={storeMasterEnabledFilter}
                onChange={(event) =>
                  setStoreMasterEnabledFilter(event.target.value as 'all' | 'enabled' | 'disabled')
                }
              >
                <option value="all">{t('adminIntegrations.allStores')}</option>
                <option value="enabled">{t('adminIntegrations.included')}</option>
                <option value="disabled">{t('adminIntegrations.excluded')}</option>
              </select>
            </label>
            <label className="control-select">
              <span className="sr-only">{t('adminIntegrations.filterStoreStatus')}</span>
              <select
                value={storeMasterStatusFilter}
                onChange={(event) =>
                  setStoreMasterStatusFilter(event.target.value as 'all' | StoreMasterStatus)
                }
              >
                <option value="all">{t('adminIntegrations.allStatuses')}</option>
                {storeStatusOptions.map((status) => (
                  <option key={status.value} value={status.value}>
                    {formatStoreStatusLabel(status.value, t)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {storeMasterFeedback ? (
          <div className="inline-state inline-state-accent">{storeMasterFeedback}</div>
        ) : null}

        {storeMasterQuery.isLoading || storeMasterLookupsQuery.isLoading ? (
          <div className="inline-state inline-state-neutral">{t('adminIntegrations.loadingStoreMaster')}</div>
        ) : storeMasterQuery.isError ? (
          <div className="inline-state inline-state-danger">{getErrorMessage(storeMasterQuery.error)}</div>
        ) : storeMasterLookupsQuery.isError ? (
          <div className="inline-state inline-state-danger">{getErrorMessage(storeMasterLookupsQuery.error)}</div>
        ) : (storeMasterQuery.data?.items.length ?? 0) === 0 ? (
          <EmptyState title={t('adminIntegrations.noStoresTitle')} copy={t('adminIntegrations.noStoresCopy')} />
        ) : (
          <div className="scope-list">
            {storeMasterQuery.data?.items.map((store) => (
              <div className="scope-row" key={store.storeId}>
                <div>
                  <div className="queue-title">{store.storeName}</div>
                  <div className="queue-meta">
                    <span>
                      {store.storeCode} / {store.regionName ?? t('adminIntegrations.noRegion')} / {formatStoreTypeLabel(normalizeStoreType(store.storeType), t)}
                    </span>
                    <span>{formatStoreStatusLabel(normalizeStoreStatus(store.status), t)}</span>
                  </div>
                </div>
                <div className="scope-controls">
                  <label className="field-block compact-field">
                    <span>{t('adminIntegrations.type')}</span>
                    <select
                      aria-label={`${store.storeName} store type`}
                      value={normalizeStoreType(store.storeType)}
                      disabled={updateStoreMasterMutation.isPending}
                      onChange={(event) =>
                        submitStoreMasterUpdate(store, {
                          storeType: event.target.value as StoreMasterType,
                        })
                      }
                    >
                      {storeTypeOptions.map((type) => (
                        <option key={type.value} value={type.value}>
                          {formatStoreTypeLabel(type.value, t)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field-block compact-field">
                    <span>{t('adminIntegrations.region')}</span>
                    <select
                      aria-label={`${store.storeName} region`}
                      value={store.regionId ?? ''}
                      disabled={updateStoreMasterMutation.isPending || regionOptions.length === 0}
                      onChange={(event) =>
                        submitStoreMasterUpdate(store, {
                          regionId: event.target.value,
                        })
                      }
                    >
                      {regionOptions.length === 0 ? <option value="">{t('adminIntegrations.noActiveRegions')}</option> : null}
                      {regionOptions.map((region) => (
                        <option key={region.regionId} value={region.regionId}>
                          {region.regionName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field-block compact-field">
                    <span>{t('adminIntegrations.status')}</span>
                    <select
                      aria-label={`${store.storeName} status`}
                      value={normalizeStoreStatus(store.status)}
                      disabled={updateStoreMasterMutation.isPending}
                      onChange={(event) =>
                        submitStoreMasterUpdate(store, {
                          status: event.target.value as StoreMasterStatus,
                        })
                      }
                    >
                      {storeStatusOptions.map((status) => (
                        <option key={status.value} value={status.value}>
                          {formatStoreStatusLabel(status.value, t)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="scope-toggle">
                    <input
                      aria-label={`${store.storeName} KPI import enabled`}
                      type="checkbox"
                      checked={store.kpiImportEnabled}
                      disabled={updateStoreMasterMutation.isPending}
                      onChange={(event) =>
                        submitStoreMasterUpdate(store, {
                          kpiImportEnabled: event.target.checked,
                        })
                      }
                    />
                    <span>{store.kpiImportEnabled ? t('adminIntegrations.included') : t('adminIntegrations.excluded')}</span>
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-heading panel-heading-spread">
          <div>
            <div className="eyebrow">{t('adminIntegrations.powerBiEyebrow')}</div>
            <h3>{t('adminIntegrations.powerBiTitle')}</h3>
            <p className="panel-copy">{t('adminIntegrations.powerBiCopy')}</p>
          </div>
        </div>

        <div className="form-grid">
          <label className="field-block">
            <span>{t('adminIntegrations.powerBiKpiSource')}</span>
            <select
              value={resolvedPowerBiSourceCode}
              onChange={(event) => setPowerBiSourceCode(event.target.value)}
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
                setPowerBiPeriodType(event.target.value as 'daily' | 'monthly' | 'custom')
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
                onChange={(event) => setPowerBiPeriodMonth(event.target.value)}
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
                  onChange={(event) => {
                    setPowerBiPeriodStart(event.target.value)
                    if (powerBiPeriodType === 'daily') {
                      setPowerBiPeriodEnd(event.target.value)
                    }
                  }}
                />
              </label>
              <label className="field-block">
                <span>{t('adminIntegrations.end')}</span>
                <input
                  aria-label={t('adminIntegrations.end')}
                  type="date"
                  value={powerBiPeriodType === 'daily' ? powerBiPeriodStart : powerBiPeriodEnd}
                  disabled={powerBiPeriodType === 'daily'}
                  onChange={(event) => setPowerBiPeriodEnd(event.target.value)}
                />
              </label>
            </>
          )}

          <label className="field-block">
            <span>{t('adminIntegrations.personnelExport')}</span>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(event) => setPersonnelFile(event.target.files?.[0] ?? null)}
            />
          </label>

          <label className="field-block">
            <span>{t('adminIntegrations.storeExport')}</span>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(event) => setStoreFile(event.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        <div className="toolbar-cluster">
          <button
            className="control-button"
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

        {uploadFeedback ? (
          <div className="toolbar-cluster">
            <div className="inline-state inline-state-accent">{uploadFeedback}</div>
            {uploadedBatchId ? (
              <Link className="back-link" to={`/admin/integrations/${uploadedBatchId}`}>
                <span>{t('adminIntegrations.openBatchDetail')}</span>
              </Link>
            ) : null}
          </div>
        ) : null}

        {uploadPowerBiMutation.data?.data.summary ? (
          <>
            <div className="key-grid">
            <div className="key-item">
              <span>{t('adminIntegrations.period')}</span>
              <strong>
                {uploadPowerBiMutation.data.data.summary.periodMonth ??
                  `${uploadPowerBiMutation.data.data.summary.periodStart} / ${uploadPowerBiMutation.data.data.summary.periodEnd}`}
              </strong>
            </div>
            <div className="key-item">
              <span>{t('adminIntegrations.canonicalKpiRows')}</span>
              <strong>{uploadPowerBiMutation.data.data.summary.canonicalRowCount}</strong>
            </div>
            <div className="key-item">
              <span>{t('adminIntegrations.personnelRowsRead')}</span>
              <strong>{uploadPowerBiMutation.data.data.summary.personnelRowsRead}</strong>
            </div>
            <div className="key-item">
              <span>{t('adminIntegrations.ignoredPersonnelRows')}</span>
              <strong>{uploadPowerBiMutation.data.data.summary.ignoredPersonnelRows}</strong>
            </div>
            <div className="key-item">
              <span>{t('adminIntegrations.scopeExcludedPersonnelRows')}</span>
              <strong>{uploadPowerBiMutation.data.data.summary.scopeExcludedPersonnelRows}</strong>
            </div>
            <div className="key-item">
              <span>{t('adminIntegrations.personnelGrossSalesRows')}</span>
              <strong>{uploadPowerBiMutation.data.data.summary.personnelGrossSalesRows}</strong>
            </div>
            <div className="key-item">
              <span>{t('adminIntegrations.negativePersonnelRowsIgnored')}</span>
              <strong>{uploadPowerBiMutation.data.data.summary.negativePersonnelRowsIgnored}</strong>
            </div>
            <div className="key-item">
              <span>{t('adminIntegrations.storeRowsRead')}</span>
              <strong>{uploadPowerBiMutation.data.data.summary.storeRowsRead}</strong>
            </div>
            <div className="key-item">
              <span>{t('adminIntegrations.scopeExcludedStoreRows')}</span>
              <strong>{uploadPowerBiMutation.data.data.summary.scopeExcludedStoreRows}</strong>
            </div>
            <div className="key-item">
              <span>{t('adminIntegrations.mappingMode')}</span>
              <strong>{uploadPowerBiMutation.data.data.summary.mappingMode}</strong>
            </div>
            </div>

            {uploadPowerBiMutation.data.data.summary.reconciliation.items.length > 0 ? (
              <div className="key-grid" aria-label={t('adminIntegrations.reconciliationAria')}>
                <div className="key-item">
                  <span>{t('adminIntegrations.comparedStores')}</span>
                  <strong>
                    {uploadPowerBiMutation.data.data.summary.reconciliation.comparedStoreCount}
                  </strong>
                </div>
                <div className="key-item">
                  <span>{t('adminIntegrations.balancedStores')}</span>
                  <strong>
                    {uploadPowerBiMutation.data.data.summary.reconciliation.balancedStoreCount}
                  </strong>
                </div>
                <div className="key-item">
                  <span>{t('adminIntegrations.warningStores')}</span>
                  <strong>
                    {uploadPowerBiMutation.data.data.summary.reconciliation.warningStoreCount}
                  </strong>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </section>

      <section className="panel">
        <div className="panel-heading panel-heading-spread">
          <div>
            <div className="eyebrow">{t('adminIntegrations.operatorQueue')}</div>
            <h3>{t('adminIntegrations.needsActionBatches')}</h3>
            <p className="panel-copy">{t('adminIntegrations.operatorQueueCopy')}</p>
          </div>
          <ReportingToolbar
            sortValue={sortBy}
            onSortChange={(value) => setSortBy(value as typeof sortBy)}
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
            <label className="search-field">
              <span className="sr-only">{t('adminIntegrations.filterQueue')}</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('adminIntegrations.searchQueuePlaceholder')}
              />
            </label>
          </ReportingToolbar>
        </div>

        <div className="toolbar-cluster">
          <label className="control-select">
            <span className="sr-only">{t('adminIntegrations.filterEntityType')}</span>
            <select value={entityTypeFilter} onChange={(event) => { setOffset(0); setEntityTypeFilter(event.target.value) }}>
              <option value="">{t('adminIntegrations.allEntities')}</option>
              {['employee', 'store', 'kpi', 'assignment', 'position', 'company', 'region'].map((entity) => (
                <option key={entity} value={entity}>{entity}</option>
              ))}
            </select>
          </label>
          <label className="control-select">
            <span className="sr-only">{t('adminIntegrations.filterStatus')}</span>
            <select value={statusFilter} onChange={(event) => { setOffset(0); setStatusFilter(event.target.value) }}>
              <option value="">{t('adminIntegrations.allStatuses')}</option>
              {['pending', 'queued', 'processing', 'completed', 'completed_with_errors', 'failed'].map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>
          <button className="control-button" type="button" onClick={() => { setOffset(0); setEntityTypeFilter(''); setStatusFilter(''); setSearch('') }}>
            {t('adminIntegrations.clearFilters')}
          </button>
        </div>

        {sortedItems.length === 0 ? (
          <EmptyState title={t('adminIntegrations.noQueueItemsTitle')} copy={t('adminIntegrations.noQueueItemsCopy')} />
        ) : (
          <div className="queue-list">
            {sortedItems.map((item) => (
              <div className="queue-row" key={item.batchId}>
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
          <button className="control-button" type="button" onClick={() => setOffset((current) => Math.max(0, current - PAGE_SIZE))} disabled={!canGoBack}>
            {t('adminIntegrations.previous')}
          </button>
          <span className="inline-state inline-state-neutral">
            {meta ? `${offset + 1}-${Math.min(offset + PAGE_SIZE, meta.total)} / ${meta.total}` : t('adminIntegrations.zeroResults')}
          </span>
          <button className="control-button" type="button" onClick={() => setOffset((current) => current + PAGE_SIZE)} disabled={!canGoForward}>
            {t('adminIntegrations.next')}
          </button>
        </div>
      </section>
    </section>
  )
}

function formatStoreTypeLabel(value: string, t: TranslateFunction) {
  switch (value) {
    case 'company':
      return t('adminIntegrations.storeType.company')
    case 'franchise':
      return t('adminIntegrations.storeType.franchise')
    case 'operator':
      return t('adminIntegrations.storeType.operator')
    default:
      return value
  }
}

function formatStoreStatusLabel(value: string, t: TranslateFunction) {
  switch (value) {
    case 'active':
      return t('adminIntegrations.storeStatus.active')
    case 'inactive':
      return t('adminIntegrations.storeStatus.inactive')
    case 'closed':
      return t('adminIntegrations.storeStatus.closed')
    default:
      return value
  }
}
