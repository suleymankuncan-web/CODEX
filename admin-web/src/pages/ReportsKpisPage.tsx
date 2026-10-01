import { useDeferredValue, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Activity, ArrowLeft, Gauge, Target, Trophy } from 'lucide-react'
import { Link, useParams } from 'react-router'
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
import { normalizeDisplayLabel } from '../lib/display-labels'
import { downloadCsv } from '../lib/download-csv'
import { formatDate, formatNumber, getErrorMessage } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import {
  AdminKeyValue,
  AdminKeyValueGrid,
  AdminStatePanel,
  AdminSurfaceBadge,
  AdminSurfaceEmpty,
  type AdminSurfaceTone,
} from './admin-surface-primitives'
import {
  AdminOperationalHeader,
  AdminOperationalMetrics,
  AdminOperationalPage,
  AdminOperationalSection,
} from './admin-operational-primitives'

function toNumber(input: string | null) {
  if (input === null) return null
  const parsed = Number(input)
  return Number.isFinite(parsed) ? parsed : null
}

function formatMetric(input: number | null, locale: AppLocale) {
  if (input === null) return '—'
  return formatNumber(input, locale, {
    minimumFractionDigits: Number.isInteger(input) ? 0 : 2,
    maximumFractionDigits: 2,
  })
}

function formatPercent(input: string | null, locale: AppLocale) {
  const value = toNumber(input)
  return value === null ? '—' : `${formatMetric(value * 100, locale)}%`
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
        normalizeDisplayLabel(row.storeName, t('reportsKpis.unknownStore')),
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
      return items.sort((left, right) =>
        normalizeDisplayLabel(left.storeName, '').localeCompare(normalizeDisplayLabel(right.storeName, '')),
      )
    }
    if (sortBy === 'status') {
      return items.sort((left, right) => (left.statusBand ?? '').localeCompare(right.statusBand ?? ''))
    }
    return items.sort((left, right) => {
      const leftRate = toNumber(left.achievementRate)
      const rightRate = toNumber(right.achievementRate)
      if (leftRate === null) return rightRate === null ? 0 : 1
      if (rightRate === null) return -1
      return rightRate - leftRate
    })
  }, [filteredRows, sortBy])

  const totals = useMemo(() => {
    return sortedRows.reduce(
      (accumulator, row) => {
        const target = toNumber(row.targetValue)
        const actual = toNumber(row.actualValue)
        const achievement = toNumber(row.achievementRate)
        if (target !== null) { accumulator.target += target; accumulator.targetSamples += 1 }
        if (actual !== null) { accumulator.actual += actual; accumulator.actualSamples += 1 }
        if (achievement !== null) { accumulator.achievement += achievement; accumulator.achievementSamples += 1 }
        if (row.statusBand === 'on_track') accumulator.onTrack += 1
        if (row.statusBand === 'at_risk') accumulator.atRisk += 1
        if (row.statusBand === 'off_track') accumulator.offTrack += 1
        return accumulator
      },
      {
        target: 0,
        actual: 0,
        achievement: 0,
        targetSamples: 0,
        actualSamples: 0,
        achievementSamples: 0,
        onTrack: 0,
        atRisk: 0,
        offTrack: 0,
      },
    )
  }, [sortedRows])

  const averageAchievement = totals.achievementSamples > 0 ? totals.achievement / totals.achievementSamples : null
  const averageAchievementDisplay = formatPercent(averageAchievement === null ? null : String(averageAchievement), locale)

  if (!snapshotRunId) {
    return (
      <AdminOperationalPage>
        <AdminStatePanel
          title={t('reportsKpis.missingTitle')}
          description={t('reportsKpis.missingCopy')}
          tone="danger"
          action={<Button asChild variant="outline" size="sm"><Link to="/admin/reports/snapshot-runs">{t('reportsKpis.chooseAnotherSnapshot')}</Link></Button>}
        />
      </AdminOperationalPage>
    )
  }

  if (kpiQuery.isLoading) {
    return (
      <AdminOperationalPage>
        <AdminStatePanel title={t('reportsKpis.loadingTitle')} description={t('reportsKpis.loadingCopy')} isLoading />
      </AdminOperationalPage>
    )
  }

  if (kpiQuery.isError) {
    return (
      <AdminOperationalPage>
        <AdminStatePanel
          title={t('reportsKpis.errorTitle')}
          description={getErrorMessage(kpiQuery.error)}
          tone="danger"
          action={<Button type="button" variant="outline" size="sm" onClick={() => void kpiQuery.refetch()}>{t('reportsSummary.retry')}</Button>}
        />
      </AdminOperationalPage>
    )
  }

  return (
    <AdminOperationalPage ariaLabel={t('reportsKpis.heroEyebrow')}>
      <AdminOperationalHeader
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

      <AdminOperationalMetrics
        items={[
          { id: 'snapshot-run', label: t('reportsKpis.snapshotRun'), value: snapshotRunId.slice(0, 12), tone: 'neutral' },
          { id: 'rows-in-view', label: t('reportsKpis.rowsInView'), value: filteredRows.length, tone: 'cyan' },
          { id: 'avg-achievement', label: t('reportsKpis.avgAchievement'), value: averageAchievementDisplay, tone: 'accent' },
        ]}
      />

      <AdminOperationalSection title={t('reportsKpis.contextTitle')} description={t('reportsKpis.contextEyebrow')}>
        <AdminKeyValueGrid>
          <AdminKeyValue label={t('reportsKpis.snapshotRunId')} value={snapshotRunId} />
          <AdminKeyValue label={t('reportsKpis.rowsLoaded')} value={String(rows.length)} />
          <AdminKeyValue label={t('reportsKpis.rowsAfterFilter')} value={String(filteredRows.length)} />
          <AdminKeyValue label={t('reportsKpis.offTrackRows')} value={String(totals.offTrack)} />
        </AdminKeyValueGrid>
      </AdminOperationalSection>

      <AdminOperationalMetrics
        items={[
          {
            id: 'target-total',
            label: t('reportsKpis.targetTotalTitle'),
            value: totals.targetSamples > 0 ? Math.round(totals.target) : '—',
            description: t('reportsKpis.targetTotalNote'),
            icon: <Target size={18} />,
            tone: 'accent',
          },
          {
            id: 'actual-total',
            label: t('reportsKpis.actualTotalTitle'),
            value: totals.actualSamples > 0 ? Math.round(totals.actual) : '—',
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
            description: t('reportsKpis.offTrackNote', { value: averageAchievementDisplay }),
            icon: <Activity size={18} />,
            tone: totals.offTrack === 0 ? 'neutral' : 'danger',
          },
        ]}
      />

      <AdminOperationalSection
        ariaLabel={t('reportsKpis.tableTitle')}
        title={t('reportsKpis.tableTitle')}
        description={`${t('reportsKpis.tableEyebrow')} · ${t('reportsKpis.tableCopy')}`}
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
                columns: ['snapshotRunId', 'storeName', 'kpiId', 'periodStart', 'periodEnd', 'targetValue', 'actualValue', 'achievementRate', 'statusBand'],
                rows: sortedRows.map((row) => [
                  row.snapshotRunId,
                  normalizeDisplayLabel(row.storeName, t('reportsKpis.unknownStore')),
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
                    <div className="tw:font-medium">{normalizeDisplayLabel(row.storeName, t('reportsKpis.unknownStore'))}</div>
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
      </AdminOperationalSection>
    </AdminOperationalPage>
  )
}
