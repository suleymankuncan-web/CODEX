import { useQueries, useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useEffect, useReducer, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
import { getUserFacingErrorMessage } from '../lib/format'
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
import { StoreMeShareCardDialog } from './store-me-share-card-dialog'
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
  onReturnToRankings?: () => void
  onToggleDateFilter: () => void
  periodHandlers: StoreMyPerformancePeriodHandlers
  performanceEmployeeName: string
  selectedClosedSnapshotRunId: string
  selectedLivePeriodStart: string
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
  returnTo?: string
}) {
  const { locale, t } = useLocalization()
  const navigate = useNavigate()
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
    availableMonthlyPeriods: periodModel.availableMonthlyPeriods,
    dispatch,
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
  const personnelProfileSafeError =
    profileMode === 'personnel' &&
    performanceQuery.error instanceof ApiError &&
    [401, 403, 404].includes(performanceQuery.error.status)

  if (personnelProfileSafeError) {
    return (
      <StoreSurfacePage ariaLabel={t('storeMe.personnelProfileUnavailableTitle')}>
        <StoreErrorState
          title={t('storeMe.personnelProfileUnavailableTitle')}
          description={t('storeMe.personnelProfileUnavailableCopy')}
        />
      </StoreSurfacePage>
    )
  }

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
          description={getUserFacingErrorMessage(
            performanceQuery.error ?? configQuery.error ?? closedRunsQuery.error,
            'Performans verisi alınamadı. Dönemi kontrol edip tekrar deneyin.',
          )}
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
      {...(profileMode === 'personnel' && input.returnTo
        ? { onReturnToRankings: () => navigate(input.returnTo as string) }
        : {})}
      onToggleDateFilter={() => dispatch({ type: 'toggleDateFilter' })}
      periodHandlers={periodHandlers}
      performanceEmployeeName={performance.employee.displayName}
      selectedClosedSnapshotRunId={selectedClosedSnapshotRunId}
      selectedLivePeriodStart={selectedLivePeriodStart}
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
  onReturnToRankings,
  onToggleDateFilter,
  periodHandlers,
  performanceEmployeeName,
  selectedClosedSnapshotRunId,
  selectedLivePeriodStart,
  selectedLivePeriodType,
  sourceMode,
  t,
  usesClosedSnapshotMode,
  viewModel,
}: StoreMyPerformancePageExperienceProps) {
  const [isShareCardOpen, setShareCardOpen] = useState(false)
  const {
    actualSalesLabel,
    closedSnapshotRunOptions,
    dataQualityLabel,
    employeeHeading,
    gradeLabel,
    introCopy,
    liveDayFilterOptions,
    liveMonthFilterOptions,
    loadedPeriodCount,
    metricCards,
    monthlyDetailRows,
    partial,
    periodLabel,
    pendingNormalizationLabels,
    remainingTargetLabel,
    regionPopulationLabel,
    regionRankLabel,
    samePeriodScoreDelta,
    scoreMeaning,
    scoreValue,
    selectedPeriodLabel,
    shareCard,
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
    <>
      <PerformanceSurface ariaLabel={t('storeMe.title')}>
        <section className="tw:mx-auto tw:grid tw:max-w-7xl tw:gap-4" aria-label={t('storeMe.title')}>
          <StoreMyPerformanceTopbar
            employeeHeading={employeeHeading}
            introCopy={introCopy}
            onOpenShareCard={() => setShareCardOpen(true)}
            {...(onReturnToRankings ? { onReturn: onReturnToRankings, returnLabel: t('storeMe.backToRankings') } : {})}
            periodLabel={periodLabel}
            shareCardLabel={t('storeMe.shareCardButton')}
          />

          <StoreMyPerformanceDateFilter
            activeClosedSnapshotRunId={activeClosedSnapshotRunId}
            availableClosedSnapshotRuns={closedSnapshotRunOptions}
            availableLiveMonthOptions={liveMonthFilterOptions}
            dataQualityLabel={dataQualityLabel}
            isDateFilterOpen={isDateFilterOpen}
            isPartial={partial.isPartial}
            locale={locale}
            loadedPeriodCount={loadedPeriodCount}
            onChangeLivePeriodType={periodHandlers.changeLivePeriodType}
            onSelectClosedSnapshotRun={onSelectClosedSnapshotRun}
            onSelectLiveDay={periodHandlers.selectLiveDay}
            onSelectLiveMonth={periodHandlers.selectLiveMonth}
            onSelectSourceMode={onSelectSourceMode}
            onToggleDateFilter={onToggleDateFilter}
            scopedAvailableDailyPeriods={liveDayFilterOptions}
            selectedClosedSnapshotRunId={selectedClosedSnapshotRunId}
            selectedLivePeriodStart={selectedLivePeriodStart}
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
            regionPopulationLabel={regionPopulationLabel}
            regionRankLabel={regionRankLabel}
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
      </PerformanceSurface>

      <StoreMyPerformanceKpiDialog
        employeeName={performanceEmployeeName}
        isOpen={isKpiDetailOpen}
        monthlyDetailRows={monthlyDetailRows}
        onClose={onCloseKpiDetails}
        t={t}
      />
      <StoreMeShareCardDialog
        card={shareCard}
        isOpen={isShareCardOpen}
        onClose={() => setShareCardOpen(false)}
        t={t}
      />
    </>
  )
}

function PerformanceSurface(input: {
  ariaLabel: string
  children: ReactNode
}) {
  return (
    <section
      className="store-me-plum-page tw:min-h-screen tw:text-foreground"
      data-testid="store-me-page"
      aria-label={input.ariaLabel}
    >
      <main className="store-me-plum-content tw:min-w-0">
        {input.children}
      </main>
    </section>
  )
}
