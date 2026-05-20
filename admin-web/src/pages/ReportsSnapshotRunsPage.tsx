import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState, KeyValue, ScreenState, StatusPill } from '../components/dashboard-primitives'
import { ReportingToolbar } from '../components/reporting-tools'
import type { TranslateFunction, TranslationKey } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import { getReportingSnapshotRuns } from '../features/reports/api'
import { downloadCsv } from '../lib/download-csv'
import { formatDate, formatDateTime, getErrorMessage, mapHealthTone } from '../lib/format'

const runStatusLabelKeys: Record<string, TranslationKey> = {
  completed: 'reportsSnapshotRuns.status.completed',
  failed: 'reportsSnapshotRuns.status.failed',
  running: 'reportsSnapshotRuns.status.running',
  processing: 'reportsSnapshotRuns.status.running',
  queued: 'reportsSnapshotRuns.status.queued',
  pending: 'reportsSnapshotRuns.status.pending',
}

const snapshotTypeLabelKeys: Record<string, TranslationKey> = {
  daily: 'reportsSnapshotRuns.snapshotType.daily',
  monthly: 'reportsSnapshotRuns.snapshotType.monthly',
}

export function ReportsSnapshotRunsPage() {
  const { locale, t } = useLocalization()
  const [sortBy, setSortBy] = useState<'generated-desc' | 'generated-asc' | 'type'>('generated-desc')
  const runsQuery = useQuery({
    queryKey: ['reporting-snapshot-runs-page'],
    queryFn: () => getReportingSnapshotRuns(),
  })
  const runs = useMemo(() => runsQuery.data?.items ?? [], [runsQuery.data?.items])
  const sortedRuns = useMemo(() => {
    const items = [...runs]
    if (sortBy === 'generated-asc') {
      return items.sort((left, right) => left.generatedAt.localeCompare(right.generatedAt))
    }
    if (sortBy === 'type') {
      return items.sort((left, right) => left.snapshotType.localeCompare(right.snapshotType))
    }
    return items.sort((left, right) => right.generatedAt.localeCompare(left.generatedAt))
  }, [runs, sortBy])

  if (runsQuery.isLoading) {
    return (
      <ScreenState
        title={t('reportsSnapshotRuns.loadingTitle')}
        copy={t('reportsSnapshotRuns.loadingCopy')}
      />
    )
  }

  if (runsQuery.isError) {
    return (
      <ScreenState
        title={t('reportsSnapshotRuns.errorTitle')}
        copy={getErrorMessage(runsQuery.error)}
        tone="error"
      />
    )
  }

  return (
    <section className="page-stack">
      <section className="hero-panel">
        <div>
          <div className="eyebrow">{t('reportsSnapshotRuns.heroEyebrow')}</div>
          <h2 className="hero-title">{t('reportsSnapshotRuns.heroTitle')}</h2>
          <p className="hero-copy">{t('reportsSnapshotRuns.heroCopy')}</p>
        </div>
        <Link className="back-link" to="/admin/reports">
          <ArrowLeft size={16} />
          <span>{t('reportsSnapshotRuns.backToSummary')}</span>
        </Link>
      </section>

      <section className="panel">
        <div className="panel-heading panel-heading-spread">
          <div>
            <div className="eyebrow">{t('reportsSnapshotRuns.contextsEyebrow')}</div>
            <h3>{t('reportsSnapshotRuns.recentRunsTitle')}</h3>
          </div>
          <ReportingToolbar
            sortValue={sortBy}
            onSortChange={(value) => setSortBy(value as typeof sortBy)}
            sortOptions={[
              { value: 'generated-desc', label: t('reportsSnapshotRuns.sort.newest') },
              { value: 'generated-asc', label: t('reportsSnapshotRuns.sort.oldest') },
              { value: 'type', label: t('reportsSnapshotRuns.sort.type') },
            ]}
            sortAriaLabel={t('reportsSnapshotRuns.sortRows')}
            exportLabel={t('reportsSnapshotRuns.exportCsv')}
            onExport={() =>
              downloadCsv({
                filename: 'reporting-snapshot-runs.csv',
                columns: ['snapshotRunId', 'snapshotType', 'runStatus', 'snapshotDate', 'periodStart', 'periodEnd', 'generatedAt', 'generatedBy', 'kpiConfigVersion'],
                rows: sortedRuns.map((run) => [
                  run.snapshotRunId,
                  run.snapshotType,
                  run.runStatus,
                  run.snapshotDate,
                  run.periodStart,
                  run.periodEnd,
                  run.generatedAt,
                  run.generatedBy,
                  formatKpiConfigVersion(run.kpiConfigVersion, t),
                ]),
              })
            }
          />
        </div>

        {sortedRuns.length === 0 ? (
          <EmptyState copy={t('reportsSnapshotRuns.empty')} />
        ) : (
          <div className="stacked-table">
            {sortedRuns.map((run) => (
              <article className="stacked-row" key={run.snapshotRunId}>
                <div className="stacked-row-head">
                  <div>
                    <strong>
                      {t('reportsSnapshotRuns.snapshotLabel', {
                        type: formatSnapshotType(run.snapshotType, t),
                      })}
                    </strong>
                    <span className="queue-subtitle">{run.snapshotRunId}</span>
                  </div>
                  <StatusPill tone={mapHealthTone(run.runStatus)}>
                    {formatRunStatus(run.runStatus, t)}
                  </StatusPill>
                </div>

                <div className="key-grid">
                  <KeyValue
                    label={t('reportsSnapshotRuns.snapshotDate')}
                    value={formatDate(run.snapshotDate, locale)}
                  />
                  <KeyValue
                    label={t('reportsSnapshotRuns.generatedAt')}
                    value={formatDateTime(run.generatedAt, locale)}
                  />
                  <KeyValue
                    label={t('reportsSnapshotRuns.period')}
                    value={`${formatDate(run.periodStart, locale)} - ${formatDate(run.periodEnd, locale)}`}
                  />
                  <KeyValue label={t('reportsSnapshotRuns.generatedBy')} value={run.generatedBy} />
                  <KeyValue
                    label={t('reportsSnapshotRuns.kpiConfigVersion')}
                    value={formatKpiConfigVersion(run.kpiConfigVersion, t)}
                  />
                </div>

                <div className="action-cluster">
                  <Link
                    className="back-link"
                    to={`/admin/reports/workforce/${run.snapshotRunId}`}
                    aria-label={t('reportsSnapshotRuns.openWorkforceForSnapshot', {
                      snapshotRunId: run.snapshotRunId,
                    })}
                  >
                    <span>{t('reportsSnapshotRuns.openWorkforce')}</span>
                  </Link>
                  <Link
                    className="back-link"
                    to={`/admin/reports/kpis/${run.snapshotRunId}`}
                    aria-label={t('reportsSnapshotRuns.openKpisForSnapshot', {
                      snapshotRunId: run.snapshotRunId,
                    })}
                  >
                    <span>{t('reportsSnapshotRuns.openKpis')}</span>
                  </Link>
                  <Link
                    className="back-link"
                    to={`/admin/reports/checklists/${run.snapshotRunId}`}
                    aria-label={t('reportsSnapshotRuns.openChecklistsForSnapshot', {
                      snapshotRunId: run.snapshotRunId,
                    })}
                  >
                    <span>{t('reportsSnapshotRuns.openChecklists')}</span>
                  </Link>
                  <Link
                    className="back-link"
                    to={`/admin/reports/turnover/${run.snapshotRunId}`}
                    aria-label={t('reportsSnapshotRuns.openTurnoverForSnapshot', {
                      snapshotRunId: run.snapshotRunId,
                    })}
                  >
                    <span>{t('reportsSnapshotRuns.openTurnover')}</span>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  )
}

function formatKpiConfigVersion(input: {
  versionNo: number | null
  state: 'versioned' | 'pre_governance'
} | null | undefined, t: TranslateFunction) {
  if (input?.state === 'versioned' && input.versionNo) {
    return t('reportsSnapshotRuns.versionValue', { version: input.versionNo })
  }

  return t('reportsSnapshotRuns.preGovernanceSnapshot')
}

function formatRunStatus(status: string, t: TranslateFunction) {
  const key = runStatusLabelKeys[status]
  return key ? t(key) : status
}

function formatSnapshotType(type: string, t: TranslateFunction) {
  const key = snapshotTypeLabelKeys[type]
  return key ? t(key) : type
}
