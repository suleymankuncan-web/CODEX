import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Layers3 } from 'lucide-react'
import { Link } from 'react-router'
import { AdminReportingToolbar } from '../components/admin-reporting-tools'
import { Button } from '../components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'
import type { TranslateFunction, TranslationKey } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import { getReportingSnapshotRuns } from '../features/reports/api'
import { downloadCsv } from '../lib/download-csv'
import { formatDate, formatDateTime, getErrorMessage } from '../lib/format'
import {
  AdminStatePanel,
  AdminSurfaceBadge,
  AdminSurfaceEmpty,
  type AdminSurfaceTone,
} from './admin-surface-primitives'
import {
  AdminOperationalHeader,
  AdminOperationalPage,
  AdminOperationalSection,
} from './admin-operational-primitives'

const runStatusLabelKeys: Record<string, TranslationKey> = {
  completed: 'reportsSnapshotRuns.status.completed',
  failed: 'reportsSnapshotRuns.status.failed',
  running: 'reportsSnapshotRuns.status.running',
  processing: 'reportsSnapshotRuns.status.running',
  queued: 'reportsSnapshotRuns.status.queued',
  pending: 'reportsSnapshotRuns.status.pending',
}

const snapshotTypeLabelKeys: Record<string, TranslationKey> = {
  daily: 'reportsSnapshotRuns.snapshotType.daily',
  monthly: 'reportsSnapshotRuns.snapshotType.monthly',
}

export function ReportsSnapshotRunsPage() {
  const { locale, t } = useLocalization()
  const [sortBy, setSortBy] = useState<'generated-desc' | 'generated-asc' | 'type'>('generated-desc')
  const runsQuery = useQuery({
    queryKey: ['reporting-snapshot-runs-page'],
    queryFn: () => getReportingSnapshotRuns(),
  })
  const runs = useMemo(() => runsQuery.data?.items ?? [], [runsQuery.data?.items])
  const sortedRuns = useMemo(() => {
    const items = [...runs]
    if (sortBy === 'generated-asc') {
      return items.sort((left, right) => left.generatedAt.localeCompare(right.generatedAt))
    }
    if (sortBy === 'type') {
      return items.sort((left, right) => left.snapshotType.localeCompare(right.snapshotType))
    }
    return items.sort((left, right) => right.generatedAt.localeCompare(left.generatedAt))
  }, [runs, sortBy])

  if (runsQuery.isLoading) {
    return (
      <AdminOperationalPage>
        <AdminStatePanel
          title={t('reportsSnapshotRuns.loadingTitle')}
          description={t('reportsSnapshotRuns.loadingCopy')}
          isLoading
        />
      </AdminOperationalPage>
    )
  }

  if (runsQuery.isError) {
    return (
      <AdminOperationalPage>
        <AdminStatePanel
          title={t('reportsSnapshotRuns.errorTitle')}
          description={getErrorMessage(runsQuery.error)}
          tone="danger"
        />
      </AdminOperationalPage>
    )
  }

  return (
    <AdminOperationalPage ariaLabel={t('reportsSnapshotRuns.heroEyebrow')}>
      <AdminOperationalHeader
        eyebrow={t('reportsSnapshotRuns.heroEyebrow')}
        title={t('reportsSnapshotRuns.heroTitle')}
        description={t('reportsSnapshotRuns.heroCopy')}
        icon={<Layers3 size={18} />}
        actions={
          <Button asChild variant="outline">
            <Link to="/admin/reports">
              <ArrowLeft aria-hidden="true" />
              {t('reportsSnapshotRuns.backToSummary')}
            </Link>
          </Button>
        }
      />

      <AdminOperationalSection
        title={t('reportsSnapshotRuns.recentRunsTitle')}
        description={t('reportsSnapshotRuns.contextsEyebrow')}
        actions={
          <AdminReportingToolbar
            sortValue={sortBy}
            onSortChange={(value) => setSortBy(value as typeof sortBy)}
            sortOptions={[
              { value: 'generated-desc', label: t('reportsSnapshotRuns.sort.newest') },
              { value: 'generated-asc', label: t('reportsSnapshotRuns.sort.oldest') },
              { value: 'type', label: t('reportsSnapshotRuns.sort.type') },
            ]}
            sortAriaLabel={t('reportsSnapshotRuns.sortRows')}
            exportLabel={t('reportsSnapshotRuns.exportCsv')}
            onExport={() =>
              downloadCsv({
                filename: 'reporting-snapshot-runs.csv',
                columns: ['snapshotRunId', 'snapshotType', 'runStatus', 'snapshotDate', 'periodStart', 'periodEnd', 'generatedAt', 'generatedBy', 'kpiConfigVersion'],
                rows: sortedRuns.map((run) => [
                  run.snapshotRunId,
                  run.snapshotType,
                  run.runStatus,
                  run.snapshotDate,
                  run.periodStart,
                  run.periodEnd,
                  run.generatedAt,
                  run.generatedBy,
                  formatKpiConfigVersion(run.kpiConfigVersion, t),
                ]),
              })
            }
          />
        }
      >
        {sortedRuns.length === 0 ? (
          <AdminSurfaceEmpty copy={t('reportsSnapshotRuns.empty')} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('reportsSnapshotRuns.recentRunsTitle')}</TableHead>
                <TableHead>{t('reportsSnapshotRuns.snapshotDate')}</TableHead>
                <TableHead>{t('reportsSnapshotRuns.period')}</TableHead>
                <TableHead>{t('reportsSnapshotRuns.generatedAt')}</TableHead>
                <TableHead>{t('reportsSnapshotRuns.generatedBy')}</TableHead>
                <TableHead>{t('reportsSnapshotRuns.kpiConfigVersion')}</TableHead>
                <TableHead className="tw:text-right">{t('reportsSnapshotRuns.backToSummary')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRuns.map((run) => (
                <TableRow key={run.snapshotRunId}>
                  <TableCell>
                    <div className="tw:font-medium">
                      {t('reportsSnapshotRuns.snapshotLabel', {
                        type: formatSnapshotType(run.snapshotType, t),
                      })}
                    </div>
                    <div className="tw:mt-1 tw:max-w-64 tw:truncate tw:text-xs tw:text-muted-foreground">
                      {run.snapshotRunId}
                    </div>
                    <div className="tw:mt-2">
                      <AdminSurfaceBadge tone={mapRunStatusTone(run.runStatus)}>
                        {formatRunStatus(run.runStatus, t)}
                      </AdminSurfaceBadge>
                    </div>
                  </TableCell>
                  <TableCell>{formatDate(run.snapshotDate, locale)}</TableCell>
                  <TableCell>
                    {formatDate(run.periodStart, locale)} - {formatDate(run.periodEnd, locale)}
                  </TableCell>
                  <TableCell>{formatDateTime(run.generatedAt, locale)}</TableCell>
                  <TableCell>{run.generatedBy}</TableCell>
                  <TableCell>{formatKpiConfigVersion(run.kpiConfigVersion, t)}</TableCell>
                  <TableCell>
                    <div className="tw:flex tw:flex-wrap tw:justify-end tw:gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link
                          to={`/admin/reports/workforce/${run.snapshotRunId}`}
                          aria-label={t('reportsSnapshotRuns.openWorkforceForSnapshot', {
                            snapshotRunId: run.snapshotRunId,
                          })}
                        >
                          {t('reportsSnapshotRuns.openWorkforce')}
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link
                          to={`/admin/reports/kpis/${run.snapshotRunId}`}
                          aria-label={t('reportsSnapshotRuns.openKpisForSnapshot', {
                            snapshotRunId: run.snapshotRunId,
                          })}
                        >
                          {t('reportsSnapshotRuns.openKpis')}
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link
                          to={`/admin/reports/checklists/${run.snapshotRunId}`}
                          aria-label={t('reportsSnapshotRuns.openChecklistsForSnapshot', {
                            snapshotRunId: run.snapshotRunId,
                          })}
                        >
                          {t('reportsSnapshotRuns.openChecklists')}
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link
                          to={`/admin/reports/turnover/${run.snapshotRunId}`}
                          aria-label={t('reportsSnapshotRuns.openTurnoverForSnapshot', {
                            snapshotRunId: run.snapshotRunId,
                          })}
                        >
                          {t('reportsSnapshotRuns.openTurnover')}
                        </Link>
                      </Button>
                    </div>
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

function formatKpiConfigVersion(input: {
  versionNo: number | null
  state: 'versioned' | 'pre_governance'
} | null | undefined, t: TranslateFunction) {
  if (input?.state === 'versioned' && input.versionNo) {
    return t('reportsSnapshotRuns.versionValue', { version: input.versionNo })
  }

  return t('reportsSnapshotRuns.preGovernanceSnapshot')
}

function formatRunStatus(status: string, t: TranslateFunction) {
  const key = runStatusLabelKeys[status]
  return key ? t(key) : status
}

function formatSnapshotType(type: string, t: TranslateFunction) {
  const key = snapshotTypeLabelKeys[type]
  return key ? t(key) : type
}

function mapRunStatusTone(status: string): AdminSurfaceTone {
  if (status === 'completed') return 'success'
  if (status === 'blocked') return 'warning'
  if (status === 'stuck' || status === 'needs_action') return 'danger'
  if (status === 'ready' || status === 'retry_ready') return 'accent'
  return 'neutral'
}
