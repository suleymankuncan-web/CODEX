import type { ReactNode } from 'react'
import { useReducer, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { CalendarClock, CalendarDays, CalendarRange, Search, Store, Trophy, UserCheck, UsersRound, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import type { AuthSessionSummary } from '../features/auth/api'
import type { TranslateFunction } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import {
  getRankings,
  type PersonnelRankingRow,
  type RankingSummary,
} from '../features/reports/api'
import { getErrorMessage } from '../lib/format'
import { getIntlLocale, type AppLocale } from '../lib/i18n'
import { transientQueryRetryOptions } from '../lib/query-retry'
import { RankingDetailDrawer } from './store-rankings-detail-panel'
import {
  type ActiveRankingList,
  type RankingSortDirection,
  type RankingSortKey,
  type SortableRankingRow,
  type StoreRankingsTextFilter,
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
    dayOfMonth,
    search,
    offset,
    activeList,
    sortKey,
    sortDirection,
    selectedDetail,
  } = pageState
  const limit = 100
  const hasNonDefaultSort = sortKey !== 'score' || sortDirection !== 'desc'
  const requestedPeriod = getRequestedRankingPeriod(periodStart, dayOfMonth)
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
      requestedPeriod.periodType,
      requestedPeriod.periodStart || 'latest',
      privilegedSession ? sortKey : 'score',
      privilegedSession ? sortDirection : 'desc',
      privilegedSession ? offset : 0,
    ],
    queryFn: () =>
      getRankings({
        periodType: requestedPeriod.periodType,
        ...(requestedPeriod.periodStart ? { periodStart: requestedPeriod.periodStart } : {}),
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
  const storeRows = ranking?.storeLeaderboard.items ?? []
  const personnelRows = ranking?.personnelLeaderboard.items ?? []
  const canOpenPersonnelProfile = (row: PersonnelRankingRow) =>
    canOpenPersonnelProfileFromRanking(input.authSummary, row)
  const openPersonnelProfile = (employeeId: string) => {
    const path = `/store/personnel/${encodeURIComponent(employeeId)}`
    const params = new URLSearchParams()

    if (ranking?.source.periodStart) {
      params.set('mode', 'live')
      params.set('periodType', ranking.source.periodType)
      params.set('periodStart', ranking.source.periodStart)
    }

    const query = params.toString()
    navigate(query ? `${path}?${query}` : path)
  }

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
        dayOfMonth={dayOfMonth}
        search={search}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onPeriodStartChange={setFilter('periodStart')}
        onRegionManagerChange={setFilter('regionManagerUserId')}
        onDayOfMonthChange={setFilter('dayOfMonth')}
        onSearchChange={setFilter('search')}
        onClearFilters={() => dispatchPageState({ type: 'clearFilters' })}
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
        onOpenStoreDetail={(row) =>
          dispatchPageState({ type: 'setSelectedDetail', value: { type: 'store', row } })
        }
        onOpenPersonnelProfile={openPersonnelProfile}
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
        note={
          input.ranking.source.periodType === 'daily'
            ? input.t('storeRankings.currentDailyView')
            : input.t('storeRankings.currentMonthlyView')
        }
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
  dayOfMonth: string
  search: string
  sortKey: RankingSortKey
  sortDirection: RankingSortDirection
  onPeriodStartChange: (value: string) => void
  onRegionManagerChange: (value: string) => void
  onDayOfMonthChange: (value: string) => void
  onSearchChange: (value: string) => void
  onClearFilters: () => void
  locale: AppLocale
  t: TranslateFunction
}) {
  const [openFilter, setOpenFilter] = useState<string | null>(null)
  const activePeriod = parseRankingPeriod(input.periodStart || input.ranking.source.periodStart)
  const selectedYear = activePeriod?.year ?? new Date().getFullYear()
  const selectedMonth = activePeriod?.month ?? new Date().getMonth() + 1
  const yearOptions = getRankingYearOptions(input.ranking, selectedYear)
  const dayOptions = getLoadedRankingDayOptions(input.ranking, selectedYear, selectedMonth)
  const setPeriod = (next: { year?: number; month?: number }) => {
    input.onPeriodStartChange(
      formatPeriodStart(next.year ?? selectedYear, next.month ?? selectedMonth),
    )
    input.onDayOfMonthChange('')
  }

  return (
    <StoreSectionCard
      ariaLabel={input.t('storeRankings.filtersEyebrow')}
      title={input.t('storeRankings.filtersEyebrow')}
      description={input.t('storeRankings.filterHelp')}
      badge={{
        label:
          input.sortKey === 'score'
            ? input.t('storeRankings.generalScore')
            : getMetricLabel(input.t, input.sortKey),
        tone: input.sortDirection === 'desc' ? 'neutral' : 'accent',
      }}
    >
      <div
        className={`store-rankings-filter-grid tw:grid tw:gap-3 ${
          input.isPrivileged
            ? 'tw:lg:grid-cols-[minmax(180px,1fr)_repeat(4,minmax(130px,150px))_auto]'
            : 'tw:lg:grid-cols-[minmax(180px,1fr)_repeat(3,minmax(130px,150px))_auto]'
        }`}
        role="group"
      >
        <label className="tw:flex tw:min-w-0 tw:flex-col tw:gap-2">
          <span className="tw:text-xs tw:font-normal tw:text-muted-foreground">
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

        <RankingCheckboxFilter
          label={input.t('storeRankings.year')}
          ariaLabel={input.t('storeRankings.yearFilterLabel')}
          icon={<CalendarDays data-icon="inline-start" aria-hidden="true" />}
          summary={String(selectedYear)}
          open={openFilter === 'year'}
          onOpenChange={(open) => setOpenFilter(open ? 'year' : null)}
          options={yearOptions.map((year) => ({
            value: String(year),
            label: String(year),
            checked: selectedYear === year,
            onCheckedChange: (checked) => {
              if (checked) setPeriod({ year })
            },
          }))}
        />

        <RankingCheckboxFilter
          label={input.t('storeRankings.month')}
          ariaLabel={input.t('storeRankings.monthFilterLabel')}
          icon={<CalendarRange data-icon="inline-start" aria-hidden="true" />}
          summary={formatMonthLabel(input.locale, selectedMonth)}
          open={openFilter === 'month'}
          onOpenChange={(open) => setOpenFilter(open ? 'month' : null)}
          options={Array.from({ length: 12 }, (_, index) => {
            const month = index + 1

            return {
              value: String(month),
              label: formatMonthLabel(input.locale, month),
              checked: selectedMonth === month,
              onCheckedChange: (checked: boolean) => {
                if (checked) setPeriod({ month })
              },
            }
          })}
        />

        <RankingCheckboxFilter
          label={input.t('storeRankings.day')}
          ariaLabel={input.t('storeRankings.dayFilterLabel')}
          icon={<CalendarClock data-icon="inline-start" aria-hidden="true" />}
          summary={input.dayOfMonth || input.t('storeRankings.allMonth')}
          open={openFilter === 'day'}
          onOpenChange={(open) => setOpenFilter(open ? 'day' : null)}
          options={[
            {
              value: 'all',
              label: input.t('storeRankings.allMonth'),
              checked: !input.dayOfMonth,
              onCheckedChange: (checked) => {
                if (checked) input.onDayOfMonthChange('')
              },
              wide: true,
            },
            ...dayOptions.map((day) => ({
              value: day,
              label: day,
              checked: input.dayOfMonth === day,
              onCheckedChange: (checked: boolean) => {
                if (checked) {
                  input.onPeriodStartChange(formatPeriodStart(selectedYear, selectedMonth))
                  input.onDayOfMonthChange(day)
                }
              },
            })),
          ]}
          gridClassName="tw:grid-cols-7"
        />

        {input.isPrivileged ? (
          <RankingCheckboxFilter
            label={input.t('storeRankings.regionManager')}
            ariaLabel={input.t('storeRankings.regionManagerFilterLabel')}
            icon={<UserCheck data-icon="inline-start" aria-hidden="true" />}
            summary={
              input.ranking.filters.regionManagers.find((option) => option.id === input.regionManagerUserId)?.label ??
              input.t('storeRankings.regionManager')
            }
            open={openFilter === 'region-manager'}
            onOpenChange={(open) => setOpenFilter(open ? 'region-manager' : null)}
            options={input.ranking.filters.regionManagers.map((option) => ({
              value: option.id,
              label: option.label,
              checked: input.regionManagerUserId === option.id,
              onCheckedChange: (checked) => {
                input.onRegionManagerChange(checked ? option.id : '')
              },
            }))}
          />
        ) : null}

        <div className="tw:flex tw:flex-col tw:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setOpenFilter(null)
              input.onClearFilters()
              input.onPeriodStartChange('')
              input.onDayOfMonthChange('')
            }}
          >
            <X data-icon="inline-start" aria-hidden="true" />
            {input.t('storeRankings.clearFilters')}
          </Button>
        </div>
      </div>
    </StoreSectionCard>
  )
}

function RankingCheckboxFilter(input: {
  label: string
  ariaLabel: string
  summary: string
  icon: ReactNode
  options: Array<{
    value: string
    label: string
    checked: boolean
    onCheckedChange: (checked: boolean) => void
    wide?: boolean
  }>
  disabled?: boolean
  gridClassName?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <div className="tw:relative tw:flex tw:min-w-0 tw:flex-col tw:gap-2">
      <span className="tw:text-xs tw:font-normal tw:text-muted-foreground">{input.label}</span>
      <details
        className="store-rankings-filter-menu tw:relative"
        data-disabled={input.disabled ? 'true' : undefined}
        open={input.open}
      >
        <summary
          aria-label={input.ariaLabel}
          className="tw:flex tw:min-h-10 tw:cursor-pointer tw:list-none tw:items-center tw:gap-2 tw:rounded-md tw:border tw:bg-background tw:px-3 tw:text-sm tw:font-normal tw:shadow-xs marker:tw:hidden"
          onClick={(event) => {
            event.preventDefault()

            if (!input.disabled) {
              input.onOpenChange(!input.open)
            }
          }}
          role="button"
        >
          {input.icon}
          <strong className="tw:min-w-0 tw:flex-1 tw:truncate tw:text-sm tw:font-semibold">
            {input.summary}
          </strong>
        </summary>
        <div
          className="tw:absolute tw:left-0 tw:top-[calc(100%+0.5rem)] tw:z-30 tw:grid tw:min-w-56 tw:gap-2 tw:rounded-xl tw:border tw:bg-popover tw:p-3 tw:text-popover-foreground tw:shadow-lg"
        >
          <div className={`tw:grid tw:gap-2 ${input.gridClassName ?? 'tw:grid-cols-1'}`}>
            {input.options.map((option) => (
              <label
                className={`tw:flex tw:min-h-9 tw:cursor-pointer tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:bg-card/80 tw:px-3 tw:text-sm tw:font-medium ${
                  option.wide ? 'tw:col-span-full' : ''
                }`}
                key={option.value}
              >
                <Checkbox
                  checked={option.checked}
                  disabled={input.disabled}
                  onCheckedChange={(checked) => {
                    option.onCheckedChange(checked === true)
                    if (checked === true) {
                      input.onOpenChange(false)
                    }
                  }}
                />
                <span className="tw:truncate">{option.label}</span>
              </label>
            ))}
          </div>
        </div>
      </details>
    </div>
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

function formatPeriodStart(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}-01`
}

function formatDayPeriodStart(monthStart: string, dayOfMonth: string) {
  const parsed = parseRankingPeriod(monthStart)
  const day = Number(dayOfMonth)

  if (!parsed || !Number.isInteger(day) || day < 1 || day > 31) {
    return ''
  }

  return `${parsed.year}-${String(parsed.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function getRequestedRankingPeriod(periodStart: string, dayOfMonth: string): {
  periodType: 'daily' | 'monthly'
  periodStart: string
} {
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

function getLoadedRankingDayOptions(ranking: RankingSummary, year: number, month: number) {
  const days = new Set<number>()

  for (const period of ranking.availablePeriods ?? []) {
    if (period.periodType !== 'daily') {
      continue
    }

    const parsed = parseRankingDayPeriod(period.periodStart)
    if (parsed?.year === year && parsed.month === month) {
      days.add(parsed.day)
    }
  }

  return Array.from(days)
    .sort((left, right) => left - right)
    .map(String)
}

function getRankingYearOptions(ranking: RankingSummary, selectedYear: number) {
  const currentYear = new Date().getFullYear()
  const years = new Set<number>([
    currentYear - 2,
    currentYear - 1,
    currentYear,
    selectedYear,
  ])

  for (const period of ranking.availablePeriods ?? []) {
    const parsed = parseRankingPeriod(period.periodStart)
    if (parsed) {
      years.add(parsed.year)
    }
  }

  const sourcePeriod = parseRankingPeriod(ranking.source.periodStart)
  if (sourcePeriod) {
    years.add(sourcePeriod.year)
  }

  return Array.from(years).sort((left, right) => left - right)
}

function formatMonthLabel(locale: AppLocale, month: number) {
  return new Intl.DateTimeFormat(getIntlLocale(locale), { month: 'short' }).format(
    new Date(2026, month - 1, 1),
  )
}

function parseRankingDayPeriod(value: string | null | undefined) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '')

  if (!match) {
    return null
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null
  }

  return { year, month, day }
}
