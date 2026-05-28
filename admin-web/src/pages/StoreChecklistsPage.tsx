import { useReducer, useRef } from 'react'
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
  acknowledgeChecklist,
  completeMobileChecklistInstance,
  getChecklistAcknowledgements,
  getMobileChecklistToday,
  saveMobileChecklistResponse,
  startMobileChecklistInstance,
  type ChecklistAcknowledgementItem,
  type MobileChecklistToday,
} from '../features/checklists/api'
import { useLocalization } from '../features/localization/useLocalization'
import { getErrorMessage } from '../lib/format'
import { transientQueryRetryOptions } from '../lib/query-retry'
import {
  buildChecklistSearch,
  createInitialStoreChecklistsState,
  storeChecklistCommandNotice,
  storeChecklistsReducer,
  type ChecklistCoverageRow,
  type ChecklistResponseDraft,
  type ChecklistTab,
  type ChecklistTabOption,
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
  getMonthKey,
  getStaticCopy,
  getStoreVisitScore,
  hasOpenStoreVisitWork,
  isVisualMerchandiserOnly,
  serializeChecklistResponseDraft,
  sortChecklistItems,
  sortCoverageRows,
  sortStoreVisitRows,
} from './store-checklists-logic'
import { StoreChecklistsAcknowledgementPanels } from './store-checklists-acknowledgement-panels'
import { ChecklistTabs, ChecklistToolbar } from './store-checklists-controls'
import { StoreChecklistsHero } from './store-checklists-hero'
import { StoreChecklistsModals } from './store-checklists-modals'
import {
  ChecklistAttentionBanner,
  ChecklistPriorityRail,
} from './store-checklists-priority'
import {
  buildChecklistPriorityActions,
  isIncompleteStoreVisitRow,
} from './store-checklists-priority-logic'
import { StoreChecklistsVisitPanel } from './store-checklists-visit-panel'
import {
  StoreErrorState,
  StoreLoadingState,
  StoreSurfacePage,
} from './store-surface-primitives'

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
  const {
    ackNotes,
    ackNotice,
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
  const showCommandNotice = (message: string) => {
    storeChecklistCommandNotice(message)
    dispatchPageState({ type: 'setAckNotice', message })
  }
  const checklistsQuery = useQuery({
    queryKey: ['checklist-acknowledgements'],
    queryFn: getChecklistAcknowledgements,
    enabled: canUseAcknowledgements,
    ...transientQueryRetryOptions,
  })
  const mobileTodayQuery = useQuery({
    queryKey: ['mobile-checklists-today'],
    queryFn: getMobileChecklistToday,
    enabled: canManageVisits,
    ...transientQueryRetryOptions,
  })
  const acknowledgeMutation = useMutation({
    mutationFn: acknowledgeChecklist,
    onSuccess: (result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['checklist-acknowledgements'] })
      void queryClient.invalidateQueries({ queryKey: ['workflow-inbox'] })
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
  })
  const startVisitMutation = useMutation({
    mutationFn: startMobileChecklistInstance,
    onSuccess: (result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['mobile-checklists-today'] })
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
  })
  const saveResponseMutation = useMutation({
    mutationFn: saveMobileChecklistResponse,
    onSuccess: (_result, variables) => {
      savedResponseDraftsRef.current[getChecklistResponseDraftKey(variables)] =
        serializeChecklistResponseDraft(variables)
      void queryClient.invalidateQueries({ queryKey: ['mobile-checklists-today'] })
      dispatchPageState({ type: 'saveResponseSucceeded' })
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
      responses: ChecklistResponseDraft[]
    }) => {
      await savePendingSessionResponses(variables.checklistInstanceId, variables.responses)
      const result = await completeMobileChecklistInstance({
        checklistInstanceId: variables.checklistInstanceId,
      })
      showCommandNotice(getStaticCopy(locale, 'Başarıyla Tamamlandı', 'Completed successfully'))
      return result
    },
    onSuccess: (_result, variables) => {
      showCommandNotice(getStaticCopy(locale, 'Başarıyla Tamamlandı', 'Completed successfully'))
      void queryClient.invalidateQueries({ queryKey: ['mobile-checklists-today'] })
      void queryClient.invalidateQueries({ queryKey: ['checklist-acknowledgements'] })
      void queryClient.invalidateQueries({ queryKey: ['workflow-inbox'] })
      dispatchPageState({
        type: 'completeVisitSucceeded',
        checklistInstanceId: variables.checklistInstanceId,
      })
    },
    onError: (error) => {
      showCommandNotice(getErrorMessage(error))
    },
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
  const errorMessage = getErrorMessage(checklistsQuery.error ?? mobileTodayQuery.error)
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
  const coverageRows: ChecklistCoverageRow[] = (mobileToday?.stores ?? []).flatMap((store) =>
    (mobileToday?.templates ?? []).map((template) => {
      const rowKey = getCoverageRowKey(store.storeId, template.checklistTemplateId)
      const active = mobileToday?.activeInstances.find(
        (item) =>
          item.storeId === store.storeId &&
          item.checklistTemplateId === template.checklistTemplateId,
      ) ?? localActiveInstances[rowKey]
      const matchingSummaries = (mobileToday?.monthlySummaries ?? []).filter(
        (item) =>
          item.storeId === store.storeId &&
          item.checklistTemplateId === template.checklistTemplateId,
      )
      const summary =
        selectedMonth === 'all'
          ? matchingSummaries[0]
          : matchingSummaries.find((item) => getMonthKey(item.monthStart) === selectedMonth)

      return {
        store,
        template,
        active,
        summary,
        completedCount: summary?.completedCount ?? 0,
      }
    }),
  )
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
  const filteredPendingItems = sortChecklistItems(
    pendingItems.filter((item) =>
      doesChecklistItemMatchFilters(item, {
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
  const pendingVisitStoreCount = incompleteVisitStoreRows.length
  const priorityVisitRows = visitStoreRows.filter(hasOpenStoreVisitWork)
  const priorityActions = buildChecklistPriorityActions({
    canManageVisits,
    items: filteredPendingItems,
    locale,
    requiresCombinedVisitTemplates,
    rows: priorityVisitRows,
    t,
  })
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
  const commandNotice = ackNotice ?? (completeVisitMutation.isSuccess ? t('storeChecklists.completeSuccess') : null)
  const checklistTabs: ChecklistTabOption[] = [
    ...(canManageVisits
      ? [
          {
            key: 'visits' as const,
            label: t('storeChecklists.visitEyebrow'),
            count: visitStoreRows.length,
            tone: activeVisitCount > 0 ? 'warning' as const : 'accent' as const,
          },
        ]
      : []),
    ...(canUseAcknowledgements
      ? [
          {
            key: 'inbox' as const,
            label: t('storeChecklists.inboxEyebrow'),
            count: filteredPendingItems.length,
            tone: filteredPendingItems.length > 0 ? 'warning' as const : 'calm' as const,
          },
        ]
      : []),
    ...(canManageVisits
      ? [
          {
            key: 'incomplete' as const,
            label: getStaticCopy(locale, 'Tamamlanmayanlar', 'Incomplete'),
            count: incompleteVisitStoreRows.length,
            tone: incompleteVisitStoreRows.length > 0 ? 'warning' as const : 'calm' as const,
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
    navigate(
      {
        pathname: location.pathname,
        search: buildChecklistSearch(location.search, { result: null, tab }),
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
          <ChecklistAttentionBanner
            count={priorityActions.totalCount}
            locale={locale}
            onClick={() => selectChecklistTab(canManageVisits ? 'visits' : 'inbox')}
          />

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

          {commandNotice ? <p className="store-checklists-inline-notice">{commandNotice}</p> : null}

          {canManageVisits ? (
            <StoreChecklistsVisitPanel
              activeVisitCount={activeVisitCount}
              assignedStoreIds={assignedStoreIds}
              assignedVisitStoreCount={assignedVisitStoreCount}
              authSummary={input.authSummary}
              display={{
                requiresCombinedVisitTemplates,
                showBmVisitScore,
                showVmVisitScore,
                vmOnlyVisitScope,
              }}
              errors={{
                complete: completeVisitMutation.isError ? completeVisitMutation.error : null,
                save: saveResponseMutation.isError ? saveResponseMutation.error : null,
                start: startVisitMutation.isError ? startVisitMutation.error : null,
              }}
              hydrateActiveResponseDrafts={hydrateActiveResponseDrafts}
              incompleteVisitStoreRows={incompleteVisitStoreRows}
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

        <ChecklistPriorityRail
          actions={priorityActions.items}
          locale={locale}
          totalCount={priorityActions.totalCount}
        />
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
          showCommandNotice(getStaticCopy(locale, 'Başarıyla Tamamlandı', 'Completed successfully'))
          dispatchPageState({ type: 'completeVisitSubmitted' })
          completeVisitMutation.mutate({
            checklistInstanceId,
            responses: buildChecklistResponseDrafts({
              checklistInstanceId,
              comments,
              scores,
              session: selectedSession,
            }),
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
        onSaveSessionDraft={(checklistInstanceId) => {
          if (!selectedSession) return
          const responseDrafts = buildChecklistResponseDrafts({
            checklistInstanceId,
            comments,
            scores,
            session: selectedSession,
          })
          void savePendingSessionResponses(checklistInstanceId, responseDrafts)
            .then(() => {
              dispatchPageState({ type: 'saveResponseSucceeded' })
              void queryClient.invalidateQueries({ queryKey: ['mobile-checklists-today'] })
              showCommandNotice(t('storeChecklists.responseSaved'))
            })
            .catch((error) => {
              showCommandNotice(getErrorMessage(error))
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
