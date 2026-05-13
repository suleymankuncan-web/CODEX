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
import type { TranslateFunction, TranslationKey } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import {
  getKpiConfig,
  getKpiReport,
  getReportingSnapshotRuns,
  getStoreScoreBreakdown,
  getStoreKpiHighlights,
  type KpiOwnerRole,
} from '../features/reports/api'
import { formatSnapshotOptionLabel } from '../features/reports/snapshot-labels'
import { formatDate, formatState, getErrorMessage } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import { ApiError } from '../lib/api'
import { transientQueryRetryOptions } from '../lib/query-retry'
import {
  matchesKpiMetricCode,
} from '../features/kpi/score-profiles'
import {
  type PerformanceGrade,
  type PerformanceGradeCode,
  resolvePerformanceGrade,
} from '../features/kpi/grading'
import {
  describeLocalizedBenchmarkCap as describeSharedBenchmarkCap,
  formatKpiAchievementValue,
  formatKpiMetricValue,
  formatKpiNumber as formatMetric,
  formatKpiPercent as formatPercent,
  formatLocalizedPerformanceGrade,
  localizeKpiSourceSemantics,
  resolveLocalizedKpiScoreReference as resolveSharedKpiScoreReference,
  toKpiDisplayNumber as toNumber,
} from '../features/kpi/display'

type DisplayKpiRow = {
  storeId: string
  kpiCode: string
  kpiName: string
  periodStart: string
  periodEnd: string
  targetValue: string | null
  actualValue: string | null
  achievementRate: string | null
  benchmarkValue?: string | null
  benchmarkSource?: string
  actualRatio?: number | null
  scoredRatio?: number | null
  capRatio?: number | null
  isCapped?: boolean
  scoreContribution?: number | null
  missingReason?: string | null
  statusBand: string | null
  scoreStatus: 'scored' | 'pending_normalization' | 'missing_reference' | 'missing'
}

const metricLabelKeyByCode: Record<string, TranslationKey> = {
  TARGET_ACHIEVEMENT: 'storeKpis.metric.targetAchievement',
  ATV: 'storeKpis.metric.atv',
  UPT: 'storeKpis.metric.upt',
  CR: 'storeKpis.metric.cr',
  BM_CHECKLIST: 'storeKpis.metric.bmChecklist',
  VM_CHECKLIST: 'storeKpis.metric.vmChecklist',
}

const ownerRoleLabelKeyByCode: Record<KpiOwnerRole, TranslationKey> = {
  DEPUTY_GM: 'storeKpis.role.DEPUTY_GM',
  REGION_MANAGER: 'storeKpis.role.REGION_MANAGER',
  STORE_MANAGER: 'storeKpis.role.STORE_MANAGER',
  STORE_PERSONNEL: 'storeKpis.role.STORE_PERSONNEL',
  VISUAL_TEAM: 'storeKpis.role.VISUAL_TEAM',
}

function formatCoveredWeight(input: number) {
  if (!Number.isFinite(input)) {
    return '0'
  }

  return Number.isInteger(input) ? String(input) : input.toFixed(1)
}

function formatChecklistStatus(t: TranslateFunction, input: {
  label: 'BM' | 'VM'
  included: boolean
  visitCount: number
}) {
  if (input.included) {
    return input.visitCount === 1
      ? t('storeKpis.checklist.singleDone', { label: input.label })
      : t('storeKpis.checklist.manyDone', {
          count: input.visitCount,
          label: input.label,
        })
  }

  return t('storeKpis.checklist.notIncluded', { label: input.label })
}

function formatChecklistContribution(locale: AppLocale, t: TranslateFunction, input: {
  label: 'BM' | 'VM'
  contribution: number | null
}) {
  if (input.contribution !== null && input.contribution !== undefined) {
    return t('storeKpis.checklist.contribution', {
      label: input.label,
      value: formatMetric(locale, input.contribution),
    })
  }

  return t('storeKpis.noContribution')
}

function formatChecklistMissingNote(t: TranslateFunction, input: {
  label: 'BM' | 'VM'
  included: boolean
}) {
  return input.included ? null : t('storeKpis.checklist.shareStayed', { label: input.label })
}

function formatStatusBand(t: TranslateFunction, input: string | null) {
  switch (input) {
    case 'exceeded':
      return t('storeKpis.status.exceeded')
    case 'on_track':
      return t('storeKpis.status.on_track')
    case 'at_risk':
      return t('storeKpis.status.at_risk')
    case 'off_track':
      return t('storeKpis.status.off_track')
    default:
      return t('storeKpis.status.default')
  }
}

function formatScoreProfileTitle(t: TranslateFunction, input: string | undefined) {
  switch (input) {
    case 'Store Score':
      return t('storeKpis.storeScoreProfile')
    case 'Personnel Score':
      return t('storeKpis.personnelScoreProfile')
    case undefined:
      return t('storeKpis.noProfile')
    default:
      return input
  }
}

function formatScoreBehavior(t: TranslateFunction, input: string) {
  switch (input) {
    case 'score_only':
      return t('storeKpis.scoreBehavior.score_only')
    case 'warning_first':
      return t('storeKpis.scoreBehavior.warning_first')
    case 'task_candidate':
      return t('storeKpis.scoreBehavior.task_candidate')
    default:
      return formatState(input)
  }
}

function formatPeriodTypeLabel(t: TranslateFunction, input: string) {
  switch (input) {
    case 'monthly':
      return t('storeKpis.periodType.monthly')
    case 'daily':
      return t('storeKpis.periodType.daily')
    default:
      return formatState(input)
  }
}

function formatContributionTarget(t: TranslateFunction, input: 'store' | 'personnel') {
  return input === 'store'
    ? t('storeKpis.storeContributionTarget')
    : t('storeKpis.personnelContributionTarget')
}

function formatOwnerRole(t: TranslateFunction, role: KpiOwnerRole) {
  return t(ownerRoleLabelKeyByCode[role])
}

function formatMetricValue(locale: AppLocale, t: TranslateFunction, input: string | null, kpiCode?: string) {
  return formatKpiMetricValue(locale, t, input, {
    noDataKey: 'storeKpis.noData',
    code: kpiCode,
    percentMetricCodes: ['CR'],
  })
}

function formatAchievementValue(locale: AppLocale, t: TranslateFunction, row: DisplayKpiRow) {
  return formatKpiAchievementValue(locale, t, row, {
    missingReference: 'storeKpis.missingReference',
    pendingNormalization: 'storeKpis.pendingNormalizationStatus',
    noData: 'storeKpis.noData',
    scorePoints: 'storeKpis.scorePoints',
  })
}

function formatKpiMetricLabel(t: TranslateFunction, code: string, fallback: string) {
  const key = metricLabelKeyByCode[code.trim().toUpperCase()]
  return key ? t(key) : fallback
}

function formatMetricLabelList(
  t: TranslateFunction,
  codes: string[],
  labels: string[],
) {
  const source = codes.length > 0 ? codes : labels
  return source
    .map((value, index) =>
      codes.length > 0
        ? formatKpiMetricLabel(t, value, labels[index] ?? value)
        : value,
    )
    .join(', ')
}

function resolveLocalizedKpiSourceSemantics(
  t: TranslateFunction,
  input: Parameters<typeof localizeKpiSourceSemantics>[2],
) {
  return localizeKpiSourceSemantics(t, 'storeKpis', input)
}

function resolveLocalizedKpiScoreReference<T extends number | string>(
  t: TranslateFunction,
  input: {
    targetValue?: T | null
    benchmarkValue?: T | null
    benchmarkSource?: string | null
  },
) {
  return resolveSharedKpiScoreReference(t, {
    target: 'storeKpis.reference.target',
    turkeyAverage: 'storeKpis.reference.turkeyAverage',
    checklistScore: 'storeKpis.reference.checklistScore',
    default: 'storeKpis.reference.default',
    pending: 'storeKpis.reference.pending',
    targetBenchmark: 'storeKpis.reference.target',
  }, input)
}

function formatStorePerformanceGrade(t: TranslateFunction, grade: PerformanceGrade) {
  return formatLocalizedPerformanceGrade(t, 'storeKpis', grade)
}

function resolveLocalizedStoreScoreMeaning(input: {
  t: TranslateFunction
  grade: PerformanceGrade
  coveredWeight: number
  missingWeight: number
  matchedMetrics: number
  totalMetrics: number
}) {
  const code = input.grade.code as PerformanceGradeCode
  const covered = formatCoveredWeight(input.coveredWeight)
  const missing = formatCoveredWeight(input.missingWeight)
  const confidence =
    input.missingWeight > 0 || input.matchedMetrics < input.totalMetrics
      ? input.t('storeKpis.confidence.partial', { covered, missing })
      : input.t('storeKpis.confidence.full', { covered })

  return {
    title: input.t(`storeKpis.meaning.${code}.title` as TranslationKey),
    summary: input.t(`storeKpis.meaning.${code}.summary` as TranslationKey),
    action: input.t(`storeKpis.meaning.${code}.action` as TranslationKey),
    confidence,
    tone: code === 'A' || code === 'B'
      ? input.missingWeight > 0
        ? 'warning'
        : input.grade.tone
      : code === 'C'
        ? 'warning'
        : 'danger',
  } as const
}

function describeLocalizedBenchmarkCap(
  t: TranslateFunction,
  input: {
    actualRatio?: number | null
    scoredRatio?: number | null
    isCapped?: boolean
  },
) {
  return describeSharedBenchmarkCap(t, 'storeKpis.benchmarkCap', input)
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
  const { locale, t } = useLocalization()
  const reportingAllowed = hasReportingAccess(input.authSummary)
  const primaryStoreId = input.authSummary?.user.scope.storeIds[0] ?? undefined
  const storeShellIntent = hasStoreShellIntent(input.authSummary)
  const [viewMode, setViewMode] = useState<'live' | 'closed'>('live')
  const [selectedSnapshotRunId, setSelectedSnapshotRunId] = useState('')
  const [livePeriodStart, setLivePeriodStart] = useState('')

  const configQuery = useQuery({
    queryKey: ['store-kpi-config'],
    queryFn: getKpiConfig,
    enabled: Boolean(input.authSummary),
    ...transientQueryRetryOptions,
  })

  const liveKpiQuery = useQuery({
    queryKey: ['store-kpis-live', livePeriodStart || 'latest-monthly'],
    queryFn: () =>
      getStoreKpiHighlights({
        periodType: 'monthly',
        periodStart: livePeriodStart || undefined,
      }),
    enabled: reportingAllowed && viewMode === 'live',
    ...transientQueryRetryOptions,
  })

  const dailySnapshotQuery = useQuery({
    queryKey: ['store-kpis-snapshot-runs', 'daily-list'],
    queryFn: () =>
      getReportingSnapshotRuns({
        snapshotType: 'daily',
        limit: 30,
        offset: 0,
      }),
    enabled: reportingAllowed && viewMode === 'closed',
    ...transientQueryRetryOptions,
  })

  const availableSnapshotRuns = dailySnapshotQuery.data?.items ?? []
  const activeSnapshotRun =
    availableSnapshotRuns.find((run) => run.snapshotRunId === selectedSnapshotRunId) ??
    availableSnapshotRuns[0] ??
    null
  const snapshotRunId = activeSnapshotRun?.snapshotRunId ?? ''
  const closedKpiQuery = useQuery({
    queryKey: ['store-kpis-closed', snapshotRunId || 'no-run'],
    queryFn: () => getKpiReport(snapshotRunId),
    enabled: reportingAllowed && viewMode === 'closed' && Boolean(snapshotRunId),
    ...transientQueryRetryOptions,
  })

  const scoreBreakdownQuery = useQuery({
    queryKey: ['store-score-breakdown', snapshotRunId || 'no-run', primaryStoreId ?? 'no-store'],
    queryFn: () =>
      getStoreScoreBreakdown({
        snapshotRunId,
        storeId: primaryStoreId ?? '',
      }),
    enabled:
      reportingAllowed &&
      viewMode === 'closed' &&
      Boolean(snapshotRunId) &&
      Boolean(primaryStoreId),
    ...transientQueryRetryOptions,
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
        benchmarkValue:
          metric.benchmarkValue !== null && metric.benchmarkValue !== undefined
            ? String(metric.benchmarkValue)
            : null,
        benchmarkSource: metric.benchmarkSource,
        actualRatio: metric.actualRatio,
        scoredRatio: metric.scoredRatio,
        capRatio: metric.capRatio,
        isCapped: metric.isCapped,
        scoreContribution: metric.scoreContribution,
        missingReason: metric.missingReason,
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
      benchmarkValue: null,
      benchmarkSource: undefined,
      actualRatio: row.achievementRate ? toNumber(row.achievementRate) : null,
      scoredRatio: row.achievementRate ? clampScore(toNumber(row.achievementRate)) : null,
      capRatio: 1.2,
      isCapped: row.achievementRate ? toNumber(row.achievementRate) > 1.2 : false,
      scoreContribution: null,
      missingReason: null,
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
    return rows.reduce<DisplayKpiRow | null>((best, row) => {
      if (row.achievementRate === null) {
        return best
      }

      if (!best || toNumber(row.achievementRate) > toNumber(best.achievementRate)) {
        return row
      }

      return best
    }, null)
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
        matchingRow?.scoreContribution !== null &&
        matchingRow?.scoreContribution !== undefined
          ? matchingRow.scoreContribution / 100
          : achievementRate === null
            ? 0
            : (achievementRate * metric.weightPercent) / 100

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
  const closedScoreBreakdown = scoreBreakdownQuery.data ?? null
  const bmChecklist = closedScoreBreakdown?.components.bmChecklist ?? null
  const vmChecklist = closedScoreBreakdown?.components.vmChecklist ?? null
  const bmChecklistStatusLabel = bmChecklist
    ? formatChecklistStatus(t, {
        label: 'BM',
        included: bmChecklist.included,
        visitCount: bmChecklist.visitCount,
      })
    : t('storeKpis.checklist.notIncluded', { label: 'BM' })
  const vmChecklistStatusLabel = vmChecklist
    ? formatChecklistStatus(t, {
        label: 'VM',
        included: vmChecklist.included,
        visitCount: vmChecklist.visitCount,
      })
    : t('storeKpis.checklist.notIncluded', { label: 'VM' })
  const bmChecklistContributionLabel = bmChecklist
    ? formatChecklistContribution(locale, t, {
        label: 'BM',
        contribution: bmChecklist.contribution,
      })
    : t('storeKpis.noContribution')
  const vmChecklistContributionLabel = vmChecklist
    ? formatChecklistContribution(locale, t, {
        label: 'VM',
        contribution: vmChecklist.contribution,
      })
    : t('storeKpis.noContribution')
  const bmChecklistMissingNote = formatChecklistMissingNote(t, {
    label: 'BM',
    included: bmChecklist?.included ?? false,
  })
  const vmChecklistMissingNote = formatChecklistMissingNote(t, {
    label: 'VM',
    included: vmChecklist?.included ?? false,
  })

  const matchedMetricCount = weightedScore.contributions.filter(
    (item) => item.matchingRow?.scoreStatus === 'scored',
  ).length
  const storeGrade = resolvePerformanceGrade(
    weightedScore.scoreValue,
    configQuery.data?.gradingBands,
  )
  const storeScoreMeaning = resolveLocalizedStoreScoreMeaning({
    t,
    grade: storeGrade,
    coveredWeight: weightedScore.coveredWeight,
    missingWeight: weightedScore.missingWeight,
    matchedMetrics: matchedMetricCount,
    totalMetrics: weightedScore.contributions.length,
  })
  const personnelWeightsReady =
    (personnelKpiScoreProfile?.metrics ?? []).length > 0 &&
    (personnelKpiScoreProfile?.metrics ?? []).every(
      (metric) => metric.weightPercent > 0,
    )

  const configForbidden = configQuery.error instanceof ApiError && configQuery.error.status === 403
  const isLoading =
    (configQuery.isLoading && !configForbidden) ||
    (viewMode === 'live' ? liveKpiQuery.isLoading : dailySnapshotQuery.isLoading || closedKpiQuery.isLoading)

  if (!reportingAllowed) {
    return (
      <section className="page-stack">
        <section className="hero-panel store-hero-panel">
          <div>
            <div className="eyebrow">{t('storeKpis.unavailableEyebrow')}</div>
            <h2 className="hero-title">
              {t('storeKpis.title')}
            </h2>
            <p className="hero-copy">
              {t('storeKpis.unavailableCopy')}
            </p>
          </div>
          <div className="hero-metrics">
            <MetricAccent label={t('storeKpis.store')} value={primaryStoreId ?? t('storeKpis.noStoreScope')} />
            <MetricAccent label={t('storeKpis.status')} value={t('storeKpis.authWaiting')} />
          </div>
        </section>

        {storeShellIntent ? (
          <section className="panel">
            <div className="key-grid">
              <KeyValue label={t('storeKpis.storeScope')} value={primaryStoreId ?? t('storeKpis.noOpenStoreScope')} />
              <KeyValue label={t('storeKpis.readStatus')} value={t('storeKpis.readWaiting')} />
            </div>
          </section>
        ) : null}
      </section>
    )
  }

  if (isLoading) {
    return (
      <ScreenState
        title={t('storeKpis.loadingTitle')}
        copy={t('storeKpis.loadingCopy')}
      />
    )
  }

  if (configQuery.isError && !configForbidden) {
    return (
      <ScreenState
        title={t('storeKpis.configErrorTitle')}
        copy={getErrorMessage(configQuery.error)}
        tone="error"
      />
    )
  }

  if (viewMode === 'live' && liveKpiQuery.isError) {
    if (liveKpiQuery.error instanceof ApiError && liveKpiQuery.error.status === 403) {
      return (
        <ScreenState
          title={t('storeKpis.liveForbiddenTitle')}
          copy={t('storeKpis.liveForbiddenCopy')}
          tone="error"
        />
      )
    }

    return (
      <ScreenState
        title={t('storeKpis.rowsErrorTitle')}
        copy={getErrorMessage(liveKpiQuery.error)}
        tone="error"
      />
    )
  }

  if (viewMode === 'closed' && dailySnapshotQuery.isError) {
    return (
      <ScreenState
        title={t('storeKpis.snapshotListErrorTitle')}
        copy={getErrorMessage(dailySnapshotQuery.error)}
        tone="error"
      />
    )
  }

  if (viewMode === 'closed' && !activeSnapshotRun) {
    return (
      <ScreenState
        title={t('storeKpis.closedDayMissingTitle')}
        copy={t('storeKpis.closedDayMissingCopy')}
        tone="error"
      />
    )
  }

  if (viewMode === 'closed' && closedKpiQuery.isError) {
    return (
      <ScreenState
        title={t('storeKpis.rowsErrorTitle')}
        copy={getErrorMessage(closedKpiQuery.error)}
        tone="error"
      />
    )
  }

  const liveSummary = liveKpiQuery.data
  const activeStoreName =
    viewMode === 'live'
      ? liveSummary?.store?.storeName ?? t('storeKpis.noStoreScope')
      : primaryStoreId ?? t('storeKpis.noStoreScope')
  const latestLivePeriodLabel =
    liveSummary?.period
      ? `${formatDate(liveSummary.period.periodStart, locale)} - ${formatDate(liveSummary.period.periodEnd, locale)} (${t('storeKpis.latestMonthlyPeriod')})`
      : t('storeKpis.latestMonthlyPeriod')

  return (
    <section className="page-stack">
      <section className="hero-panel store-hero-panel">
        <div>
          <div className="eyebrow">{t('storeKpis.heroEyebrow')}</div>
          <h2 className="hero-title">
            {t('storeKpis.title')}
          </h2>
          <p className="hero-copy">
            {t('storeKpis.heroCopy')}
          </p>
        </div>
        <div className="hero-metrics">
          <MetricAccent label={t('storeKpis.mode')} value={viewMode === 'live' ? t('storeKpis.livePeriod') : t('storeKpis.closedDay')} />
          <MetricAccent label={t('storeKpis.store')} value={activeStoreName} />
          <MetricAccent
            label={t('storeKpis.period')}
            value={
              viewMode === 'live'
                ? liveSummary?.period
                  ? `${formatDate(liveSummary.period.periodStart, locale)} - ${formatDate(liveSummary.period.periodEnd, locale)}`
                  : t('storeKpis.noLivePeriod')
                : activeSnapshotRun?.snapshotDate ?? t('storeKpis.noRecord')
            }
          />
          <MetricAccent
            label={t('storeKpis.scoreBand')}
            value={`${storeGrade.emoji} ${storeGrade.code}`}
          />
          <MetricAccent
            label={viewMode === 'live' ? t('storeKpis.averageScore') : t('storeKpis.averageAchievement')}
            value={
              rows.length > 0
                ? viewMode === 'live'
                  ? t('storeKpis.scorePoints', { value: formatMetric(locale, averageAchievement) })
                  : formatPercent(locale, averageAchievement)
                : t('storeKpis.noScorableRows')
            }
          />
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">{t('storeKpis.viewModeEyebrow')}</div>
            <h3>{t('storeKpis.viewModeTitle')}</h3>
          </div>
        </div>
        <div className="toolbar-cluster">
          <button
            className="control-button"
            type="button"
            data-active={viewMode === 'live'}
            onClick={() => setViewMode('live')}
          >
            {t('storeKpis.livePeriod')}
          </button>
          <button
            className="control-button"
            type="button"
            data-active={viewMode === 'closed'}
            onClick={() => setViewMode('closed')}
          >
            {t('storeKpis.closedDay')}
          </button>
        </div>
        {viewMode === 'live' ? (
          <div className="toolbar-cluster">
            <select
              className="control-input"
              value={livePeriodStart}
              onChange={(event) => setLivePeriodStart(event.target.value)}
              aria-label={t('storeKpis.livePeriodSelect')}
            >
              <option value="">{latestLivePeriodLabel}</option>
              {(liveSummary?.availablePeriods ?? []).map((period) => (
                <option
                  key={`${period.periodType}:${period.periodStart}`}
                  value={period.periodStart}
                >
                  {t('storeKpis.periodOption', {
                    start: formatDate(period.periodStart, locale),
                    end: formatDate(period.periodEnd, locale),
                    periodType: formatPeriodTypeLabel(t, period.periodType),
                  })}
                </option>
              ))}
            </select>
            <button
              className="control-button"
              type="button"
              onClick={() => setLivePeriodStart('')}
              disabled={!livePeriodStart}
            >
              {t('storeKpis.clearFilter')}
            </button>
          </div>
        ) : (
          <div className="toolbar-cluster">
            <select
              className="control-input"
              value={activeSnapshotRun?.snapshotRunId ?? ''}
              onChange={(event) => setSelectedSnapshotRunId(event.target.value)}
              aria-label={t('storeKpis.closedRecordSelect')}
            >
              {activeSnapshotRun ? null : <option value="">{t('storeKpis.noRecord')}</option>}
              {availableSnapshotRuns.map((run) => (
                <option key={run.snapshotRunId} value={run.snapshotRunId}>
                  {formatSnapshotOptionLabel(run, locale)}
                </option>
              ))}
            </select>
            <button
              className="control-button"
              type="button"
              onClick={() => setSelectedSnapshotRunId('')}
              disabled={!selectedSnapshotRunId}
            >
              {t('storeKpis.returnLatestClosedDay')}
            </button>
          </div>
        )}
      </section>

      <section className="metric-grid store-metric-grid">
        <MetricCard
          title={t('storeKpis.kpiRows')}
          value={rows.length}
          note={t('storeKpis.kpiRowsNote')}
          icon={<Target size={18} />}
          tone="accent"
        />
        <MetricCard
          title={t('storeKpis.scored')}
          value={matchedMetricCount}
          note={t('storeKpis.pendingNormalizationCount', {
            count: totals.pendingNormalization,
          })}
          icon={<TrendingUp size={18} />}
          tone={totals.pendingNormalization === 0 ? 'calm' : 'warning'}
        />
        <MetricCard
          title={t('storeKpis.watchKpi')}
          value={needsAttention.length}
          note={t('storeKpis.riskNote', {
            atRisk: totals.atRisk,
            offTrack: totals.offTrack,
          })}
          icon={<ShieldAlert size={18} />}
          tone={needsAttention.length === 0 ? 'neutral' : 'warning'}
        />
        <MetricCard
          title={t('storeKpis.storeScore')}
          value={Number((weightedScore.scoreValue * 100).toFixed(1))}
          note={`${formatStorePerformanceGrade(t, storeGrade)} · ${t('storeKpis.covered', { weight: weightedScore.coveredWeight })}`}
          icon={<TrendingUp size={18} />}
          tone={storeGrade.tone}
        />
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">{t('storeKpis.monthlyBreakdownEyebrow')}</div>
            <h3>{t('storeKpis.checklistImpact')}</h3>
          </div>
          <StatusPill tone={viewMode === 'closed' ? 'calm' : 'neutral'}>
            {viewMode === 'closed' ? t('storeKpis.finalRecord') : t('storeKpis.livePreview')}
          </StatusPill>
        </div>
        <div className="key-grid">
          <KeyValue
            label={t('storeKpis.kpiContribution')}
            value={
              closedScoreBreakdown?.components.kpi.contribution !== null &&
              closedScoreBreakdown?.components.kpi.contribution !== undefined
                ? formatMetric(locale, closedScoreBreakdown.components.kpi.contribution)
                : t('storeKpis.scorePoints', {
                    value: formatMetric(locale, weightedScore.scoreValue * 100),
                  })
            }
          />
          <KeyValue label={t('storeKpis.bmChecklistStatus')} value={bmChecklistStatusLabel} />
          <KeyValue label={t('storeKpis.bmContribution')} value={bmChecklistContributionLabel} />
          <KeyValue
            label={t('storeKpis.vmChecklistStatus')}
            value={vmChecklistStatusLabel}
          />
          <KeyValue label={t('storeKpis.vmContribution')} value={vmChecklistContributionLabel} />
          <KeyValue
            label={t('storeKpis.configuredBlend')}
            value={
              closedScoreBreakdown
                ? t('storeKpis.configuredBlendValue', {
                    kpi: closedScoreBreakdown.configuredWeights.kpiPerformanceWeight,
                    bm: closedScoreBreakdown.configuredWeights.bmChecklistWeight,
                    vm: closedScoreBreakdown.configuredWeights.vmChecklistWeight,
                  })
                : t('storeKpis.defaultPlanBlend')
            }
          />
          <KeyValue
            label={t('storeKpis.effectiveBlend')}
            value={
              closedScoreBreakdown
                ? t('storeKpis.effectiveBlendValue', {
                    kpi: closedScoreBreakdown.effectiveWeights.kpiPerformanceWeight,
                    bm: closedScoreBreakdown.effectiveWeights.bmChecklistWeight,
                    vm: closedScoreBreakdown.effectiveWeights.vmChecklistWeight,
                  })
                : t('storeKpis.livePreview')
            }
          />
        </div>
        <p className="helper-text">{t('storeKpis.checklistImpactCopy')}</p>
        {bmChecklistMissingNote ? (
          <p className="helper-text">{bmChecklistMissingNote}</p>
        ) : null}
        {vmChecklistMissingNote ? (
          <p className="helper-text">{vmChecklistMissingNote}</p>
        ) : null}
      </section>

      <section className="panel" aria-label={t('storeKpis.scoreSourcesAria')}>
        <div className="panel-heading">
          <div>
            <div className="eyebrow">{t('storeKpis.scoreContractEyebrow')}</div>
            <h3>{t('storeKpis.storeScoreSources')}</h3>
          </div>
          <StatusPill tone="accent">{t('storeKpis.officialRule')}</StatusPill>
        </div>
        <p className="queue-subtitle">{t('storeKpis.scoreSourcesCopy')}</p>
        <div className="key-grid">
          <KeyValue
            label={t('storeKpis.kpiSources')}
            value={t('storeKpis.kpiSourcesValue')}
          />
          <KeyValue
            label={t('storeKpis.checklistShare')}
            value={t('storeKpis.checklistShareValue')}
          />
          <KeyValue
            label={t('storeKpis.capLanguage')}
            value={t('storeKpis.capLanguageValue')}
          />
          <KeyValue
            label={t('storeKpis.turkeyAverage')}
            value={t('storeKpis.turkeyAverageValue')}
          />
        </div>
      </section>

      <section className="two-up-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t('storeKpis.activeScopeEyebrow')}</div>
              <h3>{t('storeKpis.activeScopeTitle')}</h3>
            </div>
          </div>
          <div className="key-grid">
            <KeyValue label={t('storeKpis.storeScope')} value={primaryStoreId ?? t('storeKpis.noOpenStoreScope')} />
            <KeyValue label={t('storeKpis.storeName')} value={activeStoreName} />
            <KeyValue
              label={t('storeKpis.dataView')}
              value={viewMode === 'live' ? t('storeKpis.liveImportedMonthlyData') : t('storeKpis.dailyClosedRecord')}
            />
            <KeyValue label={t('storeKpis.readScope')} value={t('storeKpis.readScopeValue')} />
          </div>
        </article>

        <article className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t('storeKpis.topSignalEyebrow')}</div>
              <h3>{t('storeKpis.topSignalTitle')}</h3>
            </div>
            <StatusPill tone={needsAttention.length === 0 ? 'calm' : 'warning'}>
              {needsAttention.length === 0 ? t('storeKpis.balanced') : t('storeKpis.watch')}
            </StatusPill>
          </div>
          {topPerformer ? (
            <div className="stacked-table">
              <div className="stacked-row">
                <div className="stacked-row-head">
                  <div>
                    <strong>{formatKpiMetricLabel(t, topPerformer.kpiCode, topPerformer.kpiName)}</strong>
                    <span className="queue-subtitle">{topPerformer.kpiCode}</span>
                  </div>
                  <StatusPill tone="accent">
                    {formatAchievementValue(locale, t, topPerformer)}
                  </StatusPill>
                </div>
                <p>{t('storeKpis.topSignalCopy')}</p>
              </div>
            </div>
          ) : (
            <EmptyState
              title={t('storeKpis.noTopSignalTitle')}
              copy={t('storeKpis.noTopSignalCopy')}
            />
          )}
        </article>
      </section>

      {viewMode === 'live' && liveSummary?.partial.isPartial ? (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <div className="eyebrow">{t('storeKpis.partialEyebrow')}</div>
              <h3>{t('storeKpis.partialTitle')}</h3>
            </div>
            <StatusPill tone="warning">{t('storeKpis.partialData')}</StatusPill>
          </div>
          <div className="key-grid">
            <KeyValue
              label={t('storeKpis.missingMetrics')}
              value={
                liveSummary.partial.missingMetricLabels.length > 0
                  ? formatMetricLabelList(
                      t,
                      liveSummary.partial.missingMetricCodes,
                      liveSummary.partial.missingMetricLabels,
                    )
                  : t('storeKpis.none')
              }
            />
            <KeyValue
              label={t('storeKpis.pendingNormalization')}
              value={
                liveSummary.partial.pendingNormalizationLabels.length > 0
                  ? formatMetricLabelList(
                      t,
                      liveSummary.partial.pendingNormalizationCodes,
                      liveSummary.partial.pendingNormalizationLabels,
                    )
                  : t('storeKpis.none')
              }
            />
            <KeyValue
              label={t('storeKpis.note')}
              value={t('storeKpis.partialNote')}
            />
          </div>
        </section>
      ) : null}

      <section className="panel" aria-label={t('storeKpis.scoreMeaningAria')}>
        <div className="panel-heading">
          <div>
            <div className="eyebrow">{t('storeKpis.scoreMeaningEyebrow')}</div>
            <h3>{storeScoreMeaning.title}</h3>
          </div>
          <StatusPill tone={storeScoreMeaning.tone}>{storeGrade.code}</StatusPill>
        </div>
        <p className="queue-subtitle">{storeScoreMeaning.summary}</p>
        <div className="key-grid">
          <KeyValue label={t('storeKpis.scoreBand')} value={formatStorePerformanceGrade(t, storeGrade)} />
          <KeyValue label={t('storeKpis.score')} value={formatPercent(locale, weightedScore.scoreValue)} />
          <KeyValue label={t('storeKpis.coveredWeight')} value={`${weightedScore.coveredWeight}%`} />
          <KeyValue label={t('storeKpis.actionLanguage')} value={storeScoreMeaning.action} />
        </div>
        <p className="queue-subtitle">{storeScoreMeaning.confidence}</p>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">{t('storeKpis.storeScoreSummary')}</div>
            <h3>{t('storeKpis.scoreBreakdown')}</h3>
          </div>
          <StatusPill tone={weightedScore.missingWeight === 0 ? 'calm' : 'warning'}>
            {weightedScore.missingWeight === 0
              ? t('storeKpis.complete')
              : t('storeKpis.missingWeightStatus', {
                  weight: weightedScore.missingWeight,
                })}
          </StatusPill>
        </div>
        <div className="key-grid">
          <KeyValue label={t('storeKpis.scoreValueLabel')} value={formatPercent(locale, weightedScore.scoreValue)} />
          <KeyValue label={t('storeKpis.scoreBand')} value={formatStorePerformanceGrade(t, storeGrade)} />
          <KeyValue label={t('storeKpis.coveredWeight')} value={`${weightedScore.coveredWeight}%`} />
          <KeyValue label={t('storeKpis.missingWeight')} value={`${weightedScore.missingWeight}%`} />
          <KeyValue label={t('storeKpis.scoreProfile')} value={formatScoreProfileTitle(t, storeKpiScoreProfile?.title)} />
          <KeyValue label={t('storeKpis.settingsSource')} value={t('storeKpis.publishedLiveConfig')} />
          <KeyValue
            label={t('storeKpis.matchedMetric')}
            value={`${matchedMetricCount}/${weightedScore.contributions.length}`}
          />
          <KeyValue
            label={t('storeKpis.personnelWeight')}
            value={personnelWeightsReady ? t('storeKpis.ready') : t('storeKpis.weightWaiting')}
          />
        </div>
        <div className="stacked-table">
          {weightedScore.contributions.map((item) => {
            const sourceSemantics = resolveLocalizedKpiSourceSemantics(t, {
              code: item.matchingRow?.kpiCode ?? item.metric.code,
              actualValue: item.matchingRow?.actualValue ?? null,
              scoreStatus: item.matchingRow?.scoreStatus ?? 'missing',
            })
            const scoreReference = resolveLocalizedKpiScoreReference(t, {
              targetValue: item.matchingRow?.targetValue ?? null,
              benchmarkValue: item.matchingRow?.benchmarkValue ?? null,
              benchmarkSource: item.matchingRow?.benchmarkSource ?? null,
            })

            return (
              <article className="stacked-row" key={item.metric.code}>
                <div className="stacked-row-head">
                  <div>
                    <strong>{formatKpiMetricLabel(t, item.metric.code, item.metric.label)}</strong>
                    <span className="queue-subtitle">
                      {item.matchingRow ? item.matchingRow.kpiCode : t('storeKpis.kpiRowWaiting')}
                    </span>
                  </div>
                  <StatusPill
                    tone={
                      item.matchingRow?.scoreStatus === 'scored'
                        ? 'accent'
                        : item.matchingRow?.scoreStatus === 'pending_normalization' ||
                            item.matchingRow?.scoreStatus === 'missing_reference'
                          ? 'warning'
                          : 'neutral'
                    }
                  >
                    {`${item.metric.weightPercent}%`}
                  </StatusPill>
                </div>
                <div className="key-grid">
                  <KeyValue
                    label={t('storeKpis.scoreTarget')}
                    value={formatMetricValue(locale, t, scoreReference.value, item.matchingRow?.kpiCode)}
                  />
                  <KeyValue
                    label={t('storeKpis.actual')}
                    value={formatMetricValue(locale, t, item.matchingRow?.actualValue ?? null, item.matchingRow?.kpiCode)}
                  />
                  <KeyValue
                    label={t('storeKpis.achievement')}
                    value={
                      item.matchingRow
                        ? formatAchievementValue(locale, t, item.matchingRow)
                        : t('storeKpis.noData')
                    }
                  />
                  <KeyValue
                    label={t('storeKpis.targetSource')}
                    value={scoreReference.sourceLabel}
                  />
                  <KeyValue
                    label={t('storeKpis.weightedContribution')}
                    value={formatPercent(locale, item.weightedContribution)}
                  />
                  <KeyValue
                    label={t('storeKpis.scoreBehavior')}
                    value={formatScoreBehavior(t, item.metric.scoreBehavior)}
                  />
                  <KeyValue label={t('storeKpis.sourceType')} value={sourceSemantics.label} />
                  <KeyValue label={t('storeKpis.dataSource')} value={sourceSemantics.summary} />
                </div>
                {item.matchingRow?.isCapped ? (
                  <p className="queue-subtitle">
                    {describeLocalizedBenchmarkCap(t, {
                      actualRatio: item.matchingRow.actualRatio,
                      scoredRatio: item.matchingRow.scoredRatio,
                      isCapped: item.matchingRow.isCapped,
                    })}
                  </p>
                ) : null}
                {item.matchingRow?.scoreStatus === 'missing_reference' ? (
                  <p className="queue-subtitle">
                    {t('storeKpis.missingReferenceReason', {
                      reason: item.matchingRow.missingReason ?? 'reference_missing',
                    })}
                  </p>
                ) : null}
              </article>
            )
          })}
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">{t('storeKpis.ownershipMatrix')}</div>
            <h3>{t('storeKpis.ownershipTitle')}</h3>
          </div>
        </div>
        <div className="stacked-table">
          {kpiOwnershipMatrix.map((metric) => (
            <article className="stacked-row" key={metric.code}>
              <div className="stacked-row-head">
                <div>
                  <strong>{formatKpiMetricLabel(t, metric.code, metric.label)}</strong>
                  <span className="queue-subtitle">{metric.code}</span>
                </div>
                <StatusPill tone={metric.taskCandidate ? 'warning' : 'neutral'}>
                  {metric.taskCandidate ? t('storeKpis.taskCandidate') : t('storeKpis.watchFirst')}
                </StatusPill>
              </div>
              <div className="key-grid">
                <KeyValue
                  label={t('storeKpis.operationalOwner')}
                  value={formatOwnerRole(t, metric.operationalOwner)}
                />
                <KeyValue
                  label={t('storeKpis.visibleRoles')}
                  value={metric.visibleTo
                    .map((role) => formatOwnerRole(t, role))
                    .join(', ')}
                />
                <KeyValue
                  label={t('storeKpis.contributionArea')}
                  value={metric.contributesTo.map((item) => formatContributionTarget(t, item)).join(', ')}
                />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">{t('storeKpis.priorityEyebrow')}</div>
            <h3>{t('storeKpis.priorityTitle')}</h3>
          </div>
        </div>

        {needsAttention.length === 0 ? (
          <EmptyState
            title={t('storeKpis.noRiskTitle')}
            copy={t('storeKpis.noRiskCopy')}
          />
        ) : (
          <div className="stacked-table">
            {needsAttention.map((row) => {
              const sourceSemantics = resolveLocalizedKpiSourceSemantics(t, {
                code: row.kpiCode,
                actualValue: row.actualValue,
                scoreStatus: row.scoreStatus,
              })

              return (
                <article className="stacked-row" key={`${row.storeId}:${row.kpiCode}`}>
                  <div className="stacked-row-head">
                    <div>
                      <strong>{formatKpiMetricLabel(t, row.kpiCode, row.kpiName)}</strong>
                      <span className="queue-subtitle">{row.kpiCode}</span>
                    </div>
                    <StatusPill tone={row.statusBand === 'off_track' ? 'danger' : 'warning'}>
                      {formatStatusBand(t, row.statusBand)}
                    </StatusPill>
                  </div>
                  <div className="key-grid">
                    <KeyValue label={t('storeKpis.scoreTarget')} value={formatMetricValue(locale, t, row.targetValue, row.kpiCode)} />
                    <KeyValue label={t('storeKpis.actual')} value={formatMetricValue(locale, t, row.actualValue, row.kpiCode)} />
                    <KeyValue
                      label={t('storeKpis.achievement')}
                      value={formatAchievementValue(locale, t, row)}
                    />
                    <KeyValue
                      label={t('storeKpis.period')}
                      value={`${formatDate(row.periodStart, locale)} - ${formatDate(row.periodEnd, locale)}`}
                    />
                    <KeyValue label={t('storeKpis.sourceType')} value={sourceSemantics.label} />
                    <KeyValue label={t('storeKpis.dataSource')} value={sourceSemantics.summary} />
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </section>
  )
}
