import type { TranslateFunction, TranslationKey } from '../localization/dictionary'
import { formatNumber as formatIntlNumber } from '../../lib/format'
import type { AppLocale } from '../../lib/i18n'
import { formatBenchmarkRatio, type PerformanceGrade } from './grading'
import {
  resolveKpiSourceSemantics,
  type KpiSourceKind,
} from './source-semantics'

export type KpiDisplayValue = number | string

type SourceTranslationNamespace = 'storeMe' | 'storeKpis'

type ScoreReferenceKeys = {
  target: TranslationKey
  turkeyAverage: TranslationKey
  checklistScore: TranslationKey
  default: TranslationKey
  pending: TranslationKey
  targetBenchmark?: TranslationKey
}

const supportedSourceKinds: KpiSourceKind[] = [
  'imported',
  'derived',
  'checklist_fed',
  'pending_normalization',
  'missing_reference',
  'missing',
]

export function toKpiDisplayNumber(input: KpiDisplayValue | null | undefined) {
  const parsed = Number(input)
  return Number.isFinite(parsed) ? parsed : 0
}

export function formatKpiNumber(locale: AppLocale, input: number) {
  return formatIntlNumber(input, locale, {
    minimumFractionDigits: Number.isInteger(input) ? 0 : 2,
    maximumFractionDigits: 2,
  })
}

export function formatKpiPercent(locale: AppLocale, input: number) {
  return `${formatKpiNumber(locale, input * 100)}%`
}

export function formatKpiMetricValue(
  locale: AppLocale,
  t: TranslateFunction,
  input: KpiDisplayValue | null,
  options: {
    noDataKey: TranslationKey
    code?: string
    percentMetricCodes?: string[]
  },
) {
  if (input === null) {
    return t(options.noDataKey)
  }

  const numericValue = toKpiDisplayNumber(input)
  const normalizedCode = options.code?.trim().toUpperCase()
  const percentCodes = options.percentMetricCodes ?? []

  if (normalizedCode && percentCodes.includes(normalizedCode)) {
    return formatKpiPercent(locale, numericValue)
  }

  return formatKpiNumber(locale, numericValue)
}

export function formatKpiAchievementValue(
  locale: AppLocale,
  t: TranslateFunction,
  input: {
    targetValue?: KpiDisplayValue | null
    achievementRate?: KpiDisplayValue | null
    actualValue: KpiDisplayValue | null
    scoreStatus?: string | null
  },
  keys: {
    missingReference: TranslationKey
    pendingNormalization: TranslationKey
    noData: TranslationKey
    scorePoints: TranslationKey
  },
) {
  if (input.scoreStatus === 'missing_reference') {
    return t(keys.missingReference)
  }

  if (input.achievementRate === null || input.achievementRate === undefined) {
    return input.actualValue !== null
      ? t(keys.pendingNormalization)
      : t(keys.noData)
  }

  if (input.targetValue !== null && input.targetValue !== undefined) {
    return formatKpiPercent(locale, toKpiDisplayNumber(input.achievementRate))
  }

  return t(keys.scorePoints, {
    value: formatKpiNumber(locale, toKpiDisplayNumber(input.achievementRate)),
  })
}

export function localizeKpiSourceSemantics(
  t: TranslateFunction,
  namespace: SourceTranslationNamespace,
  input: Parameters<typeof resolveKpiSourceSemantics>[0],
) {
  const semantics = resolveKpiSourceSemantics(input)
  const kind = supportedSourceKinds.includes(semantics.kind) ? semantics.kind : 'imported'

  return {
    ...semantics,
    label: t(`${namespace}.source.${kind}.label` as TranslationKey),
    summary: t(`${namespace}.source.${kind}.summary` as TranslationKey),
  }
}

export function resolveLocalizedKpiScoreReference<T extends KpiDisplayValue>(
  t: TranslateFunction,
  keys: ScoreReferenceKeys,
  input: {
    targetValue?: T | null
    benchmarkValue?: T | null
    benchmarkSource?: string | null
  },
) {
  if (input.benchmarkSource === 'TURKEY_AVERAGE') {
    return { value: hasReferenceValue(input.benchmarkValue) ? input.benchmarkValue : null, sourceLabel: t(keys.turkeyAverage) }
  }
  if (hasReferenceValue(input.targetValue)) {
    return {
      value: input.targetValue,
      sourceLabel: t(keys.target),
    }
  }

  if (hasReferenceValue(input.benchmarkValue)) {
    return {
      value: input.benchmarkValue,
      sourceLabel: formatReferenceSource(t, keys, input.benchmarkSource),
    }
  }

  return {
    value: null,
    sourceLabel: t(keys.pending),
  }
}

export function formatLocalizedPerformanceGrade(
  t: TranslateFunction,
  namespace: 'storeMe' | 'storeKpis',
  grade: PerformanceGrade,
) {
  return `${grade.emoji} ${grade.code} - ${t(`${namespace}.grade.${grade.code}` as TranslationKey)}`
}

export function describeLocalizedBenchmarkCap(
  t: TranslateFunction,
  messageKey: TranslationKey,
  input: {
    actualRatio?: number | null
    scoredRatio?: number | null
    isCapped?: boolean
  },
) {
  if (!input.isCapped || !input.actualRatio || !input.scoredRatio) {
    return null
  }

  return t(messageKey, {
    actual: formatBenchmarkRatio(input.actualRatio, 'prefix').replace('%', ''),
    scored: formatBenchmarkRatio(input.scoredRatio).replace('%', ''),
  })
}

function hasReferenceValue<T extends KpiDisplayValue>(
  input: T | null | undefined,
): input is T {
  return input !== null && input !== undefined && input !== ''
}

function formatReferenceSource(
  t: TranslateFunction,
  keys: ScoreReferenceKeys,
  input: string | null | undefined,
) {
  if (input === 'TURKEY_AVERAGE') {
    return t(keys.turkeyAverage)
  }

  if (input === 'CHECKLIST_SCORE') {
    return t(keys.checklistScore)
  }

  if (input === 'TARGET' && keys.targetBenchmark) {
    return t(keys.targetBenchmark)
  }

  return t(keys.default)
}
