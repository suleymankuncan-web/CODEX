import { useMemo, useReducer, useRef, useState, type ComponentType } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowRight,
  Bookmark,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Cloud,
  FileText,
  Inbox,
  ListChecks,
  MinusCircle,
  RefreshCw,
  Store,
  TrendingDown,
  UserRound,
  XIcon,
} from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
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
import type { TranslateFunction } from '../features/localization/dictionary'
import { useLocalization } from '../features/localization/useLocalization'
import { formatNumber, getErrorMessage } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import { transientQueryRetryOptions } from '../lib/query-retry'
import {
  buildChecklistSearch,
  createInitialStoreChecklistsState,
  storeChecklistCommandNotice,
  storeChecklistsReducer,
  type ChecklistCoverageRow,
  type ChecklistResponseDraft,
  type ChecklistSession,
  type ChecklistStoreVisitRow,
  type ChecklistTab,
  type ChecklistTabOption,
  type ChecklistTone,
} from './store-checklists-model'
import {
  buildChecklistResponseDrafts,
  buildChecklistStoreVisitRows,
  buildMonthOptions,
  doesChecklistItemMatchFilters,
  doesCoverageRowMatchFilters,
  formatMonthKey,
  formatChecklistStatus,
  getChecklistResultDigest,
  getChecklistHeroScopeLabel,
  getChecklistResponseDraftKey,
  getChecklistTypeFilterOptions,
  getCoverageRowKey,
  getCoverageRowKeyFromRow,
  getMonthKey,
  getScoreQuickOptions,
  getStaticCopy,
  getStoreVisitRiskLabel,
  getStoreVisitRiskTone,
  getStoreVisitRowKey,
  getStoreVisitScore,
  groupChecklistTemplateItems,
  hasOpenStoreVisitWork,
  isVisualMerchandiserOnly,
  parseChecklistScoreInput,
  serializeChecklistResponseDraft,
  sortChecklistItems,
  sortCoverageRows,
  sortStoreVisitRows,
} from './store-checklists-logic'
import {
  ChecklistBadge,
  ChecklistEmptyBlock,
} from './store-checklists-atoms'
import { StoreChecklistsAcknowledgementPanels } from './store-checklists-acknowledgement-panels'
import { ChecklistTabs, ChecklistToolbar } from './store-checklists-controls'
import { StoreChecklistsHero } from './store-checklists-hero'
import { ChecklistResultModal } from './store-checklists-result-modal'
import { StoreChecklistsVisitPanel } from './store-checklists-visit-panel'
import {
  StoreErrorState,
  StoreLoadingState,
  StoreSurfacePage,
} from './store-surface-primitives'

type ChecklistTemplateItem = ChecklistSession['template']['items'][number]
type ChecklistVisitItemEntry = {
  item: ChecklistTemplateItem
  itemIndex: number
  sectionIndex: number
  sectionName: string
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

type ChecklistPriorityAction = {
  copy: string
  id: string
  title: string
  tone: ChecklistTone
  value: string
  variant: 'visit' | 'inbox'
}

function ChecklistAttentionBanner(input: {
  count: number
  locale: AppLocale
  onClick: () => void
}) {
  const hasPriority = input.count > 0

  return (
    <section
      className={`store-checklists-attention ${hasPriority ? 'store-checklists-attention-active' : ''}`}
      aria-label={getStaticCopy(input.locale, 'Checklist öncelik bildirimi', 'Checklist priority notice')}
    >
      <div className="store-checklists-attention-copy">
        <span className="store-checklists-attention-icon" aria-hidden="true">
          <AlertTriangle />
        </span>
        <div>
          <strong>
            {hasPriority
              ? getStaticCopy(
                  input.locale,
                  `${input.count} mağaza öncelikli aksiyon bekliyor`,
                  `${input.count} stores need priority action`,
                )
              : getStaticCopy(input.locale, 'Öncelikli aksiyon yok', 'No priority action')}
          </strong>
          <p>
            {hasPriority
              ? getStaticCopy(
                  input.locale,
                  'Düşük skor, taslak veya tamamlanmayan checklistler ana listede işaretlendi.',
                  'Low score, draft, or incomplete checklists are marked in the main list.',
                )
              : getStaticCopy(
                  input.locale,
                  'Seçili filtrelerde kritik takip gerektiren checklist kaydı görünmüyor.',
                  'No critical checklist follow-up is visible for the selected filters.',
                )}
          </p>
        </div>
      </div>
      {hasPriority ? (
        <Button className="store-checklists-attention-action" type="button" variant="outline" onClick={input.onClick}>
          {getStaticCopy(input.locale, 'Öncelikleri incele', 'Review priorities')}
          <ArrowRight data-icon="inline-end" />
        </Button>
      ) : null}
    </section>
  )
}

function ChecklistPriorityRail(input: {
  actions: ChecklistPriorityAction[]
  locale: AppLocale
  totalCount: number
}) {
  return (
    <aside className="store-checklists-priority-rail" aria-label={getStaticCopy(input.locale, 'Öncelikli aksiyonlar', 'Priority actions')}>
      <div className="store-checklists-priority-card">
        <div className="store-checklists-priority-head">
          <div>
            <span className="store-checklists-priority-icon" aria-hidden="true">
              <TrendingDown />
            </span>
            <strong>{getStaticCopy(input.locale, 'Öncelikli aksiyonlar', 'Priority actions')}</strong>
          </div>
          <span>{input.totalCount}</span>
        </div>
        {input.actions.length > 0 ? (
          <div className="store-checklists-priority-list">
            {input.actions.map((action) => (
              <div className="store-checklists-priority-row" key={action.id}>
                <i className={`store-checklists-priority-dot store-checklists-tone-${action.tone}`} />
                <div>
                  <strong>{action.title}</strong>
                  <span>{action.copy}</span>
                </div>
                <b className={`store-checklists-priority-value store-checklists-tone-${action.tone}`}>
                  {action.value}
                </b>
              </div>
            ))}
          </div>
        ) : (
          <div className="store-checklists-priority-empty">
            <Inbox aria-hidden="true" />
            <span>{getStaticCopy(input.locale, 'Seçili filtrelerde takip kaydı yok.', 'No follow-up record in selected filters.')}</span>
          </div>
        )}
      </div>
    </aside>
  )
}

function buildChecklistPriorityActions(input: {
  canManageVisits: boolean
  items: ChecklistAcknowledgementItem[]
  locale: AppLocale
  requiresCombinedVisitTemplates: boolean
  rows: ChecklistStoreVisitRow[]
  t: TranslateFunction
}): { items: ChecklistPriorityAction[]; totalCount: number } {
  if (input.canManageVisits) {
    const actions = input.rows.map((row) => {
      const score = getStoreVisitScore(row)
      const tone = getStoreVisitRiskTone(row, input.requiresCombinedVisitTemplates)
      return {
        copy: getStoreVisitRiskLabel(input.t, input.locale, row, input.requiresCombinedVisitTemplates),
        id: getStoreVisitRowKey(row),
        title: row.store.storeName,
        tone,
        value:
          score === null
            ? '-'
            : formatNumber(score, input.locale, { maximumFractionDigits: 1 }),
        variant: 'visit' as const,
      }
    })

    return {
      items: actions.slice(0, 5),
      totalCount: actions.length,
    }
  }

  const actions = input.items.map((item) => {
    const digest = getChecklistResultDigest(input.t, input.locale, item)
    const score = item.totalScore ?? (typeof item.complianceRate === 'number' ? item.complianceRate * 100 : null)

    return {
      copy: digest.copy,
      id: item.checklistInstanceId,
      title: item.storeName || item.storeId,
      tone: digest.tone,
      value:
        score === null
          ? '-'
          : formatNumber(score, input.locale, { maximumFractionDigits: 1 }),
      variant: 'inbox' as const,
    }
  })

  return {
    items: actions.slice(0, 5),
    totalCount: actions.length,
  }
}

function isIncompleteStoreVisitRow(row: ChecklistStoreVisitRow, requiresCombinedVisitTemplates: boolean) {
  const visibleRows = [row.bm, row.vm].filter(Boolean)
  if (visibleRows.length === 0) return true
  if (requiresCombinedVisitTemplates) {
    return visibleRows.some((item) => (item?.completedCount ?? 0) === 0)
  }
  return visibleRows.every((item) => (item?.completedCount ?? 0) === 0)
}

function StoreChecklistsModals(input: {
  acknowledgementNote: string
  comments: Record<string, string>
  locale: AppLocale
  resultState: {
    acknowledging: boolean
    canAcknowledge: boolean
  }
  scores: Record<string, number>
  selectedResult: ChecklistAcknowledgementItem | null
  selectedSession: ChecklistSession | null
  t: TranslateFunction
  visitState: {
    completing: boolean
    saving: boolean
    starting: boolean
  }
  onAcknowledgeResult: (acknowledgementNote: string) => void
  onCloseResult: () => void
  onCloseSession: () => void
  onCommentChange: (templateItemId: string, comment: string) => void
  onCompleteVisit: (checklistInstanceId: string) => void
  onNoteChange: (note: string) => void
  onSaveSessionDraft: (checklistInstanceId: string) => void
  onScoreChange: (templateItemId: string, score: number | null) => void
}) {
  return (
    <>
      {input.selectedSession ? (
        <ChecklistVisitModal
          active={input.selectedSession.active}
          comments={input.comments}
          isCompleting={input.visitState.completing}
          isSaving={input.visitState.saving}
          isStarting={input.visitState.starting}
          locale={input.locale}
          onClose={input.onCloseSession}
          onComplete={input.onCompleteVisit}
          onSaveDraft={input.onSaveSessionDraft}
          onScoreChange={input.onScoreChange}
          onCommentChange={input.onCommentChange}
          scores={input.scores}
          session={input.selectedSession}
          t={input.t}
        />
      ) : null}

      {input.selectedResult ? (
        <ChecklistResultModal
          acknowledgementNote={input.acknowledgementNote}
          canAcknowledge={input.resultState.canAcknowledge}
          isAcknowledging={input.resultState.acknowledging}
          item={input.selectedResult}
          locale={input.locale}
          onAcknowledge={input.onAcknowledgeResult}
          onClose={input.onCloseResult}
          onNoteChange={input.onNoteChange}
          t={input.t}
        />
      ) : null}
    </>
  )
}
function ChecklistVisitModal(input: {
  active: MobileChecklistToday['activeInstances'][number] | undefined
  comments: Record<string, string>
  isCompleting: boolean
  isSaving: boolean
  isStarting: boolean
  locale: AppLocale
  onClose: () => void
  onCommentChange: (templateItemId: string, comment: string) => void
  onComplete: (checklistInstanceId: string) => void
  onSaveDraft: (checklistInstanceId: string) => void
  onScoreChange: (templateItemId: string, score: number | null) => void
  scores: Record<string, number>
  session: ChecklistSession
  t: TranslateFunction
}) {
  const sections = useMemo(
    () => groupChecklistTemplateItems(input.session.template.items),
    [input.session.template.items],
  )
  const itemEntries = useMemo<ChecklistVisitItemEntry[]>(
    () =>
      sections.flatMap((section, sectionIndex) =>
        section.items.map((item, itemIndex) => ({
          item,
          itemIndex,
          sectionIndex,
          sectionName: section.name,
        })),
      ),
    [sections],
  )
  const hasItems = input.session.template.items.length > 0
  const firstItemId = itemEntries[0]?.item.templateItemId ?? null
  const [activeItemId, setActiveItemId] = useState<string | null>(firstItemId)

  const activeIndex = Math.max(
    itemEntries.findIndex((entry) => entry.item.templateItemId === activeItemId),
    0,
  )
  const activeEntry = itemEntries[activeIndex]
  const answeredCount = input.session.template.items.filter(
    (item) => Number.isFinite(input.scores[item.templateItemId]),
  ).length
  const progressPercent = hasItems
    ? Math.round((answeredCount / input.session.template.items.length) * 100)
    : 0
  let scoredRatioTotal = 0
  let scoredRatioCount = 0

  for (const item of input.session.template.items) {
    const score = input.scores[item.templateItemId]
    if (typeof score !== 'number' || !Number.isFinite(score) || item.maxScore <= 0) continue
    scoredRatioTotal += Math.round((score / item.maxScore) * 100)
    scoredRatioCount += 1
  }

  const currentScore =
    scoredRatioCount > 0 ? Math.round(scoredRatioTotal / scoredRatioCount) : 0
  const missingResponseCount = Math.max(input.session.template.items.length - answeredCount, 0)
  const canComplete =
    Boolean(input.active) && !input.isCompleting && hasItems && missingResponseCount === 0
  const sessionStatus = input.active
    ? formatChecklistStatus(input.t, input.active.status)
    : input.t('storeChecklists.newVisit')

  const goToItem = (nextIndex: number) => {
    const nextEntry = itemEntries[nextIndex]
    if (!nextEntry) return
    setActiveItemId(nextEntry.item.templateItemId)
  }

  const goToSection = (sectionIndex: number) => {
    const section = sections[sectionIndex]
    if (!section) return
    const firstUnansweredItem = section.items.find(
      (item) => !Number.isFinite(input.scores[item.templateItemId]),
    )
    setActiveItemId((firstUnansweredItem ?? section.items[0])?.templateItemId ?? null)
  }

  return (
    <Dialog open onOpenChange={(open) => {
      if (!open) input.onClose()
    }}>
      <DialogContent
        className="store-checklist-session-dialog tw:max-w-[min(940px,calc(100vw-1.5rem))] tw:sm:max-w-[min(940px,calc(100vw-1.5rem))]"
        closeLabel={input.t('storeChecklists.closeSession')}
        showCloseButton={false}
      >
        <div className="store-checklist-session-shell">
          <DialogHeader className="store-checklist-session-topbar">
            <Button
              aria-label={input.t('storeChecklists.closeSession')}
              size="icon-sm"
              type="button"
              variant="ghost"
              onClick={input.onClose}
            >
              <XIcon data-icon="inline-start" />
            </Button>
            <div className="store-checklist-session-title-block">
              <DialogTitle className="store-checklist-session-title">
                {input.t('storeChecklists.sessionTitle')}
              </DialogTitle>
              <DialogDescription className="store-checklist-session-subtitle">
                {input.session.template.templateName}
              </DialogDescription>
            </div>
            <Button
              className="store-checklist-session-draft-button"
              disabled={!input.active || input.isSaving || input.isStarting}
              size="sm"
              type="button"
              variant="outline"
              onClick={() => {
                if (!input.active) return
                input.onSaveDraft(input.active.checklistInstanceId)
              }}
            >
              <Cloud data-icon="inline-start" />
              {input.isSaving
                ? input.t('storeChecklists.draftSaving')
                : input.t('storeChecklists.draftSave')}
            </Button>
          </DialogHeader>

          <section className="store-checklist-session-summary" aria-label={input.t('storeChecklists.summaryAria')}>
            <span className="store-checklist-session-store-icon" aria-hidden="true">
              <Store />
            </span>
            <div className="store-checklist-session-summary-copy">
              <div className="store-checklist-session-summary-title-row">
                <h3>{input.session.store.storeName}</h3>
                <ChecklistBadge tone={input.active ? 'warning' : 'accent'}>{sessionStatus}</ChecklistBadge>
              </div>
              <p>
                {input.session.template.templateCode} - v{input.session.template.versionNo}
              </p>
            </div>
            <div className="store-checklist-session-score" data-tone={currentScore >= 70 ? 'calm' : 'warning'}>
              <span>{input.t('storeChecklists.liveScore')}</span>
              <strong>{currentScore}</strong>
            </div>
            <div className="store-checklist-session-progress">
              <div>
                <span>{input.t('storeChecklists.progress')}</span>
                <strong>
                  {answeredCount} / {input.session.template.items.length}
                </strong>
              </div>
              <Progress value={progressPercent} />
            </div>
          </section>

          {!hasItems ? (
            <ChecklistEmptyBlock
              copy={input.t('storeChecklists.emptyTemplateCopy')}
              title={input.t('storeChecklists.emptyTemplateTitle')}
            />
          ) : (
            <>
              <nav className="store-checklist-session-section-rail" aria-label={input.t('storeChecklists.section')}>
                {sections.map((section, sectionIndex) => {
                  const sectionAnsweredCount = section.items.filter((item) =>
                    Number.isFinite(input.scores[item.templateItemId]),
                  ).length
                  const SectionIcon = getChecklistSessionSectionIcon(sectionIndex)
                  const isActiveSection = activeEntry?.sectionIndex === sectionIndex
                  return (
                    <button
                      aria-current={isActiveSection ? 'step' : undefined}
                      className={cn(
                        'store-checklist-session-section-tab',
                        isActiveSection && 'store-checklist-session-section-tab-active',
                      )}
                      key={section.name}
                      type="button"
                      onClick={() => goToSection(sectionIndex)}
                    >
                      <SectionIcon aria-hidden={true} />
                      <span>{section.name}</span>
                      <strong>
                        {sectionAnsweredCount} / {section.items.length}
                      </strong>
                    </button>
                  )
                })}
              </nav>

              {activeEntry ? (
                <article className="store-checklist-session-question-card">
                  <div className="store-checklist-session-question-meta">
                    <span>
                      {activeEntry.itemIndex + 1} / {sections[activeEntry.sectionIndex]?.items.length ?? 0}
                    </span>
                    <span>
                      {activeIndex + 1} / {itemEntries.length}
                    </span>
                    <Button
                      aria-label={getStaticCopy(input.locale, 'Maddeyi işaretle', 'Mark item')}
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                    >
                      <Bookmark data-icon="inline-start" />
                    </Button>
                  </div>
                  <div className="store-checklist-session-question-copy">
                    <h3>{activeEntry.item.itemText}</h3>
                    <p>
                      {input.t('storeChecklists.itemMeta', {
                        maxScore: activeEntry.item.maxScore,
                        weight: activeEntry.item.weight,
                      })}{' '}
                      - {getChecklistResponseTypeLabel(input.locale, activeEntry.item.responseType)}
                    </p>
                  </div>

                  <ChecklistSessionAnswerControl
                    disabled={!input.active}
                    item={activeEntry.item}
                    locale={input.locale}
                    score={input.scores[activeEntry.item.templateItemId]}
                    t={input.t}
                    onScoreChange={input.onScoreChange}
                  />

                  <label className="store-checklist-session-note-field">
                    <span>
                      {input.t('storeChecklists.noteInput')}{' '}
                      <small>{getStaticCopy(input.locale, '(opsiyonel)', '(optional)')}</small>
                    </span>
                    <Textarea
                      disabled={!input.active}
                      maxLength={500}
                      rows={3}
                      value={input.comments[activeEntry.item.templateItemId] ?? ''}
                      onChange={(event) =>
                        input.onCommentChange(activeEntry.item.templateItemId, event.target.value)
                      }
                    />
                  </label>

                  <ChecklistSessionPhotoPanel active={Boolean(input.active)} locale={input.locale} t={input.t} />

                  <div className="store-checklist-session-question-actions">
                    <Button
                      disabled={activeIndex <= 0}
                      type="button"
                      variant="outline"
                      onClick={() => goToItem(activeIndex - 1)}
                    >
                      <ChevronLeft data-icon="inline-start" />
                      {input.t('storeChecklists.previousItem')}
                    </Button>
                    <Button
                      disabled={activeIndex >= itemEntries.length - 1}
                      type="button"
                      onClick={() => goToItem(activeIndex + 1)}
                    >
                      {input.t('storeChecklists.nextItem')}
                      <ChevronRight data-icon="inline-end" />
                    </Button>
                  </div>
                </article>
              ) : null}
            </>
          )}

          <div className="store-checklist-session-footer">
            <div className="store-checklist-session-state">
              {!input.active && input.isStarting ? (
                <span>{input.t('storeChecklists.startPending')}</span>
              ) : missingResponseCount > 0 ? (
                <span>{input.t('storeChecklists.missingResponsesHint', { count: missingResponseCount })}</span>
              ) : input.isSaving ? (
                <span>{input.t('storeChecklists.autosaving')}</span>
              ) : (
                <span>{input.t('storeChecklists.draftSaved')}</span>
              )}
            </div>
            <div className="store-checklist-session-footer-actions">
              <Button type="button" variant="outline" onClick={input.onClose}>
                {input.t('storeChecklists.cancelSession')}
              </Button>
              <Button
                disabled={!canComplete}
                type="button"
                onClick={() => {
                  if (!input.active) return
                  if (!window.confirm(input.t('storeChecklists.completeSessionConfirm'))) return
                  input.onComplete(input.active.checklistInstanceId)
                }}
              >
                <CheckCircle2 data-icon="inline-start" />
                {input.isCompleting
                  ? input.t('storeChecklists.completing')
                  : input.t('storeChecklists.complete')}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ChecklistSessionAnswerControl(input: {
  disabled: boolean
  item: ChecklistTemplateItem
  locale: AppLocale
  onScoreChange: (templateItemId: string, score: number | null) => void
  score: number | undefined
  t: TranslateFunction
}) {
  const scoreValue = Number.isFinite(input.score) ? String(input.score) : undefined
  const scoreOptions = getChecklistScoreScaleOptions(input.item.maxScore)
  const choiceOptions = getChecklistChoiceOptions(input.locale, input.item)

  if (choiceOptions.length > 0) {
    return (
      <div className="store-checklist-session-answer-block">
        <div className="store-checklist-session-answer-heading">
          <span>{input.t('storeChecklists.scoreInput')}</span>
          <small>
            {input.t('storeChecklists.responseType')}: {getChecklistResponseTypeLabel(input.locale, input.item.responseType)}
          </small>
        </div>
        <ToggleGroup
          className="store-checklist-session-choice-grid"
          disabled={input.disabled}
          type="single"
          value={scoreValue ?? ''}
          onValueChange={(value) => {
            if (!value) return
            input.onScoreChange(input.item.templateItemId, Number(value))
          }}
        >
          {choiceOptions.map((option) => (
            <ToggleGroupItem
              className="store-checklist-session-choice"
              data-tone={option.tone}
              key={`${option.label}-${option.value}`}
              value={String(option.value)}
            >
              <span>{option.icon}</span>
              <strong>{option.label}</strong>
              <small>{option.caption}</small>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    )
  }

  return (
    <div className="store-checklist-session-answer-block">
      <div className="store-checklist-session-answer-heading">
        <span>{input.t('storeChecklists.scoreInput')}</span>
        <small>
          {input.item.responseType === 'text'
            ? input.t('storeChecklists.textAnswerScoreHint')
            : input.t('storeChecklists.scoreScaleHint')}
        </small>
      </div>
      {scoreOptions.length > 0 ? (
        <ToggleGroup
          className="store-checklist-session-score-scale"
          disabled={input.disabled}
          type="single"
          value={scoreValue ?? ''}
          onValueChange={(value) => {
            if (!value) return
            input.onScoreChange(input.item.templateItemId, Number(value))
          }}
        >
          {scoreOptions.map((value) => (
            <ToggleGroupItem
              className="store-checklist-session-scale-item"
              key={value}
              value={String(value)}
            >
              {value}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      ) : (
        <Input
          disabled={input.disabled}
          max={input.item.maxScore}
          min={0}
          type="number"
          value={input.score ?? ''}
          onChange={(event) =>
            input.onScoreChange(
              input.item.templateItemId,
              parseChecklistScoreInput(event.target.value, input.item.maxScore),
            )
          }
        />
      )}
    </div>
  )
}

function ChecklistSessionPhotoPanel(input: {
  active: boolean
  locale: AppLocale
  t: TranslateFunction
}) {
  return (
    <div className="store-checklist-session-photo-panel">
      <div>
        <span>{input.t('storeChecklists.photoTitle')}</span>
        <small>{input.t('storeChecklists.photoCopy')}</small>
      </div>
      <div className="store-checklist-session-photo-row">
        <Button className="store-checklist-session-photo-button" disabled type="button" variant="outline">
          <Camera data-icon="inline-start" />
          {input.t('storeChecklists.photoAdd')}
        </Button>
        <div className="store-checklist-session-photo-placeholder" aria-hidden="true">
          <Camera />
          <span>{getStaticCopy(input.locale, 'Hazır değil', 'Not ready')}</span>
        </div>
      </div>
    </div>
  )
}

function getChecklistSessionSectionIcon(index: number): ComponentType<{ 'aria-hidden'?: boolean }> {
  const icons = [Store, ListChecks, UserRound, FileText]
  return icons[index % icons.length] ?? ListChecks
}

function getChecklistResponseTypeLabel(
  locale: AppLocale,
  responseType: ChecklistTemplateItem['responseType'],
) {
  switch (responseType) {
    case 'yes_no':
      return getStaticCopy(locale, 'Evet / Hayır', 'Yes / No')
    case 'partial':
      return getStaticCopy(locale, 'Kısmi', 'Partial')
    case 'text':
      return getStaticCopy(locale, 'Metin', 'Text')
    case 'score':
    default:
      return getStaticCopy(locale, 'Skor', 'Score')
  }
}

function getChecklistScoreScaleOptions(maxScore: number) {
  if (!Number.isInteger(maxScore) || maxScore < 1 || maxScore > 10) return []
  return Array.from({ length: maxScore + 1 }, (_item, index) => index)
}

function getChecklistChoiceOptions(locale: AppLocale, item: ChecklistTemplateItem) {
  const maxScore = Math.max(0, item.maxScore)

  if (item.responseType === 'yes_no') {
    return [
      {
        caption: formatChecklistPointLabel(locale, maxScore),
        icon: <CheckCircle2 aria-hidden="true" />,
        label: getStaticCopy(locale, 'Evet', 'Yes'),
        tone: 'good',
        value: maxScore,
      },
      {
        caption: formatChecklistPointLabel(locale, 0),
        icon: <MinusCircle aria-hidden="true" />,
        label: getStaticCopy(locale, 'Hayır', 'No'),
        tone: 'critical',
        value: 0,
      },
    ]
  }

  if (item.responseType === 'partial') {
    const [good, watch, critical] = getScoreQuickOptions(locale, maxScore)
    return [
      {
        caption: formatChecklistPointLabel(locale, good?.value ?? maxScore),
        icon: <CheckCircle2 aria-hidden="true" />,
        label: getStaticCopy(locale, 'Uygun', 'Good'),
        tone: 'good',
        value: good?.value ?? maxScore,
      },
      {
        caption: formatChecklistPointLabel(locale, watch?.value ?? Math.round(maxScore * 0.6)),
        icon: <CircleAlert aria-hidden="true" />,
        label: getStaticCopy(locale, 'Takip', 'Watch'),
        tone: 'watch',
        value: watch?.value ?? Math.round(maxScore * 0.6),
      },
      {
        caption: formatChecklistPointLabel(locale, critical?.value ?? Math.round(maxScore * 0.2)),
        icon: <MinusCircle aria-hidden="true" />,
        label: getStaticCopy(locale, 'Kritik', 'Critical'),
        tone: 'critical',
        value: critical?.value ?? Math.round(maxScore * 0.2),
      },
    ]
  }

  return []
}

function formatChecklistPointLabel(locale: AppLocale, value: number) {
  return `${value} ${getStaticCopy(locale, 'puan', 'pts')}`
}
