import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ChevronLeft,
  ChevronRight,
  Medal,
  Store,
  Trophy,
  UsersRound,
} from 'lucide-react'
import {
  EmptyState,
  KeyValue,
  MetricAccent,
  MetricCard,
  ScreenState,
  StatusPill,
} from '../components/dashboard-primitives'
import type { AuthSessionSummary } from '../features/auth/api'
import type { TranslateFunction, TranslationKey } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import {
  getRankings,
  type PersonnelRankingRow,
  type RankingMetricValue,
  type RankingSummary,
  type StoreRankingRow,
} from '../features/reports/api'
import { formatDate, formatNumber as formatIntlNumber, getErrorMessage } from '../lib/format'
import type { AppLocale } from '../lib/i18n'

const privilegedRankingRoles = ['REGION_MANAGER', 'SUPER_ADMIN']
const rankingRoles = ['STORE_PERSONNEL', 'STORE_MANAGER', ...privilegedRankingRoles]

function hasAnyRole(userRoles: string[], requiredRoles: string[]) {
  return requiredRoles.some((role) => userRoles.includes(role))
}

function canUseRankings(authSummary: AuthSessionSummary | null) {
  return hasAnyRole(authSummary?.user.roleCodes ?? [], rankingRoles)
}

function canUsePrivilegedFilters(authSummary: AuthSessionSummary | null) {
  return hasAnyRole(authSummary?.user.roleCodes ?? [], privilegedRankingRoles)
}

const metricLabelKeyByCode: Record<string, TranslationKey> = {
  TARGET_ACHIEVEMENT: 'storeRankings.metric.targetAchievement',
  ATV: 'storeRankings.metric.atv',
  UPT: 'storeRankings.metric.upt',
  CR: 'storeRankings.metric.cr',
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
  input: number | null | undefined,
  code: string,
) {
  if (code === 'CR' || code === 'TARGET_ACHIEVEMENT') {
    return formatPercent(locale, t, input)
  }

  return formatNumber(locale, t, input)
}

function formatRank(t: TranslateFunction, rank: number | null, population: number) {
  return rank !== null
    ? t('common.rankFraction', { rank, population })
    : t('common.notRanked')
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

function getMetricLabel(t: TranslateFunction, metric: RankingMetricValue) {
  const key = metricLabelKeyByCode[metric.code]
  return key ? t(key) : metric.label
}

function getRowTone(rank: number): 'accent' | 'calm' | 'neutral' {
  if (rank <= 10) {
    return 'accent'
  }

  if (rank <= 100) {
    return 'calm'
  }

  return 'neutral'
}

export function StoreRankingsPage(input: {
  authSummary: AuthSessionSummary | null
}) {
  const { locale, t } = useLocalization()
  const enabled = canUseRankings(input.authSummary)
  const privilegedSession = canUsePrivilegedFilters(input.authSummary)
  const [periodStart, setPeriodStart] = useState('')
  const [regionManagerUserId, setRegionManagerUserId] = useState('')
  const [regionId, setRegionId] = useState('')
  const [storeId, setStoreId] = useState('')
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const limit = 100
  const setFilter = (setter: (value: string) => void) => (value: string) => {
    setter(value)
    setOffset(0)
  }

  const rankingsQuery = useQuery({
    queryKey: [
      'ranking-v1',
      periodStart || 'latest',
      privilegedSession ? regionManagerUserId : '',
      privilegedSession ? regionId : '',
      privilegedSession ? storeId : '',
      privilegedSession ? search : '',
      privilegedSession ? offset : 0,
    ],
    queryFn: () =>
      getRankings({
        periodStart: periodStart || undefined,
        regionManagerUserId: privilegedSession ? regionManagerUserId || undefined : undefined,
        regionId: privilegedSession ? regionId || undefined : undefined,
        storeId: privilegedSession ? storeId || undefined : undefined,
        search: privilegedSession ? search || undefined : undefined,
        limit,
        offset: privilegedSession ? offset : 0,
      }),
    enabled,
    retry: false,
  })
  const ranking = rankingsQuery.data
  const isPrivileged = ranking?.access.globalMode === 'full'
  const hasNextPage =
    isPrivileged &&
    Math.max(
      ranking.storeLeaderboard.meta.total,
      ranking.personnelLeaderboard.meta.total,
    ) > offset + limit
  const activePeriodOptions = useMemo(
    () => ranking?.availablePeriods ?? [],
    [ranking?.availablePeriods],
  )

  if (!enabled) {
    return (
      <ScreenState
        title={t('storeRankings.unavailableTitle')}
        copy={t('storeRankings.unavailableCopy')}
        tone="error"
      />
    )
  }

  if (rankingsQuery.isLoading) {
    return (
      <ScreenState
        title={t('storeRankings.loadingTitle')}
        copy={t('storeRankings.loadingCopy')}
      />
    )
  }

  if (rankingsQuery.isError) {
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
    <section className="page-stack">
      <section className="hero-panel store-hero-panel">
        <div>
          <div className="eyebrow">{t('storeRankings.heroEyebrow')}</div>
          <h2 className="hero-title">{t('storeRankings.title')}</h2>
          <p className="hero-copy">
            {isPrivileged
              ? t('storeRankings.heroCopy.privileged')
              : t('storeRankings.heroCopy.scoped')}
          </p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label={t('storeRankings.metric.mode')} value={formatMode(t, ranking)} />
          <MetricAccent
            label={t('storeRankings.metric.period')}
            value={formatPeriod(ranking.source, locale, t)}
          />
          <MetricAccent
            label={t('storeRankings.metric.store')}
            value={`${ranking.storeLeaderboard.items.length}/${ranking.storeLeaderboard.meta.total}`}
          />
          <MetricAccent
            label={t('storeRankings.metric.personnel')}
            value={`${ranking.personnelLeaderboard.items.length}/${ranking.personnelLeaderboard.meta.total}`}
          />
          <MetricAccent
            label={t('storeRankings.metric.detail')}
            value={
              ranking.access.canSeeGlobalDetails
                ? t('storeRankings.detail.open')
                : t('storeRankings.detail.closed')
            }
          />
        </div>
      </section>

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

      <section className="metric-grid store-metric-grid">
        <MetricCard
          title={t('storeRankings.storeList')}
          value={ranking.storeLeaderboard.items.length}
          note={t('common.storePopulation', { count: ranking.storeLeaderboard.meta.total })}
          icon={<Store size={18} />}
          tone="accent"
        />
        <MetricCard
          title={t('storeRankings.personnelList')}
          value={ranking.personnelLeaderboard.items.length}
          note={t('common.personnelPopulation', {
            count: ranking.personnelLeaderboard.meta.total,
          })}
          icon={<UsersRound size={18} />}
          tone="calm"
        />
        <MetricCard
          title={t('storeRankings.myStore')}
          value={ranking.storeLeaderboard.currentStore?.rank ?? 0}
          note={
            ranking.storeLeaderboard.currentStore
              ? formatRank(
                  t,
                  ranking.storeLeaderboard.currentStore.rank,
                  ranking.storeLeaderboard.currentStore.population,
                )
              : t('storeRankings.noStorePosition')
          }
          icon={<Medal size={18} />}
          tone={ranking.storeLeaderboard.currentStore ? 'neutral' : 'warning'}
        />
        <MetricCard
          title={t('storeRankings.myRank')}
          value={ranking.personnelLeaderboard.currentEmployee?.rank ?? 0}
          note={
            ranking.personnelLeaderboard.currentEmployee
              ? formatRank(
                  t,
                  ranking.personnelLeaderboard.currentEmployee.rank,
                  ranking.personnelLeaderboard.currentEmployee.population,
                )
              : t('storeRankings.noPersonnelPosition')
          }
          icon={<Trophy size={18} />}
          tone={ranking.personnelLeaderboard.currentEmployee ? 'neutral' : 'warning'}
        />
      </section>

      <section className="two-up-grid">
        <StoreLeaderboardPanel rows={ranking.storeLeaderboard.items} locale={locale} t={t} />
        <PersonnelLeaderboardPanel
          rows={ranking.personnelLeaderboard.items}
          locale={locale}
          t={t}
        />
      </section>

      <section className="two-up-grid">
        <CurrentStorePanel row={ranking.storeLeaderboard.currentStore} locale={locale} t={t} />
        <CurrentEmployeePanel
          row={ranking.personnelLeaderboard.currentEmployee}
          locale={locale}
          t={t}
        />
      </section>

      {ranking.personnelLeaderboard.managedStorePersonnel.length ? (
        <section className="panel" aria-label={t('storeRankings.managedPersonnelLabel')}>
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t('storeRankings.myStoreEyebrow')}</div>
              <h3>{t('storeRankings.managedPersonnelTitle')}</h3>
            </div>
            <StatusPill tone="accent">
              {t('common.personCount', {
                count: ranking.personnelLeaderboard.managedStorePersonnel.length,
              })}
            </StatusPill>
          </div>
          <div className="stacked-table">
            {ranking.personnelLeaderboard.managedStorePersonnel.map((row) => (
              <PersonnelRankingCard
                key={row.employeeId}
                row={row}
                forceDetail
                locale={locale}
                t={t}
              />
            ))}
          </div>
        </section>
      ) : null}
    </section>
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
    <section className="panel">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">{input.t('storeRankings.filtersEyebrow')}</div>
          <h3>
            {input.isPrivileged
              ? input.t('storeRankings.mode.full')
              : input.t('storeRankings.top100View')}
          </h3>
        </div>
        <StatusPill tone={input.isPrivileged ? 'accent' : 'neutral'}>
          {input.isPrivileged
            ? input.t('storeRankings.detail.open')
            : input.t('storeRankings.summary')}
        </StatusPill>
      </div>
      <div className="toolbar-cluster" role="group" aria-label={input.t('storeRankings.filtersEyebrow')}>
        <label className="control-field">
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
            <label className="control-field">
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
            <label className="control-field">
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
            <label className="control-field">
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
            <label className="control-field">
              <span>{input.t('storeRankings.searchPersonnel')}</span>
              <input
                value={input.search}
                onChange={(event) => input.onSearchChange(event.target.value)}
                placeholder={input.t('storeRankings.searchPlaceholder')}
                aria-label={input.t('storeRankings.searchLabel')}
              />
            </label>
            <button className="control-button" type="button" onClick={input.onClearFilters}>
              {input.t('storeRankings.clearFilters')}
            </button>
            <button
              className="control-button"
              type="button"
              onClick={() => input.onOffsetChange(Math.max(0, input.offset - input.limit))}
              disabled={input.offset === 0}
              aria-label={input.t('storeRankings.previousPageLabel')}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              className="control-button"
              type="button"
              onClick={() => input.onOffsetChange(input.offset + input.limit)}
              disabled={!input.hasNextPage}
              aria-label={input.t('storeRankings.nextPageLabel')}
            >
              <ChevronRight size={16} />
            </button>
          </>
        ) : null}
      </div>
    </section>
  )
}

function StoreLeaderboardPanel(input: {
  rows: StoreRankingRow[]
  locale: AppLocale
  t: TranslateFunction
}) {
  return (
    <article className="panel">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">{input.t('storeRankings.storesEyebrow')}</div>
          <h3>{input.t('storeRankings.turkeyStoreRanking')}</h3>
        </div>
        <StatusPill tone="accent">
          {input.t('common.rowCount', { count: input.rows.length })}
        </StatusPill>
      </div>
      <div className="stacked-table">
        {input.rows.length ? (
          input.rows.map((row) => (
            <StoreRankingCard key={row.storeId} row={row} locale={input.locale} t={input.t} />
          ))
        ) : (
          <EmptyState copy={input.t('storeRankings.noStores')} />
        )}
      </div>
    </article>
  )
}

function PersonnelLeaderboardPanel(input: {
  rows: PersonnelRankingRow[]
  locale: AppLocale
  t: TranslateFunction
}) {
  return (
    <article className="panel">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">{input.t('storeRankings.personnelEyebrow')}</div>
          <h3>{input.t('storeRankings.turkeyPersonnelRanking')}</h3>
        </div>
        <StatusPill tone="calm">
          {input.t('common.rowCount', { count: input.rows.length })}
        </StatusPill>
      </div>
      <div className="stacked-table">
        {input.rows.length ? (
          input.rows.map((row) => (
            <PersonnelRankingCard
              key={row.employeeId}
              row={row}
              locale={input.locale}
              t={input.t}
            />
          ))
        ) : (
          <EmptyState copy={input.t('storeRankings.noPersonnel')} />
        )}
      </div>
    </article>
  )
}

function CurrentStorePanel(input: {
  row: StoreRankingRow | null
  locale: AppLocale
  t: TranslateFunction
}) {
  return (
    <article className="panel">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">{input.t('storeRankings.positionEyebrow')}</div>
          <h3>{input.t('storeRankings.myStoreRank')}</h3>
        </div>
        {input.row ? (
          <StatusPill tone={getRowTone(input.row.rank)}>
            {formatRank(input.t, input.row.rank, input.row.population)}
          </StatusPill>
        ) : null}
      </div>
      {input.row ? (
        <StoreRankingCard
          row={input.row}
          forceDetail={input.row.visibility === 'detail'}
          locale={input.locale}
          t={input.t}
        />
      ) : (
        <EmptyState copy={input.t('storeRankings.noCurrentStore')} />
      )}
    </article>
  )
}

function CurrentEmployeePanel(input: {
  row: PersonnelRankingRow | null
  locale: AppLocale
  t: TranslateFunction
}) {
  return (
    <article className="panel">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">{input.t('storeRankings.positionEyebrow')}</div>
          <h3>{input.t('storeRankings.myPersonnelRank')}</h3>
        </div>
        {input.row ? (
          <StatusPill tone={getRowTone(input.row.rank)}>
            {formatRank(input.t, input.row.rank, input.row.population)}
          </StatusPill>
        ) : null}
      </div>
      {input.row ? (
        <PersonnelRankingCard
          row={input.row}
          forceDetail={input.row.visibility === 'detail'}
          locale={input.locale}
          t={input.t}
        />
      ) : (
        <EmptyState copy={input.t('storeRankings.noCurrentPersonnel')} />
      )}
    </article>
  )
}

function StoreRankingCard(input: {
  row: StoreRankingRow
  forceDetail?: boolean
  locale: AppLocale
  t: TranslateFunction
}) {
  const row = input.row
  const showMetrics = Boolean(input.forceDetail || row.visibility === 'detail')

  return (
    <article className="stacked-row">
      <div className="stacked-row-head">
        <div>
          <strong>{row.storeName ?? row.storeId}</strong>
          <span className="queue-subtitle">
            {[row.regionName, row.regionManagerName].filter(Boolean).join(' / ') ||
              input.t('storeRankings.noRegion')}
          </span>
        </div>
        <StatusPill tone={getRowTone(row.rank)}>
          {formatRank(input.t, row.rank, row.population)}
        </StatusPill>
      </div>
      <div className="key-grid">
        <KeyValue
          label={input.t('storeRankings.score')}
          value={formatNumber(input.locale, input.t, row.scoreValue)}
        />
        <KeyValue
          label={input.t('storeRankings.visibility')}
          value={
            row.visibility === 'detail'
              ? input.t('storeRankings.visibility.detail')
              : input.t('storeRankings.visibility.summary')
          }
        />
        <KeyValue label={input.t('storeRankings.store')} value={row.storeName ?? row.storeId} />
      </div>
      {showMetrics ? (
        <MetricDetails metrics={row.metrics ?? []} locale={input.locale} t={input.t} />
      ) : null}
    </article>
  )
}

function PersonnelRankingCard(input: {
  row: PersonnelRankingRow
  forceDetail?: boolean
  locale: AppLocale
  t: TranslateFunction
}) {
  const row = input.row
  const showMetrics = Boolean(input.forceDetail || row.visibility === 'detail')

  return (
    <article className="stacked-row">
      <div className="stacked-row-head">
        <div>
          <strong>{row.displayName}</strong>
          <span className="queue-subtitle">
            {[row.storeName, row.regionName].filter(Boolean).join(' / ') ||
              input.t('storeRankings.noStore')}
          </span>
        </div>
        <StatusPill tone={getRowTone(row.rank)}>
          {formatRank(input.t, row.rank, row.population)}
        </StatusPill>
      </div>
      <div className="key-grid">
        <KeyValue
          label={input.t('storeRankings.score')}
          value={formatNumber(input.locale, input.t, row.scoreValue)}
        />
        <KeyValue
          label={input.t('storeRankings.storeRank')}
          value={formatRank(input.t, row.storeRank, row.storePopulation)}
        />
        <KeyValue
          label={input.t('storeRankings.visibility')}
          value={
            row.visibility === 'detail'
              ? input.t('storeRankings.visibility.detail')
              : input.t('storeRankings.visibility.summary')
          }
        />
      </div>
      {showMetrics ? (
        <MetricDetails metrics={row.metrics ?? []} locale={input.locale} t={input.t} />
      ) : null}
    </article>
  )
}

function MetricDetails(input: {
  metrics: RankingMetricValue[]
  locale: AppLocale
  t: TranslateFunction
}) {
  if (!input.metrics.length) {
    return null
  }

  return (
    <div className="key-grid" aria-label={input.t('storeRankings.metricDetailsLabel')}>
      {input.metrics.map((metric) => (
        <KeyValue
          key={metric.code}
          label={getMetricLabel(input.t, metric)}
          value={[
            formatMetricValue(input.locale, input.t, metric.actualValue, metric.code),
            metric.targetValue !== undefined && metric.targetValue !== null
              ? input.t('storeRankings.targetPrefix', {
                  value: formatMetricValue(input.locale, input.t, metric.targetValue, metric.code),
                })
              : null,
            metric.benchmarkValue !== undefined && metric.benchmarkValue !== null
              ? input.t('storeRankings.benchmarkPrefix', {
                  value: formatMetricValue(
                    input.locale,
                    input.t,
                    metric.benchmarkValue,
                    metric.code,
                  ),
                })
              : null,
            metric.contributionValue !== undefined && metric.contributionValue !== null
              ? input.t('storeRankings.contributionPrefix', {
                  value: formatNumber(input.locale, input.t, metric.contributionValue),
                })
              : null,
          ]
            .filter(Boolean)
            .join(' / ')}
        />
      ))}
    </div>
  )
}
