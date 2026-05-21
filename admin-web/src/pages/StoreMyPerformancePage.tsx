import { useQueries, useQuery } from '@tanstack/react-query'
import { useEffect, useReducer } from 'react'
import { ScreenState } from '../components/dashboard-primitives'
import type { AuthSessionSummary } from '../features/auth/api'
import type { TranslateFunction } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import {
  getKpiConfig,
  getMyPerformance,
  getPersonnelPerformance,
  getReportingSnapshotRuns,
  type MyPerformanceQueryInput,
} from '../features/reports/api'
import { getErrorMessage } from '../lib/format'
import { ApiError } from '../lib/api'
import { transientQueryRetryOptions } from '../lib/query-retry'
import {
  buildStoreMyPerformanceViewModel,
  createStoreMyPerformancePageState,
  createStoreMyPerformancePeriodHandlers,
  getPeriodDateKey,
  storeMyPerformancePageReducer,
  useStoreMyPerformancePeriodModel,
  type LivePeriodType,
  type StorePerformanceSourceMode,
} from './store-my-performance-model'
import {
  StoreMyPerformanceDateFilter,
  StoreMyPerformanceHeroPanel,
  StoreMyPerformanceKpiDialog,
  StoreMyPerformanceLowerGrid,
  StoreMyPerformanceMetricGrid,
  StoreMyPerformanceMobileDock,
  StoreMyPerformancePartialAlert,
  StoreMyPerformanceRail,
  StoreMyPerformanceScorePanel,
  StoreMyPerformanceTopbar,
} from './store-my-performance-sections'

function canUseSelfPerformance(authSummary: AuthSessionSummary | null) {
  const roles = authSummary?.user.roleCodes ?? []
  return roles.includes('STORE_PERSONNEL') || roles.includes('STORE_MANAGER')
}

function canUsePersonnelPerformance(authSummary: AuthSessionSummary | null) {
  const roles = authSummary?.user.roleCodes ?? []
  return (
    roles.includes('STORE_PERSONNEL') ||
    roles.includes('STORE_MANAGER') ||
    roles.includes('REGION_MANAGER') ||
    roles.includes('SUPER_ADMIN')
  )
}

type StoreMyPerformanceViewModel = ReturnType<typeof buildStoreMyPerformanceViewModel>
type StoreMyPerformancePeriodHandlers = ReturnType<typeof createStoreMyPerformancePeriodHandlers>

type StoreMyPerformancePageExperienceProps = {
  activeClosedSnapshotRunId: string
  isDateFilterOpen: boolean
  isKpiDetailOpen: boolean
  onCloseKpiDetails: () => void
  onOpenKpiDetails: () => void
  onSelectClosedSnapshotRun: (snapshotRunId: string) => void
  onSelectSourceMode: (mode: StorePerformanceSourceMode) => void
  onToggleDateFilter: () => void
  periodHandlers: StoreMyPerformancePeriodHandlers
  performanceEmployeeName: string
  selectedClosedSnapshotRunId: string
  selectedLivePeriodType: LivePeriodType
  showInternalRail: boolean
  sourceMode: StorePerformanceSourceMode
  t: TranslateFunction
  usesClosedSnapshotMode: boolean
  viewModel: StoreMyPerformanceViewModel
}

export function StoreMyPerformancePage(input: {
  authSummary: AuthSessionSummary | null
  employeeId?: string
  initialLivePeriodStart?: string
  initialLivePeriodType?: LivePeriodType
  profileMode?: 'self' | 'personnel'
  showInternalRail?: boolean
}) {
  const { locale, t } = useLocalization()
  const profileMode = input.profileMode ?? 'self'
  const showInternalRail = input.showInternalRail ?? true
  const targetEmployeeId = input.employeeId?.trim() ?? ''
  const enabled =
    profileMode === 'personnel'
      ? canUsePersonnelPerformance(input.authSummary) && targetEmployeeId !== ''
      : canUseSelfPerformance(input.authSummary)
  const [state, dispatch] = useReducer(
    storeMyPerformancePageReducer,
    {
      ...(input.initialLivePeriodStart === undefined
        ? {}
        : { initialLivePeriodStart: input.initialLivePeriodStart }),
      ...(input.initialLivePeriodType === undefined
        ? {}
        : { initialLivePeriodType: input.initialLivePeriodType }),
    },
    createStoreMyPerformancePageState,
  )
  const {
    sourceMode,
    selectedLivePeriodType,
    selectedLivePeriodStart,
    selectedLiveYears,
    selectedLiveMonthKeys,
    selectedLiveDayStarts,
    selectedClosedSnapshotRunId,
    isDateFilterOpen,
    isKpiDetailOpen,
  } = state
  const usesClosedSnapshotMode = profileMode !== 'personnel'
  const queryPrefix = profileMode === 'personnel'
    ? ['personnel-performance', targetEmployeeId] as const
    : ['my-performance'] as const
  const fetchPerformance = (queryInput: MyPerformanceQueryInput) =>
    profileMode === 'personnel'
      ? getPersonnelPerformance(targetEmployeeId, queryInput)
      : getMyPerformance(queryInput)

  const configQuery = useQuery({
    queryKey: ['store-me-kpi-config'],
    queryFn: getKpiConfig,
    enabled,
    ...transientQueryRetryOptions,
  })

  const closedRunsQuery = useQuery({
    queryKey: ['store-me-closed-snapshot-runs'],
    queryFn: () =>
      getReportingSnapshotRuns({
        snapshotType: 'daily',
        limit: 30,
        offset: 0,
      }),
    enabled: enabled && usesClosedSnapshotMode && sourceMode === 'closed',
    ...transientQueryRetryOptions,
  })

  const availableClosedSnapshotRuns = closedRunsQuery.data?.items ?? []
  const activeClosedSnapshotRun =
    availableClosedSnapshotRuns.find(
      (run) => run.snapshotRunId === selectedClosedSnapshotRunId,
    ) ??
    availableClosedSnapshotRuns[0] ??
    null
  const selectedClosedSnapshotDate = usesClosedSnapshotMode ? activeClosedSnapshotRun?.snapshotDate ?? '' : ''

  const performanceQuery = useQuery({
    queryKey: [
      ...queryPrefix,
      sourceMode,
      selectedLivePeriodType,
      selectedLivePeriodStart,
      selectedClosedSnapshotDate,
    ],
    queryFn: () =>
      fetchPerformance({
        mode: sourceMode,
        ...(sourceMode === 'live' ? { periodType: selectedLivePeriodType } : {}),
        ...(sourceMode === 'live' && selectedLivePeriodStart
          ? { periodStart: selectedLivePeriodStart }
          : {}),
        ...(sourceMode === 'closed' && selectedClosedSnapshotDate
          ? { snapshotDate: selectedClosedSnapshotDate }
          : {}),
      }),
    enabled: enabled && (sourceMode === 'live' || !usesClosedSnapshotMode || !closedRunsQuery.isLoading),
    ...transientQueryRetryOptions,
  })

  const performance = performanceQuery.data
  const periodModel = useStoreMyPerformancePeriodModel({
    performance,
    performanceQueryIsSuccess: performanceQuery.isSuccess,
    selectedLiveDayStarts,
    selectedLiveMonthKeys,
    selectedLivePeriodStart,
    selectedLivePeriodType,
    selectedLiveYears,
    sourceMode,
  })

  const monthlyPerformanceQueries = useQueries({
    queries: periodModel.monthlyDetailPeriods.map((period) => ({
      queryKey: [
        ...queryPrefix,
        'live',
        period.periodType,
        getPeriodDateKey(period.periodStart) || period.periodStart,
        '',
      ],
      queryFn: () =>
        fetchPerformance({
          mode: 'live',
          periodType: period.periodType === 'daily' ? 'daily' : 'monthly',
          periodStart: getPeriodDateKey(period.periodStart) || period.periodStart,
        }),
      enabled: enabled && sourceMode === 'live' && performanceQuery.isSuccess,
      ...transientQueryRetryOptions,
    })),
  })

  useEffect(() => {
    if (!periodModel.livePeriodFallbackStart || periodModel.livePeriodFallbackStart === selectedLivePeriodStart) {
      return undefined
    }

    const fallbackTimer = window.setTimeout(() => {
      dispatch({
        type: 'applyLivePeriodFallback',
        periodType: periodModel.livePeriodFallbackType,
        periodStart: periodModel.livePeriodFallbackStart,
      })
    }, 0)

    return () => window.clearTimeout(fallbackTimer)
  }, [periodModel.livePeriodFallbackStart, periodModel.livePeriodFallbackType, selectedLivePeriodStart])

  useEffect(() => {
    if (!isKpiDetailOpen) {
      return undefined
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        dispatch({ type: 'setKpiDetailOpen', open: false })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isKpiDetailOpen])

  const periodHandlers = createStoreMyPerformancePeriodHandlers({
    availableDailyPeriods: periodModel.availableDailyPeriods,
    availableLiveMonthOptions: periodModel.availableLiveMonthOptions,
    availableLiveYearOptions: periodModel.availableLiveYearOptions,
    availableMonthlyPeriods: periodModel.availableMonthlyPeriods,
    dispatch,
    scopedAvailableDailyPeriods: periodModel.scopedAvailableDailyPeriods,
    selectedLiveDayStarts,
    selectedLiveMonthKeys,
    selectedLivePeriodType,
    selectedLiveYears,
  })

  if (!enabled) {
    return (
      <ScreenState
        title={
          profileMode === 'personnel'
            ? t('storeMe.personnelProfileUnavailableTitle')
            : t('storeMe.unavailableTitle')
        }
        copy={
          profileMode === 'personnel'
            ? t('storeMe.personnelProfileUnavailableCopy')
            : t('storeMe.unavailableCopy')
        }
        tone="error"
      />
    )
  }

  const configForbidden = configQuery.error instanceof ApiError && configQuery.error.status === 403

  if (
    performanceQuery.isLoading ||
    (configQuery.isLoading && !configForbidden) ||
    (usesClosedSnapshotMode && sourceMode === 'closed' && closedRunsQuery.isLoading)
  ) {
    return (
      <ScreenState
        title={t('storeMe.loadingTitle')}
        copy={t('storeMe.loadingCopy')}
      />
    )
  }

  if (
    performanceQuery.isError ||
    (configQuery.isError && !configForbidden) ||
    (usesClosedSnapshotMode && sourceMode === 'closed' && closedRunsQuery.isError)
  ) {
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

  const viewModel = buildStoreMyPerformanceViewModel({
    availableClosedSnapshotRuns,
    availableLiveMonthOptions: periodModel.availableLiveMonthOptions,
    availableLivePeriods: periodModel.availableLivePeriods,
    availableLiveYearOptions: periodModel.availableLiveYearOptions,
    effectiveSelectedLivePeriods: periodModel.effectiveSelectedLivePeriods,
    gradingBands: configQuery.data?.gradingBands,
    locale,
    monthlyDetailPeriods: periodModel.monthlyDetailPeriods,
    monthlyPerformanceData: monthlyPerformanceQueries.map((query) => query.data),
    performance,
    profileMode,
    scopedAvailableDailyPeriods: periodModel.scopedAvailableDailyPeriods,
    selectedLiveDayStarts,
    selectedLiveMonthKeys,
    selectedLiveYears,
    sourceMode,
    t,
  })

  return (
    <StoreMyPerformancePageExperience
      activeClosedSnapshotRunId={activeClosedSnapshotRun?.snapshotRunId ?? ''}
      isDateFilterOpen={isDateFilterOpen}
      isKpiDetailOpen={isKpiDetailOpen}
      onCloseKpiDetails={() => dispatch({ type: 'setKpiDetailOpen', open: false })}
      onOpenKpiDetails={() => dispatch({ type: 'setKpiDetailOpen', open: true })}
      onSelectClosedSnapshotRun={(snapshotRunId) =>
        dispatch({ type: 'setClosedSnapshotRunId', snapshotRunId })
      }
      onSelectSourceMode={(mode) => dispatch({ type: 'setSourceMode', mode })}
      onToggleDateFilter={() => dispatch({ type: 'toggleDateFilter' })}
      periodHandlers={periodHandlers}
      performanceEmployeeName={performance.employee.displayName}
      selectedClosedSnapshotRunId={selectedClosedSnapshotRunId}
      selectedLivePeriodType={selectedLivePeriodType}
      showInternalRail={showInternalRail}
      sourceMode={sourceMode}
      t={t}
      usesClosedSnapshotMode={usesClosedSnapshotMode}
      viewModel={viewModel}
    />
  )
}

function StoreMyPerformancePageExperience({
  activeClosedSnapshotRunId,
  isDateFilterOpen,
  isKpiDetailOpen,
  onCloseKpiDetails,
  onOpenKpiDetails,
  onSelectClosedSnapshotRun,
  onSelectSourceMode,
  onToggleDateFilter,
  periodHandlers,
  performanceEmployeeName,
  selectedClosedSnapshotRunId,
  selectedLivePeriodType,
  showInternalRail,
  sourceMode,
  t,
  usesClosedSnapshotMode,
  viewModel,
}: StoreMyPerformancePageExperienceProps) {
  const {
    actualSalesLabel,
    closedSnapshotRunOptions,
    dataQualityLabel,
    employeeHeading,
    gradeLabel,
    introCopy,
    liveDayFilterOptions,
    liveMonthFilterOptions,
    liveYearFilterOptions,
    loadedPeriodCount,
    metricCards,
    monthlyDetailRows,
    partial,
    periodLabel,
    pendingNormalizationLabels,
    remainingTargetLabel,
    samePeriodMetrics,
    samePeriodScoreDelta,
    scoreDeltaLabel,
    scoreMeaning,
    scoreValue,
    selectedPeriodLabel,
    storePopulationLabel,
    storeRankLabel,
    targetProgressPercent,
    targetSalesLabel,
    targetStatusLabel,
    trendPoints,
    turkeyPopulationLabel,
    turkeyRankLabel,
  } = viewModel

  return (
    <section
      className={`store-me-v2-page${showInternalRail ? '' : ' store-me-v2-page-shell-owned'}`}
      aria-label={t('storeMe.title')}
    >
      {showInternalRail ? <StoreMyPerformanceRail t={t} /> : null}

      <main className="store-me-v2-main">
        <section className="store-me-v2-content" aria-label={t('storeMe.title')}>
          <StoreMyPerformanceTopbar
            employeeHeading={employeeHeading}
            introCopy={introCopy}
            periodLabel={periodLabel}
            t={t}
          />

          <StoreMyPerformanceDateFilter
            activeClosedSnapshotRunId={activeClosedSnapshotRunId}
            availableClosedSnapshotRuns={closedSnapshotRunOptions}
            availableLiveMonthOptions={liveMonthFilterOptions}
            availableLiveYearOptions={liveYearFilterOptions}
            dataQualityLabel={dataQualityLabel}
            isDateFilterOpen={isDateFilterOpen}
            isPartial={partial.isPartial}
            loadedPeriodCount={loadedPeriodCount}
            onChangeLivePeriodType={periodHandlers.changeLivePeriodType}
            onSelectClosedSnapshotRun={onSelectClosedSnapshotRun}
            onSelectSourceMode={onSelectSourceMode}
            onToggleDateFilter={onToggleDateFilter}
            onToggleLiveDay={periodHandlers.toggleLiveDaySelection}
            onToggleLiveMonth={periodHandlers.toggleLiveMonthSelection}
            onToggleLiveYear={periodHandlers.toggleLiveYearSelection}
            scopedAvailableDailyPeriods={liveDayFilterOptions}
            selectedClosedSnapshotRunId={selectedClosedSnapshotRunId}
            selectedLivePeriodType={selectedLivePeriodType}
            selectedPeriodLabel={selectedPeriodLabel}
            sourceMode={sourceMode}
            t={t}
            usesClosedSnapshotMode={usesClosedSnapshotMode}
          />

          <div className="store-me-v2-layout">
            <StoreMyPerformanceScorePanel
              gradeLabel={gradeLabel}
              isPartial={partial.isPartial}
              scoreConfidence={scoreMeaning.confidence}
              scoreDeltaLabel={scoreDeltaLabel}
              scoreFocus={scoreMeaning.focus}
              scoreValue={scoreValue}
              storePopulationLabel={storePopulationLabel}
              storeRankLabel={storeRankLabel}
              t={t}
              turkeyPopulationLabel={turkeyPopulationLabel}
              turkeyRankLabel={turkeyRankLabel}
            />

            <section className="store-me-v2-workspace">
              <StoreMyPerformanceHeroPanel
                actualSalesLabel={actualSalesLabel}
                onOpenKpiDetails={onOpenKpiDetails}
                remainingTargetLabel={remainingTargetLabel}
                samePeriodMetrics={samePeriodMetrics}
                samePeriodScoreDelta={samePeriodScoreDelta}
                scoreSummary={scoreMeaning.summary}
                t={t}
                targetProgressPercent={targetProgressPercent}
                targetSalesLabel={targetSalesLabel}
                targetStatusLabel={targetStatusLabel}
              />

              <StoreMyPerformancePartialAlert
                isPartial={partial.isPartial}
                missingMetricLabels={partial.missingMetricLabels}
                pendingNormalizationLabels={pendingNormalizationLabels}
                t={t}
              />

              <StoreMyPerformanceMetricGrid
                metricCards={metricCards}
                storeRankLabel={storeRankLabel}
                t={t}
                turkeyRankLabel={turkeyRankLabel}
              />

              <StoreMyPerformanceLowerGrid
                samePeriodScoreDelta={samePeriodScoreDelta}
                t={t}
                trendPoints={trendPoints}
              />
            </section>
          </div>
        </section>
      </main>

      <StoreMyPerformanceKpiDialog
        employeeName={performanceEmployeeName}
        isOpen={isKpiDetailOpen}
        monthlyDetailRows={monthlyDetailRows}
        onClose={onCloseKpiDetails}
        t={t}
      />

      <StoreMyPerformanceMobileDock t={t} />
    </section>
  )
}
