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
import type { TranslateFunction } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import { getKpiReport } from '../features/reports/api'
import { downloadCsv } from '../lib/download-csv'
import { formatDate, formatNumber, getErrorMessage } from '../lib/format'
import type { AppLocale } from '../lib/i18n'

function toNumber(input: string | null) {
  const parsed = Number(input)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatMetric(input: number, locale: AppLocale) {
  return formatNumber(input, locale, {
    minimumFractionDigits: Number.isInteger(input) ? 0 : 2,
    maximumFractionDigits: 2,
  })
}

function formatPercent(input: string | null, locale: AppLocale) {
  return `${formatMetric(toNumber(input) * 100, locale)}%`
}

function mapStatusBandTone(input: string | null) {
  if (input === 'on_track') return 'calm'
  if (input === 'at_risk') return 'warning'
  if (input === 'off_track') return 'danger'
  if (input === 'exceeded' || input === 'over_target') return 'accent'
  return 'neutral'
}

function mapStatusBandLabel(input: string | null, t: TranslateFunction) {
  if (input === 'on_track') return t('reportsKpis.status.onTrack')
  if (input === 'at_risk') return t('reportsKpis.status.atRisk')
  if (input === 'off_track') return t('reportsKpis.status.offTrack')
  if (input === 'exceeded') return t('reportsKpis.status.exceeded')
  if (input === 'over_target') return t('reportsKpis.status.overTarget')
  return input ?? t('reportsKpis.status.unknown')
}

export function ReportsKpisPage() {
  const { locale, t } = useLocalization()
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
        mapStatusBandLabel(row.statusBand, t),
        row.targetValue ?? '',
        row.actualValue ?? '',
        row.achievementRate ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(input),
    )
  }, [deferredSearch, rows, t])

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
    return <ScreenState title={t('reportsKpis.missingTitle')} copy={t('reportsKpis.missingCopy')} tone="error" />
  }

  if (kpiQuery.isLoading) {
    return <ScreenState title={t('reportsKpis.loadingTitle')} copy={t('reportsKpis.loadingCopy')} />
  }

  if (kpiQuery.isError) {
    return <ScreenState title={t('reportsKpis.errorTitle')} copy={getErrorMessage(kpiQuery.error)} tone="error" />
  }

  return (
    <section className="page-stack">
      <section className="hero-panel">
        <div>
          <div className="eyebrow">{t('reportsKpis.heroEyebrow')}</div>
          <h2 className="hero-title">{t('reportsKpis.heroTitle')}</h2>
          <p className="hero-copy">{t('reportsKpis.heroCopy')}</p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label={t('reportsKpis.snapshotRun')} value={snapshotRunId.slice(0, 12)} />
          <MetricAccent label={t('reportsKpis.rowsInView')} value={String(filteredRows.length)} />
          <MetricAccent label={t('reportsKpis.avgAchievement')} value={formatPercent(String(averageAchievement), locale)} />
        </div>
      </section>

      <Link className="back-link" to="/admin/reports/snapshot-runs">
        <ArrowLeft size={16} />
        <span>{t('reportsKpis.chooseAnotherSnapshot')}</span>
      </Link>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">{t('reportsKpis.contextEyebrow')}</div>
            <h3>{t('reportsKpis.contextTitle')}</h3>
          </div>
        </div>
        <div className="key-grid">
          <KeyValue label={t('reportsKpis.snapshotRunId')} value={snapshotRunId} />
          <KeyValue label={t('reportsKpis.rowsLoaded')} value={String(rows.length)} />
          <KeyValue label={t('reportsKpis.rowsAfterFilter')} value={String(filteredRows.length)} />
          <KeyValue label={t('reportsKpis.offTrackRows')} value={String(totals.offTrack)} />
        </div>
      </section>

      <section className="metric-grid">
        <MetricCard title={t('reportsKpis.targetTotalTitle')} value={Math.round(totals.target)} note={t('reportsKpis.targetTotalNote')} icon={<Target size={18} />} tone="accent" />
        <MetricCard title={t('reportsKpis.actualTotalTitle')} value={Math.round(totals.actual)} note={t('reportsKpis.actualTotalNote')} icon={<Gauge size={18} />} tone="calm" />
        <MetricCard title={t('reportsKpis.onTrackTitle')} value={totals.onTrack} note={t('reportsKpis.onTrackNote', { count: totals.atRisk })} icon={<Trophy size={18} />} tone="calm" />
        <MetricCard title={t('reportsKpis.offTrackTitle')} value={totals.offTrack} note={t('reportsKpis.offTrackNote', { value: formatPercent(String(averageAchievement), locale) })} icon={<Activity size={18} />} tone={totals.offTrack === 0 ? 'neutral' : 'danger'} />
      </section>

      <section className="panel reports-detail-table-panel">
        <div className="panel-heading panel-heading-spread">
          <div>
            <div className="eyebrow">{t('reportsKpis.tableEyebrow')}</div>
            <h3>{t('reportsKpis.tableTitle')}</h3>
            <p className="panel-copy">{t('reportsKpis.tableCopy')}</p>
          </div>
          <ReportingToolbar
            sortValue={sortBy}
            onSortChange={(value) => setSortBy(value as typeof sortBy)}
            sortOptions={[
              { value: 'achievement-desc', label: t('reportsKpis.sort.achievementDesc') },
              { value: 'store', label: t('reportsKpis.sort.store') },
              { value: 'status', label: t('reportsKpis.sort.status') },
            ]}
            sortAriaLabel={t('reportsKpis.sortRows')}
            exportLabel={t('reportsKpis.exportCsv')}
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
              <span className="sr-only">{t('reportsKpis.filterRows')}</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('reportsKpis.searchPlaceholder')}
              />
            </label>
          </ReportingToolbar>
        </div>

        {sortedRows.length === 0 ? (
          <EmptyState
            title={t('reportsKpis.emptyTitle')}
            copy={t('reportsKpis.emptyCopy')}
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
                    {mapStatusBandLabel(row.statusBand, t)}
                  </StatusPill>
                </div>

                <div className="key-grid">
                  <KeyValue label={t('reportsKpis.period')} value={`${formatDate(row.periodStart, locale)} - ${formatDate(row.periodEnd, locale)}`} />
                  <KeyValue label={t('reportsKpis.targetValue')} value={formatMetric(toNumber(row.targetValue), locale)} />
                  <KeyValue label={t('reportsKpis.actualValue')} value={formatMetric(toNumber(row.actualValue), locale)} />
                  <KeyValue label={t('reportsKpis.achievement')} value={formatPercent(row.achievementRate, locale)} />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  )
}
