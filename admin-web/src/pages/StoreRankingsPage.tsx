import type { ReactNode } from 'react'
import { useReducer, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CalendarCheck, CalendarClock, CalendarDays, CalendarRange, LineChart, ListFilter, Search, Store, Trophy, UserCheck, UsersRound, X } from 'lucide-react'
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
import {
  type ActiveRankingList,
  type RankingSortDirection,
  type RankingSortKey,
  type SortableRankingRow,
  type StoreRankingsTextFilter,
  average,
  canUsePrivilegedFilters,
  canUseRankings,
  createInitialStoreRankingsPageState,
  formatMetricValue,
  formatNumber,
  formatPeriod,
  getLatestRankingFromCache,
  getMetricLabel,
  getReferenceMetricValue,
  getVisibleWindow,
  personnelMetricCodes,
  storeMetricCodes,
  storeRankingsPageReducer,
} from './store-rankings-page-model'
import { canOpenPersonnelProfileFromRanking } from './store-rankings-scope'
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
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
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
    search,
    offset,
    activeList,
    sortKey,
    sortDirection,
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
  const updateActiveList = (nextList: ActiveRankingList) => {
    dispatchPageState({ type: 'setActiveList', value: nextList })
    setSearchParams((current) => {
      const next = new URLSearchParams(current)

      if (nextList === 'personnel') {
        next.set('list', 'personnel')
      } else {
        next.delete('list')
      }

      return next
    }, { replace: true })
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
      <RankingHeroHeader
        ranking={ranking}
        isPrivileged={Boolean(isPrivileged)}
        canSeeGlobalDetails={canSeeGlobalDetails}
        isFetching={rankingsQuery.isFetching}
        locale={locale}
        t={t}
      />

      <RankingSummaryStrip
        ranking={ranking}
        locale={locale}
        t={t}
        offset={offset}
        activeList={activeList}
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
        onActiveListChange={updateActiveList}
        onOpenPersonnelProfile={openPersonnelProfile}
        onOffsetChange={(value) => dispatchPageState({ type: 'setOffset', value })}
        hasNextPage={Boolean(hasNextPage)}
        offset={offset}
        limit={limit}
        locale={locale}
        t={t}
      />

    </StoreSurfacePage>
  )
}

function RankingHeroHeader(input: {
  ranking: RankingSummary
  isPrivileged: boolean
  canSeeGlobalDetails: boolean
  isFetching: boolean
  locale: AppLocale
  t: TranslateFunction
}) {
  return (
    <header className="store-rankings-topbar">
      <div className="store-rankings-title-block">
        <span className="store-rankings-eyebrow">
          <Trophy aria-hidden="true" />
          {input.t('storeRankings.heroEyebrow')}
        </span>
        <h1 id="rankings-heading">{input.t('storeRankings.pageTitle')}</h1>
        <p>
          {input.isPrivileged
            ? input.t('storeRankings.pageSubtitle.privileged')
            : input.t('storeRankings.pageSubtitle.scoped')}
        </p>
      </div>
      <div className="store-rankings-top-actions" aria-label={input.t('storeRankings.summaryPanelLabel')}>
        <span className="store-rankings-control-chip">
          <CalendarDays aria-hidden="true" />
          {formatPeriod(input.ranking.source, input.locale, input.t)}
        </span>
        <span className="store-rankings-control-chip">
          <Store aria-hidden="true" />
          {input.isPrivileged ? input.t('storeRankings.fullScope') : input.t('storeRankings.top100Scope')}
        </span>
        <span className={`store-rankings-icon-chip ${input.canSeeGlobalDetails ? 'is-calm' : 'is-warning'}`}>
          {input.canSeeGlobalDetails
            ? input.t('storeRankings.fullDetailAccess')
            : input.t('storeRankings.summaryAccess')}
        </span>
        {input.isFetching ? (
          <span className="store-rankings-icon-chip">{input.t('storeRankings.loadingTitle')}</span>
        ) : null}
      </div>
    </header>
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
    <section className="store-rankings-summary-grid" aria-label={input.t('storeRankings.summaryPanelLabel')}>
      <RankingMetricCard
        icon={<CalendarCheck aria-hidden="true" />}
        label={input.t('storeRankings.activePeriod')}
        value={formatPeriod(input.ranking.source, input.locale, input.t)}
        badge={
          input.ranking.source.periodType === 'daily'
            ? input.t('storeRankings.currentDailyView')
            : input.t('storeRankings.currentMonthlyView')
        }
        tone="plum"
      />
      <RankingMetricCard
        icon={<Store aria-hidden="true" />}
        label={input.t('storeRankings.storeScope')}
        value={formatNumber(input.locale, input.t, input.ranking.storeLeaderboard.meta.total)}
        badge={input.t('storeRankings.store')}
        tone="aqua"
      />
      <RankingMetricCard
        icon={<UsersRound aria-hidden="true" />}
        label={input.t('storeRankings.personnelScope')}
        value={formatNumber(input.locale, input.t, input.ranking.personnelLeaderboard.meta.total)}
        badge={input.t('storeRankings.personnel')}
        tone="blue"
      />
      <RankingMetricCard
        icon={<ListFilter aria-hidden="true" />}
        label={input.t('storeRankings.listingWindow')}
        value={getVisibleWindow(activeMeta.total, input.offset, activeCount, input.t)}
        badge={input.t('storeRankings.top100View')}
        tone="warning"
      />
    </section>
  )
}

function RankingMetricCard(input: {
  icon: ReactNode
  label: string
  value: string
  badge: string
  tone: 'plum' | 'aqua' | 'blue' | 'warning'
}) {
  return (
    <article className="store-rankings-metric-card">
      <div className="store-rankings-metric-head">
        <span className={`store-rankings-icon-tile store-rankings-tile-${input.tone}`}>
          {input.icon}
        </span>
        <span className={`store-rankings-badge store-rankings-badge-${input.tone}`}>
          {input.badge}
        </span>
      </div>
      <div>
        <div className="store-rankings-metric-label">{input.label}</div>
        <div className="store-rankings-metric-value">{input.value}</div>
      </div>
    </article>
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
    <section
      aria-label={input.t('storeRankings.filtersEyebrow')}
      className="store-rankings-filter-shell"
    >
      <div
        className={`store-rankings-filter-grid ${
          input.isPrivileged
            ? 'store-rankings-filter-grid-privileged'
            : 'store-rankings-filter-grid-scoped'
        }`}
        role="group"
      >
        <label className="store-rankings-field store-rankings-search-field">
          <span>
            {input.t('storeRankings.search')}
          </span>
          <span className="store-rankings-input-shell">
            <Search
              aria-hidden="true"
            />
            <Input
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
          gridClassName="store-rankings-date-grid-days"
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
            className="store-rankings-ghost-button"
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
    </section>
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
    <div className="store-rankings-field">
      <span>{input.label}</span>
      <details
        className="store-rankings-filter-menu"
        data-disabled={input.disabled ? 'true' : undefined}
        open={input.open}
      >
        <summary
          aria-label={input.ariaLabel}
          className="store-rankings-date-box"
          onClick={(event) => {
            event.preventDefault()

            if (!input.disabled) {
              input.onOpenChange(!input.open)
            }
          }}
          role="button"
        >
          {input.icon}
          <strong>
            {input.summary}
          </strong>
        </summary>
        <div
          className="store-rankings-date-menu"
        >
          <div className={`store-rankings-date-grid ${input.gridClassName ?? ''}`}>
            {input.options.map((option) => (
              <label
                className={`store-rankings-check-choice ${
                  option.wide ? 'store-rankings-check-choice-wide' : ''
                }`}
                key={option.value}
              >
                <Checkbox
                  checked={option.checked}
                  disabled={input.disabled}
                  onCheckedChange={(checked) => {
                    option.onCheckedChange(checked === true)
                    if (!input.disabled) {
                      input.onOpenChange(false)
                    }
                  }}
                />
                <span>{option.label}</span>
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
  const referenceLabel =
    input.activeList === 'stores'
      ? input.t('storeRankings.storeList')
      : input.t('storeRankings.personnelList')

  return (
    <section
      className="store-rankings-reference-strip"
      aria-label={input.t('storeRankings.referenceLabel')}
    >
      <div className="store-rankings-reference-title">
        <LineChart aria-hidden="true" />
        <div>
          <h2>{input.t('storeRankings.turkeyReference')}</h2>
          <strong>{referenceLabel}</strong>
        </div>
      </div>
      <RankingReferenceItem
        label={input.t('storeRankings.averageScore')}
        value={formatNumber(
          input.locale,
          input.t,
          reference?.averageScore ?? average(input.rows.map((row) => row.scoreValue)),
        )}
      />
      {metricCodes.map((code) => (
        <RankingReferenceItem
          key={code}
          label={getMetricLabel(input.t, code)}
          value={formatMetricValue(
            input.locale,
            input.t,
            getReferenceMetricValue(reference, input.rows, code),
            code,
          )}
        />
      ))}
    </section>
  )
}

function RankingReferenceItem(input: { label: string; value: string }) {
  return (
    <div className="store-rankings-reference-item">
      <span>{input.label}</span>
      <strong>{input.value}</strong>
    </div>
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
