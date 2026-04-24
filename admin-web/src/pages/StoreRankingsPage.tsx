import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Medal, Store, Trophy } from 'lucide-react'
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

export function StoreRankingsPage(input: {
  authSummary: AuthSessionSummary | null
}) {
  const enabled = canUseRankings(input.authSummary)
  const [snapshotDateFilter, setSnapshotDateFilter] = useState('')
  const configQuery = useQuery({
    queryKey: ['store-rankings-kpi-config'],
    queryFn: getKpiConfig,
    enabled,
    retry: false,
  })
  const leaderboardQuery = useQuery({
    queryKey: ['closed-leaderboard', snapshotDateFilter || 'latest'],
    queryFn: () =>
      getClosedLeaderboard({
        limit: 10,
        snapshotDate: snapshotDateFilter || undefined,
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
        title="Kapanmis gun siralamasi hazirlaniyor"
        copy="Son tamamlanan daily closure snapshot okunuyor."
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
  const currentStoreGrade = leaderboard?.currentStore
    ? resolvePerformanceGrade(leaderboard.currentStore.scoreValue, configQuery.data?.gradingBands)
    : null
  if (!leaderboard?.source.snapshotRunId) {
    return (
      <ScreenState
        title={snapshotDateFilter ? 'Secilen tarih icin siralama hazir degil' : 'Kapanmis gun siralamasi hazir degil'}
        copy={
          snapshotDateFilter
            ? 'Bu tarih icin tamamlanmis daily closure bulunamadi.'
            : 'Once bir daily closure tamamlanmali.'
        }
        tone="error"
      />
    )
  }

  return (
    <section className="page-stack">
      <section className="hero-panel store-hero-panel">
        <div>
          <div className="eyebrow">Kapanmis Gun Siralamalari</div>
          <h2 className="hero-title">Daily closure sonrasi degismeyen historical leaderboard.</h2>
          <p className="hero-copy">
            Bu yuzey canli degil. Son tamamlanan gun kapanisindan okur ve historical siralama dilini sabitler.
          </p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label="Route" value="/store/rankings" />
          <MetricAccent label="Snapshot" value={leaderboard.source.snapshotRunId.slice(0, 12)} />
          <MetricAccent label="Date" value={leaderboard.source.snapshotDate ?? 'No date'} />
          <MetricAccent label="Filter" value={snapshotDateFilter || 'Latest closed'} />
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">Tarih Filtresi</div>
            <h3>Hangi kapanmis gunu gormek istiyorsun</h3>
          </div>
          <StatusPill tone={snapshotDateFilter ? 'accent' : 'neutral'}>
            {snapshotDateFilter ? 'Filtered' : 'Latest'}
          </StatusPill>
        </div>
        <div className="toolbar-cluster">
          <input
            className="control-input"
            type="date"
            value={snapshotDateFilter}
            onChange={(event) => setSnapshotDateFilter(event.target.value)}
            aria-label="Ranking snapshot date"
          />
          <button
            className="control-button"
            type="button"
            onClick={() => setSnapshotDateFilter('')}
            disabled={!snapshotDateFilter}
          >
            Filtreyi temizle
          </button>
        </div>
      </section>

      <section className="metric-grid store-metric-grid">
        <MetricCard
          title="Turkey top"
          value={leaderboard.personnelTop.length}
          note="Closed daily snapshot icindeki personel listesi."
          icon={<Trophy size={18} />}
          tone="accent"
        />
        <MetricCard
          title="Current employee rank"
          value={leaderboard.currentEmployee?.turkeyRank ?? 0}
          note={
            leaderboard.currentEmployee
              ? `${leaderboard.currentEmployee.displayName} · ${currentEmployeeGrade ? formatPerformanceGrade(currentEmployeeGrade) : ''}`
              : 'Aktif employee kaydi bulunamadi.'
          }
          icon={<Medal size={18} />}
          tone={currentEmployeeGrade?.tone ?? 'neutral'}
        />
        <MetricCard
          title="Current store rank"
          value={leaderboard.currentStore?.rank ?? 0}
          note={
            leaderboard.currentStore
              ? `${leaderboard.currentStore.storeName} · ${currentStoreGrade ? formatPerformanceGrade(currentStoreGrade) : ''}`
              : 'Aktif store skoru bulunamadi.'
          }
          icon={<Store size={18} />}
          tone={currentStoreGrade?.tone ?? 'calm'}
        />
      </section>

      <section className="two-up-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Snapshot context</div>
              <h3>Bu ranking neye gore hesaplandi</h3>
            </div>
            <StatusPill tone="calm">Closed</StatusPill>
          </div>
          <div className="key-grid">
            <KeyValue label="Snapshot date" value={leaderboard.source.snapshotDate ? formatDate(leaderboard.source.snapshotDate) : 'Unknown'} />
            <KeyValue label="Period" value={`${leaderboard.source.periodStart ?? 'n/a'} -> ${leaderboard.source.periodEnd ?? 'n/a'}`} />
            <KeyValue label="Current employee" value={leaderboard.currentEmployee?.displayName ?? 'No employee'} />
            <KeyValue label="Current store" value={leaderboard.currentStore?.storeName ?? 'No store'} />
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Current position</div>
              <h3>Aktif kullanici nerede duruyor</h3>
            </div>
          </div>
          {leaderboard.currentEmployee ? (
            <div className="key-grid">
              <KeyValue
                label="Turkey rank"
                value={
                  leaderboard.currentEmployee.turkeyRank !== null
                    ? String(leaderboard.currentEmployee.turkeyRank)
                    : 'No rank'
                }
              />
              <KeyValue
                label="Store rank"
                value={
                  leaderboard.currentEmployee.storeRank !== null
                    ? String(leaderboard.currentEmployee.storeRank)
                    : 'No rank'
                }
              />
              <KeyValue label="Score" value={leaderboard.currentEmployee.scoreValue.toFixed(2)} />
              <KeyValue
                label="Grade"
                value={
                  currentEmployeeGrade ? formatPerformanceGrade(currentEmployeeGrade) : 'No grade'
                }
              />
              <KeyValue label="Store" value={leaderboard.currentEmployee.storeName ?? 'Unknown'} />
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
              <div className="eyebrow">Turkey personnel top</div>
              <h3>Ilk 10 personel</h3>
            </div>
          </div>
          <div className="stacked-table">
            {leaderboard.personnelTop.map((item) => (
              <article className="stacked-row" key={item.employeeId}>
                <div className="stacked-row-head">
                  <div>
                    <strong>{item.displayName}</strong>
                    <span className="queue-subtitle">{item.storeName ?? 'Store yok'}</span>
                  </div>
                  <StatusPill tone={resolvePerformanceGrade(item.scoreValue, configQuery.data?.gradingBands).tone}>
                    {`${resolvePerformanceGrade(item.scoreValue, configQuery.data?.gradingBands).emoji} #${item.turkeyRank !== null ? String(item.turkeyRank) : '-'}`}
                  </StatusPill>
                </div>
                <div className="key-grid">
                  <KeyValue label="Score" value={item.scoreValue.toFixed(2)} />
                  <KeyValue
                    label="Grade"
                    value={formatPerformanceGrade(resolvePerformanceGrade(item.scoreValue, configQuery.data?.gradingBands))}
                  />
                  <KeyValue
                    label="Store rank"
                    value={item.storeRank !== null ? String(item.storeRank) : 'No rank'}
                  />
                </div>
              </article>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Store top</div>
              <h3>Ilk 10 magaza</h3>
            </div>
          </div>
          <div className="stacked-table">
            {leaderboard.storeTop.map((item) => (
              <article className="stacked-row" key={item.storeId}>
                <div className="stacked-row-head">
                  <div>
                    <strong>{item.storeName}</strong>
                    <span className="queue-subtitle">{item.matchedMetrics}/{item.totalMetrics} metrik</span>
                  </div>
                  <StatusPill tone={resolvePerformanceGrade(item.scoreValue, configQuery.data?.gradingBands).tone}>
                    {`${resolvePerformanceGrade(item.scoreValue, configQuery.data?.gradingBands).emoji} #${String(item.rank)}`}
                  </StatusPill>
                </div>
                <div className="key-grid">
                  <KeyValue label="Score" value={item.scoreValue.toFixed(2)} />
                  <KeyValue
                    label="Grade"
                    value={formatPerformanceGrade(resolvePerformanceGrade(item.scoreValue, configQuery.data?.gradingBands))}
                  />
                </div>
              </article>
            ))}
          </div>
        </article>
      </section>
    </section>
  )
}
