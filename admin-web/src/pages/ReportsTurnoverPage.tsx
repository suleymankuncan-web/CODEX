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
import type { TranslateFunction } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import { getTurnoverReport } from '../features/reports/api'
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

function formatPercent(input: string, locale: AppLocale) {
  return `${formatMetric(toNumber(input) * 100, locale)}%`
}

function getScopeLabel(row: {
  scopeType: string
  companyId: string | null
  regionId: string | null
  storeId: string | null
}, t: TranslateFunction) {
  if (row.scopeType === 'store') return row.storeId ?? t('reportsTurnover.scope.store')
  if (row.scopeType === 'region') return row.regionId ?? t('reportsTurnover.scope.region')
  if (row.scopeType === 'company') return row.companyId ?? t('reportsTurnover.scope.company')
  return t('reportsTurnover.scope.unknown')
}

function getScopeTypeLabel(scopeType: string, t: TranslateFunction) {
  if (scopeType === 'store') return t('reportsTurnover.scope.store')
  if (scopeType === 'region') return t('reportsTurnover.scope.region')
  if (scopeType === 'company') return t('reportsTurnover.scope.company')
  return t('reportsTurnover.scope.unknown')
}

function getTurnoverRowKey(row: {
  scopeType: string
  companyId: string | null
  regionId: string | null
  storeId: string | null
  periodStart: string
  periodEnd: string
}) {
  return [
    row.scopeType,
    row.companyId ?? '',
    row.regionId ?? '',
    row.storeId ?? '',
    row.periodStart,
    row.periodEnd,
  ].join(':')
}

function mapTurnoverTone(rate: string) {
  const value = toNumber(rate)
  if (value < 0.08) return 'calm'
  if (value < 0.15) return 'warning'
  return 'danger'
}

export function ReportsTurnoverPage() {
  const { locale, t } = useLocalization()
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
        getScopeTypeLabel(row.scopeType, t),
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
  }, [deferredSearch, rows, t])

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
    return <ScreenState title={t('reportsTurnover.missingTitle')} copy={t('reportsTurnover.missingCopy')} tone="error" />
  }

  if (turnoverQuery.isLoading) {
    return <ScreenState title={t('reportsTurnover.loadingTitle')} copy={t('reportsTurnover.loadingCopy')} />
  }

  if (turnoverQuery.isError) {
    return <ScreenState title={t('reportsTurnover.errorTitle')} copy={getErrorMessage(turnoverQuery.error)} tone="error" />
  }

  return (
    <section className="page-stack">
      <section className="hero-panel">
        <div>
          <div className="eyebrow">{t('reportsTurnover.heroEyebrow')}</div>
          <h2 className="hero-title">{t('reportsTurnover.heroTitle')}</h2>
          <p className="hero-copy">{t('reportsTurnover.heroCopy')}</p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label={t('reportsTurnover.snapshotRun')} value={snapshotRunId.slice(0, 12)} />
          <MetricAccent label={t('reportsTurnover.rowsInView')} value={String(filteredRows.length)} />
          <MetricAccent label={t('reportsTurnover.avgTurnover')} value={formatPercent(String(averageTurnover), locale)} />
        </div>
      </section>

      <Link className="back-link" to="/admin/reports/snapshot-runs">
        <ArrowLeft size={16} />
        <span>{t('reportsTurnover.chooseAnotherSnapshot')}</span>
      </Link>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">{t('reportsTurnover.contextEyebrow')}</div>
            <h3>{t('reportsTurnover.contextTitle')}</h3>
          </div>
        </div>
        <div className="key-grid">
          <KeyValue label={t('reportsTurnover.snapshotRunId')} value={snapshotRunId} />
          <KeyValue label={t('reportsTurnover.rowsLoaded')} value={String(rows.length)} />
          <KeyValue label={t('reportsTurnover.rowsAfterFilter')} value={String(filteredRows.length)} />
          <KeyValue label={t('reportsTurnover.leaversInView')} value={String(totals.leavers)} />
        </div>
      </section>

      <section className="metric-grid">
        <MetricCard title={t('reportsTurnover.openingHcTitle')} value={Math.round(totals.opening)} note={t('reportsTurnover.openingHcNote')} icon={<Users size={18} />} tone="neutral" />
        <MetricCard title={t('reportsTurnover.closingHcTitle')} value={Math.round(totals.closing)} note={t('reportsTurnover.closingHcNote', { value: formatMetric(totals.average, locale) })} icon={<Building2 size={18} />} tone="calm" />
        <MetricCard title={t('reportsTurnover.leaverCountTitle')} value={totals.leavers} note={t('reportsTurnover.leaverCountNote', { value: formatPercent(String(averageTurnover), locale) })} icon={<DoorOpen size={18} />} tone={totals.leavers === 0 ? 'neutral' : 'warning'} />
        <MetricCard title={t('reportsTurnover.turnoverRateTitle')} value={Math.round(averageTurnover * 100)} note={t('reportsTurnover.turnoverRateNote')} icon={<Ratio size={18} />} tone={averageTurnover < 0.08 ? 'calm' : averageTurnover < 0.15 ? 'warning' : 'danger'} />
      </section>

      <section className="panel reports-detail-table-panel">
        <div className="panel-heading panel-heading-spread">
          <div>
            <div className="eyebrow">{t('reportsTurnover.tableEyebrow')}</div>
            <h3>{t('reportsTurnover.tableTitle')}</h3>
            <p className="panel-copy">{t('reportsTurnover.tableCopy')}</p>
          </div>
          <ReportingToolbar
            sortValue={sortBy}
            onSortChange={(value) => setSortBy(value as typeof sortBy)}
            sortOptions={[
              { value: 'turnover-desc', label: t('reportsTurnover.sort.turnoverDesc') },
              { value: 'leavers-desc', label: t('reportsTurnover.sort.leaversDesc') },
              { value: 'scope', label: t('reportsTurnover.sort.scope') },
            ]}
            sortAriaLabel={t('reportsTurnover.sortRows')}
            exportLabel={t('reportsTurnover.exportCsv')}
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
              <span className="sr-only">{t('reportsTurnover.filterRows')}</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('reportsTurnover.searchPlaceholder')}
              />
            </label>
          </ReportingToolbar>
        </div>

        {sortedRows.length === 0 ? (
          <EmptyState
            title={t('reportsTurnover.emptyTitle')}
            copy={t('reportsTurnover.emptyCopy')}
          />
        ) : (
          <div className="stacked-table">
            {sortedRows.map((row) => (
              <article className="stacked-row" key={getTurnoverRowKey(row)}>
                <div className="stacked-row-head">
                  <div>
                    <strong>{getScopeTypeLabel(row.scopeType, t)}</strong>
                    <span className="queue-subtitle">{getScopeLabel(row, t)}</span>
                  </div>
                  <StatusPill tone={mapTurnoverTone(row.turnoverRate)}>
                    {formatPercent(row.turnoverRate, locale)}
                  </StatusPill>
                </div>

                <div className="key-grid">
                  <KeyValue label={t('reportsTurnover.period')} value={`${formatDate(row.periodStart, locale)} - ${formatDate(row.periodEnd, locale)}`} />
                  <KeyValue label={t('reportsTurnover.openingHc')} value={formatMetric(toNumber(row.openingHeadcount), locale)} />
                  <KeyValue label={t('reportsTurnover.closingHc')} value={formatMetric(toNumber(row.closingHeadcount), locale)} />
                  <KeyValue label={t('reportsTurnover.averageHc')} value={formatMetric(toNumber(row.avgHeadcount), locale)} />
                  <KeyValue label={t('reportsTurnover.leaverCount')} value={String(row.leaverCount)} />
                  <KeyValue label={t('reportsTurnover.turnoverRate')} value={formatPercent(row.turnoverRate, locale)} />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  )
}
