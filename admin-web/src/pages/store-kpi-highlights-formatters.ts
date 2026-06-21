import type { TranslateFunction, TranslationKey } from '../features/localization/dictionary'
import type { KpiOwnerRole } from '../features/reports/api'
import { formatState } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import {
  type PerformanceGrade,
  type PerformanceGradeCode,
} from '../features/kpi/grading'
import {
  describeLocalizedBenchmarkCap as describeSharedBenchmarkCap,
  formatKpiAchievementValue,
  formatKpiMetricValue,
  formatKpiNumber as formatMetric,
  formatLocalizedPerformanceGrade,
  localizeKpiSourceSemantics,
  resolveLocalizedKpiScoreReference as resolveSharedKpiScoreReference,
} from '../features/kpi/display'
import type { DisplayKpiRow } from './store-kpi-highlights-model'

const metricLabelKeyByCode: Record<string, TranslationKey> = {
  TARGET_ACHIEVEMENT: 'storeKpis.metric.targetAchievement',
  ATV: 'storeKpis.metric.atv',
  UPT: 'storeKpis.metric.upt',
  CR: 'storeKpis.metric.cr',
  gsm_approval: 'storeKpis.metric.gsmOnay',
  BM_CHECKLIST: 'storeKpis.metric.bmChecklist',
  VM_CHECKLIST: 'storeKpis.metric.vmChecklist',
}

const ownerRoleLabelKeyByCode: Record<KpiOwnerRole, TranslationKey> = {
  DEPUTY_GM: 'storeKpis.role.DEPUTY_GM',
  REGION_MANAGER: 'storeKpis.role.REGION_MANAGER',
  STORE_MANAGER: 'storeKpis.role.STORE_MANAGER',
  STORE_PERSONNEL: 'storeKpis.role.STORE_PERSONNEL',
  VISUAL_TEAM: 'storeKpis.role.VISUAL_TEAM',
}

function formatCoveredWeight(input: number) {
  if (!Number.isFinite(input)) {
    return '0'
  }

  return Number.isInteger(input) ? String(input) : input.toFixed(1)
}

export function formatChecklistStatus(t: TranslateFunction, input: {
  label: 'BM' | 'VM'
  included: boolean
  visitCount: number
}) {
  if (input.included) {
    return input.visitCount === 1
      ? t('storeKpis.checklist.singleDone', { label: input.label })
      : t('storeKpis.checklist.manyDone', {
          count: input.visitCount,
          label: input.label,
        })
  }

  return t('storeKpis.checklist.notIncluded', { label: input.label })
}

export function formatChecklistContribution(locale: AppLocale, t: TranslateFunction, input: {
  label: 'BM' | 'VM'
  contribution: number | null
}) {
  if (input.contribution !== null && input.contribution !== undefined) {
    return t('storeKpis.checklist.contribution', {
      label: input.label,
      value: formatMetric(locale, input.contribution),
    })
  }

  return t('storeKpis.noContribution')
}

export function formatChecklistMissingNote(t: TranslateFunction, input: {
  label: 'BM' | 'VM'
  included: boolean
}) {
  return input.included ? null : t('storeKpis.checklist.shareStayed', { label: input.label })
}

export function formatStatusBand(t: TranslateFunction, input: string | null) {
  switch (input) {
    case 'exceeded':
      return t('storeKpis.status.exceeded')
    case 'on_track':
      return t('storeKpis.status.on_track')
    case 'at_risk':
      return t('storeKpis.status.at_risk')
    case 'off_track':
      return t('storeKpis.status.off_track')
    default:
      return t('storeKpis.status.default')
  }
}

export function formatScoreProfileTitle(t: TranslateFunction, input: string | undefined) {
  switch (input) {
    case 'Store Score':
      return t('storeKpis.storeScoreProfile')
    case 'Personnel Score':
      return t('storeKpis.personnelScoreProfile')
    case undefined:
      return t('storeKpis.noProfile')
    default:
      return input
  }
}

export function formatScoreBehavior(t: TranslateFunction, input: string) {
  switch (input) {
    case 'score_only':
      return t('storeKpis.scoreBehavior.score_only')
    case 'warning_first':
      return t('storeKpis.scoreBehavior.warning_first')
    case 'task_candidate':
      return t('storeKpis.scoreBehavior.task_candidate')
    default:
      return formatState(input)
  }
}

export function formatContributionTarget(t: TranslateFunction, input: 'store' | 'personnel') {
  return input === 'store'
    ? t('storeKpis.storeContributionTarget')
    : t('storeKpis.personnelContributionTarget')
}

export function formatOwnerRole(t: TranslateFunction, role: KpiOwnerRole) {
  return t(ownerRoleLabelKeyByCode[role])
}

export function formatMetricValue(locale: AppLocale, t: TranslateFunction, input: string | null, kpiCode?: string) {
  if (kpiCode?.trim().toLowerCase() === 'gsm_approval' || kpiCode?.trim().toUpperCase() === 'GSM_ONAY') {
    const value = input === null ? null : Number(input)

    return value === null || !Number.isFinite(value)
      ? t('storeKpis.noData')
      : `%${formatMetric(locale, value)}`
  }

  return formatKpiMetricValue(locale, t, input, {
    noDataKey: 'storeKpis.noData',
    ...(kpiCode === undefined ? {} : { code: kpiCode }),
    percentMetricCodes: ['CR'],
  })
}

export function formatAchievementValue(locale: AppLocale, t: TranslateFunction, row: DisplayKpiRow) {
  return formatKpiAchievementValue(locale, t, row, {
    missingReference: 'storeKpis.missingReference',
    pendingNormalization: 'storeKpis.pendingNormalizationStatus',
    noData: 'storeKpis.noData',
    scorePoints: 'storeKpis.scorePoints',
  })
}

export function formatKpiMetricLabel(t: TranslateFunction, code: string, fallback: string) {
  const key = metricLabelKeyByCode[code.trim().toUpperCase()]
  return key ? t(key) : fallback
}

export function formatMetricLabelList(
  t: TranslateFunction,
  codes: string[],
  labels: string[],
) {
  const source = codes.length > 0 ? codes : labels
  return source
    .map((value, index) =>
      codes.length > 0
        ? formatKpiMetricLabel(t, value, labels[index] ?? value)
        : value,
    )
    .join(', ')
}

export function resolveLocalizedKpiSourceSemantics(
  t: TranslateFunction,
  input: Parameters<typeof localizeKpiSourceSemantics>[2],
) {
  return localizeKpiSourceSemantics(t, 'storeKpis', input)
}

export function resolveLocalizedKpiScoreReference<T extends number | string>(
  t: TranslateFunction,
  input: {
    targetValue?: T | null
    benchmarkValue?: T | null
    benchmarkSource?: string | null
  },
) {
  return resolveSharedKpiScoreReference(t, {
    target: 'storeKpis.reference.target',
    turkeyAverage: 'storeKpis.reference.turkeyAverage',
    checklistScore: 'storeKpis.reference.checklistScore',
    default: 'storeKpis.reference.default',
    pending: 'storeKpis.reference.pending',
    targetBenchmark: 'storeKpis.reference.target',
  }, input)
}

export function formatStorePerformanceGrade(t: TranslateFunction, grade: PerformanceGrade) {
  return formatLocalizedPerformanceGrade(t, 'storeKpis', grade)
}

export function resolveLocalizedStoreScoreMeaning(input: {
  t: TranslateFunction
  grade: PerformanceGrade
  coveredWeight: number
  missingWeight: number
  matchedMetrics: number
  totalMetrics: number
}) {
  const code = input.grade.code as PerformanceGradeCode
  const covered = formatCoveredWeight(input.coveredWeight)
  const missing = formatCoveredWeight(input.missingWeight)
  const confidence =
    input.missingWeight > 0 || input.matchedMetrics < input.totalMetrics
      ? input.t('storeKpis.confidence.partial', { covered, missing })
      : input.t('storeKpis.confidence.full', { covered })

  return {
    title: input.t(`storeKpis.meaning.${code}.title` as TranslationKey),
    summary: input.t(`storeKpis.meaning.${code}.summary` as TranslationKey),
    action: input.t(`storeKpis.meaning.${code}.action` as TranslationKey),
    confidence,
    tone: code === 'A' || code === 'B'
      ? input.missingWeight > 0
        ? 'warning'
        : input.grade.tone
      : code === 'C'
        ? 'warning'
        : 'danger',
  } as const
}

export function describeLocalizedBenchmarkCap(
  t: TranslateFunction,
  input: {
    actualRatio: number | null | undefined
    scoredRatio: number | null | undefined
    isCapped: boolean | undefined
  },
) {
  return describeSharedBenchmarkCap(t, 'storeKpis.benchmarkCap', {
    ...(input.actualRatio === undefined ? {} : { actualRatio: input.actualRatio }),
    ...(input.scoredRatio === undefined ? {} : { scoredRatio: input.scoredRatio }),
    ...(input.isCapped === undefined ? {} : { isCapped: input.isCapped }),
  })
}
