import { useQueries, useQuery } from '@tanstack/react-query'
import { useEffect, useReducer } from 'react'
import type { AuthSessionSummary } from '../features/auth/api'
import {
  getMySalesTargetIncentives,
  mySalesTargetIncentivesQueryKey,
  type SalesTargetIncentiveProjection,
} from '../features/incentives/api'
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
  StoreMyPerformanceKpiDialog,
  StoreMyPerformancePartialAlert,
  StoreMyPerformanceTopbar,
} from './store-my-performance-sections'
import { StoreMyPerformancePlumDashboard } from './store-my-performance-plum-dashboard'
import { StoreMeIncentiveCard } from './store-incentives-widgets'
import {
  StoreErrorState,
  StoreLoadingState,
  StoreSurfacePage,
} from './store-surface-primitives'

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

function canUseOwnIncentiveProjection(authSummary: AuthSessionSummary | null) {
  return authSummary?.user.roleCodes.includes('STORE_PERSONNEL') ?? false
}

type StoreMyPerformanceViewModel = ReturnType<typeof buildStoreMyPerformanceViewModel>
type StoreMyPerformancePeriodHandlers = ReturnType<typeof createStoreMyPerformancePeriodHandlers>

type StoreMyPerformancePageExperienceProps = {
  activeClosedSnapshotRunId: string
  isDateFilterOpen: boolean
  isKpiDetailOpen: boolean
  locale: ReturnType<typeof useLocalization>['locale']
  onCloseKpiDetails: () => void
  onOpenKpiDetails: () => void
  onSelectClosedSnapshotRun: (snapshotRunId: string) => void
  onSelectSourceMode: (mode: StorePerformanceSourceMode) => void
  onToggleDateFilter: () => void
  periodHandlers: StoreMyPerformancePeriodHandlers
  performanceEmployeeName: string
  incentiveProjection: SalesTargetIncentiveProjection | null
  selectedClosedSnapshotRunId: string
  selectedLivePeriodType: LivePeriodType
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
}) {
  const { locale, t } = useLocalization()
  const profileMode = input.profileMode ?? 'self'
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

  const incentiveQuery = useQuery({
    queryKey: mySalesTargetIncentivesQueryKey(),
    queryFn: () => getMySalesTargetIncentives(),
    enabled: profileMode === 'self' && canUseOwnIncentiveProjection(input.authSummary),
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
    const unavailableTitle =
      profileMode === 'personnel'
        ? t('storeMe.personnelProfileUnavailableTitle')
        : t('storeMe.unavailableTitle')
    const unavailableCopy =
      profileMode === 'personnel'
        ? t('storeMe.personnelProfileUnavailableCopy')
        : t('storeMe.unavailableCopy')

    return (
      <StoreSurfacePage ariaLabel={unavailableTitle}>
        <StoreErrorState
          title={unavailableTitle}
          description={unavailableCopy}
        />
      </StoreSurfacePage>
    )
  }

  const configForbidden = configQuery.error instanceof ApiError && configQuery.error.status === 403

  if (
    performanceQuery.isLoading ||
    (configQuery.isLoading && !configForbidden) ||
    (usesClosedSnapshotMode && sourceMode === 'closed' && closedRunsQuery.isLoading)
  ) {
    return (
      <StoreLoadingState
        title={t('storeMe.loadingTitle')}
        description={t('storeMe.loadingCopy')}
      />
    )
  }

  if (
    performanceQuery.isError ||
    (configQuery.isError && !configForbidden) ||
    (usesClosedSnapshotMode && sourceMode === 'closed' && closedRunsQuery.isError)
  ) {
    return (
      <StoreSurfacePage ariaLabel={t('storeMe.errorTitle')}>
        <StoreErrorState
          title={t('storeMe.errorTitle')}
          description={getErrorMessage(performanceQuery.error ?? configQuery.error ?? closedRunsQuery.error)}
        />
      </StoreSurfacePage>
    )
  }

  if (!performance?.employee) {
    return (
      <StoreSurfacePage ariaLabel={t('storeMe.errorTitle')}>
        <StoreErrorState
          title={t('storeMe.errorTitle')}
          description={t('storeMe.noEmployeeCopy')}
        />
      </StoreSurfacePage>
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
  const incentiveProjection =
    incentiveQuery.isSuccess
      ? (incentiveQuery.data.data.projections[0] ?? null)
      : null

  return (
    <StoreMyPerformancePageExperience
      activeClosedSnapshotRunId={activeClosedSnapshotRun?.snapshotRunId ?? ''}
      isDateFilterOpen={isDateFilterOpen}
      isKpiDetailOpen={isKpiDetailOpen}
      locale={locale}
      onCloseKpiDetails={() => dispatch({ type: 'setKpiDetailOpen', open: false })}
      onOpenKpiDetails={() => dispatch({ type: 'setKpiDetailOpen', open: true })}
      onSelectClosedSnapshotRun={(snapshotRunId) =>
        dispatch({ type: 'setClosedSnapshotRunId', snapshotRunId })
      }
      onSelectSourceMode={(mode) => dispatch({ type: 'setSourceMode', mode })}
      onToggleDateFilter={() => dispatch({ type: 'toggleDateFilter' })}
      periodHandlers={periodHandlers}
      performanceEmployeeName={performance.employee.displayName}
      incentiveProjection={incentiveProjection}
      selectedClosedSnapshotRunId={selectedClosedSnapshotRunId}
      selectedLivePeriodType={selectedLivePeriodType}
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
  locale,
  onCloseKpiDetails,
  onOpenKpiDetails,
  onSelectClosedSnapshotRun,
  onSelectSourceMode,
  onToggleDateFilter,
  periodHandlers,
  performanceEmployeeName,
  incentiveProjection,
  selectedClosedSnapshotRunId,
  selectedLivePeriodType,
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
    samePeriodScoreDelta,
    scoreMeaning,
    scoreValue,
    selectedPeriodLabel,
    storePopulationLabel,
    storeRankLabel,
    targetProgressPercent,
    targetSalesLabel,
    targetStatusLabel,
    todayActions,
    turkeyPopulationLabel,
    turkeyRankLabel,
  } = viewModel

  return (
    <section
      className="store-me-plum-page tw:min-h-screen tw:text-foreground"
      data-testid="store-me-page"
      aria-label={t('storeMe.title')}
    >
      <main className="store-me-plum-content tw:min-w-0">
        <section className="tw:mx-auto tw:grid tw:max-w-7xl tw:gap-4" aria-label={t('storeMe.title')}>
          <StoreMyPerformanceTopbar
            employeeHeading={employeeHeading}
            introCopy={introCopy}
            periodLabel={periodLabel}
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

          <StoreMyPerformancePartialAlert
            isPartial={partial.isPartial}
            missingMetricLabels={partial.missingMetricLabels}
            pendingNormalizationLabels={pendingNormalizationLabels}
            t={t}
          />

          {incentiveProjection ? (
            <StoreMeIncentiveCard
              locale={locale}
              projection={incentiveProjection}
            />
          ) : null}

          <StoreMyPerformancePlumDashboard
            actualSalesLabel={actualSalesLabel}
            gradeLabel={gradeLabel}
            isPartial={partial.isPartial}
            metricCards={metricCards}
            monthlyDetailRows={monthlyDetailRows}
            onOpenKpiDetails={onOpenKpiDetails}
            remainingTargetLabel={remainingTargetLabel}
            samePeriodScoreDelta={samePeriodScoreDelta}
            scoreConfidence={scoreMeaning.confidence}
            scoreFocus={scoreMeaning.focus}
            scoreSummary={scoreMeaning.summary}
            scoreValue={scoreValue}
            storePopulationLabel={storePopulationLabel}
            storeRankLabel={storeRankLabel}
            t={t}
            targetProgressPercent={targetProgressPercent}
            targetSalesLabel={targetSalesLabel}
            targetStatusLabel={targetStatusLabel}
            todayActions={todayActions}
            turkeyPopulationLabel={turkeyPopulationLabel}
            turkeyRankLabel={turkeyRankLabel}
          />
        </section>
      </main>

      <StoreMyPerformanceKpiDialog
        employeeName={performanceEmployeeName}
        isOpen={isKpiDetailOpen}
        monthlyDetailRows={monthlyDetailRows}
        onClose={onCloseKpiDetails}
        t={t}
      />
    </section>
  )
}
