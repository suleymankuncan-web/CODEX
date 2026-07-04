import { useMemo, type Dispatch } from 'react'
import type { TranslateFunction, TranslationKey } from '../features/localization/dictionary'
import { formatKpiMetricValue } from '../features/kpi/display'
import { type PerformanceGradeCode, resolvePerformanceGrade } from '../features/kpi/grading'
import type { MyPerformanceMetric, MyPerformanceSummary, ReportingSnapshotRun } from '../features/reports/api'
import { formatSnapshotOptionLabel } from '../features/reports/snapshot-labels'
import { formatDate } from '../lib/format'
import { getIntlLocale, type AppLocale } from '../lib/i18n'
import { buildStoreMyPerformanceTodayActions } from './store-my-performance-actions'
import { buildStoreMeShareCardViewModel } from './store-me-share-card-model'
import { formatPopulation, formatRank, formatRegionRankLabels } from './store-my-performance-rank-labels'

export type LivePeriodType = 'monthly' | 'daily'
export type StorePerformanceSourceMode = 'live' | 'closed'
export type StoreProfileMode = 'self' | 'personnel'

export type StoreMyPerformancePageState = {
  sourceMode: StorePerformanceSourceMode
  selectedLivePeriodType: LivePeriodType
  selectedLivePeriodStart: string
  selectedLiveYears: string[]
  selectedLiveMonthKeys: string[]
  selectedLiveDayStarts: string[]
  selectedClosedSnapshotRunId: string
  isDateFilterOpen: boolean
  isKpiDetailOpen: boolean
}

export type StoreMyPerformancePageStateInput = {
  initialLivePeriodStart?: string
  initialLivePeriodType?: LivePeriodType
}

export type StoreMyPerformancePageAction =
  | { type: 'applyLivePeriodFallback'; periodType: LivePeriodType | null; periodStart: string }
  | { type: 'changeLivePeriodType'; periodType: LivePeriodType; periodStart: string }
  | { type: 'setLiveYearSelection'; years: string[]; periodStart: string }
  | { type: 'setLiveMonthSelection'; monthKeys: string[]; periodStart: string }
  | { type: 'setLiveDaySelection'; dayStarts: string[]; periodStart: string }
  | { type: 'toggleDateFilter' }
  | { type: 'setSourceMode'; mode: StorePerformanceSourceMode }
  | { type: 'setClosedSnapshotRunId'; snapshotRunId: string }
  | { type: 'setKpiDetailOpen'; open: boolean }

type LivePeriodOption = MyPerformanceSummary['availablePeriods'][number]

const personnelMetricCodes = ['TARGET_ACHIEVEMENT', 'ATV', 'UPT']
const currencyFormatters: Record<AppLocale, Intl.NumberFormat> = {
  tr: new Intl.NumberFormat(getIntlLocale('tr'), {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }),
  en: new Intl.NumberFormat(getIntlLocale('en'), {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }),
}
const monthYearFormatters: Record<AppLocale, Intl.DateTimeFormat> = {
  tr: new Intl.DateTimeFormat(getIntlLocale('tr'), {
    month: 'long',
    year: 'numeric',
  }),
  en: new Intl.DateTimeFormat(getIntlLocale('en'), {
    month: 'long',
    year: 'numeric',
  }),
}
const signedPercentFormatters: Record<AppLocale, Intl.NumberFormat> = {
  tr: new Intl.NumberFormat(getIntlLocale('tr'), {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
    signDisplay: 'always',
  }),
  en: new Intl.NumberFormat(getIntlLocale('en'), {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
    signDisplay: 'always',
  }),
}

export function createStoreMyPerformancePageState(
  input: StoreMyPerformancePageStateInput,
): StoreMyPerformancePageState {
  return {
    sourceMode: 'live',
    selectedLivePeriodType: input.initialLivePeriodType ?? 'monthly',
    selectedLivePeriodStart: input.initialLivePeriodStart?.trim() ?? '',
    selectedLiveYears: [],
    selectedLiveMonthKeys: [],
    selectedLiveDayStarts: [],
    selectedClosedSnapshotRunId: '',
    isDateFilterOpen: false,
    isKpiDetailOpen: false,
  }
}

export function storeMyPerformancePageReducer(
  state: StoreMyPerformancePageState,
  action: StoreMyPerformancePageAction,
): StoreMyPerformancePageState {
  switch (action.type) {
    case 'applyLivePeriodFallback':
      return {
        ...state,
        selectedLivePeriodType: action.periodType ?? state.selectedLivePeriodType,
        selectedLivePeriodStart: action.periodStart,
      }
    case 'changeLivePeriodType':
      return {
        ...state,
        selectedLivePeriodType: action.periodType,
        selectedLivePeriodStart: action.periodStart,
      }
    case 'setLiveYearSelection':
      return {
        ...state,
        selectedLiveYears: action.years,
        selectedLivePeriodStart: action.periodStart,
      }
    case 'setLiveMonthSelection':
      return {
        ...state,
        selectedLiveMonthKeys: action.monthKeys,
        selectedLivePeriodStart: action.periodStart,
      }
    case 'setLiveDaySelection':
      return {
        ...state,
        selectedLivePeriodType: 'daily',
        selectedLiveDayStarts: action.dayStarts,
        selectedLivePeriodStart: action.periodStart,
      }
    case 'toggleDateFilter':
      return { ...state, isDateFilterOpen: !state.isDateFilterOpen }
    case 'setSourceMode':
      return { ...state, sourceMode: action.mode }
    case 'setClosedSnapshotRunId':
      return { ...state, selectedClosedSnapshotRunId: action.snapshotRunId }
    case 'setKpiDetailOpen':
      return { ...state, isKpiDetailOpen: action.open }
    default:
      return state
  }
}

function formatCurrency(locale: AppLocale, t: TranslateFunction, input: number | null) {
  if (input === null) {
    return t('storeMe.noData')
  }

  return currencyFormatters[locale].format(input)
}

function formatSourceMode(t: TranslateFunction, mode: string) {
  return mode === 'closed' ? t('storeMe.closedDay') : t('storeMe.livePeriod')
}

function formatPeriodLabel(
  locale: AppLocale,
  t: TranslateFunction,
  input: {
    period?: { periodStart: string; periodEnd: string } | null
    snapshotDate?: string | null
  },
) {
  if (input.period) {
    return `${formatDate(input.period.periodStart, locale)} - ${formatDate(
      input.period.periodEnd,
      locale,
    )}`
  }

  if (input.snapshotDate) {
    return formatDate(input.snapshotDate, locale)
  }

  return t('storeMe.currentPeriod')
}

function resolveLocalizedScoreMeaning(input: {
  t: TranslateFunction
  gradeCode: PerformanceGradeCode
  matchedMetrics: number
  totalMetrics: number
  isPartial: boolean
  tone: ReturnType<typeof resolvePerformanceGrade>['tone']
}) {
  const baseKey = `storeMe.meaning.${input.gradeCode}` as const

  return {
    title: input.t(`${baseKey}.title` as TranslationKey),
    summary: input.t(`${baseKey}.summary` as TranslationKey),
    focus: input.t(`${baseKey}.focus` as TranslationKey),
    confidence: input.t(
      input.isPartial ? 'storeMe.confidence.partial' : 'storeMe.confidence.full',
      {
        matched: input.matchedMetrics,
        total: input.totalMetrics,
      },
    ),
    tone: input.isPartial ? 'warning' : input.gradeCode === 'C' ? 'warning' : input.tone,
  }
}

function isPersonnelMetric(metric: { code: string }) {
  return personnelMetricCodes.includes(metric.code)
}

function findMetric(metrics: MyPerformanceMetric[], code: string) {
  return metrics.find((metric) => metric.code === code) ?? null
}

function getFiniteMetricNumber(input: number | null | undefined) {
  return typeof input === 'number' && Number.isFinite(input) ? input : null
}

function getTargetAchievementRate(metric: MyPerformanceMetric | null) {
  return getFiniteMetricNumber(metric?.achievementRate) ?? getFiniteMetricNumber(metric?.actualRatio)
}

function getMetricDisplayValue(
  locale: AppLocale,
  t: TranslateFunction,
  metrics: MyPerformanceMetric[],
  code: string,
) {
  const metric = findMetric(metrics, code)

  if (code === 'TARGET_ACHIEVEMENT') {
    const achievementRate = getTargetAchievementRate(metric)
    if (
      achievementRate === null &&
      (metric?.scoreStatus === 'missing_reference' || metric?.scoreStatus === 'pending_normalization')
    ) {
      return t('storeMe.missingReference')
    }

    return formatKpiMetricValue(locale, t, achievementRate, {
      noDataKey: 'storeMe.noData',
      code,
      percentMetricCodes: ['TARGET_ACHIEVEMENT'],
    })
  }

  return formatKpiMetricValue(locale, t, metric?.actualValue ?? null, {
    noDataKey: 'storeMe.noData',
    code,
    percentMetricCodes: ['TARGET_ACHIEVEMENT'],
  })
}

function getMetricNumericValue(metrics: MyPerformanceMetric[], code: string) {
  const metric = findMetric(metrics, code)
  if (code === 'TARGET_ACHIEVEMENT') {
    return getTargetAchievementRate(metric)
  }

  return getFiniteMetricNumber(metric?.actualValue)
}

function getTargetProgressPercent(metrics: MyPerformanceMetric[]) {
  const targetMetric = findMetric(metrics, 'TARGET_ACHIEVEMENT')
  const source = getTargetAchievementRate(targetMetric)

  if (typeof source !== 'number' || !Number.isFinite(source)) {
    return 0
  }

  return Math.max(0, Math.round(source * 100))
}

export function getPeriodDateKey(input: string | null | undefined) {
  const match = input?.trim().match(/^(\d{4}-\d{2}-\d{2})/)
  return match?.[1] ?? ''
}

function getPeriodYear(input: string | null | undefined) {
  return getPeriodDateKey(input).slice(0, 4)
}

function getPeriodMonthKey(input: string | null | undefined) {
  return getPeriodDateKey(input).slice(0, 7)
}

function comparePeriodStart(left: string, right: string) {
  const leftKey = getPeriodDateKey(left) || left
  const rightKey = getPeriodDateKey(right) || right
  return leftKey.localeCompare(rightKey)
}

function getLatestAvailablePeriodStart(periods: Array<{ periodStart: string }>) {
  const latestPeriod = periods
    .toSorted((left, right) => comparePeriodStart(left.periodStart, right.periodStart))
    .at(-1)

  return getPeriodDateKey(latestPeriod?.periodStart) || latestPeriod?.periodStart || ''
}

function getLivePeriodOptionKey(period: { periodStart: string }) {
  return getPeriodDateKey(period.periodStart) || period.periodStart
}

function formatLivePeriodOptionLabel(
  locale: AppLocale,
  period: { periodType: string; periodStart: string; periodEnd: string },
) {
  const start = formatDate(period.periodStart, locale)
  const end = formatDate(period.periodEnd, locale)

  if (period.periodType === 'daily' || getPeriodDateKey(period.periodStart) === getPeriodDateKey(period.periodEnd)) {
    return start
  }

  return `${start} - ${end}`
}

function isSamePeriodStart(left: string | null | undefined, right: string | null | undefined) {
  const leftKey = getPeriodDateKey(left)
  const rightKey = getPeriodDateKey(right)
  return leftKey !== '' && leftKey === rightKey
}

function formatMonthYear(locale: AppLocale, t: TranslateFunction, input: string) {
  const dateKey = getPeriodDateKey(input)

  if (!dateKey) {
    return t('storeMe.currentPeriod')
  }

  return monthYearFormatters[locale].format(new Date(`${dateKey}T00:00:00`))
}

function formatMonthKeyLabel(locale: AppLocale, t: TranslateFunction, monthKey: string) {
  return formatMonthYear(locale, t, `${monthKey}-01`)
}

function getAvailableLivePeriods(input: {
  performance: MyPerformanceSummary | undefined
  selectedPeriodType: LivePeriodType
}) {
  const periodMap = new Map<string, MyPerformanceSummary['availablePeriods'][number]>()

  const addPeriod = (period: MyPerformanceSummary['availablePeriods'][number]) => {
    if (period.periodType !== 'monthly' && period.periodType !== 'daily') {
      return
    }

    const periodStart = getPeriodDateKey(period.periodStart) || period.periodStart
    const periodEnd = getPeriodDateKey(period.periodEnd) || period.periodEnd

    if (!periodStart || !periodEnd) {
      return
    }

    periodMap.set(`${period.periodType}:${periodStart}`, {
      ...period,
      periodStart,
      periodEnd,
    })
  }

  input.performance?.availablePeriods.forEach(addPeriod)

  if (input.performance?.period) {
    addPeriod({
      periodType: input.selectedPeriodType,
      periodStart: input.performance.period.periodStart,
      periodEnd: input.performance.period.periodEnd,
    })
  }

  return Array.from(periodMap.values()).toSorted((left, right) => {
    const startOrder = comparePeriodStart(right.periodStart, left.periodStart)
    return startOrder !== 0 ? startOrder : left.periodType.localeCompare(right.periodType)
  })
}

function formatSignedPercent(locale: AppLocale, input: number | null) {
  if (input === null || !Number.isFinite(input)) {
    return null
  }

  const formatted = signedPercentFormatters[locale].format(input)

  return `${formatted}%`
}

function getDeltaPercent(current: number | null, previous: number | null) {
  if (current === null || previous === null || previous === 0) {
    return null
  }

  return ((current - previous) / Math.abs(previous)) * 100
}

function getTrendWidth(score: number) {
  return `${Math.max(8, Math.min(100, Math.round(score)))}%`
}

function getDeltaWidth(input: number | null) {
  if (input === null || !Number.isFinite(input)) {
    return '50%'
  }

  return `${Math.max(14, Math.min(100, Math.round(52 + input * 2.4)))}%`
}

function getMetricProgressPercent(metric: MyPerformanceMetric | null) {
  const source =
    typeof metric?.achievementRate === 'number'
      ? metric.achievementRate * 100
      : typeof metric?.actualRatio === 'number'
        ? metric.actualRatio * 100
        : typeof metric?.weightPercent === 'number' && metric.weightPercent > 0
          ? (metric.contributionValue / metric.weightPercent) * 100
          : null

  if (source === null || !Number.isFinite(source)) {
    return 0
  }

  return Math.max(0, Math.round(source))
}

function getMetricTone(code: string) {
  if (code === 'UPT') return 'upt'
  if (code === 'ATV') return 'atv'
  return 'hg'
}

function getMetricShortLabel(t: TranslateFunction, code: string) {
  if (code === 'UPT') return t('storeMe.metric.uptShort')
  if (code === 'ATV') return t('storeMe.metric.atvShort')
  return t('storeMe.metric.hgShort')
}

function getMetricNarrativeKey(code: string) {
  if (code === 'UPT') return 'storeMe.metricNarrative.upt' as const
  if (code === 'ATV') return 'storeMe.metricNarrative.atv' as const
  return 'storeMe.metricNarrative.hg' as const
}

function getMetricStatusKey(delta: number | null) {
  if (delta === null) return 'storeMe.metricStatus.stable' as const
  if (delta >= 8) return 'storeMe.metricStatus.strong' as const
  if (delta >= 0) return 'storeMe.metricStatus.rising' as const
  return 'storeMe.metricStatus.watch' as const
}

function getMetricStatusLabel(
  t: TranslateFunction,
  metric: MyPerformanceMetric | null,
  delta: number | null,
) {
  if (metric?.scoreStatus === 'missing_reference') {
    return t('storeMe.missingReference')
  }

  if (metric?.scoreStatus === 'pending_normalization') {
    return t('storeMe.pendingNormalizationStatus')
  }

  if (metric?.dataStatus === 'missing' || metric?.status === 'missing') {
    return t('storeMe.noData')
  }

  return t(getMetricStatusKey(delta))
}

function buildTrendPoints(rows: Array<{ scoreValue: number | null }>) {
  const usableRows = rows.filter((row) => row.scoreValue !== null)

  if (usableRows.length === 0) {
    return {
      line: '0,160 640,160',
      area: '0,160 640,160 640,210 0,210',
    }
  }

  if (usableRows.length === 1) {
    const firstRow = usableRows[0]
    if (!firstRow) {
      return {
        line: '0,160 640,160',
        area: '0,160 640,160 640,210 0,210',
      }
    }
    const y = Math.max(22, Math.min(186, 198 - firstRow.scoreValue! * 1.72))
    return {
      line: `0,${y} 640,${y}`,
      area: `0,${y} 640,${y} 640,210 0,210`,
    }
  }

  const maxIndex = usableRows.length - 1
  const line = usableRows
    .map((row, index) => {
      const x = Math.round((index / maxIndex) * 640)
      const y = Math.round(Math.max(22, Math.min(186, 198 - (row.scoreValue ?? 0) * 1.72)))
      return `${x},${y}`
    })
    .join(' ')

  return {
    line,
    area: `${line} 640,210 0,210`,
  }
}

function getPeriodStart(input: MyPerformanceSummary | null | undefined) {
  return input?.period?.periodStart ?? input?.source.snapshotDate ?? ''
}

export function useStoreMyPerformancePeriodModel(input: {
  performance: MyPerformanceSummary | undefined
  performanceQueryIsSuccess: boolean
  selectedLiveDayStarts: string[]
  selectedLiveMonthKeys: string[]
  selectedLivePeriodStart: string
  selectedLivePeriodType: LivePeriodType
  selectedLiveYears: string[]
  sourceMode: StorePerformanceSourceMode
}) {
  const availableLivePeriods = useMemo(
    () =>
      getAvailableLivePeriods({
        performance: input.performance,
        selectedPeriodType: input.selectedLivePeriodType,
      }),
    [input.performance, input.selectedLivePeriodType],
  )
  const availableMonthlyPeriods = useMemo(
    () => availableLivePeriods.filter((period) => period.periodType === 'monthly'),
    [availableLivePeriods],
  )
  const availableDailyPeriods = useMemo(
    () => availableLivePeriods.filter((period) => period.periodType === 'daily'),
    [availableLivePeriods],
  )
  const availableLiveYearOptions = useMemo(() => {
    const yearSet = new Set(
      availableLivePeriods.flatMap((period) => {
        const year = getPeriodYear(period.periodStart)
        return year ? [year] : []
      }),
    )

    return Array.from(yearSet).toSorted((left, right) => right.localeCompare(left))
  }, [availableLivePeriods])
  const yearScopedLivePeriods = useMemo(() => {
    if (input.selectedLiveYears.length === 0) {
      return availableLivePeriods
    }

    const selectedYearSet = new Set(input.selectedLiveYears)
    return availableLivePeriods.filter((period) => selectedYearSet.has(getPeriodYear(period.periodStart)))
  }, [availableLivePeriods, input.selectedLiveYears])
  const availableLiveMonthOptions = useMemo(() => {
    const monthSet = new Set(
      yearScopedLivePeriods.flatMap((period) => {
        const monthKey = getPeriodMonthKey(period.periodStart)
        return monthKey ? [monthKey] : []
      }),
    )

    return Array.from(monthSet).toSorted((left, right) => right.localeCompare(left))
  }, [yearScopedLivePeriods])
  const monthScopedLivePeriods = useMemo(() => {
    if (input.selectedLiveMonthKeys.length === 0) {
      return yearScopedLivePeriods
    }

    const selectedMonthSet = new Set(input.selectedLiveMonthKeys)
    return yearScopedLivePeriods.filter((period) => selectedMonthSet.has(getPeriodMonthKey(period.periodStart)))
  }, [input.selectedLiveMonthKeys, yearScopedLivePeriods])
  const scopedAvailableMonthlyPeriods = useMemo(
    () => monthScopedLivePeriods.filter((period) => period.periodType === 'monthly'),
    [monthScopedLivePeriods],
  )
  const scopedAvailableDailyPeriods = useMemo(
    () => monthScopedLivePeriods.filter((period) => period.periodType === 'daily'),
    [monthScopedLivePeriods],
  )
  const selectedLivePeriods =
    input.selectedLivePeriodType === 'daily' ? scopedAvailableDailyPeriods : scopedAvailableMonthlyPeriods
  const effectiveSelectedLivePeriods = useMemo(() => {
    if (input.selectedLivePeriodType !== 'daily' || input.selectedLiveDayStarts.length === 0) {
      return selectedLivePeriods
    }

    const selectedKeySet = new Set(input.selectedLiveDayStarts)
    return selectedLivePeriods.filter((period) => selectedKeySet.has(getLivePeriodOptionKey(period)))
  }, [input.selectedLiveDayStarts, input.selectedLivePeriodType, selectedLivePeriods])
  const livePeriodFallbackType = useMemo(() => {
    if (input.sourceMode !== 'live' || !input.performanceQueryIsSuccess || input.performance?.period) {
      return null
    }

    if (
      input.selectedLivePeriodType === 'monthly' &&
      selectedLivePeriods.length === 0 &&
      scopedAvailableDailyPeriods.length > 0
    ) {
      return 'daily' as const
    }

    if (
      input.selectedLivePeriodType === 'daily' &&
      selectedLivePeriods.length === 0 &&
      scopedAvailableMonthlyPeriods.length > 0
    ) {
      return 'monthly' as const
    }

    return null
  }, [
    input.performance?.period,
    input.performanceQueryIsSuccess,
    input.selectedLivePeriodType,
    input.sourceMode,
    scopedAvailableDailyPeriods.length,
    scopedAvailableMonthlyPeriods.length,
    selectedLivePeriods.length,
  ])
  const livePeriodFallbackStart = useMemo(() => {
    const fallbackPeriods =
      livePeriodFallbackType === 'daily'
        ? scopedAvailableDailyPeriods
        : livePeriodFallbackType === 'monthly'
          ? scopedAvailableMonthlyPeriods
          : effectiveSelectedLivePeriods

    if (
      input.sourceMode !== 'live' ||
      !input.performanceQueryIsSuccess ||
      input.performance?.period ||
      fallbackPeriods.length === 0
    ) {
      return ''
    }

    if (livePeriodFallbackType) {
      return getLatestAvailablePeriodStart(fallbackPeriods)
    }

    const selectedKey = getPeriodDateKey(input.selectedLivePeriodStart)
    const selectedPeriodExists =
      selectedKey !== '' &&
      fallbackPeriods.some((period) => isSamePeriodStart(period.periodStart, selectedKey))

    if (selectedPeriodExists) {
      return ''
    }

    return getLatestAvailablePeriodStart(fallbackPeriods)
  }, [
    effectiveSelectedLivePeriods,
    input.performance?.period,
    input.performanceQueryIsSuccess,
    input.selectedLivePeriodStart,
    input.sourceMode,
    livePeriodFallbackType,
    scopedAvailableDailyPeriods,
    scopedAvailableMonthlyPeriods,
  ])
  const monthlyDetailPeriods = useMemo(() => {
    const scopedDetailPeriods = effectiveSelectedLivePeriods.length
      ? effectiveSelectedLivePeriods
      : input.selectedLivePeriodType === 'daily'
        ? scopedAvailableDailyPeriods
        : scopedAvailableMonthlyPeriods
    const activeYear = getPeriodYear(input.performance?.period?.periodStart ?? scopedDetailPeriods.at(-1)?.periodStart)
    const scopedPeriods = activeYear
      ? scopedDetailPeriods.filter((period) => getPeriodYear(period.periodStart) === activeYear)
      : scopedDetailPeriods

    return scopedPeriods
      .toSorted((left, right) => comparePeriodStart(left.periodStart, right.periodStart))
      .slice(-12)
  }, [
    effectiveSelectedLivePeriods,
    input.performance?.period?.periodStart,
    input.selectedLivePeriodType,
    scopedAvailableDailyPeriods,
    scopedAvailableMonthlyPeriods,
  ])

  return {
    availableDailyPeriods,
    availableLiveMonthOptions,
    availableLivePeriods,
    availableLiveYearOptions,
    availableMonthlyPeriods,
    effectiveSelectedLivePeriods,
    livePeriodFallbackStart,
    livePeriodFallbackType,
    monthlyDetailPeriods,
    scopedAvailableDailyPeriods,
    scopedAvailableMonthlyPeriods,
  }
}

export function createStoreMyPerformancePeriodHandlers(input: {
  availableDailyPeriods: LivePeriodOption[]
  availableMonthlyPeriods: LivePeriodOption[]
  dispatch: Dispatch<StoreMyPerformancePageAction>
  selectedLiveMonthKeys: string[]
  selectedLivePeriodType: LivePeriodType
  selectedLiveYears: string[]
}) {
  function getPeriodsForSelection(selection?: {
    periodType?: LivePeriodType
    years?: string[]
    months?: string[]
    days?: string[]
  }) {
    const periodType = selection?.periodType ?? input.selectedLivePeriodType
    const selectedYears = selection?.years ?? input.selectedLiveYears
    const selectedMonths = selection?.months ?? input.selectedLiveMonthKeys
    const selectedDays = selection?.days ?? []
    const yearSet = selectedYears.length ? new Set(selectedYears) : null
    const monthSet = selectedMonths.length ? new Set(selectedMonths) : null
    const daySet = periodType === 'daily' && selectedDays.length ? new Set(selectedDays) : null
    const periods = periodType === 'daily' ? input.availableDailyPeriods : input.availableMonthlyPeriods

    return periods.filter((period) => {
      const periodStart = period.periodStart
      if (yearSet && !yearSet.has(getPeriodYear(periodStart))) {
        return false
      }
      if (monthSet && !monthSet.has(getPeriodMonthKey(periodStart))) {
        return false
      }
      if (daySet && !daySet.has(getLivePeriodOptionKey(period))) {
        return false
      }

      return true
    })
  }

  function changeLivePeriodType(periodType: LivePeriodType) {
    const nextPeriods = getPeriodsForSelection({ periodType })
    input.dispatch({
      type: 'changeLivePeriodType',
      periodType,
      periodStart: getLatestAvailablePeriodStart(nextPeriods),
    })
  }

  function selectLiveMonth(monthKey: string) {
    const nextPeriods = getPeriodsForSelection({ periodType: 'monthly', months: [monthKey] })
    if (nextPeriods.length === 0) {
      return
    }

    input.dispatch({
      type: 'setLiveMonthSelection',
      monthKeys: [monthKey],
      periodStart: getLatestAvailablePeriodStart(nextPeriods),
    })
  }

  function selectLiveDay(period: { periodStart: string }) {
    const key = getLivePeriodOptionKey(period)
    if (!key) {
      return
    }

    const nextPeriods = getPeriodsForSelection({ periodType: 'daily', days: [key] })
    if (nextPeriods.length === 0) {
      return
    }

    input.dispatch({
      type: 'setLiveDaySelection',
      dayStarts: [key],
      periodStart: getLatestAvailablePeriodStart(nextPeriods),
    })
  }

  return {
    changeLivePeriodType,
    selectLiveDay,
    selectLiveMonth,
  }
}

function isSelectionKeyChecked(currentKeys: string[], key: string) {
  if (currentKeys.length === 0) {
    return true
  }

  return currentKeys.includes(key)
}

export function buildStoreMyPerformanceViewModel(input: {
  availableClosedSnapshotRuns: ReportingSnapshotRun[]
  availableLiveMonthOptions: string[]
  availableLivePeriods: LivePeriodOption[]
  availableLiveYearOptions: string[]
  effectiveSelectedLivePeriods: LivePeriodOption[]
  locale: AppLocale
  monthlyDetailPeriods: LivePeriodOption[]
  monthlyPerformanceData: Array<MyPerformanceSummary | undefined>
  performance: MyPerformanceSummary
  profileMode: StoreProfileMode
  scopedAvailableDailyPeriods: LivePeriodOption[]
  selectedLiveDayStarts: string[]
  selectedLiveMonthKeys: string[]
  selectedLiveYears: string[]
  sourceMode: StorePerformanceSourceMode
  t: TranslateFunction
  gradingBands?: Parameters<typeof resolvePerformanceGrade>[1]
}) {
  const partial = input.performance.partial ?? {
    isPartial: true,
    missingMetricCodes: [],
    missingMetricLabels: [],
    pendingNormalizationCodes: [],
    pendingNormalizationLabels: [],
  }
  const supporting = input.performance.supporting ?? {
    netSalesValue: null,
    targetEntryMode: 'manager_assignment' as const,
    targetEditableByCurrentUser: false,
  }
  const performanceGrade = resolvePerformanceGrade(input.performance.score.value, input.gradingBands)
  const scoreMeaning = resolveLocalizedScoreMeaning({
    t: input.t,
    gradeCode: performanceGrade.code,
    matchedMetrics: input.performance.score.matchedMetrics,
    totalMetrics: input.performance.score.totalMetrics,
    isPartial: partial.isPartial,
    tone: performanceGrade.tone,
  })
  const periodLabel = formatPeriodLabel(input.locale, input.t, {
    period: input.performance.period,
    snapshotDate: input.performance.source.snapshotDate,
  })
  const personnelMetrics = input.performance.metrics.filter(isPersonnelMetric)
  const pendingMetricLabels = personnelMetrics.flatMap((metric) =>
    metric.scoreStatus === 'missing_reference' ||
    metric.scoreStatus === 'pending_normalization'
      ? [metric.label || metric.code]
      : [],
  )
  const pendingNormalizationLabels = partial.pendingNormalizationLabels?.length
    ? partial.pendingNormalizationLabels
    : (partial.pendingNormalizationCodes ?? []).length
      ? (partial.pendingNormalizationCodes ?? []).map(
          (code) => findMetric(personnelMetrics, code)?.label ?? code,
        )
      : pendingMetricLabels
  const targetProgressPercent = getTargetProgressPercent(personnelMetrics)
  const monthlyPeriodsForRows = input.monthlyDetailPeriods.length
    ? input.monthlyDetailPeriods
    : input.performance.period
      ? [{
          periodType: isSamePeriodStart(input.performance.period.periodStart, input.performance.period.periodEnd) ? 'daily' as const : 'monthly' as const,
          periodStart: input.performance.period.periodStart,
          periodEnd: input.performance.period.periodEnd,
        }]
      : []
  const monthlyPerformanceData = monthlyPeriodsForRows.map((period, index) => {
    const queriedData = input.monthlyPerformanceData[index]

    return queriedData ?? (isSamePeriodStart(period.periodStart, getPeriodStart(input.performance)) ? input.performance : null)
  })
  const monthlyDetailRows = monthlyPeriodsForRows.map((period, index) => {
    const monthPerformance = monthlyPerformanceData[index]
    const previousPerformance = index > 0 ? monthlyPerformanceData[index - 1] : null
    const metrics = monthPerformance?.metrics.filter(isPersonnelMetric) ?? []
    const scoreValue = monthPerformance?.score.value ?? null

    return {
      key: getPeriodDateKey(period.periodStart) || period.periodStart,
      label: period.periodType === 'daily' ? formatDate(period.periodStart, input.locale) : formatMonthYear(input.locale, input.t, period.periodStart),
      periodNote:
        isSamePeriodStart(period.periodStart, getPeriodStart(input.performance))
          ? input.t('storeMe.activePeriod')
          : formatPeriodLabel(input.locale, input.t, { period }),
      scoreValue,
      scoreLabel: scoreValue === null ? input.t('storeMe.noData') : scoreValue.toFixed(1),
      uptLabel: getMetricDisplayValue(input.locale, input.t, metrics, 'UPT'),
      atvLabel: getMetricDisplayValue(input.locale, input.t, metrics, 'ATV'),
      targetLabel: getMetricDisplayValue(input.locale, input.t, metrics, 'TARGET_ACHIEVEMENT'),
      trendLabel: formatSignedPercent(
        input.locale,
        getDeltaPercent(scoreValue, previousPerformance?.score.value ?? null),
      ),
      trendWidth: getTrendWidth(scoreValue ?? 0),
    }
  })
  const activeMonthlyRow =
    monthlyDetailRows.find((row) => isSamePeriodStart(row.key, getPeriodStart(input.performance))) ??
    monthlyDetailRows.at(-1) ??
    null
  const previousMonthlyRow = activeMonthlyRow
    ? monthlyDetailRows[monthlyDetailRows.findIndex((row) => row.key === activeMonthlyRow.key) - 1] ?? null
    : null
  const previousMonthlyIndex = previousMonthlyRow
    ? monthlyDetailRows.findIndex((row) => row.key === previousMonthlyRow.key)
    : -1
  const previousMetrics =
    previousMonthlyIndex >= 0
      ? monthlyPerformanceData[previousMonthlyIndex]?.metrics ?? []
      : []
  const samePeriodScoreDeltaValue = getDeltaPercent(
    activeMonthlyRow?.scoreValue ?? null,
    previousMonthlyRow?.scoreValue ?? null,
  )
  const samePeriodScoreDelta = formatSignedPercent(input.locale, samePeriodScoreDeltaValue)
  const samePeriodMetrics = (['UPT', 'ATV', 'TARGET_ACHIEVEMENT'] as const).map((code) => {
    const deltaValue = getDeltaPercent(
      getMetricNumericValue(personnelMetrics, code),
      getMetricNumericValue(previousMetrics, code),
    )

    return {
      code,
      label: getMetricShortLabel(input.t, code),
      delta: formatSignedPercent(input.locale, deltaValue),
      deltaValue,
      width: getDeltaWidth(deltaValue),
    }
  })
  const metricRanksByCode = new Map((input.performance.metricRanks ?? []).map((metricRank) => [metricRank.code, metricRank]))
  const metricCards = samePeriodMetrics.map((metricDelta) => {
    const metric = findMetric(personnelMetrics, metricDelta.code)
    const metricRank = metricRanksByCode.get(metricDelta.code)
    const displayValue = getMetricDisplayValue(input.locale, input.t, personnelMetrics, metricDelta.code)
    const progressPercent = getMetricProgressPercent(metric)
    const actionMetricValue = getMetricNumericValue(personnelMetrics, metricDelta.code)
    const actionValueAvailable =
      actionMetricValue !== null &&
      metric?.scoreStatus !== 'missing_reference' &&
      metric?.scoreStatus !== 'pending_normalization' &&
      metric?.dataStatus !== 'missing' &&
      metric?.status !== 'missing'

    return {
      ...metricDelta,
      actionValueAvailable,
      displayValue,
      progressPercent,
      contributionValue: getFiniteMetricNumber(metric?.contributionValue) ?? 0,
      weightPercent: getFiniteMetricNumber(metric?.weightPercent) ?? 0,
      ...formatRegionRankLabels(metricRank, input.t),
      storePopulationLabel: formatPopulation(metricRank?.storePopulation, input.t),
      storeRankLabel: formatRank(metricRank?.storeRank, input.t),
      tone: getMetricTone(metricDelta.code),
      statusLabel: getMetricStatusLabel(input.t, metric, metricDelta.deltaValue),
      narrative: input.t(getMetricNarrativeKey(metricDelta.code), {
        delta: metricDelta.delta ?? input.t('storeMe.noTrendData'),
      }),
      turkeyPopulationLabel: formatPopulation(metricRank?.turkeyPopulation, input.t),
      turkeyRankLabel: formatRank(metricRank?.turkeyRank, input.t),
    }
  })
  const todayActions = buildStoreMyPerformanceTodayActions({ metricCards, partial, pendingNormalizationLabels, samePeriodScoreDelta, samePeriodScoreDeltaValue, t: input.t, targetProgressPercent })
  const targetMetric = findMetric(personnelMetrics, 'TARGET_ACHIEVEMENT')
  const targetSalesValue = typeof targetMetric?.targetValue === 'number' && Number.isFinite(targetMetric.targetValue) && targetMetric.targetValue > 0 ? targetMetric.targetValue : null
  const remainingTargetValue = targetSalesValue !== null && supporting.netSalesValue !== null ? Math.max(0, targetSalesValue - supporting.netSalesValue) : null
  const trendPoints = buildTrendPoints(monthlyDetailRows)
  const employeeStore = input.performance.employee?.storeName ?? input.t('storeMe.noStore')
  const periodLabelWithSource = `${periodLabel} \u00B7 ${formatSourceMode(input.t, input.performance.source.mode)}`
  const shareCard = buildStoreMeShareCardViewModel({ isPartial: partial.isPartial, performance: input.performance, periodKey: getPeriodDateKey(getPeriodStart(input.performance)), periodLabel, previousPerformance: previousMonthlyIndex >= 0 ? monthlyPerformanceData[previousMonthlyIndex] : null, previousPeriodScore: previousMonthlyRow?.scoreValue ?? null, scoreRows: monthlyDetailRows, storeName: employeeStore, targetMetric, targetProgressPercent, t: input.t })

  return {
    actualSalesLabel: formatCurrency(input.locale, input.t, supporting.netSalesValue),
    closedSnapshotRunOptions: input.availableClosedSnapshotRuns.map((run) => ({
      snapshotRunId: run.snapshotRunId,
      label: formatSnapshotOptionLabel(run, input.locale),
    })),
    dataQualityLabel: partial.isPartial ? input.t('storeMe.missingDataExists') : input.t('storeMe.completeData'),
    employeeHeading: `${input.performance.employee?.displayName ?? ''} \u00B7 ${employeeStore}`,
    gradeLabel: `${performanceGrade.code} - ${input.t(`storeMe.grade.${performanceGrade.code}` as TranslationKey)}`,
    introCopy: input.profileMode === 'personnel' ? input.t('storeMe.personnelProfileIntro') : input.t('storeMe.v2Intro'),
    liveDayFilterOptions: input.scopedAvailableDailyPeriods.map((period) => {
      const periodKey = getLivePeriodOptionKey(period)

      return {
        key: periodKey,
        label: formatLivePeriodOptionLabel(input.locale, period),
        checked: isSelectionKeyChecked(input.selectedLiveDayStarts, periodKey),
        period,
      }
    }),
    liveMonthFilterOptions: input.availableLiveMonthOptions.map((monthKey) => ({
      key: monthKey,
      label: formatMonthKeyLabel(input.locale, input.t, monthKey),
      checked: isSelectionKeyChecked(input.selectedLiveMonthKeys, monthKey),
    })),
    liveYearFilterOptions: input.availableLiveYearOptions.map((year) => ({
      key: year,
      checked: isSelectionKeyChecked(input.selectedLiveYears, year),
    })),
    loadedPeriodCount: input.sourceMode === 'closed' ? input.availableClosedSnapshotRuns.length : input.effectiveSelectedLivePeriods.length || monthlyDetailRows.length || input.availableLivePeriods.length,
    metricCards,
    monthlyDetailRows,
    partial,
    periodLabel,
    pendingNormalizationLabels,
    remainingTargetLabel: formatCurrency(input.locale, input.t, remainingTargetValue),
    samePeriodMetrics,
    samePeriodScoreDelta,
    scoreDeltaLabel: samePeriodScoreDelta ?? input.t('storeMe.noTrendData'),
    scoreMeaning,
    scoreValue: Math.round(input.performance.score.value),
    shareCard,
    ...formatRegionRankLabels(input.performance.rankings, input.t),
    selectedPeriodLabel: periodLabelWithSource,
    storePopulationLabel: formatPopulation(input.performance.rankings.storePopulation, input.t),
    storeRankLabel: formatRank(input.performance.rankings.storeRank, input.t),
    targetProgressPercent,
    targetSalesLabel: formatCurrency(input.locale, input.t, targetSalesValue),
    targetStatusLabel: targetSalesValue !== null ? input.t('storeMe.approvedTarget') : input.t('storeMe.targetPending'),
    todayActions,
    trendPoints,
    turkeyPopulationLabel: formatPopulation(input.performance.rankings.turkeyPopulation, input.t),
    turkeyRankLabel: formatRank(input.performance.rankings.turkeyRank, input.t),
  }
}
