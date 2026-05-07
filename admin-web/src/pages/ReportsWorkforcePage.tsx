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
import { useLocalization } from '../features/localization/useLocalization'
import { getWorkforceReport } from '../features/reports/api'
import { downloadCsv } from '../lib/download-csv'
import { formatNumber, getErrorMessage } from '../lib/format'
import type { AppLocale } from '../lib/i18n'

function toNumber(input: string) {
  const parsed = Number(input)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatMetric(input: number, locale: AppLocale) {
  return formatNumber(input, locale, {
    minimumFractionDigits: Number.isInteger(input) ? 0 : 2,
    maximumFractionDigits: 2,
  })
}

export function ReportsWorkforcePage() {
  const { locale, t } = useLocalization()
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
    return <ScreenState title={t('reportsWorkforce.missingTitle')} copy={t('reportsWorkforce.missingCopy')} tone="error" />
  }

  if (workforceQuery.isLoading) {
    return <ScreenState title={t('reportsWorkforce.loadingTitle')} copy={t('reportsWorkforce.loadingCopy')} />
  }

  if (workforceQuery.isError) {
    return <ScreenState title={t('reportsWorkforce.errorTitle')} copy={getErrorMessage(workforceQuery.error)} tone="error" />
  }

  return (
    <section className="page-stack">
      <section className="hero-panel">
        <div>
          <div className="eyebrow">{t('reportsWorkforce.heroEyebrow')}</div>
          <h2 className="hero-title">{t('reportsWorkforce.heroTitle')}</h2>
          <p className="hero-copy">{t('reportsWorkforce.heroCopy')}</p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label={t('reportsWorkforce.snapshotRun')} value={snapshotRunId.slice(0, 12)} />
          <MetricAccent label={t('reportsWorkforce.rowsInView')} value={String(filteredRows.length)} />
          <MetricAccent label={t('reportsWorkforce.storesWithGap')} value={String(rowsWithGap)} />
        </div>
      </section>

      <Link className="back-link" to="/admin/reports/snapshot-runs">
        <ArrowLeft size={16} />
        <span>{t('reportsWorkforce.chooseAnotherSnapshot')}</span>
      </Link>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">{t('reportsWorkforce.contextEyebrow')}</div>
            <h3>{t('reportsWorkforce.contextTitle')}</h3>
          </div>
        </div>
        <div className="key-grid">
          <KeyValue label={t('reportsWorkforce.snapshotRunId')} value={snapshotRunId} />
          <KeyValue label={t('reportsWorkforce.rowsLoaded')} value={String(rows.length)} />
          <KeyValue label={t('reportsWorkforce.rowsAfterFilter')} value={String(filteredRows.length)} />
          <KeyValue label={t('reportsWorkforce.gapRows')} value={String(rowsWithGap)} />
        </div>
      </section>

      <section className="metric-grid">
        <MetricCard title={t('reportsWorkforce.activeHeadcountTitle')} value={Math.round(totals.activeHeadcount)} note={t('reportsWorkforce.activeFteNote', { value: formatMetric(totals.activeFte, locale) })} icon={<Users size={18} />} tone="calm" />
        <MetricCard title={t('reportsWorkforce.plannedHeadcountTitle')} value={Math.round(totals.plannedHeadcount)} note={t('reportsWorkforce.plannedFteNote', { value: formatMetric(totals.plannedFte, locale) })} icon={<BriefcaseBusiness size={18} />} tone="accent" />
        <MetricCard title={t('reportsWorkforce.headcountGapTitle')} value={Math.round(totals.gapHeadcount)} note={t('reportsWorkforce.gapFteNote', { value: formatMetric(totals.gapFte, locale) })} icon={<Building2 size={18} />} tone={totals.gapHeadcount === 0 && totals.gapFte === 0 ? 'neutral' : 'warning'} />
        <MetricCard title={t('reportsWorkforce.gapRows')} value={rowsWithGap} note={t('reportsWorkforce.gapRowsNote')} icon={<ArrowRight size={18} />} tone={rowsWithGap === 0 ? 'calm' : 'danger'} />
      </section>

      <section className="panel">
        <div className="panel-heading panel-heading-spread">
          <div>
            <div className="eyebrow">{t('reportsWorkforce.tableEyebrow')}</div>
            <h3>{t('reportsWorkforce.tableTitle')}</h3>
            <p className="panel-copy">{t('reportsWorkforce.tableCopy')}</p>
          </div>
          <ReportingToolbar
            sortValue={sortBy}
            onSortChange={(value) => setSortBy(value as typeof sortBy)}
            sortOptions={[
              { value: 'gap-desc', label: t('reportsWorkforce.sort.gapDesc') },
              { value: 'store', label: t('reportsWorkforce.sort.store') },
              { value: 'position', label: t('reportsWorkforce.sort.position') },
            ]}
            sortAriaLabel={t('reportsWorkforce.sortRows')}
            exportLabel={t('reportsWorkforce.exportCsv')}
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
              <span className="sr-only">{t('reportsWorkforce.filterRows')}</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('reportsWorkforce.searchPlaceholder')}
              />
            </label>
          </ReportingToolbar>
        </div>

        {sortedRows.length === 0 ? (
          <EmptyState
            title={t('reportsWorkforce.emptyTitle')}
            copy={t('reportsWorkforce.emptyCopy')}
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
                      {hasGap ? t('reportsWorkforce.gapDetected') : t('reportsWorkforce.balanced')}
                    </StatusPill>
                  </div>

                  <div className="key-grid">
                    <KeyValue label={t('reportsWorkforce.activeHc')} value={formatMetric(toNumber(row.activeHeadcount), locale)} />
                    <KeyValue label={t('reportsWorkforce.plannedHc')} value={formatMetric(toNumber(row.plannedHeadcount), locale)} />
                    <KeyValue label={t('reportsWorkforce.gapHc')} value={formatMetric(toNumber(row.gapHeadcount), locale)} />
                    <KeyValue label={t('reportsWorkforce.activeFte')} value={formatMetric(toNumber(row.activeFte), locale)} />
                    <KeyValue label={t('reportsWorkforce.plannedFte')} value={formatMetric(toNumber(row.plannedFte), locale)} />
                    <KeyValue label={t('reportsWorkforce.gapFte')} value={formatMetric(toNumber(row.gapFte), locale)} />
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
