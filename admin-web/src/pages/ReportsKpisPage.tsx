import { useDeferredValue, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, ArrowLeft, Gauge, Target, Trophy } from 'lucide-react'
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
import { getKpiReport } from '../features/reports/api'
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

function formatPercent(input: string | null, locale: AppLocale) {
  return `${formatMetric(toNumber(input) * 100, locale)}%`
}

function mapStatusBandTone(input: string | null): AdminSurfaceTone {
  if (input === 'on_track') return 'success'
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
    return (
      <AdminSurfacePage>
        <AdminStatePanel title={t('reportsKpis.missingTitle')} description={t('reportsKpis.missingCopy')} tone="danger" />
      </AdminSurfacePage>
    )
  }

  if (kpiQuery.isLoading) {
    return (
      <AdminSurfacePage>
        <AdminStatePanel title={t('reportsKpis.loadingTitle')} description={t('reportsKpis.loadingCopy')} isLoading />
      </AdminSurfacePage>
    )
  }

  if (kpiQuery.isError) {
    return (
      <AdminSurfacePage>
        <AdminStatePanel title={t('reportsKpis.errorTitle')} description={getErrorMessage(kpiQuery.error)} tone="danger" />
      </AdminSurfacePage>
    )
  }

  return (
    <AdminSurfacePage ariaLabel={t('reportsKpis.heroEyebrow')}>
      <AdminSurfaceHeader
        eyebrow={t('reportsKpis.heroEyebrow')}
        title={t('reportsKpis.heroTitle')}
        description={t('reportsKpis.heroCopy')}
        icon={<Gauge size={18} />}
        actions={
          <Button asChild variant="outline">
            <Link to="/admin/reports/snapshot-runs">
              <ArrowLeft aria-hidden="true" />
              {t('reportsKpis.chooseAnotherSnapshot')}
            </Link>
          </Button>
        }
      />

      <AdminMetricStrip
        items={[
          { id: 'snapshot-run', label: t('reportsKpis.snapshotRun'), value: snapshotRunId.slice(0, 12), tone: 'neutral' },
          { id: 'rows-in-view', label: t('reportsKpis.rowsInView'), value: filteredRows.length, tone: 'cyan' },
          { id: 'avg-achievement', label: t('reportsKpis.avgAchievement'), value: formatPercent(String(averageAchievement), locale), tone: 'accent' },
        ]}
      />

      <AdminSurfaceSection eyebrow={t('reportsKpis.contextEyebrow')} title={t('reportsKpis.contextTitle')}>
        <AdminKeyValueGrid>
          <AdminKeyValue label={t('reportsKpis.snapshotRunId')} value={snapshotRunId} />
          <AdminKeyValue label={t('reportsKpis.rowsLoaded')} value={String(rows.length)} />
          <AdminKeyValue label={t('reportsKpis.rowsAfterFilter')} value={String(filteredRows.length)} />
          <AdminKeyValue label={t('reportsKpis.offTrackRows')} value={String(totals.offTrack)} />
        </AdminKeyValueGrid>
      </AdminSurfaceSection>

      <AdminMetricStrip
        items={[
          {
            id: 'target-total',
            label: t('reportsKpis.targetTotalTitle'),
            value: Math.round(totals.target),
            description: t('reportsKpis.targetTotalNote'),
            icon: <Target size={18} />,
            tone: 'accent',
          },
          {
            id: 'actual-total',
            label: t('reportsKpis.actualTotalTitle'),
            value: Math.round(totals.actual),
            description: t('reportsKpis.actualTotalNote'),
            icon: <Gauge size={18} />,
            tone: 'success',
          },
          {
            id: 'on-track',
            label: t('reportsKpis.onTrackTitle'),
            value: totals.onTrack,
            description: t('reportsKpis.onTrackNote', { count: totals.atRisk }),
            icon: <Trophy size={18} />,
            tone: 'success',
          },
          {
            id: 'off-track',
            label: t('reportsKpis.offTrackTitle'),
            value: totals.offTrack,
            description: t('reportsKpis.offTrackNote', { value: formatPercent(String(averageAchievement), locale) }),
            icon: <Activity size={18} />,
            tone: totals.offTrack === 0 ? 'neutral' : 'danger',
          },
        ]}
      />

      <AdminSurfaceSection
        ariaLabel={t('reportsKpis.tableTitle')}
        eyebrow={t('reportsKpis.tableEyebrow')}
        title={t('reportsKpis.tableTitle')}
        description={t('reportsKpis.tableCopy')}
        actions={
          <AdminReportingToolbar
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
            <label className="tw:w-full tw:sm:w-72">
              <span className="sr-only">{t('reportsKpis.filterRows')}</span>
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('reportsKpis.searchPlaceholder')}
              />
            </label>
          </AdminReportingToolbar>
        }
      >
        {sortedRows.length === 0 ? (
          <AdminSurfaceEmpty title={t('reportsKpis.emptyTitle')} copy={t('reportsKpis.emptyCopy')} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('reportsKpis.tableTitle')}</TableHead>
                <TableHead>{t('reportsKpis.period')}</TableHead>
                <TableHead>{t('reportsKpis.targetValue')}</TableHead>
                <TableHead>{t('reportsKpis.actualValue')}</TableHead>
                <TableHead>{t('reportsKpis.achievement')}</TableHead>
                <TableHead className="tw:text-right">{t('reportsKpis.sort.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.map((row) => (
                <TableRow key={`${row.storeId}:${row.kpiId}`}>
                  <TableCell>
                    <div className="tw:font-medium">{row.storeId}</div>
                    <div className="tw:text-xs tw:text-muted-foreground">{row.kpiId}</div>
                  </TableCell>
                  <TableCell>{formatDate(row.periodStart, locale)} - {formatDate(row.periodEnd, locale)}</TableCell>
                  <TableCell>{formatMetric(toNumber(row.targetValue), locale)}</TableCell>
                  <TableCell>{formatMetric(toNumber(row.actualValue), locale)}</TableCell>
                  <TableCell>{formatPercent(row.achievementRate, locale)}</TableCell>
                  <TableCell className="tw:text-right">
                    <AdminSurfaceBadge tone={mapStatusBandTone(row.statusBand)}>
                      {mapStatusBandLabel(row.statusBand, t)}
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
