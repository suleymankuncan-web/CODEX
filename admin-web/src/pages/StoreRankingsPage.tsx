import { useState } from 'react'
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
import { getClosedLeaderboard, getKpiConfig } from '../features/reports/api'
import { formatDate, getErrorMessage } from '../lib/format'

function canUseRankings(authSummary: AuthSessionSummary | null) {
  const roles = authSummary?.user.roleCodes ?? []
  return roles.includes('STORE_PERSONNEL') || roles.includes('STORE_MANAGER')
}

function getCurrentMonthStart() {
  return `${new Date().toISOString().slice(0, 7)}-01`
}

function formatRank(rank: number | null, population: number) {
  return rank !== null ? `${rank}/${population}` : 'No rank'
}

function formatCoverage(input?: {
  daysWithPerformance: number
  closedDaysInPeriod: number
}) {
  if (!input || input.closedDaysInPeriod === 0) {
    return 'No data'
  }

  return `${input.daysWithPerformance}/${input.closedDaysInPeriod} days`
}

function resolveEmptyState(state: 'closed' | 'not_closed' | 'no_data') {
  if (state === 'not_closed') {
    return {
      title: 'This period is not closed yet',
      copy: 'Ranking appears after the selected day or month has completed closure data.',
    }
  }

  if (state === 'no_data') {
    return {
      title: 'No closed performance data exists for this period',
      copy: 'The closure exists, but no personnel performance rows were produced for this selection.',
    }
  }

  return null
}

export function StoreRankingsPage(input: {
  authSummary: AuthSessionSummary | null
}) {
  const enabled = canUseRankings(input.authSummary)
  const [periodType, setPeriodType] = useState<'daily' | 'monthly'>('daily')
  const [periodStart, setPeriodStart] = useState('')
  const configQuery = useQuery({
    queryKey: ['store-rankings-kpi-config'],
    queryFn: getKpiConfig,
    enabled,
    retry: false,
  })
  const leaderboardQuery = useQuery({
    queryKey: ['closed-leaderboard', periodType, periodStart || 'latest'],
    queryFn: () =>
      getClosedLeaderboard({
        periodType,
        periodStart: periodStart || undefined,
        limit: 10,
      }),
    enabled,
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

  if (leaderboardQuery.isLoading || configQuery.isLoading) {
    return (
      <ScreenState
        title="Kapanmis siralama hazirlaniyor"
        copy="Tamamlanan closure snapshot verileri okunuyor."
      />
    )
  }

  if (leaderboardQuery.isError || configQuery.isError) {
    return (
      <ScreenState
        title="Siralama yuzeyi acilamadi"
        copy={getErrorMessage(leaderboardQuery.error ?? configQuery.error)}
        tone="error"
      />
    )
  }

  const leaderboard = leaderboardQuery.data
  const currentEmployeeGrade = leaderboard?.currentEmployee
    ? resolvePerformanceGrade(leaderboard.currentEmployee.scoreValue, configQuery.data?.gradingBands)
    : null
  const emptyState = leaderboard ? resolveEmptyState(leaderboard.source.state) : null
  const selectedInputValue =
    periodType === 'monthly' && periodStart ? periodStart.slice(0, 7) : periodStart

  return (
    <section className="page-stack">
      <section className="hero-panel store-hero-panel">
        <div>
          <div className="eyebrow">Kapanmis Siralamalar</div>
          <h2 className="hero-title">Gunluk ve aylik closure ranking.</h2>
          <p className="hero-copy">
            Bu yuzey canli degil. Tamamlanmis gun kapanislarindan okur; aylik mod ay icindeki kapanmis gunleri toplar.
          </p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label="Mode" value={periodType === 'daily' ? 'Daily' : 'Monthly'} />
          <MetricAccent label="State" value={leaderboard?.source.state ?? 'No data'} />
          <MetricAccent
            label="Period"
            value={
              leaderboard?.source.periodStart
                ? `${leaderboard.source.periodStart} / ${leaderboard.source.periodEnd ?? '-'}`
                : 'Latest closed'
            }
          />
          <MetricAccent
            label="Coverage"
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
          <StatusPill tone={periodStart ? 'accent' : 'neutral'}>
            {periodStart ? 'Filtered' : 'Latest'}
          </StatusPill>
        </div>
        <div className="toolbar-cluster" role="group" aria-label="Ranking period controls">
          <button
            className={`segmented-button${periodType === 'daily' ? ' segmented-button-active' : ''}`}
            type="button"
            onClick={() => {
              setPeriodType('daily')
              setPeriodStart('')
            }}
          >
            Gunluk
          </button>
          <button
            className={`segmented-button${periodType === 'monthly' ? ' segmented-button-active' : ''}`}
            type="button"
            onClick={() => {
              setPeriodType('monthly')
              setPeriodStart(getCurrentMonthStart())
            }}
          >
            Aylik
          </button>
          <input
            className="control-input"
            type={periodType === 'daily' ? 'date' : 'month'}
            value={selectedInputValue}
            onChange={(event) => {
              const nextValue = event.target.value
              setPeriodStart(periodType === 'monthly' && nextValue ? `${nextValue}-01` : nextValue)
            }}
            aria-label={periodType === 'daily' ? 'Ranking snapshot date' : 'Ranking month'}
          />
          <button
            className="control-button"
            type="button"
            onClick={() => setPeriodStart(periodType === 'monthly' ? getCurrentMonthStart() : '')}
            disabled={!periodStart && periodType === 'daily'}
          >
            {periodType === 'monthly' ? 'Bu ay' : 'Filtreyi temizle'}
          </button>
        </div>
      </section>

      {leaderboard && emptyState ? (
        <EmptyState title={emptyState.title} copy={emptyState.copy} />
      ) : null}

      <section className="metric-grid store-metric-grid">
        <MetricCard
          title="Personnel top"
          value={leaderboard?.personnelTop.length ?? 0}
          note="Secili closure kapsamindaki personel listesi."
          icon={<Trophy size={18} />}
          tone="accent"
        />
        <MetricCard
          title="Current rank"
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
          title="Coverage"
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

      <section className="two-up-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Snapshot context</div>
              <h3>Bu ranking neye gore hesaplandi</h3>
            </div>
            <StatusPill tone={leaderboard?.source.state === 'closed' ? 'calm' : 'warning'}>
              {leaderboard?.source.periodType === 'monthly' ? 'Monthly' : 'Daily'}
            </StatusPill>
          </div>
          <div className="key-grid">
            <KeyValue
              label="Snapshot date"
              value={leaderboard?.source.snapshotDate ? formatDate(leaderboard.source.snapshotDate) : 'No snapshot'}
            />
            <KeyValue
              label="Period"
              value={`${leaderboard?.source.periodStart ?? 'n/a'} -> ${leaderboard?.source.periodEnd ?? 'n/a'}`}
            />
            <KeyValue label="State" value={leaderboard?.source.state ?? 'No data'} />
            <KeyValue
              label="Current employee"
              value={leaderboard?.currentEmployee?.displayName ?? 'No employee'}
            />
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Current position</div>
              <h3>Aktif kullanici nerede duruyor</h3>
            </div>
            {leaderboard?.currentEmployee?.coverage.isEligibleForRanking === false ? (
              <StatusPill tone="warning">
                {`${leaderboard.currentEmployee.coverage.daysWithPerformance}/${leaderboard.currentEmployee.coverage.minimumRequiredDays} days`}
              </StatusPill>
            ) : null}
          </div>
          {leaderboard?.currentEmployee ? (
            <div className="key-grid">
              <KeyValue
                label="Turkey rank"
                value={formatRank(
                  leaderboard.currentEmployee.rankings.turkeyRank,
                  leaderboard.currentEmployee.rankings.turkeyPopulation,
                )}
              />
              <KeyValue
                label="Store rank"
                value={formatRank(
                  leaderboard.currentEmployee.rankings.storeRank,
                  leaderboard.currentEmployee.rankings.storePopulation,
                )}
              />
              <KeyValue label="Score" value={leaderboard.currentEmployee.scoreValue.toFixed(2)} />
              <KeyValue
                label="Grade"
                value={
                  currentEmployeeGrade ? formatPerformanceGrade(currentEmployeeGrade) : 'No grade'
                }
              />
              <KeyValue label="Store" value={leaderboard.currentEmployee.storeName ?? 'Unknown'} />
              <KeyValue
                label="Data coverage"
                value={formatCoverage(leaderboard.currentEmployee.coverage)}
              />
            </div>
          ) : (
            <EmptyState title="Aktif employee bulunamadi" copy="Bu oturum icin employee map kaydi yoksa sadece genel siralamalar gorunur." />
          )}
        </article>
      </section>

      <section className="two-up-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Personnel top</div>
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
                      <KeyValue label="Score" value={item.scoreValue.toFixed(2)} />
                      <KeyValue label="Grade" value={formatPerformanceGrade(grade)} />
                      <KeyValue
                        label="Store rank"
                        value={formatRank(item.rankings.storeRank, item.rankings.storePopulation)}
                      />
                      <KeyValue label="Coverage" value={formatCoverage(item.coverage)} />
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
              <div className="eyebrow">KPI mini-ranks</div>
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
                      label="Value"
                      value={metric.actualValue !== null ? metric.actualValue.toFixed(2) : 'No data'}
                    />
                    <KeyValue
                      label="Store rank"
                      value={formatRank(metric.storeRank, metric.storePopulation)}
                    />
                    <KeyValue
                      label="Turkey rank"
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
              <EmptyState copy="Official monthly ranking starts after 3 closed performance days." />
            ) : null}
          </div>
        </article>
      </section>
    </section>
  )
}
