import { useQuery } from '@tanstack/react-query'
import { DatabaseZap, Layers3, ShieldCheck, Users } from 'lucide-react'
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
  summarizeDataQualityCenter,
  type DataQualityCenterSummary,
} from '../features/data-quality/model'
import { getImportOverview, getNeedsAction, type NeedsActionItem } from '../features/integrations/api'
import { useLocalization } from '../features/localization/useLocalization'
import { getKpiConfig, getRankings, type KpiConfigResponse, type RankingSummary } from '../features/reports/api'
import {
  getSnapshotNeedsAction,
  getSnapshotOverview,
  type SnapshotNeedsActionItem,
} from '../features/snapshots/api'
import { getOffboardingRequests, getSellerCodeRequests } from '../features/workforce/api'
import { formatDateTime, formatNumber, formatState, getErrorMessage, mapHealthTone } from '../lib/format'
import type { AppLocale } from '../lib/i18n'

const SIGNAL_STALE_TIME_MS = 30_000
const QUEUE_PREVIEW_SIZE = 6

export function AdminDataQualityCenterPage() {
  const { locale, t } = useLocalization()
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
    queryKey: ['seller-code-requests', 'pending_hr_approval'],
    queryFn: () => getSellerCodeRequests({ status: 'pending_hr_approval' }),
    staleTime: SIGNAL_STALE_TIME_MS,
  })
  const offboardingRequestsQuery = useQuery({
    queryKey: ['offboarding-requests', 'pending_hr_approval'],
    queryFn: () => getOffboardingRequests({ status: 'pending_hr_approval' }),
    staleTime: SIGNAL_STALE_TIME_MS,
  })
  const kpiConfigQuery = useQuery({
    queryKey: ['kpi-config'],
    queryFn: getKpiConfig,
    staleTime: SIGNAL_STALE_TIME_MS,
  })
  const rankingsQuery = useQuery({
    queryKey: ['operations-rankings', 'monthly', 1],
    queryFn: () => getRankings({ limit: 1 }),
    staleTime: SIGNAL_STALE_TIME_MS,
  })

  const importItems = importNeedsActionQuery.data?.items ?? []
  const snapshotItems = snapshotNeedsActionQuery.data?.items ?? []
  const summary = summarizeDataQualityCenter({
    importItems,
    importOverview: importOverviewQuery.data,
    kpiConfig: kpiConfigQuery.data,
    rankings: rankingsQuery.data,
    snapshotItems,
    snapshotOverview: snapshotOverviewQuery.data,
    sellerCodeRequests: sellerCodeRequestsQuery.data,
    offboardingRequests: offboardingRequestsQuery.data,
  })
  const hasSignalError =
    importOverviewQuery.isError ||
    importNeedsActionQuery.isError ||
    snapshotOverviewQuery.isError ||
    snapshotNeedsActionQuery.isError ||
    sellerCodeRequestsQuery.isError ||
    offboardingRequestsQuery.isError ||
    kpiConfigQuery.isError ||
    rankingsQuery.isError
  const isInitialLoading = [
    importOverviewQuery,
    importNeedsActionQuery,
    snapshotOverviewQuery,
    snapshotNeedsActionQuery,
    sellerCodeRequestsQuery,
    offboardingRequestsQuery,
    kpiConfigQuery,
    rankingsQuery,
  ].some((query) => query.isPending)
  const status = resolveCenterStatus(summary, hasSignalError)

  if (isInitialLoading) {
    return (
      <ScreenState
        title={t('dataQuality.loadingTitle')}
        copy={t('dataQuality.loadingCopy')}
      />
    )
  }

  return (
    <section className="page-stack">
      <section className="hero-panel">
        <div>
          <div className="eyebrow">{t('dataQuality.heroEyebrow')}</div>
          <h2 className="hero-title">{t('dataQuality.heroTitle')}</h2>
          <p className="hero-copy">{t('dataQuality.heroCopy')}</p>
        </div>
        <div className="metric-accent-grid">
          <MetricAccent label={t('dataQuality.route')} value="/admin/data-quality" />
          <MetricAccent label={t('dataQuality.status')} value={t(status.labelKey)} />
          <MetricAccent
            label={t('dataQuality.totalPressure')}
            value={formatNumber(summary.totalPressure, locale)}
          />
          <MetricAccent label={t('dataQuality.sourceFamilies')} value={t('dataQuality.sourceFamiliesValue')} />
        </div>
      </section>

      {hasSignalError ? (
        <div className="inline-state inline-state-warning">{t('dataQuality.unavailableCopy')}</div>
      ) : null}

      <section className="metric-grid">
        <MetricCard
          title={t('dataQuality.importMetric')}
          value={formatNumber(summary.importActionCount, locale)}
          note={t('dataQuality.importMetricNote')}
          icon={<DatabaseZap size={22} />}
          tone={metricTone(hasSignalError, summary.importActionCount)}
        />
        <MetricCard
          title={t('dataQuality.snapshotMetric')}
          value={formatNumber(summary.snapshotActionCount, locale)}
          note={t('dataQuality.snapshotMetricNote')}
          icon={<Layers3 size={22} />}
          tone={metricTone(hasSignalError, summary.snapshotActionCount)}
        />
        <MetricCard
          title={t('dataQuality.workforceMetric')}
          value={formatNumber(summary.workforcePendingCount, locale)}
          note={t('dataQuality.workforceMetricNote')}
          icon={<Users size={22} />}
          tone={metricTone(hasSignalError, summary.workforcePendingCount)}
        />
        <MetricCard
          title={t('dataQuality.sourceTrustMetric')}
          value={formatNumber(summary.sourceTrustGapCount, locale)}
          note={t('dataQuality.sourceTrustMetricNote')}
          icon={<ShieldCheck size={22} />}
          tone={metricTone(hasSignalError, summary.sourceTrustGapCount)}
        />
      </section>

      <ImportMappingPanel
        error={importNeedsActionQuery.error ?? importOverviewQuery.error}
        items={importItems}
        locale={locale}
        summary={summary}
      />
      <SnapshotFreshnessPanel
        error={snapshotNeedsActionQuery.error ?? snapshotOverviewQuery.error}
        items={snapshotItems}
        locale={locale}
        summary={summary}
      />
      <WorkforceIdentityPanel
        error={sellerCodeRequestsQuery.error ?? offboardingRequestsQuery.error}
        summary={summary}
      />
      <SourceTrustPanel
        error={kpiConfigQuery.error ?? rankingsQuery.error}
        kpiConfigVersion={formatKpiConfigVersion(kpiConfigQuery.data, t('dataQuality.unpublishedConfig'))}
        leaderboardSource={formatLeaderboardSource(rankingsQuery.data, t('dataQuality.missingLeaderboardPeriod'))}
      />
    </section>
  )
}

function ImportMappingPanel(input: {
  error: unknown
  items: NeedsActionItem[]
  locale: AppLocale
  summary: DataQualityCenterSummary
}) {
  const { t } = useLocalization()
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">{t('dataQuality.importMetric')}</div>
          <h3>{t('dataQuality.importPanelTitle')}</h3>
          <p>{t('dataQuality.importPanelCopy')}</p>
        </div>
        <StatusPill tone={input.summary.importActionCount > 0 ? 'warning' : 'calm'}>
          {String(input.summary.importActionCount)}
        </StatusPill>
      </div>
      <SignalError error={input.error} />
      <div className="key-grid">
        <KeyValue
          label={t('dataQuality.errorRows')}
          value={formatNumber(input.summary.previewErrorRows, input.locale)}
        />
        <KeyValue
          label={t('dataQuality.mappingEntityTypes')}
          value={
            input.summary.mappingEntityTypes.length > 0
              ? input.summary.mappingEntityTypes.join(', ')
              : t('dataQuality.noMappings')
          }
        />
      </div>
      {input.items.length === 0 ? (
        <EmptyState copy={t('dataQuality.emptyImport')} />
      ) : (
        <div className="stacked-table">
          {input.items.map((item) => (
            <Link className="queue-row" key={item.batchId} to={`/admin/integrations/${item.batchId}`}>
              <div className="queue-row-head">
                <strong>{item.sourceName}</strong>
                <StatusPill tone={mapHealthTone(item.healthState)}>{formatState(item.healthState)}</StatusPill>
              </div>
              <span className="queue-subtitle">
                {t('dataQuality.batch')}: {item.batchId}
              </span>
              <div className="key-grid">
                <KeyValue label={t('dataQuality.errorRows')} value={formatNumber(item.errorCount, input.locale)} />
                <KeyValue
                  label={t('dataQuality.mappingEntityTypes')}
                  value={item.blockedByEntityTypes.length > 0 ? item.blockedByEntityTypes.join(', ') : t('dataQuality.noMappings')}
                />
              </div>
              <p className="queue-reason">{item.recommendedAction}</p>
              <span>{t('dataQuality.openIntegration')}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}

function SnapshotFreshnessPanel(input: {
  error: unknown
  items: SnapshotNeedsActionItem[]
  locale: AppLocale
  summary: DataQualityCenterSummary
}) {
  const { t } = useLocalization()
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">{t('dataQuality.snapshotMetric')}</div>
          <h3>{t('dataQuality.snapshotPanelTitle')}</h3>
          <p>{t('dataQuality.snapshotPanelCopy')}</p>
        </div>
        <StatusPill tone={input.summary.snapshotActionCount > 0 ? 'warning' : 'calm'}>
          {String(input.summary.snapshotActionCount)}
        </StatusPill>
      </div>
      <SignalError error={input.error} />
      <div className="key-grid">
        <KeyValue
          label={t('dataQuality.retryReady')}
          value={formatNumber(input.summary.snapshotRetryReadyCount, input.locale)}
        />
      </div>
      {input.items.length === 0 ? (
        <EmptyState copy={t('dataQuality.emptySnapshot')} />
      ) : (
        <div className="stacked-table">
          {input.items.map((item) => (
            <Link className="queue-row" key={item.snapshotRunId} to={`/admin/snapshots/${item.snapshotRunId}`}>
              <div className="queue-row-head">
                <strong>{item.snapshotType}</strong>
                <StatusPill tone={mapHealthTone(item.healthState)}>{formatState(item.runStatus)}</StatusPill>
              </div>
              <span className="queue-subtitle">
                {t('dataQuality.snapshotRun')}: {item.snapshotRunId}
              </span>
              <div className="key-grid">
                <KeyValue label={t('dataQuality.snapshotMetric')} value={item.snapshotDate} />
                <KeyValue
                  label={t('dataQuality.status')}
                  value={formatOptionalDateTime(item.finishedAt ?? item.generatedAt, input.locale)}
                />
              </div>
              <p className="queue-reason">{item.recommendedAction}</p>
              <span>{t('dataQuality.openSnapshot')}</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}

function WorkforceIdentityPanel(input: {
  error: unknown
  summary: DataQualityCenterSummary
}) {
  const { t } = useLocalization()
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">{t('dataQuality.workforceMetric')}</div>
          <h3>{t('dataQuality.workforcePanelTitle')}</h3>
          <p>{t('dataQuality.workforcePanelCopy')}</p>
        </div>
        <Link className="secondary-action" to="/admin/inbox">
          {t('dataQuality.openInbox')}
        </Link>
      </div>
      <SignalError error={input.error} />
      <div className="key-grid">
        <KeyValue label={t('dataQuality.sellerCodeRequests')} value={String(input.summary.sellerCodePendingCount)} />
        <KeyValue label={t('dataQuality.offboardingRequests')} value={String(input.summary.offboardingPendingCount)} />
      </div>
    </section>
  )
}

function SourceTrustPanel(input: {
  error: unknown
  kpiConfigVersion: string
  leaderboardSource: string
}) {
  const { t } = useLocalization()
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">{t('dataQuality.sourceTrustMetric')}</div>
          <h3>{t('dataQuality.guardrailPanelTitle')}</h3>
          <p>{t('dataQuality.guardrailPanelCopy')}</p>
        </div>
        <Link className="secondary-action" to="/admin/kpi-config">
          {t('dataQuality.openKpiConfig')}
        </Link>
      </div>
      <SignalError error={input.error} />
      <div className="key-grid">
        <KeyValue label={t('dataQuality.publishedKpiConfig')} value={input.kpiConfigVersion} />
        <KeyValue label={t('dataQuality.leaderboardSource')} value={input.leaderboardSource} />
      </div>
    </section>
  )
}

function SignalError(input: { error: unknown }) {
  const { t } = useLocalization()
  if (!input.error) return null

  return (
    <div className="inline-state inline-state-danger">
      {t('dataQuality.signalError')}: {getErrorMessage(input.error)}
    </div>
  )
}

function resolveCenterStatus(summary: DataQualityCenterSummary, hasSignalError: boolean): {
  labelKey: 'dataQuality.ready' | 'dataQuality.attention' | 'dataQuality.unavailable'
} {
  if (hasSignalError) {
    return { labelKey: 'dataQuality.unavailable' }
  }
  if (summary.totalPressure > 0) {
    return { labelKey: 'dataQuality.attention' }
  }
  return { labelKey: 'dataQuality.ready' }
}

function metricTone(hasSignalError: boolean, value: number): Tone {
  if (hasSignalError) return 'warning'
  return value > 0 ? 'warning' : 'calm'
}

function formatKpiConfigVersion(data: KpiConfigResponse | undefined, fallback: string) {
  if (!data?.metadata.publishedAt || !data.metadata.versionNo) {
    return fallback
  }

  return `v${data.metadata.versionNo}`
}

function formatLeaderboardSource(data: RankingSummary | undefined, fallback: string) {
  if (!data?.source.periodStart || !data.source.periodEnd) {
    return fallback
  }

  return `${data.source.periodStart} - ${data.source.periodEnd}`
}

function formatOptionalDateTime(input: string | null, locale: AppLocale) {
  if (!input) return '-'
  return formatDateTime(input, locale)
}
