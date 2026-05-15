import { useDeferredValue, useMemo, useState, type ReactNode } from 'react'
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
  retryImportBatch,
  uploadPowerBiExport,
} from '../features/integrations/api'
import type { TranslateFunction } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import { formatState, getErrorMessage, mapHealthTone } from '../lib/format'

const PAGE_SIZE = 12

type IntegrationTab = 'uploads' | 'evidence' | 'errors'
type PowerBiPeriodType = 'daily' | 'monthly' | 'custom'

function getCurrentIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function getCurrentIsoMonth() {
  return getCurrentIsoDate().slice(0, 7)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('tr-TR').format(value)
}

function formatOptionalBatch(value: string | null, t: TranslateFunction) {
  return value ?? t('adminIntegrations.none')
}

export function IntegrationDashboardPage() {
  const { t } = useLocalization()
  const [activeTab, setActiveTab] = useState<IntegrationTab>('uploads')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'priority' | 'errors' | 'records' | 'entity'>('priority')
  const [offset, setOffset] = useState(0)
  const [entityTypeFilter, setEntityTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [createdBatchId, setCreatedBatchId] = useState<string | null>(null)
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null)
  const [uploadedBatchId, setUploadedBatchId] = useState<string | null>(null)
  const [templateSourceSystem, setTemplateSourceSystem] = useState<'nebim_v3' | 'power_bi'>('power_bi')
  const [selectedTemplateSourceCode, setSelectedTemplateSourceCode] = useState('')
  const [powerBiSourceCode, setPowerBiSourceCode] = useState('')
  const [powerBiPeriodType, setPowerBiPeriodType] = useState<PowerBiPeriodType>('monthly')
  const [powerBiPeriodMonth, setPowerBiPeriodMonth] = useState(getCurrentIsoMonth)
  const [powerBiPeriodStart, setPowerBiPeriodStart] = useState(getCurrentIsoDate)
  const [powerBiPeriodEnd, setPowerBiPeriodEnd] = useState(getCurrentIsoDate)
  const [personnelFile, setPersonnelFile] = useState<File | null>(null)
  const [storeFile, setStoreFile] = useState<File | null>(null)
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

  const tabs: Array<{ id: IntegrationTab; label: string; count?: number }> = [
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
          <button className="control-button integration-management-primary-button" type="button" onClick={() => setActiveTab('uploads')}>
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
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.label}</span>
            {typeof tab.count === 'number' ? <strong>{formatNumber(tab.count)}</strong> : null}
          </button>
        ))}
      </nav>

      {activeTab === 'uploads' ? (
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
                      setPowerBiPeriodType(event.target.value as PowerBiPeriodType)
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
              </div>

              <div className="integration-management-upload-pair">
                <label className="integration-management-upload-drop">
                  <FileSpreadsheet size={20} aria-hidden="true" />
                  <strong>{t('adminIntegrations.personnelExport')}</strong>
                  <span>{personnelFile?.name ?? t('adminIntegrations.noFileSelected')}</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(event) => setPersonnelFile(event.target.files?.[0] ?? null)}
                  />
                </label>
                <label className="integration-management-upload-drop">
                  <Store size={20} aria-hidden="true" />
                  <strong>{t('adminIntegrations.storeExport')}</strong>
                  <span>{storeFile?.name ?? t('adminIntegrations.noFileSelected')}</span>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(event) => setStoreFile(event.target.files?.[0] ?? null)}
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
      ) : null}

      {activeTab === 'evidence' ? (
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
                  onChange={(event) => {
                    setTemplateSourceSystem(event.target.value as 'nebim_v3' | 'power_bi')
                    setSelectedTemplateSourceCode('')
                  }}
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
      ) : null}

      {activeTab === 'errors' ? (
        <section className="integration-management-panel" aria-label={t('adminIntegrations.errorsTabAria')}>
          <div className="integration-management-panel-head">
            <div>
              <div className="eyebrow">{t('adminIntegrations.tabErrors')}</div>
              <h3>{t('adminIntegrations.errorsPanelTitle')}</h3>
              <p className="integration-management-panel-copy">{t('adminIntegrations.errorsPanelCopy')}</p>
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
              <label className="search-field integration-management-search">
                <Search size={16} aria-hidden="true" />
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
      ) : null}
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
