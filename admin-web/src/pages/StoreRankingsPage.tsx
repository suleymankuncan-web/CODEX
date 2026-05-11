import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import {
  ChevronLeft,
  ChevronRight,
  Search,
  Sparkles,
  Store,
  Trophy,
  UsersRound,
  X,
} from 'lucide-react'
import { ScreenState } from '../components/dashboard-primitives'
import type { AuthSessionSummary } from '../features/auth/api'
import { LanguageToggle } from '../features/localization/LanguageToggle'
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

const privilegedRankingRoles = ['REGION_MANAGER', 'SUPER_ADMIN']
const rankingRoles = ['STORE_PERSONNEL', 'STORE_MANAGER', ...privilegedRankingRoles]
const storeMetricCodes = ['UPT', 'ATV', 'CR', 'TARGET_ACHIEVEMENT', 'BM_CHECKLIST', 'VM_CHECKLIST'] as const
const personnelMetricCodes = ['UPT', 'ATV', 'TARGET_ACHIEVEMENT'] as const

type ActiveRankingList = 'stores' | 'personnel'
type RankingSortKey = 'score' | typeof storeMetricCodes[number]
type RankingSortDirection = 'asc' | 'desc'
type RankingDetailSelection =
  | { type: 'store'; row: StoreRankingRow }
  | { type: 'personnel'; row: PersonnelRankingRow }
  | null

type SortableRankingRow = {
  scoreValue: number
  metrics?: RankingMetricValue[]
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

function getLatestRankingFromCache(queryClient: QueryClient) {
  const cachedRankings = queryClient
    .getQueryCache()
    .findAll({ queryKey: ['ranking-v1'] })
    .map((query) => ({
      data: query.state.data as RankingSummary | undefined,
      updatedAt: query.state.dataUpdatedAt,
    }))
    .filter((entry): entry is { data: RankingSummary; updatedAt: number } => Boolean(entry.data))
    .sort((left, right) => right.updatedAt - left.updatedAt)

  return cachedRankings[0]?.data ?? null
}

export function StoreRankingsPage(input: {
  authSummary: AuthSessionSummary | null
}) {
  const { locale, t } = useLocalization()
  const queryClient = useQueryClient()
  const enabled = canUseRankings(input.authSummary)
  const privilegedSession = canUsePrivilegedFilters(input.authSummary)
  const [periodStart, setPeriodStart] = useState('')
  const [regionManagerUserId, setRegionManagerUserId] = useState('')
  const [regionId, setRegionId] = useState('')
  const [storeId, setStoreId] = useState('')
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [activeList, setActiveList] = useState<ActiveRankingList>('stores')
  const [sortKey, setSortKey] = useState<RankingSortKey>('score')
  const [sortDirection, setSortDirection] = useState<RankingSortDirection>('desc')
  const [selectedDetail, setSelectedDetail] = useState<RankingDetailSelection>(null)
  const limit = 100
  const hasNonDefaultSort = sortKey !== 'score' || sortDirection !== 'desc'
  const setFilter = (setter: (value: string) => void) => (value: string) => {
    setter(value)
    setOffset(0)
  }
  const updateSort = (nextSortKey: RankingSortKey) => {
    setOffset(0)
    if (sortKey === nextSortKey) {
      setSortDirection((current) => (current === 'desc' ? 'asc' : 'desc'))
      return
    }

    setSortKey(nextSortKey)
    setSortDirection('desc')
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
        periodStart: periodStart || undefined,
        regionManagerUserId: privilegedSession ? regionManagerUserId || undefined : undefined,
        regionId: privilegedSession ? regionId || undefined : undefined,
        storeId: privilegedSession ? storeId || undefined : undefined,
        search: privilegedSession ? search || undefined : undefined,
        sortKey: privilegedSession && hasNonDefaultSort ? sortKey : undefined,
        sortDirection: privilegedSession && hasNonDefaultSort ? sortDirection : undefined,
        limit,
        offset: privilegedSession ? offset : 0,
      }),
    enabled,
    placeholderData: (previousData) => previousData,
    retry: false,
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

  if (!enabled) {
    return (
      <ScreenState
        title={t('storeRankings.unavailableTitle')}
        copy={t('storeRankings.unavailableCopy')}
        tone="error"
      />
    )
  }

  if (rankingsQuery.isLoading && !ranking) {
    return (
      <ScreenState
        title={t('storeRankings.loadingTitle')}
        copy={t('storeRankings.loadingCopy')}
      />
    )
  }

  if (rankingsQuery.isError && !ranking) {
    return (
      <ScreenState
        title={t('storeRankings.errorTitle')}
        copy={getErrorMessage(rankingsQuery.error)}
        tone="error"
      />
    )
  }

  if (!ranking) {
    return (
      <ScreenState
        title={t('storeRankings.emptyTitle')}
        copy={t('storeRankings.emptyCopy')}
        tone="error"
      />
    )
  }

  return (
    <section
      className={`rankings-plum-page${rankingsQuery.isFetching ? ' rankings-plum-page-updating' : ''}`}
      aria-busy={rankingsQuery.isFetching}
    >
      <header className="rankings-plum-topbar">
        <div className="rankings-plum-title-block">
          <h2 id="rankings-heading">{t('storeRankings.pageTitle')}</h2>
          <p>
            {isPrivileged
              ? t('storeRankings.pageSubtitle.privileged')
              : t('storeRankings.pageSubtitle.scoped')}
          </p>
        </div>
        <div className="rankings-plum-topbar-actions">
          <LanguageToggle />
          <div className="rankings-plum-identity-card" aria-label={t('storeRankings.roleView')}>
            <div>
              <strong>{formatMode(t, ranking)}</strong>
              <span>
                {canSeeGlobalDetails
                  ? t('storeRankings.fullDetailAccess')
                  : t('storeRankings.summaryAccess')}
              </span>
            </div>
            <Sparkles size={18} aria-hidden="true" />
          </div>
        </div>
      </header>

      <section className="rankings-plum-command-panel" aria-labelledby="rankings-heading">
        <div className="rankings-plum-toolbar">
          <div className="rankings-plum-toolbar-top">
            <span className="rankings-plum-scope-pill">
              <span aria-hidden="true" />
              {isPrivileged ? t('storeRankings.fullScope') : t('storeRankings.top100Scope')}
            </span>
          </div>

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
            regionId={regionId}
            storeId={storeId}
            search={search}
            offset={offset}
            limit={limit}
            hasNextPage={Boolean(hasNextPage)}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onPeriodStartChange={setFilter(setPeriodStart)}
            onRegionManagerChange={setFilter(setRegionManagerUserId)}
            onRegionChange={setFilter(setRegionId)}
            onStoreChange={setFilter(setStoreId)}
            onSearchChange={setFilter(setSearch)}
            onOffsetChange={setOffset}
            onClearFilters={() => {
              setRegionManagerUserId('')
              setRegionId('')
              setStoreId('')
              setSearch('')
              setOffset(0)
            }}
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
        </div>

        <RankingWorkspace
          activeList={activeList}
          ranking={ranking}
          storeRows={storeRows}
          personnelRows={personnelRows}
          canSeeDetails={canSeeGlobalDetails}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSortChange={updateSort}
          onActiveListChange={(nextList) => {
            setActiveList(nextList)
            setSelectedDetail(null)
          }}
          onOpenDetail={setSelectedDetail}
          onOffsetChange={setOffset}
          hasNextPage={Boolean(hasNextPage)}
          offset={offset}
          limit={limit}
          locale={locale}
          t={t}
        />
      </section>

      <RankingDetailDrawer
        selection={selectedDetail}
        locale={locale}
        t={t}
        onClose={() => setSelectedDetail(null)}
      />
    </section>
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
    <div className="rankings-plum-summary-strip" aria-label={input.t('storeRankings.summaryPanelLabel')}>
      <RankingSummaryItem
        icon={<Trophy size={17} />}
        label={input.t('storeRankings.activePeriod')}
        value={formatPeriod(input.ranking.source, input.locale, input.t)}
        note={input.t('storeRankings.currentMonthlyView')}
      />
      <RankingSummaryItem
        icon={<Store size={17} />}
        label={input.t('storeRankings.storeScope')}
        value={formatNumber(input.locale, input.t, input.ranking.storeLeaderboard.meta.total)}
        note={input.t('common.storePopulation', {
          count: input.ranking.storeLeaderboard.meta.total,
        })}
      />
      <RankingSummaryItem
        icon={<UsersRound size={17} />}
        label={input.t('storeRankings.personnelScope')}
        value={formatNumber(input.locale, input.t, input.ranking.personnelLeaderboard.meta.total)}
        note={
          input.ranking.access.globalMode === 'full'
            ? input.t('storeRankings.allPersonnelAccess')
            : input.t('storeRankings.topPersonnelAccess')
        }
      />
      <RankingSummaryItem
        label={input.t('storeRankings.listingWindow')}
        value={getVisibleWindow(activeMeta.total, input.offset, activeCount, input.t)}
        note={input.t('storeRankings.pageWindowNote')}
      />
    </div>
  )
}

function RankingSummaryItem(input: {
  icon?: ReactNode
  label: string
  value: string
  note: string
}) {
  return (
    <article className="rankings-plum-summary-item">
      {input.icon ? <span className="rankings-plum-summary-icon">{input.icon}</span> : null}
      <span>{input.label}</span>
      <strong>{input.value}</strong>
      <small>{input.note}</small>
    </article>
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
  offset: number
  limit: number
  hasNextPage: boolean
  sortKey: RankingSortKey
  sortDirection: RankingSortDirection
  periodOptions: RankingSummary['availablePeriods']
  onPeriodStartChange: (value: string) => void
  onRegionManagerChange: (value: string) => void
  onRegionChange: (value: string) => void
  onStoreChange: (value: string) => void
  onSearchChange: (value: string) => void
  onOffsetChange: (value: number) => void
  onClearFilters: () => void
  locale: AppLocale
  t: TranslateFunction
}) {
  return (
    <div
      className={`rankings-plum-filters${
        input.isPrivileged ? '' : ' rankings-plum-filters-scoped'
      }`}
      role="group"
      aria-label={input.t('storeRankings.filtersEyebrow')}
    >
      <label className="rankings-plum-field rankings-plum-search-field">
        <span>{input.t('storeRankings.search')}</span>
        <span className="rankings-plum-input-shell">
          <Search size={16} aria-hidden="true" />
          <input
            value={input.search}
            onChange={(event) => input.onSearchChange(event.target.value)}
            placeholder={input.t('storeRankings.searchPlaceholder')}
            aria-label={input.t('storeRankings.searchLabel')}
            disabled={!input.isPrivileged}
            type="search"
          />
        </span>
      </label>

      <label className="rankings-plum-field">
        <span>{input.t('storeRankings.period')}</span>
        <select
          value={input.periodStart}
          onChange={(event) => input.onPeriodStartChange(event.target.value)}
          aria-label={input.t('storeRankings.periodSelectLabel')}
        >
          <option value="">{input.t('common.latestMonthlyData')}</option>
          {input.periodOptions.map((period) => (
            <option key={period.periodStart} value={period.periodStart}>
              {`${formatDate(period.periodStart, input.locale)} - ${formatDate(
                period.periodEnd,
                input.locale,
              )}`}
            </option>
          ))}
        </select>
      </label>

      {input.isPrivileged ? (
        <>
          <label className="rankings-plum-field">
            <span>{input.t('storeRankings.regionManager')}</span>
            <select
              value={input.regionManagerUserId}
              onChange={(event) => input.onRegionManagerChange(event.target.value)}
              aria-label={input.t('storeRankings.regionManagerFilterLabel')}
            >
              <option value="">{input.t('storeRankings.allRegionManagers')}</option>
              {input.ranking.filters.regionManagers.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="rankings-plum-field">
            <span>{input.t('storeRankings.region')}</span>
            <select
              value={input.regionId}
              onChange={(event) => input.onRegionChange(event.target.value)}
              aria-label={input.t('storeRankings.regionFilterLabel')}
            >
              <option value="">{input.t('storeRankings.allRegions')}</option>
              {input.ranking.filters.regions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="rankings-plum-field">
            <span>{input.t('storeRankings.store')}</span>
            <select
              value={input.storeId}
              onChange={(event) => input.onStoreChange(event.target.value)}
              aria-label={input.t('storeRankings.storeFilterLabel')}
            >
              <option value="">{input.t('storeRankings.allStores')}</option>
              {input.ranking.filters.stores.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            className="rankings-plum-clear-button"
            type="button"
            onClick={input.onClearFilters}
          >
            <X size={15} aria-hidden="true" />
            {input.t('storeRankings.clearFilters')}
          </button>
        </>
      ) : null}

      <div className="rankings-plum-field">
        <span>{input.t('storeRankings.sort')}</span>
        <div className="rankings-plum-sort-current">
          {input.sortKey === 'score'
            ? input.t('storeRankings.generalScore')
            : getMetricLabel(input.t, input.sortKey)}
          {input.sortDirection === 'desc' ? ' ↓' : ' ↑'}
        </div>
      </div>
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
    <div className="rankings-plum-reference-bar" aria-label={input.t('storeRankings.referenceLabel')}>
      <div className="rankings-plum-reference-title">
        <span>{input.t('storeRankings.turkeyReference')}</span>
        <strong>
          {input.activeList === 'stores'
            ? input.t('storeRankings.storeList')
            : input.t('storeRankings.personnelList')}
        </strong>
      </div>
      <ReferenceItem
        label={input.t('storeRankings.averageScore')}
        value={formatNumber(
          input.locale,
          input.t,
          reference?.averageScore ?? average(input.rows.map((row) => row.scoreValue)),
        )}
      />
      {metricCodes.map((code) => (
        <ReferenceItem
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
    </div>
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

function ReferenceItem(input: { label: string; value: string }) {
  return (
    <div className="rankings-plum-reference-item">
      <span>{input.label}</span>
      <strong>{input.value}</strong>
    </div>
  )
}

function RankingWorkspace(input: {
  activeList: ActiveRankingList
  ranking: RankingSummary
  storeRows: StoreRankingRow[]
  personnelRows: PersonnelRankingRow[]
  canSeeDetails: boolean
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
    <section
      className={`rankings-plum-table-wrap${
        input.canSeeDetails ? '' : ' rankings-plum-table-wrap-limited'
      }`}
    >
      <div className="rankings-plum-list-switch-row">
        <div
          className="rankings-plum-segmented"
          role="tablist"
          aria-label={input.t('storeRankings.listSwitchLabel')}
        >
          <button
            type="button"
            className={`rankings-plum-segment${
              input.activeList === 'stores' ? ' rankings-plum-segment-active' : ''
            }`}
            role="tab"
            aria-selected={input.activeList === 'stores'}
            onClick={() => input.onActiveListChange('stores')}
          >
            {input.t('storeRankings.storeList')}
          </button>
          <button
            type="button"
            className={`rankings-plum-segment${
              input.activeList === 'personnel' ? ' rankings-plum-segment-active' : ''
            }`}
            role="tab"
            aria-selected={input.activeList === 'personnel'}
            onClick={() => input.onActiveListChange('personnel')}
          >
            {input.t('storeRankings.personnelList')}
          </button>
        </div>
      </div>

      <div className="rankings-plum-list-meta">
        <div>
          <h3>{title}</h3>
          <span>{caption}</span>
        </div>
        <span className="rankings-plum-list-status">
          {input.canSeeDetails
            ? input.t('storeRankings.fullDetailAccess')
            : input.t('storeRankings.summaryAccess')}
        </span>
      </div>

      <div className="rankings-plum-table-scroll">
        <table
          className={`rankings-plum-table${
            input.canSeeDetails ? ' rankings-plum-table-detail' : ' rankings-plum-table-summary'
          }`}
          aria-describedby="rankings-heading"
        >
          <colgroup>
            <col className="rankings-plum-col-rank" />
            <col className="rankings-plum-col-entity" />
            <col className="rankings-plum-col-score" />
            {input.canSeeDetails ? <col className="rankings-plum-col-metrics" /> : null}
          </colgroup>
          <thead>
            <tr>
              <th>{input.t('storeRankings.rankColumn')}</th>
              <th>
                {input.activeList === 'stores'
                  ? input.t('storeRankings.store')
                  : input.t('storeRankings.personnel')}
              </th>
              <th className="rankings-plum-score-heading">
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
              </th>
              {input.canSeeDetails ? (
                <th className="rankings-plum-metric-heading">
                  <MetricSortRow
                    metricCodes={metricCodes}
                    activeSortKey={input.sortKey}
                    sortDirection={input.sortDirection}
                    onSortChange={input.onSortChange}
                    t={input.t}
                  />
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
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
              <tr>
                <td colSpan={input.canSeeDetails ? 4 : 3}>
                  <div className="rankings-plum-empty">
                    {input.activeList === 'stores'
                      ? input.t('storeRankings.noStores')
                      : input.t('storeRankings.noPersonnel')}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rankings-plum-pagination" aria-label={input.t('storeRankings.pagination')}>
        <span>
          {input.t('storeRankings.pageInfo', {
            start: meta.total ? input.offset + 1 : 0,
            end: input.offset + rows.length,
            total: meta.total,
          })}
        </span>
        <div>
          <button
            type="button"
            onClick={() => input.onOffsetChange(Math.max(0, input.offset - input.limit))}
            disabled={input.offset === 0}
            aria-label={input.t('storeRankings.previousPageLabel')}
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => input.onOffsetChange(input.offset + input.limit)}
            disabled={!input.hasNextPage}
            aria-label={input.t('storeRankings.nextPageLabel')}
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
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
    <button
      className={`rankings-plum-sort-button${active ? ' rankings-plum-sort-button-active' : ''}`}
      type="button"
      onClick={() => input.onSortChange(input.sortKey)}
      aria-sort={active ? (input.sortDirection === 'desc' ? 'descending' : 'ascending') : 'none'}
    >
      {input.label}
      {active ? <span>{input.sortDirection === 'desc' ? '↓' : '↑'}</span> : null}
    </button>
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
      className="rankings-plum-metric-sort-row"
      style={{ '--metric-count': input.metricCodes.length } as CSSProperties}
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
    <tr>
      <td data-label={input.t('storeRankings.rankColumn')}>
        <span className="rankings-plum-rank">{formatRankBadge(input.t, row.rank)}</span>
      </td>
      <td data-label={input.t('storeRankings.store')}>
        <RankingEntity
          label={row.storeName ?? row.storeId}
          canOpen={input.canSeeDetails}
          onOpen={() => input.onOpenDetail(row)}
        />
      </td>
      <td className="rankings-plum-score-cell" data-label={input.t('storeRankings.storeScore')}>
        <RankingScore value={row.scoreValue} locale={input.locale} t={input.t} />
      </td>
      {input.canSeeDetails ? (
        <td data-label={input.t('storeRankings.metricDetailsLabel')}>
          <MetricDetails
            metrics={row.metrics ?? []}
            metricCodes={storeMetricCodes}
            locale={input.locale}
            t={input.t}
          />
        </td>
      ) : null}
    </tr>
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
    <tr>
      <td data-label={input.t('storeRankings.rankColumn')}>
        <span className="rankings-plum-rank">{formatRankBadge(input.t, row.rank)}</span>
      </td>
      <td data-label={input.t('storeRankings.personnel')}>
        <RankingEntity
          label={row.displayName}
          caption={row.storeName ?? input.t('storeRankings.noStore')}
          canOpen={input.canSeeDetails}
          onOpen={() => input.onOpenDetail(row)}
        />
      </td>
      <td className="rankings-plum-score-cell" data-label={input.t('storeRankings.personnelScore')}>
        <RankingScore value={row.scoreValue} locale={input.locale} t={input.t} />
      </td>
      {input.canSeeDetails ? (
        <td data-label={input.t('storeRankings.metricDetailsLabel')}>
          <MetricDetails
            metrics={row.metrics ?? []}
            metricCodes={personnelMetricCodes}
            locale={input.locale}
            t={input.t}
          />
        </td>
      ) : null}
    </tr>
  )
}

function RankingEntity(input: {
  label: string
  caption?: string
  canOpen: boolean
  onOpen: () => void
}) {
  return (
    <div className="rankings-plum-entity">
      {input.canOpen ? (
        <button type="button" onClick={input.onOpen}>
          {input.label}
        </button>
      ) : (
        <strong>{input.label}</strong>
      )}
      {input.caption ? <span>{input.caption}</span> : null}
    </div>
  )
}

function RankingScore(input: {
  value: number | null | undefined
  locale: AppLocale
  t: TranslateFunction
}) {
  const scoreWidth = `${getScoreFill(input.value)}%`
  const style = { '--score-width': scoreWidth } as CSSProperties

  return (
    <div className="rankings-plum-scorebar">
      <strong>{formatNumber(input.locale, input.t, input.value)}</strong>
      <span className="rankings-plum-score-track" style={style}>
        <i />
      </span>
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
    return <span className="rankings-plum-no-metrics">{input.t('common.noData')}</span>
  }

  return (
    <div
      className="rankings-plum-metric-grid"
      aria-label={input.t('storeRankings.metricDetailsLabel')}
      style={{ '--metric-count': input.metricCodes.length } as CSSProperties}
    >
      {input.metricCodes.map((code) => {
        const metric = getMetricByCode(input.metrics, code)

        return (
          <div className={`rankings-plum-metric-cell${metric ? '' : ' rankings-plum-missing'}`} key={code}>
            <span>{getMetricLabel(input.t, code, metric?.label)}</span>
            <strong>
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
        className="rankings-plum-drawer-backdrop"
        type="button"
        aria-label={input.t('storeRankings.closeDetail')}
        onClick={input.onClose}
      />
      <aside className="rankings-plum-drawer" aria-label={input.t('storeRankings.detailPanel')}>
        <div className="rankings-plum-drawer-head">
          <div className="rankings-plum-drawer-actions">
            <button type="button" onClick={input.onClose}>
              {input.t('storeRankings.closeDetail')}
            </button>
            <span>{input.t('storeRankings.inlineDetail')}</span>
          </div>
          <div className="rankings-plum-drawer-title">
            <h2>{title}</h2>
            <span>{caption}</span>
          </div>
        </div>
        <div className="rankings-plum-drawer-body">
          <div className="rankings-plum-detail-grid">
            <DetailCard
              label={isStore ? input.t('storeRankings.storeScore') : input.t('storeRankings.personnelScore')}
              value={formatNumber(input.locale, input.t, row.scoreValue)}
            />
            <DetailCard
              label={input.t('storeRankings.turkeyRank')}
              value={formatRankBadge(input.t, row.rank)}
            />
            <DetailCard
              label={personnelRow ? input.t('storeRankings.storeRank') : input.t('storeRankings.scope')}
              value={
                personnelRow
                  ? formatRank(input.t, personnelRow.storeRank, personnelRow.storePopulation)
                  : formatRank(input.t, row.rank, row.population)
              }
            />
          </div>
          <section className="rankings-plum-detail-section">
            <h3>{input.t('storeRankings.kpiDistribution')}</h3>
            <MetricDetails
              metrics={row.metrics ?? []}
              metricCodes={metricCodes}
              locale={input.locale}
              t={input.t}
            />
          </section>
          <section className="rankings-plum-detail-section rankings-plum-month-progress">
            <div className="rankings-plum-detail-section-head">
              <h3>{input.t('storeRankings.monthlyProgress')}</h3>
              <span>{input.t('storeRankings.loadedPeriod')}</span>
            </div>
            <div className="rankings-plum-month-row">
              <span>{input.t('storeRankings.currentPeriod')}</span>
              <strong>{formatNumber(input.locale, input.t, row.scoreValue)}</strong>
              <span className="rankings-plum-month-score-track" style={{ '--month-score': `${getScoreFill(row.scoreValue)}%` } as CSSProperties}>
                <i />
              </span>
            </div>
          </section>
          <section className="rankings-plum-detail-section">
            <h3>{input.t('storeRankings.coachingNote')}</h3>
            <p className="rankings-plum-note">
              {input.t(
                isStore
                  ? 'storeRankings.storeDetailNote'
                  : 'storeRankings.personnelDetailNote',
              )}
            </p>
          </section>
        </div>
      </aside>
    </>
  )
}

function DetailCard(input: { label: string; value: string }) {
  return (
    <div className="rankings-plum-detail-card">
      <span>{input.label}</span>
      <strong>{input.value}</strong>
    </div>
  )
}
