import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ShieldAlert, Target, TrendingUp } from 'lucide-react'
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
  getKpiConfig,
  getKpiReport,
  getReportingSnapshotRuns,
  getStoreKpiHighlights,
} from '../features/reports/api'
import { formatDate, formatState, getErrorMessage } from '../lib/format'
import { ApiError } from '../lib/api'
import {
  formatKpiOwnerRole,
  matchesKpiMetricCode,
} from '../features/kpi/score-profiles'
import {
  formatPerformanceGrade,
  resolvePerformanceGrade,
} from '../features/kpi/grading'

type DisplayKpiRow = {
  storeId: string
  kpiCode: string
  kpiName: string
  periodStart: string
  periodEnd: string
  targetValue: string | null
  actualValue: string | null
  achievementRate: string | null
  statusBand: string | null
  scoreStatus: 'scored' | 'pending_normalization' | 'missing'
}

function toNumber(input: string | null) {
  const parsed = Number(input)
  return Number.isFinite(parsed) ? parsed : 0
}

function formatMetric(input: number) {
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: Number.isInteger(input) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(input)
}

function formatPercent(input: number) {
  return `${formatMetric(input * 100)}%`
}

function formatMetricValue(input: string | null, kpiCode?: string) {
  if (input === null) {
    return 'Veri yok'
  }

  const numericValue = toNumber(input)
  if (kpiCode === 'CR') {
    return formatPercent(numericValue)
  }

  return formatMetric(numericValue)
}

function formatAchievementValue(row: DisplayKpiRow) {
  if (row.achievementRate === null) {
    return row.actualValue !== null ? 'Pending normalization' : 'No data'
  }

  if (row.targetValue !== null) {
    return formatPercent(toNumber(row.achievementRate))
  }

  return `${formatMetric(toNumber(row.achievementRate))} puan`
}

function clampScore(input: number) {
  if (!Number.isFinite(input)) {
    return 0
  }

  return Math.max(0, Math.min(input, 1.2))
}

function hasReportingAccess(authSummary: AuthSessionSummary | null) {
  const roles = authSummary?.user.roleCodes ?? []
  return (
    roles.includes('SUPER_ADMIN') ||
    roles.includes('REPORT_VIEWER') ||
    roles.includes('AUDITOR') ||
    roles.includes('STORE_MANAGER')
  )
}

function hasStoreShellIntent(authSummary: AuthSessionSummary | null) {
  const roles = authSummary?.user.roleCodes ?? []
  return roles.includes('STORE_MANAGER') || Boolean(authSummary?.user.scope.storeIds.length)
}

export function StoreKpiHighlightsPage(input: {
  authSummary: AuthSessionSummary | null
}) {
  const reportingAllowed = hasReportingAccess(input.authSummary)
  const primaryStoreId = input.authSummary?.user.scope.storeIds[0] ?? undefined
  const storeShellIntent = hasStoreShellIntent(input.authSummary)
  const [viewMode, setViewMode] = useState<'live' | 'closed'>('live')
  const [snapshotDateFilter, setSnapshotDateFilter] = useState('')
  const [livePeriodStart, setLivePeriodStart] = useState('')

  const configQuery = useQuery({
    queryKey: ['store-kpi-config'],
    queryFn: getKpiConfig,
    enabled: Boolean(input.authSummary),
    retry: false,
  })

  const liveKpiQuery = useQuery({
    queryKey: ['store-kpis-live', livePeriodStart || 'latest-monthly'],
    queryFn: () =>
      getStoreKpiHighlights({
        periodType: 'monthly',
        periodStart: livePeriodStart || undefined,
      }),
    enabled: reportingAllowed && viewMode === 'live',
    retry: false,
  })

  const dailySnapshotQuery = useQuery({
    queryKey: ['store-kpis-snapshot-runs', snapshotDateFilter || 'latest'],
    queryFn: () =>
      getReportingSnapshotRuns({
        snapshotType: 'daily',
        snapshotDate: snapshotDateFilter || undefined,
        limit: 1,
        offset: 0,
      }),
    enabled: reportingAllowed && viewMode === 'closed',
    retry: false,
  })

  const activeSnapshotRun = dailySnapshotQuery.data?.items[0] ?? null
  const snapshotRunId = activeSnapshotRun?.snapshotRunId ?? ''
  const closedKpiQuery = useQuery({
    queryKey: ['store-kpis-closed', snapshotRunId || 'no-run'],
    queryFn: () => getKpiReport(snapshotRunId),
    enabled: reportingAllowed && viewMode === 'closed' && Boolean(snapshotRunId),
    retry: false,
  })

  const liveRows = useMemo<DisplayKpiRow[]>(() => {
    return (
      liveKpiQuery.data?.metrics.map((metric) => ({
        storeId: liveKpiQuery.data?.store?.storeId ?? primaryStoreId ?? '',
        kpiCode: metric.code,
        kpiName: metric.label,
        periodStart: liveKpiQuery.data?.period?.periodStart ?? '',
        periodEnd: liveKpiQuery.data?.period?.periodEnd ?? '',
        targetValue:
          metric.targetValue !== null ? String(metric.targetValue) : null,
        actualValue:
          metric.actualValue !== null ? String(metric.actualValue) : null,
        achievementRate:
          metric.achievementRate !== null ? String(metric.achievementRate) : null,
        statusBand: metric.statusBand,
        scoreStatus: metric.scoreStatus,
      })) ?? []
    )
  }, [liveKpiQuery.data, primaryStoreId])

  const closedRows = useMemo<DisplayKpiRow[]>(() => {
    const allRows = closedKpiQuery.data?.items ?? []
    const filteredRows = primaryStoreId
      ? allRows.filter((row) => row.storeId === primaryStoreId)
      : allRows

    return filteredRows.map((row) => ({
      storeId: row.storeId,
      kpiCode: row.kpiCode,
      kpiName: row.kpiName,
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      targetValue: row.targetValue,
      actualValue: row.actualValue,
      achievementRate: row.achievementRate,
      statusBand: row.statusBand,
      scoreStatus: row.achievementRate ? 'scored' : 'missing',
    }))
  }, [closedKpiQuery.data?.items, primaryStoreId])

  const rows = viewMode === 'live' ? liveRows : closedRows
  const storeKpiScoreProfile = configQuery.data?.storeProfile
  const personnelKpiScoreProfile = configQuery.data?.personnelProfile
  const kpiOwnershipMatrix = configQuery.data?.ownershipMatrix ?? []

  const totals = useMemo(
    () =>
      rows.reduce(
        (accumulator, row) => {
          accumulator.target += toNumber(row.targetValue)
          accumulator.actual += toNumber(row.actualValue)
          accumulator.achievement += toNumber(row.achievementRate)
          if (row.statusBand === 'on_track' || row.statusBand === 'exceeded') {
            accumulator.onTrack += 1
          }
          if (row.statusBand === 'at_risk') accumulator.atRisk += 1
          if (row.statusBand === 'off_track') accumulator.offTrack += 1
          if (row.scoreStatus === 'pending_normalization') {
            accumulator.pendingNormalization += 1
          }
          return accumulator
        },
        {
          target: 0,
          actual: 0,
          achievement: 0,
          onTrack: 0,
          atRisk: 0,
          offTrack: 0,
          pendingNormalization: 0,
        },
      ),
    [rows],
  )

  const averageAchievement =
    rows.filter((row) => row.achievementRate !== null).length > 0
      ? totals.achievement /
        rows.filter((row) => row.achievementRate !== null).length
      : 0

  const topPerformer = useMemo(() => {
    return (
      [...rows]
        .filter((row) => row.achievementRate !== null)
        .sort(
          (left, right) =>
            toNumber(right.achievementRate) - toNumber(left.achievementRate),
        )[0] ?? null
    )
  }, [rows])

  const needsAttention = useMemo(() => {
    return rows.filter(
      (row) => row.statusBand === 'off_track' || row.statusBand === 'at_risk',
    )
  }, [rows])

  const weightedScore = useMemo(() => {
    const contributions = (storeKpiScoreProfile?.metrics ?? []).map((metric) => {
      const matchingRow = rows.find((row) => matchesKpiMetricCode(metric, row.kpiCode))
      const achievementRate =
        matchingRow?.achievementRate !== null &&
        matchingRow?.achievementRate !== undefined
          ? clampScore(toNumber(matchingRow.achievementRate))
          : null
      const weightedContribution =
        achievementRate === null ? 0 : (achievementRate * metric.weightPercent) / 100

      return {
        metric,
        matchingRow,
        achievementRate,
        weightedContribution,
      }
    })

    const coveredWeight = contributions.reduce((total, item) => {
      return total + (item.matchingRow?.scoreStatus === 'scored' ? item.metric.weightPercent : 0)
    }, 0)
    const scoreValue = contributions.reduce(
      (total, item) => total + item.weightedContribution,
      0,
    )

    return {
      contributions,
      coveredWeight,
      scoreValue,
      missingWeight: Math.max(0, 100 - coveredWeight),
    }
  }, [rows, storeKpiScoreProfile])

  const matchedMetricCount = weightedScore.contributions.filter(
    (item) => item.matchingRow?.scoreStatus === 'scored',
  ).length
  const storeGrade = resolvePerformanceGrade(
    weightedScore.scoreValue,
    configQuery.data?.gradingBands,
  )
  const personnelWeightsReady =
    (personnelKpiScoreProfile?.metrics ?? []).length > 0 &&
    (personnelKpiScoreProfile?.metrics ?? []).every(
      (metric) => metric.weightPercent > 0,
    )

  const isLoading =
    configQuery.isLoading ||
    (viewMode === 'live' ? liveKpiQuery.isLoading : dailySnapshotQuery.isLoading || closedKpiQuery.isLoading)

  if (!reportingAllowed) {
    return (
      <section className="page-stack">
        <section className="hero-panel store-hero-panel">
          <div>
            <div className="eyebrow">Store KPI Highlights</div>
            <h2 className="hero-title">
              This is where store-scoped KPI signal should live once store-facing KPI visibility is enabled.
            </h2>
            <p className="hero-copy">
              The route boundary is in the correct shell, but the current session does not yet have
              KPI reporting access.
            </p>
          </div>
          <div className="hero-metrics">
            <MetricAccent label="Route" value="/store/kpis" />
            <MetricAccent label="Store scope" value={primaryStoreId ?? 'No store scope'} />
            <MetricAccent label="State" value="Preview" />
          </div>
        </section>

        {storeShellIntent ? (
          <section className="panel">
            <div className="key-grid">
              <KeyValue label="Primary store scope" value={primaryStoreId ?? 'No explicit store'} />
              <KeyValue
                label="Resolved roles"
                value={input.authSummary?.user.roleCodes.join(', ') || 'none'}
              />
            </div>
          </section>
        ) : null}
      </section>
    )
  }

  if (isLoading) {
    return (
      <ScreenState
        title="Loading store KPI highlights"
        copy="Store KPI verisi hazirlaniyor."
      />
    )
  }

  if (configQuery.isError) {
    return (
      <ScreenState
        title="KPI config unavailable"
        copy={getErrorMessage(configQuery.error)}
        tone="error"
      />
    )
  }

  if (viewMode === 'live' && liveKpiQuery.isError) {
    if (liveKpiQuery.error instanceof ApiError && liveKpiQuery.error.status === 403) {
      return (
        <ScreenState
          title="KPI highlights not available for this session"
          copy="Bu oturum store KPI live read path'ine erisemiyor."
          tone="error"
        />
      )
    }

    return (
      <ScreenState
        title="KPI rows unavailable"
        copy={getErrorMessage(liveKpiQuery.error)}
        tone="error"
      />
    )
  }

  if (viewMode === 'closed' && dailySnapshotQuery.isError) {
    return (
      <ScreenState
        title="KPI tarih filtresi acilamadi"
        copy={getErrorMessage(dailySnapshotQuery.error)}
        tone="error"
      />
    )
  }

  if (viewMode === 'closed' && snapshotDateFilter && !activeSnapshotRun) {
    return (
      <section className="page-stack">
        <section className="hero-panel store-hero-panel">
          <div>
            <div className="eyebrow">Store KPI Highlights</div>
            <h2 className="hero-title">Secilen tarih icin kapanmis snapshot bulunamadi.</h2>
            <p className="hero-copy">
              Baska bir gun sec veya filtreyi temizleyip son kapanmis gun verisine don.
            </p>
          </div>
          <div className="hero-metrics">
            <MetricAccent label="Route" value="/store/kpis" />
            <MetricAccent label="Requested date" value={snapshotDateFilter} />
            <MetricAccent label="State" value="No snapshot" />
          </div>
        </section>
      </section>
    )
  }

  if (viewMode === 'closed' && !snapshotDateFilter && !activeSnapshotRun) {
    return (
      <ScreenState
        title="Kapanmis KPI gunu hazir degil"
        copy="Once bir daily closure tamamlanmali."
        tone="error"
      />
    )
  }

  if (viewMode === 'closed' && closedKpiQuery.isError) {
    return (
      <ScreenState
        title="KPI rows unavailable"
        copy={getErrorMessage(closedKpiQuery.error)}
        tone="error"
      />
    )
  }

  const liveSummary = liveKpiQuery.data
  const activeStoreName =
    viewMode === 'live'
      ? liveSummary?.store?.storeName ?? 'Unknown store'
      : primaryStoreId ?? 'Unknown store'
  const latestLivePeriodLabel =
    liveSummary?.period
      ? `${formatDate(liveSummary.period.periodStart)} - ${formatDate(liveSummary.period.periodEnd)} (Son aylik donem)`
      : 'Son aylik donem'

  return (
    <section className="page-stack">
      <section className="hero-panel store-hero-panel">
        <div>
          <div className="eyebrow">Store KPI Highlights</div>
          <h2 className="hero-title">
            Store-scoped KPI signal shaped for action instead of admin drill-down.
          </h2>
          <p className="hero-copy">
            Canli donem modu imported aylik veriyi gosterir. Kapanmis gun modu immutable daily
            closure snapshot'ini gosterir.
          </p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label="Mod" value={viewMode === 'live' ? 'Canli donem' : 'Kapanmis gun'} />
          <MetricAccent label="Store" value={activeStoreName} />
          <MetricAccent
            label="Period"
            value={
              viewMode === 'live'
                ? liveSummary?.period
                  ? `${formatDate(liveSummary.period.periodStart)} - ${formatDate(liveSummary.period.periodEnd)}`
                  : 'No live period'
                : activeSnapshotRun?.snapshotDate ?? 'No snapshot'
            }
          />
          <MetricAccent
            label="Grade"
            value={`${storeGrade.emoji} ${storeGrade.code}`}
          />
          <MetricAccent
            label={viewMode === 'live' ? 'Ort. puan' : 'Avg achievement'}
            value={
              rows.length > 0
                ? viewMode === 'live'
                  ? `${formatMetric(averageAchievement)} puan`
                  : formatPercent(averageAchievement)
                : 'No scoreable rows'
            }
          />
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">Gorunum modu</div>
            <h3>Canli imported veri mi, kapanmis gun mu</h3>
          </div>
        </div>
        <div className="toolbar-cluster">
          <button
            className="control-button"
            type="button"
            data-active={viewMode === 'live'}
            onClick={() => setViewMode('live')}
          >
            Canli donem
          </button>
          <button
            className="control-button"
            type="button"
            data-active={viewMode === 'closed'}
            onClick={() => setViewMode('closed')}
          >
            Kapanmis gun
          </button>
        </div>
        {viewMode === 'live' ? (
          <div className="toolbar-cluster">
            <select
              className="control-input"
              value={livePeriodStart}
              onChange={(event) => setLivePeriodStart(event.target.value)}
              aria-label="Canli KPI donemi"
            >
              <option value="">{latestLivePeriodLabel}</option>
              {(liveSummary?.availablePeriods ?? []).map((period) => (
                <option
                  key={`${period.periodType}:${period.periodStart}`}
                  value={period.periodStart}
                >
                  {`${formatDate(period.periodStart)} - ${formatDate(period.periodEnd)} · ${formatState(period.periodType)}`}
                </option>
              ))}
            </select>
            <button
              className="control-button"
              type="button"
              onClick={() => setLivePeriodStart('')}
              disabled={!livePeriodStart}
            >
              Filtreyi temizle
            </button>
          </div>
        ) : (
          <div className="toolbar-cluster">
            <input
              className="control-input"
              type="date"
              value={snapshotDateFilter}
              onChange={(event) => setSnapshotDateFilter(event.target.value)}
              aria-label="KPI snapshot date"
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
        )}
      </section>

      <section className="metric-grid store-metric-grid">
        <MetricCard
          title="KPI rows"
          value={rows.length}
          note="Bu store shell'de gorunen satirlar"
          icon={<Target size={18} />}
          tone="accent"
        />
        <MetricCard
          title="Skorlanan"
          value={matchedMetricCount}
          note={`${totals.pendingNormalization} normalization bekliyor`}
          icon={<TrendingUp size={18} />}
          tone={totals.pendingNormalization === 0 ? 'calm' : 'warning'}
        />
        <MetricCard
          title="Needs attention"
          value={needsAttention.length}
          note={`${totals.atRisk} at risk · ${totals.offTrack} off track`}
          icon={<ShieldAlert size={18} />}
          tone={needsAttention.length === 0 ? 'neutral' : 'warning'}
        />
        <MetricCard
          title="Weighted score"
          value={Number((weightedScore.scoreValue * 100).toFixed(1))}
          note={`${formatPerformanceGrade(storeGrade)} · ${weightedScore.coveredWeight}% coverage`}
          icon={<TrendingUp size={18} />}
          tone={storeGrade.tone}
        />
      </section>

      <section className="two-up-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Current Context</div>
              <h3>KPI scope for this shell</h3>
            </div>
          </div>
          <div className="key-grid">
            <KeyValue label="Primary store id" value={primaryStoreId ?? 'No explicit store scope'} />
            <KeyValue label="Store name" value={activeStoreName} />
            <KeyValue
              label="Source"
              value={viewMode === 'live' ? 'Imported monthly live state' : 'Daily closure snapshot'}
            />
            <KeyValue
              label="Resolved roles"
              value={input.authSummary?.user.roleCodes.join(', ') || 'none'}
            />
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Top Signal</div>
              <h3>What stands out first</h3>
            </div>
            <StatusPill tone={needsAttention.length === 0 ? 'calm' : 'warning'}>
              {needsAttention.length === 0 ? 'Stable' : 'Attention'}
            </StatusPill>
          </div>
          {topPerformer ? (
            <div className="stacked-table">
              <div className="stacked-row">
                <div className="stacked-row-head">
                  <div>
                    <strong>{topPerformer.kpiName}</strong>
                    <span className="queue-subtitle">{topPerformer.kpiCode}</span>
                  </div>
                  <StatusPill tone="accent">
                    {formatAchievementValue(topPerformer)}
                  </StatusPill>
                </div>
                <p>Bu moddaki en guclu sinyal.</p>
              </div>
            </div>
          ) : (
            <EmptyState
              title="Scoreable KPI highlight yok"
              copy="Bu donemde skora dahil olabilecek KPI satiri henuz hazir degil."
            />
          )}
        </article>
      </section>

      {viewMode === 'live' && liveSummary?.partial.isPartial ? (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Partial Durum</div>
              <h3>Store score henuz tam degil</h3>
            </div>
            <StatusPill tone="warning">Partial</StatusPill>
          </div>
          <div className="key-grid">
            <KeyValue
              label="Eksik metrikler"
              value={
                liveSummary.partial.missingMetricLabels.length > 0
                  ? liveSummary.partial.missingMetricLabels.join(', ')
                  : 'Yok'
              }
            />
            <KeyValue
              label="Normalization bekleyenler"
              value={
                liveSummary.partial.pendingNormalizationLabels.length > 0
                  ? liveSummary.partial.pendingNormalizationLabels.join(', ')
                  : 'Yok'
              }
            />
            <KeyValue
              label="Not"
              value="Target bazli KPI'lar hedefe, CR/ATV/UPT ise Turkiye ortalamasina gore puanlanir."
            />
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">Weighted Score Summary</div>
            <h3>How the current period contributes to the store score</h3>
          </div>
          <StatusPill tone={weightedScore.missingWeight === 0 ? 'calm' : 'warning'}>
            {weightedScore.missingWeight === 0 ? 'Complete' : `${weightedScore.missingWeight}% missing`}
          </StatusPill>
        </div>
        <div className="key-grid">
          <KeyValue label="Score value" value={formatPercent(weightedScore.scoreValue)} />
          <KeyValue label="Grade" value={formatPerformanceGrade(storeGrade)} />
          <KeyValue label="Covered weight" value={`${weightedScore.coveredWeight}%`} />
          <KeyValue label="Missing weight" value={`${weightedScore.missingWeight}%`} />
          <KeyValue label="Profile" value={storeKpiScoreProfile?.title ?? 'No profile'} />
          <KeyValue label="Config source" value="Published live config" />
          <KeyValue
            label="Matched metrics"
            value={`${matchedMetricCount}/${weightedScore.contributions.length}`}
          />
          <KeyValue
            label="Personnel weights"
            value={personnelWeightsReady ? 'Weighted' : 'Needs weights'}
          />
        </div>
        <div className="stacked-table">
          {weightedScore.contributions.map((item) => (
            <article className="stacked-row" key={item.metric.code}>
              <div className="stacked-row-head">
                <div>
                  <strong>{item.metric.label}</strong>
                  <span className="queue-subtitle">
                    {item.matchingRow ? item.matchingRow.kpiCode : 'Waiting for KPI row'}
                  </span>
                </div>
                <StatusPill
                  tone={
                    item.matchingRow?.scoreStatus === 'scored'
                      ? 'accent'
                      : item.matchingRow?.scoreStatus === 'pending_normalization'
                        ? 'warning'
                        : 'neutral'
                  }
                >
                  {`${item.metric.weightPercent}%`}
                </StatusPill>
              </div>
              <div className="key-grid">
                <KeyValue
                  label="Target"
                  value={formatMetricValue(item.matchingRow?.targetValue ?? null, item.matchingRow?.kpiCode)}
                />
                <KeyValue
                  label="Actual"
                  value={formatMetricValue(item.matchingRow?.actualValue ?? null, item.matchingRow?.kpiCode)}
                />
                <KeyValue
                  label="Achievement"
                  value={
                    item.matchingRow
                      ? formatAchievementValue(item.matchingRow)
                      : 'No data'
                  }
                />
                <KeyValue
                  label="Weighted contribution"
                  value={formatPercent(item.weightedContribution)}
                />
                <KeyValue
                  label="Behavior"
                  value={formatState(item.metric.scoreBehavior)}
                />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">Ownership Matrix</div>
            <h3>Which KPI belongs to whom</h3>
          </div>
        </div>
        <div className="stacked-table">
          {kpiOwnershipMatrix.map((metric) => (
            <article className="stacked-row" key={metric.code}>
              <div className="stacked-row-head">
                <div>
                  <strong>{metric.label}</strong>
                  <span className="queue-subtitle">{metric.code}</span>
                </div>
                <StatusPill tone={metric.taskCandidate ? 'warning' : 'neutral'}>
                  {metric.taskCandidate ? 'Task candidate' : 'Observe first'}
                </StatusPill>
              </div>
              <div className="key-grid">
                <KeyValue
                  label="Operational owner"
                  value={formatState(formatKpiOwnerRole(metric.operationalOwner))}
                />
                <KeyValue
                  label="Visible to"
                  value={metric.visibleTo
                    .map((role) => formatState(formatKpiOwnerRole(role)))
                    .join(', ')}
                />
                <KeyValue
                  label="Contributes to"
                  value={metric.contributesTo.join(', ')}
                />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">Priority Follow-Up</div>
            <h3>Rows that should shape future store action</h3>
          </div>
        </div>

        {needsAttention.length === 0 ? (
          <EmptyState
            title="No at-risk or off-track KPI rows are visible."
            copy="That can mean the visible KPI set is healthy, or the current period has not produced store-specific exception rows."
          />
        ) : (
          <div className="stacked-table">
            {needsAttention.map((row) => (
              <article className="stacked-row" key={`${row.storeId}:${row.kpiCode}`}>
                <div className="stacked-row-head">
                  <div>
                    <strong>{row.kpiName}</strong>
                    <span className="queue-subtitle">{row.kpiCode}</span>
                  </div>
                  <StatusPill tone={row.statusBand === 'off_track' ? 'danger' : 'warning'}>
                    {row.statusBand ?? 'unknown'}
                  </StatusPill>
                </div>
                <div className="key-grid">
                  <KeyValue label="Target" value={formatMetricValue(row.targetValue, row.kpiCode)} />
                  <KeyValue label="Actual" value={formatMetricValue(row.actualValue, row.kpiCode)} />
                  <KeyValue
                    label="Achievement"
                    value={formatAchievementValue(row)}
                  />
                  <KeyValue
                    label="Period"
                    value={`${formatDate(row.periodStart)} - ${formatDate(row.periodEnd)}`}
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  )
}
