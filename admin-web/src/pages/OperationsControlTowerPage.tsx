import { useMemo, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  DatabaseZap,
  Layers3,
  ServerCog,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  EmptyState,
  KeyValue,
  MetricAccent,
  MetricCard,
  ScreenState,
  StatusPill,
  type Tone,
} from '../components/dashboard-primitives'
import {
  getImportOverview,
  getNeedsAction,
  type ImportOverview,
  type NeedsActionItem,
} from '../features/integrations/api'
import type { TranslateFunction } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import { getOperationsHealth, type OperationsHealth } from '../features/operations/api'
import {
  getSnapshotNeedsAction,
  getSnapshotOverview,
  type SnapshotNeedsActionItem,
  type SnapshotOverview,
} from '../features/snapshots/api'
import {
  getOffboardingRequests,
  getSellerCodeRequests,
} from '../features/workforce/api'
import { formatDateTime, getErrorMessage, mapHealthTone } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import { buildOperatorActions } from './operations-operator-action-model'
import { OperatorActionListPanel } from './operations-operator-action-list'
import { MetricCoveragePanel } from './operations-metric-coverage-panel'
import { summarizeWorkforcePressure } from './operations-workforce-signal-model'
import { WorkforceSignalPanel } from './operations-workforce-signal-panel'

const SIGNAL_STALE_TIME_MS = 30_000
const QUEUE_PREVIEW_SIZE = 4

type SignalStatus = {
  copy: string
  label: string
  tone: Tone
}

type DataQualitySnapshot = {
  blockedBatchCount: number
  errorRowCount: number
  mappingEntityTypes: string[]
  snapshotIssueCount: number
}

type ProviderBlocker = {
  id: string
  titleKey: TranslationKey
  copyKey: TranslationKey
  ownerKey: TranslationKey
}

type TranslationKey = Parameters<TranslateFunction>[0]

const providerBlockers: ProviderBlocker[] = [
  {
    id: 'auth-session',
    titleKey: 'adminOperations.blocker.authTitle',
    copyKey: 'adminOperations.blocker.authCopy',
    ownerKey: 'adminOperations.owner.auth',
  },
  {
    id: 'assigned-action-smoke',
    titleKey: 'adminOperations.blocker.actionTitle',
    copyKey: 'adminOperations.blocker.actionCopy',
    ownerKey: 'adminOperations.owner.auth',
  },
  {
    id: 'upload-smoke',
    titleKey: 'adminOperations.blocker.uploadTitle',
    copyKey: 'adminOperations.blocker.uploadCopy',
    ownerKey: 'adminOperations.owner.integration',
  },
  {
    id: 'restore-drill',
    titleKey: 'adminOperations.blocker.restoreTitle',
    copyKey: 'adminOperations.blocker.restoreCopy',
    ownerKey: 'adminOperations.owner.platform',
  },
  {
    id: 'alert-delivery',
    titleKey: 'adminOperations.blocker.alertTitle',
    copyKey: 'adminOperations.blocker.alertCopy',
    ownerKey: 'adminOperations.owner.platform',
  },
  {
    id: 'redis-bullmq',
    titleKey: 'adminOperations.blocker.redisTitle',
    copyKey: 'adminOperations.blocker.redisCopy',
    ownerKey: 'adminOperations.owner.platform',
  },
]

export function OperationsControlTowerPage() {
  const { locale, t } = useLocalization()
  const healthQuery = useQuery({
    queryKey: ['operations-health'],
    queryFn: getOperationsHealth,
    staleTime: SIGNAL_STALE_TIME_MS,
  })
  const importOverviewQuery = useQuery({
    queryKey: ['integration-overview'],
    queryFn: getImportOverview,
    staleTime: SIGNAL_STALE_TIME_MS,
  })
  const importNeedsActionQuery = useQuery({
    queryKey: ['integration-needs-action', 0, '', '', QUEUE_PREVIEW_SIZE],
    queryFn: () => getNeedsAction({ limit: QUEUE_PREVIEW_SIZE, offset: 0 }),
    staleTime: SIGNAL_STALE_TIME_MS,
  })
  const snapshotOverviewQuery = useQuery({
    queryKey: ['snapshot-overview'],
    queryFn: getSnapshotOverview,
    staleTime: SIGNAL_STALE_TIME_MS,
  })
  const snapshotNeedsActionQuery = useQuery({
    queryKey: ['snapshot-needs-action', 0, '', '', QUEUE_PREVIEW_SIZE],
    queryFn: () => getSnapshotNeedsAction({ limit: QUEUE_PREVIEW_SIZE, offset: 0 }),
    staleTime: SIGNAL_STALE_TIME_MS,
  })
  const sellerCodeRequestsQuery = useQuery({
    queryKey: ['operations-workforce', 'seller-code-requests', 'pending_hr_approval'],
    queryFn: () => getSellerCodeRequests({ status: 'pending_hr_approval' }),
    staleTime: SIGNAL_STALE_TIME_MS,
  })
  const offboardingRequestsQuery = useQuery({
    queryKey: ['operations-workforce', 'offboarding-requests', 'pending_hr_approval'],
    queryFn: () => getOffboardingRequests({ status: 'pending_hr_approval' }),
    staleTime: SIGNAL_STALE_TIME_MS,
  })

  const importNeedsActionItems = importNeedsActionQuery.data?.items ?? []
  const snapshotNeedsActionItems = snapshotNeedsActionQuery.data?.items ?? []
  const sellerCodeItems = sellerCodeRequestsQuery.data?.items ?? []
  const offboardingItems = offboardingRequestsQuery.data?.items ?? []
  const hasWorkforceSignalError = sellerCodeRequestsQuery.isError || offboardingRequestsQuery.isError
  const isInitialLoading = [
    healthQuery,
    importOverviewQuery,
    importNeedsActionQuery,
    snapshotOverviewQuery,
    snapshotNeedsActionQuery,
    sellerCodeRequestsQuery,
    offboardingRequestsQuery,
  ].every((query) => query.isLoading)

  const importActionCount = countImportActions(importOverviewQuery.data)
  const snapshotActionCount = countSnapshotActions(snapshotOverviewQuery.data)
  const dataQuality = summarizeDataQuality({
    importItems: importNeedsActionItems,
    importOverview: importOverviewQuery.data,
    snapshotOverview: snapshotOverviewQuery.data,
  })
  const workforcePressure = summarizeWorkforcePressure({
    offboardingRequests: offboardingRequestsQuery.data,
    sellerCodeRequests: sellerCodeRequestsQuery.data,
  })
  const workforcePressureTotal = hasWorkforceSignalError ? 0 : workforcePressure.total
  const operationalPressure = importActionCount + snapshotActionCount + workforcePressureTotal
  const hasSignalError =
    healthQuery.isError ||
    importOverviewQuery.isError ||
    importNeedsActionQuery.isError ||
    snapshotOverviewQuery.isError ||
    snapshotNeedsActionQuery.isError ||
    hasWorkforceSignalError
  const readiness = resolveReadinessStatus({
    health: healthQuery.data,
    hasSignalError,
    operationalPressure,
    t,
  })
  const operatorActions = buildOperatorActions({
    dataQuality,
    hasSignalError,
    hasWorkforceSignalError,
    importActionCount,
    snapshotActionCount,
    t,
    workforcePressure,
  })

  const summaryCards = useMemo(() => {
    const backendMetric = getBackendMetricStatus(healthQuery.data, healthQuery.isError, t)

    return [
      {
        title: t('adminOperations.metric.backend'),
        value: backendMetric.label,
        note: backendMetric.copy,
        icon: <ServerCog size={18} />,
        tone: backendMetric.tone,
      },
      {
        title: t('adminOperations.metric.imports'),
        value: String(importActionCount),
        note: importOverviewQuery.data
          ? t('adminOperations.importMetricNote', {
              count: importOverviewQuery.data.totals.all,
            })
          : getSignalFallbackCopy(importOverviewQuery.isError, importOverviewQuery.error, t),
        icon: <DatabaseZap size={18} />,
        tone: importActionCount > 0 ? 'warning' : 'calm',
      },
      {
        title: t('adminOperations.metric.dataQuality'),
        value: String(dataQuality.errorRowCount),
        note: t('adminOperations.dataQualityMetricNote', {
          count: dataQuality.blockedBatchCount,
        }),
        icon: <Activity size={18} />,
        tone:
          dataQuality.errorRowCount > 0 ||
          dataQuality.blockedBatchCount > 0 ||
          dataQuality.mappingEntityTypes.length > 0 ||
          dataQuality.snapshotIssueCount > 0
            ? 'warning'
            : 'calm',
      },
      {
        title: t('adminOperations.metric.snapshots'),
        value: String(snapshotActionCount),
        note: snapshotOverviewQuery.data
          ? t('adminOperations.snapshotMetricNote', {
              count: snapshotOverviewQuery.data.totals.all,
            })
          : getSignalFallbackCopy(snapshotOverviewQuery.isError, snapshotOverviewQuery.error, t),
        icon: <Layers3 size={18} />,
        tone: snapshotActionCount > 0 ? 'warning' : 'calm',
      },
      {
        title: t('adminOperations.metric.external'),
        value: String(providerBlockers.length),
        note: t('adminOperations.externalMetricNote'),
        icon: <ShieldCheck size={18} />,
        tone: 'neutral',
      },
      {
        title: t('adminOperations.metric.workforce'),
        value: hasWorkforceSignalError
          ? t('adminOperations.unavailable')
          : String(workforcePressure.total),
        note: hasWorkforceSignalError
          ? getSignalFallbackCopy(
              hasWorkforceSignalError,
              sellerCodeRequestsQuery.error ?? offboardingRequestsQuery.error,
              t,
            )
          : t('adminOperations.workforceMetricNote', {
              offboarding: workforcePressure.offboardingCount,
              seller: workforcePressure.sellerCodeCount,
            }),
        icon: <Users size={18} />,
        tone: hasWorkforceSignalError ? 'warning' : workforcePressure.total > 0 ? 'warning' : 'calm',
      },
    ] satisfies Array<{
      title: string
      value: string
      note: string
      icon: ReactNode
      tone: Tone
    }>
  }, [
    healthQuery.data,
    healthQuery.isError,
    dataQuality.blockedBatchCount,
    dataQuality.errorRowCount,
    dataQuality.mappingEntityTypes.length,
    dataQuality.snapshotIssueCount,
    importActionCount,
    importOverviewQuery.data,
    importOverviewQuery.isError,
    importOverviewQuery.error,
    snapshotActionCount,
    snapshotOverviewQuery.data,
    snapshotOverviewQuery.isError,
    snapshotOverviewQuery.error,
    t,
    hasWorkforceSignalError,
    sellerCodeRequestsQuery.error,
    offboardingRequestsQuery.error,
    workforcePressure.offboardingCount,
    workforcePressure.sellerCodeCount,
    workforcePressure.total,
  ])

  if (isInitialLoading) {
    return <ScreenState title={t('adminOperations.loadingTitle')} copy={t('adminOperations.loadingCopy')} />
  }

  return (
    <section className="page-stack">
      <OperationsHero
        operationalPressure={operationalPressure}
        providerBlockerCount={providerBlockers.length}
        readiness={readiness}
        t={t}
      />

      <section className="metric-grid">
        {summaryCards.map((card) => (
          <MetricCard
            icon={card.icon}
            key={card.title}
            note={card.note}
            title={card.title}
            tone={card.tone}
            value={card.value}
          />
        ))}
      </section>

      <MetricCoveragePanel t={t} />

      <OperatorActionListPanel actions={operatorActions} t={t} />

      <section className="two-up-grid">
        <BackendSignalPanel
          health={healthQuery.data}
          isError={healthQuery.isError}
          error={healthQuery.error}
          locale={locale}
          t={t}
        />
        <ProviderBlockersPanel t={t} />
      </section>

      <DataQualitySignalPanel
        dataQuality={dataQuality}
        isError={importNeedsActionQuery.isError || importOverviewQuery.isError || snapshotOverviewQuery.isError}
        t={t}
      />

      <WorkforceSignalPanel
        error={sellerCodeRequestsQuery.error ?? offboardingRequestsQuery.error}
        isError={sellerCodeRequestsQuery.isError || offboardingRequestsQuery.isError}
        offboardingItems={offboardingItems}
        pressure={workforcePressure}
        sellerCodeItems={sellerCodeItems}
        t={t}
      />

      <section className="two-up-grid">
        <ImportSignalPanel
          error={importOverviewQuery.error ?? importNeedsActionQuery.error}
          isError={importOverviewQuery.isError || importNeedsActionQuery.isError}
          items={importNeedsActionItems}
          overview={importOverviewQuery.data}
          t={t}
        />
        <SnapshotSignalPanel
          error={snapshotOverviewQuery.error ?? snapshotNeedsActionQuery.error}
          isError={snapshotOverviewQuery.isError || snapshotNeedsActionQuery.isError}
          items={snapshotNeedsActionItems}
          overview={snapshotOverviewQuery.data}
          t={t}
        />
      </section>
    </section>
  )
}

function OperationsHero(input: {
  operationalPressure: number
  providerBlockerCount: number
  readiness: SignalStatus
  t: TranslateFunction
}) {
  return (
    <section className="hero-panel">
      <div>
        <div className="eyebrow">{input.t('adminOperations.heroEyebrow')}</div>
        <h2 className="hero-title">{input.t('adminOperations.heroTitle')}</h2>
        <p className="hero-copy">{input.t('adminOperations.heroCopy')}</p>
      </div>
      <div className="hero-metrics">
        <MetricAccent label={input.t('adminOperations.readiness')} value={input.readiness.label} />
        <MetricAccent
          label={input.t('adminOperations.operatorPressure')}
          value={String(input.operationalPressure)}
        />
        <MetricAccent
          label={input.t('adminOperations.externalBlockers')}
          value={String(input.providerBlockerCount)}
        />
      </div>
    </section>
  )
}

function DataQualitySignalPanel(input: {
  dataQuality: DataQualitySnapshot
  isError: boolean
  t: TranslateFunction
}) {
  const hasDataQualityPressure =
    input.dataQuality.errorRowCount > 0 ||
    input.dataQuality.blockedBatchCount > 0 ||
    input.dataQuality.mappingEntityTypes.length > 0 ||
    input.dataQuality.snapshotIssueCount > 0

  return (
    <article className="panel">
      <div className="panel-heading panel-heading-spread">
        <div>
          <div className="eyebrow">{input.t('adminOperations.dataQualityEyebrow')}</div>
          <h3>{input.t('adminOperations.dataQualityTitle')}</h3>
          <p className="panel-copy">{input.t('adminOperations.dataQualityCopy')}</p>
        </div>
        <StatusPill tone={input.isError ? 'warning' : hasDataQualityPressure ? 'warning' : 'calm'}>
          {input.isError
            ? input.t('adminOperations.unavailable')
            : hasDataQualityPressure
              ? input.t('adminOperations.needsAttention')
              : input.t('adminOperations.ready')}
        </StatusPill>
      </div>
      <div className="key-grid">
        <KeyValue
          label={input.t('adminOperations.previewErrorRows')}
          value={String(input.dataQuality.errorRowCount)}
        />
        <KeyValue
          label={input.t('adminOperations.mappingBlockers')}
          value={formatMappingEntityTypes(input.dataQuality.mappingEntityTypes, input.t)}
        />
        <KeyValue
          label={input.t('adminOperations.blockedImportBatches')}
          value={String(input.dataQuality.blockedBatchCount)}
        />
        <KeyValue
          label={input.t('adminOperations.snapshotIssues')}
          value={String(input.dataQuality.snapshotIssueCount)}
        />
      </div>
      <p className="queue-reason">{input.t('adminOperations.dataQualitySourceCopy')}</p>
    </article>
  )
}

function BackendSignalPanel(input: {
  error: unknown
  health: OperationsHealth | undefined
  isError: boolean
  locale: AppLocale
  t: TranslateFunction
}) {
  const status: SignalStatus = input.health
    ? resolveBackendStatus(input.health, input.t)
    : {
        label: input.isError ? input.t('adminOperations.unavailable') : input.t('adminOperations.loading'),
        copy: input.isError ? getErrorMessage(input.error) : input.t('adminOperations.signalLoadingCopy'),
        tone: input.isError ? 'warning' : 'neutral',
      }

  return (
    <article className="panel">
      <div className="panel-heading panel-heading-spread">
        <div>
          <div className="eyebrow">{input.t('adminOperations.backendEyebrow')}</div>
          <h3>{input.t('adminOperations.backendTitle')}</h3>
          <p className="panel-copy">{input.t('adminOperations.backendCopy')}</p>
        </div>
        <StatusPill tone={status.tone}>{status.label}</StatusPill>
      </div>
      <div className="key-grid">
        <KeyValue
          label={input.t('adminOperations.service')}
          value={input.health?.service ?? input.t('adminOperations.unknown')}
        />
        <KeyValue
          label={input.t('adminOperations.database')}
          value={formatDependencyState(input.health?.checks?.database?.status, input.t)}
        />
        <KeyValue
          label={input.t('adminOperations.redis')}
          value={formatDependencyState(input.health?.checks?.redis?.status, input.t)}
        />
        <KeyValue
          label={input.t('adminOperations.queueMode')}
          value={input.health?.queue?.backend ?? input.health?.queueBackend ?? input.t('adminOperations.unknown')}
        />
        <KeyValue
          label={input.t('adminOperations.readinessProfile')}
          value={input.health?.observability?.readinessProfile ?? input.t('adminOperations.unknown')}
        />
        <KeyValue
          label={input.t('adminOperations.lastSeen')}
          value={
            input.health?.timestamp
              ? formatDateTime(input.health.timestamp, input.locale)
              : input.t('adminOperations.notCaptured')
          }
        />
      </div>
      <p className="queue-reason">{status.copy}</p>
    </article>
  )
}

function ProviderBlockersPanel(input: { t: TranslateFunction }) {
  return (
    <article className="panel">
      <div className="panel-heading panel-heading-spread">
        <div>
          <div className="eyebrow">{input.t('adminOperations.externalEyebrow')}</div>
          <h3>{input.t('adminOperations.externalTitle')}</h3>
          <p className="panel-copy">{input.t('adminOperations.externalCopy')}</p>
        </div>
        <StatusPill tone="warning">{input.t('adminOperations.blocked')}</StatusPill>
      </div>
      <div className="queue-list">
        {providerBlockers.map((blocker) => (
          <div className="queue-row" key={blocker.id}>
            <div className="queue-row-head">
              <div>
                <div className="queue-title">{input.t(blocker.titleKey)}</div>
                <div className="queue-subtitle">{input.t(blocker.ownerKey)}</div>
              </div>
              <StatusPill tone="warning">{input.t('adminOperations.inputNeeded')}</StatusPill>
            </div>
            <p className="queue-reason">{input.t(blocker.copyKey)}</p>
          </div>
        ))}
      </div>
    </article>
  )
}

function ImportSignalPanel(input: {
  error: unknown
  isError: boolean
  items: NeedsActionItem[]
  overview: ImportOverview | undefined
  t: TranslateFunction
}) {
  const actionCount = countImportActions(input.overview)

  return (
    <article className="panel">
      <div className="panel-heading panel-heading-spread">
        <div>
          <div className="eyebrow">{input.t('adminOperations.importEyebrow')}</div>
          <h3>{input.t('adminOperations.importTitle')}</h3>
          <p className="panel-copy">{input.t('adminOperations.importCopy')}</p>
        </div>
        <StatusPill tone={input.isError ? 'warning' : actionCount > 0 ? 'warning' : 'calm'}>
          {input.isError
            ? input.t('adminOperations.unavailable')
            : actionCount > 0
              ? input.t('adminOperations.needsAttention')
              : input.t('adminOperations.ready')}
        </StatusPill>
      </div>
      {input.isError ? (
        <div className="inline-state inline-state-warning">{getErrorMessage(input.error)}</div>
      ) : (
        <div className="key-grid">
          <KeyValue
            label={input.t('adminOperations.totalBatches')}
            value={String(input.overview?.totals.all ?? 0)}
          />
          <KeyValue
            label={input.t('adminOperations.healthy')}
            value={String(input.overview?.healthTotals.healthy ?? 0)}
          />
          <KeyValue
            label={input.t('adminOperations.retryReady')}
            value={String(input.overview?.healthTotals.retryReady ?? 0)}
          />
          <KeyValue
            label={input.t('adminOperations.blocked')}
            value={String(input.overview?.healthTotals.blocked ?? 0)}
          />
        </div>
      )}
      <QueuePreview
        emptyCopy={input.t('adminOperations.importQueueEmpty')}
        items={input.items.map((item) => ({
          href: `/admin/integrations/${item.batchId}`,
          id: item.batchId,
          meta: input.t('adminOperations.importQueueMeta', {
            entity: item.entityType,
            errors: item.errorCount,
          }),
          reason: item.actionReason,
          title: `${item.sourceCode} / ${item.entityType}`,
          tone: mapHealthTone(item.healthState),
          status: formatOperationsHealthState(item.healthState, input.t),
        }))}
        t={input.t}
        title={input.t('adminOperations.importQueueTitle')}
      />
      <div className="toolbar-cluster">
        <Link className="back-link" to="/admin/integrations">
          <span>{input.t('adminOperations.openIntegrations')}</span>
        </Link>
      </div>
    </article>
  )
}

function SnapshotSignalPanel(input: {
  error: unknown
  isError: boolean
  items: SnapshotNeedsActionItem[]
  overview: SnapshotOverview | undefined
  t: TranslateFunction
}) {
  const actionCount = countSnapshotActions(input.overview)

  return (
    <article className="panel">
      <div className="panel-heading panel-heading-spread">
        <div>
          <div className="eyebrow">{input.t('adminOperations.snapshotEyebrow')}</div>
          <h3>{input.t('adminOperations.snapshotTitle')}</h3>
          <p className="panel-copy">{input.t('adminOperations.snapshotCopy')}</p>
        </div>
        <StatusPill tone={input.isError ? 'warning' : actionCount > 0 ? 'warning' : 'calm'}>
          {input.isError
            ? input.t('adminOperations.unavailable')
            : actionCount > 0
              ? input.t('adminOperations.needsAttention')
              : input.t('adminOperations.ready')}
        </StatusPill>
      </div>
      {input.isError ? (
        <div className="inline-state inline-state-warning">{getErrorMessage(input.error)}</div>
      ) : (
        <div className="key-grid">
          <KeyValue
            label={input.t('adminOperations.totalRuns')}
            value={String(input.overview?.totals.all ?? 0)}
          />
          <KeyValue
            label={input.t('adminOperations.healthy')}
            value={String(input.overview?.healthTotals.healthy ?? 0)}
          />
          <KeyValue
            label={input.t('adminOperations.inProgress')}
            value={String(input.overview?.healthTotals.inProgress ?? 0)}
          />
          <KeyValue
            label={input.t('adminOperations.stuck')}
            value={String(input.overview?.healthTotals.stuck ?? 0)}
          />
        </div>
      )}
      <QueuePreview
        emptyCopy={input.t('adminOperations.snapshotQueueEmpty')}
        items={input.items.map((item) => ({
          href: `/admin/snapshots/${item.snapshotRunId}`,
          id: item.snapshotRunId,
          meta: input.t('adminOperations.snapshotQueueMeta', {
            status: item.runStatus,
            type: item.snapshotType,
          }),
          reason: item.actionReason,
          title: input.t('adminOperations.snapshotRunTitle', { type: item.snapshotType }),
          tone: mapHealthTone(item.healthState),
          status: formatOperationsHealthState(item.healthState, input.t),
        }))}
        t={input.t}
        title={input.t('adminOperations.snapshotQueueTitle')}
      />
      <div className="toolbar-cluster">
        <Link className="back-link" to="/admin/snapshots">
          <span>{input.t('adminOperations.openSnapshots')}</span>
        </Link>
      </div>
    </article>
  )
}

function QueuePreview(input: {
  emptyCopy: string
  items: Array<{
    href: string
    id: string
    meta: string
    reason: string
    status: string
    title: string
    tone: Tone
  }>
  t: TranslateFunction
  title: string
}) {
  return (
    <div className="queue-list">
      <div className="queue-row-head">
        <strong>{input.title}</strong>
        <StatusPill tone={input.items.length > 0 ? 'warning' : 'calm'}>
          {input.items.length > 0
            ? input.t('adminOperations.queueHasItems', { count: input.items.length })
            : input.t('adminOperations.queueClear')}
        </StatusPill>
      </div>
      {input.items.length === 0 ? (
        <EmptyState copy={input.emptyCopy} />
      ) : (
        input.items.map((item) => (
          <Link className="queue-row" key={item.id} to={item.href}>
            <div className="queue-row-head">
              <div>
                <div className="queue-title">{item.title}</div>
                <div className="queue-subtitle">{item.id}</div>
              </div>
              <StatusPill tone={item.tone}>{item.status}</StatusPill>
            </div>
            <p className="queue-reason">{item.reason}</p>
            <div className="queue-footer">
              <span>{item.meta}</span>
              <Activity size={16} />
            </div>
          </Link>
        ))
      )}
    </div>
  )
}

function countImportActions(overview: ImportOverview | undefined) {
  if (!overview) return 0
  return (
    overview.healthTotals.blocked +
    overview.healthTotals.needsAction +
    overview.healthTotals.retryReady +
    overview.healthTotals.stuck
  )
}

function countSnapshotActions(overview: SnapshotOverview | undefined) {
  if (!overview) return 0
  return (
    overview.healthTotals.needsAction +
    overview.healthTotals.retryReady +
    overview.healthTotals.stuck
  )
}

function summarizeDataQuality(input: {
  importItems: NeedsActionItem[]
  importOverview: ImportOverview | undefined
  snapshotOverview: SnapshotOverview | undefined
}): DataQualitySnapshot {
  const mappingEntityTypes = new Set<string>()

  for (const item of input.importItems) {
    for (const entityType of item.blockedByEntityTypes) {
      mappingEntityTypes.add(entityType)
    }
  }

  return {
    blockedBatchCount: input.importOverview?.healthTotals.blocked ?? 0,
    errorRowCount: input.importItems.reduce((total, item) => total + item.errorCount, 0),
    mappingEntityTypes: [...mappingEntityTypes].sort(),
    snapshotIssueCount:
      (input.snapshotOverview?.healthTotals.needsAction ?? 0) +
      (input.snapshotOverview?.healthTotals.retryReady ?? 0) +
      (input.snapshotOverview?.healthTotals.stuck ?? 0),
  }
}

function resolveReadinessStatus(input: {
  hasSignalError: boolean
  health: OperationsHealth | undefined
  operationalPressure: number
  t: TranslateFunction
}): SignalStatus {
  if (input.hasSignalError || input.health?.status === 'error') {
    return {
      label: input.t('adminOperations.attention'),
      copy: input.t('adminOperations.attentionCopy'),
      tone: 'warning',
    }
  }

  if (input.operationalPressure > 0) {
    return {
      label: input.t('adminOperations.controlled'),
      copy: input.t('adminOperations.controlledCopy'),
      tone: 'warning',
    }
  }

  return {
    label: input.t('adminOperations.ready'),
    copy: input.t('adminOperations.readyCopy'),
    tone: 'calm',
  }
}

function resolveBackendStatus(health: OperationsHealth, t: TranslateFunction): SignalStatus {
  if (health.status === 'error') {
    return {
      label: t('adminOperations.unavailable'),
      copy: t('adminOperations.backendErrorCopy'),
      tone: 'danger',
    }
  }

  if (health.queue?.status === 'process-local') {
    return {
      label: t('adminOperations.controlled'),
      copy: health.queue.message,
      tone: 'warning',
    }
  }

  if (health.observability?.status === 'degraded') {
    return {
      label: t('adminOperations.degraded'),
      copy: t('adminOperations.observabilityDegradedCopy'),
      tone: 'warning',
    }
  }

  return {
    label: t('adminOperations.ready'),
    copy: health.queue?.message ?? t('adminOperations.backendReadyCopy'),
    tone: 'calm',
  }
}

function getBackendMetricStatus(
  health: OperationsHealth | undefined,
  isError: boolean,
  t: TranslateFunction,
): SignalStatus {
  if (health) {
    return resolveBackendStatus(health, t)
  }

  return {
    label: isError ? t('adminOperations.unavailable') : t('adminOperations.loading'),
    copy: isError ? t('adminOperations.backendErrorCopy') : t('adminOperations.signalLoadingCopy'),
    tone: isError ? 'warning' : 'neutral',
  }
}

function getSignalFallbackCopy(
  isError: boolean,
  error: unknown,
  t: TranslateFunction,
) {
  return isError ? getErrorMessage(error) : t('adminOperations.signalLoadingCopy')
}

function formatDependencyState(input: string | undefined, t: TranslateFunction) {
  if (!input) return t('adminOperations.unknown')
  if (input === 'ok') return t('adminOperations.ok')
  if (input === 'error') return t('adminOperations.error')
  if (input === 'skipped') return t('adminOperations.skipped')
  return input
}

function formatOperationsHealthState(input: string, t: TranslateFunction) {
  if (input === 'healthy') return t('adminOperations.health.healthy')
  if (input === 'completed') return t('adminOperations.health.completed')
  if (input === 'failed') return t('adminOperations.health.failed')
  if (input === 'in_progress' || input === 'processing') {
    return t('adminOperations.health.inProgress')
  }
  if (input === 'blocked') return t('adminOperations.health.blocked')
  if (input === 'retry_ready' || input === 'ready') return t('adminOperations.health.retryReady')
  if (input === 'needs_action') return t('adminOperations.health.needsAction')
  if (input === 'stuck') return t('adminOperations.health.stuck')
  if (input === 'queued') return t('adminOperations.health.queued')
  return input.replaceAll('_', ' ')
}

function formatMappingEntityTypes(input: string[], t: TranslateFunction) {
  if (input.length === 0) return t('adminOperations.noMappingBlockers')

  return input.map((entityType) => formatMappingEntityType(entityType, t)).join(', ')
}

function formatMappingEntityType(input: string, t: TranslateFunction) {
  if (input === 'employee' || input === 'personnel') return t('adminOperations.entity.employee')
  if (input === 'store') return t('adminOperations.entity.store')
  return input.replaceAll('_', ' ')
}
