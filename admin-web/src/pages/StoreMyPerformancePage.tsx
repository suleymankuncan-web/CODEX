import { useQueries, useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useReducer } from 'react'
import { ScreenState } from '../components/dashboard-primitives'
import type { AuthSessionSummary } from '../features/auth/api'
import type { TranslateFunction, TranslationKey } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import {
  getKpiConfig,
  getMyPerformance,
  getPersonnelPerformance,
  getReportingSnapshotRuns,
  type MyPerformanceQueryInput,
  type MyPerformanceMetric,
  type MyPerformanceSummary,
} from '../features/reports/api'
import { formatSnapshotOptionLabel } from '../features/reports/snapshot-labels'
import { formatKpiMetricValue } from '../features/kpi/display'
import {
  type PerformanceGradeCode,
  resolvePerformanceGrade,
} from '../features/kpi/grading'
import { formatDate, getErrorMessage } from '../lib/format'
import { getIntlLocale, type AppLocale } from '../lib/i18n'
import { ApiError } from '../lib/api'
import { transientQueryRetryOptions } from '../lib/query-retry'
import {
  StoreMyPerformanceDateFilter,
  StoreMyPerformanceHeroPanel,
  StoreMyPerformanceKpiDialog,
  StoreMyPerformanceLowerGrid,
  StoreMyPerformanceMetricGrid,
  StoreMyPerformanceMobileDock,
  StoreMyPerformancePartialAlert,
  StoreMyPerformanceRail,
  StoreMyPerformanceScorePanel,
  StoreMyPerformanceTopbar,
} from './store-my-performance-sections'

function canUseSelfPerformance(authSummary: AuthSessionSummary | null) {
  const roles = authSummary?.user.roleCodes ?? []
  return roles.includes('STORE_PERSONNEL') || roles.includes('STORE_MANAGER')
}

function canUsePersonnelPerformance(authSummary: AuthSessionSummary | null) {
  const roles = authSummary?.user.roleCodes ?? []
  return (
    roles.includes('STORE_PERSONNEL') ||
    roles.includes('STORE_MANAGER') ||
    roles.includes('REGION_MANAGER') ||
    roles.includes('SUPER_ADMIN')
  )
}

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

type LivePeriodType = 'monthly' | 'daily'
type StorePerformanceSourceMode = 'live' | 'closed'

type StoreMyPerformancePageState = {
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

type StoreMyPerformancePageStateInput = {
  initialLivePeriodStart?: string
  initialLivePeriodType?: LivePeriodType
}

type StoreMyPerformancePageAction =
  | { type: 'applyLivePeriodFallback'; periodType: LivePeriodType | null; periodStart: string }
  | { type: 'changeLivePeriodType'; periodType: LivePeriodType; periodStart: string }
  | { type: 'setLiveYearSelection'; years: string[]; periodStart: string }
  | { type: 'setLiveMonthSelection'; monthKeys: string[]; periodStart: string }
  | { type: 'setLiveDaySelection'; dayStarts: string[]; periodStart: string }
  | { type: 'toggleDateFilter' }
  | { type: 'setSourceMode'; mode: StorePerformanceSourceMode }
  | { type: 'setClosedSnapshotRunId'; snapshotRunId: string }
  | { type: 'setKpiDetailOpen'; open: boolean }

function createStoreMyPerformancePageState(
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

function storeMyPerformancePageReducer(
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

  return Math.max(0, Math.min(100, Math.round(source * 100)))
}

function getPeriodDateKey(input: string | null | undefined) {
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

  return Math.max(0, Math.min(100, Math.round(source)))
}

function formatRank(input: number | null | undefined, t: TranslateFunction) {
  return input ? `${input}.` : t('storeMe.noData')
}

function formatPopulation(input: number | null | undefined, t: TranslateFunction) {
  return input && input > 0 ? t('storeMe.rankPopulation', { count: input }) : t('storeMe.noData')
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
    const y = Math.max(22, Math.min(186, 198 - usableRows[0].scoreValue! * 1.72))
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

export function StoreMyPerformancePage(input: {
  authSummary: AuthSessionSummary | null
  employeeId?: string
  initialLivePeriodStart?: string
  initialLivePeriodType?: LivePeriodType
  profileMode?: 'self' | 'personnel'
  showInternalRail?: boolean
}) {
  const { locale, t } = useLocalization()
  const profileMode = input.profileMode ?? 'self'
  const showInternalRail = input.showInternalRail ?? true
  const targetEmployeeId = input.employeeId?.trim() ?? ''
  const enabled =
    profileMode === 'personnel'
      ? canUsePersonnelPerformance(input.authSummary) && targetEmployeeId !== ''
      : canUseSelfPerformance(input.authSummary)
  const [state, dispatch] = useReducer(
    storeMyPerformancePageReducer,
    {
      initialLivePeriodStart: input.initialLivePeriodStart,
      initialLivePeriodType: input.initialLivePeriodType,
    },
    createStoreMyPerformancePageState,
  )
  const {
    sourceMode,
    selectedLivePeriodType,
    selectedLivePeriodStart,
    selectedLiveYears,
    selectedLiveMonthKeys,
    selectedLiveDayStarts,
    selectedClosedSnapshotRunId,
    isDateFilterOpen,
    isKpiDetailOpen,
  } = state
  const usesClosedSnapshotMode = profileMode !== 'personnel'
  const queryPrefix = profileMode === 'personnel'
    ? ['personnel-performance', targetEmployeeId] as const
    : ['my-performance'] as const
  const fetchPerformance = (queryInput: MyPerformanceQueryInput) =>
    profileMode === 'personnel'
      ? getPersonnelPerformance(targetEmployeeId, queryInput)
      : getMyPerformance(queryInput)

  const configQuery = useQuery({
    queryKey: ['store-me-kpi-config'],
    queryFn: getKpiConfig,
    enabled,
    ...transientQueryRetryOptions,
  })

  const closedRunsQuery = useQuery({
    queryKey: ['store-me-closed-snapshot-runs'],
    queryFn: () =>
      getReportingSnapshotRuns({
        snapshotType: 'daily',
        limit: 30,
        offset: 0,
      }),
    enabled: enabled && usesClosedSnapshotMode && sourceMode === 'closed',
    ...transientQueryRetryOptions,
  })

  const availableClosedSnapshotRuns = closedRunsQuery.data?.items ?? []
  const activeClosedSnapshotRun =
    availableClosedSnapshotRuns.find(
      (run) => run.snapshotRunId === selectedClosedSnapshotRunId,
    ) ??
    availableClosedSnapshotRuns[0] ??
    null
  const selectedClosedSnapshotDate = usesClosedSnapshotMode ? activeClosedSnapshotRun?.snapshotDate ?? '' : ''

  const performanceQuery = useQuery({
    queryKey: [
      ...queryPrefix,
      sourceMode,
      selectedLivePeriodType,
      selectedLivePeriodStart,
      selectedClosedSnapshotDate,
    ],
    queryFn: () =>
      fetchPerformance({
        mode: sourceMode,
        periodType: sourceMode === 'live' ? selectedLivePeriodType : undefined,
        periodStart: sourceMode === 'live' && selectedLivePeriodStart ? selectedLivePeriodStart : undefined,
        snapshotDate:
          sourceMode === 'closed' && selectedClosedSnapshotDate ? selectedClosedSnapshotDate : undefined,
      }),
    enabled: enabled && (sourceMode === 'live' || !usesClosedSnapshotMode || !closedRunsQuery.isLoading),
    ...transientQueryRetryOptions,
  })

  const performance = performanceQuery.data
  const availableLivePeriods = useMemo(
    () =>
      getAvailableLivePeriods({
        performance,
        selectedPeriodType: selectedLivePeriodType,
      }),
    [performance, selectedLivePeriodType],
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
    if (selectedLiveYears.length === 0) {
      return availableLivePeriods
    }

    const selectedYearSet = new Set(selectedLiveYears)
    return availableLivePeriods.filter((period) => selectedYearSet.has(getPeriodYear(period.periodStart)))
  }, [availableLivePeriods, selectedLiveYears])
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
    if (selectedLiveMonthKeys.length === 0) {
      return yearScopedLivePeriods
    }

    const selectedMonthSet = new Set(selectedLiveMonthKeys)
    return yearScopedLivePeriods.filter((period) => selectedMonthSet.has(getPeriodMonthKey(period.periodStart)))
  }, [selectedLiveMonthKeys, yearScopedLivePeriods])
  const scopedAvailableMonthlyPeriods = useMemo(
    () => monthScopedLivePeriods.filter((period) => period.periodType === 'monthly'),
    [monthScopedLivePeriods],
  )
  const scopedAvailableDailyPeriods = useMemo(
    () => monthScopedLivePeriods.filter((period) => period.periodType === 'daily'),
    [monthScopedLivePeriods],
  )
  const selectedLivePeriods =
    selectedLivePeriodType === 'daily' ? scopedAvailableDailyPeriods : scopedAvailableMonthlyPeriods
  const effectiveSelectedLivePeriods = useMemo(() => {
    if (selectedLivePeriodType !== 'daily' || selectedLiveDayStarts.length === 0) {
      return selectedLivePeriods
    }

    const selectedKeySet = new Set(selectedLiveDayStarts)
    return selectedLivePeriods.filter((period) => selectedKeySet.has(getLivePeriodOptionKey(period)))
  }, [selectedLiveDayStarts, selectedLivePeriodType, selectedLivePeriods])
  const livePeriodFallbackType = useMemo(() => {
    if (sourceMode !== 'live' || !performanceQuery.isSuccess || performance?.period) {
      return null
    }

    if (selectedLivePeriodType === 'monthly' && selectedLivePeriods.length === 0 && scopedAvailableDailyPeriods.length > 0) {
      return 'daily' as const
    }

    if (selectedLivePeriodType === 'daily' && selectedLivePeriods.length === 0 && scopedAvailableMonthlyPeriods.length > 0) {
      return 'monthly' as const
    }

    return null
  }, [
    performance?.period,
    performanceQuery.isSuccess,
    scopedAvailableDailyPeriods.length,
    scopedAvailableMonthlyPeriods.length,
    selectedLivePeriodType,
    selectedLivePeriods.length,
    sourceMode,
  ])
  const livePeriodFallbackStart = useMemo(() => {
    const fallbackPeriods =
      livePeriodFallbackType === 'daily'
        ? scopedAvailableDailyPeriods
        : livePeriodFallbackType === 'monthly'
          ? scopedAvailableMonthlyPeriods
          : effectiveSelectedLivePeriods

    if (sourceMode !== 'live' || !performanceQuery.isSuccess || performance?.period || fallbackPeriods.length === 0) {
      return ''
    }

    if (livePeriodFallbackType) {
      return getLatestAvailablePeriodStart(fallbackPeriods)
    }

    const selectedKey = getPeriodDateKey(selectedLivePeriodStart)
    const selectedPeriodExists =
      selectedKey !== '' &&
      fallbackPeriods.some((period) => isSamePeriodStart(period.periodStart, selectedKey))

    if (selectedPeriodExists) {
      return ''
    }

    return getLatestAvailablePeriodStart(fallbackPeriods)
  }, [
    effectiveSelectedLivePeriods,
    livePeriodFallbackType,
    performance?.period,
    performanceQuery.isSuccess,
    scopedAvailableDailyPeriods,
    scopedAvailableMonthlyPeriods,
    selectedLivePeriodStart,
    sourceMode,
  ])
  const monthlyDetailPeriods = useMemo(() => {
    const scopedDetailPeriods = effectiveSelectedLivePeriods.length
      ? effectiveSelectedLivePeriods
      : selectedLivePeriodType === 'daily'
        ? scopedAvailableDailyPeriods
        : scopedAvailableMonthlyPeriods
    const activeYear = getPeriodYear(performance?.period?.periodStart ?? scopedDetailPeriods.at(-1)?.periodStart)
    const scopedPeriods = activeYear
      ? scopedDetailPeriods.filter((period) => getPeriodYear(period.periodStart) === activeYear)
      : scopedDetailPeriods

    return scopedPeriods
      .toSorted((left, right) => comparePeriodStart(left.periodStart, right.periodStart))
      .slice(-12)
  }, [
    effectiveSelectedLivePeriods,
    performance?.period?.periodStart,
    scopedAvailableDailyPeriods,
    scopedAvailableMonthlyPeriods,
    selectedLivePeriodType,
  ])

  const monthlyPerformanceQueries = useQueries({
    queries: monthlyDetailPeriods.map((period) => ({
      queryKey: [
        ...queryPrefix,
        'live',
        period.periodType,
        getPeriodDateKey(period.periodStart) || period.periodStart,
        '',
      ],
      queryFn: () =>
        fetchPerformance({
          mode: 'live',
          periodType: period.periodType === 'daily' ? 'daily' : 'monthly',
          periodStart: getPeriodDateKey(period.periodStart) || period.periodStart,
        }),
      enabled: enabled && sourceMode === 'live' && performanceQuery.isSuccess,
      ...transientQueryRetryOptions,
    })),
  })

  useEffect(() => {
    if (!livePeriodFallbackStart || livePeriodFallbackStart === selectedLivePeriodStart) {
      return undefined
    }

    const fallbackTimer = window.setTimeout(() => {
      dispatch({
        type: 'applyLivePeriodFallback',
        periodType: livePeriodFallbackType,
        periodStart: livePeriodFallbackStart,
      })
    }, 0)

    return () => window.clearTimeout(fallbackTimer)
  }, [livePeriodFallbackStart, livePeriodFallbackType, selectedLivePeriodStart])

  useEffect(() => {
    if (!isKpiDetailOpen) {
      return undefined
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        dispatch({ type: 'setKpiDetailOpen', open: false })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isKpiDetailOpen])

  function getPeriodsForSelection(input?: {
    periodType?: LivePeriodType
    years?: string[]
    months?: string[]
    days?: string[]
  }) {
    const periodType = input?.periodType ?? selectedLivePeriodType
    const selectedYears = input?.years ?? selectedLiveYears
    const selectedMonths = input?.months ?? selectedLiveMonthKeys
    const selectedDays = input?.days ?? selectedLiveDayStarts
    const yearSet = selectedYears.length ? new Set(selectedYears) : null
    const monthSet = selectedMonths.length ? new Set(selectedMonths) : null
    const daySet = periodType === 'daily' && selectedDays.length ? new Set(selectedDays) : null
    const periods = periodType === 'daily' ? availableDailyPeriods : availableMonthlyPeriods

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

  function getNextSelectionKeys(input: {
    currentKeys: string[]
    optionKeys: string[]
    key: string
  }) {
    const currentKeys = input.currentKeys.length > 0 ? input.currentKeys : input.optionKeys
    const nextKeySet = new Set(currentKeys)

    if (nextKeySet.has(input.key)) {
      nextKeySet.delete(input.key)
    } else {
      nextKeySet.add(input.key)
    }

    if (nextKeySet.size === 0) {
      return null
    }

    const nextKeys = input.optionKeys.filter((optionKey) => nextKeySet.has(optionKey))
    return nextKeys.length === input.optionKeys.length ? [] : nextKeys
  }

  function changeLivePeriodType(periodType: LivePeriodType) {
    const nextPeriods = getPeriodsForSelection({ periodType })
    dispatch({
      type: 'changeLivePeriodType',
      periodType,
      periodStart: getLatestAvailablePeriodStart(nextPeriods),
    })
  }

  function isSelectionKeyChecked(currentKeys: string[], key: string) {
    if (currentKeys.length === 0) {
      return true
    }

    return currentKeys.includes(key)
  }

  function toggleLiveYearSelection(year: string) {
    const nextYears = getNextSelectionKeys({
      currentKeys: selectedLiveYears,
      optionKeys: availableLiveYearOptions,
      key: year,
    })
    if (nextYears === null) {
      return
    }

    const nextPeriods = getPeriodsForSelection({ years: nextYears })
    if (nextPeriods.length === 0) {
      return
    }

    dispatch({
      type: 'setLiveYearSelection',
      years: nextYears,
      periodStart: getLatestAvailablePeriodStart(nextPeriods),
    })
  }

  function toggleLiveMonthSelection(monthKey: string) {
    const nextMonths = getNextSelectionKeys({
      currentKeys: selectedLiveMonthKeys,
      optionKeys: availableLiveMonthOptions,
      key: monthKey,
    })
    if (nextMonths === null) {
      return
    }

    const nextPeriods = getPeriodsForSelection({ months: nextMonths })
    if (nextPeriods.length === 0) {
      return
    }

    dispatch({
      type: 'setLiveMonthSelection',
      monthKeys: nextMonths,
      periodStart: getLatestAvailablePeriodStart(nextPeriods),
    })
  }

  function toggleLiveDaySelection(period: { periodStart: string }) {
    const key = getLivePeriodOptionKey(period)
    if (!key) {
      return
    }

    const nextDays = getNextSelectionKeys({
      currentKeys: selectedLiveDayStarts,
      optionKeys: scopedAvailableDailyPeriods.flatMap((item) => {
        const optionKey = getLivePeriodOptionKey(item)
        return optionKey ? [optionKey] : []
      }),
      key,
    })
    if (nextDays === null) {
      return
    }

    const nextPeriods = getPeriodsForSelection({ periodType: 'daily', days: nextDays })
    if (nextPeriods.length === 0) {
      return
    }

    dispatch({
      type: 'setLiveDaySelection',
      dayStarts: nextDays,
      periodStart: getLatestAvailablePeriodStart(nextPeriods),
    })
  }

  if (!enabled) {
    return (
      <ScreenState
        title={
          profileMode === 'personnel'
            ? t('storeMe.personnelProfileUnavailableTitle')
            : t('storeMe.unavailableTitle')
        }
        copy={
          profileMode === 'personnel'
            ? t('storeMe.personnelProfileUnavailableCopy')
            : t('storeMe.unavailableCopy')
        }
        tone="error"
      />
    )
  }

  const configForbidden = configQuery.error instanceof ApiError && configQuery.error.status === 403

  if (
    performanceQuery.isLoading ||
    (configQuery.isLoading && !configForbidden) ||
    (usesClosedSnapshotMode && sourceMode === 'closed' && closedRunsQuery.isLoading)
  ) {
    return (
      <ScreenState
        title={t('storeMe.loadingTitle')}
        copy={t('storeMe.loadingCopy')}
      />
    )
  }

  if (
    performanceQuery.isError ||
    (configQuery.isError && !configForbidden) ||
    (usesClosedSnapshotMode && sourceMode === 'closed' && closedRunsQuery.isError)
  ) {
    return (
      <ScreenState
        title={t('storeMe.errorTitle')}
        copy={getErrorMessage(performanceQuery.error ?? configQuery.error ?? closedRunsQuery.error)}
        tone="error"
      />
    )
  }

  if (!performance?.employee) {
    return (
      <ScreenState
        title={t('storeMe.errorTitle')}
        copy={t('storeMe.noEmployeeCopy')}
        tone="error"
      />
    )
  }

  const partial = performance.partial ?? {
    isPartial: true,
    missingMetricCodes: [],
    missingMetricLabels: [],
    pendingNormalizationCodes: [],
    pendingNormalizationLabels: [],
  }
  const supporting = performance.supporting ?? {
    netSalesValue: null,
    targetEntryMode: 'manager_assignment' as const,
    targetEditableByCurrentUser: false,
  }
  const performanceGrade = resolvePerformanceGrade(
    performance.score.value,
    configQuery.data?.gradingBands,
  )
  const scoreMeaning = resolveLocalizedScoreMeaning({
    t,
    gradeCode: performanceGrade.code,
    matchedMetrics: performance.score.matchedMetrics,
    totalMetrics: performance.score.totalMetrics,
    isPartial: partial.isPartial,
    tone: performanceGrade.tone,
  })
  const periodLabel = formatPeriodLabel(locale, t, {
    period: performance.period,
    snapshotDate: performance.source.snapshotDate,
  })
  const personnelMetrics = performance.metrics.filter(isPersonnelMetric)
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
  const monthlyPeriodsForRows = monthlyDetailPeriods.length
    ? monthlyDetailPeriods
    : performance.period
      ? [{
          periodType: 'monthly' as const,
          periodStart: performance.period.periodStart,
          periodEnd: performance.period.periodEnd,
        }]
      : []
  const monthlyPerformanceData = monthlyPeriodsForRows.map((period, index) => {
    const queriedData = monthlyPerformanceQueries[index]?.data

    return queriedData ?? (isSamePeriodStart(period.periodStart, getPeriodStart(performance)) ? performance : null)
  })
  const monthlyDetailRows = monthlyPeriodsForRows.map((period, index) => {
    const monthPerformance = monthlyPerformanceData[index]
    const previousPerformance = index > 0 ? monthlyPerformanceData[index - 1] : null
    const metrics = monthPerformance?.metrics.filter(isPersonnelMetric) ?? []
    const scoreValue = monthPerformance?.score.value ?? null

    return {
      key: getPeriodDateKey(period.periodStart) || period.periodStart,
      label: formatMonthYear(locale, t, period.periodStart),
      periodNote:
        isSamePeriodStart(period.periodStart, getPeriodStart(performance))
          ? t('storeMe.activePeriod')
          : formatPeriodLabel(locale, t, { period }),
      scoreValue,
      scoreLabel: scoreValue === null ? t('storeMe.noData') : scoreValue.toFixed(1),
      uptLabel: getMetricDisplayValue(locale, t, metrics, 'UPT'),
      atvLabel: getMetricDisplayValue(locale, t, metrics, 'ATV'),
      targetLabel: getMetricDisplayValue(locale, t, metrics, 'TARGET_ACHIEVEMENT'),
      trendLabel: formatSignedPercent(
        locale,
        getDeltaPercent(scoreValue, previousPerformance?.score.value ?? null),
      ),
      trendWidth: getTrendWidth(scoreValue ?? 0),
    }
  })
  const activeMonthlyRow =
    monthlyDetailRows.find((row) => isSamePeriodStart(row.key, getPeriodStart(performance))) ??
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
  const samePeriodScoreDelta = formatSignedPercent(locale, samePeriodScoreDeltaValue)
  const samePeriodMetrics = (['UPT', 'ATV', 'TARGET_ACHIEVEMENT'] as const).map((code) => {
    const deltaValue = getDeltaPercent(
      getMetricNumericValue(personnelMetrics, code),
      getMetricNumericValue(previousMetrics, code),
    )

    return {
      code,
      label: getMetricShortLabel(t, code),
      delta: formatSignedPercent(locale, deltaValue),
      deltaValue,
      width: getDeltaWidth(deltaValue),
    }
  })
  const metricCards = samePeriodMetrics.map((metricDelta) => {
    const metric = findMetric(personnelMetrics, metricDelta.code)
    const displayValue = getMetricDisplayValue(locale, t, personnelMetrics, metricDelta.code)
    const progressPercent = getMetricProgressPercent(metric)

    return {
      ...metricDelta,
      displayValue,
      progressPercent,
      tone: getMetricTone(metricDelta.code),
      statusLabel: getMetricStatusLabel(t, metric, metricDelta.deltaValue),
      narrative: t(getMetricNarrativeKey(metricDelta.code), {
        delta: metricDelta.delta ?? t('storeMe.noTrendData'),
      }),
    }
  })
  const targetMetric = findMetric(personnelMetrics, 'TARGET_ACHIEVEMENT')
  const targetSalesValue =
    typeof targetMetric?.targetValue === 'number' && Number.isFinite(targetMetric.targetValue) && targetMetric.targetValue > 0
      ? targetMetric.targetValue
      : null
  const remainingTargetValue =
    targetSalesValue !== null && supporting.netSalesValue !== null
      ? Math.max(0, targetSalesValue - supporting.netSalesValue)
      : null
  const targetStatusLabel = targetSalesValue !== null ? t('storeMe.approvedTarget') : t('storeMe.targetPending')
  const trendPoints = buildTrendPoints(monthlyDetailRows)
  const employeeStore = performance.employee.storeName ?? t('storeMe.noStore')
  const employeeHeading = `${performance.employee.displayName} · ${employeeStore}`
  const scoreValue = Math.round(performance.score.value)
  const scoreDeltaLabel = samePeriodScoreDelta ?? t('storeMe.noTrendData')
  const loadedPeriodCount =
    sourceMode === 'closed'
      ? availableClosedSnapshotRuns.length
      : effectiveSelectedLivePeriods.length || monthlyDetailRows.length || availableLivePeriods.length
  const dataQualityLabel = partial.isPartial ? t('storeMe.missingDataExists') : t('storeMe.completeData')
  const selectedPeriodLabel = `${periodLabel} · ${formatSourceMode(t, performance.source.mode)}`
  const gradeLabel = `${performanceGrade.code} - ${t(`storeMe.grade.${performanceGrade.code}` as TranslationKey)}`
  const introCopy =
    profileMode === 'personnel' ? t('storeMe.personnelProfileIntro') : t('storeMe.v2Intro')
  const liveYearFilterOptions = availableLiveYearOptions.map((year) => ({
    key: year,
    checked: isSelectionKeyChecked(selectedLiveYears, year),
  }))
  const liveMonthFilterOptions = availableLiveMonthOptions.map((monthKey) => ({
    key: monthKey,
    label: formatMonthKeyLabel(locale, t, monthKey),
    checked: isSelectionKeyChecked(selectedLiveMonthKeys, monthKey),
  }))
  const liveDayFilterOptions = scopedAvailableDailyPeriods.map((period) => {
    const periodKey = getLivePeriodOptionKey(period)

    return {
      key: periodKey,
      label: formatLivePeriodOptionLabel(locale, period),
      checked: isSelectionKeyChecked(selectedLiveDayStarts, periodKey),
      period,
    }
  })
  const closedSnapshotRunOptions = availableClosedSnapshotRuns.map((run) => ({
    snapshotRunId: run.snapshotRunId,
    label: formatSnapshotOptionLabel(run, locale),
  }))
  const storeRankLabel = formatRank(performance.rankings.storeRank, t)
  const storePopulationLabel = formatPopulation(performance.rankings.storePopulation, t)
  const turkeyRankLabel = formatRank(performance.rankings.turkeyRank, t)
  const turkeyPopulationLabel = formatPopulation(performance.rankings.turkeyPopulation, t)
  const targetSalesLabel = formatCurrency(locale, t, targetSalesValue)
  const actualSalesLabel = formatCurrency(locale, t, supporting.netSalesValue)
  const remainingTargetLabel = formatCurrency(locale, t, remainingTargetValue)

  return (
    <section
      className={`store-me-v2-page${showInternalRail ? '' : ' store-me-v2-page-shell-owned'}`}
      aria-label={t('storeMe.title')}
    >
      {showInternalRail ? <StoreMyPerformanceRail t={t} /> : null}

      <main className="store-me-v2-main">
        <section className="store-me-v2-content" aria-label={t('storeMe.title')}>
          <StoreMyPerformanceTopbar
            employeeHeading={employeeHeading}
            introCopy={introCopy}
            periodLabel={periodLabel}
            t={t}
          />

          <StoreMyPerformanceDateFilter
            activeClosedSnapshotRunId={activeClosedSnapshotRun?.snapshotRunId ?? ''}
            availableClosedSnapshotRuns={closedSnapshotRunOptions}
            availableLiveMonthOptions={liveMonthFilterOptions}
            availableLiveYearOptions={liveYearFilterOptions}
            dataQualityLabel={dataQualityLabel}
            isDateFilterOpen={isDateFilterOpen}
            isPartial={partial.isPartial}
            loadedPeriodCount={loadedPeriodCount}
            onChangeLivePeriodType={changeLivePeriodType}
            onSelectClosedSnapshotRun={(snapshotRunId) =>
              dispatch({ type: 'setClosedSnapshotRunId', snapshotRunId })
            }
            onSelectSourceMode={(mode) => dispatch({ type: 'setSourceMode', mode })}
            onToggleDateFilter={() => dispatch({ type: 'toggleDateFilter' })}
            onToggleLiveDay={toggleLiveDaySelection}
            onToggleLiveMonth={toggleLiveMonthSelection}
            onToggleLiveYear={toggleLiveYearSelection}
            scopedAvailableDailyPeriods={liveDayFilterOptions}
            selectedClosedSnapshotRunId={selectedClosedSnapshotRunId}
            selectedLivePeriodType={selectedLivePeriodType}
            selectedPeriodLabel={selectedPeriodLabel}
            sourceMode={sourceMode}
            t={t}
            usesClosedSnapshotMode={usesClosedSnapshotMode}
          />

          <div className="store-me-v2-layout">
            <StoreMyPerformanceScorePanel
              gradeLabel={gradeLabel}
              isPartial={partial.isPartial}
              scoreConfidence={scoreMeaning.confidence}
              scoreDeltaLabel={scoreDeltaLabel}
              scoreFocus={scoreMeaning.focus}
              scoreValue={scoreValue}
              storePopulationLabel={storePopulationLabel}
              storeRankLabel={storeRankLabel}
              t={t}
              turkeyPopulationLabel={turkeyPopulationLabel}
              turkeyRankLabel={turkeyRankLabel}
            />

            <section className="store-me-v2-workspace">
              <StoreMyPerformanceHeroPanel
                actualSalesLabel={actualSalesLabel}
                onOpenKpiDetails={() => dispatch({ type: 'setKpiDetailOpen', open: true })}
                remainingTargetLabel={remainingTargetLabel}
                samePeriodMetrics={samePeriodMetrics}
                samePeriodScoreDelta={samePeriodScoreDelta}
                scoreSummary={scoreMeaning.summary}
                t={t}
                targetProgressPercent={targetProgressPercent}
                targetSalesLabel={targetSalesLabel}
                targetStatusLabel={targetStatusLabel}
              />

              <StoreMyPerformancePartialAlert
                isPartial={partial.isPartial}
                missingMetricLabels={partial.missingMetricLabels}
                pendingNormalizationLabels={pendingNormalizationLabels}
                t={t}
              />

              <StoreMyPerformanceMetricGrid
                metricCards={metricCards}
                storeRankLabel={storeRankLabel}
                t={t}
                turkeyRankLabel={turkeyRankLabel}
              />

              <StoreMyPerformanceLowerGrid
                samePeriodScoreDelta={samePeriodScoreDelta}
                t={t}
                trendPoints={trendPoints}
              />
            </section>
          </div>
        </section>
      </main>

      <StoreMyPerformanceKpiDialog
        employeeName={performance.employee.displayName}
        isOpen={isKpiDetailOpen}
        monthlyDetailRows={monthlyDetailRows}
        onClose={() => dispatch({ type: 'setKpiDetailOpen', open: false })}
        t={t}
      />

      <StoreMyPerformanceMobileDock t={t} />
    </section>
  )
}
