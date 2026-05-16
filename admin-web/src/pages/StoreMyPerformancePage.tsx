import { useQueries, useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useReducer, type CSSProperties } from 'react'
import { NavLink } from 'react-router-dom'
import { CalendarDays, ChevronDown, X } from 'lucide-react'
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

function NavGlyph(input: { type: 'home' | 'me' | 'rank' | 'target' | 'settings' }) {
  if (input.type === 'home') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 11.5 12 5l8 6.5V20H4z" />
        <path d="M9 20v-6h6v6" />
      </svg>
    )
  }

  if (input.type === 'rank') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M18 20V10" />
        <path d="M12 20V4" />
        <path d="M6 20v-6" />
      </svg>
    )
  }

  if (input.type === 'target') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 20a8 8 0 1 0-8-8" />
        <path d="M12 12 18 8" />
        <path d="M4 12H2" />
      </svg>
    )
  }

  if (input.type === 'settings') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
        <path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.04.04a2.1 2.1 0 1 1-2.97 2.97l-.04-.04a1.8 1.8 0 0 0-1.98-.36 1.8 1.8 0 0 0-1.09 1.65V21a2.1 2.1 0 1 1-4.2 0v-.06A1.8 1.8 0 0 0 8.43 19.3a1.8 1.8 0 0 0-1.98.36l-.04.04a2.1 2.1 0 1 1-2.97-2.97l.04-.04A1.8 1.8 0 0 0 3.84 15a1.8 1.8 0 0 0-1.65-1.09H2a2.1 2.1 0 1 1 0-4.2h.06a1.8 1.8 0 0 0 1.65-1.09 1.8 1.8 0 0 0-.36-1.98l-.04-.04a2.1 2.1 0 1 1 2.97-2.97l.04.04a1.8 1.8 0 0 0 1.98.36h.01A1.8 1.8 0 0 0 9.4 2.38V2a2.1 2.1 0 1 1 4.2 0v.06a1.8 1.8 0 0 0 1.09 1.65 1.8 1.8 0 0 0 1.98-.36l.04-.04a2.1 2.1 0 1 1 2.97 2.97l-.04.04a1.8 1.8 0 0 0-.36 1.98v.01a1.8 1.8 0 0 0 1.65 1.09H21a2.1 2.1 0 1 1 0 4.2h-.06A1.8 1.8 0 0 0 19.4 15z" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 19V9" />
      <path d="M10 19V5" />
      <path d="M16 19v-8" />
      <path d="M22 19H2" />
    </svg>
  )
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

  return (
    <section
      className={`store-me-v2-page${showInternalRail ? '' : ' store-me-v2-page-shell-owned'}`}
      aria-label={t('storeMe.title')}
    >
      {showInternalRail ? (
        <aside className="store-me-v2-rail" aria-label={t('storeMe.nav.aria')}>
          <div className="store-me-v2-brand-mark" aria-label={t('storeMe.brandAria')}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 16.5 9.2 11l3.8 3.7L20 7" />
              <path d="M15 7h5v5" />
            </svg>
          </div>
          <nav className="store-me-v2-rail-nav" aria-label={t('storeMe.nav.aria')}>
            <NavLink to="/store/home" className="store-me-v2-rail-link">
              <NavGlyph type="home" />
              <span>{t('storeMe.nav.home')}</span>
            </NavLink>
            <NavLink to="/store/me" className="store-me-v2-rail-link">
              <NavGlyph type="me" />
              <span>{t('storeMe.nav.me')}</span>
            </NavLink>
            <NavLink to="/store/rankings" className="store-me-v2-rail-link">
              <NavGlyph type="rank" />
              <span>{t('storeMe.nav.rankings')}</span>
            </NavLink>
            <NavLink to="/store/approvals" className="store-me-v2-rail-link">
              <NavGlyph type="target" />
              <span>{t('storeMe.nav.targets')}</span>
            </NavLink>
          </nav>
          <div className="store-me-v2-rail-spacer" />
          <NavLink to="/store/tasks" className="store-me-v2-rail-link">
            <NavGlyph type="settings" />
            <span>{t('storeMe.nav.tasks')}</span>
          </NavLink>
        </aside>
      ) : null}

      <main className="store-me-v2-main">
        <section className="store-me-v2-content" aria-label={t('storeMe.title')}>
          <header className="store-me-v2-topbar">
            <div className="store-me-v2-identity">
              <h1>{employeeHeading}</h1>
              <p>{introCopy}</p>
            </div>
            <div className="store-me-v2-top-actions" aria-label={t('storeMe.pageTools')}>
              <button className="store-me-v2-period-pill" type="button">
                {periodLabel}
              </button>
              <button className="store-me-v2-theme-pill" type="button">
                {t('storeMe.lightTheme')}
              </button>
              <button className="store-me-v2-icon-button" type="button" aria-label={t('storeMe.notifications')}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                  <path d="M10 21h4" />
                </svg>
              </button>
            </div>
          </header>

          <section className="store-me-v2-date-filter">
            <button
              className="store-me-v2-date-filter-trigger"
              type="button"
              aria-expanded={isDateFilterOpen}
              onClick={() => dispatch({ type: 'toggleDateFilter' })}
            >
              <span className="store-me-v2-filter-trigger-icon" aria-hidden="true">
                <CalendarDays size={20} />
              </span>
              <span className="store-me-v2-filter-trigger-main">
                <span>{t('storeMe.dateFilter')}</span>
                <strong>{selectedPeriodLabel}</strong>
              </span>
              <span className="store-me-v2-filter-trigger-meta" aria-hidden="true">
                <span>{t('storeMe.loadedPeriodCount', { count: loadedPeriodCount })}</span>
                <span className={partial.isPartial ? '' : 'success'}>{dataQualityLabel}</span>
              </span>
              <span className="store-me-v2-filter-caret" aria-hidden="true">
                <ChevronDown size={18} />
              </span>
            </button>

            {isDateFilterOpen ? (
              <div className="store-me-v2-date-filter-popover" role="group" aria-label={t('storeMe.dateFilter')}>
                {usesClosedSnapshotMode ? (
                  <div className="store-me-v2-filter-field">
                    <span>{t('storeMe.view')}</span>
                    <div className="store-me-v2-choice-row">
                      <button
                        className={sourceMode === 'live' ? 'active' : ''}
                        type="button"
                        onClick={() => dispatch({ type: 'setSourceMode', mode: 'live' })}
                      >
                        {t('storeMe.liveStatus')}
                      </button>
                      <button
                        className={sourceMode === 'closed' ? 'active' : ''}
                        type="button"
                        onClick={() => dispatch({ type: 'setSourceMode', mode: 'closed' })}
                      >
                        {t('storeMe.closedDay')}
                      </button>
                    </div>
                  </div>
                ) : null}
                <div className="store-me-v2-filter-field">
                  <span>{t('storeMe.liveGranularity')}</span>
                  <div className="store-me-v2-choice-row">
                    <button
                      className={selectedLivePeriodType === 'monthly' ? 'active' : ''}
                      type="button"
                      disabled={sourceMode !== 'live'}
                      onClick={() => changeLivePeriodType('monthly')}
                    >
                      {t('storeMe.liveMonth')}
                    </button>
                    <button
                      className={selectedLivePeriodType === 'daily' ? 'active' : ''}
                      type="button"
                      disabled={sourceMode !== 'live'}
                      onClick={() => changeLivePeriodType('daily')}
                    >
                      {t('storeMe.liveDay')}
                    </button>
                  </div>
                </div>
                <div className="store-me-v2-filter-field">
                  <span>{t('storeMe.loadedYears')}</span>
                  <div
                    className="store-me-v2-period-picklist"
                    role="group"
                    aria-label={t('storeMe.loadedYears')}
                  >
                    {availableLiveYearOptions.length ? (
                      availableLiveYearOptions.map((year) => (
                        <label
                          className={`store-me-v2-period-check${isSelectionKeyChecked(selectedLiveYears, year) ? ' active' : ''}`}
                          key={year}
                        >
                          <input
                            type="checkbox"
                            checked={isSelectionKeyChecked(selectedLiveYears, year)}
                            onChange={() => toggleLiveYearSelection(year)}
                            disabled={sourceMode !== 'live'}
                          />
                          <span>{year}</span>
                        </label>
                      ))
                    ) : (
                      <span className="store-me-v2-period-empty">{t('storeMe.noLoadedPeriods')}</span>
                    )}
                  </div>
                </div>
                <div className="store-me-v2-filter-field">
                  <span>{t('storeMe.loadedMonthBuckets')}</span>
                  <div
                    className="store-me-v2-period-picklist"
                    role="group"
                    aria-label={t('storeMe.loadedMonthBuckets')}
                  >
                    {availableLiveMonthOptions.length ? (
                      availableLiveMonthOptions.map((monthKey) => {
                        const label = formatMonthKeyLabel(locale, t, monthKey)

                        return (
                          <label
                            className={`store-me-v2-period-check${isSelectionKeyChecked(selectedLiveMonthKeys, monthKey) ? ' active' : ''}`}
                            key={monthKey}
                          >
                            <input
                              type="checkbox"
                              checked={isSelectionKeyChecked(selectedLiveMonthKeys, monthKey)}
                              onChange={() => toggleLiveMonthSelection(monthKey)}
                              disabled={sourceMode !== 'live'}
                            />
                            <span>{label}</span>
                          </label>
                        )
                      })
                    ) : (
                      <span className="store-me-v2-period-empty">{t('storeMe.noLoadedPeriods')}</span>
                    )}
                  </div>
                </div>
                {selectedLivePeriodType === 'daily' ? (
                  <div className="store-me-v2-filter-field">
                    <span>{t('storeMe.loadedDays')}</span>
                    <div
                      className="store-me-v2-period-picklist"
                      role="group"
                      aria-label={t('storeMe.loadedDaySelect')}
                    >
                      {scopedAvailableDailyPeriods.length ? (
                        scopedAvailableDailyPeriods.map((period) => {
                          const label = formatLivePeriodOptionLabel(locale, period)
                          const periodKey = getLivePeriodOptionKey(period)

                          return (
                            <label
                              className={`store-me-v2-period-check${isSelectionKeyChecked(selectedLiveDayStarts, periodKey) ? ' active' : ''}`}
                              key={`${period.periodType}-${periodKey}`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelectionKeyChecked(selectedLiveDayStarts, periodKey)}
                                onChange={() => toggleLiveDaySelection(period)}
                                disabled={sourceMode !== 'live'}
                              />
                              <span>{label}</span>
                            </label>
                          )
                        })
                      ) : (
                        <span className="store-me-v2-period-empty">{t('storeMe.noLoadedPeriods')}</span>
                      )}
                    </div>
                  </div>
                ) : null}
                {usesClosedSnapshotMode ? (
                  <label className="store-me-v2-filter-field">
                    <span>{t('storeMe.closedSnapshotSelect')}</span>
                    <select
                      value={
                        selectedClosedSnapshotRunId ||
                        activeClosedSnapshotRun?.snapshotRunId ||
                        ''
                      }
                      onChange={(event) =>
                        dispatch({ type: 'setClosedSnapshotRunId', snapshotRunId: event.target.value })
                      }
                      disabled={sourceMode !== 'closed' || availableClosedSnapshotRuns.length === 0}
                    >
                      <option value="">{t('storeMe.latestClosedSnapshot')}</option>
                      {availableClosedSnapshotRuns.map((run) => (
                        <option key={run.snapshotRunId} value={run.snapshotRunId}>
                          {formatSnapshotOptionLabel(run, locale)}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
            ) : null}
          </section>

          <div className="store-me-v2-layout">
            <aside className="store-me-v2-panel store-me-v2-score-panel" aria-label={t('storeMe.performanceScore')}>
              <div className="store-me-v2-score-head">
                <div>
                  <span>{t('storeMe.overallPerformance')}</span>
                  <strong>{t('storeMe.personalScoreCard')}</strong>
                </div>
                <div className="store-me-v2-status-chip">
                  <i />
                  {partial.isPartial ? t('storeMe.incompleteData') : gradeLabel}
                </div>
              </div>

              <div className="store-me-v2-score-core">
                <div
                  className="store-me-v2-score-orbit"
                  style={{ '--store-me-v2-score': `${scoreValue}%` } as CSSProperties}
                >
                  <div className="store-me-v2-score-number">
                    <strong>{scoreValue}</strong>
                    <span>/100</span>
                    <small>{scoreDeltaLabel}</small>
                  </div>
                </div>
              </div>

              <div className="store-me-v2-rank-ladder" aria-label={t('storeMe.generalScoreRankings')}>
                <article className="store-me-v2-rank-card">
                  <span>{t('storeMe.store')}</span>
                  <strong>{formatRank(performance.rankings.storeRank, t)}</strong>
                  <small>{formatPopulation(performance.rankings.storePopulation, t)}</small>
                </article>
                <article className="store-me-v2-rank-card">
                  <span>{t('storeMe.region')}</span>
                  <strong>{t('storeMe.noData')}</strong>
                  <small>{t('storeMe.regionRankPending')}</small>
                </article>
                <article className="store-me-v2-rank-card">
                  <span>{t('storeMe.turkey')}</span>
                  <strong>{formatRank(performance.rankings.turkeyRank, t)}</strong>
                  <small>{formatPopulation(performance.rankings.turkeyPopulation, t)}</small>
                </article>
              </div>

              <section className="store-me-v2-coach-card" aria-label={t('storeMe.coachingMode')}>
                <span>{t('storeMe.coachingMode')}</span>
                <strong>{scoreMeaning.focus}</strong>
                <p>{scoreMeaning.confidence}</p>
              </section>
            </aside>

            <section className="store-me-v2-workspace">
              <section className="store-me-v2-panel store-me-v2-hero-panel" aria-label={t('storeMe.performanceSummary')}>
                <div className="store-me-v2-hero-copy">
                  <h2>{t('storeMe.v2HeroTitle')}</h2>
                  <p>{scoreMeaning.summary}</p>
                  <section className="store-me-v2-target-progress-card" aria-label={t('storeMe.targetProgress')}>
                    <div className="store-me-v2-target-progress-head">
                      <div>
                        <span>{t('storeMe.targetProgress')}</span>
                        <strong>{t('storeMe.targetProgressPercent', { value: targetProgressPercent })}</strong>
                      </div>
                      <em>{targetStatusLabel}</em>
                    </div>
                    <div className="store-me-v2-target-progress-track" aria-hidden="true">
                      <i style={{ '--store-me-v2-fill': `${targetProgressPercent}%` } as CSSProperties} />
                    </div>
                    <div className="store-me-v2-target-progress-meta">
                      <div>
                        <span>{t('storeMe.target')}</span>
                        <strong>{formatCurrency(locale, t, targetSalesValue)}</strong>
                      </div>
                      <div>
                        <span>{t('storeMe.actual')}</span>
                        <strong>{formatCurrency(locale, t, supporting.netSalesValue)}</strong>
                      </div>
                      <div>
                        <span>{t('storeMe.remaining')}</span>
                        <strong>{formatCurrency(locale, t, remainingTargetValue)}</strong>
                      </div>
                    </div>
                  </section>
                  <div className="store-me-v2-hero-actions">
                    <a className="store-me-v2-primary-button" href="#store-me-v2-actions">
                      {t('storeMe.todayFocus')}
                    </a>
                    <button
                      className="store-me-v2-secondary-button"
                      type="button"
                      onClick={() => dispatch({ type: 'setKpiDetailOpen', open: true })}
                    >
                      {t('storeMe.kpiDetails')}
                    </button>
                  </div>
                </div>

                <article className="store-me-v2-compare-card" aria-label={t('storeMe.samePeriodComparison')}>
                  <div>
                    <span>{t('storeMe.samePeriodComparison')}</span>
                    <strong>
                      {samePeriodScoreDelta
                        ? t('storeMe.samePeriodSummary', { value: samePeriodScoreDelta })
                        : t('storeMe.noTrendData')}
                    </strong>
                  </div>
                  <div className="store-me-v2-mini-bars" aria-label={t('storeMe.samePeriodComparison')}>
                    {samePeriodMetrics.map((metric) => (
                      <div className="store-me-v2-mini-bar" key={metric.code}>
                        <b>{metric.label}</b>
                        <i style={{ '--store-me-v2-width': metric.width } as CSSProperties} />
                        <em>{metric.delta ?? t('storeMe.noData')}</em>
                      </div>
                    ))}
                  </div>
                </article>
              </section>

              {partial.isPartial ? (
                <section className="store-me-v2-alert" aria-label={t('storeMe.partialTitle')}>
                  <strong>{t('storeMe.partialTitle')}</strong>
                  <p>
                    {t('storeMe.missingMetrics', {
                      labels: partial.missingMetricLabels.join(', ') || t('storeMe.noMetricDetail'),
                    })}
                  </p>
                  {pendingNormalizationLabels.length ? (
                    <p>
                      {t('storeMe.pendingNormalization', {
                        labels: pendingNormalizationLabels.join(', '),
                      })}
                    </p>
                  ) : null}
                </section>
              ) : null}

              <section id="metrics" className="store-me-v2-metric-grid" aria-label={t('storeMe.kpiDetails')}>
                {metricCards.map((card) => (
                  <article className={`store-me-v2-metric-card ${card.tone}`} key={card.code}>
                    <div className="store-me-v2-metric-top">
                      <span>{card.label}</span>
                      <small>{card.statusLabel}</small>
                    </div>
                    <div className="store-me-v2-metric-value">
                      <strong>{card.displayValue}</strong>
                      <span>{card.narrative}</span>
                    </div>
                    <div className="store-me-v2-metric-track" aria-hidden="true">
                      <i style={{ '--store-me-v2-fill': `${card.progressPercent}%` } as CSSProperties} />
                    </div>
                    <div className="store-me-v2-metric-ranks">
                      <div>
                        <span>{t('storeMe.store')}</span>
                        <strong>{formatRank(performance.rankings.storeRank, t)}</strong>
                      </div>
                      <div>
                        <span>{t('storeMe.region')}</span>
                        <strong>{t('storeMe.noData')}</strong>
                      </div>
                      <div>
                        <span>{t('storeMe.turkey')}</span>
                        <strong>{formatRank(performance.rankings.turkeyRank, t)}</strong>
                      </div>
                    </div>
                    <p>{t('storeMe.metricCardCopy', { metric: card.label })}</p>
                  </article>
                ))}
              </section>

              <section className="store-me-v2-lower-grid">
                <section className="store-me-v2-panel store-me-v2-timeline" aria-label={t('storeMe.progressLine')}>
                  <div className="store-me-v2-section-head">
                    <div>
                      <h3>{t('storeMe.progressLine')}</h3>
                      <p>{t('storeMe.progressLineCopy')}</p>
                    </div>
                    <span>{samePeriodScoreDelta ?? t('storeMe.noTrendData')}</span>
                  </div>
                  <div className="store-me-v2-chart-card">
                    <div className="store-me-v2-y-axis"><span>100</span><span>75</span><span>50</span><span>25</span></div>
                    <div className="store-me-v2-chart-grid" />
                    <svg className="store-me-v2-chart-svg" viewBox="0 0 640 210" preserveAspectRatio="none" aria-hidden="true">
                      <defs>
                        <linearGradient id="storeMeV2Area" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.22" />
                          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <polygon className="area" points={trendPoints.area} />
                      <polyline className="line" points={trendPoints.line} />
                    </svg>
                    <div className="store-me-v2-chart-legend">
                      <span className="current">{t('storeMe.thisPeriod')}</span>
                      <span className="previous">{t('storeMe.previousComparablePeriod')}</span>
                    </div>
                  </div>
                </section>

                <section id="store-me-v2-actions" className="store-me-v2-panel store-me-v2-actions" aria-label={t('storeMe.todayCoaching')}>
                  <div className="store-me-v2-section-head">
                    <div>
                      <h3>{t('storeMe.todayCoaching')}</h3>
                      <p>{t('storeMe.todayCoachingCopy')}</p>
                    </div>
                  </div>

                  <div className="store-me-v2-action-list">
                    <article className="store-me-v2-action-row focus">
                      <div className="store-me-v2-action-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24">
                          <path d="M4 12h16" />
                          <path d="M12 4v16" />
                        </svg>
                      </div>
                      <div>
                        <strong>{t('storeMe.action.keepRhythm.title')}</strong>
                        <span>{t('storeMe.action.keepRhythm.copy')}</span>
                      </div>
                      <small>{t('storeMe.priorityOne')}</small>
                    </article>

                    <article className="store-me-v2-action-row growth">
                      <div className="store-me-v2-action-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24">
                          <path d="M4 18 10 12l4 4 6-9" />
                          <path d="M15 7h5v5" />
                        </svg>
                      </div>
                      <div>
                        <strong>{t('storeMe.action.growBasket.title')}</strong>
                        <span>{t('storeMe.action.growBasket.copy')}</span>
                      </div>
                      <small>{t('storeMe.opportunity')}</small>
                    </article>

                    <article className="store-me-v2-action-row target">
                      <div className="store-me-v2-action-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="8" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </div>
                      <div>
                        <strong>{t('storeMe.action.trackTarget.title')}</strong>
                        <span>{t('storeMe.action.trackTarget.copy')}</span>
                      </div>
                      <small>{t('storeMe.follow')}</small>
                    </article>
                  </div>
                </section>
              </section>
            </section>
          </div>
        </section>
      </main>

      {isKpiDetailOpen ? (
        <div
          className="store-me-v2-dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              dispatch({ type: 'setKpiDetailOpen', open: false })
            }
          }}
        >
          <section
            className="store-me-v2-kpi-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="store-me-v2-kpi-dialog-title"
          >
            <div className="store-me-v2-kpi-dialog-head">
              <div>
                <span>{t('storeMe.kpiDetails')}</span>
                <h3 id="store-me-v2-kpi-dialog-title">
                  {t('storeMe.monthlyPerformanceTitle', {
                    name: performance.employee.displayName,
                  })}
                </h3>
                <p>{t('storeMe.monthlyPerformanceCopy')}</p>
              </div>
              <button
                className="store-me-v2-dialog-close"
                type="button"
                aria-label={t('storeMe.closeKpiDetails')}
                onClick={() => dispatch({ type: 'setKpiDetailOpen', open: false })}
              >
                <X size={20} />
              </button>
            </div>
            <div className="store-me-v2-monthly-table" aria-label={t('storeMe.monthlyPerformanceTable')}>
              <div className="store-me-v2-monthly-row header" aria-hidden="true">
                <span>{t('storeMe.month')}</span>
                <span>{t('storeMe.score')}</span>
                <span>{t('storeMe.metric.uptShort')}</span>
                <span>{t('storeMe.metric.atvShort')}</span>
                <span>{t('storeMe.metric.hgShort')}</span>
                <span>{t('storeMe.monthlyTrend')}</span>
              </div>
              {monthlyDetailRows.map((row) => (
                <article className="store-me-v2-monthly-row" key={row.key}>
                  <div>
                    <strong>{row.label}</strong>
                    <small>{row.periodNote}</small>
                  </div>
                  <b>{row.scoreLabel}</b>
                  <b>{row.uptLabel}</b>
                  <b>{row.atvLabel}</b>
                  <b>{row.targetLabel}</b>
                  <div className="store-me-v2-trend-strip">
                    <i style={{ '--store-me-v2-width': row.trendWidth } as CSSProperties} />
                    <em>{row.trendLabel ?? t('storeMe.noTrendData')}</em>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      <nav className="store-me-v2-mobile-dock" aria-label={t('storeMe.mobileNav')}>
        <NavLink to="/store/home">{t('storeMe.nav.home')}</NavLink>
        <NavLink to="/store/me">{t('storeMe.nav.me')}</NavLink>
        <NavLink to="/store/rankings">{t('storeMe.nav.rankings')}</NavLink>
        <NavLink to="/store/approvals">{t('storeMe.nav.targets')}</NavLink>
      </nav>
    </section>
  )
}
