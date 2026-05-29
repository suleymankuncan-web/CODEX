import { useMemo, useReducer } from 'react'
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ArrowUpDown, ChevronLeft, ChevronRight, Search, Store, Trophy, UsersRound, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { AuthSessionSummary } from '../features/auth/api'
import type { TranslateFunction, TranslationKey } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import {
  getRankings,
  type PersonnelRankingRow,
  type RankingMetricValue,
  type RankingReferenceGroup,
  type RankingSummary,
  type StoreRankingRow,
} from '../features/reports/api'
import { formatDate, formatNumber as formatIntlNumber, getErrorMessage } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import { transientQueryRetryOptions } from '../lib/query-retry'
import { canOpenPersonnelProfileFromRanking } from './store-rankings-scope'
import {
  StoreErrorState,
  StoreEmptyState,
  StoreInfoGrid,
  StoreLoadingState,
  StoreMetricCard,
  StoreMetricGrid,
  StoreSectionCard,
  StoreStackedList,
  StoreStackedRow,
  StoreStatusBadge,
  StoreSurfaceHeader,
  StoreSurfacePage,
} from './store-surface-primitives'

const privilegedRankingRoles = ['REGION_MANAGER', 'SUPER_ADMIN']
const rankingRoles = ['STORE_PERSONNEL', 'STORE_MANAGER', ...privilegedRankingRoles]
const storeMetricCodes = ['UPT', 'ATV', 'CR', 'TARGET_ACHIEVEMENT', 'BM_CHECKLIST', 'VM_CHECKLIST'] as const
const personnelMetricCodes = ['UPT', 'ATV', 'TARGET_ACHIEVEMENT'] as const
const latestPeriodSelectValue = '__latest__'
const allSelectValue = '__all__'

type ActiveRankingList = 'stores' | 'personnel'
type RankingSortKey = 'score' | typeof storeMetricCodes[number]
type RankingSortDirection = 'asc' | 'desc'
type RankingDetailSelection =
  | { type: 'store'; row: StoreRankingRow }
  | { type: 'personnel'; row: PersonnelRankingRow }
  | null

type StoreRankingsPageState = {
  periodStart: string
  regionManagerUserId: string
  regionId: string
  storeId: string
  search: string
  offset: number
  activeList: ActiveRankingList
  sortKey: RankingSortKey
  sortDirection: RankingSortDirection
  selectedDetail: RankingDetailSelection
}

type StoreRankingsTextFilter =
  | 'periodStart'
  | 'regionManagerUserId'
  | 'regionId'
  | 'storeId'
  | 'search'

type StoreRankingsPageAction =
  | { type: 'setFilter'; field: StoreRankingsTextFilter; value: string }
  | { type: 'setOffset'; value: number }
  | { type: 'clearFilters' }
  | { type: 'setActiveList'; value: ActiveRankingList }
  | { type: 'setSort'; value: RankingSortKey }
  | { type: 'setSelectedDetail'; value: RankingDetailSelection }

type SortableRankingRow = {
  scoreValue: number
  metrics?: RankingMetricValue[]
}

const initialStoreRankingsPageState: StoreRankingsPageState = {
  periodStart: '',
  regionManagerUserId: '',
  regionId: '',
  storeId: '',
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

function canUseRankings(authSummary: AuthSessionSummary | null) {
  return hasAnyRole(authSummary?.user.roleCodes ?? [], rankingRoles)
}

function canUsePrivilegedFilters(authSummary: AuthSessionSummary | null) {
  return hasAnyRole(authSummary?.user.roleCodes ?? [], privilegedRankingRoles)
}

function formatNumber(
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

function formatPercent(
  locale: AppLocale,
  t: TranslateFunction,
  input: number | null | undefined,
) {
  if (input === null || input === undefined || !Number.isFinite(input)) {
    return t('common.noData')
  }

  return `${formatNumber(locale, t, input * 100)}%`
}

function formatMetricValue(
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

function formatRank(t: TranslateFunction, rank: number | null, population: number) {
  return rank !== null
    ? t('common.rankFraction', { rank, population })
    : t('common.notRanked')
}

function formatRankBadge(t: TranslateFunction, rank: number | null) {
  return rank !== null ? `#${rank}` : t('common.notRanked')
}

function getScoreFill(input: number | null | undefined) {
  if (input === null || input === undefined || !Number.isFinite(input)) {
    return 0
  }

  return Math.max(0, Math.min(100, Math.round(input)))
}

function formatPeriod(
  source: RankingSummary['source'] | undefined,
  locale: AppLocale,
  t: TranslateFunction,
) {
  if (!source?.periodStart || !source.periodEnd) {
    return t('common.latestMonthlyData')
  }

  return `${formatDate(source.periodStart, locale)} - ${formatDate(source.periodEnd, locale)}`
}

function formatMode(t: TranslateFunction, ranking?: RankingSummary) {
  return ranking?.access.globalMode === 'full'
    ? t('storeRankings.mode.full')
    : t('storeRankings.mode.top100')
}

function getMetricLabel(t: TranslateFunction, code: string, fallback?: string) {
  if (code === 'TARGET_ACHIEVEMENT') {
    return 'HG%'
  }

  const key = metricLabelKeyByCode[code]
  return key ? t(key) : fallback ?? code
}

function getMetricByCode(metrics: RankingMetricValue[] | undefined, code: string) {
  return metrics?.find((metric) => metric.code === code)
}

function getMetricComparableValue(metric: RankingMetricValue | undefined, code: string) {
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

function average(values: Array<number | null | undefined>) {
  const numericValues = values.filter(
    (value): value is number => value !== null && value !== undefined && Number.isFinite(value),
  )

  if (!numericValues.length) {
    return null
  }

  return numericValues.reduce((total, value) => total + value, 0) / numericValues.length
}

function getMetricAverage(rows: SortableRankingRow[], code: string) {
  return average(
    rows.map((row) => getMetricComparableValue(getMetricByCode(row.metrics, code), code)),
  )
}

function getVisibleWindow(total: number, offset: number, count: number, t: TranslateFunction) {
  if (!total || !count) {
    return t('common.noData')
  }

  return `${offset + 1}-${offset + count}`
}

function storeRankingsPageReducer(
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

function getLatestRankingFromCache(queryClient: QueryClient) {
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

export function StoreRankingsPage(input: {
  authSummary: AuthSessionSummary | null
}) {
  const { locale, t } = useLocalization()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const enabled = canUseRankings(input.authSummary)
  const privilegedSession = canUsePrivilegedFilters(input.authSummary)
  const [pageState, dispatchPageState] = useReducer(
    storeRankingsPageReducer,
    initialStoreRankingsPageState,
  )
  const {
    periodStart,
    regionManagerUserId,
    regionId,
    storeId,
    search,
    offset,
    activeList,
    sortKey,
    sortDirection,
    selectedDetail,
  } = pageState
  const limit = 100
  const hasNonDefaultSort = sortKey !== 'score' || sortDirection !== 'desc'
  const setFilter = (field: StoreRankingsTextFilter) => (value: string) => {
    dispatchPageState({ type: 'setFilter', field, value })
  }
  const updateSort = (nextSortKey: RankingSortKey) => {
    dispatchPageState({ type: 'setSort', value: nextSortKey })
  }

  const rankingsQuery = useQuery({
    queryKey: [
      'ranking-v1',
      periodStart || 'latest',
      privilegedSession ? regionManagerUserId : '',
      privilegedSession ? regionId : '',
      privilegedSession ? storeId : '',
      privilegedSession ? search : '',
      privilegedSession ? sortKey : 'score',
      privilegedSession ? sortDirection : 'desc',
      privilegedSession ? offset : 0,
    ],
    queryFn: () =>
      getRankings({
        ...(periodStart ? { periodStart } : {}),
        ...(privilegedSession && regionManagerUserId ? { regionManagerUserId } : {}),
        ...(privilegedSession && regionId ? { regionId } : {}),
        ...(privilegedSession && storeId ? { storeId } : {}),
        ...(privilegedSession && search ? { search } : {}),
        ...(privilegedSession && hasNonDefaultSort
          ? { sortKey, sortDirection }
          : {}),
        limit,
        offset: privilegedSession ? offset : 0,
      }),
    enabled,
    placeholderData: (previousData) => previousData,
    ...transientQueryRetryOptions,
  })
  const latestCachedRanking = rankingsQuery.data ? null : getLatestRankingFromCache(queryClient)
  const ranking = rankingsQuery.data ?? latestCachedRanking
  const isPrivileged = ranking?.access.globalMode === 'full'
  const canSeeGlobalDetails = Boolean(ranking?.access.canSeeGlobalDetails)
  const hasNextPage =
    Boolean(isPrivileged && ranking) &&
    Math.max(
      ranking?.storeLeaderboard.meta.total ?? 0,
      ranking?.personnelLeaderboard.meta.total ?? 0,
    ) >
      offset + limit
  const activePeriodOptions = useMemo(
    () => ranking?.availablePeriods ?? [],
    [ranking?.availablePeriods],
  )
  const storeRows = ranking?.storeLeaderboard.items ?? []
  const personnelRows = ranking?.personnelLeaderboard.items ?? []
  const canOpenPersonnelProfile = (row: PersonnelRankingRow) =>
    canOpenPersonnelProfileFromRanking(input.authSummary, row)

  if (!enabled) {
    return (
      <StoreSurfacePage ariaLabel={t('storeRankings.unavailableTitle')}>
        <StoreErrorState
          title={t('storeRankings.unavailableTitle')}
          description={t('storeRankings.unavailableCopy')}
        />
      </StoreSurfacePage>
    )
  }

  if (rankingsQuery.isLoading && !ranking) {
    return (
      <StoreLoadingState
        title={t('storeRankings.loadingTitle')}
        description={t('storeRankings.loadingCopy')}
      />
    )
  }

  if (rankingsQuery.isError && !ranking) {
    return (
      <StoreSurfacePage ariaLabel={t('storeRankings.errorTitle')}>
        <StoreErrorState
          title={t('storeRankings.errorTitle')}
          description={getErrorMessage(rankingsQuery.error)}
        />
      </StoreSurfacePage>
    )
  }

  if (!ranking) {
    return (
      <StoreSurfacePage ariaLabel={t('storeRankings.emptyTitle')}>
        <StoreErrorState
          title={t('storeRankings.emptyTitle')}
          description={t('storeRankings.emptyCopy')}
        />
      </StoreSurfacePage>
    )
  }

  return (
    <StoreSurfacePage
      ariaLabel={t('storeRankings.pageTitle')}
      className="store-rankings-surface"
      testId="store-rankings-page"
    >
      <StoreSurfaceHeader
        titleId="rankings-heading"
        eyebrow={t('storeRankings.activePeriod')}
        title={t('storeRankings.pageTitle')}
        description={
          isPrivileged
            ? t('storeRankings.pageSubtitle.privileged')
            : t('storeRankings.pageSubtitle.scoped')
        }
        badges={[
          {
            label: isPrivileged ? t('storeRankings.fullScope') : t('storeRankings.top100Scope'),
            tone: 'accent',
          },
          { label: formatMode(t, ranking), tone: 'neutral' },
          {
            label: canSeeGlobalDetails
              ? t('storeRankings.fullDetailAccess')
              : t('storeRankings.summaryAccess'),
            tone: canSeeGlobalDetails ? 'calm' : 'warning',
          },
          ...(rankingsQuery.isFetching
            ? [{ label: t('storeRankings.loadingTitle'), tone: 'neutral' as const }]
            : []),
        ]}
      />

      <RankingSummaryStrip
        ranking={ranking}
        locale={locale}
        t={t}
        offset={offset}
        activeList={activeList}
      />

      <RankingTrustBand
        ranking={ranking}
        isPrivileged={Boolean(isPrivileged)}
        canSeeGlobalDetails={canSeeGlobalDetails}
        locale={locale}
        t={t}
      />

      <RankingControls
        ranking={ranking}
        isPrivileged={Boolean(isPrivileged)}
        periodStart={periodStart}
        regionManagerUserId={regionManagerUserId}
        regionId={regionId}
        storeId={storeId}
        search={search}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onPeriodStartChange={setFilter('periodStart')}
        onRegionManagerChange={setFilter('regionManagerUserId')}
        onRegionChange={setFilter('regionId')}
        onStoreChange={setFilter('storeId')}
        onSearchChange={setFilter('search')}
        onClearFilters={() => dispatchPageState({ type: 'clearFilters' })}
        periodOptions={activePeriodOptions}
        locale={locale}
        t={t}
      />

      <RankingReferenceBar
        ranking={ranking}
        rows={activeList === 'stores' ? storeRows : personnelRows}
        activeList={activeList}
        locale={locale}
        t={t}
      />

      <RankingWorkspace
        activeList={activeList}
        ranking={ranking}
        storeRows={storeRows}
        personnelRows={personnelRows}
        canSeeDetails={canSeeGlobalDetails}
        canOpenPersonnelProfile={canOpenPersonnelProfile}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSortChange={updateSort}
        onActiveListChange={(nextList) =>
          dispatchPageState({ type: 'setActiveList', value: nextList })
        }
        onOpenDetail={(value) => dispatchPageState({ type: 'setSelectedDetail', value })}
        onOffsetChange={(value) => dispatchPageState({ type: 'setOffset', value })}
        hasNextPage={Boolean(hasNextPage)}
        offset={offset}
        limit={limit}
        locale={locale}
        t={t}
      />

      <RankingDetailDrawer
        selection={selectedDetail}
        locale={locale}
        t={t}
        onClose={() => dispatchPageState({ type: 'setSelectedDetail', value: null })}
        canOpenPersonnelProfile={canOpenPersonnelProfile}
        onOpenPersonnelProfile={(employeeId) => {
          const path = `/store/personnel/${encodeURIComponent(employeeId)}`
          const params = new URLSearchParams()

          if (ranking.source.periodStart) {
            params.set('mode', 'live')
            params.set('periodType', 'monthly')
            params.set('periodStart', ranking.source.periodStart)
          }

          const query = params.toString()
          navigate(query ? `${path}?${query}` : path)
        }}
      />
    </StoreSurfacePage>
  )
}

function RankingTrustBand(input: {
  ranking: RankingSummary
  isPrivileged: boolean
  canSeeGlobalDetails: boolean
  locale: AppLocale
  t: TranslateFunction
}) {
  return (
    <StoreSectionCard
      ariaLabel={input.t('storeRankings.trustTitle')}
      title={input.t('storeRankings.trustTitle')}
      description={input.t('storeRankings.trustScoreNote')}
      badge={{
        label: input.canSeeGlobalDetails
          ? input.t('storeRankings.fullDetailAccess')
          : input.t('storeRankings.summaryAccess'),
        tone: input.canSeeGlobalDetails ? 'calm' : 'warning',
      }}
    >
      <StoreInfoGrid
        items={[
          {
            label: input.t('storeRankings.trustPeriodLabel'),
            value: formatPeriod(input.ranking.source, input.locale, input.t),
          },
          {
            label: input.t('storeRankings.trustScopeLabel'),
            value: input.isPrivileged
              ? input.t('storeRankings.trustScopeValue.full')
              : input.t('storeRankings.trustScopeValue.scoped'),
          },
          {
            label: input.t('storeRankings.trustScoreLabel'),
            value: input.t('storeRankings.trustScoreValue'),
          },
          {
            label: input.t('storeRankings.trustSourceLabel'),
            value: input.t('storeRankings.trustSourceValue'),
          },
        ]}
      />
    </StoreSectionCard>
  )
}

function RankingSummaryStrip(input: {
  ranking: RankingSummary
  locale: AppLocale
  t: TranslateFunction
  offset: number
  activeList: ActiveRankingList
}) {
  const activeMeta =
    input.activeList === 'stores'
      ? input.ranking.storeLeaderboard.meta
      : input.ranking.personnelLeaderboard.meta
  const activeCount =
    input.activeList === 'stores'
      ? input.ranking.storeLeaderboard.items.length
      : input.ranking.personnelLeaderboard.items.length

  return (
    <StoreMetricGrid ariaLabel={input.t('storeRankings.summaryPanelLabel')}>
      <StoreMetricCard
        icon={<Trophy size={17} />}
        title={input.t('storeRankings.activePeriod')}
        value={formatPeriod(input.ranking.source, input.locale, input.t)}
        note={input.t('storeRankings.currentMonthlyView')}
        tone="accent"
      />
      <StoreMetricCard
        icon={<Store size={17} />}
        title={input.t('storeRankings.storeScope')}
        value={formatNumber(input.locale, input.t, input.ranking.storeLeaderboard.meta.total)}
        note={input.t('common.storePopulation', {
          count: input.ranking.storeLeaderboard.meta.total,
        })}
        tone="neutral"
      />
      <StoreMetricCard
        icon={<UsersRound size={17} />}
        title={input.t('storeRankings.personnelScope')}
        value={formatNumber(input.locale, input.t, input.ranking.personnelLeaderboard.meta.total)}
        note={
          input.ranking.access.globalMode === 'full'
            ? input.t('storeRankings.allPersonnelAccess')
            : input.t('storeRankings.topPersonnelAccess')
        }
        tone="neutral"
      />
      <StoreMetricCard
        title={input.t('storeRankings.listingWindow')}
        value={getVisibleWindow(activeMeta.total, input.offset, activeCount, input.t)}
        note={input.t('storeRankings.pageWindowNote')}
        tone="calm"
      />
    </StoreMetricGrid>
  )
}

function RankingControls(input: {
  ranking: RankingSummary
  isPrivileged: boolean
  periodStart: string
  regionManagerUserId: string
  regionId: string
  storeId: string
  search: string
  sortKey: RankingSortKey
  sortDirection: RankingSortDirection
  periodOptions: RankingSummary['availablePeriods']
  onPeriodStartChange: (value: string) => void
  onRegionManagerChange: (value: string) => void
  onRegionChange: (value: string) => void
  onStoreChange: (value: string) => void
  onSearchChange: (value: string) => void
  onClearFilters: () => void
  locale: AppLocale
  t: TranslateFunction
}) {
  return (
    <StoreSectionCard
      ariaLabel={input.t('storeRankings.filtersEyebrow')}
      title={input.t('storeRankings.filtersEyebrow')}
      description={input.isPrivileged ? input.t('storeRankings.fullDetailAccess') : input.t('storeRankings.summaryAccess')}
      badge={{
        label:
          input.sortKey === 'score'
            ? input.t('storeRankings.generalScore')
            : getMetricLabel(input.t, input.sortKey),
        tone: input.sortDirection === 'desc' ? 'neutral' : 'accent',
      }}
    >
      <div className="tw:grid tw:gap-3 tw:lg:grid-cols-2 tw:2xl:grid-cols-4" role="group">
        <label className="tw:flex tw:min-w-0 tw:flex-col tw:gap-2">
          <span className="tw:text-xs tw:font-medium tw:text-muted-foreground">
            {input.t('storeRankings.search')}
          </span>
          <span className="tw:relative tw:flex tw:items-center">
            <Search
              className="tw:pointer-events-none tw:absolute tw:left-3 tw:size-4 tw:text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              className="tw:pl-9"
              value={input.search}
              onChange={(event) => input.onSearchChange(event.target.value)}
              placeholder={input.t('storeRankings.searchPlaceholder')}
              aria-label={input.t('storeRankings.searchLabel')}
              disabled={!input.isPrivileged}
              type="search"
            />
          </span>
        </label>

        <RankingSelectField
          label={input.t('storeRankings.period')}
          ariaLabel={input.t('storeRankings.periodSelectLabel')}
          value={input.periodStart || latestPeriodSelectValue}
          onValueChange={(value) =>
            input.onPeriodStartChange(value === latestPeriodSelectValue ? '' : value)
          }
          options={[
            { value: latestPeriodSelectValue, label: input.t('common.latestMonthlyData') },
            ...input.periodOptions.map((period) => ({
              value: period.periodStart,
              label: `${formatDate(period.periodStart, input.locale)} - ${formatDate(
                period.periodEnd,
                input.locale,
              )}`,
            })),
          ]}
        />

      {input.isPrivileged ? (
        <>
          <RankingSelectField
            label={input.t('storeRankings.regionManager')}
            ariaLabel={input.t('storeRankings.regionManagerFilterLabel')}
            value={input.regionManagerUserId || allSelectValue}
            onValueChange={(value) =>
              input.onRegionManagerChange(value === allSelectValue ? '' : value)
            }
            options={[
              { value: allSelectValue, label: input.t('storeRankings.allRegionManagers') },
              ...input.ranking.filters.regionManagers.map((option) => ({
                value: option.id,
                label: option.label,
              })),
            ]}
          />
          <RankingSelectField
            label={input.t('storeRankings.region')}
            ariaLabel={input.t('storeRankings.regionFilterLabel')}
            value={input.regionId || allSelectValue}
            onValueChange={(value) =>
              input.onRegionChange(value === allSelectValue ? '' : value)
            }
            options={[
              { value: allSelectValue, label: input.t('storeRankings.allRegions') },
              ...input.ranking.filters.regions.map((option) => ({
                value: option.id,
                label: option.label,
              })),
            ]}
          />
          <RankingSelectField
            label={input.t('storeRankings.store')}
            ariaLabel={input.t('storeRankings.storeFilterLabel')}
            value={input.storeId || allSelectValue}
            onValueChange={(value) =>
              input.onStoreChange(value === allSelectValue ? '' : value)
            }
            options={[
              { value: allSelectValue, label: input.t('storeRankings.allStores') },
              ...input.ranking.filters.stores.map((option) => ({
                value: option.id,
                label: option.label,
              })),
            ]}
          />
          <div className="tw:flex tw:flex-col tw:justify-end">
            <Button type="button" variant="outline" onClick={input.onClearFilters}>
              <X size={15} aria-hidden="true" />
              {input.t('storeRankings.clearFilters')}
            </Button>
          </div>
        </>
      ) : null}

        <div className="tw:flex tw:flex-col tw:justify-end tw:gap-2">
        <span className="tw:text-xs tw:font-medium tw:text-muted-foreground">{input.t('storeRankings.sort')}</span>
        <div className="tw:inline-flex tw:min-h-9 tw:items-center tw:rounded-lg tw:border tw:border-border tw:bg-card/80 tw:px-3 tw:text-sm tw:font-medium">
          {input.sortKey === 'score'
            ? input.t('storeRankings.generalScore')
            : getMetricLabel(input.t, input.sortKey)}
          {input.sortDirection === 'desc' ? ' ↓' : ' ↑'}
        </div>
      </div>
        </div>
    </StoreSectionCard>
  )
}

function RankingSelectField(input: {
  label: string
  ariaLabel: string
  value: string
  onValueChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <label className="tw:flex tw:min-w-0 tw:flex-col tw:gap-2">
      <span className="tw:text-xs tw:font-medium tw:text-muted-foreground">{input.label}</span>
      <Select value={input.value} onValueChange={input.onValueChange}>
        <SelectTrigger aria-label={input.ariaLabel} className="tw:w-full tw:min-w-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {input.options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  )
}

function RankingReferenceBar(input: {
  ranking: RankingSummary
  rows: SortableRankingRow[]
  activeList: ActiveRankingList
  locale: AppLocale
  t: TranslateFunction
}) {
  const metricCodes = input.activeList === 'stores' ? storeMetricCodes : personnelMetricCodes
  const reference =
    input.activeList === 'stores'
      ? input.ranking.reference?.store
      : input.ranking.reference?.personnel

  return (
    <StoreSectionCard
      ariaLabel={input.t('storeRankings.referenceLabel')}
      title={input.t('storeRankings.turkeyReference')}
      description={
        input.activeList === 'stores'
          ? input.t('storeRankings.storeList')
          : input.t('storeRankings.personnelList')
      }
      badge={{ label: input.t('storeRankings.trustScoreValue'), tone: 'accent' }}
    >
      <StoreInfoGrid
        items={[
          {
            label: input.t('storeRankings.averageScore'),
            value: formatNumber(
              input.locale,
              input.t,
              reference?.averageScore ?? average(input.rows.map((row) => row.scoreValue)),
            ),
            tone: 'accent',
          },
          ...metricCodes.map((code) => ({
            label: getMetricLabel(input.t, code),
            value: formatMetricValue(
              input.locale,
              input.t,
              getReferenceMetricValue(reference, input.rows, code),
              code,
            ),
          })),
        ]}
        className="tw:xl:grid-cols-4"
      />
    </StoreSectionCard>
  )
}

function getReferenceMetricValue(
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

function RankingWorkspace(input: {
  activeList: ActiveRankingList
  ranking: RankingSummary
  storeRows: StoreRankingRow[]
  personnelRows: PersonnelRankingRow[]
  canSeeDetails: boolean
  canOpenPersonnelProfile: (row: PersonnelRankingRow) => boolean
  sortKey: RankingSortKey
  sortDirection: RankingSortDirection
  onSortChange: (value: RankingSortKey) => void
  onActiveListChange: (value: ActiveRankingList) => void
  onOpenDetail: (value: RankingDetailSelection) => void
  onOffsetChange: (value: number) => void
  hasNextPage: boolean
  offset: number
  limit: number
  locale: AppLocale
  t: TranslateFunction
}) {
  const rows = input.activeList === 'stores' ? input.storeRows : input.personnelRows
  const meta =
    input.activeList === 'stores'
      ? input.ranking.storeLeaderboard.meta
      : input.ranking.personnelLeaderboard.meta
  const title =
    input.activeList === 'stores'
      ? input.t('storeRankings.storeList')
      : input.t('storeRankings.personnelList')
  const caption =
    input.activeList === 'stores'
      ? input.t('storeRankings.storeResultCaption', {
          start: meta.total ? input.offset + 1 : 0,
          end: input.offset + rows.length,
          total: meta.total,
        })
      : input.t('storeRankings.personnelResultCaption', {
          start: meta.total ? input.offset + 1 : 0,
          end: input.offset + rows.length,
          total: meta.total,
        })
  const metricCodes = input.activeList === 'stores' ? storeMetricCodes : personnelMetricCodes

  return (
    <StoreSectionCard
      title={title}
      description={caption}
      badge={{
        label: input.canSeeDetails
          ? input.t('storeRankings.fullDetailAccess')
          : input.t('storeRankings.summaryAccess'),
        tone: input.canSeeDetails ? 'calm' : 'warning',
      }}
    >
      <div className="tw:flex tw:flex-col tw:gap-4">
        <ToggleGroup
          type="single"
          value={input.activeList}
          onValueChange={(value) => {
            if (value === 'stores' || value === 'personnel') {
              input.onActiveListChange(value)
            }
          }}
          variant="outline"
          role="tablist"
          aria-label={input.t('storeRankings.listSwitchLabel')}
          className="tw:w-full tw:flex-wrap tw:justify-start"
        >
          <ToggleGroupItem
            value="stores"
            role="tab"
            aria-selected={input.activeList === 'stores'}
          >
            {input.t('storeRankings.storeList')}
          </ToggleGroupItem>
          <ToggleGroupItem
            value="personnel"
            role="tab"
            aria-selected={input.activeList === 'personnel'}
          >
            {input.t('storeRankings.personnelList')}
          </ToggleGroupItem>
        </ToggleGroup>

        <Table
          className={`store-rankings-table tw:min-w-[760px]${
            input.canSeeDetails ? ' store-rankings-table-detail' : ' store-rankings-table-summary'
          }`}
          aria-describedby="rankings-heading"
        >
          <TableCaption className="tw:sr-only">{caption}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>{input.t('storeRankings.rankColumn')}</TableHead>
              <TableHead>
                {input.activeList === 'stores'
                  ? input.t('storeRankings.store')
                  : input.t('storeRankings.personnel')}
              </TableHead>
              <TableHead>
                <SortButton
                  label={
                    input.activeList === 'stores'
                      ? input.t('storeRankings.storeScore')
                      : input.t('storeRankings.personnelScore')
                  }
                  sortKey="score"
                  activeSortKey={input.sortKey}
                  sortDirection={input.sortDirection}
                  onSortChange={input.onSortChange}
                />
              </TableHead>
              {input.canSeeDetails ? (
                <TableHead>
                  <MetricSortRow
                    metricCodes={metricCodes}
                    activeSortKey={input.sortKey}
                    sortDirection={input.sortDirection}
                    onSortChange={input.onSortChange}
                    t={input.t}
                  />
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? (
              input.activeList === 'stores' ? (
                input.storeRows.map((row) => (
                  <StoreRankingTableRow
                    key={row.storeId}
                    row={row}
                    canSeeDetails={input.canSeeDetails}
                    locale={input.locale}
                    t={input.t}
                    onOpenDetail={(nextRow) =>
                      input.onOpenDetail({ type: 'store', row: nextRow })
                    }
                  />
                ))
              ) : (
                input.personnelRows.map((row) => (
                  <PersonnelRankingTableRow
                    key={row.employeeId}
                    row={row}
                    canSeeDetails={input.canSeeDetails}
                    locale={input.locale}
                    t={input.t}
                    onOpenDetail={(nextRow) =>
                      input.onOpenDetail({ type: 'personnel', row: nextRow })
                    }
                  />
                ))
              )
            ) : (
              <TableRow>
                <TableCell colSpan={input.canSeeDetails ? 4 : 3}>
                  <StoreEmptyState
                    description={
                      input.activeList === 'stores'
                        ? input.t('storeRankings.noStores')
                        : input.t('storeRankings.noPersonnel')
                    }
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

      <div className="tw:flex tw:flex-col tw:gap-3 tw:border-t tw:pt-3 tw:text-sm tw:text-muted-foreground tw:sm:flex-row tw:sm:items-center tw:sm:justify-between" aria-label={input.t('storeRankings.pagination')}>
        <span className="tw:font-medium">
          {input.t('storeRankings.pageInfo', {
            start: meta.total ? input.offset + 1 : 0,
            end: input.offset + rows.length,
            total: meta.total,
          })}
        </span>
        <div className="tw:flex tw:gap-2">
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={() => input.onOffsetChange(Math.max(0, input.offset - input.limit))}
            disabled={input.offset === 0}
            aria-label={input.t('storeRankings.previousPageLabel')}
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={() => input.onOffsetChange(input.offset + input.limit)}
            disabled={!input.hasNextPage}
            aria-label={input.t('storeRankings.nextPageLabel')}
          >
            <ChevronRight size={16} aria-hidden="true" />
          </Button>
        </div>
      </div>
      </div>
    </StoreSectionCard>
  )
}

function SortButton(input: {
  label: string
  sortKey: RankingSortKey
  activeSortKey: RankingSortKey
  sortDirection: RankingSortDirection
  onSortChange: (value: RankingSortKey) => void
}) {
  const active = input.activeSortKey === input.sortKey

  return (
    <Button
      className="store-rankings-sort-button"
      type="button"
      size="sm"
      variant={active ? 'default' : 'ghost'}
      onClick={() => input.onSortChange(input.sortKey)}
      aria-sort={active ? (input.sortDirection === 'desc' ? 'descending' : 'ascending') : 'none'}
    >
      <ArrowUpDown aria-hidden="true" />
      {input.label}
      {active ? <span>{input.sortDirection === 'desc' ? '↓' : '↑'}</span> : null}
    </Button>
  )
}

function MetricSortRow(input: {
  metricCodes: readonly string[]
  activeSortKey: RankingSortKey
  sortDirection: RankingSortDirection
  onSortChange: (value: RankingSortKey) => void
  t: TranslateFunction
}) {
  return (
    <div
      className="store-rankings-metric-sort-row tw:grid tw:grid-cols-2 tw:gap-2 tw:md:grid-cols-6"
    >
      {input.metricCodes.map((code) => (
        <SortButton
          key={code}
          label={getMetricLabel(input.t, code)}
          sortKey={code as RankingSortKey}
          activeSortKey={input.activeSortKey}
          sortDirection={input.sortDirection}
          onSortChange={input.onSortChange}
        />
      ))}
    </div>
  )
}

function StoreRankingTableRow(input: {
  row: StoreRankingRow
  canSeeDetails: boolean
  locale: AppLocale
  t: TranslateFunction
  onOpenDetail: (row: StoreRankingRow) => void
}) {
  const row = input.row

  return (
    <TableRow>
      <TableCell data-label={input.t('storeRankings.rankColumn')}>
        <StoreStatusBadge tone="accent">{formatRankBadge(input.t, row.rank)}</StoreStatusBadge>
      </TableCell>
      <TableCell data-label={input.t('storeRankings.store')}>
        <RankingEntity
          label={row.storeName ?? row.storeId}
          canOpen={input.canSeeDetails}
          onOpen={() => input.onOpenDetail(row)}
        />
      </TableCell>
      <TableCell data-label={input.t('storeRankings.storeScore')}>
        <RankingScore value={row.scoreValue} locale={input.locale} t={input.t} />
      </TableCell>
      {input.canSeeDetails ? (
        <TableCell data-label={input.t('storeRankings.metricDetailsLabel')}>
          <MetricDetails
            metrics={row.metrics ?? []}
            metricCodes={storeMetricCodes}
            locale={input.locale}
            t={input.t}
          />
        </TableCell>
      ) : null}
    </TableRow>
  )
}

function PersonnelRankingTableRow(input: {
  row: PersonnelRankingRow
  canSeeDetails: boolean
  locale: AppLocale
  t: TranslateFunction
  onOpenDetail: (row: PersonnelRankingRow) => void
}) {
  const row = input.row

  return (
    <TableRow>
      <TableCell data-label={input.t('storeRankings.rankColumn')}>
        <StoreStatusBadge tone="accent">{formatRankBadge(input.t, row.rank)}</StoreStatusBadge>
      </TableCell>
      <TableCell data-label={input.t('storeRankings.personnel')}>
        <RankingEntity
          label={row.displayName}
          caption={row.storeName ?? input.t('storeRankings.noStore')}
          canOpen={input.canSeeDetails}
          onOpen={() => input.onOpenDetail(row)}
        />
      </TableCell>
      <TableCell data-label={input.t('storeRankings.personnelScore')}>
        <RankingScore value={row.scoreValue} locale={input.locale} t={input.t} />
      </TableCell>
      {input.canSeeDetails ? (
        <TableCell data-label={input.t('storeRankings.metricDetailsLabel')}>
          <MetricDetails
            metrics={row.metrics ?? []}
            metricCodes={personnelMetricCodes}
            locale={input.locale}
            t={input.t}
          />
        </TableCell>
      ) : null}
    </TableRow>
  )
}

function RankingEntity(input: {
  label: string
  caption?: string
  canOpen: boolean
  onOpen: () => void
}) {
  return (
    <div className="tw:flex tw:min-w-0 tw:flex-col">
      {input.canOpen ? (
        <Button
          type="button"
          variant="link"
          className="tw:h-auto tw:w-fit tw:max-w-full tw:justify-start tw:p-0 tw:text-left tw:font-semibold"
          onClick={input.onOpen}
        >
          {input.label}
        </Button>
      ) : (
        <strong className="tw:text-sm tw:text-foreground">{input.label}</strong>
      )}
      {input.caption ? (
        <span className="tw:text-xs tw:text-muted-foreground">{input.caption}</span>
      ) : null}
    </div>
  )
}

function RankingScore(input: {
  value: number | null | undefined
  locale: AppLocale
  t: TranslateFunction
}) {
  return (
    <div className="store-rankings-scorebar tw:grid tw:min-w-32 tw:gap-2">
      <strong className="tw:text-sm tw:text-foreground">
        {formatNumber(input.locale, input.t, input.value)}
      </strong>
      <Progress value={getScoreFill(input.value)} />
    </div>
  )
}

function MetricDetails(input: {
  metrics: RankingMetricValue[]
  metricCodes: readonly string[]
  locale: AppLocale
  t: TranslateFunction
}) {
  if (!input.metrics.length) {
    return <span className="tw:text-sm tw:text-muted-foreground">{input.t('common.noData')}</span>
  }

  return (
    <div
      className={`store-rankings-metric-grid tw:grid tw:gap-2 tw:md:grid-cols-3${
        input.metricCodes.length > 3 ? ' tw:2xl:grid-cols-6' : ''
      }`}
      aria-label={input.t('storeRankings.metricDetailsLabel')}
    >
      {input.metricCodes.map((code) => {
        const metric = getMetricByCode(input.metrics, code)

        return (
          <div
            className={`tw:flex tw:min-h-16 tw:flex-col tw:justify-between tw:rounded-lg tw:border tw:p-2${
              metric ? ' tw:bg-card/80' : ' tw:bg-muted/30'
            }`}
            key={code}
          >
            <span className="tw:text-xs tw:font-medium tw:text-muted-foreground">
              {getMetricLabel(input.t, code, metric?.label)}
            </span>
            <strong className="tw:text-sm tw:text-foreground">
              {metric
                ? formatMetricValue(input.locale, input.t, metric, code)
                : input.t('common.noData')}
            </strong>
          </div>
        )
      })}
    </div>
  )
}

function RankingDetailDrawer(input: {
  selection: RankingDetailSelection
  locale: AppLocale
  t: TranslateFunction
  onClose: () => void
  canOpenPersonnelProfile: (row: PersonnelRankingRow) => boolean
  onOpenPersonnelProfile: (employeeId: string) => void
}) {
  if (!input.selection) {
    return null
  }

  const row = input.selection.row
  const isStore = input.selection.type === 'store'
  const title = isStore
    ? (row as StoreRankingRow).storeName ?? (row as StoreRankingRow).storeId
    : (row as PersonnelRankingRow).displayName
  const caption = isStore
    ? input.t('storeRankings.storeDetailCaption')
    : (row as PersonnelRankingRow).storeName ?? input.t('storeRankings.personnelDetailCaption')
  const metricCodes = isStore ? storeMetricCodes : personnelMetricCodes
  const personnelRow = !isStore ? (row as PersonnelRankingRow) : null

  return (
    <>
      <button
        className="store-rankings-drawer-backdrop tw:fixed tw:inset-0 tw:z-40 tw:bg-background/55 tw:backdrop-blur-sm"
        type="button"
        aria-label={input.t('storeRankings.closeDetail')}
        onClick={input.onClose}
      />
      <aside
        className="store-rankings-drawer tw:fixed tw:inset-y-3 tw:right-3 tw:z-50 tw:flex tw:w-[min(520px,calc(100vw-1.5rem))] tw:flex-col tw:overflow-hidden tw:rounded-xl tw:border tw:bg-card tw:shadow-lg"
        aria-label={input.t('storeRankings.detailPanel')}
      >
        <div className="tw:flex tw:flex-col tw:gap-4 tw:border-b tw:p-4">
          <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
            <Button type="button" variant="outline" onClick={input.onClose}>
              {input.t('storeRankings.closeDetail')}
            </Button>
            {personnelRow && input.canOpenPersonnelProfile(personnelRow) ? (
              <Button
                type="button"
                variant="default"
                onClick={() => input.onOpenPersonnelProfile(personnelRow.employeeId)}
              >
                {input.t('storeRankings.openPersonnelProfile')}
              </Button>
            ) : null}
            <StoreStatusBadge tone="neutral">{input.t('storeRankings.inlineDetail')}</StoreStatusBadge>
          </div>
          <div>
            <h2 className="tw:text-xl tw:font-semibold tw:text-foreground">{title}</h2>
            <span className="tw:text-sm tw:text-muted-foreground">{caption}</span>
          </div>
        </div>
        <div className="tw:flex tw:flex-1 tw:flex-col tw:gap-4 tw:overflow-y-auto tw:p-4">
          <StoreInfoGrid
            className="tw:xl:grid-cols-3"
            items={[
              {
                label: isStore ? input.t('storeRankings.storeScore') : input.t('storeRankings.personnelScore'),
                value: formatNumber(input.locale, input.t, row.scoreValue),
              },
              { label: input.t('storeRankings.turkeyRank'), value: formatRankBadge(input.t, row.rank) },
              {
                label: personnelRow ? input.t('storeRankings.storeRank') : input.t('storeRankings.scope'),
                value: personnelRow
                  ? formatRank(input.t, personnelRow.storeRank, personnelRow.storePopulation)
                  : formatRank(input.t, row.rank, row.population),
              },
            ]}
          />
          <StoreStackedList>
          <StoreStackedRow>
            <div className="tw:flex tw:flex-col tw:gap-3">
              <h3 className="tw:text-sm tw:font-semibold tw:text-foreground">
                {input.t('storeRankings.kpiDistribution')}
              </h3>
              <MetricDetails
                metrics={row.metrics ?? []}
                metricCodes={metricCodes}
                locale={input.locale}
                t={input.t}
              />
            </div>
          </StoreStackedRow>
          <StoreStackedRow>
            <div className="tw:flex tw:flex-col tw:gap-3">
              <div className="tw:flex tw:items-start tw:justify-between tw:gap-3">
                <h3 className="tw:text-sm tw:font-semibold tw:text-foreground">
                  {input.t('storeRankings.monthlyProgress')}
                </h3>
                <StoreStatusBadge tone="neutral">{input.t('storeRankings.loadedPeriod')}</StoreStatusBadge>
              </div>
              <div className="tw:grid tw:gap-2">
                <span className="tw:text-sm tw:text-muted-foreground">
                  {input.t('storeRankings.currentPeriod')}
                </span>
                <strong className="tw:text-sm tw:text-foreground">
                  {formatNumber(input.locale, input.t, row.scoreValue)}
                </strong>
                <Progress value={getScoreFill(row.scoreValue)} />
              </div>
            </div>
          </StoreStackedRow>
          <StoreStackedRow>
            <h3 className="tw:text-sm tw:font-semibold tw:text-foreground">
              {input.t('storeRankings.coachingNote')}
            </h3>
            <p className="tw:mt-2 tw:text-sm tw:leading-6 tw:text-muted-foreground">
              {input.t(
                isStore
                  ? 'storeRankings.storeDetailNote'
                  : 'storeRankings.personnelDetailNote',
              )}
            </p>
          </StoreStackedRow>
          </StoreStackedList>
        </div>
      </aside>
    </>
  )
}
