import { useDeferredValue, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, ClipboardCheck, SearchCheck, ShieldAlert } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import {
  EmptyState,
  KeyValue,
  MetricAccent,
  MetricCard,
  ScreenState,
  StatusPill,
} from '../components/dashboard-primitives'
import { ReportingToolbar } from '../components/reporting-tools'
import { getChecklistReport } from '../features/reports/api'
import { downloadCsv } from '../lib/download-csv'
import { getErrorMessage } from '../lib/format'

function toNumber(input: string | null) {
  const parsed = Number(input)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatMetric(input: number) {
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: Number.isInteger(input) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(input)
}

function formatPercent(input: string | null) {
  return `${formatMetric(toNumber(input) * 100)}%`
}

function mapChecklistTone(complianceRate: string | null, criticalIssueCount: number) {
  if (criticalIssueCount > 0) return 'danger'
  const compliance = toNumber(complianceRate)
  if (compliance >= 0.95) return 'calm'
  if (compliance >= 0.85) return 'warning'
  return 'danger'
}

export function ReportsChecklistsPage() {
  const { snapshotRunId } = useParams<{ snapshotRunId: string }>()
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'critical-desc' | 'compliance-desc' | 'store'>('critical-desc')
  const deferredSearch = useDeferredValue(search)

  const checklistQuery = useQuery({
    queryKey: ['reporting-checklists', snapshotRunId],
    queryFn: () => getChecklistReport({ snapshotRunId: snapshotRunId ?? '' }),
    enabled: Boolean(snapshotRunId),
  })
  const rows = useMemo(() => checklistQuery.data?.items ?? [], [checklistQuery.data?.items])
  const filteredRows = useMemo(() => {
    const input = deferredSearch.trim().toLowerCase()
    if (!input) {
      return rows
    }

    return rows.filter((row) =>
      [
        row.storeId,
        row.checklistTemplateId,
        row.auditCount,
        row.avgScore ?? '',
        row.complianceRate ?? '',
        row.criticalIssueCount,
      ]
        .join(' ')
        .toLowerCase()
        .includes(input),
    )
  }, [deferredSearch, rows])

  const sortedRows = useMemo(() => {
    const items = [...filteredRows]
    if (sortBy === 'compliance-desc') {
      return items.sort((left, right) => toNumber(right.complianceRate) - toNumber(left.complianceRate))
    }
    if (sortBy === 'store') {
      return items.sort((left, right) => left.storeId.localeCompare(right.storeId))
    }
    return items.sort((left, right) => right.criticalIssueCount - left.criticalIssueCount)
  }, [filteredRows, sortBy])

  const totals = useMemo(() => {
    return sortedRows.reduce(
      (accumulator, row) => {
        accumulator.auditCount += row.auditCount
        accumulator.avgScore += toNumber(row.avgScore)
        accumulator.complianceRate += toNumber(row.complianceRate)
        accumulator.criticalIssues += row.criticalIssueCount
        if (row.criticalIssueCount > 0) accumulator.rowsWithCriticalIssues += 1
        return accumulator
      },
      {
        auditCount: 0,
        avgScore: 0,
        complianceRate: 0,
        criticalIssues: 0,
        rowsWithCriticalIssues: 0,
      },
    )
  }, [sortedRows])

  const averageScore = sortedRows.length > 0 ? totals.avgScore / sortedRows.length : 0
  const averageCompliance = sortedRows.length > 0 ? totals.complianceRate / sortedRows.length : 0

  if (!snapshotRunId) {
    return <ScreenState title="Checklist context missing" copy="Choose a reporting snapshot run before opening checklist rows." tone="error" />
  }

  if (checklistQuery.isLoading) {
    return <ScreenState title="Loading checklist rows" copy="Pulling checklist compliance rows for the selected reporting context." />
  }

  if (checklistQuery.isError) {
    return <ScreenState title="Checklist report unavailable" copy={getErrorMessage(checklistQuery.error)} tone="error" />
  }

  return (
    <section className="page-stack">
      <section className="hero-panel">
        <div>
          <div className="eyebrow">Reporting Drill-Down</div>
          <h2 className="hero-title">Checklist rows for one immutable reporting context.</h2>
          <p className="hero-copy">
            This slice isolates checklist compliance from KPI and workforce data, which makes future
            audit semantics, scoring rules, and remediation flows easier to expand without crossover.
          </p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label="Snapshot run" value={snapshotRunId.slice(0, 12)} />
          <MetricAccent label="Rows in view" value={String(filteredRows.length)} />
          <MetricAccent label="Avg compliance" value={formatPercent(String(averageCompliance))} />
        </div>
      </section>

      <Link className="back-link" to="/admin/reports/snapshot-runs">
        <ArrowLeft size={16} />
        <span>Choose another snapshot</span>
      </Link>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">Reporting context</div>
            <h3>Selected checklist snapshot</h3>
          </div>
        </div>
        <div className="key-grid">
          <KeyValue label="Snapshot run id" value={snapshotRunId} />
          <KeyValue label="Rows loaded" value={String(rows.length)} />
          <KeyValue label="Rows after filter" value={String(filteredRows.length)} />
          <KeyValue label="Critical rows" value={String(totals.rowsWithCriticalIssues)} />
        </div>
      </section>

      <section className="metric-grid">
        <MetricCard title="Audit count" value={totals.auditCount} note="Total audits represented in current view" icon={<SearchCheck size={18} />} tone="accent" />
        <MetricCard title="Avg score" value={Math.round(averageScore)} note={`Average compliance ${formatPercent(String(averageCompliance))}`} icon={<ClipboardCheck size={18} />} tone="calm" />
        <MetricCard title="Critical issues" value={totals.criticalIssues} note={`${totals.rowsWithCriticalIssues} rows contain critical findings`} icon={<AlertTriangle size={18} />} tone={totals.criticalIssues === 0 ? 'neutral' : 'danger'} />
        <MetricCard title="Critical rows" value={totals.rowsWithCriticalIssues} note="Store-template pairs needing remediation attention" icon={<ShieldAlert size={18} />} tone={totals.rowsWithCriticalIssues === 0 ? 'calm' : 'warning'} />
      </section>

      <section className="panel">
        <div className="panel-heading panel-heading-spread">
          <div>
            <div className="eyebrow">Checklist table</div>
            <h3>Store-template compliance rows</h3>
            <p className="panel-copy">
              Filter by store, checklist template, score, compliance, or critical issue count.
            </p>
          </div>
          <ReportingToolbar
            sortValue={sortBy}
            onSortChange={(value) => setSortBy(value as typeof sortBy)}
            sortOptions={[
              { value: 'critical-desc', label: 'Most critical issues' },
              { value: 'compliance-desc', label: 'Highest compliance' },
              { value: 'store', label: 'Store id' },
            ]}
            onExport={() =>
              downloadCsv({
                filename: `checklists-${snapshotRunId}.csv`,
                columns: ['snapshotRunId', 'storeId', 'checklistTemplateId', 'auditCount', 'avgScore', 'complianceRate', 'criticalIssueCount'],
                rows: sortedRows.map((row) => [
                  row.snapshotRunId,
                  row.storeId,
                  row.checklistTemplateId,
                  row.auditCount,
                  row.avgScore,
                  row.complianceRate,
                  row.criticalIssueCount,
                ]),
              })
            }
          >
            <label className="search-field">
              <span className="sr-only">Filter checklist rows</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by store, template, score, or issue count"
              />
            </label>
          </ReportingToolbar>
        </div>

        {sortedRows.length === 0 ? (
          <EmptyState
            title="No checklist rows matched your filter."
            copy="Clear the search to inspect the full checklist output for this snapshot."
          />
        ) : (
          <div className="stacked-table">
            {sortedRows.map((row) => (
              <article className="stacked-row" key={`${row.storeId}:${row.checklistTemplateId}`}>
                <div className="stacked-row-head">
                  <div>
                    <strong>{row.storeId}</strong>
                    <span className="queue-subtitle">{row.checklistTemplateId}</span>
                  </div>
                  <StatusPill tone={mapChecklistTone(row.complianceRate, row.criticalIssueCount)}>
                    {row.criticalIssueCount > 0 ? 'Critical findings' : 'Compliant'}
                  </StatusPill>
                </div>

                <div className="key-grid">
                  <KeyValue label="Audit count" value={String(row.auditCount)} />
                  <KeyValue label="Average score" value={formatMetric(toNumber(row.avgScore))} />
                  <KeyValue label="Compliance rate" value={formatPercent(row.complianceRate)} />
                  <KeyValue label="Critical issue count" value={String(row.criticalIssueCount)} />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  )
}
