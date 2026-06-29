import type { StoreMonthlyReportPackage } from '../features/reports/api'

export type StoreReportMetricTone = 'plum' | 'cyan' | 'mint' | 'amber'

export type StoreReportMetric = {
  id: string
  label: string
  value: string
  copy: string
  tone: StoreReportMetricTone
}

export type StoreReportSection = {
  code: string
  label: string
  value: string
  status: 'ready' | 'partial'
}

const sectionFallbacks: StoreReportSection[] = [
  { code: 'kpis', label: 'KPI kolonları', value: 'Skor, UPT, ATV, CR, HG%', status: 'ready' },
  { code: 'approval_scores', label: 'Onay skorları', value: 'GSM, BM Checklist, VM Checklist', status: 'ready' },
  { code: 'actions', label: 'Aksiyon durumu', value: 'Bitirildi, devam ediyor, bekliyor', status: 'ready' },
  { code: 'targets', label: 'Hedefler', value: 'Mağaza ve personel hedef durumu', status: 'ready' },
  { code: 'incentives', label: 'Primler', value: 'Hakediş ve kontrol durumu', status: 'ready' },
  { code: 'workforce', label: 'Norm Kadro', value: 'Aktif, norm, eksik gün, turnover', status: 'ready' },
  { code: 'visits', label: 'Ziyaret', value: 'Son ziyaret ve geçen gün', status: 'ready' },
]

export function buildStoreReportsViewModel(summary: StoreMonthlyReportPackage | null) {
  const sections = normalizeSections(summary)
  const readySections = sections.filter((section) => section.status === 'ready').length
  const periodLabel = summary?.periodLabel ?? 'Dönem seç'
  const coverageLabel = summary?.coverageLabel ?? 'Dönem kapsamı'
  const storeCount = summary?.storeCount ?? 0
  const isReady = storeCount > 0 || readySections > 0

  return {
    periodLabel,
    coverageLabel,
    storeCount,
    sections,
    metrics: [
      {
        id: 'period-package',
        label: 'Dönem paketi',
        value: '1',
        copy: 'Birleşik Excel',
        tone: 'plum',
      },
      {
        id: 'scope',
        label: 'Kapsam',
        value: String(sections.length),
        copy: 'Süreç birlikte',
        tone: 'cyan',
      },
      {
        id: 'detail-output',
        label: 'Detay çıktı',
        value: String(readySections),
        copy: 'Tek dosyada',
        tone: 'mint',
      },
      {
        id: 'period-state',
        label: periodLabel,
        value: isReady ? 'Hazır' : 'Bekliyor',
        copy: storeCount > 0 ? 'Bölge özeti' : 'Veri bekleniyor',
        tone: 'amber',
      },
    ] satisfies StoreReportMetric[],
  }
}

function normalizeSections(summary: StoreMonthlyReportPackage | null): StoreReportSection[] {
  if (!summary?.sections?.length) return sectionFallbacks

  const byCode = new Map(summary.sections.map((section) => [section.code, section]))

  return sectionFallbacks.map((fallback) => {
    const source = byCode.get(fallback.code)
    return {
      code: fallback.code,
      label: source?.label?.trim() || fallback.label,
      value: source?.value?.trim() || fallback.value,
      status: source?.status ?? fallback.status,
    }
  })
}
