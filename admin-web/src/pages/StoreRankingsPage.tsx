import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, Medal, Trophy } from 'lucide-react'
import {
  EmptyState,
  KeyValue,
  MetricAccent,
  MetricCard,
  ScreenState,
  StatusPill,
} from '../components/dashboard-primitives'
import type { AuthSessionSummary } from '../features/auth/api'
import { formatPerformanceGrade, resolvePerformanceGrade } from '../features/kpi/grading'
import { getClosedLeaderboard, getKpiConfig, getReportingSnapshotRuns } from '../features/reports/api'
import type { ClosedLeaderboardSummary, ClosedRankingEmployee } from '../features/reports/api'
import {
  formatSnapshotMonthOptionLabel,
  formatSnapshotOptionLabel,
  getSnapshotMonthStart,
} from '../features/reports/snapshot-labels'
import { formatDate, getErrorMessage } from '../lib/format'

function canUseRankings(authSummary: AuthSessionSummary | null) {
  const roles = authSummary?.user.roleCodes ?? []
  return roles.includes('STORE_PERSONNEL') || roles.includes('STORE_MANAGER')
}

function formatRank(rank: number | null, population: number) {
  return rank !== null ? `${rank}/${population}` : 'Siralama yok'
}

function formatCoverage(input?: {
  daysWithPerformance: number
  closedDaysInPeriod: number
}) {
  if (!input || input.closedDaysInPeriod === 0) {
    return 'Veri yok'
  }

  return `${input.daysWithPerformance}/${input.closedDaysInPeriod} kapali gun`
}

function formatSourceState(state?: 'closed' | 'not_closed' | 'no_data') {
  if (state === 'closed') {
    return 'Kapandi'
  }

  if (state === 'not_closed') {
    return 'Henuz kapanmadi'
  }

  return 'Veri yok'
}

function formatPeriodType(periodType?: 'daily' | 'monthly') {
  return periodType === 'monthly' ? 'Aylik' : 'Gunluk'
}

function resolveRankingExplanation(employee?: ClosedRankingEmployee | null) {
  if (!employee) {
    return null
  }

  if (employee.rankingStatus === 'preview_only') {
    return {
      label: 'On izleme',
      copy: `${employee.neededPerformanceDays} kapali performans gunu daha gerekiyor`,
      tone: 'warning' as const,
    }
  }

  return {
    label: 'Resmi siralama',
    copy: 'Bu sonuc kapanmis performans verisiyle resmi siralamaya dahildir.',
    tone: 'calm' as const,
  }
}

function resolveEmptyState(state: 'closed' | 'not_closed' | 'no_data') {
  if (state === 'not_closed') {
    return {
      title: 'Secili donem henuz kapanmadi',
      copy: 'Siralama, secili gun veya ay icin kapanis verisi tamamlandiktan sonra gorunur.',
    }
  }

  if (state === 'no_data') {
    return {
      title: 'Bu donem icin kapali performans verisi yok',
      copy: 'Kapanis var; ancak bu secim icin personel performans satiri uretilmemis.',
    }
  }

  return null
}

function resolveRankingScopeReadiness(leaderboard?: ClosedLeaderboardSummary) {
  const employee = leaderboard?.currentEmployee ?? null
  const isOfficial = employee?.rankingStatus === 'official'
  const hasTurkeyPopulation = Boolean(employee && employee.rankings.turkeyPopulation > 0)
  const hasStorePopulation = Boolean(employee && employee.rankings.storePopulation > 0)
  const hasMetricRanks = Boolean(employee?.metricRanks.length)
  const hasClosedSource = leaderboard?.source.state === 'closed'

  return [
    {
      label: 'Turkiye geneli',
      status: isOfficial && employee?.rankings.turkeyRank ? 'Hazir' : 'On izleme',
      tone: isOfficial && employee?.rankings.turkeyRank ? 'calm' : 'warning',
      scope: hasTurkeyPopulation
        ? formatRank(employee?.rankings.turkeyRank ?? null, employee?.rankings.turkeyPopulation ?? 0)
        : 'Populasyon yok',
      note: isOfficial
        ? 'Kapali snapshot icindeki ulke geneli personel sirasi.'
        : 'Resmi siralama icin kapali performans gunu esigi bekleniyor.',
    },
    {
      label: 'Magaza ici',
      status: isOfficial && employee?.rankings.storeRank ? 'Hazir' : 'On izleme',
      tone: isOfficial && employee?.rankings.storeRank ? 'calm' : 'warning',
      scope: hasStorePopulation
        ? formatRank(employee?.rankings.storeRank ?? null, employee?.rankings.storePopulation ?? 0)
        : 'Populasyon yok',
      note: 'Ayni store icindeki personel karsilastirmasi mevcut read modelden okunur.',
    },
    {
      label: 'Metrik mini-rank',
      status: hasMetricRanks ? 'Hazir' : 'Veri bekliyor',
      tone: hasMetricRanks ? 'accent' : 'neutral',
      scope: hasMetricRanks ? `${employee?.metricRanks.length ?? 0} metrik` : 'Mini-rank yok',
      note: 'UPT, ATV ve hedef gibi tekil KPI yarislari icin temel sinyal hazir.',
    },
    {
      label: 'Segment hazirligi',
      status: hasClosedSource && hasMetricRanks ? 'Segment kuralina hazir' : 'Segment icin veri bekliyor',
      tone: hasClosedSource && hasMetricRanks ? 'accent' : 'neutral',
      scope: leaderboard?.source.periodType === 'monthly' ? 'Aylik segmentlenebilir' : 'Gunluk segmentlenebilir',
      note: 'Bolge, challenge veya metrik segmenti ileride yeni skor motoru acmadan ayni kapanis modeline baglanabilir.',
    },
  ] as const
}

export function StoreRankingsPage(input: {
  authSummary: AuthSessionSummary | null
}) {
  const enabled = canUseRankings(input.authSummary)
  const [periodType, setPeriodType] = useState<'daily' | 'monthly'>('daily')
  const [periodStart, setPeriodStart] = useState('')
  const [selectedSnapshotRunId, setSelectedSnapshotRunId] = useState('')
  const configQuery = useQuery({
    queryKey: ['store-rankings-kpi-config'],
    queryFn: getKpiConfig,
    enabled,
    retry: false,
  })
  const snapshotRunsQuery = useQuery({
    queryKey: ['store-rankings-snapshot-runs', 'daily-list'],
    queryFn: () =>
      getReportingSnapshotRuns({
        snapshotType: 'daily',
        limit: 90,
        offset: 0,
      }),
    enabled,
    retry: false,
  })
  const availableSnapshotRuns = useMemo(
    () => snapshotRunsQuery.data?.items ?? [],
    [snapshotRunsQuery.data?.items],
  )
  const monthlySnapshotOptions = useMemo(() => {
    const optionsByMonth = new Map<
      string,
      { monthStart: string; latestSnapshotDate: string }
    >()

    for (const run of availableSnapshotRuns) {
      const monthStart = getSnapshotMonthStart(run.periodStart)
      const current = optionsByMonth.get(monthStart)

      if (
        !current ||
        Date.parse(run.snapshotDate) > Date.parse(current.latestSnapshotDate)
      ) {
        optionsByMonth.set(monthStart, {
          monthStart,
          latestSnapshotDate: run.snapshotDate,
        })
      }
    }

    return [...optionsByMonth.values()].sort((left, right) =>
      right.monthStart.localeCompare(left.monthStart),
    )
  }, [availableSnapshotRuns])
  const activeMonthlySnapshotOption =
    periodType === 'monthly'
      ? monthlySnapshotOptions.find((option) => option.monthStart === periodStart) ??
        monthlySnapshotOptions[0] ??
        null
      : null
  const selectedMonthlyPeriodStart = activeMonthlySnapshotOption?.monthStart ?? ''
  const activeSnapshotRun =
    periodType === 'daily'
      ? availableSnapshotRuns.find((run) => run.snapshotRunId === selectedSnapshotRunId) ??
        availableSnapshotRuns[0] ??
        null
      : null
  const leaderboardQuery = useQuery({
    queryKey: [
      'closed-leaderboard',
      periodType,
      periodType === 'monthly' ? selectedMonthlyPeriodStart || 'latest-month' : 'latest-day',
      activeSnapshotRun?.snapshotDate ?? 'latest-snapshot',
    ],
    queryFn: () =>
      getClosedLeaderboard({
        periodType,
        periodStart:
          periodType === 'monthly' && selectedMonthlyPeriodStart
            ? selectedMonthlyPeriodStart
            : undefined,
        snapshotDate:
          periodType === 'daily' && activeSnapshotRun?.snapshotDate
            ? activeSnapshotRun.snapshotDate
            : undefined,
        limit: 10,
      }),
    enabled: enabled && !snapshotRunsQuery.isLoading,
    retry: false,
  })

  if (!enabled) {
    return (
      <ScreenState
        title="Siralama yuzeyi kullanilamiyor"
        copy="Bu yuzey magaza personeli veya magaza muduru oturumu gerektirir."
        tone="error"
      />
    )
  }

  if (
    leaderboardQuery.isLoading ||
    configQuery.isLoading ||
    snapshotRunsQuery.isLoading
  ) {
    return (
      <ScreenState
        title="Kapanmis siralama hazirlaniyor"
        copy="Tamamlanan closure snapshot verileri okunuyor."
      />
    )
  }

  if (leaderboardQuery.isError || configQuery.isError || snapshotRunsQuery.isError) {
    return (
      <ScreenState
        title="Siralama yuzeyi acilamadi"
        copy={getErrorMessage(leaderboardQuery.error ?? configQuery.error ?? snapshotRunsQuery.error)}
        tone="error"
      />
    )
  }

  const leaderboard = leaderboardQuery.data
  const monthlyClosureEvidenceRuns =
    periodType === 'monthly' ? leaderboard?.includedSnapshotRuns ?? [] : []
  const currentEmployeeGrade = leaderboard?.currentEmployee
    ? resolvePerformanceGrade(leaderboard.currentEmployee.scoreValue, configQuery.data?.gradingBands)
    : null
  const rankingExplanation = resolveRankingExplanation(leaderboard?.currentEmployee)
  const scopeReadiness = resolveRankingScopeReadiness(leaderboard)
  const emptyState = leaderboard ? resolveEmptyState(leaderboard.source.state) : null
  const selectionIsFiltered =
    periodType === 'daily' ? Boolean(selectedSnapshotRunId) : Boolean(periodStart)

  return (
    <section className="page-stack">
      <section className="hero-panel store-hero-panel">
        <div>
          <div className="eyebrow">Kapanmis Siralamalar</div>
          <h2 className="hero-title">Gunluk ve aylik kapanis siralamasi.</h2>
          <p className="hero-copy">
            Bu yuzey canli degil. Tamamlanmis gun kapanislarindan okur; aylik mod ay icindeki kapanmis gunleri toplar.
          </p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label="Mod" value={formatPeriodType(periodType)} />
          <MetricAccent label="Durum" value={formatSourceState(leaderboard?.source.state)} />
          <MetricAccent
            label="Donem"
            value={
              leaderboard?.source.periodStart
                ? `${leaderboard.source.periodStart} / ${leaderboard.source.periodEnd ?? '-'}`
                : 'Son kapanis'
            }
          />
          <MetricAccent
            label="Kapsam"
            value={formatCoverage(leaderboard?.currentEmployee?.coverage)}
          />
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">Donem Secimi</div>
            <h3>Hangi kapanmis gun veya ayi gormek istiyorsun</h3>
          </div>
          <StatusPill tone={selectionIsFiltered ? 'accent' : 'neutral'}>
            {selectionIsFiltered ? 'Filtreli' : 'Son kapanis'}
          </StatusPill>
        </div>
        <div className="toolbar-cluster" role="group" aria-label="Ranking period controls">
          <button
            className={`segmented-button${periodType === 'daily' ? ' segmented-button-active' : ''}`}
            type="button"
            onClick={() => {
              setPeriodType('daily')
              setPeriodStart('')
              setSelectedSnapshotRunId('')
            }}
          >
            Gunluk
          </button>
          <button
            className={`segmented-button${periodType === 'monthly' ? ' segmented-button-active' : ''}`}
            type="button"
            onClick={() => {
              setPeriodType('monthly')
              setPeriodStart('')
              setSelectedSnapshotRunId('')
            }}
          >
            Aylik
          </button>
          {periodType === 'daily' ? (
            <label className="control-field">
              <span>Kapanmis siralama snapshot secimi</span>
              <select
                value={
                  selectedSnapshotRunId ||
                  activeSnapshotRun?.snapshotRunId ||
                  ''
                }
                onChange={(event) => setSelectedSnapshotRunId(event.target.value)}
                aria-label="Ranking snapshot secimi"
              >
                <option value="">Son kapanmis snapshot</option>
                {availableSnapshotRuns.map((run) => (
                  <option key={run.snapshotRunId} value={run.snapshotRunId}>
                    {formatSnapshotOptionLabel(run)}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label className="control-field">
              <span>Kapanmis aylik siralama secimi</span>
              <select
                value={periodStart || selectedMonthlyPeriodStart}
                onChange={(event) => setPeriodStart(event.target.value)}
                aria-label="Ranking month snapshot secimi"
              >
                <option value="">Son aylik kapanis</option>
                {monthlySnapshotOptions.map((option) => (
                  <option key={option.monthStart} value={option.monthStart}>
                    {formatSnapshotMonthOptionLabel(option)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            className="control-button"
            type="button"
            onClick={() => {
              if (periodType === 'monthly') {
                setPeriodStart('')
                return
              }

              setSelectedSnapshotRunId('')
            }}
            disabled={
              periodType === 'daily'
                ? !selectedSnapshotRunId
                : !periodStart
            }
          >
            {periodType === 'monthly' ? 'Son aylik kapanisa don' : 'Son kapanmis gune don'}
          </button>
        </div>
      </section>

      {leaderboard && emptyState ? (
        <EmptyState title={emptyState.title} copy={emptyState.copy} />
      ) : null}

      <section className="metric-grid store-metric-grid">
        <MetricCard
          title="Personel ilk 10"
          value={leaderboard?.personnelTop.length ?? 0}
          note="Secili closure kapsamindaki personel listesi."
          icon={<Trophy size={18} />}
          tone="accent"
        />
        <MetricCard
          title="Mevcut siralama"
          value={leaderboard?.currentEmployee?.rankings.turkeyRank ?? 0}
          note={
            leaderboard?.currentEmployee
              ? `${leaderboard.currentEmployee.displayName} - ${formatRank(
                  leaderboard.currentEmployee.rankings.turkeyRank,
                  leaderboard.currentEmployee.rankings.turkeyPopulation,
                )}`
              : 'Aktif employee kaydi bulunamadi.'
          }
          icon={<Medal size={18} />}
          tone={currentEmployeeGrade?.tone ?? 'neutral'}
        />
        <MetricCard
          title="Kapsam"
          value={leaderboard?.currentEmployee?.coverage.daysWithPerformance ?? 0}
          note={formatCoverage(leaderboard?.currentEmployee?.coverage)}
          icon={<CalendarDays size={18} />}
          tone={
            leaderboard?.currentEmployee?.coverage.isEligibleForRanking === false
              ? 'warning'
              : 'calm'
          }
        />
      </section>

      {periodType === 'monthly' ? (
        <section className="panel" aria-label="Monthly closure evidence">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Aylik Kanit</div>
              <h3>Aylik kapanis gunleri kaniti</h3>
            </div>
            <StatusPill tone={monthlyClosureEvidenceRuns.length ? 'calm' : 'warning'}>
              {`${monthlyClosureEvidenceRuns.length} kapanmis gun dahil`}
            </StatusPill>
          </div>
          <p className="queue-subtitle">
            Bu ay siralamasi tek bir snapshot degil, secili ay icindeki tamamlanmis gunluk kapanislarin toplamindan okunur.
          </p>
          <p className="helper-text">
            Aylik kanit includedSnapshotRuns alanindan gelir.
          </p>
          {monthlyClosureEvidenceRuns.length ? (
            <div className="stacked-table">
              {monthlyClosureEvidenceRuns.map((run) => (
                <article className="stacked-row" key={run.snapshotRunId}>
                  <div className="stacked-row-head">
                    <strong>{formatDate(run.snapshotDate)}</strong>
                    <StatusPill tone="calm">Dahil</StatusPill>
                  </div>
                  <div className="key-grid">
                    <KeyValue label="Snapshot run" value={run.snapshotRunId} />
                    <KeyValue label="Donem" value={`${run.periodStart} -> ${run.periodEnd}`} />
                    <KeyValue label="Durum" value={run.runStatus} />
                    <KeyValue label="Ureten" value={run.generatedBy} />
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Bu ay icin kapanis kaniti yok"
              copy="Aylik siralama, secili ay icin tamamlanmis gunluk snapshot buldugunda kanit listesi gosterir."
            />
          )}
        </section>
      ) : null}

      <section className="panel" aria-label="Ranking score source explanation">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">Skor Kontrati</div>
            <h3>Skor kaynaklari</h3>
          </div>
          <StatusPill tone="accent">Resmi kural</StatusPill>
        </div>
        <p className="queue-subtitle">
          Personel siralamasi, kapatilmis performans gunlerinin resmi score kaydina baglidir.
        </p>
        <div className="key-grid">
          <KeyValue
            label="Ana skor"
            value="Personel ana skoru kapanmis gunlerdeki total score ortalamasidir."
          />
          <KeyValue
            label="KPI kaynaklari"
            value="Hedef TARGET kaynagindan; ATV ve UPT Turkiye ortalamasindan puanlanir."
          />
          <KeyValue
            label="Checklist"
            value="Checklist personel ranking V1 icinde puan kaynagi degildir."
          />
          <KeyValue
            label="Mini siralar"
            value="ATV ve UPT mini siralari aciklayicidir; ana siralama weighted total score ile kalir."
          />
        </div>
      </section>

      <section className="two-up-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Kapanis baglami</div>
              <h3>Bu ranking neye gore hesaplandi</h3>
            </div>
            <StatusPill tone={leaderboard?.source.state === 'closed' ? 'calm' : 'warning'}>
              {formatPeriodType(leaderboard?.source.periodType)}
            </StatusPill>
          </div>
          <div className="key-grid">
            <KeyValue
              label="Snapshot tarihi"
              value={leaderboard?.source.snapshotDate ? formatDate(leaderboard.source.snapshotDate) : 'Snapshot yok'}
            />
            <KeyValue
              label="Donem"
              value={`${leaderboard?.source.periodStart ?? 'n/a'} -> ${leaderboard?.source.periodEnd ?? 'n/a'}`}
            />
            <KeyValue label="Durum" value={formatSourceState(leaderboard?.source.state)} />
            <KeyValue
              label="Aktif personel"
              value={leaderboard?.currentEmployee?.displayName ?? 'Personel yok'}
            />
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Mevcut konum</div>
              <h3>Aktif kullanici nerede duruyor</h3>
            </div>
            {rankingExplanation ? (
              <StatusPill tone={rankingExplanation.tone}>{rankingExplanation.label}</StatusPill>
            ) : null}
          </div>
          {leaderboard?.currentEmployee ? (
            <>
              {rankingExplanation ? (
                <div className="queue-meta" aria-label="Ranking explanation">
                  <StatusPill tone={rankingExplanation.tone}>{rankingExplanation.label}</StatusPill>
                  <span>{rankingExplanation.copy}</span>
                </div>
              ) : null}
              <div className="key-grid">
                <KeyValue
                  label="Turkiye sirasi"
                  value={formatRank(
                    leaderboard.currentEmployee.rankings.turkeyRank,
                    leaderboard.currentEmployee.rankings.turkeyPopulation,
                  )}
                />
                <KeyValue
                  label="Magaza sirasi"
                  value={formatRank(
                    leaderboard.currentEmployee.rankings.storeRank,
                    leaderboard.currentEmployee.rankings.storePopulation,
                  )}
                />
                <KeyValue label="Skor" value={leaderboard.currentEmployee.scoreValue.toFixed(2)} />
                <KeyValue
                  label="Derece"
                  value={
                    currentEmployeeGrade ? formatPerformanceGrade(currentEmployeeGrade) : 'Derece yok'
                  }
                />
                <KeyValue label="Magaza" value={leaderboard.currentEmployee.storeName ?? 'Bilinmiyor'} />
                <KeyValue
                  label="Veri kapsami"
                  value={formatCoverage(leaderboard.currentEmployee.coverage)}
                />
              </div>
            </>
          ) : (
            <EmptyState title="Aktif employee bulunamadi" copy="Bu oturum icin employee map kaydi yoksa sadece genel siralamalar gorunur." />
          )}
        </article>
      </section>

      <section className="panel" aria-label="Ranking scope readiness">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">Kapsam okunurlugu</div>
            <h3>Siralama kapsam olgunlugu</h3>
          </div>
          <StatusPill tone={leaderboard?.source.state === 'closed' ? 'calm' : 'warning'}>
            {leaderboard?.source.state === 'closed' ? 'Kapali kaynak' : 'Kisitli kaynak'}
          </StatusPill>
        </div>
        <p className="queue-subtitle">
          Turkiye, magaza ve metrik siralari ayni kapali snapshot kaynagindan okunur; segmentler icin yeni skor motoru degil kapsam kurali gerekir.
        </p>
        <div className="stacked-table">
          {scopeReadiness.map((item) => (
            <article className="stacked-row" key={item.label}>
              <div className="stacked-row-head">
                <strong>{item.label}</strong>
                <StatusPill tone={item.tone}>{item.status}</StatusPill>
              </div>
              <div className="key-grid">
                <KeyValue label="Kapsam" value={item.scope} />
                <KeyValue label="Not" value={item.note} />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="two-up-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Personel ilk 10</div>
              <h3>Secili kapsamda ilk 10 personel</h3>
            </div>
          </div>
          <div className="stacked-table">
            {leaderboard?.personnelTop.length ? (
              leaderboard.personnelTop.map((item) => {
                const grade = resolvePerformanceGrade(item.scoreValue, configQuery.data?.gradingBands)
                return (
                  <article className="stacked-row" key={item.employeeId}>
                    <div className="stacked-row-head">
                      <div>
                        <strong>{item.displayName}</strong>
                        <span className="queue-subtitle">{item.storeName ?? 'Store yok'}</span>
                      </div>
                      <StatusPill tone={grade.tone}>
                        {`TR ${formatRank(item.rankings.turkeyRank, item.rankings.turkeyPopulation)}`}
                      </StatusPill>
                    </div>
                    <div className="key-grid">
                      <KeyValue label="Skor" value={item.scoreValue.toFixed(2)} />
                      <KeyValue label="Derece" value={formatPerformanceGrade(grade)} />
                      <KeyValue
                        label="Magaza sirasi"
                        value={formatRank(item.rankings.storeRank, item.rankings.storePopulation)}
                      />
                      <KeyValue label="Kapsam" value={formatCoverage(item.coverage)} />
                    </div>
                  </article>
                )
              })
            ) : (
              <EmptyState copy="Bu secim icin personel siralamasi yok." />
            )}
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">KPI mini siralari</div>
              <h3>Aktif personelin metrik bazli konumu</h3>
            </div>
          </div>
          <div className="stacked-table">
            {leaderboard?.currentEmployee?.metricRanks.length ? (
              leaderboard.currentEmployee.metricRanks.map((metric) => (
                <article className="stacked-row" key={metric.code}>
                  <div className="stacked-row-head">
                    <strong>{metric.label}</strong>
                    <StatusPill tone="neutral">{metric.code}</StatusPill>
                  </div>
                  <div className="key-grid">
                    <KeyValue
                      label="Deger"
                      value={metric.actualValue !== null ? metric.actualValue.toFixed(2) : 'Veri yok'}
                    />
                    <KeyValue
                      label="Magaza sirasi"
                      value={formatRank(metric.storeRank, metric.storePopulation)}
                    />
                    <KeyValue
                      label="Turkiye sirasi"
                      value={formatRank(metric.turkeyRank, metric.turkeyPopulation)}
                    />
                  </div>
                </article>
              ))
            ) : (
              <EmptyState copy="Aktif personel icin KPI mini-rank verisi yok." />
            )}
            {leaderboard?.source.periodType === 'monthly' &&
            leaderboard.currentEmployee?.coverage.isEligibleForRanking === false ? (
              <EmptyState copy="Aylik siralamanin resmi sayilmasi icin en az 3 kapali performans gunu gerekir." />
            ) : null}
          </div>
        </article>
      </section>
    </section>
  )
}
