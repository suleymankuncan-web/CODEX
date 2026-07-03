import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  BadgeCheck,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  Layers3,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { AuthSessionSummary } from '../features/auth/api'
import {
  downloadStoreMonthlyReportPackage,
  getStoreMonthlyReportPackage,
} from '../features/reports/api'
import { actionToast } from '../lib/action-toast'
import { buildStoreReportsViewModel, type StoreReportMetricTone } from './store-reports-model'
import {
  formatReportPeriodLabel,
  getCurrentReportPeriod,
  isFutureReportPeriod,
  listReportYearOptions,
  parseReportPeriod,
  reportMonthLabels,
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
    () => buildStoreReportsViewModel(packageQuery.data ?? null),
    [packageQuery.data],
  )
  const personaLabel = resolvePersonaLabel(authSummary)
  const downloading = downloadState === 'pending'

  async function handleDownload() {
    setDownloadState('pending')

    try {
      const blob = await downloadStoreMonthlyReportPackage({ period })
      downloadBlob(blob, `magaza-izleyis-${period}.xlsx`)
      setDownloadState('idle')
      actionToast.success('Excel indirildi')
    } catch {
      setDownloadState('error')
      actionToast.error(null, 'Excel indirilemedi. Dönemi kontrol edip tekrar deneyin.')
    }
  }

  return (
    <section className="store-reports-command" aria-label="Raporlar">
      <header className="src-hero">
        <div className="src-hero-copy">
          <div className="src-kicker">
            <span className="src-pill src-pill-primary">
              <BarChart3 aria-hidden="true" />
              Raporlar
            </span>
            <span className="src-pill">{model.periodLabel}</span>
            <span className="src-pill">{personaLabel}</span>
          </div>
          <h1>Raporlar</h1>
          <p>Dönem rapor paketi, modül özetleri ve detay dışa aktarım.</p>
        </div>
        <div className="src-hero-actions">
          <StoreReportsPeriodPicker period={period} onPeriodChange={setPeriod} />
        </div>
      </header>

      <div className="src-metrics" aria-label="Rapor özeti">
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
        <section className="src-package-card" aria-label="Ana çıktı">
          <span className="src-section-label">Ana çıktı</span>
          <h2>{model.periodLabel} Mağaza İzleyiş Exceli</h2>
          <p>
            {model.storeCount} mağazanın CR, GSM, checklist, aksiyon, hedef, prim,
            norm kadro ve ziyaret verileri tek tabloda birleşir.
          </p>

          {packageQuery.isLoading ? (
            <div className="src-state src-state-loading">Rapor paketi hazırlanıyor.</div>
          ) : null}

          {packageQuery.isError ? (
            <div className="src-state src-state-error">
              <strong>Rapor verisi alınamadı.</strong>
              <span>Bağlantı düzeldiğinde tekrar deneyin.</span>
              <Button type="button" variant="outline" onClick={() => packageQuery.refetch()}>
                Tekrar dene
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
              {downloading ? 'Hazırlanıyor' : 'Excel indir'}
            </Button>
          </div>

          <div className="src-package-foot">
            <span>{model.coverageLabel}</span>
            <span>{packageQuery.data?.isCurrentPeriod ? 'Ay içi kapsam' : 'Tam dönem'}</span>
          </div>
        </section>

        <section className="src-section-list" aria-label="Paket içeriği">
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

function StoreReportsPeriodPicker(input: {
  period: string
  onPeriodChange: (period: string) => void
}) {
  const [open, setOpen] = useState(false)
  const today = useMemo(() => new Date(), [])
  const parsed = parseReportPeriod(input.period)
  const [year, setYear] = useState(parsed.year)
  const yearOptions = listReportYearOptions(today)

  function selectMonth(month: number) {
    const nextPeriod = `${year}-${String(month).padStart(2, '0')}`
    if (isFutureReportPeriod({ period: nextPeriod, today })) return
    input.onPeriodChange(nextPeriod)
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (nextOpen) setYear(parsed.year)
      }}
    >
      <PopoverTrigger asChild>
        <Button className="src-period-trigger" type="button" variant="outline">
          <CalendarDays data-icon="inline-start" />
          {formatReportPeriodLabel(input.period)}
          <ChevronDown data-icon="inline-end" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="src-period-popover">
        <PopoverHeader>
          <PopoverTitle>Dönem seç</PopoverTitle>
        </PopoverHeader>
        <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}>
          <SelectTrigger aria-label="Yıl seç" className="src-year-select">
            <SelectValue placeholder="Yıl" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {yearOptions.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <div className="src-month-grid">
          {reportMonthLabels.map((label, index) => {
            const month = index + 1
            const nextPeriod = `${year}-${String(month).padStart(2, '0')}`
            const selected = nextPeriod === input.period
            const disabled = isFutureReportPeriod({ period: nextPeriod, today })

            return (
              <Button
                className="src-month-button"
                disabled={disabled}
                key={label}
                onClick={() => selectMonth(month)}
                type="button"
                variant={selected ? 'default' : 'outline'}
              >
                {label.slice(0, 3)}
              </Button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function resolvePersonaLabel(authSummary: AuthSessionSummary | null) {
  const roles = new Set(authSummary?.user.roleCodes ?? [])
  if (roles.has('REGION_MANAGER')) return 'Bölge müdürü'
  if (roles.has('SUPER_ADMIN')) return 'Admin'
  if (roles.has('AUDITOR')) return 'Denetçi'
  return 'Rapor yetkisi'
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
