import { CalendarPicker } from '@/components/ui/calendar-picker'
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BadgeCheck,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  Layers3,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { AuthSessionSummary } from '../features/auth/api'
import type { TranslateFunction } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import {
  downloadStoreMonthlyReportPackage,
  getStoreMonthlyReportPackage,
} from '../features/reports/api'
import { actionToast } from '../lib/action-toast'
import { buildStoreReportsViewModel, type StoreReportMetricTone } from './store-reports-model'
import {
  formatReportPeriodLabel,
  formatSourceReportCoverageLabel,
  getCurrentReportPeriod,
} from './store-reports-period'

type StoreReportsPageProps = {
  authSummary?: AuthSessionSummary | null
}

type DownloadState = 'idle' | 'pending' | 'error'

const metricIcons = {
  'period-package': FileSpreadsheet,
  scope: Layers3,
  'detail-output': CheckCircle2,
  'period-state': ShieldCheck,
}

const sectionIcons = {
  kpis: BarChart3,
  approval_scores: BadgeCheck,
  actions: ClipboardCheck,
  targets: Sparkles,
  incentives: FileSpreadsheet,
  workforce: Layers3,
  visits: CalendarDays,
}

export function StoreReportsPage({ authSummary = null }: StoreReportsPageProps) {
  const { locale, t } = useLocalization()
  const [period, setPeriod] = useState(() => getCurrentReportPeriod())
  const [downloadState, setDownloadState] = useState<DownloadState>('idle')
  const actorId = authSummary?.user.userId ?? 'anonymous'
  const roleScope = [
    authSummary?.user.roleCodes.join('|') ?? '',
    authSummary?.user.readScope.companyIds.join('|') ?? '',
    authSummary?.user.readScope.regionIds.join('|') ?? '',
    authSummary?.user.readScope.storeIds.join('|') ?? '',
  ].join('::')
  const packageQuery = useQuery({
    queryKey: ['store-reports-monthly-package', period, actorId, roleScope],
    queryFn: () => getStoreMonthlyReportPackage({ period }),
  })
  const model = useMemo(
    () => {
      const summary = packageQuery.data ?? null
      return buildStoreReportsViewModel(summary, t, {
        period: summary?.period ? formatReportPeriodLabel(summary.period, locale) : undefined,
        coverage: summary?.period
          ? formatSourceReportCoverageLabel({
              coverageLabel: summary.coverageLabel,
              period: summary.period,
              locale,
            }) ?? undefined
          : undefined,
      })
    },
    [locale, packageQuery.data, t],
  )
  const personaLabel = resolvePersonaLabel(authSummary, t)
  const downloading = downloadState === 'pending'

  async function handleDownload() {
    setDownloadState('pending')

    try {
      const blob = await downloadStoreMonthlyReportPackage({ period })
      downloadBlob(blob, `magaza-izleyis-${period}.xlsx`)
      setDownloadState('idle')
      actionToast.success(t('storeReports.downloadSuccess'))
    } catch {
      setDownloadState('error')
      actionToast.error(null, t('storeReports.downloadError'))
    }
  }

  return (
    <section className="store-reports-command" aria-label={t('storeReports.title')}>
      <header className="src-hero">
        <div className="src-hero-copy">
          <div className="src-kicker">
            <span className="src-pill src-pill-primary">
              <BarChart3 aria-hidden="true" />
              {t('storeReports.title')}
            </span>
            <span className="src-pill">{model.periodLabel}</span>
            <span className="src-pill">{personaLabel}</span>
          </div>
          <h1>{t('storeReports.title')}</h1>
          <p>{t('storeReports.heroCopy')}</p>
        </div>
        <div className="src-hero-actions">
          <StoreReportsPeriodPicker period={period} onPeriodChange={setPeriod} />
        </div>
      </header>

      <div className="src-metrics" aria-label={t('storeReports.summaryAria')}>
        {model.metrics.map((metric) => {
          const Icon = metricIcons[metric.id as keyof typeof metricIcons] ?? FileSpreadsheet
          return (
            <article className={`src-metric src-metric-${metric.tone}`} key={metric.id}>
              <span className="src-metric-icon" aria-hidden="true">
                <Icon />
              </span>
              <div>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <small>{metric.copy}</small>
              </div>
            </article>
          )
        })}
      </div>

      <main className="src-package">
        <section className="src-package-card" aria-label={t('storeReports.primaryOutputAria')}>
          <span className="src-section-label">{t('storeReports.primaryOutput')}</span>
          <h2>{t('storeReports.excelTitle', { period: model.periodLabel })}</h2>
          <p>{t('storeReports.packageCopy', { count: model.storeCount })}</p>

          {packageQuery.isLoading ? (
            <div className="src-state src-state-loading">{t('storeReports.loading')}</div>
          ) : null}

          {packageQuery.isError ? (
            <div className="src-state src-state-error">
              <strong>{t('storeReports.errorTitle')}</strong>
              <span>{t('storeReports.errorCopy')}</span>
              <Button type="button" variant="outline" onClick={() => packageQuery.refetch()}>
                {t('storeReports.retry')}
              </Button>
            </div>
          ) : null}

          <div className="src-package-actions">
            <Button
              className="src-primary-action"
              disabled={downloading || packageQuery.isLoading || packageQuery.isError}
              onClick={handleDownload}
              type="button"
            >
              <Download data-icon="inline-start" />
              {downloading ? t('storeReports.downloadPreparing') : t('storeReports.download')}
            </Button>
          </div>

          <div className="src-package-foot">
            <span>{model.coverageLabel}</span>
            <span>
              {packageQuery.data?.isCurrentPeriod
                ? t('storeReports.currentPeriodCoverage')
                : t('storeReports.fullPeriodCoverage')}
            </span>
          </div>
        </section>

        <section className="src-section-list" aria-label={t('storeReports.packageContentsAria')}>
          {model.sections.map((section) => {
            const Icon = sectionIcons[section.code as keyof typeof sectionIcons] ?? FileSpreadsheet
            const tone: StoreReportMetricTone = section.status === 'ready' ? 'cyan' : 'amber'

            return (
              <article className={`src-section-item src-section-${tone}`} key={section.code}>
                <span aria-hidden="true">
                  <Icon />
                </span>
                <div>
                  <strong>{section.label}</strong>
                  <small>{section.value}</small>
                </div>
              </article>
            )
          })}
        </section>
      </main>
    </section>
  )
}

function StoreReportsPeriodPicker(input: { period: string; onPeriodChange: (period: string) => void }) {
  const { locale, t } = useLocalization()
  return <CalendarPicker mode="month" value={input.period} locale={locale}
    ariaLabel={t('storeReports.selectPeriod')} triggerClassName="src-period-trigger"
    onValueChange={input.onPeriodChange} />
}

function resolvePersonaLabel(authSummary: AuthSessionSummary | null, t: TranslateFunction) {
  const roles = new Set(authSummary?.user.roleCodes ?? [])
  if (roles.has('REGION_MANAGER')) return t('storeReports.persona.regionManager')
  if (roles.has('SUPER_ADMIN')) return t('storeReports.persona.admin')
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
