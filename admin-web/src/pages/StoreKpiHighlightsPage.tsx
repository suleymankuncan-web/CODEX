import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ShieldAlert, Target, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
  StoreErrorState,
  StoreEmptyState,
  StoreInfoGrid,
  StoreLoadingState,
  StoreMetricCard,
  StoreMetricGrid,
  StoreSectionCard,
  StoreStackedList,
  StoreStackedRow,
  StoreStatusBadge,
  StoreSurfaceHeader,
  StoreSurfacePage,
} from './store-surface-primitives'
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
  benchmarkValue: string | null | undefined
  benchmarkSource: string | undefined
  actualRatio: number | null | undefined
  scoredRatio: number | null | undefined
  capRatio: number | null | undefined
  isCapped: boolean | undefined
  scoreContribution: number | null | undefined
  missingReason: string | null | undefined
  statusBand: string | null
  scoreStatus: 'scored' | 'pending_normalization' | 'missing_reference' | 'missing'
}

type ChecklistImpactComponent = {
  included: boolean
  score: number | null
  weight: number
  contribution: number | null
  status: string
  missingReason?: string
  visitCount: number
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

function resolveLiveChecklistImpact(input: {
  rows: DisplayKpiRow[]
  metricCode: 'BM_CHECKLIST' | 'VM_CHECKLIST'
  scoreProfile: {
    metrics: Array<{
      code: string
      weightPercent: number
    }>
  } | undefined
}): ChecklistImpactComponent | null {
  const metricConfig = input.scoreProfile?.metrics.find(
    (metric) => metric.code === input.metricCode,
  )
  const row = input.rows.find((item) => item.kpiCode === input.metricCode)

  if (!metricConfig && !row) {
    return null
  }

  const weight = metricConfig?.weightPercent ?? row?.scoreContribution ?? 0

  if (row?.scoreStatus === 'scored' && row.actualValue !== null) {
    const score = toNumber(row.actualValue)
    const contribution =
      row.scoreContribution !== null && row.scoreContribution !== undefined
        ? row.scoreContribution
        : row.scoredRatio !== null && row.scoredRatio !== undefined
          ? row.scoredRatio * weight
          : row.achievementRate !== null && row.achievementRate !== undefined
            ? toNumber(row.achievementRate) * weight
            : null

    return {
      included: true,
      score,
      weight,
      contribution,
      status: 'included',
      visitCount: 1,
    }
  }

  return {
    included: false,
    score: null,
    weight,
    contribution: null,
    status: row?.scoreStatus ?? 'not_included',
    missingReason:
      input.metricCode === 'BM_CHECKLIST'
        ? 'bm_checklist_not_completed_for_period'
        : 'vm_checklist_not_completed_for_period',
    visitCount: 0,
  }
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
    ...(kpiCode === undefined ? {} : { code: kpiCode }),
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
    actualRatio: number | null | undefined
    scoredRatio: number | null | undefined
    isCapped: boolean | undefined
  },
) {
  return describeSharedBenchmarkCap(t, 'storeKpis.benchmarkCap', {
    ...(input.actualRatio === undefined ? {} : { actualRatio: input.actualRatio }),
    ...(input.scoredRatio === undefined ? {} : { scoredRatio: input.scoredRatio }),
    ...(input.isCapped === undefined ? {} : { isCapped: input.isCapped }),
  })
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

function useStoreKpiHighlightsPageModel(input: {
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
        ...(livePeriodStart ? { periodStart: livePeriodStart } : {}),
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
  const liveBmChecklist = resolveLiveChecklistImpact({
    rows,
    metricCode: 'BM_CHECKLIST',
    scoreProfile: storeKpiScoreProfile,
  })
  const liveVmChecklist = resolveLiveChecklistImpact({
    rows,
    metricCode: 'VM_CHECKLIST',
    scoreProfile: storeKpiScoreProfile,
  })
  const bmChecklist =
    viewMode === 'closed'
      ? closedScoreBreakdown?.components.bmChecklist ?? null
      : liveBmChecklist
  const vmChecklist =
    viewMode === 'closed'
      ? closedScoreBreakdown?.components.vmChecklist ?? null
      : liveVmChecklist
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
  const liveSummary = liveKpiQuery.data
  const activeStoreName =
    viewMode === 'live'
      ? liveSummary?.store?.storeName ?? t('storeKpis.noStoreScope')
      : primaryStoreId ?? t('storeKpis.noStoreScope')
  const latestLivePeriodLabel =
    liveSummary?.period
      ? `${formatDate(liveSummary.period.periodStart, locale)} - ${formatDate(liveSummary.period.periodEnd, locale)} (${t('storeKpis.latestMonthlyPeriod')})`
      : t('storeKpis.latestMonthlyPeriod')

  return {
    activeSnapshotRun,
    activeStoreName,
    availableSnapshotRuns,
    averageAchievement,
    bmChecklistContributionLabel,
    bmChecklistMissingNote,
    bmChecklistStatusLabel,
    closedKpiQuery,
    closedScoreBreakdown,
    configForbidden,
    configQuery,
    dailySnapshotQuery,
    isLoading,
    kpiOwnershipMatrix,
    latestLivePeriodLabel,
    liveKpiQuery,
    livePeriodStart,
    liveSummary,
    locale,
    matchedMetricCount,
    needsAttention,
    personnelWeightsReady,
    primaryStoreId,
    reportingAllowed,
    rows,
    selectedSnapshotRunId,
    setLivePeriodStart,
    setSelectedSnapshotRunId,
    setViewMode,
    storeGrade,
    storeKpiScoreProfile,
    storeScoreMeaning,
    storeShellIntent,
    t,
    totals,
    topPerformer,
    viewMode,
    vmChecklistContributionLabel,
    vmChecklistMissingNote,
    vmChecklistStatusLabel,
    weightedScore,
  }
}

type StoreKpiHighlightsPageModel = ReturnType<typeof useStoreKpiHighlightsPageModel>

export function StoreKpiHighlightsPage(input: {
  authSummary: AuthSessionSummary | null
}) {
  const model = useStoreKpiHighlightsPageModel(input)
  const { t } = model

  if (!model.reportingAllowed) {
    return <StoreKpiUnavailableState model={model} />
  }

  if (model.isLoading) {
    return (
      <StoreLoadingState
        title={t('storeKpis.loadingTitle')}
        description={t('storeKpis.loadingCopy')}
      />
    )
  }

  if (model.configQuery.isError && !model.configForbidden) {
    return (
      <StoreSurfacePage ariaLabel={t('storeKpis.configErrorTitle')}>
        <StoreErrorState
          title={t('storeKpis.configErrorTitle')}
          description={getErrorMessage(model.configQuery.error)}
        />
      </StoreSurfacePage>
    )
  }

  if (model.viewMode === 'live' && model.liveKpiQuery.isError) {
    if (model.liveKpiQuery.error instanceof ApiError && model.liveKpiQuery.error.status === 403) {
      return (
        <StoreSurfacePage ariaLabel={t('storeKpis.liveForbiddenTitle')}>
          <StoreErrorState
            title={t('storeKpis.liveForbiddenTitle')}
            description={t('storeKpis.liveForbiddenCopy')}
          />
        </StoreSurfacePage>
      )
    }

    return (
      <StoreSurfacePage ariaLabel={t('storeKpis.rowsErrorTitle')}>
        <StoreErrorState
          title={t('storeKpis.rowsErrorTitle')}
          description={getErrorMessage(model.liveKpiQuery.error)}
        />
      </StoreSurfacePage>
    )
  }

  if (model.viewMode === 'closed' && model.dailySnapshotQuery.isError) {
    return (
      <StoreSurfacePage ariaLabel={t('storeKpis.snapshotListErrorTitle')}>
        <StoreErrorState
          title={t('storeKpis.snapshotListErrorTitle')}
          description={getErrorMessage(model.dailySnapshotQuery.error)}
        />
      </StoreSurfacePage>
    )
  }

  if (model.viewMode === 'closed' && !model.activeSnapshotRun) {
    return (
      <StoreSurfacePage ariaLabel={t('storeKpis.closedDayMissingTitle')}>
        <StoreErrorState
          title={t('storeKpis.closedDayMissingTitle')}
          description={t('storeKpis.closedDayMissingCopy')}
        />
      </StoreSurfacePage>
    )
  }

  if (model.viewMode === 'closed' && model.closedKpiQuery.isError) {
    return (
      <StoreSurfacePage ariaLabel={t('storeKpis.rowsErrorTitle')}>
        <StoreErrorState
          title={t('storeKpis.rowsErrorTitle')}
          description={getErrorMessage(model.closedKpiQuery.error)}
        />
      </StoreSurfacePage>
    )
  }

  return <StoreKpiHighlightsExperience model={model} />
}

function StoreKpiUnavailableState({ model }: { model: StoreKpiHighlightsPageModel }) {
  const { primaryStoreId, storeShellIntent, t } = model

  return (
    <StoreSurfacePage ariaLabel={t('storeKpis.title')}>
      <StoreSurfaceHeader
        eyebrow={t('storeKpis.unavailableEyebrow')}
        title={t('storeKpis.title')}
        description={t('storeKpis.unavailableCopy')}
        badges={[
          { label: `${t('storeKpis.store')}: ${primaryStoreId ?? t('storeKpis.noStoreScope')}`, tone: 'neutral' },
          { label: t('storeKpis.authWaiting'), tone: 'warning' },
        ]}
      />

      {storeShellIntent ? (
        <StoreSectionCard title={t('storeKpis.storeScope')}>
          <StoreInfoGrid
            items={[
              {
                label: t('storeKpis.storeScope'),
                value: primaryStoreId ?? t('storeKpis.noOpenStoreScope'),
              },
              { label: t('storeKpis.readStatus'), value: t('storeKpis.readWaiting'), tone: 'warning' },
            ]}
            className="tw:xl:grid-cols-2"
          />
        </StoreSectionCard>
      ) : null}
    </StoreSurfacePage>
  )
}

function StoreKpiHighlightsExperience({ model }: { model: StoreKpiHighlightsPageModel }) {
  return (
    <StoreSurfacePage ariaLabel={model.t('storeKpis.title')}>
      <StoreKpiHeroPanel model={model} />
      <StoreKpiViewModePanel model={model} />
      <StoreKpiSummaryGrid model={model} />
      <StoreKpiChecklistImpactPanel model={model} />
      <StoreKpiScoreSourcesPanel model={model} />
      <StoreKpiScopeSignalGrid model={model} />
      <StoreKpiPartialDataPanel model={model} />
      <StoreKpiScoreMeaningPanel model={model} />
      <StoreKpiScoreBreakdownPanel model={model} />
      <StoreKpiOwnershipPanel model={model} />
      <StoreKpiPriorityPanel model={model} />
    </StoreSurfacePage>
  )
}

function StoreKpiHeroPanel({ model }: { model: StoreKpiHighlightsPageModel }) {
  const { activeSnapshotRun, activeStoreName, averageAchievement, liveSummary, locale, rows, storeGrade, t, viewMode } = model

  return (
    <StoreSurfaceHeader
      eyebrow={t('storeKpis.heroEyebrow')}
      title={t('storeKpis.title')}
      description={t('storeKpis.heroCopy')}
      badges={[
        { label: viewMode === 'live' ? t('storeKpis.livePeriod') : t('storeKpis.closedDay'), tone: 'accent' },
        { label: `${t('storeKpis.store')}: ${activeStoreName}`, tone: 'neutral' },
        {
          label:
            viewMode === 'live'
              ? liveSummary?.period
                ? `${formatDate(liveSummary.period.periodStart, locale)} - ${formatDate(liveSummary.period.periodEnd, locale)}`
                : t('storeKpis.noLivePeriod')
              : activeSnapshotRun?.snapshotDate ?? t('storeKpis.noRecord'),
          tone: 'neutral',
        },
        { label: `${t('storeKpis.scoreBand')}: ${storeGrade.emoji} ${storeGrade.code}`, tone: storeGrade.tone },
        {
          label:
            rows.length > 0
              ? viewMode === 'live'
                ? t('storeKpis.scorePoints', { value: formatMetric(locale, averageAchievement) })
                : formatPercent(locale, averageAchievement)
              : t('storeKpis.noScorableRows'),
          tone: rows.length > 0 ? 'calm' : 'warning',
        },
      ]}
    />
  )
}

function StoreKpiViewModePanel({ model }: { model: StoreKpiHighlightsPageModel }) {
  const {
    activeSnapshotRun,
    availableSnapshotRuns,
    latestLivePeriodLabel,
    livePeriodStart,
    liveSummary,
    locale,
    selectedSnapshotRunId,
    setLivePeriodStart,
    setSelectedSnapshotRunId,
    setViewMode,
    t,
    viewMode,
  } = model

  return (
    <StoreSectionCard title={t('storeKpis.viewModeTitle')} description={t('storeKpis.viewModeEyebrow')}>
      <div className="tw:flex tw:flex-col tw:gap-3">
        <div className="tw:flex tw:flex-wrap tw:gap-2">
        <Button type="button" variant={viewMode === 'live' ? 'default' : 'outline'} onClick={() => setViewMode('live')}>
          {t('storeKpis.livePeriod')}
        </Button>
        <Button type="button" variant={viewMode === 'closed' ? 'default' : 'outline'} onClick={() => setViewMode('closed')}>
          {t('storeKpis.closedDay')}
        </Button>
        </div>
      {viewMode === 'live' ? (
        <div className="tw:flex tw:flex-wrap tw:gap-2">
          <select
            className="tw:h-9 tw:min-w-64 tw:rounded-md tw:border tw:border-input tw:bg-transparent tw:px-3 tw:text-sm tw:shadow-xs tw:outline-none tw:focus-visible:border-ring tw:focus-visible:ring-ring/50 tw:focus-visible:ring-[3px]"
            value={livePeriodStart}
            onChange={(event) => setLivePeriodStart(event.target.value)}
            aria-label={t('storeKpis.livePeriodSelect')}
          >
            <option value="">{latestLivePeriodLabel}</option>
            {(liveSummary?.availablePeriods ?? []).map((period) => (
              <option key={`${period.periodType}:${period.periodStart}`} value={period.periodStart}>
                {t('storeKpis.periodOption', {
                  start: formatDate(period.periodStart, locale),
                  end: formatDate(period.periodEnd, locale),
                  periodType: formatPeriodTypeLabel(t, period.periodType),
                })}
              </option>
            ))}
          </select>
          <Button type="button" variant="outline" onClick={() => setLivePeriodStart('')} disabled={!livePeriodStart}>
            {t('storeKpis.clearFilter')}
          </Button>
        </div>
      ) : (
        <div className="tw:flex tw:flex-wrap tw:gap-2">
          <select
            className="tw:h-9 tw:min-w-64 tw:rounded-md tw:border tw:border-input tw:bg-transparent tw:px-3 tw:text-sm tw:shadow-xs tw:outline-none tw:focus-visible:border-ring tw:focus-visible:ring-ring/50 tw:focus-visible:ring-[3px]"
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
          <Button type="button" variant="outline" onClick={() => setSelectedSnapshotRunId('')} disabled={!selectedSnapshotRunId}>
            {t('storeKpis.returnLatestClosedDay')}
          </Button>
        </div>
      )}
      </div>
    </StoreSectionCard>
  )
}

function StoreKpiSummaryGrid({ model }: { model: StoreKpiHighlightsPageModel }) {
  const { matchedMetricCount, needsAttention, rows, storeGrade, t, totals, weightedScore } = model
  const storeScoreNote = `${formatStorePerformanceGrade(t, storeGrade)} \u00B7 ${t('storeKpis.covered', { weight: weightedScore.coveredWeight })}`

  return (
    <StoreMetricGrid>
      <StoreMetricCard title={t('storeKpis.kpiRows')} value={rows.length} note={t('storeKpis.kpiRowsNote')} icon={<Target data-icon="inline-start" />} tone="accent" />
      <StoreMetricCard
        title={t('storeKpis.scored')}
        value={matchedMetricCount}
        note={t('storeKpis.pendingNormalizationCount', { count: totals.pendingNormalization })}
        icon={<TrendingUp data-icon="inline-start" />}
        tone={totals.pendingNormalization === 0 ? 'calm' : 'warning'}
      />
      <StoreMetricCard
        title={t('storeKpis.watchKpi')}
        value={needsAttention.length}
        note={t('storeKpis.riskNote', { atRisk: totals.atRisk, offTrack: totals.offTrack })}
        icon={<ShieldAlert data-icon="inline-start" />}
        tone={needsAttention.length === 0 ? 'neutral' : 'warning'}
      />
      <StoreMetricCard
        title={t('storeKpis.storeScore')}
        value={Number((weightedScore.scoreValue * 100).toFixed(1))}
        note={storeScoreNote}
        icon={<TrendingUp data-icon="inline-start" />}
        tone={storeGrade.tone}
      />
    </StoreMetricGrid>
  )
}

function StoreKpiChecklistImpactPanel({ model }: { model: StoreKpiHighlightsPageModel }) {
  const {
    bmChecklistContributionLabel,
    bmChecklistMissingNote,
    bmChecklistStatusLabel,
    closedScoreBreakdown,
    locale,
    t,
    viewMode,
    vmChecklistContributionLabel,
    vmChecklistMissingNote,
    vmChecklistStatusLabel,
    weightedScore,
  } = model

  return (
    <StoreSectionCard
      title={t('storeKpis.checklistImpact')}
      description={t('storeKpis.monthlyBreakdownEyebrow')}
      badge={{
        label: viewMode === 'closed' ? t('storeKpis.finalRecord') : t('storeKpis.livePreview'),
        tone: viewMode === 'closed' ? 'calm' : 'neutral',
      }}
    >
      <StoreInfoGrid
        items={[
          {
            label: t('storeKpis.kpiContribution'),
            value:
              closedScoreBreakdown?.components.kpi.contribution !== null &&
              closedScoreBreakdown?.components.kpi.contribution !== undefined
                ? formatMetric(locale, closedScoreBreakdown.components.kpi.contribution)
                : t('storeKpis.scorePoints', {
                    value: formatMetric(locale, weightedScore.scoreValue * 100),
                  }),
          },
          { label: t('storeKpis.bmChecklistStatus'), value: bmChecklistStatusLabel },
          { label: t('storeKpis.bmContribution'), value: bmChecklistContributionLabel },
          { label: t('storeKpis.vmChecklistStatus'), value: vmChecklistStatusLabel },
          { label: t('storeKpis.vmContribution'), value: vmChecklistContributionLabel },
          {
            label: t('storeKpis.configuredBlend'),
            value: closedScoreBreakdown
              ? t('storeKpis.configuredBlendValue', {
                  kpi: closedScoreBreakdown.configuredWeights.kpiPerformanceWeight,
                  bm: closedScoreBreakdown.configuredWeights.bmChecklistWeight,
                  vm: closedScoreBreakdown.configuredWeights.vmChecklistWeight,
                })
              : t('storeKpis.defaultPlanBlend'),
          },
          {
            label: t('storeKpis.effectiveBlend'),
            value: closedScoreBreakdown
              ? t('storeKpis.effectiveBlendValue', {
                  kpi: closedScoreBreakdown.effectiveWeights.kpiPerformanceWeight,
                  bm: closedScoreBreakdown.effectiveWeights.bmChecklistWeight,
                  vm: closedScoreBreakdown.effectiveWeights.vmChecklistWeight,
                })
              : t('storeKpis.livePreview'),
          },
        ]}
      />
      <p className="tw:mt-3 tw:text-sm tw:leading-6 tw:text-muted-foreground">{t('storeKpis.checklistImpactCopy')}</p>
      {bmChecklistMissingNote ? <p className="tw:text-sm tw:text-muted-foreground">{bmChecklistMissingNote}</p> : null}
      {vmChecklistMissingNote ? <p className="tw:text-sm tw:text-muted-foreground">{vmChecklistMissingNote}</p> : null}
    </StoreSectionCard>
  )
}

function StoreKpiScoreSourcesPanel({ model }: { model: StoreKpiHighlightsPageModel }) {
  const { t } = model

  return (
    <StoreSectionCard
      title={t('storeKpis.storeScoreSources')}
      description={t('storeKpis.scoreSourcesCopy')}
      badge={{ label: t('storeKpis.officialRule'), tone: 'accent' }}
    >
      <StoreInfoGrid
        items={[
          { label: t('storeKpis.kpiSources'), value: t('storeKpis.kpiSourcesValue') },
          { label: t('storeKpis.checklistShare'), value: t('storeKpis.checklistShareValue') },
          { label: t('storeKpis.capLanguage'), value: t('storeKpis.capLanguageValue') },
          { label: t('storeKpis.turkeyAverage'), value: t('storeKpis.turkeyAverageValue') },
        ]}
      />
    </StoreSectionCard>
  )
}

function StoreKpiScopeSignalGrid({ model }: { model: StoreKpiHighlightsPageModel }) {
  const { activeStoreName, locale, needsAttention, primaryStoreId, t, topPerformer, viewMode } = model

  return (
    <section className="tw:grid tw:gap-4 tw:lg:grid-cols-2">
      <StoreSectionCard title={t('storeKpis.activeScopeTitle')} description={t('storeKpis.activeScopeEyebrow')}>
        <StoreInfoGrid
          items={[
            { label: t('storeKpis.storeScope'), value: primaryStoreId ?? t('storeKpis.noOpenStoreScope') },
            { label: t('storeKpis.storeName'), value: activeStoreName },
            {
              label: t('storeKpis.dataView'),
              value: viewMode === 'live' ? t('storeKpis.liveImportedMonthlyData') : t('storeKpis.dailyClosedRecord'),
            },
            { label: t('storeKpis.readScope'), value: t('storeKpis.readScopeValue') },
          ]}
        />
      </StoreSectionCard>

      <StoreSectionCard
        title={t('storeKpis.topSignalTitle')}
        description={t('storeKpis.topSignalEyebrow')}
        badge={{
          label: needsAttention.length === 0 ? t('storeKpis.balanced') : t('storeKpis.watch'),
          tone: needsAttention.length === 0 ? 'calm' : 'warning',
        }}
      >
        {topPerformer ? (
          <StoreStackedList>
            <StoreStackedRow>
              <div className="tw:flex tw:flex-col tw:gap-3 tw:sm:flex-row tw:sm:items-start tw:sm:justify-between">
                <div>
                  <strong className="tw:text-sm tw:text-foreground">{formatKpiMetricLabel(t, topPerformer.kpiCode, topPerformer.kpiName)}</strong>
                  <span className="tw:block tw:text-sm tw:text-muted-foreground">{topPerformer.kpiCode}</span>
                </div>
                <StoreStatusBadge tone="accent">{formatAchievementValue(locale, t, topPerformer)}</StoreStatusBadge>
              </div>
              <p className="tw:mt-2 tw:text-sm tw:leading-6 tw:text-muted-foreground">{t('storeKpis.topSignalCopy')}</p>
            </StoreStackedRow>
          </StoreStackedList>
        ) : (
          <StoreEmptyState title={t('storeKpis.noTopSignalTitle')} description={t('storeKpis.noTopSignalCopy')} />
        )}
      </StoreSectionCard>
    </section>
  )
}

function StoreKpiPartialDataPanel({ model }: { model: StoreKpiHighlightsPageModel }) {
  const { liveSummary, t, viewMode } = model

  if (viewMode !== 'live' || !liveSummary?.partial.isPartial) {
    return null
  }

  return (
    <StoreSectionCard
      title={t('storeKpis.partialTitle')}
      description={t('storeKpis.partialEyebrow')}
      badge={{ label: t('storeKpis.partialData'), tone: 'warning' }}
    >
      <StoreInfoGrid
        items={[
          {
            label: t('storeKpis.missingMetrics'),
            value:
              liveSummary.partial.missingMetricLabels.length > 0
                ? formatMetricLabelList(
                    t,
                    liveSummary.partial.missingMetricCodes,
                    liveSummary.partial.missingMetricLabels,
                  )
                : t('storeKpis.none'),
          },
          {
            label: t('storeKpis.pendingNormalization'),
            value:
              liveSummary.partial.pendingNormalizationLabels.length > 0
                ? formatMetricLabelList(
                    t,
                    liveSummary.partial.pendingNormalizationCodes,
                    liveSummary.partial.pendingNormalizationLabels,
                  )
                : t('storeKpis.none'),
          },
          { label: t('storeKpis.note'), value: t('storeKpis.partialNote') },
        ]}
      />
    </StoreSectionCard>
  )
}

function StoreKpiScoreMeaningPanel({ model }: { model: StoreKpiHighlightsPageModel }) {
  const { locale, storeGrade, storeScoreMeaning, t, weightedScore } = model

  return (
    <StoreSectionCard
      title={t('storeKpis.scoreMeaningEyebrow')}
      description={`${storeScoreMeaning.title}. ${storeScoreMeaning.summary}`}
      badge={{ label: storeGrade.code, tone: storeScoreMeaning.tone }}
    >
      <StoreInfoGrid
        items={[
          { label: t('storeKpis.scoreBand'), value: formatStorePerformanceGrade(t, storeGrade) },
          { label: t('storeKpis.score'), value: formatPercent(locale, weightedScore.scoreValue) },
          { label: t('storeKpis.coveredWeight'), value: `${weightedScore.coveredWeight}%` },
          { label: t('storeKpis.actionLanguage'), value: storeScoreMeaning.action },
        ]}
      />
      <p className="tw:mt-3 tw:text-sm tw:leading-6 tw:text-muted-foreground">{storeScoreMeaning.confidence}</p>
    </StoreSectionCard>
  )
}

function getContributionStatusTone(item: StoreKpiHighlightsPageModel['weightedScore']['contributions'][number]) {
  if (item.matchingRow?.scoreStatus === 'scored') {
    return 'accent'
  }

  if (
    item.matchingRow?.scoreStatus === 'pending_normalization' ||
    item.matchingRow?.scoreStatus === 'missing_reference'
  ) {
    return 'warning'
  }

  return 'neutral'
}

function StoreKpiScoreBreakdownPanel({ model }: { model: StoreKpiHighlightsPageModel }) {
  const {
    locale,
    matchedMetricCount,
    personnelWeightsReady,
    storeGrade,
    storeKpiScoreProfile,
    t,
    weightedScore,
  } = model

  return (
    <StoreSectionCard
      title={t('storeKpis.scoreBreakdown')}
      description={t('storeKpis.storeScoreSummary')}
      badge={{
        label:
          weightedScore.missingWeight === 0
            ? t('storeKpis.complete')
            : t('storeKpis.missingWeightStatus', { weight: weightedScore.missingWeight }),
        tone: weightedScore.missingWeight === 0 ? 'calm' : 'warning',
      }}
    >
      <StoreInfoGrid
        items={[
          { label: t('storeKpis.scoreValueLabel'), value: formatPercent(locale, weightedScore.scoreValue) },
          { label: t('storeKpis.scoreBand'), value: formatStorePerformanceGrade(t, storeGrade) },
          { label: t('storeKpis.coveredWeight'), value: `${weightedScore.coveredWeight}%` },
          { label: t('storeKpis.missingWeight'), value: `${weightedScore.missingWeight}%` },
          { label: t('storeKpis.scoreProfile'), value: formatScoreProfileTitle(t, storeKpiScoreProfile?.title) },
          { label: t('storeKpis.settingsSource'), value: t('storeKpis.publishedLiveConfig') },
          {
            label: t('storeKpis.matchedMetric'),
            value: `${matchedMetricCount}/${weightedScore.contributions.length}`,
          },
          {
            label: t('storeKpis.personnelWeight'),
            value: personnelWeightsReady ? t('storeKpis.ready') : t('storeKpis.weightWaiting'),
          },
        ]}
      />
      <StoreStackedList className="tw:mt-4">
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
            <StoreStackedRow key={item.metric.code}>
              <div className="tw:flex tw:flex-col tw:gap-3 tw:sm:flex-row tw:sm:items-start tw:sm:justify-between">
                <div>
                  <strong className="tw:text-sm tw:text-foreground">
                    {formatKpiMetricLabel(t, item.metric.code, item.metric.label)}
                  </strong>
                  <span className="tw:block tw:text-sm tw:text-muted-foreground">
                    {item.matchingRow ? item.matchingRow.kpiCode : t('storeKpis.kpiRowWaiting')}
                  </span>
                </div>
                <StoreStatusBadge tone={getContributionStatusTone(item)}>
                  {`${item.metric.weightPercent}%`}
                </StoreStatusBadge>
              </div>
              <StoreInfoGrid
                className="tw:mt-3"
                items={[
                  {
                    label: t('storeKpis.scoreTarget'),
                    value: formatMetricValue(locale, t, scoreReference.value, item.matchingRow?.kpiCode),
                  },
                  {
                    label: t('storeKpis.actual'),
                    value: formatMetricValue(
                      locale,
                      t,
                      item.matchingRow?.actualValue ?? null,
                      item.matchingRow?.kpiCode,
                    ),
                  },
                  {
                    label: t('storeKpis.achievement'),
                    value: item.matchingRow ? formatAchievementValue(locale, t, item.matchingRow) : t('storeKpis.noData'),
                  },
                  { label: t('storeKpis.targetSource'), value: scoreReference.sourceLabel },
                  {
                    label: t('storeKpis.weightedContribution'),
                    value: formatPercent(locale, item.weightedContribution),
                  },
                  { label: t('storeKpis.scoreBehavior'), value: formatScoreBehavior(t, item.metric.scoreBehavior) },
                  { label: t('storeKpis.sourceType'), value: sourceSemantics.label },
                  { label: t('storeKpis.dataSource'), value: sourceSemantics.summary },
                ]}
              />
              {item.matchingRow?.isCapped ? (
                <p className="tw:mt-3 tw:text-sm tw:leading-6 tw:text-muted-foreground">
                  {describeLocalizedBenchmarkCap(t, {
                    actualRatio: item.matchingRow.actualRatio,
                    scoredRatio: item.matchingRow.scoredRatio,
                    isCapped: item.matchingRow.isCapped,
                  })}
                </p>
              ) : null}
              {item.matchingRow?.scoreStatus === 'missing_reference' ? (
                <p className="tw:mt-3 tw:text-sm tw:leading-6 tw:text-muted-foreground">
                  {t('storeKpis.missingReferenceReason', {
                    reason: item.matchingRow.missingReason ?? 'reference_missing',
                  })}
                </p>
              ) : null}
            </StoreStackedRow>
          )
        })}
      </StoreStackedList>
    </StoreSectionCard>
  )
}

function StoreKpiOwnershipPanel({ model }: { model: StoreKpiHighlightsPageModel }) {
  const { kpiOwnershipMatrix, t } = model

  return (
    <StoreSectionCard title={t('storeKpis.ownershipTitle')} description={t('storeKpis.ownershipMatrix')}>
      <StoreStackedList>
        {kpiOwnershipMatrix.map((metric) => (
          <StoreStackedRow key={metric.code}>
            <div className="tw:flex tw:flex-col tw:gap-3 tw:sm:flex-row tw:sm:items-start tw:sm:justify-between">
              <div>
                <strong className="tw:text-sm tw:text-foreground">
                  {formatKpiMetricLabel(t, metric.code, metric.label)}
                </strong>
                <span className="tw:block tw:text-sm tw:text-muted-foreground">{metric.code}</span>
              </div>
              <StoreStatusBadge tone={metric.taskCandidate ? 'warning' : 'neutral'}>
                {metric.taskCandidate ? t('storeKpis.taskCandidate') : t('storeKpis.watchFirst')}
              </StoreStatusBadge>
            </div>
            <StoreInfoGrid
              className="tw:mt-3"
              items={[
                { label: t('storeKpis.operationalOwner'), value: formatOwnerRole(t, metric.operationalOwner) },
                {
                  label: t('storeKpis.visibleRoles'),
                  value: metric.visibleTo.map((role) => formatOwnerRole(t, role)).join(', '),
                },
                {
                  label: t('storeKpis.contributionArea'),
                  value: metric.contributesTo.map((item) => formatContributionTarget(t, item)).join(', '),
                },
              ]}
            />
          </StoreStackedRow>
        ))}
      </StoreStackedList>
    </StoreSectionCard>
  )
}

function StoreKpiPriorityPanel({ model }: { model: StoreKpiHighlightsPageModel }) {
  const { locale, needsAttention, t } = model

  return (
    <StoreSectionCard title={t('storeKpis.priorityTitle')} description={t('storeKpis.priorityEyebrow')}>
      {needsAttention.length === 0 ? (
        <StoreEmptyState title={t('storeKpis.noRiskTitle')} description={t('storeKpis.noRiskCopy')} />
      ) : (
        <StoreStackedList>
          {needsAttention.map((row) => {
            const sourceSemantics = resolveLocalizedKpiSourceSemantics(t, {
              code: row.kpiCode,
              actualValue: row.actualValue,
              scoreStatus: row.scoreStatus,
            })

            return (
              <StoreStackedRow key={`${row.storeId}:${row.kpiCode}`}>
                <div className="tw:flex tw:flex-col tw:gap-3 tw:sm:flex-row tw:sm:items-start tw:sm:justify-between">
                  <div>
                    <strong className="tw:text-sm tw:text-foreground">
                      {formatKpiMetricLabel(t, row.kpiCode, row.kpiName)}
                    </strong>
                    <span className="tw:block tw:text-sm tw:text-muted-foreground">{row.kpiCode}</span>
                  </div>
                  <StoreStatusBadge tone={row.statusBand === 'off_track' ? 'danger' : 'warning'}>
                    {formatStatusBand(t, row.statusBand)}
                  </StoreStatusBadge>
                </div>
                <StoreInfoGrid
                  className="tw:mt-3"
                  items={[
                    {
                      label: t('storeKpis.scoreTarget'),
                      value: formatMetricValue(locale, t, row.targetValue, row.kpiCode),
                    },
                    { label: t('storeKpis.actual'), value: formatMetricValue(locale, t, row.actualValue, row.kpiCode) },
                    { label: t('storeKpis.achievement'), value: formatAchievementValue(locale, t, row) },
                    {
                      label: t('storeKpis.period'),
                      value: `${formatDate(row.periodStart, locale)} - ${formatDate(row.periodEnd, locale)}`,
                    },
                    { label: t('storeKpis.sourceType'), value: sourceSemantics.label },
                    { label: t('storeKpis.dataSource'), value: sourceSemantics.summary },
                  ]}
                />
              </StoreStackedRow>
            )
          })}
        </StoreStackedList>
      )}
    </StoreSectionCard>
  )
}
