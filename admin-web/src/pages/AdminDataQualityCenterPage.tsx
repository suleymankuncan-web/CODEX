import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { DatabaseZap, Layers3, ShieldCheck, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  AdminKeyValue as KeyValue,
  AdminKeyValueGrid,
  AdminMetricStrip,
  AdminStatePanel,
  AdminSurfaceBadge,
  AdminSurfaceEmpty as EmptyState,
  AdminSurfaceHeader,
  AdminSurfacePage,
  AdminSurfaceSection,
  type AdminSurfaceTone,
} from './admin-surface-primitives'
import { Button } from '../components/ui/button'
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
      <AdminSurfacePage ariaLabel={t('dataQuality.loadingTitle')}>
        <AdminStatePanel
          isLoading
          title={t('dataQuality.loadingTitle')}
          description={t('dataQuality.loadingCopy')}
        />
      </AdminSurfacePage>
    )
  }

  return (
    <AdminSurfacePage ariaLabel={t('dataQuality.heroTitle')}>
      <AdminSurfaceHeader
        eyebrow={t('dataQuality.heroEyebrow')}
        title={t('dataQuality.heroTitle')}
        description={t('dataQuality.heroCopy')}
        icon={<ShieldCheck size={18} />}
        meta={
          <>
            <AdminSurfaceBadge tone={toSurfaceTone(status.labelKey === 'dataQuality.ready' ? 'calm' : 'warning')}>
              {t(status.labelKey)}
            </AdminSurfaceBadge>
            <AdminSurfaceBadge tone="cyan">{t('dataQuality.sourceFamiliesValue')}</AdminSurfaceBadge>
          </>
        }
      />

      {hasSignalError ? (
        <AdminStatePanel
          tone="warning"
          title={t('dataQuality.unavailable')}
          description={t('dataQuality.unavailableCopy')}
        />
      ) : null}

      <AdminMetricStrip
        className="tw:xl:grid-cols-3"
        items={[
          {
            id: 'status',
            label: t('dataQuality.status'),
            value: t(status.labelKey),
            tone: toSurfaceTone(status.labelKey === 'dataQuality.ready' ? 'calm' : 'warning'),
          },
          {
            id: 'totalPressure',
            label: t('dataQuality.totalPressure'),
            value: formatNumber(summary.totalPressure, locale),
            tone: toSurfaceTone(metricTone(hasSignalError, summary.totalPressure)),
          },
          {
            id: 'sourceFamilies',
            label: t('dataQuality.sourceFamilies'),
            value: t('dataQuality.sourceFamiliesValue'),
            tone: 'cyan',
          },
        ]}
      />

      <AdminMetricStrip
        items={[
          {
            id: 'import',
            label: t('dataQuality.importMetric'),
            value: formatNumber(summary.importActionCount, locale),
            description: t('dataQuality.importMetricNote'),
            icon: <DatabaseZap size={18} />,
            tone: toSurfaceTone(metricTone(hasSignalError, summary.importActionCount)),
          },
          {
            id: 'snapshot',
            label: t('dataQuality.snapshotMetric'),
            value: formatNumber(summary.snapshotActionCount, locale),
            description: t('dataQuality.snapshotMetricNote'),
            icon: <Layers3 size={18} />,
            tone: toSurfaceTone(metricTone(hasSignalError, summary.snapshotActionCount)),
          },
          {
            id: 'workforce',
            label: t('dataQuality.workforceMetric'),
            value: formatNumber(summary.workforcePendingCount, locale),
            description: t('dataQuality.workforceMetricNote'),
            icon: <Users size={18} />,
            tone: toSurfaceTone(metricTone(hasSignalError, summary.workforcePendingCount)),
          },
          {
            id: 'sourceTrust',
            label: t('dataQuality.sourceTrustMetric'),
            value: formatNumber(summary.sourceTrustGapCount, locale),
            description: t('dataQuality.sourceTrustMetricNote'),
            icon: <ShieldCheck size={18} />,
            tone: toSurfaceTone(metricTone(hasSignalError, summary.sourceTrustGapCount)),
          },
        ]}
      />

      <section className="tw:grid tw:gap-4 tw:xl:grid-cols-2">
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
      </section>

      <section className="tw:grid tw:gap-4 tw:xl:grid-cols-2">
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
    </AdminSurfacePage>
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
    <AdminSurfaceSection
      eyebrow={t('dataQuality.importMetric')}
      title={t('dataQuality.importPanelTitle')}
      description={t('dataQuality.importPanelCopy')}
      badge={
        <StatusPill tone={input.summary.importActionCount > 0 ? 'warning' : 'calm'}>
          {String(input.summary.importActionCount)}
        </StatusPill>
      }
    >
      <SignalError error={input.error} />
      <AdminKeyValueGrid>
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
      </AdminKeyValueGrid>
      {input.items.length === 0 ? (
        <EmptyState copy={t('dataQuality.emptyImport')} />
      ) : (
        <div className="tw:grid tw:gap-3">
          {input.items.map((item) => (
            <Link
              className="tw:grid tw:gap-3 tw:rounded-xl tw:border tw:border-border tw:bg-background/65 tw:p-3 tw:text-foreground tw:no-underline tw:transition-colors tw:hover:bg-muted/60"
              key={item.batchId}
              to={`/admin/integrations/${item.batchId}`}
            >
              <div className="tw:flex tw:flex-col tw:gap-2 tw:md:flex-row tw:md:items-start tw:md:justify-between">
                <strong className="tw:text-sm tw:font-semibold">{item.sourceName}</strong>
                <StatusPill tone={mapHealthTone(item.healthState)}>{formatState(item.healthState)}</StatusPill>
              </div>
              <span className="tw:text-xs tw:text-muted-foreground">
                {t('dataQuality.batch')}: {item.batchId}
              </span>
              <AdminKeyValueGrid>
                <KeyValue label={t('dataQuality.errorRows')} value={formatNumber(item.errorCount, input.locale)} />
                <KeyValue
                  label={t('dataQuality.mappingEntityTypes')}
                  value={item.blockedByEntityTypes.length > 0 ? item.blockedByEntityTypes.join(', ') : t('dataQuality.noMappings')}
                />
              </AdminKeyValueGrid>
              <p className="tw:text-sm tw:leading-6 tw:text-muted-foreground">{item.recommendedAction}</p>
              <span className="tw:text-sm tw:font-medium tw:text-primary">{t('dataQuality.openIntegration')}</span>
            </Link>
          ))}
        </div>
      )}
    </AdminSurfaceSection>
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
    <AdminSurfaceSection
      eyebrow={t('dataQuality.snapshotMetric')}
      title={t('dataQuality.snapshotPanelTitle')}
      description={t('dataQuality.snapshotPanelCopy')}
      badge={
        <StatusPill tone={input.summary.snapshotActionCount > 0 ? 'warning' : 'calm'}>
          {String(input.summary.snapshotActionCount)}
        </StatusPill>
      }
    >
      <SignalError error={input.error} />
      <AdminKeyValueGrid>
        <KeyValue
          label={t('dataQuality.retryReady')}
          value={formatNumber(input.summary.snapshotRetryReadyCount, input.locale)}
        />
      </AdminKeyValueGrid>
      {input.items.length === 0 ? (
        <EmptyState copy={t('dataQuality.emptySnapshot')} />
      ) : (
        <div className="tw:grid tw:gap-3">
          {input.items.map((item) => (
            <Link
              className="tw:grid tw:gap-3 tw:rounded-xl tw:border tw:border-border tw:bg-background/65 tw:p-3 tw:text-foreground tw:no-underline tw:transition-colors tw:hover:bg-muted/60"
              key={item.snapshotRunId}
              to={`/admin/snapshots/${item.snapshotRunId}`}
            >
              <div className="tw:flex tw:flex-col tw:gap-2 tw:md:flex-row tw:md:items-start tw:md:justify-between">
                <strong className="tw:text-sm tw:font-semibold">{item.snapshotType}</strong>
                <StatusPill tone={mapHealthTone(item.healthState)}>{formatState(item.runStatus)}</StatusPill>
              </div>
              <span className="tw:text-xs tw:text-muted-foreground">
                {t('dataQuality.snapshotRun')}: {item.snapshotRunId}
              </span>
              <AdminKeyValueGrid>
                <KeyValue label={t('dataQuality.snapshotMetric')} value={item.snapshotDate} />
                <KeyValue
                  label={t('dataQuality.status')}
                  value={formatOptionalDateTime(item.finishedAt ?? item.generatedAt, input.locale)}
                />
              </AdminKeyValueGrid>
              <p className="tw:text-sm tw:leading-6 tw:text-muted-foreground">{item.recommendedAction}</p>
              <span className="tw:text-sm tw:font-medium tw:text-primary">{t('dataQuality.openSnapshot')}</span>
            </Link>
          ))}
        </div>
      )}
    </AdminSurfaceSection>
  )
}

function WorkforceIdentityPanel(input: {
  error: unknown
  summary: DataQualityCenterSummary
}) {
  const { t } = useLocalization()
  return (
    <AdminSurfaceSection
      eyebrow={t('dataQuality.workforceMetric')}
      title={t('dataQuality.workforcePanelTitle')}
      description={t('dataQuality.workforcePanelCopy')}
      actions={
        <Button asChild size="sm" variant="outline">
          <Link to="/admin/inbox">{t('dataQuality.openInbox')}</Link>
        </Button>
      }
    >
      <SignalError error={input.error} />
      <AdminKeyValueGrid>
        <KeyValue label={t('dataQuality.sellerCodeRequests')} value={String(input.summary.sellerCodePendingCount)} />
        <KeyValue label={t('dataQuality.offboardingRequests')} value={String(input.summary.offboardingPendingCount)} />
      </AdminKeyValueGrid>
    </AdminSurfaceSection>
  )
}

function SourceTrustPanel(input: {
  error: unknown
  kpiConfigVersion: string
  leaderboardSource: string
}) {
  const { t } = useLocalization()
  return (
    <AdminSurfaceSection
      eyebrow={t('dataQuality.sourceTrustMetric')}
      title={t('dataQuality.guardrailPanelTitle')}
      description={t('dataQuality.guardrailPanelCopy')}
      actions={
        <Button asChild size="sm" variant="outline">
          <Link to="/admin/kpi-config">{t('dataQuality.openKpiConfig')}</Link>
        </Button>
      }
    >
      <SignalError error={input.error} />
      <AdminKeyValueGrid>
        <KeyValue label={t('dataQuality.publishedKpiConfig')} value={input.kpiConfigVersion} />
        <KeyValue label={t('dataQuality.leaderboardSource')} value={input.leaderboardSource} />
      </AdminKeyValueGrid>
    </AdminSurfaceSection>
  )
}

function SignalError(input: { error: unknown }) {
  const { t } = useLocalization()
  if (!input.error) return null

  return (
    <AdminStatePanel
      tone="danger"
      title={t('dataQuality.signalError')}
      description={getErrorMessage(input.error)}
    />
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

type SurfacePillTone = AdminSurfaceTone | 'calm'

function StatusPill(input: { children: ReactNode; tone?: SurfacePillTone }) {
  return <AdminSurfaceBadge tone={toSurfaceTone(input.tone)}>{input.children}</AdminSurfaceBadge>
}

function toSurfaceTone(tone: SurfacePillTone | undefined): AdminSurfaceTone {
  if (tone === 'calm') return 'success'
  return tone ?? 'neutral'
}

function metricTone(hasSignalError: boolean, value: number): SurfacePillTone {
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
