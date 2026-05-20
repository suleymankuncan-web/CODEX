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
import { useLocalization } from '../features/localization/useLocalization'
import { getChecklistReport } from '../features/reports/api'
import { downloadCsv } from '../lib/download-csv'
import { formatNumber, getErrorMessage } from '../lib/format'
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

function mapChecklistTone(complianceRate: string | null, criticalIssueCount: number) {
  if (criticalIssueCount > 0) return 'danger'
  const compliance = toNumber(complianceRate)
  if (compliance >= 0.95) return 'calm'
  if (compliance >= 0.85) return 'warning'
  return 'danger'
}

export function ReportsChecklistsPage() {
  const { locale, t } = useLocalization()
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
        row.criticalIssueCount > 0 ? t('reportsChecklists.criticalFindings') : t('reportsChecklists.compliant'),
      ]
        .join(' ')
        .toLowerCase()
        .includes(input),
    )
  }, [deferredSearch, rows, t])

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
    return <ScreenState title={t('reportsChecklists.missingTitle')} copy={t('reportsChecklists.missingCopy')} tone="error" />
  }

  if (checklistQuery.isLoading) {
    return <ScreenState title={t('reportsChecklists.loadingTitle')} copy={t('reportsChecklists.loadingCopy')} />
  }

  if (checklistQuery.isError) {
    return <ScreenState title={t('reportsChecklists.errorTitle')} copy={getErrorMessage(checklistQuery.error)} tone="error" />
  }

  return (
    <section className="page-stack">
      <section className="hero-panel">
        <div>
          <div className="eyebrow">{t('reportsChecklists.heroEyebrow')}</div>
          <h2 className="hero-title">{t('reportsChecklists.heroTitle')}</h2>
          <p className="hero-copy">{t('reportsChecklists.heroCopy')}</p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label={t('reportsChecklists.snapshotRun')} value={snapshotRunId.slice(0, 12)} />
          <MetricAccent label={t('reportsChecklists.rowsInView')} value={String(filteredRows.length)} />
          <MetricAccent label={t('reportsChecklists.avgCompliance')} value={formatPercent(String(averageCompliance), locale)} />
        </div>
      </section>

      <Link className="back-link" to="/admin/reports/snapshot-runs">
        <ArrowLeft size={16} />
        <span>{t('reportsChecklists.chooseAnotherSnapshot')}</span>
      </Link>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">{t('reportsChecklists.contextEyebrow')}</div>
            <h3>{t('reportsChecklists.contextTitle')}</h3>
          </div>
        </div>
        <div className="key-grid">
          <KeyValue label={t('reportsChecklists.snapshotRunId')} value={snapshotRunId} />
          <KeyValue label={t('reportsChecklists.rowsLoaded')} value={String(rows.length)} />
          <KeyValue label={t('reportsChecklists.rowsAfterFilter')} value={String(filteredRows.length)} />
          <KeyValue label={t('reportsChecklists.criticalRows')} value={String(totals.rowsWithCriticalIssues)} />
        </div>
      </section>

      <section className="metric-grid">
        <MetricCard title={t('reportsChecklists.auditCountTitle')} value={totals.auditCount} note={t('reportsChecklists.auditCountNote')} icon={<SearchCheck size={18} />} tone="accent" />
        <MetricCard title={t('reportsChecklists.avgScoreTitle')} value={Math.round(averageScore)} note={t('reportsChecklists.avgScoreNote', { value: formatPercent(String(averageCompliance), locale) })} icon={<ClipboardCheck size={18} />} tone="calm" />
        <MetricCard title={t('reportsChecklists.criticalIssuesTitle')} value={totals.criticalIssues} note={t('reportsChecklists.criticalIssuesNote', { count: totals.rowsWithCriticalIssues })} icon={<AlertTriangle size={18} />} tone={totals.criticalIssues === 0 ? 'neutral' : 'danger'} />
        <MetricCard title={t('reportsChecklists.criticalRows')} value={totals.rowsWithCriticalIssues} note={t('reportsChecklists.criticalRowsNote')} icon={<ShieldAlert size={18} />} tone={totals.rowsWithCriticalIssues === 0 ? 'calm' : 'warning'} />
      </section>

      <section className="panel reports-detail-table-panel">
        <div className="panel-heading panel-heading-spread">
          <div>
            <div className="eyebrow">{t('reportsChecklists.tableEyebrow')}</div>
            <h3>{t('reportsChecklists.tableTitle')}</h3>
            <p className="panel-copy">{t('reportsChecklists.tableCopy')}</p>
          </div>
          <ReportingToolbar
            sortValue={sortBy}
            onSortChange={(value) => setSortBy(value as typeof sortBy)}
            sortOptions={[
              { value: 'critical-desc', label: t('reportsChecklists.sort.criticalDesc') },
              { value: 'compliance-desc', label: t('reportsChecklists.sort.complianceDesc') },
              { value: 'store', label: t('reportsChecklists.sort.store') },
            ]}
            sortAriaLabel={t('reportsChecklists.sortRows')}
            exportLabel={t('reportsChecklists.exportCsv')}
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
              <span className="sr-only">{t('reportsChecklists.filterRows')}</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('reportsChecklists.searchPlaceholder')}
              />
            </label>
          </ReportingToolbar>
        </div>

        {sortedRows.length === 0 ? (
          <EmptyState
            title={t('reportsChecklists.emptyTitle')}
            copy={t('reportsChecklists.emptyCopy')}
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
                    {row.criticalIssueCount > 0 ? t('reportsChecklists.criticalFindings') : t('reportsChecklists.compliant')}
                  </StatusPill>
                </div>

                <div className="key-grid">
                  <KeyValue label={t('reportsChecklists.auditCount')} value={String(row.auditCount)} />
                  <KeyValue label={t('reportsChecklists.averageScore')} value={formatMetric(toNumber(row.avgScore), locale)} />
                  <KeyValue label={t('reportsChecklists.complianceRate')} value={formatPercent(row.complianceRate, locale)} />
                  <KeyValue label={t('reportsChecklists.criticalIssueCount')} value={String(row.criticalIssueCount)} />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  )
}
