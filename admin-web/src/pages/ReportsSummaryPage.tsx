import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { ArrowRight, BriefcaseBusiness, ClipboardCheck, FileSpreadsheet, Layers3, TrendingDown, Trophy } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '../components/ui/empty'
import { Skeleton } from '../components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import type { TranslateFunction, TranslationKey } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import { getReportingSnapshotRuns, getReportingSummary } from '../features/reports/api'
import { formatDate, formatDateTime, getErrorMessage } from '../lib/format'
import { AdminAzureHeader } from './admin-azure-header'
import './reports-summary-azure.css'

const reportDefinitions = [
  { id: 'workforce', rows: 'workforceRows', title: 'reportsSummary.workforceTitle', note: 'reportsSummary.workforceNote', action: 'reportsSummary.openWorkforce', snapshotAction: 'reportsSummary.openWorkforceForSnapshot', icon: BriefcaseBusiness },
  { id: 'kpis', rows: 'kpiRows', title: 'reportsSummary.kpisTitle', note: 'reportsSummary.kpisNote', action: 'reportsSummary.openKpis', snapshotAction: 'reportsSummary.openKpisForSnapshot', icon: Trophy },
  { id: 'checklists', rows: 'checklistRows', title: 'reportsSummary.checklistsTitle', note: 'reportsSummary.checklistsNote', action: 'reportsSummary.openChecklists', snapshotAction: 'reportsSummary.openChecklistsForSnapshot', icon: ClipboardCheck },
  { id: 'turnover', rows: 'turnoverRows', title: 'reportsSummary.turnoverTitle', note: 'reportsSummary.turnoverNote', action: 'reportsSummary.openTurnover', snapshotAction: 'reportsSummary.openTurnoverForSnapshot', icon: TrendingDown },
] as const

const runStatusLabelKeys: Record<string, TranslationKey> = {
  completed: 'reportsSummary.status.completed', failed: 'reportsSummary.status.failed',
  running: 'reportsSummary.status.running', processing: 'reportsSummary.status.running',
  queued: 'reportsSummary.status.queued', pending: 'reportsSummary.status.pending',
}
const snapshotTypeLabelKeys: Record<string, TranslationKey> = {
  daily: 'reportsSummary.snapshotType.daily', monthly: 'reportsSummary.snapshotType.monthly',
}

export function ReportsSummaryPage() {
  const { locale, t } = useLocalization()
  const summaryQuery = useQuery({ queryKey: ['reporting-summary'], queryFn: getReportingSummary })
  const runsQuery = useQuery({ queryKey: ['reporting-snapshot-runs'], queryFn: () => getReportingSnapshotRuns() })
  const summary = summaryQuery.data
  const latestRun = summary?.latestCompletedSnapshotRun
  const isLoading = summaryQuery.isLoading || runsQuery.isLoading
  const errorTitle = summaryQuery.isError ? t('reportsSummary.errorTitle')
    : runsQuery.isError ? t('reportsSummary.runsErrorTitle')
      : !isLoading && !summary ? t('reportsSummary.noSummaryTitle') : null
  const errorDescription = summaryQuery.isError ? getErrorMessage(summaryQuery.error)
    : runsQuery.isError ? getErrorMessage(runsQuery.error) : t('reportsSummary.noSummaryCopy')

  return (
    <section className="reports-summary-azure" aria-label={t('reportsSummary.heroEyebrow')}>
      <AdminAzureHeader
        title={t('reportsSummary.heroTitle')}
        description={t('reportsSummary.heroCopy')}
        icon={<FileSpreadsheet aria-hidden="true" />}
        actions={<Button asChild variant="outline"><Link to="/admin/reports/snapshot-runs">
          {t('reportsSummary.openDrillDownChooser')}<ArrowRight data-icon="inline-end" aria-hidden="true" />
        </Link></Button>}
      />
      {isLoading ? (
        <div role="status" aria-live="polite" className="reports-summary-loading">
          <p>{t('reportsSummary.loadingTitle')}</p>
          <div className="reports-summary-metrics" aria-hidden="true">
            {reportDefinitions.map((report) => <Skeleton key={report.id} className="tw:h-40" />)}
          </div>
          <Skeleton className="tw:h-56" aria-hidden="true" />
        </div>
      ) : errorTitle ? (
        <Alert variant="destructive">
          <AlertTitle>{errorTitle}</AlertTitle>
          <AlertDescription>{errorDescription}</AlertDescription>
          <Button variant="outline" size="sm" className="tw:mt-3 tw:w-fit" onClick={() => {
            void summaryQuery.refetch()
            void runsQuery.refetch()
          }}>{t('reportsSummary.retry')}</Button>
        </Alert>
      ) : summary ? (
        <>
          <div className="reports-summary-metrics" aria-label={t('reportsSummary.coverageEyebrow')}>
            {reportDefinitions.map((report) => (
              <Card key={report.id} className="reports-summary-metric" data-report={report.id}>
                <CardHeader>
                  <CardTitle><h2><report.icon aria-hidden="true" />{t(report.title)}</h2></CardTitle>
                  <CardDescription>{t(report.note)}</CardDescription>
                </CardHeader>
                <CardContent><strong>{summary.cards[report.rows].toLocaleString(locale)}</strong><span>{t('reportsSummary.coverageRows')}</span></CardContent>
                <CardFooter>
                  {latestRun ? <Button asChild variant="ghost" size="sm"><Link to={`/admin/reports/${report.id}/${latestRun.snapshotRunId}`}>
                    {t(report.action)}<ArrowRight data-icon="inline-end" aria-hidden="true" />
                  </Link></Button> : <Badge variant="outline">{t('reportsSummary.unavailable')}</Badge>}
                </CardFooter>
              </Card>
            ))}
          </div>
          <Card className="reports-summary-section">
            <CardHeader>
              <CardTitle><h2><Layers3 aria-hidden="true" />{t('reportsSummary.reportingAnchorTitle')}</h2></CardTitle>
              <CardDescription>{t('reportsSummary.latestSnapshotEyebrow')}</CardDescription>
            </CardHeader>
            <CardContent>
              {latestRun ? <dl className="reports-summary-context">
                <div><dt>{t('reportsSummary.period')}</dt><dd>{formatDate(latestRun.periodStart, locale)} - {formatDate(latestRun.periodEnd, locale)}</dd></div>
                <div><dt>{t('reportsSummary.snapshotType')}</dt><dd>{formatSnapshotType(latestRun.snapshotType, t)} <RunStatus status={latestRun.runStatus} t={t} /></dd></div>
                <div><dt>{t('reportsSummary.generatedAt')}</dt><dd>{formatDateTime(latestRun.generatedAt, locale)}</dd></div>
                <div><dt>{t('reportsSummary.snapshotRunId')}</dt><dd className="reports-summary-run-id">{latestRun.snapshotRunId}</dd></div>
              </dl> : <Empty><EmptyHeader><EmptyTitle>{t('reportsSummary.noCompletedTitle')}</EmptyTitle><EmptyDescription>{t('reportsSummary.noCompletedCopy')}</EmptyDescription></EmptyHeader></Empty>}
            </CardContent>
            <CardFooter className="reports-summary-total"><span>{t('reportsSummary.totalReportRows')}</span><strong>{reportDefinitions.reduce((total, report) => total + summary.cards[report.rows], 0).toLocaleString(locale)}</strong></CardFooter>
          </Card>
          <Card className="reports-summary-section reports-summary-history">
            <CardHeader>
              <CardTitle><h2>{t('reportsSummary.recentRunsTitle')}</h2></CardTitle>
              <CardDescription>{t('reportsSummary.recentRunsEyebrow')}</CardDescription>
            </CardHeader>
            <CardContent>
              {runsQuery.data?.items.length ? <Table aria-label={t('reportsSummary.recentRunsTitle')}>
                <TableHeader><TableRow>
                  <TableHead>{t('reportsSummary.latestRun')}</TableHead>
                  <TableHead>{t('reportsSummary.period')}</TableHead>
                  <TableHead>{t('reportsSummary.status')}</TableHead>
                  <TableHead>{t('reportsSummary.coverageAction')}</TableHead>
                </TableRow></TableHeader>
                <TableBody>{runsQuery.data.items.map((run) => <TableRow key={run.snapshotRunId}>
                  <TableCell><strong>{t('reportsSummary.snapshotLabel', { type: formatSnapshotType(run.snapshotType, t) })}</strong><span className="reports-summary-run-id">{run.snapshotRunId}</span></TableCell>
                  <TableCell><span className="reports-summary-mobile-label">{t('reportsSummary.period')}</span>{formatDate(run.periodStart, locale)} - {formatDate(run.periodEnd, locale)}</TableCell>
                  <TableCell><RunStatus status={run.runStatus} t={t} /></TableCell>
                  <TableCell><nav className="reports-summary-run-links" aria-label={run.snapshotRunId}>
                    {reportDefinitions.map((report) => <Button key={report.id} asChild size="sm" variant="outline"><Link to={`/admin/reports/${report.id}/${run.snapshotRunId}`} aria-label={t(report.snapshotAction, { snapshotRunId: run.snapshotRunId })}>{t(report.action)}</Link></Button>)}
                  </nav></TableCell>
                </TableRow>)}</TableBody>
              </Table> : <Empty><EmptyHeader><EmptyDescription>{t('reportsSummary.recentRunsEmpty')}</EmptyDescription></EmptyHeader></Empty>}
            </CardContent>
          </Card>
        </>
      ) : null}
    </section>
  )
}

function RunStatus({ status, t }: { status: string; t: TranslateFunction }) {
  const key = runStatusLabelKeys[status]
  return <Badge variant={status === 'failed' ? 'destructive' : status === 'completed' ? 'secondary' : 'outline'}>{key ? t(key) : status}</Badge>
}

function formatSnapshotType(type: string, t: TranslateFunction) {
  const key = snapshotTypeLabelKeys[type]
  return key ? t(key) : type
}
