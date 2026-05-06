import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Medal, Target, Trophy, UserRound } from 'lucide-react'
import {
  EmptyState,
  KeyValue,
  MetricAccent,
  MetricCard,
  ScreenState,
  StatusPill,
} from '../components/dashboard-primitives'
import type { AuthSessionSummary } from '../features/auth/api'
import { formatDisplayRoles } from '../features/auth/display'
import { getKpiConfig, getMyPerformance, getReportingSnapshotRuns } from '../features/reports/api'
import { formatSnapshotOptionLabel } from '../features/reports/snapshot-labels'
import {
  describeBenchmarkCap,
  formatPerformanceGrade,
  resolvePerformanceGrade,
  resolvePerformanceScoreMeaning,
} from '../features/kpi/grading'
import {
  resolveKpiScoreReference,
  resolveKpiSourceSemantics,
} from '../features/kpi/source-semantics'
import { formatDate, formatState, getErrorMessage } from '../lib/format'

function canUseSelfPerformance(authSummary: AuthSessionSummary | null) {
  const roles = authSummary?.user.roleCodes ?? []
  return roles.includes('STORE_PERSONNEL') || roles.includes('STORE_MANAGER')
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

function formatMetricValue(input: number | null, code: string) {
  if (input === null) {
    return 'Veri yok'
  }

  if (code === 'TARGET_ACHIEVEMENT') {
    return formatPercent(input)
  }

  return formatMetric(input)
}

function formatCurrency(input: number | null) {
  if (input === null) {
    return 'Veri yok'
  }

  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(input)
}

function formatAchievementValue(metric: {
  targetValue?: number | null
  achievementRate?: number | null
  actualValue: number | null
  scoreStatus?: string
}) {
  if (metric.scoreStatus === 'missing_reference') {
    return 'Eksik referans'
  }

  if (metric.achievementRate === null || metric.achievementRate === undefined) {
    return metric.actualValue !== null ? 'Pending normalization' : 'Veri yok'
  }

  if (metric.targetValue !== null && metric.targetValue !== undefined) {
    return formatPercent(metric.achievementRate)
  }

  return `${formatMetric(metric.achievementRate)} puan`
}

export function StoreMyPerformancePage(input: {
  authSummary: AuthSessionSummary | null
}) {
  const enabled = canUseSelfPerformance(input.authSummary)
  const [sourceMode, setSourceMode] = useState<'live' | 'closed'>('live')
  const [selectedLivePeriodStart, setSelectedLivePeriodStart] = useState('')
  const [selectedClosedSnapshotRunId, setSelectedClosedSnapshotRunId] = useState('')

  const configQuery = useQuery({
    queryKey: ['store-me-kpi-config'],
    queryFn: getKpiConfig,
    enabled,
    retry: false,
  })

  const closedRunsQuery = useQuery({
    queryKey: ['store-me-closed-snapshot-runs'],
    queryFn: () =>
      getReportingSnapshotRuns({
        snapshotType: 'daily',
        limit: 30,
        offset: 0,
      }),
    enabled: enabled && sourceMode === 'closed',
    retry: false,
  })

  const availableClosedSnapshotRuns = closedRunsQuery.data?.items ?? []
  const activeClosedSnapshotRun =
    availableClosedSnapshotRuns.find(
      (run) => run.snapshotRunId === selectedClosedSnapshotRunId,
    ) ??
    availableClosedSnapshotRuns[0] ??
    null
  const selectedClosedSnapshotDate = activeClosedSnapshotRun?.snapshotDate ?? ''

  const performanceQuery = useQuery({
    queryKey: ['my-performance', sourceMode, selectedLivePeriodStart, selectedClosedSnapshotDate],
    queryFn: () =>
      getMyPerformance({
        mode: sourceMode,
        periodType: sourceMode === 'live' && selectedLivePeriodStart ? 'monthly' : undefined,
        periodStart: sourceMode === 'live' && selectedLivePeriodStart ? selectedLivePeriodStart : undefined,
        snapshotDate:
          sourceMode === 'closed' && selectedClosedSnapshotDate ? selectedClosedSnapshotDate : undefined,
      }),
    enabled: enabled && (sourceMode === 'live' || !closedRunsQuery.isLoading),
    retry: false,
  })

  const performance = performanceQuery.data
  const user = input.authSummary?.user
  const availableLivePeriods = useMemo(
    () => (performance?.availablePeriods ?? []).filter((period) => period.periodType === 'monthly'),
    [performance?.availablePeriods],
  )

  if (!enabled) {
    return (
      <ScreenState
        title="Performans yuzeyi kullanilamiyor"
        copy="Bu yuzey magaza personeli veya magaza muduru oturumu gerektirir."
        tone="error"
      />
    )
  }

  if (performanceQuery.isLoading || configQuery.isLoading || (sourceMode === 'closed' && closedRunsQuery.isLoading)) {
    return (
      <ScreenState
        title="Benim performansim hazirlaniyor"
        copy="Personel score profile ve self-service yuzeyi yukleniyor."
      />
    )
  }

  if (performanceQuery.isError || configQuery.isError || (sourceMode === 'closed' && closedRunsQuery.isError)) {
    return (
      <ScreenState
        title="Performans yuzeyi acilamadi"
        copy={getErrorMessage(performanceQuery.error ?? configQuery.error ?? closedRunsQuery.error)}
        tone="error"
      />
    )
  }

  if (!performance?.employee) {
    return (
      <ScreenState
        title="Performans yuzeyi acilamadi"
        copy="Bu kullanici icin bireysel performans kaydi bulunamadi."
        tone="error"
      />
    )
  }

  const partial = performance.partial ?? {
    isPartial: true,
    missingMetricCodes: [],
    missingMetricLabels: [],
    pendingNormalizationCodes: [],
    pendingNormalizationLabels: [],
  }
  const supporting = performance.supporting ?? {
    netSalesValue: null,
    targetEntryMode: 'manager_assignment' as const,
    targetEditableByCurrentUser: false,
  }
  const performanceGrade = resolvePerformanceGrade(
    performance.score.value,
    configQuery.data?.gradingBands,
  )
  const scoreMeaning = resolvePerformanceScoreMeaning({
    grade: performanceGrade,
    matchedMetrics: performance.score.matchedMetrics,
    totalMetrics: performance.score.totalMetrics,
    isPartial: partial.isPartial,
  })

  return (
    <section className="page-stack">
      <section className="hero-panel store-hero-panel">
        <div>
          <div className="eyebrow">Benim Performansim</div>
          <h2 className="hero-title">Store personnel icin ayri self-performance yuzeyi.</h2>
          <p className="hero-copy">
            Bu yuzey manager operasyonlarindan ayri yasar. Burada kullanici kendi KPI,
            score, ranking ve donem secimlerini tek yerden takip eder.
          </p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label="Route" value="/store/me" />
          <MetricAccent label="Persona" value="STORE_PERSONNEL" />
          <MetricAccent label="Source" value={performance.source.mode === 'closed' ? 'Closed day' : 'Live'} />
          <MetricAccent label="Grade" value={`${performanceGrade.emoji} ${performanceGrade.code}`} />
        </div>
      </section>

      <section className="panel">
        <div className="toolbar-cluster">
          <button
            className="control-button"
            type="button"
            onClick={() => setSourceMode('live')}
            disabled={sourceMode === 'live'}
          >
            Canli durum
          </button>
          <button
            className="control-button"
            type="button"
            onClick={() => setSourceMode('closed')}
            disabled={sourceMode === 'closed'}
          >
            Kapanmis gun
          </button>
          {sourceMode === 'live' && availableLivePeriods.length > 0 ? (
            <label className="control-field">
              <span>Donem</span>
              <select
                value={selectedLivePeriodStart}
                onChange={(event) => setSelectedLivePeriodStart(event.target.value)}
              >
                <option value="">En guncel donem</option>
                {availableLivePeriods.map((period) => (
                  <option key={`${period.periodType}-${period.periodStart}`} value={period.periodStart}>
                    {`${formatDate(period.periodStart)} - ${formatDate(period.periodEnd)}`}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {sourceMode === 'closed' && availableClosedSnapshotRuns.length > 0 ? (
            <label className="control-field">
              <span>Kapanmis performans snapshot secimi</span>
              <select
                value={
                  selectedClosedSnapshotRunId ||
                  activeClosedSnapshotRun?.snapshotRunId ||
                  ''
                }
                onChange={(event) => setSelectedClosedSnapshotRunId(event.target.value)}
              >
                <option value="">Son kapanmis snapshot</option>
                {availableClosedSnapshotRuns.map((run) => (
                  <option key={run.snapshotRunId} value={run.snapshotRunId}>
                    {formatSnapshotOptionLabel(run)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        <div className="key-grid">
          <KeyValue
            label="Source mode"
            value={performance.source.mode === 'closed' ? 'Closed daily snapshot' : 'Live current state'}
          />
          <KeyValue label="Snapshot run" value={performance.source.snapshotRunId ?? 'Live mode'} />
          <KeyValue label="Snapshot date" value={performance.source.snapshotDate ?? 'Current'} />
          <KeyValue label="Data completeness" value={partial.isPartial ? 'Partial' : 'Complete'} />
          <KeyValue
            label="Target girisi"
            value={
              supporting.targetEntryMode === 'manager_assignment'
                ? 'Magaza muduru girer, bolge muduru onaylar'
                : 'Unknown'
            }
          />
        </div>
      </section>

      {partial.isPartial ? (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Veri Durumu</div>
              <h3>Bu score su an kismi veriyle hesaplaniyor</h3>
            </div>
            <StatusPill tone="warning">Partial</StatusPill>
          </div>
          <p className="queue-subtitle">
            Eksik metrikler: {partial.missingMetricLabels.join(', ') || 'Henuz metrik detayi yok'}
          </p>
          {partial.missingMetricCodes.includes('TARGET_ACHIEVEMENT') ? (
            <p className="queue-subtitle">
              Personel hedefi su an eksik. Bu alan personel tarafindan degistirilmez; magaza muduru girer ve
              bolge muduru onayina gider.
            </p>
          ) : null}
          {partial.pendingNormalizationLabels?.length ? (
            <p className="queue-subtitle">
              Normalizasyon bekleyenler: {partial.pendingNormalizationLabels.join(', ')}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="metric-grid store-metric-grid">
        <MetricCard
          title="Net sales"
          value={
            supporting.netSalesValue !== null
              ? Number(supporting.netSalesValue.toFixed(0))
              : 0
          }
          note={
            supporting.netSalesValue !== null
              ? `Power BI importundan gelen mevcut satis toplami: ${formatCurrency(supporting.netSalesValue)}`
              : 'Power BI importundan gelen satis verisi yok.'
          }
          icon={<Target size={18} />}
          tone="accent"
        />
        <MetricCard
          title="Weighted score"
          value={Number(performance.score.value.toFixed(1))}
          note={`${formatPerformanceGrade(performanceGrade)} - ${performance.score.matchedMetrics}/${performance.score.totalMetrics} metrik eslesti.`}
          icon={<Target size={18} />}
          tone={performanceGrade.tone}
        />
        <MetricCard
          title="Turkey ranking"
          value={performance.rankings.turkeyRank ?? 0}
          note={
            performance.rankings.turkeyRank
              ? `Toplam ${performance.rankings.turkeyPopulation} personel icinde.`
              : 'Henuz siralama verisi yok.'
          }
          icon={<Trophy size={18} />}
          tone="neutral"
        />
        <MetricCard
          title="Store ranking"
          value={performance.rankings.storeRank ?? 0}
          note={
            performance.rankings.storeRank
              ? `Toplam ${performance.rankings.storePopulation} magaza personeli icinde.`
              : 'Henuz magaza ici siralama verisi yok.'
          }
          icon={<Medal size={18} />}
          tone="neutral"
        />
        <MetricCard
          title="Current store"
          value={1}
          note={
            performance.employee.storeName
              ? `Aktif store: ${performance.employee.storeName}`
              : 'Bireysel performans bu aktif store scope ile okunur.'
          }
          icon={<UserRound size={18} />}
          tone="calm"
        />
      </section>

      <section className="panel" aria-label="Score meaning">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">Skor yorumu</div>
            <h3>{scoreMeaning.title}</h3>
          </div>
          <StatusPill tone={scoreMeaning.tone}>{performanceGrade.code}</StatusPill>
        </div>
        <p className="queue-subtitle">{scoreMeaning.summary}</p>
        <div className="key-grid">
          <KeyValue label="Odak" value={scoreMeaning.focus} />
          <KeyValue label="Grade" value={formatPerformanceGrade(performanceGrade)} />
          <KeyValue label="Skor" value={performance.score.value.toFixed(1)} />
          <KeyValue
            label="Kaynak"
            value={performance.source.mode === 'closed' ? 'Kapanmis snapshot' : 'Canli donem'}
          />
        </div>
        <p className="queue-subtitle">{scoreMeaning.confidence}</p>
      </section>

      <section className="two-up-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Resolved Session</div>
              <h3>Bu kullanici ne gorecek</h3>
            </div>
            <StatusPill tone="accent">Read only</StatusPill>
          </div>
          <div className="key-grid">
            <KeyValue label="User id" value={user?.userId ?? 'Unknown'} />
            <KeyValue label="Employee id" value={performance.employee.employeeId} />
            <KeyValue label="Roles" value={formatDisplayRoles(user?.roleCodes)} />
            <KeyValue label="Store ids" value={user?.scope.storeIds.join(', ') || 'none'} />
            <KeyValue label="Grade" value={formatPerformanceGrade(performanceGrade)} />
            <KeyValue label="Data status" value={partial.isPartial ? 'Partial' : 'Complete'} />
            <KeyValue
              label="Period"
              value={
                performance.period
                  ? `${performance.period.periodStart} -> ${performance.period.periodEnd}`
                  : 'Unknown'
              }
            />
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Boundary</div>
              <h3>Bu yuzey ne yapmaz</h3>
            </div>
          </div>
          <EmptyState
            title="Manager is akislari burada yok"
            copy="Hedef dagitimi, onay, checklist kabulu ve magaza yonetimi bu persona yuzeyine tasinmaz."
          />
        </article>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">Personnel Metrics</div>
            <h3>{performance.employee.displayName}</h3>
          </div>
          <StatusPill tone={performanceGrade.tone}>
            {`${formatPerformanceGrade(performanceGrade)} - ${performance.score.value.toFixed(1)}`}
          </StatusPill>
        </div>
        <p className="queue-subtitle">
          Bu yuzey bireysel KPI metric degerlerini, score katkisini ve ranking sonucunu tek yerde gosterir.
        </p>
        <div className="stacked-table">
          {performance.metrics.map((metric) => {
            const sourceSemantics = resolveKpiSourceSemantics(metric)
            const scoreReference = resolveKpiScoreReference({
              targetValue: metric.targetValue ?? null,
              benchmarkValue: metric.benchmarkValue ?? null,
              benchmarkSource: metric.benchmarkSource ?? null,
            })

            return (
              <article className="stacked-row" key={metric.code}>
                <div className="stacked-row-head">
                  <div>
                    <strong>{metric.label}</strong>
                    <span className="queue-subtitle">{metric.code}</span>
                  </div>
                  <StatusPill
                    tone={
                      metric.scoreStatus === 'scored'
                        ? 'accent'
                        : metric.scoreStatus === 'pending_normalization' ||
                            metric.scoreStatus === 'missing_reference'
                          ? 'warning'
                          : 'danger'
                    }
                  >
                    {metric.scoreStatus === 'scored'
                      ? `${metric.weightPercent}%`
                      : metric.scoreStatus === 'pending_normalization'
                        ? 'Pending'
                        : metric.scoreStatus === 'missing_reference'
                          ? 'Referans eksik'
                        : 'Missing'}
                  </StatusPill>
                </div>
                <div className="key-grid">
                  <KeyValue
                    label="Actual"
                    value={formatMetricValue(metric.actualValue, metric.code)}
                  />
                  <KeyValue label="Achievement" value={formatAchievementValue(metric)} />
                  <KeyValue
                    label="Skor hedefi"
                    value={formatMetricValue(scoreReference.value, metric.code)}
                  />
                  <KeyValue label="Hedef kaynagi" value={scoreReference.sourceLabel} />
                  <KeyValue label="Contribution" value={`${metric.contributionValue.toFixed(2)}%`} />
                  <KeyValue
                    label="Status"
                    value={formatState(metric.scoreStatus ?? metric.status ?? 'missing')}
                  />
                  <KeyValue label="Kaynak tipi" value={sourceSemantics.label} />
                  <KeyValue label="Veri kaynagi" value={sourceSemantics.summary} />
                </div>
                {metric.isCapped ? (
                  <p className="queue-subtitle">
                    {describeBenchmarkCap({
                      actualRatio: metric.actualRatio,
                      scoredRatio: metric.scoredRatio,
                      isCapped: metric.isCapped,
                    })}
                  </p>
                ) : null}
                {metric.scoreStatus === 'missing_reference' ? (
                  <p className="queue-subtitle">
                    Eksik referans: {metric.missingReason ?? 'reference_missing'}
                  </p>
                ) : null}
              </article>
            )
          })}
        </div>
      </section>
    </section>
  )
}
