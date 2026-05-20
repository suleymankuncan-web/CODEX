import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { BriefcaseBusiness, ClipboardCheck, TrendingDown, Trophy } from 'lucide-react'
import {
  EmptyState,
  KeyValue,
  MetricAccent,
  MetricCard,
  ScreenState,
} from '../components/dashboard-primitives'
import type { TranslateFunction, TranslationKey } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import { getReportingSnapshotRuns, getReportingSummary } from '../features/reports/api'
import { formatDate, formatDateTime, getErrorMessage } from '../lib/format'

const runStatusLabelKeys: Record<string, TranslationKey> = {
  completed: 'reportsSummary.status.completed',
  failed: 'reportsSummary.status.failed',
  running: 'reportsSummary.status.running',
  processing: 'reportsSummary.status.running',
  queued: 'reportsSummary.status.queued',
  pending: 'reportsSummary.status.pending',
}

const snapshotTypeLabelKeys: Record<string, TranslationKey> = {
  daily: 'reportsSummary.snapshotType.daily',
  monthly: 'reportsSummary.snapshotType.monthly',
}

export function ReportsSummaryPage() {
  const { locale, t } = useLocalization()
  const summaryQuery = useQuery({
    queryKey: ['reporting-summary'],
    queryFn: getReportingSummary,
  })
  const runsQuery = useQuery({
    queryKey: ['reporting-snapshot-runs'],
    queryFn: () => getReportingSnapshotRuns(),
  })

  if (summaryQuery.isLoading || runsQuery.isLoading) {
    return <ScreenState title={t('reportsSummary.loadingTitle')} copy={t('reportsSummary.loadingCopy')} />
  }

  if (summaryQuery.isError) {
    return <ScreenState title={t('reportsSummary.errorTitle')} copy={getErrorMessage(summaryQuery.error)} tone="error" />
  }

  if (runsQuery.isError) {
    return <ScreenState title={t('reportsSummary.runsErrorTitle')} copy={getErrorMessage(runsQuery.error)} tone="error" />
  }

  const summary = summaryQuery.data
  if (!summary) {
    return <ScreenState title={t('reportsSummary.noSummaryTitle')} copy={t('reportsSummary.noSummaryCopy')} tone="error" />
  }

  const latestRun = summary.latestCompletedSnapshotRun
  const totalRows =
    summary.cards.workforceRows +
    summary.cards.kpiRows +
    summary.cards.checklistRows +
    summary.cards.turnoverRows

  return (
    <section className="page-stack">
      <section className="hero-panel">
        <div>
          <div className="eyebrow">{t('reportsSummary.heroEyebrow')}</div>
          <h2 className="hero-title">{t('reportsSummary.heroTitle')}</h2>
          <p className="hero-copy">{t('reportsSummary.heroCopy')}</p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label={t('reportsSummary.totalReportRows')} value={String(totalRows)} />
          <MetricAccent
            label={t('reportsSummary.latestRun')}
            value={latestRun ? formatSnapshotType(latestRun.snapshotType, t) : t('reportsSummary.noCompletedRun')}
          />
          <MetricAccent
            label={t('reportsSummary.status')}
            value={latestRun ? formatRunStatus(latestRun.runStatus, t) : t('reportsSummary.unavailable')}
          />
        </div>
      </section>

      {latestRun ? (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t('reportsSummary.latestSnapshotEyebrow')}</div>
              <h3>{t('reportsSummary.reportingAnchorTitle')}</h3>
            </div>
          </div>
          <div className="key-grid">
            <KeyValue label={t('reportsSummary.snapshotRunId')} value={latestRun.snapshotRunId} />
            <KeyValue label={t('reportsSummary.snapshotType')} value={formatSnapshotType(latestRun.snapshotType, t)} />
            <KeyValue
              label={t('reportsSummary.period')}
              value={`${formatDate(latestRun.periodStart, locale)} - ${formatDate(latestRun.periodEnd, locale)}`}
            />
            <KeyValue label={t('reportsSummary.generatedAt')} value={formatDateTime(latestRun.generatedAt, locale)} />
          </div>
        </section>
      ) : (
        <section className="panel">
          <EmptyState
            title={t('reportsSummary.noCompletedTitle')}
            copy={t('reportsSummary.noCompletedCopy')}
          />
        </section>
      )}

      <section className="metric-grid">
        <MetricCard title={t('reportsSummary.workforceTitle')} value={summary.cards.workforceRows} note={t('reportsSummary.workforceNote')} icon={<BriefcaseBusiness size={18} />} tone="calm" />
        <MetricCard title={t('reportsSummary.kpisTitle')} value={summary.cards.kpiRows} note={t('reportsSummary.kpisNote')} icon={<Trophy size={18} />} tone="accent" />
        <MetricCard title={t('reportsSummary.checklistsTitle')} value={summary.cards.checklistRows} note={t('reportsSummary.checklistsNote')} icon={<ClipboardCheck size={18} />} tone="warning" />
        <MetricCard title={t('reportsSummary.turnoverTitle')} value={summary.cards.turnoverRows} note={t('reportsSummary.turnoverNote')} icon={<TrendingDown size={18} />} tone="danger" />
      </section>

      <section className="two-up-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t('reportsSummary.readPathsEyebrow')}</div>
              <h3>{t('reportsSummary.readPathsTitle')}</h3>
            </div>
          </div>
          <div className="stacked-table">
            {[
              '/api/reports/summary',
              '/api/reports/snapshot-runs',
              '/api/reports/workforce',
              '/api/reports/kpis',
              '/api/reports/checklists',
              '/api/reports/turnover',
            ].map((path) => (
              <div className="stacked-row" key={path}>
                <div className="stacked-row-head">
                  <strong>{path}</strong>
                  <span className="status-pill status-pill-neutral">{t('reportsSummary.readOnly')}</span>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t('reportsSummary.recentRunsEyebrow')}</div>
              <h3>{t('reportsSummary.recentRunsTitle')}</h3>
            </div>
            <Link className="back-link" to="/admin/reports/snapshot-runs">
              <span>{t('reportsSummary.openDrillDownChooser')}</span>
            </Link>
          </div>
          {runsQuery.data?.items.length ? (
            <div className="stacked-table">
              {runsQuery.data.items.map((run) => (
                <article className="stacked-row" key={run.snapshotRunId}>
                  <div className="stacked-row-head">
                    <strong>{t('reportsSummary.snapshotLabel', { type: formatSnapshotType(run.snapshotType, t) })}</strong>
                    <span className="status-pill status-pill-calm">{formatRunStatus(run.runStatus, t)}</span>
                  </div>
                  <p>{formatDate(run.periodStart, locale)} - {formatDate(run.periodEnd, locale)}</p>
                  <span className="queue-subtitle">{run.snapshotRunId}</span>
                  <div className="action-cluster">
                    <Link
                      className="back-link"
                      to={`/admin/reports/workforce/${run.snapshotRunId}`}
                      aria-label={t('reportsSummary.openWorkforceForSnapshot', { snapshotRunId: run.snapshotRunId })}
                    >
                      <span>{t('reportsSummary.openWorkforce')}</span>
                    </Link>
                    <Link
                      className="back-link"
                      to={`/admin/reports/kpis/${run.snapshotRunId}`}
                      aria-label={t('reportsSummary.openKpisForSnapshot', { snapshotRunId: run.snapshotRunId })}
                    >
                      <span>{t('reportsSummary.openKpis')}</span>
                    </Link>
                    <Link
                      className="back-link"
                      to={`/admin/reports/checklists/${run.snapshotRunId}`}
                      aria-label={t('reportsSummary.openChecklistsForSnapshot', { snapshotRunId: run.snapshotRunId })}
                    >
                      <span>{t('reportsSummary.openChecklists')}</span>
                    </Link>
                    <Link
                      className="back-link"
                      to={`/admin/reports/turnover/${run.snapshotRunId}`}
                      aria-label={t('reportsSummary.openTurnoverForSnapshot', { snapshotRunId: run.snapshotRunId })}
                    >
                      <span>{t('reportsSummary.openTurnover')}</span>
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState copy={t('reportsSummary.recentRunsEmpty')} />
          )}
        </article>
      </section>
    </section>
  )
}

function formatRunStatus(status: string, t: TranslateFunction) {
  const key = runStatusLabelKeys[status]
  return key ? t(key) : status
}

function formatSnapshotType(type: string, t: TranslateFunction) {
  const key = snapshotTypeLabelKeys[type]
  return key ? t(key) : type
}
