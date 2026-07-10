import type { StoreMonthlyReportPackage } from '../features/reports/api'
import type { TranslateFunction, TranslationKey } from '../features/localization/dictionary'

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

const sectionFallbacks: Array<{ code: string; labelKey: TranslationKey }> = [
  { code: 'kpis', labelKey: 'storeReports.section.kpis' },
  { code: 'approval_scores', labelKey: 'storeReports.section.approvalScores' },
  { code: 'actions', labelKey: 'storeReports.section.actions' },
  { code: 'targets', labelKey: 'storeReports.section.targets' },
  { code: 'incentives', labelKey: 'storeReports.section.incentives' },
  { code: 'workforce', labelKey: 'storeReports.section.workforce' },
  { code: 'visits', labelKey: 'storeReports.section.visits' },
]

export function buildStoreReportsViewModel(
  summary: StoreMonthlyReportPackage | null,
  t: TranslateFunction,
  labels: { period?: string | undefined; coverage?: string | undefined } = {},
) {
  const sections = normalizeSections(summary, t)
  const readySections = sections.filter((section) => section.status === 'ready').length
  const periodLabel = labels.period ?? summary?.periodLabel ?? t('storeReports.periodFallback')
  const coverageLabel = labels.coverage ?? summary?.coverageLabel ?? t('storeReports.coverageFallback')
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
        label: t('storeReports.metric.periodPackage'),
        value: '1',
        copy: t('storeReports.metric.combinedExcel'),
        tone: 'plum',
      },
      {
        id: 'scope',
        label: t('storeReports.metric.scope'),
        value: String(sections.length),
        copy: t('storeReports.metric.processesTogether'),
        tone: 'cyan',
      },
      {
        id: 'detail-output',
        label: t('storeReports.metric.detailOutput'),
        value: String(readySections),
        copy: t('storeReports.metric.singleFile'),
        tone: 'mint',
      },
      {
        id: 'period-state',
        label: periodLabel,
        value: isReady ? t('storeReports.state.ready') : t('storeReports.state.waiting'),
        copy: storeCount > 0 && !isReady
          ? t('storeReports.state.reviewPending')
          : storeCount > 0
            ? t('storeReports.state.regionSummary')
            : t('storeReports.state.dataPending'),
        tone: 'amber',
      },
    ] satisfies StoreReportMetric[],
  }
}

function normalizeSections(
  summary: StoreMonthlyReportPackage | null,
  t: TranslateFunction,
): StoreReportSection[] {
  if (!summary?.sections?.length) {
    return sectionFallbacks.map((fallback) => ({
      code: fallback.code,
      label: t(fallback.labelKey),
      value: t('storeReports.state.dataPending'),
      status: 'missing',
    }))
  }

  const byCode = new Map(summary.sections.map((section) => [section.code, section]))

  return sectionFallbacks.map((fallback) => {
    const source = byCode.get(fallback.code)
    return {
      code: fallback.code,
      label: source?.label?.trim() || t(fallback.labelKey),
      value: source?.value?.trim() || t('storeReports.state.dataPending'),
      status: source?.status ?? 'missing',
    }
  })
}
