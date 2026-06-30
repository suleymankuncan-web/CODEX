import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowRight, BriefcaseBusiness, ClipboardCheck, Database, FileSpreadsheet, Layers3, TrendingDown, Trophy } from 'lucide-react'
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
      <AdminOperationalPage>
        <AdminStatePanel
          title={t('reportsSummary.loadingTitle')}
          description={t('reportsSummary.loadingCopy')}
          isLoading
        />
      </AdminOperationalPage>
    )
  }

  if (summaryQuery.isError) {
    return (
      <AdminOperationalPage>
        <AdminStatePanel
          title={t('reportsSummary.errorTitle')}
          description={getErrorMessage(summaryQuery.error)}
          tone="danger"
        />
      </AdminOperationalPage>
    )
  }

  if (runsQuery.isError) {
    return (
      <AdminOperationalPage>
        <AdminStatePanel
          title={t('reportsSummary.runsErrorTitle')}
          description={getErrorMessage(runsQuery.error)}
          tone="danger"
        />
      </AdminOperationalPage>
    )
  }

  const summary = summaryQuery.data
  if (!summary) {
    return (
      <AdminOperationalPage>
        <AdminStatePanel
          title={t('reportsSummary.noSummaryTitle')}
          description={t('reportsSummary.noSummaryCopy')}
          tone="danger"
        />
      </AdminOperationalPage>
    )
  }

  const latestRun = summary.latestCompletedSnapshotRun
  const totalRows =
    summary.cards.workforceRows +
    summary.cards.kpiRows +
    summary.cards.checklistRows +
    summary.cards.turnoverRows
  const reportCoverageRows = [
    {
      id: 'workforce',
      label: t('reportsSummary.workforceTitle'),
      rows: summary.cards.workforceRows,
      note: t('reportsSummary.workforceNote'),
      href: latestRun ? `/admin/reports/workforce/${latestRun.snapshotRunId}` : null,
      actionLabel: t('reportsSummary.openWorkforce'),
    },
    {
      id: 'kpis',
      label: t('reportsSummary.kpisTitle'),
      rows: summary.cards.kpiRows,
      note: t('reportsSummary.kpisNote'),
      href: latestRun ? `/admin/reports/kpis/${latestRun.snapshotRunId}` : null,
      actionLabel: t('reportsSummary.openKpis'),
    },
    {
      id: 'checklists',
      label: t('reportsSummary.checklistsTitle'),
      rows: summary.cards.checklistRows,
      note: t('reportsSummary.checklistsNote'),
      href: latestRun ? `/admin/reports/checklists/${latestRun.snapshotRunId}` : null,
      actionLabel: t('reportsSummary.openChecklists'),
    },
    {
      id: 'turnover',
      label: t('reportsSummary.turnoverTitle'),
      rows: summary.cards.turnoverRows,
      note: t('reportsSummary.turnoverNote'),
      href: latestRun ? `/admin/reports/turnover/${latestRun.snapshotRunId}` : null,
      actionLabel: t('reportsSummary.openTurnover'),
    },
  ]

  return (
    <AdminOperationalPage ariaLabel={t('reportsSummary.heroEyebrow')}>
      <AdminOperationalHeader
        eyebrow={t('reportsSummary.heroEyebrow')}
        title={t('reportsSummary.heroTitle')}
        description={t('reportsSummary.heroCopy')}
        icon={<FileSpreadsheet size={18} />}
        actions={
          <Button asChild variant="outline">
            <Link to="/admin/reports/snapshot-runs">
              {t('reportsSummary.openDrillDownChooser')}
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        }
      />

      <AdminOperationalMetrics
        items={[
          {
            id: 'total-report-rows',
            label: t('reportsSummary.totalReportRows'),
            value: totalRows,
            icon: <Database size={18} />,
            tone: 'neutral',
          },
          {
            id: 'latest-run',
            label: t('reportsSummary.latestRun'),
            value: latestRun ? formatSnapshotType(latestRun.snapshotType, t) : t('reportsSummary.noCompletedRun'),
            icon: <Layers3 size={18} />,
            tone: latestRun ? 'success' : 'warning',
          },
          {
            id: 'status',
            label: t('reportsSummary.status'),
            value: latestRun ? formatRunStatus(latestRun.runStatus, t) : t('reportsSummary.unavailable'),
            icon: <Trophy size={18} />,
            tone: latestRun ? 'success' : 'neutral',
          },
        ]}
      />

      {latestRun ? (
        <AdminOperationalSection
          title={t('reportsSummary.reportingAnchorTitle')}
          description={t('reportsSummary.latestSnapshotEyebrow')}
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
        </AdminOperationalSection>
      ) : (
        <AdminOperationalSection title={t('reportsSummary.reportingAnchorTitle')}>
          <AdminSurfaceEmpty
            title={t('reportsSummary.noCompletedTitle')}
            copy={t('reportsSummary.noCompletedCopy')}
          />
        </AdminOperationalSection>
      )}

      <AdminOperationalMetrics
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
        <AdminOperationalSection
          title={t('reportsSummary.coverageTitle')}
          description={t('reportsSummary.coverageEyebrow')}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('reportsSummary.coverageSlice')}</TableHead>
                <TableHead>{t('reportsSummary.coverageRows')}</TableHead>
                <TableHead className="tw:text-right">{t('reportsSummary.coverageAction')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportCoverageRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="tw:font-medium">{row.label}</div>
                    <div className="tw:mt-1 tw:text-xs tw:text-muted-foreground">{row.note}</div>
                  </TableCell>
                  <TableCell>{row.rows}</TableCell>
                  <TableCell className="tw:text-right">
                    {row.href ? (
                      <Button asChild size="sm" variant="outline">
                        <Link to={row.href}>{row.actionLabel}</Link>
                      </Button>
                    ) : (
                      <AdminSurfaceBadge tone="neutral">{t('reportsSummary.unavailable')}</AdminSurfaceBadge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </AdminOperationalSection>

        <AdminOperationalSection
          title={t('reportsSummary.recentRunsTitle')}
          description={t('reportsSummary.recentRunsEyebrow')}
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
        </AdminOperationalSection>
      </div>
    </AdminOperationalPage>
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
