import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowRight, BriefcaseBusiness, ClipboardCheck, Database, TrendingDown, Trophy } from 'lucide-react'
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
import { getReportingSnapshotRuns, getReportingSummary } from '../features/reports/api'
import { formatDate, formatDateTime, getErrorMessage } from '../lib/format'
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
} from './admin-surface-primitives'

const runStatusLabelKeys: Record<string, TranslationKey> = {
  completed: 'reportsSummary.status.completed',
  failed: 'reportsSummary.status.failed',
  running: 'reportsSummary.status.running',
  processing: 'reportsSummary.status.running',
  queued: 'reportsSummary.status.queued',
  pending: 'reportsSummary.status.pending',
}

const snapshotTypeLabelKeys: Record<string, TranslationKey> = {
  daily: 'reportsSummary.snapshotType.daily',
  monthly: 'reportsSummary.snapshotType.monthly',
}

const readPaths = [
  '/api/reports/summary',
  '/api/reports/snapshot-runs',
  '/api/reports/workforce',
  '/api/reports/kpis',
  '/api/reports/checklists',
  '/api/reports/turnover',
]

export function ReportsSummaryPage() {
  const { locale, t } = useLocalization()
  const summaryQuery = useQuery({
    queryKey: ['reporting-summary'],
    queryFn: getReportingSummary,
  })
  const runsQuery = useQuery({
    queryKey: ['reporting-snapshot-runs'],
    queryFn: () => getReportingSnapshotRuns(),
  })

  if (summaryQuery.isLoading || runsQuery.isLoading) {
    return (
      <AdminSurfacePage>
        <AdminStatePanel
          title={t('reportsSummary.loadingTitle')}
          description={t('reportsSummary.loadingCopy')}
          isLoading
        />
      </AdminSurfacePage>
    )
  }

  if (summaryQuery.isError) {
    return (
      <AdminSurfacePage>
        <AdminStatePanel
          title={t('reportsSummary.errorTitle')}
          description={getErrorMessage(summaryQuery.error)}
          tone="danger"
        />
      </AdminSurfacePage>
    )
  }

  if (runsQuery.isError) {
    return (
      <AdminSurfacePage>
        <AdminStatePanel
          title={t('reportsSummary.runsErrorTitle')}
          description={getErrorMessage(runsQuery.error)}
          tone="danger"
        />
      </AdminSurfacePage>
    )
  }

  const summary = summaryQuery.data
  if (!summary) {
    return (
      <AdminSurfacePage>
        <AdminStatePanel
          title={t('reportsSummary.noSummaryTitle')}
          description={t('reportsSummary.noSummaryCopy')}
          tone="danger"
        />
      </AdminSurfacePage>
    )
  }

  const latestRun = summary.latestCompletedSnapshotRun
  const totalRows =
    summary.cards.workforceRows +
    summary.cards.kpiRows +
    summary.cards.checklistRows +
    summary.cards.turnoverRows

  return (
    <AdminSurfacePage ariaLabel={t('reportsSummary.heroEyebrow')}>
      <AdminSurfaceHeader
        eyebrow={t('reportsSummary.heroEyebrow')}
        title={t('reportsSummary.heroTitle')}
        description={t('reportsSummary.heroCopy')}
        icon={<Database size={18} />}
        actions={
          <Button asChild variant="outline">
            <Link to="/admin/reports/snapshot-runs">
              {t('reportsSummary.openDrillDownChooser')}
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        }
      />

      <AdminMetricStrip
        items={[
          {
            id: 'total-report-rows',
            label: t('reportsSummary.totalReportRows'),
            value: totalRows,
            tone: 'neutral',
          },
          {
            id: 'latest-run',
            label: t('reportsSummary.latestRun'),
            value: latestRun ? formatSnapshotType(latestRun.snapshotType, t) : t('reportsSummary.noCompletedRun'),
            tone: latestRun ? 'success' : 'warning',
          },
          {
            id: 'status',
            label: t('reportsSummary.status'),
            value: latestRun ? formatRunStatus(latestRun.runStatus, t) : t('reportsSummary.unavailable'),
            tone: latestRun ? 'success' : 'neutral',
          },
        ]}
      />

      {latestRun ? (
        <AdminSurfaceSection
          eyebrow={t('reportsSummary.latestSnapshotEyebrow')}
          title={t('reportsSummary.reportingAnchorTitle')}
        >
          <AdminKeyValueGrid>
            <AdminKeyValue label={t('reportsSummary.snapshotRunId')} value={latestRun.snapshotRunId} />
            <AdminKeyValue label={t('reportsSummary.snapshotType')} value={formatSnapshotType(latestRun.snapshotType, t)} />
            <AdminKeyValue
              label={t('reportsSummary.period')}
              value={`${formatDate(latestRun.periodStart, locale)} - ${formatDate(latestRun.periodEnd, locale)}`}
            />
            <AdminKeyValue label={t('reportsSummary.generatedAt')} value={formatDateTime(latestRun.generatedAt, locale)} />
          </AdminKeyValueGrid>
        </AdminSurfaceSection>
      ) : (
        <AdminSurfaceSection title={t('reportsSummary.reportingAnchorTitle')}>
          <AdminSurfaceEmpty
            title={t('reportsSummary.noCompletedTitle')}
            copy={t('reportsSummary.noCompletedCopy')}
          />
        </AdminSurfaceSection>
      )}

      <AdminMetricStrip
        items={[
          {
            id: 'workforce-rows',
            label: t('reportsSummary.workforceTitle'),
            value: summary.cards.workforceRows,
            description: t('reportsSummary.workforceNote'),
            icon: <BriefcaseBusiness size={18} />,
            tone: 'success',
          },
          {
            id: 'kpi-rows',
            label: t('reportsSummary.kpisTitle'),
            value: summary.cards.kpiRows,
            description: t('reportsSummary.kpisNote'),
            icon: <Trophy size={18} />,
            tone: 'accent',
          },
          {
            id: 'checklist-rows',
            label: t('reportsSummary.checklistsTitle'),
            value: summary.cards.checklistRows,
            description: t('reportsSummary.checklistsNote'),
            icon: <ClipboardCheck size={18} />,
            tone: 'warning',
          },
          {
            id: 'turnover-rows',
            label: t('reportsSummary.turnoverTitle'),
            value: summary.cards.turnoverRows,
            description: t('reportsSummary.turnoverNote'),
            icon: <TrendingDown size={18} />,
            tone: 'danger',
          },
        ]}
      />

      <div className="tw:grid tw:grid-cols-1 tw:gap-4 tw:xl:grid-cols-2">
        <AdminSurfaceSection
          eyebrow={t('reportsSummary.readPathsEyebrow')}
          title={t('reportsSummary.readPathsTitle')}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Endpoint</TableHead>
                <TableHead className="tw:text-right">{t('reportsSummary.readOnly')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {readPaths.map((path) => (
                <TableRow key={path}>
                  <TableCell className="tw:font-mono tw:text-xs">{path}</TableCell>
                  <TableCell className="tw:text-right">
                    <AdminSurfaceBadge tone="neutral">{t('reportsSummary.readOnly')}</AdminSurfaceBadge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </AdminSurfaceSection>

        <AdminSurfaceSection
          eyebrow={t('reportsSummary.recentRunsEyebrow')}
          title={t('reportsSummary.recentRunsTitle')}
        >
          {runsQuery.data?.items.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('reportsSummary.latestRun')}</TableHead>
                  <TableHead>{t('reportsSummary.period')}</TableHead>
                  <TableHead className="tw:text-right">{t('reportsSummary.openDrillDownChooser')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runsQuery.data.items.map((run) => (
                  <TableRow key={run.snapshotRunId}>
                    <TableCell>
                      <div className="tw:font-medium">
                        {t('reportsSummary.snapshotLabel', { type: formatSnapshotType(run.snapshotType, t) })}
                      </div>
                      <div className="tw:mt-1 tw:max-w-56 tw:truncate tw:text-xs tw:text-muted-foreground">
                        {run.snapshotRunId}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>{formatDate(run.periodStart, locale)} - {formatDate(run.periodEnd, locale)}</div>
                      <AdminSurfaceBadge tone="success">{formatRunStatus(run.runStatus, t)}</AdminSurfaceBadge>
                    </TableCell>
                    <TableCell>
                      <div className="tw:flex tw:flex-wrap tw:justify-end tw:gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link
                            to={`/admin/reports/workforce/${run.snapshotRunId}`}
                            aria-label={t('reportsSummary.openWorkforceForSnapshot', { snapshotRunId: run.snapshotRunId })}
                          >
                            {t('reportsSummary.openWorkforce')}
                          </Link>
                        </Button>
                        <Button asChild size="sm" variant="outline">
                          <Link
                            to={`/admin/reports/kpis/${run.snapshotRunId}`}
                            aria-label={t('reportsSummary.openKpisForSnapshot', { snapshotRunId: run.snapshotRunId })}
                          >
                            {t('reportsSummary.openKpis')}
                          </Link>
                        </Button>
                        <Button asChild size="sm" variant="outline">
                          <Link
                            to={`/admin/reports/checklists/${run.snapshotRunId}`}
                            aria-label={t('reportsSummary.openChecklistsForSnapshot', { snapshotRunId: run.snapshotRunId })}
                          >
                            {t('reportsSummary.openChecklists')}
                          </Link>
                        </Button>
                        <Button asChild size="sm" variant="outline">
                          <Link
                            to={`/admin/reports/turnover/${run.snapshotRunId}`}
                            aria-label={t('reportsSummary.openTurnoverForSnapshot', { snapshotRunId: run.snapshotRunId })}
                          >
                            {t('reportsSummary.openTurnover')}
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <AdminSurfaceEmpty copy={t('reportsSummary.recentRunsEmpty')} />
          )}
        </AdminSurfaceSection>
      </div>
    </AdminSurfacePage>
  )
}

function formatRunStatus(status: string, t: TranslateFunction) {
  const key = runStatusLabelKeys[status]
  return key ? t(key) : status
}

function formatSnapshotType(type: string, t: TranslateFunction) {
  const key = snapshotTypeLabelKeys[type]
  return key ? t(key) : type
}
