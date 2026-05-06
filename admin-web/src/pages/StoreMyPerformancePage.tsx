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
import type { TranslateFunction, TranslationKey } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import { getKpiConfig, getMyPerformance, getReportingSnapshotRuns } from '../features/reports/api'
import { formatSnapshotOptionLabel } from '../features/reports/snapshot-labels'
import {
  formatBenchmarkRatio,
  type PerformanceGradeCode,
  resolvePerformanceGrade,
} from '../features/kpi/grading'
import {
  resolveKpiSourceSemantics,
  type KpiSourceKind,
} from '../features/kpi/source-semantics'
import { formatDate, formatNumber as formatIntlNumber, getErrorMessage } from '../lib/format'
import { getIntlLocale, type AppLocale } from '../lib/i18n'

function canUseSelfPerformance(authSummary: AuthSessionSummary | null) {
  const roles = authSummary?.user.roleCodes ?? []
  return roles.includes('STORE_PERSONNEL') || roles.includes('STORE_MANAGER')
}

const metricLabelKeyByCode: Record<string, TranslationKey> = {
  TARGET_ACHIEVEMENT: 'competition.kpi.targetAchievement',
  ATV: 'storeMe.metric.atv',
  UPT: 'storeMe.metric.upt',
  CR: 'storeRankings.metric.cr',
}

function formatMetric(locale: AppLocale, input: number) {
  return formatIntlNumber(input, locale, {
    minimumFractionDigits: Number.isInteger(input) ? 0 : 2,
    maximumFractionDigits: 2,
  })
}

function formatPercent(locale: AppLocale, input: number) {
  return `${formatMetric(locale, input * 100)}%`
}

function formatMetricValue(
  locale: AppLocale,
  t: TranslateFunction,
  input: number | null,
  code: string,
) {
  if (input === null) {
    return t('storeMe.noData')
  }

  if (code === 'TARGET_ACHIEVEMENT') {
    return formatPercent(locale, input)
  }

  return formatMetric(locale, input)
}

function formatCurrency(locale: AppLocale, t: TranslateFunction, input: number | null) {
  if (input === null) {
    return t('storeMe.noData')
  }

  return new Intl.NumberFormat(getIntlLocale(locale), {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(input)
}

function formatAchievementValue(
  locale: AppLocale,
  t: TranslateFunction,
  metric: {
    targetValue?: number | null
    achievementRate?: number | null
    actualValue: number | null
    scoreStatus?: string
  },
) {
  if (metric.scoreStatus === 'missing_reference') {
    return t('storeMe.missingReference')
  }

  if (metric.achievementRate === null || metric.achievementRate === undefined) {
    return metric.actualValue !== null
      ? t('storeMe.pendingNormalizationStatus')
      : t('storeMe.noData')
  }

  if (metric.targetValue !== null && metric.targetValue !== undefined) {
    return formatPercent(locale, metric.achievementRate)
  }

  return t('storeMe.scorePoints', { value: formatMetric(locale, metric.achievementRate) })
}

function formatSourceMode(t: TranslateFunction, mode: string) {
  return mode === 'closed' ? t('storeMe.closedDay') : t('storeMe.livePeriod')
}

function formatPeriodLabel(
  locale: AppLocale,
  t: TranslateFunction,
  input: {
    period?: { periodStart: string; periodEnd: string } | null
    snapshotDate?: string | null
  },
) {
  if (input.period) {
    return `${formatDate(input.period.periodStart, locale)} - ${formatDate(
      input.period.periodEnd,
      locale,
    )}`
  }

  if (input.snapshotDate) {
    return formatDate(input.snapshotDate, locale)
  }

  return t('storeMe.currentPeriod')
}

function getKpiSourceKey(kind: string, suffix: 'label' | 'summary'): TranslationKey {
  const supportedKinds: KpiSourceKind[] = [
    'imported',
    'derived',
    'checklist_fed',
    'pending_normalization',
    'missing_reference',
    'missing',
  ]
  const normalizedKind = supportedKinds.includes(kind as KpiSourceKind) ? kind : 'imported'
  return `storeMe.source.${normalizedKind}.${suffix}` as TranslationKey
}

function formatKpiSourceLabel(t: TranslateFunction, input: { kind: string; label: string }) {
  return t(getKpiSourceKey(input.kind, 'label'))
}

function formatKpiSourceSummary(t: TranslateFunction, input: { kind: string; summary: string }) {
  return t(getKpiSourceKey(input.kind, 'summary'))
}

function formatStorePerformanceGrade(
  t: TranslateFunction,
  grade: ReturnType<typeof resolvePerformanceGrade>,
) {
  const labelKey = `storeMe.grade.${grade.code}` as TranslationKey

  return `${grade.emoji} ${grade.code} - ${t(labelKey)}`
}

function resolveLocalizedScoreMeaning(input: {
  t: TranslateFunction
  gradeCode: PerformanceGradeCode
  matchedMetrics: number
  totalMetrics: number
  isPartial: boolean
  tone: ReturnType<typeof resolvePerformanceGrade>['tone']
}) {
  const baseKey = `storeMe.meaning.${input.gradeCode}` as const

  return {
    title: input.t(`${baseKey}.title` as TranslationKey),
    summary: input.t(`${baseKey}.summary` as TranslationKey),
    focus: input.t(`${baseKey}.focus` as TranslationKey),
    confidence: input.t(
      input.isPartial ? 'storeMe.confidence.partial' : 'storeMe.confidence.full',
      {
        matched: input.matchedMetrics,
        total: input.totalMetrics,
      },
    ),
    tone: input.isPartial ? 'warning' : input.gradeCode === 'C' ? 'warning' : input.tone,
  }
}

function formatMetricScoreStatusLabel(
  t: TranslateFunction,
  status: string | null | undefined,
  weightPercent: number,
) {
  switch (status) {
    case 'scored':
      return `${weightPercent}%`
    case 'pending_normalization':
      return t('storeMe.waiting')
    case 'missing_reference':
      return t('storeMe.missingReference')
    default:
      return t('storeMe.missing')
  }
}

function formatMetricScoreStatusText(t: TranslateFunction, status: string | null | undefined) {
  switch (status) {
    case 'scored':
      return t('storeMe.scored')
    case 'pending_normalization':
      return t('storeMe.pendingNormalizationStatus')
    case 'missing_reference':
      return t('storeMe.missingReference')
    default:
      return t('storeMe.missing')
  }
}

function getScoreReference(input: {
  t: TranslateFunction
  targetValue?: number | null
  benchmarkValue?: number | null
  benchmarkSource?: string | null
}) {
  if (input.targetValue !== null && input.targetValue !== undefined) {
    return {
      value: input.targetValue,
      sourceLabel: input.t('storeMe.reference.target'),
    }
  }

  if (input.benchmarkValue !== null && input.benchmarkValue !== undefined) {
    if (input.benchmarkSource === 'TURKEY_AVERAGE') {
      return {
        value: input.benchmarkValue,
        sourceLabel: input.t('storeMe.reference.turkeyAverage'),
      }
    }

    if (input.benchmarkSource === 'CHECKLIST_SCORE') {
      return {
        value: input.benchmarkValue,
        sourceLabel: input.t('storeMe.reference.checklistScore'),
      }
    }

    return {
      value: input.benchmarkValue,
      sourceLabel: input.t('storeMe.reference.default'),
    }
  }

  return {
    value: null,
    sourceLabel: input.t('storeMe.reference.pending'),
  }
}

function getMetricLabel(t: TranslateFunction, metric: { code: string; label: string }) {
  const key = metricLabelKeyByCode[metric.code]
  return key ? t(key) : metric.label
}

function describeLocalizedBenchmarkCap(
  t: TranslateFunction,
  input: {
    actualRatio?: number | null
    scoredRatio?: number | null
    isCapped?: boolean
  },
) {
  if (!input.isCapped || !input.actualRatio || !input.scoredRatio) {
    return null
  }

  return t('storeMe.benchmarkCap', {
    actual: formatBenchmarkRatio(input.actualRatio, 'prefix').replace('%', ''),
    scored: formatBenchmarkRatio(input.scoredRatio).replace('%', ''),
  })
}

export function StoreMyPerformancePage(input: {
  authSummary: AuthSessionSummary | null
}) {
  const { locale, t } = useLocalization()
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
        title={t('storeMe.unavailableTitle')}
        copy={t('storeMe.unavailableCopy')}
        tone="error"
      />
    )
  }

  if (performanceQuery.isLoading || configQuery.isLoading || (sourceMode === 'closed' && closedRunsQuery.isLoading)) {
    return (
      <ScreenState
        title={t('storeMe.loadingTitle')}
        copy={t('storeMe.loadingCopy')}
      />
    )
  }

  if (performanceQuery.isError || configQuery.isError || (sourceMode === 'closed' && closedRunsQuery.isError)) {
    return (
      <ScreenState
        title={t('storeMe.errorTitle')}
        copy={getErrorMessage(performanceQuery.error ?? configQuery.error ?? closedRunsQuery.error)}
        tone="error"
      />
    )
  }

  if (!performance?.employee) {
    return (
      <ScreenState
        title={t('storeMe.errorTitle')}
        copy={t('storeMe.noEmployeeCopy')}
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
  const scoreMeaning = resolveLocalizedScoreMeaning({
    t,
    gradeCode: performanceGrade.code,
    matchedMetrics: performance.score.matchedMetrics,
    totalMetrics: performance.score.totalMetrics,
    isPartial: partial.isPartial,
    tone: performanceGrade.tone,
  })
  const periodLabel = formatPeriodLabel(locale, t, {
    period: performance.period,
    snapshotDate: performance.source.snapshotDate,
  })

  return (
    <section className="page-stack">
      <section className="hero-panel store-hero-panel">
        <div>
          <div className="eyebrow">{t('storeMe.heroEyebrow')}</div>
          <h2 className="hero-title">{t('storeMe.title')}</h2>
          <p className="hero-copy">{t('storeMe.heroCopy')}</p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label={t('storeMe.period')} value={periodLabel} />
          <MetricAccent
            label={t('storeMe.store')}
            value={performance.employee.storeName ?? t('storeMe.noStore')}
          />
          <MetricAccent
            label={t('storeMe.data')}
            value={partial.isPartial ? t('storeMe.incompleteData') : t('storeMe.complete')}
          />
          <MetricAccent
            label={t('storeMe.score')}
            value={`${performanceGrade.emoji} ${performanceGrade.code}`}
          />
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">{t('storeMe.performanceSummary')}</div>
            <h3>{t('storeMe.periodPerformance')}</h3>
          </div>
          <StatusPill tone={partial.isPartial ? 'warning' : 'calm'}>
            {partial.isPartial ? t('storeMe.incompleteData') : t('storeMe.completeData')}
          </StatusPill>
        </div>
        <div className="toolbar-cluster">
          <button
            className="control-button"
            type="button"
            onClick={() => setSourceMode('live')}
            disabled={sourceMode === 'live'}
          >
            {t('storeMe.liveStatus')}
          </button>
          <button
            className="control-button"
            type="button"
            onClick={() => setSourceMode('closed')}
            disabled={sourceMode === 'closed'}
          >
            {t('storeMe.closedDay')}
          </button>
          {sourceMode === 'live' && availableLivePeriods.length > 0 ? (
            <label className="control-field">
              <span>{t('storeMe.period')}</span>
              <select
                value={selectedLivePeriodStart}
                onChange={(event) => setSelectedLivePeriodStart(event.target.value)}
              >
                <option value="">{t('storeMe.latestPeriod')}</option>
                {availableLivePeriods.map((period) => (
                  <option key={`${period.periodType}-${period.periodStart}`} value={period.periodStart}>
                    {`${formatDate(period.periodStart, locale)} - ${formatDate(
                      period.periodEnd,
                      locale,
                    )}`}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {sourceMode === 'closed' && availableClosedSnapshotRuns.length > 0 ? (
            <label className="control-field">
              <span>{t('storeMe.closedSnapshotSelect')}</span>
              <select
                value={
                  selectedClosedSnapshotRunId ||
                  activeClosedSnapshotRun?.snapshotRunId ||
                  ''
                }
                onChange={(event) => setSelectedClosedSnapshotRunId(event.target.value)}
              >
                <option value="">{t('storeMe.latestClosedSnapshot')}</option>
                {availableClosedSnapshotRuns.map((run) => (
                  <option key={run.snapshotRunId} value={run.snapshotRunId}>
                    {formatSnapshotOptionLabel(run, locale)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        <div className="key-grid">
          <KeyValue
            label={t('storeMe.view')}
            value={formatSourceMode(t, performance.source.mode)}
          />
          <KeyValue label={t('storeMe.period')} value={periodLabel} />
          <KeyValue
            label={t('storeMe.dataStatus')}
            value={partial.isPartial ? t('storeMe.missingDataExists') : t('storeMe.completeData')}
          />
          <KeyValue
            label={t('storeMe.targetEntry')}
            value={
              supporting.targetEntryMode === 'manager_assignment'
                ? t('storeMe.targetEntryManager')
                : t('storeMe.unknown')
            }
          />
        </div>
      </section>

      {partial.isPartial ? (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t('storeMe.partialEyebrow')}</div>
              <h3>{t('storeMe.partialTitle')}</h3>
            </div>
            <StatusPill tone="warning">{t('storeMe.incompleteData')}</StatusPill>
          </div>
          <p className="queue-subtitle">
            {t('storeMe.missingMetrics', {
              labels: partial.missingMetricLabels.join(', ') || t('storeMe.noMetricDetail'),
            })}
          </p>
          {partial.missingMetricCodes.includes('TARGET_ACHIEVEMENT') ? (
            <p className="queue-subtitle">{t('storeMe.targetMissingCopy')}</p>
          ) : null}
          {partial.pendingNormalizationLabels?.length ? (
            <p className="queue-subtitle">
              {t('storeMe.pendingNormalization', {
                labels: partial.pendingNormalizationLabels.join(', '),
              })}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="metric-grid store-metric-grid">
        <MetricCard
          title={t('storeMe.netSales')}
          value={
            supporting.netSalesValue !== null
              ? Number(supporting.netSalesValue.toFixed(0))
              : 0
          }
          note={
            supporting.netSalesValue !== null
              ? t('storeMe.netSalesNote', {
                  value: formatCurrency(locale, t, supporting.netSalesValue),
                })
              : t('storeMe.noNetSales')
          }
          icon={<Target size={18} />}
          tone="accent"
        />
        <MetricCard
          title={t('storeMe.performanceScore')}
          value={Number(performance.score.value.toFixed(1))}
          note={`${formatStorePerformanceGrade(t, performanceGrade)} - ${t('storeMe.matchedMetrics', {
            matched: performance.score.matchedMetrics,
            total: performance.score.totalMetrics,
          })}`}
          icon={<Target size={18} />}
          tone={performanceGrade.tone}
        />
        <MetricCard
          title={t('storeMe.turkeyRank')}
          value={performance.rankings.turkeyRank ?? 0}
          note={
            performance.rankings.turkeyRank
              ? t('storeMe.turkeyRankNote', { count: performance.rankings.turkeyPopulation })
              : t('storeMe.noTurkeyRank')
          }
          icon={<Trophy size={18} />}
          tone="neutral"
        />
        <MetricCard
          title={t('storeMe.storeRank')}
          value={performance.rankings.storeRank ?? 0}
          note={
            performance.rankings.storeRank
              ? t('storeMe.storeRankNote', { count: performance.rankings.storePopulation })
              : t('storeMe.noStoreRank')
          }
          icon={<Medal size={18} />}
          tone="neutral"
        />
        <MetricCard
          title={t('storeMe.myStore')}
          value={1}
          note={
            performance.employee.storeName
              ? t('storeMe.activeStore', { storeName: performance.employee.storeName })
              : t('storeMe.activeStoreScope')
          }
          icon={<UserRound size={18} />}
          tone="calm"
        />
      </section>

      <section className="panel" aria-label="Score meaning">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">{t('storeMe.scoreMeaning')}</div>
            <h3>{scoreMeaning.title}</h3>
          </div>
          <StatusPill tone={scoreMeaning.tone}>{performanceGrade.code}</StatusPill>
        </div>
        <p className="queue-subtitle">{scoreMeaning.summary}</p>
        <div className="key-grid">
          <KeyValue label={t('storeMe.focus')} value={scoreMeaning.focus} />
          <KeyValue
            label={t('storeMe.scoreLevel')}
            value={formatStorePerformanceGrade(t, performanceGrade)}
          />
          <KeyValue label={t('storeMe.score')} value={performance.score.value.toFixed(1)} />
          <KeyValue
            label={t('storeMe.source')}
            value={
              performance.source.mode === 'closed'
                ? t('storeMe.closedRecord')
                : t('storeMe.livePeriod')
            }
          />
        </div>
        <p className="queue-subtitle">{scoreMeaning.confidence}</p>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">{t('storeMe.kpiDetails')}</div>
            <h3>{performance.employee.displayName}</h3>
          </div>
          <StatusPill tone={performanceGrade.tone}>
            {`${formatStorePerformanceGrade(t, performanceGrade)} - ${performance.score.value.toFixed(1)}`}
          </StatusPill>
        </div>
        <p className="queue-subtitle">{t('storeMe.kpiDetailsCopy')}</p>
        <div className="stacked-table">
          {performance.metrics.map((metric) => {
            const sourceSemantics = resolveKpiSourceSemantics(metric)
            const scoreReference = getScoreReference({
              t,
              targetValue: metric.targetValue ?? null,
              benchmarkValue: metric.benchmarkValue ?? null,
              benchmarkSource: metric.benchmarkSource ?? null,
            })

            return (
              <article className="stacked-row" key={metric.code}>
                <div className="stacked-row-head">
                  <div>
                    <strong>{getMetricLabel(t, metric)}</strong>
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
                    {formatMetricScoreStatusLabel(t, metric.scoreStatus, metric.weightPercent)}
                  </StatusPill>
                </div>
                <div className="key-grid">
                  <KeyValue
                    label={t('storeMe.actual')}
                    value={formatMetricValue(locale, t, metric.actualValue, metric.code)}
                  />
                  <KeyValue
                    label={t('storeMe.achievement')}
                    value={formatAchievementValue(locale, t, metric)}
                  />
                  <KeyValue
                    label={t('storeMe.scoreTarget')}
                    value={formatMetricValue(locale, t, scoreReference.value, metric.code)}
                  />
                  <KeyValue label={t('storeMe.targetSource')} value={scoreReference.sourceLabel} />
                  <KeyValue
                    label={t('storeMe.scoreContribution')}
                    value={`${metric.contributionValue.toFixed(2)}%`}
                  />
                  <KeyValue
                    label={t('storeMe.status')}
                    value={formatMetricScoreStatusText(t, metric.scoreStatus ?? metric.status)}
                  />
                  <KeyValue
                    label={t('storeMe.sourceType')}
                    value={formatKpiSourceLabel(t, sourceSemantics)}
                  />
                  <KeyValue
                    label={t('storeMe.dataSource')}
                    value={formatKpiSourceSummary(t, sourceSemantics)}
                  />
                </div>
                {metric.isCapped ? (
                  <p className="queue-subtitle">
                    {describeLocalizedBenchmarkCap(t, {
                      actualRatio: metric.actualRatio,
                      scoredRatio: metric.scoredRatio,
                      isCapped: metric.isCapped,
                    })}
                  </p>
                ) : null}
                {metric.scoreStatus === 'missing_reference' ? (
                  <p className="queue-subtitle">
                    {t('storeMe.missingReferenceReason', {
                      reason: metric.missingReason ?? 'reference_missing',
                    })}
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
