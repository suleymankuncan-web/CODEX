import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { AuthSessionSummary } from '../features/auth/api'
import { useLocalization } from '../features/localization/useLocalization'
import {
  getKpiConfig,
  getKpiReport,
  getReportingSnapshotRuns,
  getStoreScoreBreakdown,
  getStoreKpiHighlights,
} from '../features/reports/api'
import { formatDate } from '../lib/format'
import { ApiError } from '../lib/api'
import { transientQueryRetryOptions } from '../lib/query-retry'
import { matchesKpiMetricCode } from '../features/kpi/score-profiles'
import { resolvePerformanceGrade } from '../features/kpi/grading'
import { toKpiDisplayNumber as toNumber } from '../features/kpi/display'
import {
  formatChecklistContribution,
  formatChecklistMissingNote,
  formatChecklistStatus,
  resolveLocalizedStoreScoreMeaning,
} from './store-kpi-highlights-formatters'
import { resolveLiveChecklistImpact } from './store-kpi-checklist-impact'
import { useRegionOverviewPeriodModel } from './store-kpis-region-period-model'
import { useReportViewerStoreSelection } from './store-kpi-company-selection'
import { sortKpiStoreRows } from './store-kpis-command-contract'
import { useStoreKpisOverviewQueries } from './store-kpis-overview-queries'
import {
  getQueryValue,
  hasGlobalStoreDetailDefault,
  hasReportingAccess,
  hasStoreDetailDefault,
  hasStoreShellIntent,
} from './store-kpi-highlights-access'
export { resolveCompanyStoreSelection, type StoreKpiStoreOption } from './store-kpi-company-selection'
export {
  describeLocalizedBenchmarkCap,
  formatAchievementValue,
  formatContributionTarget,
  formatKpiMetricLabel,
  formatMetricLabelList,
  formatMetricValue,
  formatOwnerRole,
  formatScoreBehavior,
  formatScoreProfileTitle,
  formatStatusBand,
  formatStorePerformanceGrade,
  resolveLocalizedKpiScoreReference,
  resolveLocalizedKpiSourceSemantics,
} from './store-kpi-highlights-formatters'

export type DisplayKpiRow = {
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

export type StoreKpisRegionSortKey = 'score' | 'TARGET_ACHIEVEMENT' | 'UPT' | 'ATV' | 'CR' | 'gsm_approval' | 'BM_CHECKLIST' | 'VM_CHECKLIST'

export type StoreKpisRegionSortDirection = 'asc' | 'desc'

function clampScore(input: number) {
  if (!Number.isFinite(input)) {
    return 0
  }

  return Math.max(0, Math.min(input, 1.2))
}

export function useStoreKpiHighlightsPageModel(input: { authSummary: AuthSessionSummary | null }) {
  const { locale, t } = useLocalization()
  const [searchParams, setSearchParams] = useSearchParams()
  const reportingAllowed = hasReportingAccess(input.authSummary)
  const primaryStoreId = input.authSummary?.user.scope.storeIds[0] ?? undefined
  const storeShellIntent = hasStoreShellIntent(input.authSummary)
  const storeSelection = useReportViewerStoreSelection({
    authSummary: input.authSummary,
    primaryStoreId,
    reportingAllowed,
    searchParams,
    setSearchParams,
  })
  const { companyStoreQuery, effectiveStoreId, isReportViewer, selectedStoreId, storeOptions, storeSelectionReady } = storeSelection
  const routePeriodStart = getQueryValue(searchParams, 'periodStart')
  const isReportViewerOverview = isReportViewer && selectedStoreId.length === 0
  const isReportViewerStoreDetail = isReportViewer && selectedStoreId.length > 0
  const hasRegionManagerRole = input.authSummary?.user.roleCodes.includes('REGION_MANAGER') ?? false
  const regionManagerUserId = input.authSummary?.user.userId ?? ''
  const hasDetailDefault = hasStoreDetailDefault(input.authSummary)
  const hasGlobalDetailDefault = hasGlobalStoreDetailDefault(input.authSummary)
  const isRegionManagerOverview = hasRegionManagerRole && !hasGlobalDetailDefault && selectedStoreId.length === 0
  const isRegionManagerStoreDetail = hasRegionManagerRole && selectedStoreId.length > 0
  const storeKpiSurfaceMode = isRegionManagerOverview
    ? 'regionOverview'
    : isRegionManagerStoreDetail ? 'regionStoreDetail' : 'storeDetail'
  const [viewModeState, setViewModeState] = useState<'live' | 'closed'>('live')
  const [selectedSnapshotRunId, setSelectedSnapshotRunId] = useState('')
  const [livePeriodStart, setLivePeriodStart] = useState('')
  const closedSnapshotModeAllowed =
    hasDetailDefault && (!hasRegionManagerRole || hasGlobalDetailDefault) && !isRegionManagerOverview
  const viewMode = closedSnapshotModeAllowed ? viewModeState : 'live'
  const setViewMode = (value: 'live' | 'closed') => {
    if (value !== 'closed' || closedSnapshotModeAllowed) setViewModeState(value)
  }
  const activeLivePeriodStart = livePeriodStart || routePeriodStart
  const setLivePeriodFilter = (value: string) => {
    setLivePeriodStart(value)
    const nextParams = new URLSearchParams(searchParams)
    if (value) {
      nextParams.set('periodStart', value)
    } else {
      nextParams.delete('periodStart')
    }
    setSearchParams(nextParams, { replace: true })
  }
  const regionPeriodModel = useRegionOverviewPeriodModel({
    isRegionManagerOverview,
    regionManagerUserId,
    reportingAllowed,
    routePeriodStart,
    searchParams,
    setSearchParams,
  })
  const {
    activeRegionOverviewPeriodStart,
    activeReportViewerPeriodStart,
    effectiveRegionOverviewQuery,
    regionOverviewPage,
    regionOverviewPageSize,
    regionOverviewSort,
    reportViewerOverviewQuery,
    reportViewerPage,
    reportViewerPageSize,
    reportViewerRiskOnly,
    reportViewerRiskPage,
    setRegionOverviewPage,
    setRegionOverviewPeriodStart,
    setRegionOverviewSort,
    setReportViewerPage,
    setReportViewerPeriodStart,
    setReportViewerRiskOnly,
    setReportViewerRiskPage,
  } = useStoreKpisOverviewQueries({
    activeRoutePeriodStart: routePeriodStart,
    isRegionManagerOverview,
    isReportViewerOverview,
    regionManagerUserId,
    regionPeriodModel,
    reportingAllowed,
    searchParams,
    setSearchParams,
  })

  const configQuery = useQuery({
    queryKey: ['store-kpi-config'],
    queryFn: getKpiConfig,
    enabled: Boolean(input.authSummary),
    ...transientQueryRetryOptions,
  })

  const liveKpiQuery = useQuery({
    queryKey: ['store-kpis-live', effectiveStoreId || 'no-selected-store', activeLivePeriodStart || 'latest-monthly'],
    queryFn: () =>
      getStoreKpiHighlights({
        periodType: 'monthly',
        ...(activeLivePeriodStart ? { periodStart: activeLivePeriodStart } : {}),
        ...(effectiveStoreId ? { storeId: effectiveStoreId } : {}),
      }),
    enabled:
      reportingAllowed &&
      viewMode === 'live' &&
      !isRegionManagerOverview &&
      storeSelectionReady &&
      Boolean(effectiveStoreId),
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
    enabled: reportingAllowed && viewMode === 'closed' && !isRegionManagerOverview,
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
    queryKey: ['store-score-breakdown', snapshotRunId || 'no-run', effectiveStoreId ?? 'no-store'],
    queryFn: () =>
      getStoreScoreBreakdown({
        snapshotRunId,
        storeId: effectiveStoreId ?? '',
      }),
    enabled:
      reportingAllowed &&
      viewMode === 'closed' &&
      Boolean(snapshotRunId) &&
      Boolean(effectiveStoreId) &&
      !isRegionManagerOverview,
    ...transientQueryRetryOptions,
  })

  const liveRows = useMemo<DisplayKpiRow[]>(() => {
    return (
      liveKpiQuery.data?.metrics.map((metric) => ({
        storeId: liveKpiQuery.data?.store?.storeId ?? effectiveStoreId ?? '',
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
  }, [effectiveStoreId, liveKpiQuery.data])

  const closedRows = useMemo<DisplayKpiRow[]>(() => {
    const allRows = closedKpiQuery.data?.items ?? []
    const filteredRows = effectiveStoreId
      ? allRows.filter((row) => row.storeId === effectiveStoreId)
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
  }, [closedKpiQuery.data?.items, effectiveStoreId])

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
            ? null
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
      (total, item) => total + (item.weightedContribution ?? 0),
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
    (isReportViewerStoreDetail && companyStoreQuery.isLoading) ||
    (isReportViewerOverview && reportViewerOverviewQuery.isLoading) ||
    (isRegionManagerOverview
      ? effectiveRegionOverviewQuery.isLoading
      : viewMode === 'live'
        ? liveKpiQuery.isLoading
        : dailySnapshotQuery.isLoading || closedKpiQuery.isLoading)
  const liveSummary = liveKpiQuery.data
  const closedStoreName = closedKpiQuery.data?.items.find((row) => row.storeName)?.storeName ?? null
  const activeStoreName =
    viewMode === 'live'
      ? liveSummary?.store?.storeName ?? t('storeKpis.noStoreScope')
      : closedStoreName ?? t('storeKpis.noStoreScope')
  const latestLivePeriodLabel =
    liveSummary?.period
      ? `${formatDate(liveSummary.period.periodStart, locale)} - ${formatDate(liveSummary.period.periodEnd, locale)} (${t('storeKpis.latestMonthlyPeriod')})`
      : t('storeKpis.latestMonthlyPeriod')
  const regionOverviewRows = useMemo(
    () => sortKpiStoreRows(
      effectiveRegionOverviewQuery.data?.storeLeaderboard.items ?? [],
      regionOverviewSort.sortKey,
      regionOverviewSort.sortDirection,
    ),
    [effectiveRegionOverviewQuery.data?.storeLeaderboard.items, regionOverviewSort],
  )
  const regionOverviewSource = effectiveRegionOverviewQuery.data?.source ?? null
  const regionOverviewPeriodStart =
    activeRegionOverviewPeriodStart ?? regionOverviewSource?.periodStart ?? routePeriodStart
  const getRegionStoreDetailPath = (storeId: string) => {
    const params = new URLSearchParams({ storeId })
    if (regionOverviewPeriodStart) {
      params.set('periodStart', regionOverviewPeriodStart)
    }

    return `/store/kpis?${params.toString()}`
  }
  const getCompanyStoreDetailPath = (storeId: string) => {
    const params = new URLSearchParams({ storeId })
    const periodStart = activeReportViewerPeriodStart || reportViewerOverviewQuery.data?.source.periodStart
    if (periodStart) params.set('periodStart', periodStart)
    return `/store/kpis?${params.toString()}`
  }

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
    closedSnapshotModeAllowed,
    configForbidden,
    configQuery,
    companyStoreQuery,
    dailySnapshotQuery,
    effectiveStoreId,
    getCompanyStoreDetailPath,
    getRegionStoreDetailPath,
    isLoading,
    isReportViewer,
    isReportViewerOverview,
    isReportViewerStoreDetail,
    isRegionManagerOverview,
    isRegionManagerStoreDetail,
    kpiOwnershipMatrix,
    latestLivePeriodLabel,
    liveKpiQuery,
    livePeriodStart: activeLivePeriodStart,
    liveSummary,
    locale,
    matchedMetricCount,
    needsAttention,
    personnelWeightsReady,
    personnelKpiScoreProfile,
    primaryStoreId,
    reportingAllowed,
    reportViewerActivePeriodStart: activeReportViewerPeriodStart,
    reportViewerOverviewQuery,
    reportViewerPage,
    reportViewerPageSize,
    reportViewerRiskOnly,
    reportViewerRiskPage,
    regionOverviewActivePeriodStart: activeRegionOverviewPeriodStart,
    regionOverviewPage,
    regionOverviewPageSize,
    regionOverviewQuery: effectiveRegionOverviewQuery,
    regionOverviewRows,
    regionOverviewSeedQuery: regionPeriodModel.seedQuery,
    regionOverviewSort,
    routePeriodStart,
    rows,
    selectedSnapshotRunId,
    selectedStoreId,
    setSelectedStoreId: storeSelection.setSelectedStoreId,
    setLivePeriodStart: setLivePeriodFilter,
    setRegionOverviewPage,
    setRegionOverviewPeriodStart,
    setRegionOverviewSort,
    setReportViewerPage,
    setReportViewerPeriodStart,
    setReportViewerRiskOnly,
    setReportViewerRiskPage,
    setSelectedSnapshotRunId,
    setViewMode,
    storeGrade,
    storeKpiScoreProfile,
    storeKpiSurfaceMode,
    storeScoreMeaning,
    storeShellIntent,
    storeOptions,
    storeSelectionReady,
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

export type StoreKpiHighlightsPageModel = ReturnType<typeof useStoreKpiHighlightsPageModel>
