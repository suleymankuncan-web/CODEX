import { useDeferredValue, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Building2, DoorOpen, Ratio, TrendingDown, Users } from 'lucide-react'
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
import type { TranslateFunction } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import { getTurnoverReport } from '../features/reports/api'
import { downloadCsv } from '../lib/download-csv'
import { formatDate, formatNumber, getErrorMessage } from '../lib/format'
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

function mapTurnoverTone(rate: string): AdminSurfaceTone {
  const value = toNumber(rate)
  if (value < 0.08) return 'success'
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
    return (
      <AdminSurfacePage>
        <AdminStatePanel title={t('reportsTurnover.missingTitle')} description={t('reportsTurnover.missingCopy')} tone="danger" />
      </AdminSurfacePage>
    )
  }

  if (turnoverQuery.isLoading) {
    return (
      <AdminSurfacePage>
        <AdminStatePanel title={t('reportsTurnover.loadingTitle')} description={t('reportsTurnover.loadingCopy')} isLoading />
      </AdminSurfacePage>
    )
  }

  if (turnoverQuery.isError) {
    return (
      <AdminSurfacePage>
        <AdminStatePanel title={t('reportsTurnover.errorTitle')} description={getErrorMessage(turnoverQuery.error)} tone="danger" />
      </AdminSurfacePage>
    )
  }

  return (
    <AdminSurfacePage ariaLabel={t('reportsTurnover.heroEyebrow')}>
      <AdminSurfaceHeader
        eyebrow={t('reportsTurnover.heroEyebrow')}
        title={t('reportsTurnover.heroTitle')}
        description={t('reportsTurnover.heroCopy')}
        icon={<TrendingDown size={18} />}
        actions={
          <Button asChild variant="outline">
            <Link to="/admin/reports/snapshot-runs">
              <ArrowLeft aria-hidden="true" />
              {t('reportsTurnover.chooseAnotherSnapshot')}
            </Link>
          </Button>
        }
      />

      <AdminMetricStrip
        items={[
          { id: 'snapshot-run', label: t('reportsTurnover.snapshotRun'), value: snapshotRunId.slice(0, 12), tone: 'neutral' },
          { id: 'rows-in-view', label: t('reportsTurnover.rowsInView'), value: filteredRows.length, tone: 'cyan' },
          { id: 'avg-turnover', label: t('reportsTurnover.avgTurnover'), value: formatPercent(String(averageTurnover), locale), tone: mapTurnoverTone(String(averageTurnover)) },
        ]}
      />

      <AdminSurfaceSection eyebrow={t('reportsTurnover.contextEyebrow')} title={t('reportsTurnover.contextTitle')}>
        <AdminKeyValueGrid>
          <AdminKeyValue label={t('reportsTurnover.snapshotRunId')} value={snapshotRunId} />
          <AdminKeyValue label={t('reportsTurnover.rowsLoaded')} value={String(rows.length)} />
          <AdminKeyValue label={t('reportsTurnover.rowsAfterFilter')} value={String(filteredRows.length)} />
          <AdminKeyValue label={t('reportsTurnover.leaversInView')} value={String(totals.leavers)} />
        </AdminKeyValueGrid>
      </AdminSurfaceSection>

      <AdminMetricStrip
        items={[
          {
            id: 'opening-headcount',
            label: t('reportsTurnover.openingHcTitle'),
            value: Math.round(totals.opening),
            description: t('reportsTurnover.openingHcNote'),
            icon: <Users size={18} />,
            tone: 'neutral',
          },
          {
            id: 'closing-headcount',
            label: t('reportsTurnover.closingHcTitle'),
            value: Math.round(totals.closing),
            description: t('reportsTurnover.closingHcNote', { value: formatMetric(totals.average, locale) }),
            icon: <Building2 size={18} />,
            tone: 'success',
          },
          {
            id: 'leaver-count',
            label: t('reportsTurnover.leaverCountTitle'),
            value: totals.leavers,
            description: t('reportsTurnover.leaverCountNote', { value: formatPercent(String(averageTurnover), locale) }),
            icon: <DoorOpen size={18} />,
            tone: totals.leavers === 0 ? 'neutral' : 'warning',
          },
          {
            id: 'turnover-rate',
            label: t('reportsTurnover.turnoverRateTitle'),
            value: Math.round(averageTurnover * 100),
            description: t('reportsTurnover.turnoverRateNote'),
            icon: <Ratio size={18} />,
            tone: mapTurnoverTone(String(averageTurnover)),
          },
        ]}
      />

      <AdminSurfaceSection
        ariaLabel={t('reportsTurnover.tableTitle')}
        eyebrow={t('reportsTurnover.tableEyebrow')}
        title={t('reportsTurnover.tableTitle')}
        description={t('reportsTurnover.tableCopy')}
        actions={
          <AdminReportingToolbar
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
            <label className="tw:w-full tw:sm:w-80">
              <span className="sr-only">{t('reportsTurnover.filterRows')}</span>
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('reportsTurnover.searchPlaceholder')}
              />
            </label>
          </AdminReportingToolbar>
        }
      >
        {sortedRows.length === 0 ? (
          <AdminSurfaceEmpty title={t('reportsTurnover.emptyTitle')} copy={t('reportsTurnover.emptyCopy')} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('reportsTurnover.tableTitle')}</TableHead>
                <TableHead>{t('reportsTurnover.period')}</TableHead>
                <TableHead>{t('reportsTurnover.openingHc')}</TableHead>
                <TableHead>{t('reportsTurnover.closingHc')}</TableHead>
                <TableHead>{t('reportsTurnover.averageHc')}</TableHead>
                <TableHead>{t('reportsTurnover.leaverCount')}</TableHead>
                <TableHead className="tw:text-right">{t('reportsTurnover.turnoverRate')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.map((row) => (
                <TableRow key={getTurnoverRowKey(row)}>
                  <TableCell>
                    <div className="tw:font-medium">{getScopeTypeLabel(row.scopeType, t)}</div>
                    <div className="tw:text-xs tw:text-muted-foreground">{getScopeLabel(row, t)}</div>
                  </TableCell>
                  <TableCell>{formatDate(row.periodStart, locale)} - {formatDate(row.periodEnd, locale)}</TableCell>
                  <TableCell>{formatMetric(toNumber(row.openingHeadcount), locale)}</TableCell>
                  <TableCell>{formatMetric(toNumber(row.closingHeadcount), locale)}</TableCell>
                  <TableCell>{formatMetric(toNumber(row.avgHeadcount), locale)}</TableCell>
                  <TableCell>{row.leaverCount}</TableCell>
                  <TableCell className="tw:text-right">
                    <AdminSurfaceBadge tone={mapTurnoverTone(row.turnoverRate)}>
                      {formatPercent(row.turnoverRate, locale)}
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
