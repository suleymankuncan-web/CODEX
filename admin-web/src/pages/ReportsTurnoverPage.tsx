import { useDeferredValue, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Building2, DoorOpen, Ratio, Users } from 'lucide-react'
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
import { getTurnoverReport } from '../features/reports/api'
import { downloadCsv } from '../lib/download-csv'
import { formatDate, getErrorMessage } from '../lib/format'

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

function formatPercent(input: string) {
  return `${formatMetric(toNumber(input) * 100)}%`
}

function getScopeLabel(row: {
  scopeType: string
  companyId: string | null
  regionId: string | null
  storeId: string | null
}) {
  if (row.scopeType === 'store') return row.storeId ?? 'store'
  if (row.scopeType === 'region') return row.regionId ?? 'region'
  if (row.scopeType === 'company') return row.companyId ?? 'company'
  return 'scope'
}

function mapTurnoverTone(rate: string) {
  const value = toNumber(rate)
  if (value < 0.08) return 'calm'
  if (value < 0.15) return 'warning'
  return 'danger'
}

export function ReportsTurnoverPage() {
  const { snapshotRunId } = useParams<{ snapshotRunId: string }>()
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'turnover-desc' | 'scope' | 'leavers-desc'>('turnover-desc')
  const deferredSearch = useDeferredValue(search)

  const turnoverQuery = useQuery({
    queryKey: ['reporting-turnover', snapshotRunId],
    queryFn: () => getTurnoverReport(snapshotRunId ?? ''),
    enabled: Boolean(snapshotRunId),
  })
  const rows = useMemo(() => turnoverQuery.data?.items ?? [], [turnoverQuery.data?.items])
  const filteredRows = useMemo(() => {
    const input = deferredSearch.trim().toLowerCase()
    if (!input) {
      return rows
    }

    return rows.filter((row) =>
      [
        row.scopeType,
        row.companyId ?? '',
        row.regionId ?? '',
        row.storeId ?? '',
        row.leaverCount,
        row.turnoverRate,
      ]
        .join(' ')
        .toLowerCase()
        .includes(input),
    )
  }, [deferredSearch, rows])

  const sortedRows = useMemo(() => {
    const items = [...filteredRows]
    if (sortBy === 'scope') {
      return items.sort((left, right) => left.scopeType.localeCompare(right.scopeType))
    }
    if (sortBy === 'leavers-desc') {
      return items.sort((left, right) => right.leaverCount - left.leaverCount)
    }
    return items.sort((left, right) => toNumber(right.turnoverRate) - toNumber(left.turnoverRate))
  }, [filteredRows, sortBy])

  const totals = useMemo(() => {
    return sortedRows.reduce(
      (accumulator, row) => {
        accumulator.opening += toNumber(row.openingHeadcount)
        accumulator.closing += toNumber(row.closingHeadcount)
        accumulator.average += toNumber(row.avgHeadcount)
        accumulator.leavers += row.leaverCount
        accumulator.turnover += toNumber(row.turnoverRate)
        return accumulator
      },
      {
        opening: 0,
        closing: 0,
        average: 0,
        leavers: 0,
        turnover: 0,
      },
    )
  }, [sortedRows])

  const averageTurnover = sortedRows.length > 0 ? totals.turnover / sortedRows.length : 0

  if (!snapshotRunId) {
    return <ScreenState title="Turnover context missing" copy="Choose a reporting snapshot run before opening turnover rows." tone="error" />
  }

  if (turnoverQuery.isLoading) {
    return <ScreenState title="Loading turnover rows" copy="Pulling turnover rows for the selected reporting context." />
  }

  if (turnoverQuery.isError) {
    return <ScreenState title="Turnover report unavailable" copy={getErrorMessage(turnoverQuery.error)} tone="error" />
  }

  return (
    <section className="page-stack">
      <section className="hero-panel">
        <div>
          <div className="eyebrow">Reporting Drill-Down</div>
          <h2 className="hero-title">Turnover rows for one immutable reporting context.</h2>
          <p className="hero-copy">
            Turnover remains its own reporting slice so we can evolve scope semantics, leaver logic,
            and retention analysis without entangling workforce or KPI screens.
          </p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label="Snapshot run" value={snapshotRunId.slice(0, 12)} />
          <MetricAccent label="Rows in view" value={String(filteredRows.length)} />
          <MetricAccent label="Avg turnover" value={formatPercent(String(averageTurnover))} />
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
            <h3>Selected turnover snapshot</h3>
          </div>
        </div>
        <div className="key-grid">
          <KeyValue label="Snapshot run id" value={snapshotRunId} />
          <KeyValue label="Rows loaded" value={String(rows.length)} />
          <KeyValue label="Rows after filter" value={String(filteredRows.length)} />
          <KeyValue label="Leavers in view" value={String(totals.leavers)} />
        </div>
      </section>

      <section className="metric-grid">
        <MetricCard title="Opening HC" value={Math.round(totals.opening)} note="Summed opening headcount in current view" icon={<Users size={18} />} tone="neutral" />
        <MetricCard title="Closing HC" value={Math.round(totals.closing)} note={`Average headcount ${formatMetric(totals.average)}`} icon={<Building2 size={18} />} tone="calm" />
        <MetricCard title="Leaver count" value={totals.leavers} note={`Average turnover ${formatPercent(String(averageTurnover))}`} icon={<DoorOpen size={18} />} tone={totals.leavers === 0 ? 'neutral' : 'warning'} />
        <MetricCard title="Turnover rate" value={Math.round(averageTurnover * 100)} note="Average percentage across filtered rows" icon={<Ratio size={18} />} tone={averageTurnover < 0.08 ? 'calm' : averageTurnover < 0.15 ? 'warning' : 'danger'} />
      </section>

      <section className="panel">
        <div className="panel-heading panel-heading-spread">
          <div>
            <div className="eyebrow">Turnover table</div>
            <h3>Company, region, and store turnover rows</h3>
            <p className="panel-copy">
              Filter by scope, org ids, leaver count, or turnover rate to narrow the materialized output.
            </p>
          </div>
          <ReportingToolbar
            sortValue={sortBy}
            onSortChange={(value) => setSortBy(value as typeof sortBy)}
            sortOptions={[
              { value: 'turnover-desc', label: 'Highest turnover' },
              { value: 'leavers-desc', label: 'Most leavers' },
              { value: 'scope', label: 'Scope type' },
            ]}
            onExport={() =>
              downloadCsv({
                filename: `turnover-${snapshotRunId}.csv`,
                columns: ['snapshotRunId', 'scopeType', 'companyId', 'regionId', 'storeId', 'periodStart', 'periodEnd', 'openingHeadcount', 'closingHeadcount', 'avgHeadcount', 'leaverCount', 'turnoverRate'],
                rows: sortedRows.map((row) => [
                  row.snapshotRunId,
                  row.scopeType,
                  row.companyId,
                  row.regionId,
                  row.storeId,
                  row.periodStart,
                  row.periodEnd,
                  row.openingHeadcount,
                  row.closingHeadcount,
                  row.avgHeadcount,
                  row.leaverCount,
                  row.turnoverRate,
                ]),
              })
            }
          >
            <label className="search-field">
              <span className="sr-only">Filter turnover rows</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by scope, org id, leavers, or turnover"
              />
            </label>
          </ReportingToolbar>
        </div>

        {sortedRows.length === 0 ? (
          <EmptyState
            title="No turnover rows matched your filter."
            copy="Clear the search to inspect the full turnover output for this snapshot."
          />
        ) : (
          <div className="stacked-table">
            {sortedRows.map((row, index) => (
              <article className="stacked-row" key={`${row.scopeType}:${getScopeLabel(row)}:${index}`}>
                <div className="stacked-row-head">
                  <div>
                    <strong>{row.scopeType}</strong>
                    <span className="queue-subtitle">{getScopeLabel(row)}</span>
                  </div>
                  <StatusPill tone={mapTurnoverTone(row.turnoverRate)}>
                    {formatPercent(row.turnoverRate)}
                  </StatusPill>
                </div>

                <div className="key-grid">
                  <KeyValue label="Period" value={`${formatDate(row.periodStart)} - ${formatDate(row.periodEnd)}`} />
                  <KeyValue label="Opening HC" value={formatMetric(toNumber(row.openingHeadcount))} />
                  <KeyValue label="Closing HC" value={formatMetric(toNumber(row.closingHeadcount))} />
                  <KeyValue label="Average HC" value={formatMetric(toNumber(row.avgHeadcount))} />
                  <KeyValue label="Leaver count" value={String(row.leaverCount)} />
                  <KeyValue label="Turnover rate" value={formatPercent(row.turnoverRate)} />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  )
}
