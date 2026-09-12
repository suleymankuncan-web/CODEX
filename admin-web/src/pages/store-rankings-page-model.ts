import type { AuthSessionSummary } from '../features/auth/api'
import type { TranslateFunction, TranslationKey } from '../features/localization/dictionary'
import type {
  RankingMetricValue,
  RankingReferenceGroup,
  RankingSummary,
} from '../features/reports/api'
import { formatDate, formatNumber as formatIntlNumber } from '../lib/format'
import type { AppLocale } from '../lib/i18n'

export const privilegedRankingRoles = ['REGION_MANAGER', 'SUPER_ADMIN', 'REPORT_VIEWER']
export const rankingRoles = ['STORE_PERSONNEL', 'STORE_MANAGER', ...privilegedRankingRoles]
export const storeMetricCodes = ['TARGET_ACHIEVEMENT', 'ATV', 'UPT', 'CR', 'gsm_approval', 'BM_CHECKLIST', 'VM_CHECKLIST'] as const
export const personnelMetricCodes = ['TARGET_ACHIEVEMENT', 'ATV', 'UPT'] as const
export const rankingPageSize = 100

export function currentRankingPeriod() {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
}

export type ActiveRankingList = 'stores' | 'personnel'
export type RankingSortKey = 'score' | typeof storeMetricCodes[number]
export type RankingSortDirection = 'asc' | 'desc'

export type StoreRankingsPageState = {
  periodStart: string
  regionManagerUserId: string
  regionId: string
  storeId: string
  dayOfMonth: string
  rangeStart: string
  rangeEnd: string
  search: string
  offset: number
  activeList: ActiveRankingList
  sortKey: RankingSortKey
  sortDirection: RankingSortDirection
}

export type StoreRankingsTextFilter =
  | 'periodStart'
  | 'regionManagerUserId'
  | 'regionId'
  | 'storeId'
  | 'dayOfMonth'
  | 'search'

export type StoreRankingsPageAction =
  | { type: 'setFilter'; field: StoreRankingsTextFilter; value: string }
  | { type: 'setPeriod'; periodStart: string; dayOfMonth: string; rangeStart?: string; rangeEnd?: string }
  | { type: 'setOffset'; value: number }
  | { type: 'clearFilters' }
  | { type: 'setActiveList'; value: ActiveRankingList }
  | { type: 'setSort'; value: RankingSortKey }

export type SortableRankingRow = {
  scoreValue: number
  metrics?: RankingMetricValue[]
}

export const initialStoreRankingsPageState: StoreRankingsPageState = {
  periodStart: '',
  regionManagerUserId: '',
  regionId: '',
  storeId: '',
  dayOfMonth: '',
  rangeStart: '',
  rangeEnd: '',
  search: '',
  offset: 0,
  activeList: 'stores',
  sortKey: 'score',
  sortDirection: 'desc',
}

const rankingSortKeys = new Set<RankingSortKey>(['score', ...storeMetricCodes])

export function getInitialRankingsActiveList(searchParams: URLSearchParams): ActiveRankingList {
  return searchParams.get('list') === 'personnel' ? 'personnel' : 'stores'
}

export function createInitialStoreRankingsPageState(
  searchParams: URLSearchParams,
): StoreRankingsPageState {
  const sortKey = searchParams.get('sort')
  const page = Number.parseInt(searchParams.get('page') ?? '1', 10)

  return {
    ...initialStoreRankingsPageState,
    activeList: getInitialRankingsActiveList(searchParams),
    dayOfMonth: parseRankingDay(searchParams.get('day')),
    rangeStart: parseRankingPeriodStart(searchParams.get('from')),
    rangeEnd: parseRankingPeriodStart(searchParams.get('to')),
    offset: Number.isFinite(page) && page > 1 ? (page - 1) * rankingPageSize : 0,
    periodStart: parseRankingPeriodStart(searchParams.get('period')) || currentRankingPeriod(),
    regionId: searchParams.get('region')?.trim() ?? '',
    regionManagerUserId: searchParams.get('regionManager')?.trim() ?? '',
    search: searchParams.get('q')?.trim() ?? '',
    sortDirection: searchParams.get('dir') === 'asc' ? 'asc' : 'desc',
    sortKey: sortKey && rankingSortKeys.has(sortKey as RankingSortKey) ? (sortKey as RankingSortKey) : 'score',
    storeId: searchParams.get('store')?.trim() ?? '',
  }
}

export function buildStoreRankingsSearchParams(state: StoreRankingsPageState) {
  const params = new URLSearchParams()
  if (state.activeList === 'personnel') params.set('list', 'personnel')
  if (state.periodStart) params.set('period', state.periodStart)
  if (state.rangeStart && state.rangeEnd) { params.set('from', state.rangeStart); params.set('to', state.rangeEnd) }
  if (state.dayOfMonth) params.set('day', state.dayOfMonth)
  if (state.search.trim()) params.set('q', state.search.trim())
  if (state.sortKey !== 'score' || state.sortDirection !== 'desc') {
    params.set('sort', state.sortKey)
    params.set('dir', state.sortDirection)
  }
  if (state.offset > 0) params.set('page', String(Math.floor(state.offset / rankingPageSize) + 1))
  if (state.regionManagerUserId) params.set('regionManager', state.regionManagerUserId)
  if (state.regionId) params.set('region', state.regionId)
  if (state.storeId) params.set('store', state.storeId)
  return params
}

function parseRankingPeriodStart(input: string | null) {
  if (!input || !/^\d{4}-\d{2}-\d{2}$/.test(input)) return ''
  const date = new Date(`${input}T12:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === input ? input : ''
}

function parseRankingDay(input: string | null) {
  if (!input) return ''
  const day = Number.parseInt(input, 10)
  return Number.isFinite(day) && day >= 1 && day <= 31 ? String(day) : ''
}

const metricLabelKeyByCode: Record<string, TranslationKey> = {
  TARGET_ACHIEVEMENT: 'storeRankings.metric.targetAchievement',
  ATV: 'storeRankings.metric.atv',
  UPT: 'storeRankings.metric.upt',
  CR: 'storeRankings.metric.cr',
  gsm_approval: 'storeRankings.metric.gsmOnay',
  BM_CHECKLIST: 'storeRankings.metric.bmChecklist',
  VM_CHECKLIST: 'storeRankings.metric.vmChecklist',
}

function hasAnyRole(userRoles: string[], requiredRoles: string[]) {
  return requiredRoles.some((role) => userRoles.includes(role))
}

export function canUseRankings(authSummary: AuthSessionSummary | null) {
  return hasAnyRole(authSummary?.user.roleCodes ?? [], rankingRoles)
}

export function canUsePrivilegedFilters(authSummary: AuthSessionSummary | null) {
  return hasAnyRole(authSummary?.user.roleCodes ?? [], privilegedRankingRoles)
}

export function formatNumber(
  locale: AppLocale,
  t: TranslateFunction,
  input: number | null | undefined,
) {
  if (input === null || input === undefined || !Number.isFinite(input)) {
    return t('common.noData')
  }

  return formatIntlNumber(input, locale, {
    minimumFractionDigits: Number.isInteger(input) ? 0 : 2,
    maximumFractionDigits: 2,
  })
}

export function formatPercent(
  locale: AppLocale,
  t: TranslateFunction,
  input: number | null | undefined,
) {
  if (input === null || input === undefined || !Number.isFinite(input)) {
    return t('common.noData')
  }

  return `${formatNumber(locale, t, input * 100)}%`
}

export function formatMetricValue(
  locale: AppLocale,
  t: TranslateFunction,
  input: RankingMetricValue | number | null | undefined,
  code: string,
) {
  const value =
    typeof input === 'object' && input !== null
      ? getMetricComparableValue(input, code)
      : input

  if (code === 'gsm_approval') {
    return value === null || value === undefined || !Number.isFinite(Number(value))
      ? t('common.noData')
      : `%${formatNumber(locale, t, value)}`
  }

  if (code === 'CR' || code === 'TARGET_ACHIEVEMENT') {
    return formatPercent(locale, t, value)
  }

  return formatNumber(locale, t, value)
}

export function formatRank(t: TranslateFunction, rank: number | null, population: number) {
  return rank !== null
    ? t('common.rankFraction', { rank, population })
    : t('common.notRanked')
}

export function formatRankBadge(t: TranslateFunction, rank: number | null) {
  return rank !== null ? `#${rank}` : t('common.notRanked')
}

export function getScoreFill(input: number | null | undefined) {
  if (input === null || input === undefined || !Number.isFinite(input)) {
    return 0
  }

  return Math.max(0, Math.min(100, Math.round(input)))
}

export function formatPeriod(
  source: RankingSummary['source'] | undefined,
  locale: AppLocale,
  t: TranslateFunction,
) {
  if (!source?.periodStart || !source.periodEnd) {
    return t('common.latestMonthlyData')
  }

  if (source.periodStart === source.periodEnd) {
    return formatDate(source.periodStart, locale)
  }

  return `${formatDate(source.periodStart, locale)} - ${formatDate(source.periodEnd, locale)}`
}

export function formatMode(t: TranslateFunction, ranking?: RankingSummary) {
  return ranking?.access.globalMode === 'full'
    ? t('storeRankings.mode.full')
    : t('storeRankings.mode.top100')
}

export function getMetricLabel(t: TranslateFunction, code: string, fallback?: string) {
  if (code === 'TARGET_ACHIEVEMENT') {
    return 'HG%'
  }

  const key = metricLabelKeyByCode[code]
  return key ? t(key) : fallback ?? code
}

export function getMetricHeaderLabel(t: TranslateFunction, code: string, fallback?: string) {
  if (code === 'gsm_approval') {
    return 'GSM'
  }

  if (code === 'BM_CHECKLIST') {
    return 'BM'
  }

  if (code === 'VM_CHECKLIST') {
    return 'VM'
  }

  return getMetricLabel(t, code, fallback)
}

export function getMetricByCode(metrics: RankingMetricValue[] | undefined, code: string) {
  return metrics?.find((metric) => metric.code === code)
}

export function getMetricComparableValue(metric: RankingMetricValue | undefined, code: string) {
  if (!metric || metric.actualValue === null || metric.actualValue === undefined) {
    return null
  }

  if (code !== 'TARGET_ACHIEVEMENT') {
    return metric.actualValue
  }

  if (
    metric.targetValue === null ||
    metric.targetValue === undefined ||
    !Number.isFinite(metric.targetValue) ||
    metric.targetValue === 0
  ) {
    return null
  }

  return metric.actualValue / Math.abs(metric.targetValue)
}

export function average(values: Array<number | null | undefined>) {
  const numericValues = values.filter(
    (value): value is number => value !== null && value !== undefined && Number.isFinite(value),
  )

  if (!numericValues.length) {
    return null
  }

  return numericValues.reduce((total, value) => total + value, 0) / numericValues.length
}

export function getMetricAverage(rows: SortableRankingRow[], code: string) {
  return average(
    rows.map((row) => getMetricComparableValue(getMetricByCode(row.metrics, code), code)),
  )
}

export function getVisibleWindow(total: number, offset: number, count: number, t: TranslateFunction) {
  if (!total || !count) {
    return t('common.noData')
  }

  return `${offset + 1}-${offset + count}`
}

export function storeRankingsPageReducer(
  state: StoreRankingsPageState,
  action: StoreRankingsPageAction,
): StoreRankingsPageState {
  switch (action.type) {
    case 'setPeriod':
      return { ...state, periodStart: action.periodStart, dayOfMonth: action.dayOfMonth, rangeStart: action.rangeStart ?? '', rangeEnd: action.rangeEnd ?? '', offset: 0 }
    case 'setFilter':
      return { ...state, [action.field]: action.value, offset: 0 }
    case 'setOffset':
      return { ...state, offset: action.value }
    case 'clearFilters':
      return {
        ...state,
        regionManagerUserId: '',
        regionId: '',
        storeId: '',
        dayOfMonth: '',
        rangeStart: '',
        rangeEnd: '',
        search: '',
        offset: 0,
      }
    case 'setActiveList':
      return { ...state, activeList: action.value, offset: 0 }
    case 'setSort':
      return state.sortKey === action.value
        ? {
            ...state,
            offset: 0,
            sortDirection: state.sortDirection === 'desc' ? 'asc' : 'desc',
          }
        : {
            ...state,
            offset: 0,
            sortKey: action.value,
            sortDirection: 'desc',
          }
    default:
      return state
  }
}

export function getReferenceMetricValue(
  reference: RankingReferenceGroup | undefined,
  rows: SortableRankingRow[],
  code: string,
) {
  const referenceMetric = reference?.metrics.find((metric) => metric.code === code)

  if (referenceMetric) {
    return referenceMetric.value
  }

  return getMetricAverage(rows, code)
}
