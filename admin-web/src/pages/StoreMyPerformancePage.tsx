import { useQueries, useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { CalendarDays, ChevronDown, Medal, Target, Trophy, UserRound, X } from 'lucide-react'
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
import {
  getKpiConfig,
  getMyPerformance,
  getReportingSnapshotRuns,
  type MyPerformanceMetric,
  type MyPerformanceSummary,
} from '../features/reports/api'
import { formatSnapshotOptionLabel } from '../features/reports/snapshot-labels'
import {
  describeLocalizedBenchmarkCap,
  formatKpiAchievementValue,
  formatKpiMetricValue,
  formatLocalizedPerformanceGrade,
  localizeKpiSourceSemantics,
  resolveLocalizedKpiScoreReference,
} from '../features/kpi/display'
import {
  type PerformanceGradeCode,
  resolvePerformanceGrade,
} from '../features/kpi/grading'
import { formatDate, getErrorMessage } from '../lib/format'
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

const personnelMetricCodes = ['TARGET_ACHIEVEMENT', 'ATV', 'UPT']

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

function getMetricLabel(t: TranslateFunction, metric: { code: string; label: string }) {
  const key = metricLabelKeyByCode[metric.code]
  return key ? t(key) : metric.label
}

function isPersonnelMetric(metric: { code: string }) {
  return personnelMetricCodes.includes(metric.code)
}

function findMetric(metrics: MyPerformanceMetric[], code: string) {
  return metrics.find((metric) => metric.code === code) ?? null
}

function getMetricDisplayValue(
  locale: AppLocale,
  t: TranslateFunction,
  metrics: MyPerformanceMetric[],
  code: string,
) {
  return formatKpiMetricValue(locale, t, findMetric(metrics, code)?.actualValue ?? null, {
    noDataKey: 'storeMe.noData',
    code,
    percentMetricCodes: ['TARGET_ACHIEVEMENT'],
  })
}

function getMetricNumericValue(metrics: MyPerformanceMetric[], code: string) {
  const value = findMetric(metrics, code)?.actualValue
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function getTargetProgressPercent(metrics: MyPerformanceMetric[]) {
  const targetMetric = findMetric(metrics, 'TARGET_ACHIEVEMENT')
  const source = targetMetric?.achievementRate ?? targetMetric?.actualValue ?? null

  if (typeof source !== 'number' || !Number.isFinite(source)) {
    return 0
  }

  return Math.max(0, Math.min(100, Math.round(source * 100)))
}

function getPeriodDateKey(input: string | null | undefined) {
  const match = input?.trim().match(/^(\d{4}-\d{2}-\d{2})/)
  return match?.[1] ?? ''
}

function getPeriodYear(input: string | null | undefined) {
  return getPeriodDateKey(input).slice(0, 4)
}

function comparePeriodStart(left: string, right: string) {
  const leftKey = getPeriodDateKey(left) || left
  const rightKey = getPeriodDateKey(right) || right
  return leftKey.localeCompare(rightKey)
}

function isSamePeriodStart(left: string | null | undefined, right: string | null | undefined) {
  const leftKey = getPeriodDateKey(left)
  const rightKey = getPeriodDateKey(right)
  return leftKey !== '' && leftKey === rightKey
}

function formatMonthYear(locale: AppLocale, t: TranslateFunction, input: string) {
  const dateKey = getPeriodDateKey(input)

  if (!dateKey) {
    return t('storeMe.currentPeriod')
  }

  return new Intl.DateTimeFormat(getIntlLocale(locale), {
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${dateKey}T00:00:00`))
}

function formatSignedPercent(locale: AppLocale, input: number | null) {
  if (input === null || !Number.isFinite(input)) {
    return null
  }

  const formatted = new Intl.NumberFormat(getIntlLocale(locale), {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
    signDisplay: 'always',
  }).format(input)

  return `${formatted}%`
}

function getDeltaPercent(current: number | null, previous: number | null) {
  if (current === null || previous === null || previous === 0) {
    return null
  }

  return ((current - previous) / Math.abs(previous)) * 100
}

function getTrendWidth(score: number) {
  return `${Math.max(8, Math.min(100, Math.round(score)))}%`
}

function getPeriodStart(input: MyPerformanceSummary | null | undefined) {
  return input?.period?.periodStart ?? input?.source.snapshotDate ?? ''
}

export function StoreMyPerformancePage(input: {
  authSummary: AuthSessionSummary | null
}) {
  const { locale, t } = useLocalization()
  const enabled = canUseSelfPerformance(input.authSummary)
  const [sourceMode, setSourceMode] = useState<'live' | 'closed'>('live')
  const [selectedLivePeriodStart, setSelectedLivePeriodStart] = useState('')
  const [selectedClosedSnapshotRunId, setSelectedClosedSnapshotRunId] = useState('')
  const [isDateFilterOpen, setIsDateFilterOpen] = useState(false)
  const [isKpiDetailOpen, setIsKpiDetailOpen] = useState(false)

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
  const monthlyDetailPeriods = useMemo(() => {
    const activeYear = getPeriodYear(performance?.period?.periodStart ?? availableLivePeriods.at(-1)?.periodStart)
    const scopedPeriods = activeYear
      ? availableLivePeriods.filter((period) => getPeriodYear(period.periodStart) === activeYear)
      : availableLivePeriods

    return [...scopedPeriods]
      .sort((left, right) => comparePeriodStart(left.periodStart, right.periodStart))
      .slice(-12)
  }, [availableLivePeriods, performance?.period?.periodStart])

  const monthlyPerformanceQueries = useQueries({
    queries: monthlyDetailPeriods.map((period) => ({
      queryKey: ['my-performance', 'live', getPeriodDateKey(period.periodStart) || period.periodStart, ''],
      queryFn: () =>
        getMyPerformance({
          mode: 'live',
          periodType: 'monthly',
          periodStart: getPeriodDateKey(period.periodStart) || period.periodStart,
        }),
      enabled: enabled && sourceMode === 'live' && performanceQuery.isSuccess,
      retry: false,
    })),
  })

  useEffect(() => {
    if (!isKpiDetailOpen) {
      return undefined
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsKpiDetailOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isKpiDetailOpen])

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
  const personnelMetrics = performance.metrics.filter(isPersonnelMetric)
  const targetProgressPercent = getTargetProgressPercent(personnelMetrics)
  const monthlyPeriodsForRows = monthlyDetailPeriods.length
    ? monthlyDetailPeriods
    : performance.period
      ? [{
          periodType: 'monthly' as const,
          periodStart: performance.period.periodStart,
          periodEnd: performance.period.periodEnd,
        }]
      : []
  const monthlyPerformanceData = monthlyPeriodsForRows.map((period, index) => {
    const queriedData = monthlyPerformanceQueries[index]?.data

    return queriedData ?? (isSamePeriodStart(period.periodStart, getPeriodStart(performance)) ? performance : null)
  })
  const monthlyDetailRows = monthlyPeriodsForRows.map((period, index) => {
    const monthPerformance = monthlyPerformanceData[index]
    const previousPerformance = index > 0 ? monthlyPerformanceData[index - 1] : null
    const metrics = monthPerformance?.metrics.filter(isPersonnelMetric) ?? []
    const scoreValue = monthPerformance?.score.value ?? null

    return {
      key: getPeriodDateKey(period.periodStart) || period.periodStart,
      label: formatMonthYear(locale, t, period.periodStart),
      periodNote:
        isSamePeriodStart(period.periodStart, getPeriodStart(performance))
          ? t('storeMe.activePeriod')
          : formatPeriodLabel(locale, t, { period }),
      scoreValue,
      scoreLabel: scoreValue === null ? t('storeMe.noData') : scoreValue.toFixed(1),
      uptLabel: getMetricDisplayValue(locale, t, metrics, 'UPT'),
      atvLabel: getMetricDisplayValue(locale, t, metrics, 'ATV'),
      targetLabel: getMetricDisplayValue(locale, t, metrics, 'TARGET_ACHIEVEMENT'),
      trendLabel: formatSignedPercent(
        locale,
        getDeltaPercent(scoreValue, previousPerformance?.score.value ?? null),
      ),
      trendWidth: getTrendWidth(scoreValue ?? 0),
    }
  })
  const activeMonthlyRow =
    monthlyDetailRows.find((row) => isSamePeriodStart(row.key, getPeriodStart(performance))) ??
    monthlyDetailRows.at(-1) ??
    null
  const previousMonthlyRow = activeMonthlyRow
    ? monthlyDetailRows[monthlyDetailRows.findIndex((row) => row.key === activeMonthlyRow.key) - 1] ?? null
    : null
  const samePeriodScoreDelta = formatSignedPercent(
    locale,
    getDeltaPercent(activeMonthlyRow?.scoreValue ?? null, previousMonthlyRow?.scoreValue ?? null),
  )
  const samePeriodMetrics = [
    {
      code: 'UPT',
      label: t('storeMe.metric.uptShort'),
      delta: formatSignedPercent(
        locale,
        getDeltaPercent(
          getMetricNumericValue(personnelMetrics, 'UPT'),
          previousMonthlyRow ? getMetricNumericValue(monthlyPerformanceData[monthlyDetailRows.indexOf(previousMonthlyRow)]?.metrics ?? [], 'UPT') : null,
        ),
      ),
      width: '72%',
    },
    {
      code: 'ATV',
      label: t('storeMe.metric.atvShort'),
      delta: formatSignedPercent(
        locale,
        getDeltaPercent(
          getMetricNumericValue(personnelMetrics, 'ATV'),
          previousMonthlyRow ? getMetricNumericValue(monthlyPerformanceData[monthlyDetailRows.indexOf(previousMonthlyRow)]?.metrics ?? [], 'ATV') : null,
        ),
      ),
      width: '68%',
    },
    {
      code: 'TARGET_ACHIEVEMENT',
      label: t('storeMe.metric.hgShort'),
      delta: formatSignedPercent(
        locale,
        getDeltaPercent(
          getMetricNumericValue(personnelMetrics, 'TARGET_ACHIEVEMENT'),
          previousMonthlyRow
            ? getMetricNumericValue(
                monthlyPerformanceData[monthlyDetailRows.indexOf(previousMonthlyRow)]?.metrics ?? [],
                'TARGET_ACHIEVEMENT',
              )
            : null,
        ),
      ),
      width: '76%',
    },
  ]

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

      <section className="panel store-me-filter-panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">{t('storeMe.performanceSummary')}</div>
            <h3>{t('storeMe.periodPerformance')}</h3>
          </div>
          <StatusPill tone={partial.isPartial ? 'warning' : 'calm'}>
            {partial.isPartial ? t('storeMe.incompleteData') : t('storeMe.completeData')}
          </StatusPill>
        </div>
        <button
          className="store-me-filter-trigger"
          type="button"
          aria-expanded={isDateFilterOpen}
          onClick={() => setIsDateFilterOpen((current) => !current)}
        >
          <span className="store-me-filter-icon" aria-hidden="true">
            <CalendarDays size={19} />
          </span>
          <span className="store-me-filter-main">
            <span>{t('storeMe.dateFilter')}</span>
            <strong>{`${periodLabel} · ${formatSourceMode(t, performance.source.mode)}`}</strong>
          </span>
          <span className="store-me-filter-chips" aria-hidden="true">
            <span>{partial.isPartial ? t('storeMe.incompleteData') : t('storeMe.completeData')}</span>
            <span>
              {`${t('storeMe.targetEntry')}: ${
                supporting.targetEntryMode === 'manager_assignment'
                  ? t('storeMe.approvedTarget')
                  : t('storeMe.unknown')
              }`}
            </span>
          </span>
          <span className="store-me-filter-caret" aria-hidden="true">
            <ChevronDown size={18} />
          </span>
        </button>
        {isDateFilterOpen ? (
          <div className="store-me-filter-popover">
            <div className="toolbar-cluster store-me-filter-controls">
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
                      <option
                        key={`${period.periodType}-${getPeriodDateKey(period.periodStart) || period.periodStart}`}
                        value={getPeriodDateKey(period.periodStart) || period.periodStart}
                      >
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
          </div>
        ) : null}
      </section>

      <section className="store-me-performance-stage">
        <aside className="panel store-me-score-card" aria-label={t('storeMe.performanceScore')}>
          <div className="store-me-score-head">
            <div>
              <div className="eyebrow">{t('storeMe.performanceScore')}</div>
              <h3>{t('storeMe.personalScoreCard')}</h3>
            </div>
            <StatusPill tone={performanceGrade.tone}>
              {performanceGrade.code}
            </StatusPill>
          </div>
          <div
            className="store-me-score-orbit"
            style={{ '--store-me-score': `${Math.round(performance.score.value)}%` } as CSSProperties}
          >
            <div className="store-me-score-number">
              <strong>{Math.round(performance.score.value)}</strong>
              <span>/100</span>
              <small>{samePeriodScoreDelta ?? t('storeMe.noTrendData')}</small>
            </div>
          </div>
          <div className="store-me-rank-row">
            <KeyValue
              label={t('storeMe.store')}
              value={performance.rankings.storeRank ? `${performance.rankings.storeRank}.` : t('storeMe.noData')}
            />
            <KeyValue
              label={t('storeMe.turkey')}
              value={performance.rankings.turkeyRank ? `${performance.rankings.turkeyRank}.` : t('storeMe.noData')}
            />
          </div>
          <div className="store-me-coach-note">
            <span>{t('storeMe.coachingMode')}</span>
            <strong>{scoreMeaning.focus}</strong>
          </div>
        </aside>

        <section className="panel store-me-action-panel" aria-label={t('storeMe.performanceSummary')}>
          <div className="store-me-action-copy">
            <h3>{t('storeMe.performanceFocusTitle')}</h3>
            <p>{scoreMeaning.summary}</p>
          </div>
          <div className="store-me-target-card">
            <div className="store-me-target-head">
              <div>
                <span>{t('storeMe.targetProgress')}</span>
                <strong>{t('storeMe.targetProgressPercent', { value: targetProgressPercent })}</strong>
              </div>
              <em>{t('storeMe.approvedTarget')}</em>
            </div>
            <div className="store-me-target-track" aria-hidden="true">
              <i style={{ width: `${targetProgressPercent}%` }} />
            </div>
          </div>
          <article className="store-me-compare-card" aria-label={t('storeMe.samePeriodComparison')}>
            <div>
              <span>{t('storeMe.samePeriodComparison')}</span>
              <strong>
                {samePeriodScoreDelta
                  ? t('storeMe.samePeriodSummary', { value: samePeriodScoreDelta })
                  : t('storeMe.noTrendData')}
              </strong>
            </div>
            <div className="store-me-mini-bars">
              {samePeriodMetrics.map((metric) => (
                <div className="store-me-mini-bar" key={metric.code}>
                  <b>{metric.label}</b>
                  <i style={{ '--store-me-width': metric.width } as CSSProperties} />
                  <em>{metric.delta ?? t('storeMe.noData')}</em>
                </div>
              ))}
            </div>
          </article>
          <div className="hero-actions store-me-action-buttons">
            <button className="control-button" type="button" onClick={() => setIsKpiDetailOpen(true)}>
              {t('storeMe.kpiDetails')}
            </button>
          </div>
        </section>
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
          note={`${formatLocalizedPerformanceGrade(t, 'storeMe', performanceGrade)} - ${t('storeMe.matchedMetrics', {
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

      <section className="panel" aria-label={t('storeMe.scoreMeaning')}>
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
            value={formatLocalizedPerformanceGrade(t, 'storeMe', performanceGrade)}
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
            {`${formatLocalizedPerformanceGrade(t, 'storeMe', performanceGrade)} - ${performance.score.value.toFixed(1)}`}
          </StatusPill>
        </div>
        <p className="queue-subtitle">{t('storeMe.kpiDetailsCopy')}</p>
        <div className="stacked-table">
          {personnelMetrics.map((metric) => {
            const sourceSemantics = localizeKpiSourceSemantics(t, 'storeMe', metric)
            const scoreReference = resolveLocalizedKpiScoreReference(t, {
              target: 'storeMe.reference.target',
              turkeyAverage: 'storeMe.reference.turkeyAverage',
              checklistScore: 'storeMe.reference.checklistScore',
              default: 'storeMe.reference.default',
              pending: 'storeMe.reference.pending',
            }, {
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
                    value={formatKpiMetricValue(locale, t, metric.actualValue, {
                      noDataKey: 'storeMe.noData',
                      code: metric.code,
                      percentMetricCodes: ['TARGET_ACHIEVEMENT'],
                    })}
                  />
                  <KeyValue
                    label={t('storeMe.achievement')}
                    value={formatKpiAchievementValue(locale, t, metric, {
                      missingReference: 'storeMe.missingReference',
                      pendingNormalization: 'storeMe.pendingNormalizationStatus',
                      noData: 'storeMe.noData',
                      scorePoints: 'storeMe.scorePoints',
                    })}
                  />
                  <KeyValue
                    label={t('storeMe.scoreTarget')}
                    value={formatKpiMetricValue(locale, t, scoreReference.value, {
                      noDataKey: 'storeMe.noData',
                      code: metric.code,
                      percentMetricCodes: ['TARGET_ACHIEVEMENT'],
                    })}
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
                    value={sourceSemantics.label}
                  />
                  <KeyValue
                    label={t('storeMe.dataSource')}
                    value={sourceSemantics.summary}
                  />
                </div>
                {metric.isCapped ? (
                  <p className="queue-subtitle">
                    {describeLocalizedBenchmarkCap(t, 'storeMe.benchmarkCap', {
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

      {isKpiDetailOpen ? (
        <div
          className="store-me-dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsKpiDetailOpen(false)
            }
          }}
        >
          <section
            className="store-me-kpi-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="store-me-kpi-dialog-title"
          >
            <div className="store-me-kpi-dialog-head">
              <div>
                <div className="eyebrow">{t('storeMe.kpiDetails')}</div>
                <h3 id="store-me-kpi-dialog-title">
                  {t('storeMe.monthlyPerformanceTitle', {
                    name: performance.employee.displayName,
                  })}
                </h3>
                <p>{t('storeMe.monthlyPerformanceCopy')}</p>
              </div>
              <button
                className="icon-button store-me-dialog-close"
                type="button"
                aria-label={t('storeMe.closeKpiDetails')}
                onClick={() => setIsKpiDetailOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="store-me-month-table" aria-label={t('storeMe.monthlyPerformanceTable')}>
              <div className="store-me-month-row store-me-month-row-head" aria-hidden="true">
                <span>{t('storeMe.month')}</span>
                <span>{t('storeMe.score')}</span>
                <span>{t('storeMe.metric.uptShort')}</span>
                <span>{t('storeMe.metric.atvShort')}</span>
                <span>{t('storeMe.metric.hgShort')}</span>
                <span>{t('storeMe.monthlyTrend')}</span>
              </div>
              {monthlyDetailRows.map((row) => (
                <article className="store-me-month-row" key={row.key}>
                  <div>
                    <strong>{row.label}</strong>
                    <small>{row.periodNote}</small>
                  </div>
                  <b>{row.scoreLabel}</b>
                  <b>{row.uptLabel}</b>
                  <b>{row.atvLabel}</b>
                  <b>{row.targetLabel}</b>
                  <div className="store-me-month-trend">
                    <i style={{ '--store-me-width': row.trendWidth } as CSSProperties} />
                    <em>{row.trendLabel ?? t('storeMe.noTrendData')}</em>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </section>
  )
}
