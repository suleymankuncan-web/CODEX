import { useMemo, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, DatabaseZap, Inbox, Layers3, ServerCog, ShieldCheck, Trophy, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  AdminMetricStrip,
  AdminStatePanel,
  AdminSurfacePage,
  type AdminMetricStripItem,
} from './admin-surface-primitives'
import { Button } from '../components/ui/button'
import {
  getImportOverview,
  getNeedsAction,
  type ImportOverview,
  type NeedsActionItem,
} from '../features/integrations/api'
import type { TranslateFunction } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import { getOperationsHealth, type OperationsHealth } from '../features/operations/api'
import { getKpiConfig, getRankings } from '../features/reports/api'
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
import { getWorkflowInbox } from '../features/workflow/api'
import { formatDateTime, getErrorMessage, mapHealthTone } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import { DataQualitySignalPanel, type DataQualitySnapshot } from './operations-data-quality-signal-panel'
import { OperationsHero, OperationsReadinessStrip, type SignalStatus } from './operations-hero'
import { buildOperatorActions } from './operations-operator-action-model'
import { OperatorActionListPanel } from './operations-operator-action-list'
import { summarizeKpiRankingReadiness } from './operations-kpi-ranking-signal-model'
import { KpiRankingSignalPanel } from './operations-kpi-ranking-signal-panel'
import { MetricCoveragePanel } from './operations-metric-coverage-panel'
import { signalStateFromQueries, summarizeSignalFreshness } from './operations-signal-freshness-model'
import { SignalFreshnessPanel } from './operations-signal-freshness-panel'
import { summarizeWorkflowInboxPressure } from './operations-workflow-signal-model'
import { WorkflowSignalPanel } from './operations-workflow-signal-panel'
import { summarizeWorkforcePressure } from './operations-workforce-signal-model'
import { WorkforceSignalPanel } from './operations-workforce-signal-panel'
import {
  OperationsInlineState,
  OperationsKeyValue,
  OperationsKeyValueGrid,
  OperationsPanel,
  OperationsQueueList,
  OperationsStatusBadge,
  type OperationsTone,
} from './operations-surface-primitives'
import { toAdminSurfaceTone } from './operations-surface-tones'

const SIGNAL_STALE_TIME_MS = 30_000
const QUEUE_PREVIEW_SIZE = 4

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
  const workflowInboxQuery = useQuery({
    queryKey: ['operations-workflow-inbox'],
    queryFn: getWorkflowInbox,
    staleTime: SIGNAL_STALE_TIME_MS,
  })
  const kpiConfigQuery = useQuery({
    queryKey: ['operations-kpi-config'],
    queryFn: getKpiConfig,
    staleTime: SIGNAL_STALE_TIME_MS,
  })
  const rankingsQuery = useQuery({
    queryKey: ['operations-rankings', 'monthly', 1],
    queryFn: () => getRankings({ limit: 1 }),
    staleTime: SIGNAL_STALE_TIME_MS,
  })

  const importNeedsActionItems = importNeedsActionQuery.data?.items ?? []
  const snapshotNeedsActionItems = snapshotNeedsActionQuery.data?.items ?? []
  const sellerCodeItems = sellerCodeRequestsQuery.data?.items ?? []
  const offboardingItems = offboardingRequestsQuery.data?.items ?? []
  const workflowItems = workflowInboxQuery.data?.items ?? []
  const hasWorkforceSignalError = sellerCodeRequestsQuery.isError || offboardingRequestsQuery.isError
  const hasWorkflowSignalError = workflowInboxQuery.isError
  const hasKpiRankingSignalError = kpiConfigQuery.isError || rankingsQuery.isError
  const isKpiRankingSignalLoading = kpiConfigQuery.isLoading || rankingsQuery.isLoading
  const isInitialLoading = [
    healthQuery,
    importOverviewQuery,
    importNeedsActionQuery,
    snapshotOverviewQuery,
    snapshotNeedsActionQuery,
    sellerCodeRequestsQuery,
    offboardingRequestsQuery,
    workflowInboxQuery,
    kpiConfigQuery,
    rankingsQuery,
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
  const workflowPressure = summarizeWorkflowInboxPressure({
    inbox: workflowInboxQuery.data,
  })
  const kpiRankingReadiness = summarizeKpiRankingReadiness({
    config: kpiConfigQuery.data,
    rankings: rankingsQuery.data,
  })
  const workforcePressureTotal = hasWorkforceSignalError ? 0 : workforcePressure.total
  const workflowPressureTotal = hasWorkflowSignalError ? 0 : workflowPressure.needsAttentionCount
  const kpiRankingPressure =
    hasKpiRankingSignalError || isKpiRankingSignalLoading ? 0 : kpiRankingReadiness.issueCount
  const operationalPressure =
    importActionCount +
    snapshotActionCount +
    workforcePressureTotal +
    workflowPressureTotal +
    kpiRankingPressure
  const hasSignalError =
    healthQuery.isError ||
    importOverviewQuery.isError ||
    importNeedsActionQuery.isError ||
    snapshotOverviewQuery.isError ||
    snapshotNeedsActionQuery.isError ||
    hasWorkforceSignalError ||
    hasWorkflowSignalError ||
    hasKpiRankingSignalError
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
    hasWorkflowSignalError,
    importActionCount,
    snapshotActionCount,
    t,
    workflowPressure,
    workforcePressure,
  })
  const signalFreshness = summarizeSignalFreshness({
    importActionCount,
    importItems: importNeedsActionItems,
    importState: signalStateFromQueries(importOverviewQuery, importNeedsActionQuery),
    kpiRankingReadiness,
    kpiState: signalStateFromQueries(kpiConfigQuery, rankingsQuery),
    offboardingItems,
    rankings: rankingsQuery.data,
    sellerCodeItems,
    snapshotActionCount,
    snapshotItems: snapshotNeedsActionItems,
    snapshotState: signalStateFromQueries(snapshotOverviewQuery, snapshotNeedsActionQuery),
    workflowItems,
    workflowPressure,
    workflowState: signalStateFromQueries(workflowInboxQuery),
    workforcePressure,
    workforceState: signalStateFromQueries(sellerCodeRequestsQuery, offboardingRequestsQuery),
  })

  const summaryCards = useMemo(() => {
    const backendMetric = getBackendMetricStatus(healthQuery.data, healthQuery.isError, t)

    return [
      {
        id: 'backend',
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
        id: 'imports',
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
        id: 'data-quality',
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
        id: 'snapshots',
      },
      {
        title: t('adminOperations.metric.external'),
        value: String(providerBlockers.length),
        note: t('adminOperations.externalMetricNote'),
        icon: <ShieldCheck size={18} />,
        tone: 'neutral',
        id: 'external',
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
        id: 'workforce',
      },
      {
        title: t('adminOperations.metric.workflow'),
        value: hasWorkflowSignalError
          ? t('adminOperations.unavailable')
          : String(workflowPressure.needsAttentionCount),
        note: hasWorkflowSignalError
          ? getSignalFallbackCopy(hasWorkflowSignalError, workflowInboxQuery.error, t)
          : t('adminOperations.workflowMetricNote', {
              high: workflowPressure.highUrgencyCount,
              total: workflowPressure.total,
            }),
        icon: <Inbox size={18} />,
        tone: hasWorkflowSignalError ? 'warning' : workflowPressure.total > 0 ? 'warning' : 'calm',
        id: 'workflow',
      },
      {
        title: t('adminOperations.metric.kpiRankings'),
        value: isKpiRankingSignalLoading
          ? t('adminOperations.loading')
          : hasKpiRankingSignalError
          ? t('adminOperations.unavailable')
          : kpiRankingReadiness.issueCount > 0
            ? t('adminOperations.needsAttention')
            : t('adminOperations.ready'),
        note: isKpiRankingSignalLoading
          ? t('adminOperations.signalLoadingCopy')
          : hasKpiRankingSignalError
          ? getSignalFallbackCopy(
              hasKpiRankingSignalError,
              kpiConfigQuery.error ?? rankingsQuery.error,
              t,
            )
          : t('adminOperations.kpiRankingMetricNote', {
              periods: kpiRankingReadiness.availablePeriodCount,
              total: kpiRankingReadiness.totalPopulation,
            }),
        icon: <Trophy size={18} />,
        tone: isKpiRankingSignalLoading
          ? 'neutral'
          : hasKpiRankingSignalError || kpiRankingReadiness.issueCount > 0
            ? 'warning'
            : 'calm',
        id: 'kpi-rankings',
      },
    ] satisfies Array<{
      id: string
      title: string
      value: string
      note: string
      icon: ReactNode
      tone: OperationsTone
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
    hasWorkflowSignalError,
    hasKpiRankingSignalError,
    isKpiRankingSignalLoading,
    sellerCodeRequestsQuery.error,
    offboardingRequestsQuery.error,
    workflowInboxQuery.error,
    kpiConfigQuery.error,
    rankingsQuery.error,
    workforcePressure.offboardingCount,
    workforcePressure.sellerCodeCount,
    workforcePressure.total,
    workflowPressure.highUrgencyCount,
    workflowPressure.needsAttentionCount,
    workflowPressure.total,
    kpiRankingReadiness.availablePeriodCount,
    kpiRankingReadiness.issueCount,
    kpiRankingReadiness.totalPopulation,
  ])

  if (isInitialLoading) {
    return (
      <AdminSurfacePage ariaLabel={t('adminOperations.loadingTitle')}>
        <AdminStatePanel
          title={t('adminOperations.loadingTitle')}
          description={t('adminOperations.loadingCopy')}
          isLoading
        />
      </AdminSurfacePage>
    )
  }

  return (
    <AdminSurfacePage ariaLabel={t('adminOperations.heroTitle')}>
      <OperationsHero t={t} />

      <OperatorActionListPanel actions={operatorActions} t={t} />

      <OperationsReadinessStrip
        operationalPressure={operationalPressure} providerBlockerCount={providerBlockers.length} readiness={readiness} t={t}
      />

      <AdminMetricStrip
        items={summaryCards.map((card): AdminMetricStripItem => ({
          description: card.note,
          icon: card.icon,
          id: card.id,
          label: card.title,
          tone: toAdminSurfaceTone(card.tone),
          value: card.value,
        }))}
      />

      <MetricCoveragePanel t={t} />

      <SignalFreshnessPanel items={signalFreshness} locale={locale} t={t} />

      <section className="tw:grid tw:gap-4 tw:xl:grid-cols-2">
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

      <WorkflowSignalPanel
        error={workflowInboxQuery.error}
        isError={workflowInboxQuery.isError}
        items={workflowItems}
        pressure={workflowPressure}
        t={t}
      />

      <KpiRankingSignalPanel
        config={kpiConfigQuery.data}
        error={kpiConfigQuery.error ?? rankingsQuery.error}
        isError={hasKpiRankingSignalError}
        isLoading={isKpiRankingSignalLoading}
        locale={locale}
        rankings={rankingsQuery.data}
        readiness={kpiRankingReadiness}
        t={t}
      />

      <section className="tw:grid tw:gap-4 tw:xl:grid-cols-2">
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
    </AdminSurfacePage>
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
    <OperationsPanel
      eyebrow={input.t('adminOperations.backendEyebrow')}
      title={input.t('adminOperations.backendTitle')}
      description={input.t('adminOperations.backendCopy')}
      testId="operations-backend-signal"
      badge={<OperationsStatusBadge tone={status.tone}>{status.label}</OperationsStatusBadge>}
    >
      <OperationsKeyValueGrid>
        <OperationsKeyValue
          label={input.t('adminOperations.service')}
          value={input.health?.service ?? input.t('adminOperations.unknown')}
        />
        <OperationsKeyValue
          label={input.t('adminOperations.database')}
          value={formatDependencyState(input.health?.checks?.database?.status, input.t)}
        />
        <OperationsKeyValue
          label={input.t('adminOperations.redis')}
          value={formatDependencyState(input.health?.checks?.redis?.status, input.t)}
        />
        <OperationsKeyValue
          label={input.t('adminOperations.queueMode')}
          value={input.health?.queue?.backend ?? input.health?.queueBackend ?? input.t('adminOperations.unknown')}
        />
        <OperationsKeyValue
          label={input.t('adminOperations.readinessProfile')}
          value={input.health?.observability?.readinessProfile ?? input.t('adminOperations.unknown')}
        />
        <OperationsKeyValue
          label={input.t('adminOperations.lastSeen')}
          value={
            input.health?.timestamp
              ? formatDateTime(input.health.timestamp, input.locale)
              : input.t('adminOperations.notCaptured')
          }
        />
      </OperationsKeyValueGrid>
      <p className="tw:m-0 tw:text-sm tw:text-muted-foreground">{status.copy}</p>
    </OperationsPanel>
  )
}

function ProviderBlockersPanel(input: { t: TranslateFunction }) {
  return (
    <OperationsPanel
      eyebrow={input.t('adminOperations.externalEyebrow')}
      title={input.t('adminOperations.externalTitle')}
      description={input.t('adminOperations.externalCopy')}
      testId="operations-provider-blockers"
      badge={<OperationsStatusBadge tone="warning">{input.t('adminOperations.blocked')}</OperationsStatusBadge>}
    >
      <OperationsQueueList
        items={providerBlockers.map((blocker) => ({
          id: blocker.id,
          meta: input.t(blocker.ownerKey),
          reason: input.t(blocker.copyKey),
          status: input.t('adminOperations.inputNeeded'),
          title: input.t(blocker.titleKey),
          tone: 'warning',
        }))}
      />
    </OperationsPanel>
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
    <OperationsPanel
      eyebrow={input.t('adminOperations.importEyebrow')}
      title={input.t('adminOperations.importTitle')}
      description={input.t('adminOperations.importCopy')}
      testId="operations-import-signal"
      badge={
        <OperationsStatusBadge tone={input.isError ? 'warning' : actionCount > 0 ? 'warning' : 'calm'}>
          {input.isError
            ? input.t('adminOperations.unavailable')
            : actionCount > 0
              ? input.t('adminOperations.needsAttention')
              : input.t('adminOperations.ready')}
        </OperationsStatusBadge>
      }
      actions={
        <Button asChild size="sm" variant="outline">
          <Link to="/admin/integrations">{input.t('adminOperations.openIntegrations')}</Link>
        </Button>
      }
    >
      {input.isError ? (
        <OperationsInlineState tone="warning">{getErrorMessage(input.error)}</OperationsInlineState>
      ) : (
        <OperationsKeyValueGrid>
          <OperationsKeyValue
            label={input.t('adminOperations.totalBatches')}
            value={String(input.overview?.totals.all ?? 0)}
          />
          <OperationsKeyValue
            label={input.t('adminOperations.healthy')}
            value={String(input.overview?.healthTotals.healthy ?? 0)}
          />
          <OperationsKeyValue
            label={input.t('adminOperations.retryReady')}
            value={String(input.overview?.healthTotals.retryReady ?? 0)}
          />
          <OperationsKeyValue
            label={input.t('adminOperations.blocked')}
            value={String(input.overview?.healthTotals.blocked ?? 0)}
          />
        </OperationsKeyValueGrid>
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
    </OperationsPanel>
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
    <OperationsPanel
      eyebrow={input.t('adminOperations.snapshotEyebrow')}
      title={input.t('adminOperations.snapshotTitle')}
      description={input.t('adminOperations.snapshotCopy')}
      testId="operations-snapshot-signal"
      badge={
        <OperationsStatusBadge tone={input.isError ? 'warning' : actionCount > 0 ? 'warning' : 'calm'}>
          {input.isError
            ? input.t('adminOperations.unavailable')
            : actionCount > 0
              ? input.t('adminOperations.needsAttention')
              : input.t('adminOperations.ready')}
        </OperationsStatusBadge>
      }
      actions={
        <Button asChild size="sm" variant="outline">
          <Link to="/admin/snapshots">{input.t('adminOperations.openSnapshots')}</Link>
        </Button>
      }
    >
      {input.isError ? (
        <OperationsInlineState tone="warning">{getErrorMessage(input.error)}</OperationsInlineState>
      ) : (
        <OperationsKeyValueGrid>
          <OperationsKeyValue
            label={input.t('adminOperations.totalRuns')}
            value={String(input.overview?.totals.all ?? 0)}
          />
          <OperationsKeyValue
            label={input.t('adminOperations.healthy')}
            value={String(input.overview?.healthTotals.healthy ?? 0)}
          />
          <OperationsKeyValue
            label={input.t('adminOperations.inProgress')}
            value={String(input.overview?.healthTotals.inProgress ?? 0)}
          />
          <OperationsKeyValue
            label={input.t('adminOperations.stuck')}
            value={String(input.overview?.healthTotals.stuck ?? 0)}
          />
        </OperationsKeyValueGrid>
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
    </OperationsPanel>
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
    tone: OperationsTone
  }>
  t: TranslateFunction
  title: string
}) {
  return (
    <OperationsQueueList
      emptyCopy={input.emptyCopy}
      header={input.title}
      status={
        <OperationsStatusBadge tone={input.items.length > 0 ? 'warning' : 'calm'}>
          {input.items.length > 0
            ? input.t('adminOperations.queueHasItems', { count: input.items.length })
            : input.t('adminOperations.queueClear')}
        </OperationsStatusBadge>
      }
      items={input.items.map((item) => ({
        footer: item.meta,
        href: item.href,
        id: item.id,
        meta: item.id,
        reason: item.reason,
        status: item.status,
        title: item.title,
        tone: item.tone,
      }))}
    />
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
