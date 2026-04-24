import { useDeferredValue, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, BriefcaseBusiness, Building2, Users } from 'lucide-react'
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
import { getWorkforceReport } from '../features/reports/api'
import { downloadCsv } from '../lib/download-csv'
import { getErrorMessage } from '../lib/format'

function toNumber(input: string) {
  const parsed = Number(input)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatMetric(input: number) {
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: Number.isInteger(input) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(input)
}

export function ReportsWorkforcePage() {
  const { snapshotRunId } = useParams<{ snapshotRunId: string }>()
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'gap-desc' | 'store' | 'position'>('gap-desc')
  const deferredSearch = useDeferredValue(search)

  const workforceQuery = useQuery({
    queryKey: ['reporting-workforce', snapshotRunId],
    queryFn: () => getWorkforceReport(snapshotRunId ?? ''),
    enabled: Boolean(snapshotRunId),
  })
  const rows = useMemo(() => workforceQuery.data?.items ?? [], [workforceQuery.data?.items])
  const filteredRows = useMemo(() => {
    const input = deferredSearch.trim().toLowerCase()
    if (!input) {
      return rows
    }

    return rows.filter((row) =>
      [row.storeId, row.positionId, row.gapHeadcount, row.gapFte, row.activeHeadcount, row.plannedHeadcount]
        .join(' ')
        .toLowerCase()
        .includes(input),
    )
  }, [deferredSearch, rows])

  const sortedRows = useMemo(() => {
    const items = [...filteredRows]
    if (sortBy === 'store') {
      return items.sort((left, right) => left.storeId.localeCompare(right.storeId))
    }
    if (sortBy === 'position') {
      return items.sort((left, right) => left.positionId.localeCompare(right.positionId))
    }
    return items.sort(
      (left, right) =>
        Math.abs(toNumber(right.gapHeadcount)) + Math.abs(toNumber(right.gapFte)) -
        (Math.abs(toNumber(left.gapHeadcount)) + Math.abs(toNumber(left.gapFte))),
    )
  }, [filteredRows, sortBy])

  const totals = useMemo(() => {
    return sortedRows.reduce(
      (accumulator, row) => {
        accumulator.activeHeadcount += toNumber(row.activeHeadcount)
        accumulator.activeFte += toNumber(row.activeFte)
        accumulator.plannedHeadcount += toNumber(row.plannedHeadcount)
        accumulator.plannedFte += toNumber(row.plannedFte)
        accumulator.gapHeadcount += toNumber(row.gapHeadcount)
        accumulator.gapFte += toNumber(row.gapFte)
        return accumulator
      },
      {
        activeHeadcount: 0,
        activeFte: 0,
        plannedHeadcount: 0,
        plannedFte: 0,
        gapHeadcount: 0,
        gapFte: 0,
      },
    )
  }, [sortedRows])

  const rowsWithGap = sortedRows.filter((row) => toNumber(row.gapHeadcount) !== 0 || toNumber(row.gapFte) !== 0).length

  if (!snapshotRunId) {
    return <ScreenState title="Workforce context missing" copy="Choose a reporting snapshot run before opening workforce rows." tone="error" />
  }

  if (workforceQuery.isLoading) {
    return <ScreenState title="Loading workforce rows" copy="Pulling materialized staffing rows for the selected reporting context." />
  }

  if (workforceQuery.isError) {
    return <ScreenState title="Workforce report unavailable" copy={getErrorMessage(workforceQuery.error)} tone="error" />
  }

  return (
    <section className="page-stack">
      <section className="hero-panel">
        <div>
          <div className="eyebrow">Reporting Drill-Down</div>
          <h2 className="hero-title">Workforce rows for one immutable reporting context.</h2>
          <p className="hero-copy">
            This page stays intentionally operational: choose a snapshot run, inspect staffing balance,
            and isolate where planned versus active staffing diverges.
          </p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label="Snapshot run" value={snapshotRunId.slice(0, 12)} />
          <MetricAccent label="Rows in view" value={String(filteredRows.length)} />
          <MetricAccent label="Stores with gap" value={String(rowsWithGap)} />
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
            <h3>Selected workforce snapshot</h3>
          </div>
        </div>
        <div className="key-grid">
          <KeyValue label="Snapshot run id" value={snapshotRunId} />
          <KeyValue label="Rows loaded" value={String(rows.length)} />
          <KeyValue label="Rows after filter" value={String(filteredRows.length)} />
          <KeyValue label="Gap rows" value={String(rowsWithGap)} />
        </div>
      </section>

      <section className="metric-grid">
        <MetricCard title="Active headcount" value={Math.round(totals.activeHeadcount)} note={`Active FTE ${formatMetric(totals.activeFte)}`} icon={<Users size={18} />} tone="calm" />
        <MetricCard title="Planned headcount" value={Math.round(totals.plannedHeadcount)} note={`Planned FTE ${formatMetric(totals.plannedFte)}`} icon={<BriefcaseBusiness size={18} />} tone="accent" />
        <MetricCard title="Headcount gap" value={Math.round(totals.gapHeadcount)} note={`Gap FTE ${formatMetric(totals.gapFte)}`} icon={<Building2 size={18} />} tone={totals.gapHeadcount === 0 && totals.gapFte === 0 ? 'neutral' : 'warning'} />
        <MetricCard title="Gap rows" value={rowsWithGap} note="Store and position pairs needing closer review" icon={<ArrowRight size={18} />} tone={rowsWithGap === 0 ? 'calm' : 'danger'} />
      </section>

      <section className="panel">
        <div className="panel-heading panel-heading-spread">
          <div>
            <div className="eyebrow">Workforce table</div>
            <h3>Store-position staffing balance</h3>
            <p className="panel-copy">
              Filter by store, position, or any numeric staffing field to narrow the materialized output.
            </p>
          </div>
          <ReportingToolbar
            sortValue={sortBy}
            onSortChange={(value) => setSortBy(value as typeof sortBy)}
            sortOptions={[
              { value: 'gap-desc', label: 'Largest gap first' },
              { value: 'store', label: 'Store id' },
              { value: 'position', label: 'Position id' },
            ]}
            onExport={() =>
              downloadCsv({
                filename: `workforce-${snapshotRunId}.csv`,
                columns: ['snapshotRunId', 'storeId', 'positionId', 'activeHeadcount', 'activeFte', 'plannedHeadcount', 'plannedFte', 'gapHeadcount', 'gapFte'],
                rows: sortedRows.map((row) => [
                  row.snapshotRunId,
                  row.storeId,
                  row.positionId,
                  row.activeHeadcount,
                  row.activeFte,
                  row.plannedHeadcount,
                  row.plannedFte,
                  row.gapHeadcount,
                  row.gapFte,
                ]),
              })
            }
          >
            <label className="search-field">
              <span className="sr-only">Filter workforce rows</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by store, position, or gap"
              />
            </label>
          </ReportingToolbar>
        </div>

        {sortedRows.length === 0 ? (
          <EmptyState
            title="No workforce rows matched your filter."
            copy="Clear the search to inspect the full materialized workforce output for this snapshot."
          />
        ) : (
          <div className="stacked-table">
            {sortedRows.map((row) => {
              const hasGap = toNumber(row.gapHeadcount) !== 0 || toNumber(row.gapFte) !== 0

              return (
                <article className="stacked-row" key={`${row.storeId}:${row.positionId}`}>
                  <div className="stacked-row-head">
                    <div>
                      <strong>{row.storeId}</strong>
                      <span className="queue-subtitle">{row.positionId}</span>
                    </div>
                    <StatusPill tone={hasGap ? 'warning' : 'calm'}>
                      {hasGap ? 'Gap detected' : 'Balanced'}
                    </StatusPill>
                  </div>

                  <div className="key-grid">
                    <KeyValue label="Active HC" value={formatMetric(toNumber(row.activeHeadcount))} />
                    <KeyValue label="Planned HC" value={formatMetric(toNumber(row.plannedHeadcount))} />
                    <KeyValue label="Gap HC" value={formatMetric(toNumber(row.gapHeadcount))} />
                    <KeyValue label="Active FTE" value={formatMetric(toNumber(row.activeFte))} />
                    <KeyValue label="Planned FTE" value={formatMetric(toNumber(row.plannedFte))} />
                    <KeyValue label="Gap FTE" value={formatMetric(toNumber(row.gapFte))} />
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </section>
  )
}
