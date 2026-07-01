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
  status: 'ready' | 'partial' | 'missing'
}

const sectionFallbacks: StoreReportSection[] = [
  { code: 'kpis', label: 'KPI kolonları', value: 'Veri bekleniyor', status: 'missing' },
  { code: 'approval_scores', label: 'Onay skorları', value: 'Veri bekleniyor', status: 'missing' },
  { code: 'actions', label: 'Aksiyon durumu', value: 'Veri bekleniyor', status: 'missing' },
  { code: 'targets', label: 'Hedefler', value: 'Veri bekleniyor', status: 'missing' },
  { code: 'incentives', label: 'Primler', value: 'Veri bekleniyor', status: 'missing' },
  { code: 'workforce', label: 'Norm Kadro', value: 'Veri bekleniyor', status: 'missing' },
  { code: 'visits', label: 'Ziyaret', value: 'Veri bekleniyor', status: 'missing' },
]

export function buildStoreReportsViewModel(summary: StoreMonthlyReportPackage | null) {
  const sections = normalizeSections(summary)
  const readySections = sections.filter((section) => section.status === 'ready').length
  const periodLabel = summary?.periodLabel ?? 'Dönem seç'
  const coverageLabel = summary?.coverageLabel ?? 'Dönem kapsamı'
  const storeCount = summary?.storeCount ?? 0
  const isReady = sections.length > 0 && readySections === sections.length

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
        copy: storeCount > 0 && !isReady ? 'Kontrol bekliyor' : storeCount > 0 ? 'Bölge özeti' : 'Veri bekleniyor',
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
      status: source?.status ?? 'missing',
    }
  })
}
