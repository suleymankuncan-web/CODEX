import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, CheckCircle2, Download, FileSpreadsheet, Layers3, ShieldCheck } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CalendarPicker } from '@/components/ui/calendar-picker'
import { Skeleton } from '@/components/ui/skeleton'
import type { AuthSessionSummary } from '@/features/auth/api'
import type { TranslateFunction } from '@/features/localization/dictionary'
import { useLocalization } from '@/features/localization/useLocalization'
import { getRegionManagerDirectory } from '@/features/org/region-manager-directory'
import { downloadStoreMonthlyReportPackage, getStoreMonthlyReportPackage } from '@/features/reports/api'
import { actionToast } from '@/lib/action-toast'
import { cn } from '@/lib/utils'
import { transientQueryRetryOptions } from '@/lib/query-retry'
import { OperationsDirectory, StoreOperationsHeader } from './store-operations-layout'
import { buildStoreReportsViewModel } from './store-reports-model'
import { StoreReportsTable } from './store-reports-table'
import { formatReportPeriodLabel, formatSourceReportCoverageLabel, getCurrentReportPeriod } from './store-reports-period'

type StoreReportsPageProps = { authSummary?: AuthSessionSummary | null }
const metricIcons = { 'period-package': FileSpreadsheet, scope: Layers3, 'detail-output': CheckCircle2, 'period-state': ShieldCheck }

export function StoreReportsPage({ authSummary = null }: StoreReportsPageProps) {
  const { locale, t } = useLocalization()
  const [period, setPeriod] = useState(() => getCurrentReportPeriod())
  const [managerId, setManagerId] = useState('all')
  const [downloading, setDownloading] = useState(false)
  const actorId = authSummary?.user.userId ?? 'anonymous'
  const roleScope = [authSummary?.user.roleCodes.join('|'), authSummary?.user.readScope.companyIds.join('|'), authSummary?.user.readScope.regionIds.join('|'), authSummary?.user.readScope.storeIds.join('|')].join('::')
  const showDirectory = authSummary?.user.roleCodes.some(role => ['REPORT_VIEWER', 'SUPER_ADMIN'].includes(role)) ?? false
  const regionManagerUserId = showDirectory && managerId !== 'all' ? managerId : undefined
  const packageQuery = useQuery({
    queryKey: ['store-reports-monthly-package', period, actorId, roleScope, regionManagerUserId],
    queryFn: () => getStoreMonthlyReportPackage({ period, ...(regionManagerUserId ? { regionManagerUserId } : {}) }),
  })
  const directoryQuery = useQuery({
    queryKey: ['store-reports-manager-directory', actorId, roleScope],
    queryFn: getRegionManagerDirectory,
    enabled: showDirectory,
    ...transientQueryRetryOptions,
  })
  const model = useMemo(() => {
    const summary = packageQuery.isError ? null : packageQuery.data ?? null
    return buildStoreReportsViewModel(summary, t, {
      period: formatReportPeriodLabel(period, locale),
      coverage: summary?.period ? formatSourceReportCoverageLabel({ coverageLabel: summary.coverageLabel, period: summary.period, locale }) ?? undefined : undefined,
    })
  }, [locale, packageQuery.data, packageQuery.isError, period, t])

  async function handleDownload() {
    setDownloading(true)
    try {
      const blob = await downloadStoreMonthlyReportPackage({ period, ...(regionManagerUserId ? { regionManagerUserId } : {}) })
      downloadBlob(blob, `magaza-izleyis-${period}.xlsx`)
      actionToast.success(t('storeReports.downloadSuccess'))
    } catch {
      actionToast.error(null, t('storeReports.downloadError'))
    } finally {
      setDownloading(false)
    }
  }

  return <section className="store-reports-command" aria-labelledby="store-reports-title">
    <StoreOperationsHeader titleId="store-reports-title" title={t('storeReports.title')} eyebrow={resolvePersonaLabel(authSummary, t)} description={t('storeReports.heroCopy')} icon={BarChart3} actions={
      <CalendarPicker mode="month" value={period} locale={locale} ariaLabel={t('storeReports.selectPeriod')} triggerClassName="operations-period" onValueChange={setPeriod} />
    } />
    <div className="src-metrics" aria-label={t('storeReports.summaryAria')}>
      {model.metrics.map(metric => {
        const Icon = metricIcons[metric.id as keyof typeof metricIcons] ?? FileSpreadsheet
        return <article className="src-metric" key={metric.id}>
          <span className="src-metric-label"><Icon aria-hidden="true" />{metric.label}</span>
          <strong>{metric.value}</strong><small>{metric.copy}</small>
        </article>
      })}
    </div>
    <div className={cn('operations-workspace', showDirectory && 'operations-workspace-with-directory')}>
      {showDirectory ? <div className="src-directory">
        {directoryQuery.isLoading ? <Skeleton className="tw:h-48 tw:w-full" aria-label={t('storeReports.directoryLoading')} /> : directoryQuery.isError ? <Alert variant="destructive"><AlertTitle>{t('storeReports.directoryError')}</AlertTitle><AlertDescription><Button variant="outline" onClick={() => directoryQuery.refetch()}>{t('storeReports.retry')}</Button></AlertDescription></Alert> : <OperationsDirectory
          items={(directoryQuery.data?.items ?? []).map(manager => ({ id: manager.userId, label: manager.displayName, detail: t('storeReports.storeCount', { count: manager.storeIds.length }) }))}
          value={managerId} onChange={setManagerId} locale={locale}
        />}
      </div> : null}
      <div className="src-content">
        <section className="operations-board src-package" aria-label={t('storeReports.primaryOutputAria')}>
          <div className="src-package-heading">
            <div><h2>{t('storeReports.excelTitle', { period: model.periodLabel })}</h2><p>{packageQuery.data && !packageQuery.isError ? t('storeReports.packageCopy', { count: model.storeCount }) : t('storeReports.coverageFallback')}</p></div>
            <Button disabled={downloading || !packageQuery.data || packageQuery.isFetching || packageQuery.isError} onClick={handleDownload} type="button"><Download data-icon="inline-start" />{downloading ? t('storeReports.downloadPreparing') : t('storeReports.download')}</Button>
          </div>
          {packageQuery.isLoading ? <div className="src-state" role="status"><Skeleton className="tw:h-5 tw:w-48" /><p>{t('storeReports.loading')}</p></div> : packageQuery.isError ? <Alert variant="destructive" className="src-error"><AlertTitle>{t('storeReports.errorTitle')}</AlertTitle><AlertDescription>{t('storeReports.errorCopy')}<Button type="button" variant="outline" onClick={() => packageQuery.refetch()}>{t('storeReports.retry')}</Button></AlertDescription></Alert> : <>
            <div className="src-package-meta"><Badge variant="secondary">{model.coverageLabel}</Badge><Badge variant="outline">{packageQuery.data?.isCurrentPeriod ? t('storeReports.currentPeriodCoverage') : t('storeReports.fullPeriodCoverage')}</Badge><span>{t('storeReports.exportScope')}</span></div>
            <details className="src-sections" aria-label={t('storeReports.packageContentsAria')}>
              <summary>{t('storeReports.packageContentsAria')}<span>{t('storeReports.sectionCount', { count: model.sections.length })}</span></summary>
              <div className="src-section-list">{model.sections.map(section => <div className="src-section-item" key={section.code}><div><strong>{section.label}</strong><small>{section.value}</small></div><Badge variant={section.status === 'ready' ? 'secondary' : 'outline'}>{t(section.status === 'ready' ? 'storeReports.state.ready' : 'storeReports.state.waiting')}</Badge></div>)}</div>
            </details>
          </>}
        </section>
        {!packageQuery.isLoading && !packageQuery.isError && packageQuery.data ? <StoreReportsTable key={`${period}:${managerId}`} items={packageQuery.data.items} /> : null}
      </div>
    </div>
  </section>
}

function resolvePersonaLabel(authSummary: AuthSessionSummary | null, t: TranslateFunction) {
  const roles = new Set(authSummary?.user.roleCodes ?? [])
  if (roles.has('SUPER_ADMIN')) return t('storeReports.persona.admin')
  if (roles.has('REPORT_VIEWER')) return t('storeReports.persona.reportViewer')
  if (roles.has('REGION_MANAGER')) return t('storeReports.persona.regionManager')
  if (roles.has('STORE_MANAGER')) return t('storeReports.persona.storeManager')
  if (roles.has('AUDITOR')) return t('storeReports.persona.auditor')
  return t('storeReports.persona.authorized')
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
