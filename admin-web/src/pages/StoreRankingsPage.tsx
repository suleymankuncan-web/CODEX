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
import {
  getRankings,
  type PersonnelRankingRow,
  type RankingMetricValue,
  type RankingSummary,
  type StoreRankingRow,
} from '../features/reports/api'
import { formatDate, getErrorMessage } from '../lib/format'

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

function formatNumber(input: number | null | undefined) {
  if (input === null || input === undefined || !Number.isFinite(input)) {
    return 'Veri yok'
  }

  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: Number.isInteger(input) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(input)
}

function formatPercent(input: number | null | undefined) {
  if (input === null || input === undefined || !Number.isFinite(input)) {
    return 'Veri yok'
  }

  return `${formatNumber(input * 100)}%`
}

function formatMetricValue(input: number | null | undefined, code: string) {
  if (code === 'CR' || code === 'TARGET_ACHIEVEMENT') {
    return formatPercent(input)
  }

  return formatNumber(input)
}

function formatRank(rank: number | null, population: number) {
  return rank !== null ? `${rank}/${population}` : 'Sıralama yok'
}

function formatPeriod(source: RankingSummary['source'] | undefined) {
  if (!source?.periodStart || !source.periodEnd) {
    return 'Son aylık veri'
  }

  return `${formatDate(source.periodStart)} - ${formatDate(source.periodEnd)}`
}

function formatMode(ranking?: RankingSummary) {
  return ranking?.access.globalMode === 'full' ? 'Tüm Türkiye' : 'Top 100'
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
        title="Sıralama yüzeyi kullanılamıyor"
        copy="Bu yüzey mağaza personeli, mağaza müdürü, bölge müdürü veya super admin rolü gerektirir."
        tone="error"
      />
    )
  }

  if (rankingsQuery.isLoading) {
    return (
      <ScreenState
        title="Sıralama hazırlanıyor"
        copy="Aylık KPI sıralama verisi okunuyor."
      />
    )
  }

  if (rankingsQuery.isError) {
    return (
      <ScreenState
        title="Sıralama yüzeyi açılamadı"
        copy={getErrorMessage(rankingsQuery.error)}
        tone="error"
      />
    )
  }

  if (!ranking) {
    return (
      <ScreenState
        title="Sıralama verisi yok"
        copy="Bu oturum için sıralama cevabı dönmedi."
        tone="error"
      />
    )
  }

  return (
    <section className="page-stack">
      <section className="hero-panel store-hero-panel">
        <div>
          <div className="eyebrow">Türkiye sıralaması</div>
          <h2 className="hero-title">Mağaza ve personel sıralamaları</h2>
          <p className="hero-copy">
            {isPrivileged
              ? 'Tüm Türkiye listesi filtreli ve detaylı görünür.'
              : 'Global liste Top 100 özet; kendi konumun ayrıca görünür.'}
          </p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label="Mod" value={formatMode(ranking)} />
          <MetricAccent label="Dönem" value={formatPeriod(ranking.source)} />
          <MetricAccent
            label="Mağaza"
            value={`${ranking.storeLeaderboard.items.length}/${ranking.storeLeaderboard.meta.total}`}
          />
          <MetricAccent
            label="Personel"
            value={`${ranking.personnelLeaderboard.items.length}/${ranking.personnelLeaderboard.meta.total}`}
          />
          <MetricAccent
            label="Detay"
            value={ranking.access.canSeeGlobalDetails ? 'Açık' : 'Kapalı'}
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
      />

      <section className="metric-grid store-metric-grid">
        <MetricCard
          title="Mağaza listesi"
          value={ranking.storeLeaderboard.items.length}
          note={`${ranking.storeLeaderboard.meta.total} mağaza popülasyonu`}
          icon={<Store size={18} />}
          tone="accent"
        />
        <MetricCard
          title="Personel listesi"
          value={ranking.personnelLeaderboard.items.length}
          note={`${ranking.personnelLeaderboard.meta.total} personel popülasyonu`}
          icon={<UsersRound size={18} />}
          tone="calm"
        />
        <MetricCard
          title="Kendi mağazam"
          value={ranking.storeLeaderboard.currentStore?.rank ?? 0}
          note={
            ranking.storeLeaderboard.currentStore
              ? formatRank(
                  ranking.storeLeaderboard.currentStore.rank,
                  ranking.storeLeaderboard.currentStore.population,
                )
              : 'Mağaza konumu yok'
          }
          icon={<Medal size={18} />}
          tone={ranking.storeLeaderboard.currentStore ? 'neutral' : 'warning'}
        />
        <MetricCard
          title="Kendi sıram"
          value={ranking.personnelLeaderboard.currentEmployee?.rank ?? 0}
          note={
            ranking.personnelLeaderboard.currentEmployee
              ? formatRank(
                  ranking.personnelLeaderboard.currentEmployee.rank,
                  ranking.personnelLeaderboard.currentEmployee.population,
                )
              : 'Personel konumu yok'
          }
          icon={<Trophy size={18} />}
          tone={ranking.personnelLeaderboard.currentEmployee ? 'neutral' : 'warning'}
        />
      </section>

      <section className="two-up-grid">
        <StoreLeaderboardPanel rows={ranking.storeLeaderboard.items} />
        <PersonnelLeaderboardPanel rows={ranking.personnelLeaderboard.items} />
      </section>

      <section className="two-up-grid">
        <CurrentStorePanel row={ranking.storeLeaderboard.currentStore} />
        <CurrentEmployeePanel row={ranking.personnelLeaderboard.currentEmployee} />
      </section>

      {ranking.personnelLeaderboard.managedStorePersonnel.length ? (
        <section className="panel" aria-label="Mağaza personeli sıralama detayları">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Mağazam</div>
              <h3>Mağaza personelleri</h3>
            </div>
            <StatusPill tone="accent">
              {`${ranking.personnelLeaderboard.managedStorePersonnel.length} kişi`}
            </StatusPill>
          </div>
          <div className="stacked-table">
            {ranking.personnelLeaderboard.managedStorePersonnel.map((row) => (
              <PersonnelRankingCard key={row.employeeId} row={row} forceDetail />
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
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">Filtreler</div>
          <h3>{input.isPrivileged ? 'Tüm Türkiye' : 'Top 100 görünümü'}</h3>
        </div>
        <StatusPill tone={input.isPrivileged ? 'accent' : 'neutral'}>
          {input.isPrivileged ? 'Detay açık' : 'Özet'}
        </StatusPill>
      </div>
      <div className="toolbar-cluster" role="group" aria-label="Sıralama filtreleri">
        <label className="control-field">
          <span>Dönem</span>
          <select
            value={input.periodStart}
            onChange={(event) => input.onPeriodStartChange(event.target.value)}
            aria-label="Sıralama dönem seçimi"
          >
            <option value="">Son aylık veri</option>
            {input.periodOptions.map((period) => (
              <option key={period.periodStart} value={period.periodStart}>
                {`${formatDate(period.periodStart)} - ${formatDate(period.periodEnd)}`}
              </option>
            ))}
          </select>
        </label>

        {input.isPrivileged ? (
          <>
            <label className="control-field">
              <span>Bölge müdürü</span>
              <select
                value={input.regionManagerUserId}
                onChange={(event) => input.onRegionManagerChange(event.target.value)}
                aria-label="Bölge müdürü filtresi"
              >
                <option value="">Tüm bölge müdürleri</option>
                {input.ranking.filters.regionManagers.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="control-field">
              <span>Bölge</span>
              <select
                value={input.regionId}
                onChange={(event) => input.onRegionChange(event.target.value)}
                aria-label="Bölge filtresi"
              >
                <option value="">Tüm bölgeler</option>
                {input.ranking.filters.regions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="control-field">
              <span>Mağaza</span>
              <select
                value={input.storeId}
                onChange={(event) => input.onStoreChange(event.target.value)}
                aria-label="Mağaza filtresi"
              >
                <option value="">Tüm mağazalar</option>
                {input.ranking.filters.stores.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="control-field">
              <span>Personel ara</span>
              <input
                value={input.search}
                onChange={(event) => input.onSearchChange(event.target.value)}
                placeholder="Ad veya mağaza"
                aria-label="Personel arama"
              />
            </label>
            <button className="control-button" type="button" onClick={input.onClearFilters}>
              Filtreleri temizle
            </button>
            <button
              className="control-button"
              type="button"
              onClick={() => input.onOffsetChange(Math.max(0, input.offset - input.limit))}
              disabled={input.offset === 0}
              aria-label="Önceki sıralama sayfası"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              className="control-button"
              type="button"
              onClick={() => input.onOffsetChange(input.offset + input.limit)}
              disabled={!input.hasNextPage}
              aria-label="Sonraki sıralama sayfası"
            >
              <ChevronRight size={16} />
            </button>
          </>
        ) : null}
      </div>
    </section>
  )
}

function StoreLeaderboardPanel(input: { rows: StoreRankingRow[] }) {
  return (
    <article className="panel">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">Mağazalar</div>
          <h3>Türkiye mağaza sıralaması</h3>
        </div>
        <StatusPill tone="accent">{`${input.rows.length} satır`}</StatusPill>
      </div>
      <div className="stacked-table">
        {input.rows.length ? (
          input.rows.map((row) => <StoreRankingCard key={row.storeId} row={row} />)
        ) : (
          <EmptyState copy="Bu seçim için mağaza sıralaması yok." />
        )}
      </div>
    </article>
  )
}

function PersonnelLeaderboardPanel(input: { rows: PersonnelRankingRow[] }) {
  return (
    <article className="panel">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">Personeller</div>
          <h3>Türkiye personel sıralaması</h3>
        </div>
        <StatusPill tone="calm">{`${input.rows.length} satır`}</StatusPill>
      </div>
      <div className="stacked-table">
        {input.rows.length ? (
          input.rows.map((row) => <PersonnelRankingCard key={row.employeeId} row={row} />)
        ) : (
          <EmptyState copy="Bu seçim için personel sıralaması yok." />
        )}
      </div>
    </article>
  )
}

function CurrentStorePanel(input: { row: StoreRankingRow | null }) {
  return (
    <article className="panel">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">Konum</div>
          <h3>Kendi mağaza sırası</h3>
        </div>
        {input.row ? (
          <StatusPill tone={getRowTone(input.row.rank)}>
            {formatRank(input.row.rank, input.row.population)}
          </StatusPill>
        ) : null}
      </div>
      {input.row ? (
        <StoreRankingCard row={input.row} forceDetail={input.row.visibility === 'detail'} />
      ) : (
        <EmptyState copy="Bu oturum için mağaza sırası bulunamadı." />
      )}
    </article>
  )
}

function CurrentEmployeePanel(input: { row: PersonnelRankingRow | null }) {
  return (
    <article className="panel">
      <div className="panel-heading">
        <div>
          <div className="eyebrow">Konum</div>
          <h3>Kendi personel sırası</h3>
        </div>
        {input.row ? (
          <StatusPill tone={getRowTone(input.row.rank)}>
            {formatRank(input.row.rank, input.row.population)}
          </StatusPill>
        ) : null}
      </div>
      {input.row ? (
        <PersonnelRankingCard row={input.row} forceDetail={input.row.visibility === 'detail'} />
      ) : (
        <EmptyState copy="Bu oturum için personel sırası bulunamadı." />
      )}
    </article>
  )
}

function StoreRankingCard(input: { row: StoreRankingRow; forceDetail?: boolean }) {
  const row = input.row
  const showMetrics = Boolean(input.forceDetail || row.visibility === 'detail')

  return (
    <article className="stacked-row">
      <div className="stacked-row-head">
        <div>
          <strong>{row.storeName ?? row.storeId}</strong>
          <span className="queue-subtitle">
            {[row.regionName, row.regionManagerName].filter(Boolean).join(' / ') || 'Bölge yok'}
          </span>
        </div>
        <StatusPill tone={getRowTone(row.rank)}>
          {formatRank(row.rank, row.population)}
        </StatusPill>
      </div>
      <div className="key-grid">
        <KeyValue label="Skor" value={formatNumber(row.scoreValue)} />
        <KeyValue label="Görünüm" value={row.visibility === 'detail' ? 'Detay' : 'Özet'} />
        <KeyValue label="Mağaza" value={row.storeName ?? row.storeId} />
      </div>
      {showMetrics ? <MetricDetails metrics={row.metrics ?? []} /> : null}
    </article>
  )
}

function PersonnelRankingCard(input: { row: PersonnelRankingRow; forceDetail?: boolean }) {
  const row = input.row
  const showMetrics = Boolean(input.forceDetail || row.visibility === 'detail')

  return (
    <article className="stacked-row">
      <div className="stacked-row-head">
        <div>
          <strong>{row.displayName}</strong>
          <span className="queue-subtitle">
            {[row.storeName, row.regionName].filter(Boolean).join(' / ') || 'Mağaza yok'}
          </span>
        </div>
        <StatusPill tone={getRowTone(row.rank)}>
          {formatRank(row.rank, row.population)}
        </StatusPill>
      </div>
      <div className="key-grid">
        <KeyValue label="Skor" value={formatNumber(row.scoreValue)} />
        <KeyValue label="Mağaza sırası" value={formatRank(row.storeRank, row.storePopulation)} />
        <KeyValue label="Görünüm" value={row.visibility === 'detail' ? 'Detay' : 'Özet'} />
      </div>
      {showMetrics ? <MetricDetails metrics={row.metrics ?? []} /> : null}
    </article>
  )
}

function MetricDetails(input: { metrics: RankingMetricValue[] }) {
  if (!input.metrics.length) {
    return null
  }

  return (
    <div className="key-grid" aria-label="Sıralama metrik detayları">
      {input.metrics.map((metric) => (
        <KeyValue
          key={metric.code}
          label={metric.label}
          value={[
            formatMetricValue(metric.actualValue, metric.code),
            metric.targetValue !== undefined && metric.targetValue !== null
              ? `Hedef ${formatMetricValue(metric.targetValue, metric.code)}`
              : null,
            metric.benchmarkValue !== undefined && metric.benchmarkValue !== null
              ? `Benchmark ${formatMetricValue(metric.benchmarkValue, metric.code)}`
              : null,
            metric.contributionValue !== undefined && metric.contributionValue !== null
              ? `Katkı ${formatNumber(metric.contributionValue)}`
              : null,
          ]
            .filter(Boolean)
            .join(' / ')}
        />
      ))}
    </div>
  )
}
