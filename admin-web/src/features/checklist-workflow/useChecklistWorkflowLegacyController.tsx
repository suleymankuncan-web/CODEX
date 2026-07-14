import { useEffect, useReducer, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router-dom'
import type { AuthSessionSummary } from '../auth/api'
import {
  canReadChecklistResults,
  getAssignedStoreIds,
  hasAnyRole,
} from '../auth/authorization'
import {
  storeChecklistAcknowledgementsQueryKey,
  storeMobileChecklistsTodayQueryKey,
  storeWorkflowInboxQueryKey,
} from '../auth/store-query-scope'
import {
  acknowledgeChecklist,
  completeMobileChecklistInstance,
  getChecklistAcknowledgementDetail,
  getChecklistAcknowledgements,
  getMobileChecklistToday,
  saveMobileChecklistResponse,
  startMobileChecklistInstance,
  type ChecklistAcknowledgementItem,
  type MobileChecklistToday,
  type MobileChecklistTodayResponse,
} from '../checklists/api'
import { useLocalization } from '../localization/useLocalization'
import { actionToast } from '../../lib/action-toast'
import { getUserFacingErrorMessage } from '../../lib/format'
import { transientQueryRetryOptions } from '../../lib/query-retry'
import {
  buildChecklistSearch,
  createInitialStoreChecklistsState,
  storeChecklistsReducer,
  type ChecklistCompletedInstance,
  type ChecklistResponseDraft,
  type ChecklistTab,
  type ChecklistTabOption,
  upsertChecklistActiveResponse,
} from '../../pages/store-checklists-model'
import {
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
} from '../../pages/store-checklists-logic'
import { buildChecklistCoverageRows } from '../../pages/store-checklists-coverage-model'
import {
  buildVisitPlanRows,
  doesVisitPlanRowMatchStatusFilter,
  getVisitPlanCurrentMonthKey,
  resolveVisitPlanEvaluationMonth,
} from '../../pages/store-visit-plan-model'
import { mergeCompletedInstanceIntoMobileToday } from '../../pages/store-checklists-cache-model'

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

export function useChecklistWorkflowLegacyController(input: {
  authSummary: AuthSessionSummary | null
}) {
  const { locale, t } = useLocalization()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const checklistCommandQueryKey = ['checklist-command'] as const
  const commandStoreId = new URLSearchParams(location.search).get('storeId')?.trim() ?? ''
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
    queryFn: () => getChecklistAcknowledgements(),
    enabled: canUseAcknowledgements,
    ...transientQueryRetryOptions,
  })
  const selectedResultDetailQuery = useQuery({
    queryKey: [
      ...checklistAcknowledgementsQueryKey,
      'detail',
      selectedResultId ?? 'none',
    ],
    queryFn: () => getChecklistAcknowledgementDetail(selectedResultId ?? ''),
    enabled: canUseAcknowledgements && Boolean(selectedResultId),
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
      void queryClient.refetchQueries({ queryKey: checklistCommandQueryKey, type: 'active' })
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
      void queryClient.refetchQueries({ queryKey: checklistCommandQueryKey, type: 'active' })
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
      void queryClient.refetchQueries({ queryKey: checklistCommandQueryKey, type: 'active' })
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
  const selectedResultSummary =
    items.find((item) => item.checklistInstanceId === selectedResultId) ?? null
  const selectedResult = selectedResultDetailQuery.data ?? selectedResultSummary
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
      (!commandStoreId || row.store.storeId === commandStoreId) &&
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
        (!commandStoreId || row.store.storeId === commandStoreId) &&
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
      (!commandStoreId || item.storeId === commandStoreId) &&
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
      (!commandStoreId || item.storeId === commandStoreId) &&
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

  return {
    acknowledgeMutation,
    ackNotes,
    actionVisitRowsByStoreId,
    activeVisitCount,
    assignedStoreIds,
    assignedVisitStoreCount,
    canManageVisits,
    canUseAcknowledgements,
    checklistTabs,
    comments,
    completeVisitMutation,
    dispatchPageState,
    effectiveTypeFilter,
    errorMessage,
    evaluationMonth,
    filteredAcknowledgedItems,
    filteredPendingItems,
    heroAverageScore,
    heroCompletedCount,
    heroScopeLabel,
    heroStoreCount,
    heroWaitingCount,
    hydrateActiveResponseDrafts,
    isError,
    isLoading,
    isRetrying,
    locale,
    mobileToday,
    monthOptions,
    openChecklistResult,
    openVisitWorkflowFromPlan,
    pendingItems,
    periodLabel,
    queueResponseAutoSave,
    requiresCombinedVisitTemplates,
    resultSort,
    retryChecklistQueries,
    saveResponseMutation,
    scores,
    searchQuery,
    selectedMonth,
    selectedResult,
    selectedSession,
    selectedTab,
    selectChecklistTab,
    showBmVisitScore,
    showVmVisitScore,
    startVisitMutation,
    statusFilter,
    t,
    templateTypeOptions,
    visitPlanRows,
    visitSort,
    visitStoreRows,
    vmOnlyVisitScope,
    closeChecklistResult,
    closeSession,
  }
}
