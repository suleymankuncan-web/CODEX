import { useDeferredValue, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, ClipboardCheck, SearchCheck, ShieldAlert } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { AdminReportingToolbar } from '../components/admin-reporting-tools'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'
import { useLocalization } from '../features/localization/useLocalization'
import { getChecklistReport } from '../features/reports/api'
import { downloadCsv } from '../lib/download-csv'
import { formatNumber, getErrorMessage } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import {
  AdminKeyValue,
  AdminKeyValueGrid,
  AdminMetricStrip,
  AdminStatePanel,
  AdminSurfaceBadge,
  AdminSurfaceEmpty,
  AdminSurfaceHeader,
  AdminSurfacePage,
  AdminSurfaceSection,
  type AdminSurfaceTone,
} from './admin-surface-primitives'

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

function mapChecklistTone(complianceRate: string | null, criticalIssueCount: number): AdminSurfaceTone {
  if (criticalIssueCount > 0) return 'danger'
  const compliance = toNumber(complianceRate)
  if (compliance >= 0.95) return 'success'
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
    return (
      <AdminSurfacePage>
        <AdminStatePanel title={t('reportsChecklists.missingTitle')} description={t('reportsChecklists.missingCopy')} tone="danger" />
      </AdminSurfacePage>
    )
  }

  if (checklistQuery.isLoading) {
    return (
      <AdminSurfacePage>
        <AdminStatePanel title={t('reportsChecklists.loadingTitle')} description={t('reportsChecklists.loadingCopy')} isLoading />
      </AdminSurfacePage>
    )
  }

  if (checklistQuery.isError) {
    return (
      <AdminSurfacePage>
        <AdminStatePanel title={t('reportsChecklists.errorTitle')} description={getErrorMessage(checklistQuery.error)} tone="danger" />
      </AdminSurfacePage>
    )
  }

  return (
    <AdminSurfacePage ariaLabel={t('reportsChecklists.heroEyebrow')}>
      <AdminSurfaceHeader
        eyebrow={t('reportsChecklists.heroEyebrow')}
        title={t('reportsChecklists.heroTitle')}
        description={t('reportsChecklists.heroCopy')}
        icon={<ClipboardCheck size={18} />}
        actions={
          <Button asChild variant="outline">
            <Link to="/admin/reports/snapshot-runs">
              <ArrowLeft aria-hidden="true" />
              {t('reportsChecklists.chooseAnotherSnapshot')}
            </Link>
          </Button>
        }
      />

      <AdminMetricStrip
        items={[
          { id: 'snapshot-run', label: t('reportsChecklists.snapshotRun'), value: snapshotRunId.slice(0, 12), tone: 'neutral' },
          { id: 'rows-in-view', label: t('reportsChecklists.rowsInView'), value: filteredRows.length, tone: 'cyan' },
          { id: 'avg-compliance', label: t('reportsChecklists.avgCompliance'), value: formatPercent(String(averageCompliance), locale), tone: 'success' },
        ]}
      />

      <AdminSurfaceSection eyebrow={t('reportsChecklists.contextEyebrow')} title={t('reportsChecklists.contextTitle')}>
        <AdminKeyValueGrid>
          <AdminKeyValue label={t('reportsChecklists.snapshotRunId')} value={snapshotRunId} />
          <AdminKeyValue label={t('reportsChecklists.rowsLoaded')} value={String(rows.length)} />
          <AdminKeyValue label={t('reportsChecklists.rowsAfterFilter')} value={String(filteredRows.length)} />
          <AdminKeyValue label={t('reportsChecklists.criticalRows')} value={String(totals.rowsWithCriticalIssues)} />
        </AdminKeyValueGrid>
      </AdminSurfaceSection>

      <AdminMetricStrip
        items={[
          {
            id: 'audit-count',
            label: t('reportsChecklists.auditCountTitle'),
            value: totals.auditCount,
            description: t('reportsChecklists.auditCountNote'),
            icon: <SearchCheck size={18} />,
            tone: 'accent',
          },
          {
            id: 'avg-score',
            label: t('reportsChecklists.avgScoreTitle'),
            value: Math.round(averageScore),
            description: t('reportsChecklists.avgScoreNote', { value: formatPercent(String(averageCompliance), locale) }),
            icon: <ClipboardCheck size={18} />,
            tone: 'success',
          },
          {
            id: 'critical-issues',
            label: t('reportsChecklists.criticalIssuesTitle'),
            value: totals.criticalIssues,
            description: t('reportsChecklists.criticalIssuesNote', { count: totals.rowsWithCriticalIssues }),
            icon: <AlertTriangle size={18} />,
            tone: totals.criticalIssues === 0 ? 'neutral' : 'danger',
          },
          {
            id: 'critical-rows',
            label: t('reportsChecklists.criticalRows'),
            value: totals.rowsWithCriticalIssues,
            description: t('reportsChecklists.criticalRowsNote'),
            icon: <ShieldAlert size={18} />,
            tone: totals.rowsWithCriticalIssues === 0 ? 'success' : 'warning',
          },
        ]}
      />

      <AdminSurfaceSection
        ariaLabel={t('reportsChecklists.tableTitle')}
        eyebrow={t('reportsChecklists.tableEyebrow')}
        title={t('reportsChecklists.tableTitle')}
        description={t('reportsChecklists.tableCopy')}
        actions={
          <AdminReportingToolbar
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
            <label className="tw:w-full tw:sm:w-72">
              <span className="sr-only">{t('reportsChecklists.filterRows')}</span>
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('reportsChecklists.searchPlaceholder')}
              />
            </label>
          </AdminReportingToolbar>
        }
      >
        {sortedRows.length === 0 ? (
          <AdminSurfaceEmpty title={t('reportsChecklists.emptyTitle')} copy={t('reportsChecklists.emptyCopy')} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('reportsChecklists.tableTitle')}</TableHead>
                <TableHead>{t('reportsChecklists.auditCount')}</TableHead>
                <TableHead>{t('reportsChecklists.averageScore')}</TableHead>
                <TableHead>{t('reportsChecklists.complianceRate')}</TableHead>
                <TableHead>{t('reportsChecklists.criticalIssueCount')}</TableHead>
                <TableHead className="tw:text-right">{t('reportsChecklists.criticalRows')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.map((row) => (
                <TableRow key={`${row.storeId}:${row.checklistTemplateId}`}>
                  <TableCell>
                    <div className="tw:font-medium">{row.storeId}</div>
                    <div className="tw:text-xs tw:text-muted-foreground">{row.checklistTemplateId}</div>
                  </TableCell>
                  <TableCell>{row.auditCount}</TableCell>
                  <TableCell>{formatMetric(toNumber(row.avgScore), locale)}</TableCell>
                  <TableCell>{formatPercent(row.complianceRate, locale)}</TableCell>
                  <TableCell>{row.criticalIssueCount}</TableCell>
                  <TableCell className="tw:text-right">
                    <AdminSurfaceBadge tone={mapChecklistTone(row.complianceRate, row.criticalIssueCount)}>
                      {row.criticalIssueCount > 0 ? t('reportsChecklists.criticalFindings') : t('reportsChecklists.compliant')}
                    </AdminSurfaceBadge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </AdminSurfaceSection>
    </AdminSurfacePage>
  )
}
