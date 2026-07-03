import { useEffect, useReducer, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { AuthSessionSummary } from '../features/auth/api'
import {
  canAcknowledgeChecklist,
  canReadChecklistResults,
  getAssignedStoreIds,
  hasAnyRole,
} from '../features/auth/authorization'
import {
  storeChecklistAcknowledgementsQueryKey,
  storeMobileChecklistsTodayQueryKey,
  storeWorkflowInboxQueryKey,
} from '../features/auth/store-query-scope'
import {
  acknowledgeChecklist,
  completeMobileChecklistInstance,
  getChecklistAcknowledgements,
  getMobileChecklistToday,
  saveMobileChecklistResponse,
  startMobileChecklistInstance,
  type ChecklistAcknowledgementItem,
  type MobileChecklistToday,
  type MobileChecklistTodayResponse,
} from '../features/checklists/api'
import { useLocalization } from '../features/localization/useLocalization'
import { actionToast } from '../lib/action-toast'
import { getUserFacingErrorMessage } from '../lib/format'
import { transientQueryRetryOptions } from '../lib/query-retry'
import {
  buildChecklistSearch,
  createInitialStoreChecklistsState,
  storeChecklistsReducer,
  type ChecklistCompletedInstance,
  type ChecklistResponseDraft,
  type ChecklistTab,
  type ChecklistTabOption,
  upsertChecklistActiveResponse,
} from './store-checklists-model'
import {
  buildChecklistResponseDrafts,
  buildChecklistStoreVisitRows,
  buildMonthOptions,
  doesChecklistItemMatchFilters,
  doesCoverageRowMatchFilters,
  formatMonthKey,
  getChecklistHeroScopeLabel,
  getChecklistResponseDraftKey,
  getChecklistTypeFilterOptions,
  getCoverageRowKey,
  getCoverageRowKeyFromRow,
  getStaticCopy,
  getStoreVisitScore,
  isIncompleteStoreVisitRow,
  isVisualMerchandiserOnly,
  serializeChecklistResponseDraft,
  sortChecklistItems,
  sortCoverageRows,
  sortStoreVisitRows,
} from './store-checklists-logic'
import { StoreChecklistsAcknowledgementPanels } from './store-checklists-acknowledgement-panels'
import { buildChecklistCoverageRows } from './store-checklists-coverage-model'
import { ChecklistTabs, ChecklistToolbar } from './store-checklists-controls'
import { StoreChecklistsHero } from './store-checklists-hero'
import { StoreChecklistsModals } from './store-checklists-modals'
import { StoreChecklistsVisitPlan } from './store-checklists-visit-plan'
import { StoreChecklistsVisitPanel } from './store-checklists-visit-panel'
import {
  buildVisitPlanRows,
  doesVisitPlanRowMatchStatusFilter,
  getVisitPlanCurrentMonthKey,
  resolveVisitPlanEvaluationMonth,
} from './store-visit-plan-model'
import {
  StoreErrorState,
  StoreLoadingState,
  StoreSurfacePage,
} from './store-surface-primitives'
import { mergeCompletedInstanceIntoMobileToday } from './store-checklists-cache-model'

function mergeSavedResponseIntoMobileToday(
  current: MobileChecklistTodayResponse | undefined,
  draft: ChecklistResponseDraft,
  updatedAt: string | null,
) {
  if (!current) return current

  let didUpdate = false
  const activeInstances = current.data.activeInstances.map((instance) => {
    if (instance.checklistInstanceId !== draft.checklistInstanceId) return instance
    didUpdate = true
    return upsertChecklistActiveResponse(instance, draft, updatedAt)
  })

  if (!didUpdate) return current

  return {
    ...current,
    data: {
      ...current.data,
      activeInstances,
    },
  }
}

function useStoreChecklistsPageContent(input: {
  authSummary: AuthSessionSummary | null
}) {
  const { locale, t } = useLocalization()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [pageState, dispatchPageState] = useReducer(
    storeChecklistsReducer,
    location.search,
    createInitialStoreChecklistsState,
  )

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('tab') !== 'incomplete') return

    navigate(
      {
        pathname: location.pathname,
        search: buildChecklistSearch(location.search, {
          status: 'missing_or_draft',
          tab: 'visits',
        }),
      },
      { replace: true },
    )
  }, [location.pathname, location.search, navigate])
  const {
    ackNotes,
    scores,
    comments,
    selectedSessionKey,
    selectedResultId,
    searchQuery,
    selectedMonth,
    typeFilter,
    statusFilter,
    activeTab,
    visitSort,
    resultSort,
    localActiveInstances,
    localCompletedRows,
    localCompletedInstances,
    sessionDirty,
  } = pageState
  const autoSaveTimersRef = useRef<Record<string, number>>({})
  const savedResponseDraftsRef = useRef<Record<string, string>>({})
  const canManageVisits = hasAnyRole(input.authSummary, [
    'REGION_MANAGER',
    'VISUAL_MERCHANDISER',
    'SUPER_ADMIN',
  ])
  const canUseAcknowledgements = canReadChecklistResults(input.authSummary)
  const templateTypeOptions = getChecklistTypeFilterOptions(input.authSummary, locale, t)
  const effectiveTypeFilter = templateTypeOptions.some((option) => option.value === typeFilter)
    ? typeFilter
    : templateTypeOptions[0]?.value ?? 'all'
  const checklistAcknowledgementsQueryKey = storeChecklistAcknowledgementsQueryKey(input.authSummary)
  const mobileChecklistsTodayQueryKey = storeMobileChecklistsTodayQueryKey(input.authSummary)
  const workflowInboxQueryKey = storeWorkflowInboxQueryKey(input.authSummary)
  const showCommandNotice = (message: string) => {
    actionToast.success(message)
  }
  const checklistsQuery = useQuery({
    queryKey: checklistAcknowledgementsQueryKey,
    queryFn: getChecklistAcknowledgements,
    enabled: canUseAcknowledgements,
    ...transientQueryRetryOptions,
  })
  const mobileTodayQuery = useQuery({
    queryKey: mobileChecklistsTodayQueryKey,
    queryFn: getMobileChecklistToday,
    enabled: canManageVisits,
    ...transientQueryRetryOptions,
  })
  const acknowledgeMutation = useMutation({
    mutationFn: acknowledgeChecklist,
    onSuccess: (result, variables) => {
      void queryClient.invalidateQueries({ queryKey: checklistAcknowledgementsQueryKey })
      void queryClient.invalidateQueries({ queryKey: workflowInboxQueryKey })
      dispatchPageState({
        type: 'acknowledgeSucceeded',
        checklistInstanceId: variables.checklistInstanceId,
      })
      navigate(
        {
          pathname: location.pathname,
          search: buildChecklistSearch(location.search, { result: null, tab: 'history' }),
        },
        { replace: true },
      )
      showCommandNotice(result.command.message)
    },
    onError: (error) => actionToast.error(error, 'Sonuç kabul edilemedi.'),
  })
  const startVisitMutation = useMutation({
    mutationFn: startMobileChecklistInstance,
    onSuccess: (result, variables) => {
      void queryClient.invalidateQueries({ queryKey: mobileChecklistsTodayQueryKey })
      const instance = result.data.checklistInstance
      const rowKey = getCoverageRowKey(variables.storeId, variables.checklistTemplateId)
      dispatchPageState({
        type: 'startVisitSucceeded',
        rowKey,
        instance: {
          checklistInstanceId: instance.checklist_instance_id,
          checklistTemplateId: variables.checklistTemplateId,
          storeId: variables.storeId,
          status: instance.status,
          startedAt: instance.created_at,
          updatedAt: instance.created_at,
          responses: [],
        },
      })
      showCommandNotice(result.command.message)
    },
    onError: (error) => actionToast.error(error, 'Checklist başlatılamadı.'),
  })
  const saveResponseMutation = useMutation({
    mutationFn: saveMobileChecklistResponse,
    onMutate: async () => {
      // Prevent an older activeInstances refetch from replacing the saved draft snapshot.
      await queryClient.cancelQueries({ queryKey: mobileChecklistsTodayQueryKey })
    },
    onSuccess: (result, variables) => {
      const updatedAt = result.data.checklistResponse.responded_at
      savedResponseDraftsRef.current[getChecklistResponseDraftKey(variables)] =
        serializeChecklistResponseDraft(variables)
      queryClient.setQueryData<MobileChecklistTodayResponse>(
        mobileChecklistsTodayQueryKey,
        (current) => mergeSavedResponseIntoMobileToday(current, variables, updatedAt),
      )
      dispatchPageState({
        type: 'saveResponseSucceeded',
        draft: variables,
        updatedAt,
      })
    },
  })
  const savePendingSessionResponses = async (
    checklistInstanceId: string,
    responseDrafts: ChecklistResponseDraft[],
  ) => {
    for (const [key, timerId] of Object.entries(autoSaveTimersRef.current)) {
      if (key.startsWith(`${checklistInstanceId}:`)) {
        window.clearTimeout(timerId)
        delete autoSaveTimersRef.current[key]
      }
    }

    const changedDrafts = responseDrafts.filter((draft) => {
      const key = getChecklistResponseDraftKey(draft)
      return savedResponseDraftsRef.current[key] !== serializeChecklistResponseDraft(draft)
    })

    await Promise.all(
      changedDrafts.map(async (draft) => {
        await saveMobileChecklistResponse(draft)
        savedResponseDraftsRef.current[getChecklistResponseDraftKey(draft)] =
          serializeChecklistResponseDraft(draft)
      }),
    )
  }
  const completeVisitMutation = useMutation({
    mutationFn: async (variables: {
      checklistInstanceId: string
      checklistTemplateId: string
      responses: ChecklistResponseDraft[]
      rowKey: string
      storeId: string
    }) => {
      await savePendingSessionResponses(variables.checklistInstanceId, variables.responses)
      const result = await completeMobileChecklistInstance({
        checklistInstanceId: variables.checklistInstanceId,
      })
      return result
    },
    onSuccess: (result, variables) => {
      const completedInstance = result.data.checklistInstance
      const totalScore =
        completedInstance.total_score === null || completedInstance.total_score === undefined
          ? null
          : Number(completedInstance.total_score)
      const completedChecklistInstance: ChecklistCompletedInstance = {
        checklistInstanceId: variables.checklistInstanceId,
        checklistTemplateId: variables.checklistTemplateId,
        completedAt: completedInstance.completed_at ?? null,
        storeId: variables.storeId,
        totalScore: totalScore === null || Number.isFinite(totalScore) ? totalScore : null,
      }
      queryClient.setQueryData<MobileChecklistTodayResponse>(
        mobileChecklistsTodayQueryKey,
        (current) => mergeCompletedInstanceIntoMobileToday(current, completedChecklistInstance),
      )
      showCommandNotice(getStaticCopy(locale, 'Başarıyla Tamamlandı', 'Completed successfully'))
      void queryClient.invalidateQueries({ queryKey: mobileChecklistsTodayQueryKey })
      void queryClient.invalidateQueries({ queryKey: checklistAcknowledgementsQueryKey })
      void queryClient.invalidateQueries({ queryKey: workflowInboxQueryKey })
      dispatchPageState({
        type: 'completeVisitSucceeded',
        completedInstance: completedChecklistInstance,
        rowKey: variables.rowKey,
      })
    },
    onError: (error) => actionToast.error(error, 'Checklist tamamlanamadı.'),
  })
  const queueResponseAutoSave = (draft: ChecklistResponseDraft) => {
    const key = getChecklistResponseDraftKey(draft)
    const serialized = serializeChecklistResponseDraft(draft)
    if (savedResponseDraftsRef.current[key] === serialized) return

    const existingTimer = autoSaveTimersRef.current[key]
    if (existingTimer) window.clearTimeout(existingTimer)
    autoSaveTimersRef.current[key] = window.setTimeout(() => {
      delete autoSaveTimersRef.current[key]
      saveResponseMutation.mutate(draft)
    }, 500)
  }
  const hydrateActiveResponseDrafts = (
    active: MobileChecklistToday['activeInstances'][number] | undefined,
  ) => {
    const nextScores: Record<string, number> = {}
    const nextComments: Record<string, string> = {}

    if (active?.responses.length) {
      for (const response of active.responses) {
        nextScores[response.templateItemId] = response.scoreValue
        const draft = {
          checklistInstanceId: active.checklistInstanceId,
          templateItemId: response.templateItemId,
          scoreValue: response.scoreValue,
          ...(response.commentText === null || response.commentText === undefined
            ? {}
            : { commentText: response.commentText }),
        }
        savedResponseDraftsRef.current[getChecklistResponseDraftKey(draft)] =
          serializeChecklistResponseDraft(draft)
        if (response.commentText) nextComments[response.templateItemId] = response.commentText
      }
    }

    return { comments: nextComments, scores: nextScores }
  }

  const isLoading =
    (canUseAcknowledgements && checklistsQuery.isLoading) ||
    (canManageVisits && mobileTodayQuery.isLoading)
  const isError =
    (canUseAcknowledgements && checklistsQuery.isError) ||
    (canManageVisits && mobileTodayQuery.isError)
  const errorMessage = getUserFacingErrorMessage(
    checklistsQuery.error ?? mobileTodayQuery.error,
    t('storeChecklists.errorCopy'),
  )
  const isRetrying =
    (canUseAcknowledgements && checklistsQuery.isFetching) ||
    (canManageVisits && mobileTodayQuery.isFetching)
  const retryChecklistQueries = () => {
    void Promise.all([
      ...(canUseAcknowledgements && checklistsQuery.isError ? [checklistsQuery.refetch()] : []),
      ...(canManageVisits && mobileTodayQuery.isError ? [mobileTodayQuery.refetch()] : []),
    ])
  }

  const items = canUseAcknowledgements ? (checklistsQuery.data?.items ?? []) : []
  const mobileToday = mobileTodayQuery.data?.data
  const pendingItems = items.filter((item) => item.acknowledgement === null)
  const acknowledgedItems = items.filter((item) => item.acknowledgement !== null)
  const selectedResult = items.find((item) => item.checklistInstanceId === selectedResultId) ?? null
  const assignedStoreIds = getAssignedStoreIds(input.authSummary)
  const coverageRows = buildChecklistCoverageRows({
    acknowledgementItems: items,
    localActiveInstances,
    localCompletedInstances,
    localCompletedRows,
    mobileToday,
    month: selectedMonth,
  })
  const actionCoverageRows = buildChecklistCoverageRows({
    acknowledgementItems: items,
    localActiveInstances,
    localCompletedInstances,
    localCompletedRows,
    mobileToday,
    month: 'all',
  })
  const monthOptions = buildMonthOptions(
    coverageRows,
    items,
    locale,
    (mobileToday?.monthlySummaries ?? []).map((summary) => summary.monthStart),
  )
  const filteredCoverageRows = sortCoverageRows(
    coverageRows.filter((row) =>
      doesCoverageRowMatchFilters(row, {
        month: selectedMonth,
        query: searchQuery,
        status: statusFilter,
        type: effectiveTypeFilter,
      }),
    ),
    visitSort,
    locale,
  )
  const visitStoreRows = sortStoreVisitRows(
    buildChecklistStoreVisitRows(filteredCoverageRows),
    visitSort,
    locale,
  )
  const actionVisitRowsByStoreId = new Map(
    buildChecklistStoreVisitRows(
      actionCoverageRows.filter((row) =>
        doesCoverageRowMatchFilters(row, {
          month: 'all',
          query: searchQuery,
          status: 'all',
          type: 'all',
        }),
      ),
    ).map((row) => [row.store.storeId, row]),
  )
  const currentMonth = getVisitPlanCurrentMonthKey()
  const filteredPendingItems = sortChecklistItems(
    pendingItems.filter((item) =>
      doesChecklistItemMatchFilters(item, {
        includeOutOfPeriodPending: true,
        month: selectedMonth,
        query: searchQuery,
        status: statusFilter,
        type: effectiveTypeFilter,
      }),
    ),
    resultSort,
    locale,
  )
  const filteredAcknowledgedItems = sortChecklistItems(
    acknowledgedItems.filter((item) =>
      doesChecklistItemMatchFilters(item, {
        month: selectedMonth,
        query: searchQuery,
        status: statusFilter,
        type: effectiveTypeFilter,
      }),
    ),
    resultSort,
    locale,
  ).slice(0, 5)
  const activeVisitCount = coverageRows.filter((row) => row.active).length
  const selectedSession =
    coverageRows.find((row) => getCoverageRowKeyFromRow(row) === selectedSessionKey) ?? null
  const resultStoreCount = new Set(items.map((item) => item.storeId)).size
  const vmOnlyVisitScope = isVisualMerchandiserOnly(input.authSummary)
  const showBmVisitScore = effectiveTypeFilter === 'all' || effectiveTypeFilter === 'BM_STORE_VISIT'
  const showVmVisitScore = effectiveTypeFilter === 'all' || effectiveTypeFilter === 'VM_STORE_VISIT'
  const requiresCombinedVisitTemplates = showBmVisitScore && showVmVisitScore
  const completedVisitStoreCount = visitStoreRows.filter((row) =>
    [row.bm, row.vm].some((item) => (item?.completedCount ?? 0) > 0),
  ).length
  const incompleteVisitStoreRows = visitStoreRows.filter((row) =>
    isIncompleteStoreVisitRow(row, requiresCombinedVisitTemplates),
  )
  const evaluationMonth = resolveVisitPlanEvaluationMonth(selectedMonth, currentMonth)
  const visitPlanCoverageRows = buildChecklistCoverageRows({
    acknowledgementItems: items,
    localActiveInstances,
    localCompletedInstances,
    localCompletedRows,
    mobileToday,
    month: evaluationMonth,
  })
  const filteredVisitPlanCoverageRows = visitPlanCoverageRows.filter((row) =>
    doesCoverageRowMatchFilters(row, {
      month: 'all',
      query: searchQuery,
      status: 'all',
      type: effectiveTypeFilter,
    }),
  )
  const visitPlanStoreRows = buildChecklistStoreVisitRows(filteredVisitPlanCoverageRows)
  const visitPlanRows = buildVisitPlanRows({
    acknowledgementItems: items,
    authSummary: input.authSummary,
    currentMonth,
    evaluationMonth,
    requiresCombinedVisitTemplates,
    rows: visitPlanStoreRows,
    selectedMonth,
  }).filter((row) => doesVisitPlanRowMatchStatusFilter(row, statusFilter))
  const pendingVisitStoreCount = incompleteVisitStoreRows.length
  const heroScoreValues = (canManageVisits
    ? visitStoreRows.map(getStoreVisitScore)
    : items.map((item) => item.totalScore ?? Math.round((item.complianceRate ?? 0) * 100))
  ).filter((value): value is number => value !== null && Number.isFinite(value))
  const heroAverageScore =
    heroScoreValues.length > 0
      ? Math.round((heroScoreValues.reduce((sum, value) => sum + value, 0) / heroScoreValues.length) * 10) / 10
      : null
  const assignedVisitStoreCount =
    mobileToday?.stores.length ??
    (assignedStoreIds.length > 0
      ? assignedStoreIds.length
      : input.authSummary?.scopeSummary.assignedStoreCount ?? 0)
  const heroStoreCount = canManageVisits ? assignedVisitStoreCount : resultStoreCount
  const heroCompletedCount = canManageVisits ? completedVisitStoreCount : acknowledgedItems.length
  const heroWaitingCount = canManageVisits ? pendingVisitStoreCount : pendingItems.length
  const heroScopeLabel = getChecklistHeroScopeLabel(input.authSummary, locale, canManageVisits)
  const periodLabel =
    selectedMonth === 'all'
      ? getStaticCopy(locale, 'Tüm aylar', 'All months')
      : formatMonthKey(selectedMonth, locale)
  const checklistTabs: ChecklistTabOption[] = [
    ...(canManageVisits
      ? [
          {
            key: 'visits' as const,
            label: t('storeChecklists.visitEyebrow'),
            count: visitStoreRows.length,
            tone: activeVisitCount > 0 ? 'warning' as const : 'accent' as const,
          },
          {
            key: 'plan' as const,
            label: t('storeChecklists.visitPlanEyebrow'),
            count: visitPlanRows.length,
            tone: visitPlanRows.some((row) => row.riskLevel === 'high') ? 'danger' as const : 'calm' as const,
          },
        ]
      : []),
    ...(canUseAcknowledgements
      ? [
          {
            key: 'inbox' as const,
            label: t('storeChecklists.inboxEyebrow'),
            count: filteredPendingItems.length,
            tone: filteredPendingItems.length > 0 ? 'accent' as const : 'calm' as const,
          },
        ]
      : []),
    ...(canUseAcknowledgements
      ? [
          {
            key: 'history' as const,
            label: t('storeChecklists.recentHistoryEyebrow'),
            count: filteredAcknowledgedItems.length,
            tone: filteredAcknowledgedItems.length > 0 ? 'accent' as const : 'neutral' as const,
          },
        ]
      : []),
  ]
  const selectedTab = checklistTabs.some((tab) => tab.key === activeTab)
    ? activeTab
    : checklistTabs[0]?.key ?? 'visits'

  const selectChecklistTab = (tab: ChecklistTab) => {
    dispatchPageState({ type: 'selectTab', tab })
  }

  const openVisitWorkflowFromPlan = () => {
    dispatchPageState({ type: 'selectTab', tab: 'visits' })
    navigate(
      {
        pathname: location.pathname,
        search: buildChecklistSearch(location.search, { tab: 'visits' }),
      },
      { replace: true },
    )
  }

  const openChecklistResult = (item: ChecklistAcknowledgementItem) => {
    const tab = item.acknowledgement ? 'history' : 'inbox'
    dispatchPageState({ type: 'openResult', tab, checklistInstanceId: item.checklistInstanceId })
    navigate(
      {
        pathname: location.pathname,
        search: buildChecklistSearch(location.search, {
          result: item.checklistInstanceId,
          tab,
        }),
      },
      { replace: true },
    )
  }

  const closeChecklistResult = () => {
    dispatchPageState({ type: 'closeResult' })
    navigate(
      {
        pathname: location.pathname,
        search: buildChecklistSearch(location.search, { result: null }),
      },
      { replace: true },
    )
  }

  const closeSession = () => {
    const confirmMessage = sessionDirty
      ? t('storeChecklists.sessionCloseConfirm')
      : t('storeChecklists.cancelSessionConfirm')
    if (!window.confirm(confirmMessage)) {
      return
    }

    dispatchPageState({ type: 'closeSession' })
  }

  if (isLoading) {
    return (
      <StoreLoadingState
        title={t('storeChecklists.loadingTitle')}
        description={t('storeChecklists.loadingCopy')}
      />
    )
  }

  if (isError) {
    return (
      <StoreSurfacePage ariaLabel={t('storeChecklists.errorTitle')} className="store-checklists-command-page">
        <StoreErrorState
          title={t('storeChecklists.errorTitle')}
          description={errorMessage}
          action={{
            disabled: isRetrying,
            icon: <RefreshCw data-icon="inline-start" />,
            label: isRetrying ? t('storeChecklists.retryingAction') : t('storeChecklists.retryAction'),
            onClick: retryChecklistQueries,
            variant: 'outline',
          }}
        />
      </StoreSurfacePage>
    )
  }

  return (
    <StoreSurfacePage ariaLabel={t('storeChecklists.title')} className="store-checklists-command-page">
      <StoreChecklistsHero
        canManageVisits={canManageVisits}
        heroAverageScore={heroAverageScore}
        heroCompletedCount={heroCompletedCount}
        heroScopeLabel={heroScopeLabel}
        heroStoreCount={heroStoreCount}
        heroWaitingCount={heroWaitingCount}
        locale={locale}
        periodLabel={periodLabel}
        t={t}
        vmOnlyVisitScope={vmOnlyVisitScope}
      />

      <div className="store-checklists-flow-layout">
        <div className="store-checklists-flow-main">
          <ChecklistToolbar
            locale={locale}
            monthOptions={monthOptions}
            searchQuery={searchQuery}
            selectedMonth={selectedMonth}
            statusFilter={statusFilter}
            t={t}
            typeFilter={effectiveTypeFilter}
            typeOptions={templateTypeOptions}
            onClear={() =>
              dispatchPageState({
                type: 'clearFilters',
                typeFilter: templateTypeOptions[0]?.value ?? 'all',
              })
            }
            onMonthChange={(value) => dispatchPageState({ type: 'setSelectedMonth', value })}
            onSearchChange={(value) => dispatchPageState({ type: 'setSearchQuery', value })}
            onStatusChange={(value) => dispatchPageState({ type: 'setStatusFilter', value })}
            onTypeChange={(value) => dispatchPageState({ type: 'setTypeFilter', value })}
          />

          {checklistTabs.length > 0 ? (
            <ChecklistTabs
              activeTab={selectedTab}
              locale={locale}
              tabs={checklistTabs}
              onChange={selectChecklistTab}
            />
          ) : null}

          {canManageVisits ? (
            <>
              <StoreChecklistsVisitPanel
                activeVisitCount={activeVisitCount}
                assignedStoreIds={assignedStoreIds}
                assignedVisitStoreCount={assignedVisitStoreCount}
                authSummary={input.authSummary}
                actionVisitRowsByStoreId={actionVisitRowsByStoreId}
                display={{
                  requiresCombinedVisitTemplates,
                  showBmVisitScore,
                  showVmVisitScore,
                  vmOnlyVisitScope,
                }}
                errors={{
                  complete:
                    completeVisitMutation.isError && !selectedSession
                      ? completeVisitMutation.error
                      : null,
                  save: saveResponseMutation.isError ? saveResponseMutation.error : null,
                  start: startVisitMutation.isError ? startVisitMutation.error : null,
                }}
                hydrateActiveResponseDrafts={hydrateActiveResponseDrafts}
                locale={locale}
                mobileToday={mobileToday}
                selectedTab={selectedTab}
                startVisitIsPending={startVisitMutation.isPending}
                startVisitVariables={startVisitMutation.variables}
                t={t}
                visitSort={visitSort}
                visitStoreRows={visitStoreRows}
                onOpenSession={(rowKey, drafts) =>
                  dispatchPageState({ type: 'openSession', rowKey, ...drafts })
                }
                onResetSessionDrafts={() => dispatchPageState({ type: 'resetSessionDrafts' })}
                onStartVisit={(variables) => startVisitMutation.mutate(variables)}
                onToggleVisitSort={(key) => dispatchPageState({ type: 'toggleVisitSort', key })}
              />
              {selectedTab === 'plan' ? (
                <StoreChecklistsVisitPlan
                  assignedVisitStoreCount={assignedVisitStoreCount}
                  evaluationMonth={evaluationMonth}
                  locale={locale}
                  rows={visitPlanRows}
                  selectedMonth={selectedMonth}
                  t={t}
                  visibleTemplateCount={mobileToday?.templates.length ?? 0}
                  onOpenVisits={openVisitWorkflowFromPlan}
                />
              ) : null}
            </>
          ) : null}

          {canUseAcknowledgements ? (
            <StoreChecklistsAcknowledgementPanels
              filteredAcknowledgedItems={filteredAcknowledgedItems}
              filteredPendingItems={filteredPendingItems}
              locale={locale}
              pendingItemCount={pendingItems.length}
              resultSort={resultSort}
              selectedTab={selectedTab}
              t={t}
              onOpenResult={openChecklistResult}
              onToggleResultSort={(key) => dispatchPageState({ type: 'toggleResultSort', key })}
            />
          ) : null}
        </div>

      </div>

      <StoreChecklistsModals
        acknowledgementNote={selectedResult ? (ackNotes[selectedResult.checklistInstanceId] ?? '') : ''}
        comments={comments}
        locale={locale}
        resultState={{
          acknowledging:
            Boolean(selectedResult) &&
            acknowledgeMutation.isPending &&
            acknowledgeMutation.variables?.checklistInstanceId === selectedResult?.checklistInstanceId,
          canAcknowledge: selectedResult
            ? canAcknowledgeChecklist(input.authSummary, selectedResult.storeId)
            : false,
        }}
        scores={scores}
        selectedResult={selectedResult}
        selectedSession={selectedSession}
        t={t}
        visitState={{
          completeError: completeVisitMutation.isError ? completeVisitMutation.error : null,
          completing: completeVisitMutation.isPending,
          saving: saveResponseMutation.isPending,
          starting: startVisitMutation.isPending,
        }}
        onAcknowledgeResult={(acknowledgementNote) => {
          if (!selectedResult) return
          acknowledgeMutation.mutate({
            checklistInstanceId: selectedResult.checklistInstanceId,
            ...(acknowledgementNote.trim()
              ? { acknowledgementNote: acknowledgementNote.trim() }
              : {}),
          })
        }}
        onCloseResult={closeChecklistResult}
        onCloseSession={closeSession}
        onCommentChange={(templateItemId, comment) => {
          dispatchPageState({ type: 'setCommentDraft', templateItemId, comment })
          const score = scores[templateItemId]
          if (selectedSession?.active && typeof score === 'number' && Number.isFinite(score)) {
            queueResponseAutoSave({
              checklistInstanceId: selectedSession.active.checklistInstanceId,
              templateItemId,
              scoreValue: score,
              ...(comment ? { commentText: comment } : {}),
            })
          }
        }}
        onCompleteVisit={(checklistInstanceId) => {
          if (!selectedSession) return
          completeVisitMutation.mutate({
            checklistInstanceId,
            checklistTemplateId: selectedSession.template.checklistTemplateId,
            responses: buildChecklistResponseDrafts({
              checklistInstanceId,
              comments,
              scores,
              session: selectedSession,
            }),
            rowKey: getCoverageRowKeyFromRow(selectedSession),
            storeId: selectedSession.store.storeId,
          })
        }}
        onNoteChange={(note) => {
          if (!selectedResult) return
          dispatchPageState({
            type: 'setAckNote',
            checklistInstanceId: selectedResult.checklistInstanceId,
            note,
          })
        }}
        onScoreChange={(templateItemId, score) => {
          dispatchPageState({ type: 'setScoreDraft', templateItemId, score })
          if (selectedSession?.active && score !== null) {
            queueResponseAutoSave({
              checklistInstanceId: selectedSession.active.checklistInstanceId,
              templateItemId,
              scoreValue: score,
              ...(comments[templateItemId] ? { commentText: comments[templateItemId] } : {}),
            })
          }
        }}
      />

    </StoreSurfacePage>
  )
}
export function StoreChecklistsPage(input: {
  authSummary: AuthSessionSummary | null
}) {
  return useStoreChecklistsPageContent(input)
}
