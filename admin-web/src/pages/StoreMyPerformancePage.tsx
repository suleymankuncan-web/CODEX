import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Medal, Target, Trophy, UserRound } from 'lucide-react'
import {
  KeyValue,
  MetricAccent,
  MetricCard,
  ScreenState,
  StatusPill,
} from '../components/dashboard-primitives'
import type { AuthSessionSummary } from '../features/auth/api'
import { getKpiConfig, getMyPerformance, getReportingSnapshotRuns } from '../features/reports/api'
import { formatSnapshotOptionLabel } from '../features/reports/snapshot-labels'
import {
  describeBenchmarkCap,
  resolvePerformanceGrade,
  resolvePerformanceScoreMeaning,
} from '../features/kpi/grading'
import {
  resolveKpiScoreReference,
  resolveKpiSourceSemantics,
} from '../features/kpi/source-semantics'
import { formatDate, getErrorMessage } from '../lib/format'

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
    return metric.actualValue !== null ? 'Normalizasyon bekliyor' : 'Veri yok'
  }

  if (metric.targetValue !== null && metric.targetValue !== undefined) {
    return formatPercent(metric.achievementRate)
  }

  return `${formatMetric(metric.achievementRate)} puan`
}

function formatSourceMode(mode: string) {
  return mode === 'closed' ? 'Kapanmış gün' : 'Canlı dönem'
}

function formatPeriodLabel(input: {
  period?: { periodStart: string; periodEnd: string } | null
  snapshotDate?: string | null
}) {
  if (input.period) {
    return `${formatDate(input.period.periodStart)} - ${formatDate(input.period.periodEnd)}`
  }

  if (input.snapshotDate) {
    return formatDate(input.snapshotDate)
  }

  return 'Güncel dönem'
}

function formatKpiSourceLabel(input: { kind: string; label: string }) {
  switch (input.kind) {
    case 'imported':
      return 'Operasyon verisi'
    case 'pending_normalization':
      return 'Normalizasyon bekliyor'
    case 'missing':
      return 'Veri yok'
    case 'checklist_fed':
      return 'Checklist katkısı'
    default:
      return input.label
  }
}

function formatKpiSourceSummary(input: { kind: string; summary: string }) {
  switch (input.kind) {
    case 'imported':
      return 'Satış veya operasyon kaynağından gelen KPI değeri.'
    case 'pending_normalization':
      return 'Değer geldi, skor hesabı için normalizasyon bekliyor.'
    case 'missing':
      return 'Bu metrik için henüz kullanılabilir veri yok.'
    default:
      return input.summary
  }
}

function formatStorePerformanceGrade(grade: ReturnType<typeof resolvePerformanceGrade>) {
  const labelByCode = {
    A: 'Mükemmel',
    B: 'İyi',
    C: 'Takip gerekli',
    D: 'Kritik',
  } as const

  return `${grade.emoji} ${grade.code} - ${labelByCode[grade.code] ?? grade.label}`
}

function formatMetricScoreStatusLabel(status: string | null | undefined, weightPercent: number) {
  switch (status) {
    case 'scored':
      return `${weightPercent}%`
    case 'pending_normalization':
      return 'Bekliyor'
    case 'missing_reference':
      return 'Referans eksik'
    default:
      return 'Eksik'
  }
}

function formatMetricScoreStatusText(status: string | null | undefined) {
  switch (status) {
    case 'scored':
      return 'Skorlandı'
    case 'pending_normalization':
      return 'Normalizasyon bekliyor'
    case 'missing_reference':
      return 'Referans eksik'
    default:
      return 'Eksik'
  }
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
  const availableLivePeriods = useMemo(
    () => (performance?.availablePeriods ?? []).filter((period) => period.periodType === 'monthly'),
    [performance?.availablePeriods],
  )

  if (!enabled) {
    return (
      <ScreenState
        title="Performans yüzeyi kullanılamıyor"
        copy="Bu yüzey mağaza personeli veya mağaza müdürü oturumu gerektirir."
        tone="error"
      />
    )
  }

  if (performanceQuery.isLoading || configQuery.isLoading || (sourceMode === 'closed' && closedRunsQuery.isLoading)) {
    return (
      <ScreenState
        title="Benim performansım hazırlanıyor"
        copy="Personel performans profili yükleniyor."
      />
    )
  }

  if (performanceQuery.isError || configQuery.isError || (sourceMode === 'closed' && closedRunsQuery.isError)) {
    return (
      <ScreenState
        title="Performans yüzeyi açılamadı"
        copy={getErrorMessage(performanceQuery.error ?? configQuery.error ?? closedRunsQuery.error)}
        tone="error"
      />
    )
  }

  if (!performance?.employee) {
    return (
      <ScreenState
        title="Performans yüzeyi açılamadı"
        copy="Bu kullanıcı için bireysel performans kaydı bulunamadı."
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
  const periodLabel = formatPeriodLabel({
    period: performance.period,
    snapshotDate: performance.source.snapshotDate,
  })

  return (
    <section className="page-stack">
      <section className="hero-panel store-hero-panel">
        <div>
          <div className="eyebrow">Benim Performansım</div>
          <h2 className="hero-title">Benim performansım</h2>
          <p className="hero-copy">
            Kendi KPI skorunu, sıralamanı ve dönem durumunu tek yerden takip et.
          </p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label="Dönem" value={periodLabel} />
          <MetricAccent label="Mağaza" value={performance.employee.storeName ?? 'Mağaza yok'} />
          <MetricAccent label="Veri" value={partial.isPartial ? 'Eksik veri' : 'Tam'} />
          <MetricAccent label="Skor" value={`${performanceGrade.emoji} ${performanceGrade.code}`} />
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">Performans özeti</div>
            <h3>Dönem performansı</h3>
          </div>
          <StatusPill tone={partial.isPartial ? 'warning' : 'calm'}>
            {partial.isPartial ? 'Eksik veri' : 'Tam veri'}
          </StatusPill>
        </div>
        <div className="toolbar-cluster">
          <button
            className="control-button"
            type="button"
            onClick={() => setSourceMode('live')}
            disabled={sourceMode === 'live'}
          >
            Canlı durum
          </button>
          <button
            className="control-button"
            type="button"
            onClick={() => setSourceMode('closed')}
            disabled={sourceMode === 'closed'}
          >
            Kapanmış gün
          </button>
          {sourceMode === 'live' && availableLivePeriods.length > 0 ? (
            <label className="control-field">
              <span>Dönem</span>
              <select
                value={selectedLivePeriodStart}
                onChange={(event) => setSelectedLivePeriodStart(event.target.value)}
              >
                <option value="">En güncel dönem</option>
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
              <span>Kapanmış performans kaydı seçimi</span>
              <select
                value={
                  selectedClosedSnapshotRunId ||
                  activeClosedSnapshotRun?.snapshotRunId ||
                  ''
                }
                onChange={(event) => setSelectedClosedSnapshotRunId(event.target.value)}
              >
                <option value="">Son kapanmış kayıt</option>
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
            label="Görünüm"
            value={formatSourceMode(performance.source.mode)}
          />
          <KeyValue label="Dönem" value={periodLabel} />
          <KeyValue label="Veri durumu" value={partial.isPartial ? 'Eksik veri var' : 'Tam veri'} />
          <KeyValue
            label="Hedef girişi"
            value={
              supporting.targetEntryMode === 'manager_assignment'
                ? 'Mağaza müdürü girer, bölge müdürü onaylar'
                : 'Bilinmiyor'
            }
          />
        </div>
      </section>

      {partial.isPartial ? (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">Veri Durumu</div>
              <h3>Bu skor şu an kısmi veriyle hesaplanıyor</h3>
            </div>
            <StatusPill tone="warning">Eksik veri</StatusPill>
          </div>
          <p className="queue-subtitle">
            Eksik metrikler: {partial.missingMetricLabels.join(', ') || 'Henüz metrik detayı yok'}
          </p>
          {partial.missingMetricCodes.includes('TARGET_ACHIEVEMENT') ? (
            <p className="queue-subtitle">
              Personel hedefi şu an eksik. Bu alan personel tarafından değiştirilmez; mağaza müdürü girer ve
              bölge müdürü onayına gider.
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
          title="Net satış"
          value={
            supporting.netSalesValue !== null
              ? Number(supporting.netSalesValue.toFixed(0))
              : 0
          }
          note={
            supporting.netSalesValue !== null
              ? `Power BI importundan gelen mevcut satış toplamı: ${formatCurrency(supporting.netSalesValue)}`
              : 'Power BI importundan gelen satış verisi yok.'
          }
          icon={<Target size={18} />}
          tone="accent"
        />
        <MetricCard
          title="Performans skoru"
          value={Number(performance.score.value.toFixed(1))}
          note={`${formatStorePerformanceGrade(performanceGrade)} - ${performance.score.matchedMetrics}/${performance.score.totalMetrics} metrik eslesti.`}
          icon={<Target size={18} />}
          tone={performanceGrade.tone}
        />
        <MetricCard
          title="Türkiye sıram"
          value={performance.rankings.turkeyRank ?? 0}
          note={
            performance.rankings.turkeyRank
              ? `Toplam ${performance.rankings.turkeyPopulation} personel içinde.`
              : 'Henüz sıralama verisi yok.'
          }
          icon={<Trophy size={18} />}
          tone="neutral"
        />
        <MetricCard
          title="Mağaza içi sıram"
          value={performance.rankings.storeRank ?? 0}
          note={
            performance.rankings.storeRank
              ? `Toplam ${performance.rankings.storePopulation} mağaza personeli içinde.`
              : 'Henüz mağaza içi sıralama verisi yok.'
          }
          icon={<Medal size={18} />}
          tone="neutral"
        />
        <MetricCard
          title="Mağazam"
          value={1}
          note={
            performance.employee.storeName
              ? `Aktif mağaza: ${performance.employee.storeName}`
              : 'Bireysel performans bu aktif mağaza kapsamı ile okunur.'
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
          <KeyValue label="Skor seviyesi" value={formatStorePerformanceGrade(performanceGrade)} />
          <KeyValue label="Skor" value={performance.score.value.toFixed(1)} />
          <KeyValue
            label="Kaynak"
            value={performance.source.mode === 'closed' ? 'Kapanmış kayıt' : 'Canlı dönem'}
          />
        </div>
        <p className="queue-subtitle">{scoreMeaning.confidence}</p>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">KPI detaylari</div>
            <h3>{performance.employee.displayName}</h3>
          </div>
          <StatusPill tone={performanceGrade.tone}>
            {`${formatStorePerformanceGrade(performanceGrade)} - ${performance.score.value.toFixed(1)}`}
          </StatusPill>
        </div>
        <p className="queue-subtitle">
          Bireysel KPI değerleri, skor katkısı ve sıralama sonucu burada görünür.
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
                    {formatMetricScoreStatusLabel(metric.scoreStatus, metric.weightPercent)}
                  </StatusPill>
                </div>
                <div className="key-grid">
                  <KeyValue
                    label="Gerçekleşen"
                    value={formatMetricValue(metric.actualValue, metric.code)}
                  />
                  <KeyValue label="Başarı" value={formatAchievementValue(metric)} />
                  <KeyValue
                    label="Skor hedefi"
                    value={formatMetricValue(scoreReference.value, metric.code)}
                  />
                  <KeyValue label="Hedef kaynağı" value={scoreReference.sourceLabel} />
                  <KeyValue label="Skor katkısı" value={`${metric.contributionValue.toFixed(2)}%`} />
                  <KeyValue
                    label="Durum"
                    value={formatMetricScoreStatusText(metric.scoreStatus ?? metric.status)}
                  />
                  <KeyValue label="Kaynak tipi" value={formatKpiSourceLabel(sourceSemantics)} />
                  <KeyValue label="Veri kaynağı" value={formatKpiSourceSummary(sourceSemantics)} />
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
