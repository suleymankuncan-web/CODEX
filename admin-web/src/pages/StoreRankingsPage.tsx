import { useMemo, useReducer } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Search, Store, Trophy, UsersRound, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { AuthSessionSummary } from '../features/auth/api'
import type { TranslateFunction } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import {
  getRankings,
  type PersonnelRankingRow,
  type RankingSummary,
} from '../features/reports/api'
import { formatDate, getErrorMessage } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import { transientQueryRetryOptions } from '../lib/query-retry'
import { RankingDetailDrawer } from './store-rankings-detail-panel'
import {
  type ActiveRankingList,
  type RankingSortDirection,
  type RankingSortKey,
  type SortableRankingRow,
  type StoreRankingsTextFilter,
  allSelectValue,
  average,
  canUsePrivilegedFilters,
  canUseRankings,
  formatMetricValue,
  formatMode,
  formatNumber,
  formatPeriod,
  getLatestRankingFromCache,
  getMetricLabel,
  getReferenceMetricValue,
  getVisibleWindow,
  initialStoreRankingsPageState,
  latestPeriodSelectValue,
  personnelMetricCodes,
  storeMetricCodes,
  storeRankingsPageReducer,
} from './store-rankings-page-model'
import { canOpenPersonnelProfileFromRanking } from './store-rankings-scope'
import { RankingWorkspace } from './store-rankings-table'
import {
  StoreErrorState,
  StoreInfoGrid,
  StoreLoadingState,
  StoreMetricCard,
  StoreMetricGrid,
  StoreSectionCard,
  StoreSurfaceHeader,
  StoreSurfacePage,
} from './store-surface-primitives'

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
