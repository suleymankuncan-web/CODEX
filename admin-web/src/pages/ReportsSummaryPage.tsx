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
import { getReportingSnapshotRuns, getReportingSummary } from '../features/reports/api'
import { formatDate, formatDateTime, getErrorMessage } from '../lib/format'

export function ReportsSummaryPage() {
  const summaryQuery = useQuery({
    queryKey: ['reporting-summary'],
    queryFn: getReportingSummary,
  })
  const runsQuery = useQuery({
    queryKey: ['reporting-snapshot-runs'],
    queryFn: () => getReportingSnapshotRuns(),
  })

  if (summaryQuery.isLoading || runsQuery.isLoading) {
    return <ScreenState title="Loading reporting summary" copy="Pulling latest completed snapshot context and report volume." />
  }

  if (summaryQuery.isError) {
    return <ScreenState title="Reporting summary unavailable" copy={getErrorMessage(summaryQuery.error)} tone="error" />
  }

  if (runsQuery.isError) {
    return <ScreenState title="Snapshot run list unavailable" copy={getErrorMessage(runsQuery.error)} tone="error" />
  }

  const summary = summaryQuery.data
  if (!summary) {
    return <ScreenState title="Reporting summary unavailable" copy="No summary payload was returned." tone="error" />
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
          <div className="eyebrow">Reporting Summary</div>
          <h2 className="hero-title">Read-only output from the latest trustworthy snapshot.</h2>
          <p className="hero-copy">
            This page is intentionally thin: it orients the operator around the last completed
            reporting run and how much data was materialized into each reporting slice.
          </p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label="Total report rows" value={String(totalRows)} />
          <MetricAccent label="Latest run" value={latestRun?.snapshotType ?? 'No completed run'} />
          <MetricAccent label="Status" value={latestRun?.runStatus ?? 'Unavailable'} />
        </div>
      </section>

      {latestRun ? (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Latest completed snapshot</div>
              <h3>Reporting anchor</h3>
            </div>
          </div>
          <div className="key-grid">
            <KeyValue label="Snapshot run id" value={latestRun.snapshotRunId} />
            <KeyValue label="Snapshot type" value={latestRun.snapshotType} />
            <KeyValue label="Period" value={`${formatDate(latestRun.periodStart)} - ${formatDate(latestRun.periodEnd)}`} />
            <KeyValue label="Generated at" value={formatDateTime(latestRun.generatedAt)} />
          </div>
        </section>
      ) : (
        <section className="panel">
          <EmptyState
            title="No completed snapshot run exists yet."
            copy="Reporting will light up once at least one snapshot run finishes successfully."
          />
        </section>
      )}

      <section className="metric-grid">
        <MetricCard title="Workforce" value={summary.cards.workforceRows} note="Rows in workforce snapshot output" icon={<BriefcaseBusiness size={18} />} tone="calm" />
        <MetricCard title="KPIs" value={summary.cards.kpiRows} note="Rows in KPI reporting output" icon={<Trophy size={18} />} tone="accent" />
        <MetricCard title="Checklists" value={summary.cards.checklistRows} note="Checklist compliance snapshot rows" icon={<ClipboardCheck size={18} />} tone="warning" />
        <MetricCard title="Turnover" value={summary.cards.turnoverRows} note="Turnover snapshot rows" icon={<TrendingDown size={18} />} tone="danger" />
      </section>

      <section className="two-up-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Read paths</div>
              <h3>Reporting endpoints already available</h3>
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
                  <span className="status-pill status-pill-neutral">read-only</span>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Recent completed runs</div>
              <h3>Reporting selectable context</h3>
            </div>
            <Link className="back-link" to="/admin/reports/snapshot-runs">
              <span>Open drill-down chooser</span>
            </Link>
          </div>
          {runsQuery.data?.items.length ? (
            <div className="stacked-table">
              {runsQuery.data.items.map((run) => (
                <article className="stacked-row" key={run.snapshotRunId}>
                  <div className="stacked-row-head">
                    <strong>{run.snapshotType}</strong>
                    <span className="status-pill status-pill-calm">{run.runStatus}</span>
                  </div>
                  <p>{formatDate(run.periodStart)} - {formatDate(run.periodEnd)}</p>
                  <span className="queue-subtitle">{run.snapshotRunId}</span>
                  <div className="action-cluster">
                    <Link className="back-link" to={`/admin/reports/workforce/${run.snapshotRunId}`}>
                      <span>Workforce</span>
                    </Link>
                    <Link className="back-link" to={`/admin/reports/kpis/${run.snapshotRunId}`}>
                      <span>KPIs</span>
                    </Link>
                    <Link className="back-link" to={`/admin/reports/checklists/${run.snapshotRunId}`}>
                      <span>Checklists</span>
                    </Link>
                    <Link className="back-link" to={`/admin/reports/turnover/${run.snapshotRunId}`}>
                      <span>Turnover</span>
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState copy="No completed snapshot runs are available for reporting yet." />
          )}
        </article>
      </section>
    </section>
  )
}
