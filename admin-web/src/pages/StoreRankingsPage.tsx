import { useEffect, useReducer } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useLocation, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import type { AuthSessionSummary } from '../features/auth/api'
import { useLocalization } from '../features/localization/useLocalization'
import {
  getRankings,
} from '../features/reports/api'
import { getUserFacingErrorMessage } from '../lib/format'
import { transientQueryRetryOptions } from '../lib/query-retry'
import {
  type ActiveRankingList,
  type RankingSortKey,
  type StoreRankingsTextFilter,
  buildStoreRankingsSearchParams,
  canUsePrivilegedFilters,
  canUseRankings,
  createInitialStoreRankingsPageState,
  currentRankingPeriod,
  rankingPageSize,
  storeRankingsPageReducer,
} from './store-rankings-page-model'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ApiError } from '../lib/api'
import { RankingHeader, RankingFilters, RankingReference } from './store-rankings-controls'
import { RankingWorkspace } from './store-rankings-table'
import {
  StoreErrorState,
  StoreLoadingState,
  StoreSurfacePage,
} from './store-surface-primitives'

export function StoreRankingsPage(input: {
  authSummary: AuthSessionSummary | null
}) {
  const { locale, t } = useLocalization()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const enabled = canUseRankings(input.authSummary)
  const privilegedSession = canUsePrivilegedFilters(input.authSummary)
  const [pageState, dispatchPageState] = useReducer(
    storeRankingsPageReducer,
    searchParams,
    createInitialStoreRankingsPageState,
  )
  const {
    periodStart,
    regionManagerUserId,
    regionId,
    storeId,
    dayOfMonth,
    rangeStart,
    rangeEnd,
    search,
    offset,
    activeList,
    sortKey,
    sortDirection,
  } = pageState
  const limit = rankingPageSize
  const hasNonDefaultSort = sortKey !== 'score' || sortDirection !== 'desc'
  const requestedPeriod = getRequestedRankingPeriod(periodStart, dayOfMonth, rangeStart, rangeEnd)

  useEffect(() => {
    const nextParams = buildStoreRankingsSearchParams(pageState)
    const current = new URLSearchParams(location.search).toString()
    const next = nextParams.toString()
    if (current !== next) {
      setSearchParams(nextParams, { replace: true })
    }
  }, [location.search, pageState, setSearchParams])
  const setFilter = (field: StoreRankingsTextFilter) => (value: string) => {
    dispatchPageState({ type: 'setFilter', field, value })
  }
  const updateSort = (nextSortKey: RankingSortKey) => {
    dispatchPageState({ type: 'setSort', value: nextSortKey })
  }
  const updateActiveList = (nextList: ActiveRankingList) => {
    dispatchPageState({ type: 'setActiveList', value: nextList })
  }

  const rankingsQuery = useQuery({
    queryKey: [
      'ranking-v1',
      input.authSummary?.user.userId,
      input.authSummary?.user.authorizationContextVersion,
      periodStart || 'latest',
      privilegedSession ? regionManagerUserId : '',
      privilegedSession ? regionId : '',
      privilegedSession ? storeId : '',
      privilegedSession ? search : '',
      requestedPeriod.periodType,
      requestedPeriod.periodStart || 'latest',
      requestedPeriod.periodEnd ?? '',
      sortKey,
      sortDirection,
      privilegedSession ? offset : 0,
    ],
    queryFn: () =>
      getRankings({
        periodType: requestedPeriod.periodType,
        ...(requestedPeriod.periodStart ? { periodStart: requestedPeriod.periodStart } : {}),
        ...(requestedPeriod.periodEnd ? { periodEnd: requestedPeriod.periodEnd } : {}),
        ...(privilegedSession && regionManagerUserId ? { regionManagerUserId } : {}),
        ...(privilegedSession && regionId ? { regionId } : {}),
        ...(privilegedSession && storeId ? { storeId } : {}),
        ...(privilegedSession && search ? { search } : {}),
        ...(hasNonDefaultSort
          ? { sortKey, sortDirection }
          : {}),
        limit,
        offset: privilegedSession ? offset : 0,
      }),
    enabled,
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === input.authSummary?.user.userId &&
      previousQuery?.queryKey[2] === input.authSummary?.user.authorizationContextVersion
        ? previous
        : undefined,
    ...transientQueryRetryOptions,
  })
  const protectedError = rankingsQuery.error instanceof ApiError && [401, 403].includes(rankingsQuery.error.status)
  const ranking = protectedError ? undefined : rankingsQuery.data
  const isPrivileged = ranking?.access.globalMode === 'full'
  const canSeeGlobalDetails = Boolean(ranking?.access.canSeeGlobalDetails)
  const hasNextPage =
    Boolean(isPrivileged && ranking) &&
    (activeList === 'stores' ? ranking?.storeLeaderboard.meta.total ?? 0 : ranking?.personnelLeaderboard.meta.total ?? 0) >
      offset + limit
  const matchesSearch = (values: (string | null | undefined)[]) => privilegedSession || values.some(value => value?.toLocaleLowerCase(locale).includes(search.toLocaleLowerCase(locale)))
  const storeRows = (ranking?.storeLeaderboard.items ?? []).filter(row => matchesSearch([row.storeName]))
  const personnelRows = (ranking?.personnelLeaderboard.items ?? []).filter(row => matchesSearch([row.displayName, row.storeName]))

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

  const header = <RankingHeader ranking={ranking} periodStart={periodStart} dayOfMonth={dayOfMonth} rangeStart={rangeStart} rangeEnd={rangeEnd} locale={locale} t={t}
    onPeriodChange={(period, day, from, to) => dispatchPageState({ type: 'setPeriod', periodStart: period, dayOfMonth: day, ...(from && to ? { rangeStart: from, rangeEnd: to } : {}) })} />
  const clearFilters = () => { dispatchPageState({ type: 'clearFilters' }); setFilter('periodStart')(currentRankingPeriod()) }
  if (!ranking) return <StoreSurfacePage ariaLabel={t('storeRankings.pageTitle')} className="store-rankings-surface" testId="store-rankings-page">
    {header}
    {rankingsQuery.isPending ? <StoreLoadingState title={t('storeRankings.loadingTitle')} description={t('storeRankings.loadingCopy')} /> : <>
      <StoreErrorState title={t('storeRankings.errorTitle')} description={getUserFacingErrorMessage(rankingsQuery.error, 'Sıralama verisi alınamadı. Dönemi kontrol edip tekrar deneyin.')} />
      <Button variant="outline" onClick={() => void rankingsQuery.refetch()}>{locale === 'tr' ? 'Yeniden dene' : 'Retry'}</Button>
    </>}
  </StoreSurfacePage>

  return (
    <StoreSurfacePage ariaLabel={t('storeRankings.pageTitle')} className="store-rankings-surface" testId="store-rankings-page">
      {header}
      {rankingsQuery.isError ? <Alert variant="destructive"><AlertDescription>{locale === 'tr' ? 'Liste güncellenemedi.' : 'The list could not be refreshed.'}<Button variant="outline" onClick={() => void rankingsQuery.refetch()}>{locale === 'tr' ? 'Yeniden dene' : 'Retry'}</Button></AlertDescription></Alert> : null}
      <RankingReference ranking={ranking} activeList={activeList} locale={locale} t={t} />
      <RankingWorkspace
        loading={rankingsQuery.isPlaceholderData}
        toolbar={<RankingFilters ranking={ranking} isPrivileged={Boolean(isPrivileged)} search={search} regionManagerUserId={regionManagerUserId} activeList={activeList} onSearchChange={setFilter('search')} onManagerChange={setFilter('regionManagerUserId')} onClear={clearFilters} locale={locale} t={t} />}
        activeList={activeList}
        ranking={ranking}
        storeRows={storeRows}
        personnelRows={personnelRows}
        canSeeDetails={canSeeGlobalDetails}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSortChange={updateSort}
        onActiveListChange={updateActiveList}
        onOffsetChange={(value) => dispatchPageState({ type: 'setOffset', value })}
        hasNextPage={Boolean(hasNextPage)}
        offset={privilegedSession ? offset : 0}
        limit={limit}
        locale={locale}
        t={t}
      />

    </StoreSurfacePage>
  )
}

function parseRankingPeriod(value: string | null | undefined) {
  const match = /^(\d{4})-(\d{2})-\d{2}/.exec(value ?? '')

  if (!match) {
    return null
  }

  const year = Number(match[1])
  const month = Number(match[2])

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null
  }

  return { year, month }
}

function formatDayPeriodStart(monthStart: string, dayOfMonth: string) {
  const parsed = parseRankingPeriod(monthStart)
  const day = Number(dayOfMonth)

  if (!parsed || !Number.isInteger(day) || day < 1 || day > 31) {
    return ''
  }

  return `${parsed.year}-${String(parsed.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function getRequestedRankingPeriod(periodStart: string, dayOfMonth: string, rangeStart: string, rangeEnd: string): {
  periodType: 'daily' | 'monthly'
  periodStart: string
  periodEnd?: string
} {
  if (rangeStart && rangeEnd) return { periodType: 'daily', periodStart: rangeStart, periodEnd: rangeEnd }
  if (dayOfMonth) {
    return {
      periodType: 'daily',
      periodStart: formatDayPeriodStart(periodStart, dayOfMonth),
    }
  }

  return {
    periodType: 'monthly',
    periodStart,
  }
}
