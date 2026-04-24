import { useDeferredValue, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, ArrowLeft, Gauge, Target, Trophy } from 'lucide-react'
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
import { getKpiReport } from '../features/reports/api'
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

function formatPercent(input: string | null) {
  return `${formatMetric(toNumber(input) * 100)}%`
}

function mapStatusBandTone(input: string | null) {
  if (input === 'on_track') return 'calm'
  if (input === 'at_risk') return 'warning'
  if (input === 'off_track') return 'danger'
  if (input === 'exceeded' || input === 'over_target') return 'accent'
  return 'neutral'
}

export function ReportsKpisPage() {
  const { snapshotRunId } = useParams<{ snapshotRunId: string }>()
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'achievement-desc' | 'store' | 'status'>('achievement-desc')
  const deferredSearch = useDeferredValue(search)

  const kpiQuery = useQuery({
    queryKey: ['reporting-kpis', snapshotRunId],
    queryFn: () => getKpiReport(snapshotRunId ?? ''),
    enabled: Boolean(snapshotRunId),
  })
  const rows = useMemo(() => kpiQuery.data?.items ?? [], [kpiQuery.data?.items])
  const filteredRows = useMemo(() => {
    const input = deferredSearch.trim().toLowerCase()
    if (!input) {
      return rows
    }

    return rows.filter((row) =>
      [
        row.storeId,
        row.kpiId,
        row.statusBand ?? '',
        row.targetValue ?? '',
        row.actualValue ?? '',
        row.achievementRate ?? '',
      ]
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
    if (sortBy === 'status') {
      return items.sort((left, right) => (left.statusBand ?? '').localeCompare(right.statusBand ?? ''))
    }
    return items.sort((left, right) => toNumber(right.achievementRate) - toNumber(left.achievementRate))
  }, [filteredRows, sortBy])

  const totals = useMemo(() => {
    return sortedRows.reduce(
      (accumulator, row) => {
        accumulator.target += toNumber(row.targetValue)
        accumulator.actual += toNumber(row.actualValue)
        accumulator.achievement += toNumber(row.achievementRate)
        if (row.statusBand === 'on_track') accumulator.onTrack += 1
        if (row.statusBand === 'at_risk') accumulator.atRisk += 1
        if (row.statusBand === 'off_track') accumulator.offTrack += 1
        return accumulator
      },
      {
        target: 0,
        actual: 0,
        achievement: 0,
        onTrack: 0,
        atRisk: 0,
        offTrack: 0,
      },
    )
  }, [sortedRows])

  const averageAchievement = sortedRows.length > 0 ? totals.achievement / sortedRows.length : 0

  if (!snapshotRunId) {
    return <ScreenState title="KPI context missing" copy="Choose a reporting snapshot run before opening KPI rows." tone="error" />
  }

  if (kpiQuery.isLoading) {
    return <ScreenState title="Loading KPI rows" copy="Pulling materialized KPI rows for the selected reporting context." />
  }

  if (kpiQuery.isError) {
    return <ScreenState title="KPI report unavailable" copy={getErrorMessage(kpiQuery.error)} tone="error" />
  }

  return (
    <section className="page-stack">
      <section className="hero-panel">
        <div>
          <div className="eyebrow">Reporting Drill-Down</div>
          <h2 className="hero-title">KPI rows for one immutable reporting context.</h2>
          <p className="hero-copy">
            KPI output stays separate from workforce logic, so we can grow targets, bonus rules,
            and future scorecard semantics without tangling the reporting surface.
          </p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label="Snapshot run" value={snapshotRunId.slice(0, 12)} />
          <MetricAccent label="Rows in view" value={String(filteredRows.length)} />
          <MetricAccent label="Avg achievement" value={formatPercent(String(averageAchievement))} />
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
            <h3>Selected KPI snapshot</h3>
          </div>
        </div>
        <div className="key-grid">
          <KeyValue label="Snapshot run id" value={snapshotRunId} />
          <KeyValue label="Rows loaded" value={String(rows.length)} />
          <KeyValue label="Rows after filter" value={String(filteredRows.length)} />
          <KeyValue label="Off-track rows" value={String(totals.offTrack)} />
        </div>
      </section>

      <section className="metric-grid">
        <MetricCard title="Target total" value={Math.round(totals.target)} note="Sum of target values in current view" icon={<Target size={18} />} tone="accent" />
        <MetricCard title="Actual total" value={Math.round(totals.actual)} note="Sum of actual values in current view" icon={<Gauge size={18} />} tone="calm" />
        <MetricCard title="On track" value={totals.onTrack} note={`${totals.atRisk} at risk in the same filter`} icon={<Trophy size={18} />} tone="calm" />
        <MetricCard title="Off track" value={totals.offTrack} note={`Average achievement ${formatPercent(String(averageAchievement))}`} icon={<Activity size={18} />} tone={totals.offTrack === 0 ? 'neutral' : 'danger'} />
      </section>

      <section className="panel">
        <div className="panel-heading panel-heading-spread">
          <div>
            <div className="eyebrow">KPI table</div>
            <h3>Store-KPI performance rows</h3>
            <p className="panel-copy">
              Filter by store, KPI, status band, or numeric values to narrow the materialized output.
            </p>
          </div>
          <ReportingToolbar
            sortValue={sortBy}
            onSortChange={(value) => setSortBy(value as typeof sortBy)}
            sortOptions={[
              { value: 'achievement-desc', label: 'Highest achievement' },
              { value: 'store', label: 'Store id' },
              { value: 'status', label: 'Status band' },
            ]}
            onExport={() =>
              downloadCsv({
                filename: `kpis-${snapshotRunId}.csv`,
                columns: ['snapshotRunId', 'storeId', 'kpiId', 'periodStart', 'periodEnd', 'targetValue', 'actualValue', 'achievementRate', 'statusBand'],
                rows: sortedRows.map((row) => [
                  row.snapshotRunId,
                  row.storeId,
                  row.kpiId,
                  row.periodStart,
                  row.periodEnd,
                  row.targetValue,
                  row.actualValue,
                  row.achievementRate,
                  row.statusBand,
                ]),
              })
            }
          >
            <label className="search-field">
              <span className="sr-only">Filter KPI rows</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by store, KPI, status, or value"
              />
            </label>
          </ReportingToolbar>
        </div>

        {sortedRows.length === 0 ? (
          <EmptyState
            title="No KPI rows matched your filter."
            copy="Clear the search to inspect the full KPI output for this snapshot."
          />
        ) : (
          <div className="stacked-table">
            {sortedRows.map((row) => (
              <article className="stacked-row" key={`${row.storeId}:${row.kpiId}`}>
                <div className="stacked-row-head">
                  <div>
                    <strong>{row.storeId}</strong>
                    <span className="queue-subtitle">{row.kpiId}</span>
                  </div>
                  <StatusPill tone={mapStatusBandTone(row.statusBand)}>
                    {row.statusBand ?? 'unknown'}
                  </StatusPill>
                </div>

                <div className="key-grid">
                  <KeyValue label="Period" value={`${formatDate(row.periodStart)} - ${formatDate(row.periodEnd)}`} />
                  <KeyValue label="Target value" value={formatMetric(toNumber(row.targetValue))} />
                  <KeyValue label="Actual value" value={formatMetric(toNumber(row.actualValue))} />
                  <KeyValue label="Achievement" value={formatPercent(row.achievementRate)} />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  )
}
