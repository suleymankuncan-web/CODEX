import { useState } from 'react'
import { Download, Sparkles, Trophy, UserRound } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useLocalization } from '../features/localization/useLocalization'
import { MonthYearPeriodPicker } from '../pages/store-month-year-period-picker'
import { StoreMyPerformanceKpiDialog } from './store-me-reference-kpi-dialog'
import { StoreMyPerformancePlumDashboard } from '../pages/store-my-performance-plum-dashboard'
import { StorePrototypeCommandShell } from './store-prototype-command-shell'
import './store-me-performance-share-card.css'

const monthLabels: Record<string, string> = {
  '2026-01': 'Ocak 2026',
  '2026-02': 'Şubat 2026',
  '2026-03': 'Mart 2026',
  '2026-04': 'Nisan 2026',
  '2026-05': 'Mayıs 2026',
}

const mockMetricCards = [
  {
    code: 'TARGET_ACHIEVEMENT',
    contributionValue: 30.4,
    delta: 'Hedef %100 · Önceki aya göre +8,4',
    displayValue: '%136',
    label: 'HG%',
    progressPercent: 136,
    regionPopulationLabel: '126 kişi içinde',
    regionRankLabel: '#6',
    statusLabel: 'Ortalama Üstü',
    storePopulationLabel: '4 kişi içinde',
    storeRankLabel: '#1',
    tone: 'hg',
    turkeyPopulationLabel: '842 kişi içinde',
    turkeyRankLabel: '#50',
    weightPercent: 40,
  },
  {
    code: 'UPT',
    contributionValue: 14.2,
    delta: 'TR ort. 2,90 · Önceki aya göre -0,18',
    displayValue: '3,42',
    label: 'UPT',
    progressPercent: 118,
    regionPopulationLabel: '126 kişi içinde',
    regionRankLabel: '#18',
    statusLabel: 'TR ort. üstü',
    storePopulationLabel: '4 kişi içinde',
    storeRankLabel: '#2',
    tone: 'upt',
    turkeyPopulationLabel: '842 kişi içinde',
    turkeyRankLabel: '#67',
    weightPercent: 20,
  },
  {
    code: 'ATV',
    contributionValue: 18.6,
    delta: 'TR ort. 3.000 TL · Önceki aya göre -5,4',
    displayValue: '5.400 TL',
    label: 'ATV',
    progressPercent: 180,
    regionPopulationLabel: '126 kişi içinde',
    regionRankLabel: '#12',
    statusLabel: 'TR ort. üstü',
    storePopulationLabel: '4 kişi içinde',
    storeRankLabel: '#1',
    tone: 'atv',
    turkeyPopulationLabel: '842 kişi içinde',
    turkeyRankLabel: '#42',
    weightPercent: 25,
  },
]

const mockMonthlyRows = [
  {
    atvLabel: '4.120 TL',
    key: '2026-01-01',
    label: 'Ocak 2026',
    periodNote: '1 Ocak 2026 - 31 Ocak 2026',
    scoreLabel: '64,0',
    scoreValue: 64,
    targetLabel: '%104',
    trendLabel: null,
    trendWidth: '64%',
    uptLabel: '2,74',
  },
  {
    atvLabel: '4.480 TL',
    key: '2026-02-01',
    label: 'Şubat 2026',
    periodNote: '1 Şubat 2026 - 28 Şubat 2026',
    scoreLabel: '67,0',
    scoreValue: 67,
    targetLabel: '%109',
    trendLabel: '+4,7%',
    trendWidth: '67%',
    uptLabel: '2,91',
  },
  {
    atvLabel: '4.910 TL',
    key: '2026-03-01',
    label: 'Mart 2026',
    periodNote: '1 Mart 2026 - 31 Mart 2026',
    scoreLabel: '70,0',
    scoreValue: 70,
    targetLabel: '%121',
    trendLabel: '+4,5%',
    trendWidth: '70%',
    uptLabel: '3,08',
  },
  {
    atvLabel: '5.720 TL',
    key: '2026-04-01',
    label: 'Nisan 2026',
    periodNote: '1 Nisan 2026 - 30 Nisan 2026',
    scoreLabel: '69,0',
    scoreValue: 69,
    targetLabel: '%128',
    trendLabel: '-1,4%',
    trendWidth: '69%',
    uptLabel: '3,60',
  },
  {
    atvLabel: '5.400 TL',
    key: '2026-05-01',
    label: 'Mayıs 2026',
    periodNote: 'Seçili dönem',
    scoreLabel: '72,0',
    scoreValue: 72,
    targetLabel: '%136',
    trendLabel: '+4,3%',
    trendWidth: '72%',
    uptLabel: '3,42',
  },
]

const mockTodayActions = [
  {
    badge: 'Takip',
    copy: 'ATV ortalamanın üstünde; ancak önceki aya göre geriledi. Sepet ritmini kaybetmemeye odaklan.',
    icon: 'metric' as const,
    id: 'atv-regression',
    title: 'ATV düşüşünü izle',
    variant: 'outline' as const,
  },
]

function StoreMeCompactHeader(input: {
  locale: ReturnType<typeof useLocalization>['locale']
  onOpenShareCard: () => void
  selectedMonth: string
  onSelectMonth: (value: string) => void
}) {
  return (
    <header className="tw:flex tw:flex-col tw:gap-3 tw:rounded-xl tw:border tw:border-border/70 tw:bg-card/90 tw:p-4 tw:shadow-sm tw:md:flex-row tw:md:items-center tw:md:justify-between">
      <div className="tw:flex tw:min-w-0 tw:items-center tw:gap-3">
        <span
          className="tw:inline-flex tw:size-11 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-xl tw:bg-violet-100 tw:text-violet-700"
          aria-hidden="true"
        >
          <UserRound size={20} />
        </span>
        <div className="tw:min-w-0">
          <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
            <h1 className="tw:m-0 tw:text-xl tw:font-medium tw:leading-tight tw:text-foreground">
              Süleyman Öztürk
            </h1>
            <Badge variant="secondary">Mağaza personeli</Badge>
          </div>
          <p className="tw:m-0 tw:mt-1 tw:text-sm tw:text-muted-foreground">
            Mall of İstanbul · Satış danışmanı
          </p>
        </div>
      </div>

      <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
        <Button
          className="tw:bg-gradient-to-r tw:from-violet-600 tw:to-cyan-600 tw:text-white tw:shadow-lg tw:shadow-violet-500/20 hover:tw:from-violet-700 hover:tw:to-cyan-700"
          type="button"
          onClick={input.onOpenShareCard}
        >
          <Sparkles data-icon="inline-start" />
          Performans Kartı Oluştur
        </Button>
        <MonthYearPeriodPicker
          ariaLabel="Dönem seç"
          availableValues={Object.keys(monthLabels)}
          locale={input.locale}
          onValueChange={input.onSelectMonth}
          title="Dönem seç"
          triggerClassName="tw:w-fit tw:justify-between"
          value={input.selectedMonth}
        />
      </div>
    </header>
  )
}

function StoreMePerformanceShareCardDialog(input: {
  isOpen: boolean
  onClose: () => void
  selectedMonth: string
}) {
  const [downloadStatus, setDownloadStatus] = useState('')
  const selectedPeriod = monthLabels[input.selectedMonth] ?? 'Mayıs 2026'

  function handleMockDownload() {
    setDownloadStatus('Performans kartı hazırlandı.')
    window.setTimeout(() => setDownloadStatus(''), 2200)
  }

  return (
    <Dialog
      open={input.isOpen}
      onOpenChange={(open) => {
        if (!open) {
          input.onClose()
        }
      }}
    >
      <DialogContent
        closeLabel="Performans kartını kapat"
        className="tw:max-h-[min(56rem,calc(100vh-2rem))] tw:w-[calc(100vw-2rem)] tw:max-w-[34rem] tw:overflow-auto tw:p-0 tw:sm:max-w-[34rem]"
      >
        <div className="store-me-share-card-dialog">
          <DialogHeader className="store-me-share-card-head">
            <DialogTitle>Performans Kartı Oluştur</DialogTitle>
          </DialogHeader>

          <section className="store-me-share-card-stage" aria-label="Performans kartı önizleme">
            <article
              className="store-me-performance-share-card"
              aria-label={`Ayşe Yılmaz için ${selectedPeriod} performans kartı`}
            >
              <div className="store-me-performance-share-card__inner">
                <div className="store-me-performance-share-card__top">
                  <div>
                    <strong>LUFIAN</strong>
                    <span>LUFIAN PERFORMANS KARTI</span>
                  </div>
                  <span>{selectedPeriod}</span>
                </div>

                <div className="store-me-performance-share-card__score" aria-label="Performans skoru 87">
                  <span>SKOR</span>
                  <strong>87</strong>
                </div>

                <Badge className="store-me-performance-share-card__badge">
                  <Trophy aria-hidden="true" />
                  MAĞAZA LİDERİ
                </Badge>

                <div className="store-me-performance-share-card__person">
                  <strong>Ayşe Yılmaz</strong>
                  <span>İstanbul Akasya</span>
                </div>

                <div className="store-me-performance-share-card__rank">
                  <span className="store-me-performance-share-card__rank-icon" aria-hidden="true">
                    <Trophy size={22} />
                  </span>
                  <div>
                    <span>TÜRKİYE SIRALAMASI</span>
                    <strong>#24 / 842</strong>
                    <small>İlk %3</small>
                  </div>
                </div>
              </div>
            </article>
          </section>

          <div className="store-me-share-card-actions">
            <Button type="button" onClick={handleMockDownload}>
              <Download data-icon="inline-start" />
              PNG indir
            </Button>
            <Button type="button" variant="outline" onClick={input.onClose}>
              Kapat
            </Button>
            {downloadStatus ? <p role="status">{downloadStatus}</p> : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function StoreMeProductMirrorSurface() {
  const { locale, t } = useLocalization()
  const [selectedMonth, setSelectedMonth] = useState('2026-05')
  const [isKpiDetailOpen, setKpiDetailOpen] = useState(false)
  const [isShareCardOpen, setShareCardOpen] = useState(false)

  return (
    <>
      <section
        className="store-me-plum-page tw:min-h-screen tw:text-foreground"
        data-testid="store-me-page"
        aria-label={t('storeMe.title')}
      >
        <main className="store-me-plum-content tw:min-w-0">
          <section className="tw:mx-auto tw:grid tw:max-w-7xl tw:gap-4" aria-label={t('storeMe.title')}>
            <StoreMeCompactHeader
              locale={locale}
              onOpenShareCard={() => setShareCardOpen(true)}
              selectedMonth={selectedMonth}
              onSelectMonth={setSelectedMonth}
            />

            <StoreMyPerformancePlumDashboard
              locale="tr"
              actualSalesLabel="2.180.400 TL"
              gradeLabel="B - İyi"
              isPartial={false}
              metricCards={mockMetricCards}
              monthlyDetailRows={mockMonthlyRows}
              onOpenKpiDetails={() => setKpiDetailOpen(true)}
              remainingTargetLabel="0 TL"
              samePeriodScoreDelta="+4,3%"
              scoreConfidence="TR ort. 68 puan · Önceki ay sıralaması #75"
              scoreValue={72}
              regionPopulationLabel="126 kişi içinde"
              regionRankLabel="#18"
              storePopulationLabel="4 kişi içinde"
              storeRankLabel="#2"
              t={t}
              targetProgressPercent={136}
              targetSalesLabel="1.500.000 TL"
              targetStatusLabel={t('storeMe.approvedTarget')}
              todayActions={mockTodayActions}
              turkeyPopulationLabel="842 kişi içinde"
              turkeyRankLabel="#50"
            />
          </section>
        </main>
      </section>

      <StoreMyPerformanceKpiDialog
        employeeName="Süleyman Öztürk"
        isOpen={isKpiDetailOpen}
        monthlyDetailRows={mockMonthlyRows}
        onClose={() => setKpiDetailOpen(false)}
        t={t}
      />

      <StoreMePerformanceShareCardDialog
        isOpen={isShareCardOpen}
        onClose={() => setShareCardOpen(false)}
        selectedMonth={selectedMonth}
      />
    </>
  )
}

export function StoreMeReferenceV1Prototype() {
  return (
    <StorePrototypeCommandShell
      activePath="/store/me"
      identityLabel="Süleyman Öztürk"
      personaLabel="Mağaza personeli"
      subtitle="Performans özeti"
    >
      <StoreMeProductMirrorSurface />
    </StorePrototypeCommandShell>
  )
}
