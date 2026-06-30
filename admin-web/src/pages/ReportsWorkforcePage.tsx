import { useDeferredValue, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, BriefcaseBusiness, Building2, Users } from 'lucide-react'
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
import { getWorkforceReport } from '../features/reports/api'
import { normalizeDisplayLabel } from '../lib/display-labels'
import { downloadCsv } from '../lib/download-csv'
import { formatNumber, getErrorMessage } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import {
  AdminKeyValue,
  AdminKeyValueGrid,
  AdminStatePanel,
  AdminSurfaceBadge,
  AdminSurfaceEmpty,
} from './admin-surface-primitives'
import {
  AdminOperationalHeader,
  AdminOperationalMetrics,
  AdminOperationalPage,
  AdminOperationalSection,
} from './admin-operational-primitives'

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
      [
        normalizeDisplayLabel(row.storeName, t('reportsWorkforce.unknownStore')),
        row.storeId,
        row.positionId,
        row.gapHeadcount,
        row.gapFte,
        row.activeHeadcount,
        row.plannedHeadcount,
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
    return (
      <AdminOperationalPage>
        <AdminStatePanel
          title={t('reportsWorkforce.missingTitle')}
          description={t('reportsWorkforce.missingCopy')}
          tone="danger"
        />
      </AdminOperationalPage>
    )
  }

  if (workforceQuery.isLoading) {
    return (
      <AdminOperationalPage>
        <AdminStatePanel
          title={t('reportsWorkforce.loadingTitle')}
          description={t('reportsWorkforce.loadingCopy')}
          isLoading
        />
      </AdminOperationalPage>
    )
  }

  if (workforceQuery.isError) {
    return (
      <AdminOperationalPage>
        <AdminStatePanel
          title={t('reportsWorkforce.errorTitle')}
          description={getErrorMessage(workforceQuery.error)}
          tone="danger"
        />
      </AdminOperationalPage>
    )
  }

  return (
    <AdminOperationalPage ariaLabel={t('reportsWorkforce.heroEyebrow')}>
      <AdminOperationalHeader
        eyebrow={t('reportsWorkforce.heroEyebrow')}
        title={t('reportsWorkforce.heroTitle')}
        description={t('reportsWorkforce.heroCopy')}
        icon={<BriefcaseBusiness size={18} />}
        actions={
          <Button asChild variant="outline">
            <Link to="/admin/reports/snapshot-runs">
              <ArrowLeft aria-hidden="true" />
              {t('reportsWorkforce.chooseAnotherSnapshot')}
            </Link>
          </Button>
        }
      />

      <AdminOperationalMetrics
        items={[
          { id: 'snapshot-run', label: t('reportsWorkforce.snapshotRun'), value: snapshotRunId.slice(0, 12), tone: 'neutral' },
          { id: 'rows-in-view', label: t('reportsWorkforce.rowsInView'), value: filteredRows.length, tone: 'cyan' },
          { id: 'stores-with-gap', label: t('reportsWorkforce.storesWithGap'), value: rowsWithGap, tone: rowsWithGap === 0 ? 'success' : 'warning' },
        ]}
      />

      <AdminOperationalSection
        title={t('reportsWorkforce.contextTitle')}
        description={t('reportsWorkforce.contextEyebrow')}
      >
        <AdminKeyValueGrid>
          <AdminKeyValue label={t('reportsWorkforce.snapshotRunId')} value={snapshotRunId} />
          <AdminKeyValue label={t('reportsWorkforce.rowsLoaded')} value={String(rows.length)} />
          <AdminKeyValue label={t('reportsWorkforce.rowsAfterFilter')} value={String(filteredRows.length)} />
          <AdminKeyValue label={t('reportsWorkforce.gapRows')} value={String(rowsWithGap)} />
        </AdminKeyValueGrid>
      </AdminOperationalSection>

      <AdminOperationalMetrics
        items={[
          {
            id: 'active-headcount',
            label: t('reportsWorkforce.activeHeadcountTitle'),
            value: Math.round(totals.activeHeadcount),
            description: t('reportsWorkforce.activeFteNote', { value: formatMetric(totals.activeFte, locale) }),
            icon: <Users size={18} />,
            tone: 'success',
          },
          {
            id: 'planned-headcount',
            label: t('reportsWorkforce.plannedHeadcountTitle'),
            value: Math.round(totals.plannedHeadcount),
            description: t('reportsWorkforce.plannedFteNote', { value: formatMetric(totals.plannedFte, locale) }),
            icon: <BriefcaseBusiness size={18} />,
            tone: 'accent',
          },
          {
            id: 'headcount-gap',
            label: t('reportsWorkforce.headcountGapTitle'),
            value: Math.round(totals.gapHeadcount),
            description: t('reportsWorkforce.gapFteNote', { value: formatMetric(totals.gapFte, locale) }),
            icon: <Building2 size={18} />,
            tone: totals.gapHeadcount === 0 && totals.gapFte === 0 ? 'neutral' : 'warning',
          },
          {
            id: 'gap-rows',
            label: t('reportsWorkforce.gapRows'),
            value: rowsWithGap,
            description: t('reportsWorkforce.gapRowsNote'),
            icon: <ArrowRight size={18} />,
            tone: rowsWithGap === 0 ? 'success' : 'danger',
          },
        ]}
      />

      <AdminOperationalSection
        ariaLabel={t('reportsWorkforce.tableTitle')}
        title={t('reportsWorkforce.tableTitle')}
        description={`${t('reportsWorkforce.tableEyebrow')} · ${t('reportsWorkforce.tableCopy')}`}
        actions={
          <AdminReportingToolbar
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
                columns: ['snapshotRunId', 'storeName', 'positionId', 'activeHeadcount', 'activeFte', 'plannedHeadcount', 'plannedFte', 'gapHeadcount', 'gapFte'],
                rows: sortedRows.map((row) => [
                  row.snapshotRunId,
                  normalizeDisplayLabel(row.storeName, t('reportsWorkforce.unknownStore')),
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
            <label className="tw:w-full tw:sm:w-64">
              <span className="sr-only">{t('reportsWorkforce.filterRows')}</span>
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('reportsWorkforce.searchPlaceholder')}
              />
            </label>
          </AdminReportingToolbar>
        }
      >
        {sortedRows.length === 0 ? (
          <AdminSurfaceEmpty
            title={t('reportsWorkforce.emptyTitle')}
            copy={t('reportsWorkforce.emptyCopy')}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('reportsWorkforce.contextTitle')}</TableHead>
                <TableHead>{t('reportsWorkforce.activeHc')}</TableHead>
                <TableHead>{t('reportsWorkforce.plannedHc')}</TableHead>
                <TableHead>{t('reportsWorkforce.gapHc')}</TableHead>
                <TableHead>{t('reportsWorkforce.activeFte')}</TableHead>
                <TableHead>{t('reportsWorkforce.plannedFte')}</TableHead>
                <TableHead>{t('reportsWorkforce.gapFte')}</TableHead>
                <TableHead className="tw:text-right">{t('reportsWorkforce.gapRows')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.map((row) => {
                const hasGap = toNumber(row.gapHeadcount) !== 0 || toNumber(row.gapFte) !== 0

                return (
                  <TableRow key={`${row.storeId}:${row.positionId}`}>
                    <TableCell>
                      <div className="tw:font-medium">{normalizeDisplayLabel(row.storeName, t('reportsWorkforce.unknownStore'))}</div>
                      <div className="tw:text-xs tw:text-muted-foreground">{row.positionId}</div>
                    </TableCell>
                    <TableCell>{formatMetric(toNumber(row.activeHeadcount), locale)}</TableCell>
                    <TableCell>{formatMetric(toNumber(row.plannedHeadcount), locale)}</TableCell>
                    <TableCell>{formatMetric(toNumber(row.gapHeadcount), locale)}</TableCell>
                    <TableCell>{formatMetric(toNumber(row.activeFte), locale)}</TableCell>
                    <TableCell>{formatMetric(toNumber(row.plannedFte), locale)}</TableCell>
                    <TableCell>{formatMetric(toNumber(row.gapFte), locale)}</TableCell>
                    <TableCell className="tw:text-right">
                      <AdminSurfaceBadge tone={hasGap ? 'warning' : 'success'}>
                        {hasGap ? t('reportsWorkforce.gapDetected') : t('reportsWorkforce.balanced')}
                      </AdminSurfaceBadge>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </AdminOperationalSection>
    </AdminOperationalPage>
  )
}
