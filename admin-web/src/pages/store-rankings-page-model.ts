import type { QueryClient } from '@tanstack/react-query'
import type { AuthSessionSummary } from '../features/auth/api'
import type { TranslateFunction, TranslationKey } from '../features/localization/dictionary'
import type {
  RankingMetricValue,
  RankingReferenceGroup,
  RankingSummary,
  StoreRankingRow,
} from '../features/reports/api'
import { formatDate, formatNumber as formatIntlNumber } from '../lib/format'
import type { AppLocale } from '../lib/i18n'

export const privilegedRankingRoles = ['REGION_MANAGER', 'SUPER_ADMIN']
export const rankingRoles = ['STORE_PERSONNEL', 'STORE_MANAGER', ...privilegedRankingRoles]
export const storeMetricCodes = ['UPT', 'ATV', 'TARGET_ACHIEVEMENT', 'BM_CHECKLIST', 'VM_CHECKLIST'] as const
export const personnelMetricCodes = ['UPT', 'ATV', 'TARGET_ACHIEVEMENT'] as const

export type ActiveRankingList = 'stores' | 'personnel'
export type RankingSortKey = 'score' | typeof storeMetricCodes[number]
export type RankingSortDirection = 'asc' | 'desc'
export type RankingDetailSelection = { type: 'store'; row: StoreRankingRow } | null

export type StoreRankingsPageState = {
  periodStart: string
  regionManagerUserId: string
  regionId: string
  storeId: string
  dayOfMonth: string
  search: string
  offset: number
  activeList: ActiveRankingList
  sortKey: RankingSortKey
  sortDirection: RankingSortDirection
  selectedDetail: RankingDetailSelection
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
  | { type: 'setOffset'; value: number }
  | { type: 'clearFilters' }
  | { type: 'setActiveList'; value: ActiveRankingList }
  | { type: 'setSort'; value: RankingSortKey }
  | { type: 'setSelectedDetail'; value: RankingDetailSelection }

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
  search: '',
  offset: 0,
  activeList: 'stores',
  sortKey: 'score',
  sortDirection: 'desc',
  selectedDetail: null,
}

const metricLabelKeyByCode: Record<string, TranslationKey> = {
  TARGET_ACHIEVEMENT: 'storeRankings.metric.targetAchievement',
  ATV: 'storeRankings.metric.atv',
  UPT: 'storeRankings.metric.upt',
  CR: 'storeRankings.metric.cr',
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
    return metric.actualValue
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
        search: '',
        offset: 0,
      }
    case 'setActiveList':
      return { ...state, activeList: action.value, selectedDetail: null }
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
    case 'setSelectedDetail':
      return { ...state, selectedDetail: action.value }
    default:
      return state
  }
}

export function getLatestRankingFromCache(queryClient: QueryClient) {
  const cachedRankings = queryClient
    .getQueryCache()
    .findAll({ queryKey: ['ranking-v1'] })
    .flatMap((query) => {
      const data = query.state.data as RankingSummary | undefined
      return data ? [{ data, updatedAt: query.state.dataUpdatedAt }] : []
    })
    .toSorted((left, right) => right.updatedAt - left.updatedAt)

  return cachedRankings[0]?.data ?? null
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
