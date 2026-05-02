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
      setStoreMasterFeedback('Store must have a region before it can be updated.')
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
    return <ScreenState title="Loading integration surface" copy="Pulling overview, health totals, and operator queue." />
  }

  if (overviewQuery.isError) {
    return <ScreenState title="Integration dashboard unavailable" copy={getErrorMessage(overviewQuery.error)} tone="error" />
  }

  if (needsActionQuery.isError) {
    return <ScreenState title="Needs-action queue unavailable" copy={getErrorMessage(needsActionQuery.error)} tone="error" />
  }

  if (lookupsQuery.isError) {
    return <ScreenState title="Integration lookups unavailable" copy={getErrorMessage(lookupsQuery.error)} tone="error" />
  }

  const overview = overviewQuery.data
  if (!overview) {
    return <ScreenState title="Integration overview unavailable" copy="Overview data was not returned by the API." tone="error" />
  }

  const meta = needsActionQuery.data?.meta
  const canGoBack = offset > 0
  const canGoForward = meta ? offset + PAGE_SIZE < meta.total : false
  const storeTypeOptions = storeMasterLookupsQuery.data?.storeTypes ?? [
    { value: 'company' as const, label: 'Company' },
    { value: 'franchise' as const, label: 'Franchise' },
    { value: 'operator' as const, label: 'Operator' },
  ]
  const storeStatusOptions = storeMasterLookupsQuery.data?.statuses ?? [
    { value: 'active' as const, label: 'Active' },
    { value: 'inactive' as const, label: 'Inactive' },
    { value: 'closed' as const, label: 'Closed' },
  ]
  const regionOptions = storeMasterLookupsQuery.data?.regions ?? []
  const isPowerBiPeriodValid =
    powerBiPeriodType === 'monthly'
      ? Boolean(powerBiPeriodMonth)
      : Boolean(powerBiPeriodStart && powerBiPeriodEnd && powerBiPeriodEnd >= powerBiPeriodStart)

  return (
    <section className="page-stack">
      <section className="hero-panel">
        <div>
          <div className="eyebrow">Integration Operations</div>
          <h2 className="hero-title">See friction early, not after the batch disappears into the queue.</h2>
          <p className="hero-copy">
            This dashboard is tuned for operational action: blocked dependencies, retry posture,
            in-progress pressure, and which batch deserves attention next.
          </p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label="Total batches" value={String(overview.totals.all)} />
          <MetricAccent label="Needs action" value={String(overview.healthTotals.needsAction)} />
          <MetricAccent label="Retry ready" value={String(overview.healthTotals.retryReady)} />
        </div>
      </section>

      {feedback ? (
        <section className="panel">
          <div className="toolbar-cluster">
            <div className="inline-state inline-state-accent">{feedback}</div>
            {createdBatchId ? (
              <Link className="back-link" to={`/admin/integrations/${createdBatchId}`}>
                <span>Batch detail ac</span>
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="metric-grid">
        <MetricCard title="Healthy" value={overview.healthTotals.healthy} note={`${overview.totals.completed} completed cleanly`} icon={<Layers2 size={18} />} tone="calm" />
        <MetricCard title="Blocked" value={overview.healthTotals.blocked} note="Dependency mappings missing" icon={<ShieldAlert size={18} />} tone="warning" />
        <MetricCard title="Retry ready" value={overview.healthTotals.retryReady} note="Rows can likely be reprocessed now" icon={<TimerReset size={18} />} tone="accent" />
        <MetricCard title="Needs action" value={overview.healthTotals.needsAction} note="Manual review required" icon={<AlertTriangle size={18} />} tone="danger" />
        <MetricCard title="Stuck" value={overview.healthTotals.stuck} note="Exceeded in-progress threshold" icon={<Clock3 size={18} />} tone="danger" />
      </section>

      <section className="two-up-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Latest pointers</div>
              <h3>Where the queue last changed state</h3>
            </div>
          </div>
          <div className="key-grid">
            <KeyValue label="Latest completed" value={overview.latest.completedBatchId ?? 'No completed batch yet'} />
            <KeyValue label="Latest failed" value={overview.latest.failedBatchId ?? 'No failed batch yet'} />
            <KeyValue label="Latest in progress" value={overview.latest.inProgressBatchId ?? 'No active batch'} />
            <KeyValue label="Latest stuck" value={overview.latest.stuckBatchId ?? 'No stuck batch'} />
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">System reading</div>
              <h3>Batch flow balance</h3>
            </div>
          </div>
          <StatusBar label="Healthy" value={overview.healthTotals.healthy} total={overview.totals.all} tone="calm" />
          <StatusBar label="In progress" value={overview.healthTotals.inProgress} total={overview.totals.all} tone="neutral" />
          <StatusBar label="Retry ready" value={overview.healthTotals.retryReady} total={overview.totals.all} tone="accent" />
          <StatusBar label="Blocked + needs action" value={overview.healthTotals.blocked + overview.healthTotals.needsAction} total={overview.totals.all} tone="danger" />
        </article>
      </section>

      <section className="panel">
        <div className="panel-heading panel-heading-spread">
          <div>
            <div className="eyebrow">Import contract</div>
            <h3>Test payload template</h3>
            <p className="panel-copy">
              Real connector gelmeden once KPI import batch body yapisini buradan referans alabilirsin.
            </p>
          </div>
          <label className="control-select">
            <span className="sr-only">Template source system</span>
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
          <div className="inline-state inline-state-neutral">Loading template...</div>
        ) : importTemplateQuery.isError ? (
          <div className="inline-state inline-state-danger">{getErrorMessage(importTemplateQuery.error)}</div>
        ) : importTemplateQuery.data ? (
          <div className="stacked-layout">
            <div className="toolbar-cluster">
              <label className="control-select">
                <span className="sr-only">Execution source</span>
                <select
                  value={resolvedTemplateSourceCode}
                  onChange={(event) => setSelectedTemplateSourceCode(event.target.value)}
                  disabled={compatibleSources.length === 0}
                >
                  {compatibleSources.length === 0 ? <option value="">Aktif KPI source yok</option> : null}
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
                {createBatchMutation.isPending ? 'Calisiyor...' : 'Sample import calistir'}
              </button>
            </div>
            {compatibleSources.length === 0 ? (
              <div className="inline-state inline-state-warning">
                Bu source system icin aktif bir KPI integration source olusturman gerekiyor.
              </div>
            ) : null}
            <div className="queue-meta">
              <span>Entity: {importTemplateQuery.data.entityType}</span>
              <span>Source: {importTemplateQuery.data.sourceSystem}</span>
              <span>Execution source: {resolvedTemplateSourceCode || 'none'}</span>
            </div>
            {createdBatchId ? (
              <div className="inline-state inline-state-neutral">
                Son olusan batch: <code>{createdBatchId}</code>
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

      <section className="panel" aria-label="Store master data">
        <div className="panel-heading panel-heading-spread">
          <div>
            <div className="eyebrow">Master data</div>
            <h3>Store master data</h3>
            <p className="panel-copy">
              Store type, region, status, and Excel KPI import scope are managed from one controlled surface.
            </p>
          </div>
          <div className="toolbar-cluster">
            <label className="search-field">
              <span className="sr-only">Search stores</span>
              <input
                value={storeMasterSearch}
                onChange={(event) => setStoreMasterSearch(event.target.value)}
                placeholder="Search store or region"
              />
            </label>
            <label className="control-select">
              <span className="sr-only">Filter store import scope</span>
              <select
                value={storeMasterEnabledFilter}
                onChange={(event) =>
                  setStoreMasterEnabledFilter(event.target.value as 'all' | 'enabled' | 'disabled')
                }
              >
                <option value="all">All stores</option>
                <option value="enabled">Included</option>
                <option value="disabled">Excluded</option>
              </select>
            </label>
            <label className="control-select">
              <span className="sr-only">Filter store status</span>
              <select
                value={storeMasterStatusFilter}
                onChange={(event) =>
                  setStoreMasterStatusFilter(event.target.value as 'all' | StoreMasterStatus)
                }
              >
                <option value="all">All statuses</option>
                {storeStatusOptions.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
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
          <div className="inline-state inline-state-neutral">Loading store master data...</div>
        ) : storeMasterQuery.isError ? (
          <div className="inline-state inline-state-danger">{getErrorMessage(storeMasterQuery.error)}</div>
        ) : storeMasterLookupsQuery.isError ? (
          <div className="inline-state inline-state-danger">{getErrorMessage(storeMasterLookupsQuery.error)}</div>
        ) : (storeMasterQuery.data?.items.length ?? 0) === 0 ? (
          <EmptyState title="No stores matched this master data filter." copy="Clear the filters to inspect the store list." />
        ) : (
          <div className="scope-list">
            {storeMasterQuery.data?.items.map((store) => (
              <div className="scope-row" key={store.storeId}>
                <div>
                  <div className="queue-title">{store.storeName}</div>
                  <div className="queue-meta">
                    <span>
                      {store.storeCode} / {store.regionName ?? 'No region'} / {normalizeStoreType(store.storeType)}
                    </span>
                    <span>{store.status}</span>
                  </div>
                </div>
                <div className="scope-controls">
                  <label className="field-block compact-field">
                    <span>Type</span>
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
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field-block compact-field">
                    <span>Region</span>
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
                      {regionOptions.length === 0 ? <option value="">No active regions</option> : null}
                      {regionOptions.map((region) => (
                        <option key={region.regionId} value={region.regionId}>
                          {region.regionName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field-block compact-field">
                    <span>Status</span>
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
                          {status.label}
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
                    <span>{store.kpiImportEnabled ? 'Included' : 'Excluded'}</span>
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
            <div className="eyebrow">Gecici Power BI akisi</div>
            <h3>Excel export yukle</h3>
            <p className="panel-copy">
              Bu adaptör gecici. Personel için `Adı + Mağaza Adı`, mağaza için `Mağaza Adı` eşleşmesiyle veri içeri alınır.
            </p>
          </div>
        </div>

        <div className="form-grid">
          <label className="field-block">
            <span>Power BI KPI source</span>
            <select
              value={resolvedPowerBiSourceCode}
              onChange={(event) => setPowerBiSourceCode(event.target.value)}
              disabled={powerBiSources.length === 0}
            >
              {powerBiSources.length === 0 ? <option value="">Aktif Power BI KPI source yok</option> : null}
              {powerBiSources.map((item) => (
                <option key={item.sourceId} value={item.sourceCode}>
                  {item.sourceCode} - {item.sourceName}
                </option>
              ))}
            </select>
          </label>

          <label className="field-block">
            <span>Donem tipi</span>
            <select
              aria-label="Donem tipi"
              value={powerBiPeriodType}
              onChange={(event) =>
                setPowerBiPeriodType(event.target.value as 'daily' | 'monthly' | 'custom')
              }
            >
              <option value="monthly">Aylik snapshot</option>
              <option value="daily">Gunluk veri</option>
              <option value="custom">Ozel tarih araligi</option>
            </select>
          </label>

          {powerBiPeriodType === 'monthly' ? (
            <label className="field-block">
              <span>Donem ayi</span>
              <input
                type="month"
                value={powerBiPeriodMonth}
                onChange={(event) => setPowerBiPeriodMonth(event.target.value)}
              />
            </label>
          ) : (
            <>
              <label className="field-block">
                <span>Baslangic</span>
                <input
                  aria-label="Baslangic"
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
                <span>Bitis</span>
                <input
                  aria-label="Bitis"
                  type="date"
                  value={powerBiPeriodType === 'daily' ? powerBiPeriodStart : powerBiPeriodEnd}
                  disabled={powerBiPeriodType === 'daily'}
                  onChange={(event) => setPowerBiPeriodEnd(event.target.value)}
                />
              </label>
            </>
          )}

          <label className="field-block">
            <span>Personel export</span>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(event) => setPersonnelFile(event.target.files?.[0] ?? null)}
            />
          </label>

          <label className="field-block">
            <span>Magaza export</span>
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
            disabled={
              uploadPowerBiMutation.isPending ||
              powerBiSources.length === 0 ||
              (!personnelFile && !storeFile) ||
              !resolvedPowerBiSourceCode ||
              !isPowerBiPeriodValid
            }
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
            {uploadPowerBiMutation.isPending ? 'Yukleniyor...' : 'Power BI export yukle'}
          </button>
          <span className="inline-state inline-state-neutral">
            Personel pozitif satış brüt performans, mağaza cirosu net hedef performansı olarak işlenir.
          </span>
        </div>

        {uploadFeedback ? (
          <div className="toolbar-cluster">
            <div className="inline-state inline-state-accent">{uploadFeedback}</div>
            {uploadedBatchId ? (
              <Link className="back-link" to={`/admin/integrations/${uploadedBatchId}`}>
                <span>Batch detail ac</span>
              </Link>
            ) : null}
          </div>
        ) : null}

        {uploadPowerBiMutation.data?.data.summary ? (
          <>
            <div className="key-grid">
            <div className="key-item">
              <span>Donem</span>
              <strong>
                {uploadPowerBiMutation.data.data.summary.periodMonth ??
                  `${uploadPowerBiMutation.data.data.summary.periodStart} / ${uploadPowerBiMutation.data.data.summary.periodEnd}`}
              </strong>
            </div>
            <div className="key-item">
              <span>Canonical KPI satiri</span>
              <strong>{uploadPowerBiMutation.data.data.summary.canonicalRowCount}</strong>
            </div>
            <div className="key-item">
              <span>Okunan personel satiri</span>
              <strong>{uploadPowerBiMutation.data.data.summary.personnelRowsRead}</strong>
            </div>
            <div className="key-item">
              <span>Ignore edilen personel satiri</span>
              <strong>{uploadPowerBiMutation.data.data.summary.ignoredPersonnelRows}</strong>
            </div>
            <div className="key-item">
              <span>Kapsam disi personel satiri</span>
              <strong>{uploadPowerBiMutation.data.data.summary.scopeExcludedPersonnelRows}</strong>
            </div>
            <div className="key-item">
              <span>Pozitif personel satis satiri</span>
              <strong>{uploadPowerBiMutation.data.data.summary.personnelGrossSalesRows}</strong>
            </div>
            <div className="key-item">
              <span>Eksi personel satiri</span>
              <strong>{uploadPowerBiMutation.data.data.summary.negativePersonnelRowsIgnored}</strong>
            </div>
            <div className="key-item">
              <span>Okunan magaza satiri</span>
              <strong>{uploadPowerBiMutation.data.data.summary.storeRowsRead}</strong>
            </div>
            <div className="key-item">
              <span>Kapsam disi magaza satiri</span>
              <strong>{uploadPowerBiMutation.data.data.summary.scopeExcludedStoreRows}</strong>
            </div>
            <div className="key-item">
              <span>Mapping modu</span>
              <strong>{uploadPowerBiMutation.data.data.summary.mappingMode}</strong>
            </div>
            </div>

            {uploadPowerBiMutation.data.data.summary.reconciliation.items.length > 0 ? (
              <div className="key-grid" aria-label="Power BI reconciliation summary">
                <div className="key-item">
                  <span>Karsilastirilan magaza</span>
                  <strong>
                    {uploadPowerBiMutation.data.data.summary.reconciliation.comparedStoreCount}
                  </strong>
                </div>
                <div className="key-item">
                  <span>Dengeli magaza</span>
                  <strong>
                    {uploadPowerBiMutation.data.data.summary.reconciliation.balancedStoreCount}
                  </strong>
                </div>
                <div className="key-item">
                  <span>Uyari veren magaza</span>
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
            <div className="eyebrow">Operator queue</div>
            <h3>Needs-action batches</h3>
            <p className="panel-copy">
              Filter by source, entity, reason, or batch id. Open a row to inspect dependency blockers, reconciliation posture, and row-level failures.
            </p>
          </div>
          <ReportingToolbar
            sortValue={sortBy}
            onSortChange={(value) => setSortBy(value as typeof sortBy)}
            sortOptions={[
              { value: 'priority', label: 'Priority state' },
              { value: 'errors', label: 'Most errors' },
              { value: 'records', label: 'Largest batch' },
              { value: 'entity', label: 'Entity type' },
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
              <span className="sr-only">Filter queue</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by batch, source, reason, or state"
              />
            </label>
          </ReportingToolbar>
        </div>

        <div className="toolbar-cluster">
          <label className="control-select">
            <span className="sr-only">Filter entity type</span>
            <select value={entityTypeFilter} onChange={(event) => { setOffset(0); setEntityTypeFilter(event.target.value) }}>
              <option value="">All entities</option>
              {['employee', 'store', 'kpi', 'assignment', 'position', 'company', 'region'].map((entity) => (
                <option key={entity} value={entity}>{entity}</option>
              ))}
            </select>
          </label>
          <label className="control-select">
            <span className="sr-only">Filter status</span>
            <select value={statusFilter} onChange={(event) => { setOffset(0); setStatusFilter(event.target.value) }}>
              <option value="">All statuses</option>
              {['pending', 'queued', 'processing', 'completed', 'completed_with_errors', 'failed'].map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>
          <button className="control-button" type="button" onClick={() => { setOffset(0); setEntityTypeFilter(''); setStatusFilter(''); setSearch('') }}>
            Clear filters
          </button>
        </div>

        {sortedItems.length === 0 ? (
          <EmptyState title="No queue items matched your filter." copy="Try a broader term or clear the filter to inspect the full operational queue." />
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
                    <span>{item.recordCount} records</span>
                    <span>{item.errorCount} errors</span>
                    <span>retry count {item.retryCount}</span>
                    {item.recommendedNextEntityType ? <span>next import: {item.recommendedNextEntityType}</span> : null}
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
                      {retryMutation.isPending ? 'Retrying...' : 'Retry batch'}
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}

        <div className="toolbar-cluster">
          <button className="control-button" type="button" onClick={() => setOffset((current) => Math.max(0, current - PAGE_SIZE))} disabled={!canGoBack}>
            Previous
          </button>
          <span className="inline-state inline-state-neutral">
            {meta ? `${offset + 1}-${Math.min(offset + PAGE_SIZE, meta.total)} / ${meta.total}` : '0 results'}
          </span>
          <button className="control-button" type="button" onClick={() => setOffset((current) => current + PAGE_SIZE)} disabled={!canGoForward}>
            Next
          </button>
        </div>
      </section>
    </section>
  )
}
