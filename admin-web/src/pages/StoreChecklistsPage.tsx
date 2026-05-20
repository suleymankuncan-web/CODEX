import { useEffect, useReducer, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ScreenState } from '../components/dashboard-primitives'
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
import { formatDateTime, formatNumber, getErrorMessage } from '../lib/format'
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
  type ChecklistSort,
  type ChecklistSortKey,
  type ChecklistStatusFilter,
  type ChecklistTab,
  type ChecklistTabOption,
  type ChecklistTypeFilter,
} from './store-checklists-model'
import {
  buildChecklistResponseDrafts,
  buildChecklistStoreVisitRows,
  buildMonthOptions,
  doesChecklistItemMatchFilters,
  doesCoverageRowMatchFilters,
  formatChecklistStatus,
  formatChecklistTemplateType,
  formatCompletedSentence,
  formatComplianceValue,
  formatScoreValue,
  getChecklistHeroScopeLabel,
  getChecklistResponseDraftKey,
  getChecklistResultDigest,
  getChecklistTypeFilterOptions,
  getCoverageRowKey,
  getCoverageRowKeyFromRow,
  getLowScoreResponses,
  getResponseRatio,
  getScoreQuickOptions,
  getStaticCopy,
  getStoreVisitScore,
  groupChecklistResultResponses,
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
  ChecklistFact,
  ChecklistMetric,
  ChecklistScoreBar,
  SortButton,
} from './store-checklists-atoms'
import { StoreChecklistsVisitPanel } from './store-checklists-visit-panel'

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
          commentText: response.commentText ?? undefined,
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
      const summary = mobileToday?.monthlySummaries.find(
        (item) =>
          item.storeId === store.storeId &&
          item.checklistTemplateId === template.checklistTemplateId,
      )

      return {
        store,
        template,
        active,
        summary,
        completedCount: summary?.completedCount ?? 0,
      }
    }),
  )
  const monthOptions = buildMonthOptions(coverageRows, items, locale)
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
  const pendingVisitStoreCount = visitStoreRows.filter(hasOpenStoreVisitWork).length
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
      <ScreenState
        title={t('storeChecklists.loadingTitle')}
        copy={t('storeChecklists.loadingCopy')}
      />
    )
  }

  if (isError) {
    return (
      <ScreenState
        title={t('storeChecklists.errorTitle')}
        copy={errorMessage}
        tone="error"
        action={
          <button
            type="button"
            className="control-button"
            disabled={isRetrying}
            onClick={retryChecklistQueries}
          >
            <RefreshCw size={16} />
            {isRetrying ? t('storeChecklists.retryingAction') : t('storeChecklists.retryAction')}
          </button>
        }
      />
    )
  }

  return (
    <section className="store-checklists-command-page">
      <StoreChecklistsHero
        canManageVisits={canManageVisits}
        heroAverageScore={heroAverageScore}
        heroCompletedCount={heroCompletedCount}
        heroScopeLabel={heroScopeLabel}
        heroStoreCount={heroStoreCount}
        heroWaitingCount={heroWaitingCount}
        locale={locale}
        t={t}
        vmOnlyVisitScope={vmOnlyVisitScope}
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
            acknowledgementNote: acknowledgementNote.trim() || undefined,
          })
        }}
        onCloseResult={closeChecklistResult}
        onCloseSession={closeSession}
        onCommentChange={(templateItemId, comment) => {
          dispatchPageState({ type: 'setCommentDraft', templateItemId, comment })
          const score = scores[templateItemId]
          if (selectedSession?.active && Number.isFinite(score)) {
            queueResponseAutoSave({
              checklistInstanceId: selectedSession.active.checklistInstanceId,
              templateItemId,
              scoreValue: score,
              commentText: comment || undefined,
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
        onScoreChange={(templateItemId, score) => {
          dispatchPageState({ type: 'setScoreDraft', templateItemId, score })
          if (selectedSession?.active && score !== null) {
            queueResponseAutoSave({
              checklistInstanceId: selectedSession.active.checklistInstanceId,
              templateItemId,
              scoreValue: score,
              commentText: comments[templateItemId] || undefined,
            })
          }
        }}
      />

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
    </section>
  )
}

export function StoreChecklistsPage(input: {
  authSummary: AuthSessionSummary | null
}) {
  return useStoreChecklistsPageContent(input)
}

function StoreChecklistsHero(input: {
  canManageVisits: boolean
  heroAverageScore: number | null
  heroCompletedCount: number
  heroScopeLabel: string
  heroStoreCount: number
  heroWaitingCount: number
  locale: AppLocale
  t: TranslateFunction
  vmOnlyVisitScope: boolean
}) {
  const {
    canManageVisits,
    heroAverageScore,
    heroCompletedCount,
    heroScopeLabel,
    heroStoreCount,
    heroWaitingCount,
    locale,
    t,
    vmOnlyVisitScope,
  } = input

  return (
    <header className="store-checklists-command-hero">
      <div className="store-checklists-hero-copy">
        <div className="store-checklists-hero-pills" aria-label={t('storeChecklists.summaryAria')}>
          <ChecklistBadge tone="accent">{heroScopeLabel}</ChecklistBadge>
          <ChecklistBadge tone={heroWaitingCount > 0 ? 'warning' : 'calm'}>
            {getStaticCopy(
              locale,
              `${formatNumber(heroWaitingCount, locale)} mağaza bekliyor`,
              `${formatNumber(heroWaitingCount, locale)} stores waiting`,
            )}
          </ChecklistBadge>
          <ChecklistBadge tone={heroCompletedCount > 0 ? 'calm' : 'neutral'}>
            {getStaticCopy(
              locale,
              `${formatNumber(heroCompletedCount, locale)} kayıt tamamlandı`,
              `${formatNumber(heroCompletedCount, locale)} records completed`,
            )}
          </ChecklistBadge>
        </div>
        <div className="store-checklists-eyebrow">{t('storeChecklists.heroEyebrow')}</div>
        <h2>
          {canManageVisits
            ? getStaticCopy(
                locale,
                'Bugünkü saha turunda öncelik düşük checklist skorlu mağazalarda.',
                'Today’s field route prioritizes stores with low checklist scores.',
              )
            : getStaticCopy(
                locale,
                'Mağazana yapılan kontroller tek ekranda.',
                'Your store checklist receipts stay in one focused surface.',
              )}
        </h2>
        <p>
          {canManageVisits
            ? vmOnlyVisitScope
              ? getStaticCopy(
                  locale,
                  'VM kullanıcıları yalnızca kendilerine atanmış mağazaların VM checklist akışını görür ve doldurur.',
                  'VM users only see and complete VM checklist flows for their assigned stores.',
                )
              : getStaticCopy(
                  locale,
                  'Bölge = Bölge müdürü. BM kendisine tanımlı mağazaları görür; BM Checklist ve VM Checklist puanlarını birlikte okuyabilir. VM yalnızca kendi VM Checklist kayıtlarına erişir.',
                  'Region means region manager. BM users see assigned stores and can read BM plus VM checklist scores together. VM users only access their own VM checklist records.',
                )
            : getStaticCopy(
                locale,
                'BM ve VM sonuçlarını tarih, skor ve kabul durumuyla takip edip mağaza aksiyonunu hızla kapatabilirsin.',
                'Track BM and VM results by date, score, and acknowledgement status so store follow-up stays tight.',
              )}
        </p>
      </div>
      <div className="store-checklists-command-metrics" aria-label={t('storeChecklists.summaryAria')}>
        <ChecklistMetric
          label={
            canManageVisits
              ? getStaticCopy(locale, 'Atanmış mağaza', 'Assigned stores')
              : t('storeChecklists.store')
          }
          note={
            canManageVisits
              ? vmOnlyVisitScope
                ? getStaticCopy(locale, 'VM kapsamı', 'VM scope')
                : getStaticCopy(locale, 'BM kapsamı', 'Field scope')
              : getStaticCopy(locale, 'Kabul kapsamı', 'Receipt scope')
          }
          tone={heroStoreCount > 0 ? 'accent' : 'neutral'}
          value={formatNumber(heroStoreCount, locale)}
        />
        <ChecklistMetric
          label={
            canManageVisits
              ? getStaticCopy(locale, 'Checklist yapılan', 'Completed visits')
              : t('storeChecklists.acknowledged')
          }
          note={
            canManageVisits
              ? getStaticCopy(locale, 'Bu ay', 'This month')
              : getStaticCopy(locale, 'Yakın geçmiş', 'Recent history')
          }
          tone={heroCompletedCount > 0 ? 'calm' : 'neutral'}
          value={formatNumber(heroCompletedCount, locale)}
        />
        <ChecklistMetric
          label={getStaticCopy(locale, 'Bekleyen', 'Waiting')}
          note={
            canManageVisits
              ? getStaticCopy(locale, 'Öncelik sıralı', 'Prioritized')
              : t('storeChecklists.needsAcknowledgement')
          }
          tone={heroWaitingCount > 0 ? 'warning' : 'calm'}
          value={formatNumber(heroWaitingCount, locale)}
        />
        <ChecklistMetric
          label={getStaticCopy(locale, 'Ortalama skor', 'Average score')}
          note={
            canManageVisits
              ? vmOnlyVisitScope
                ? getStaticCopy(locale, 'VM', 'VM')
                : getStaticCopy(locale, 'BM + VM', 'BM + VM')
              : getStaticCopy(locale, 'Son sonuçlar', 'Latest results')
          }
          tone={
            heroAverageScore !== null && heroAverageScore >= 70
              ? 'calm'
              : heroAverageScore === null
                ? 'neutral'
                : 'warning'
          }
          value={
            heroAverageScore === null
              ? '-'
              : formatNumber(heroAverageScore, locale, { maximumFractionDigits: 1 })
          }
        />
      </div>
    </header>
  )
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

function StoreChecklistsAcknowledgementPanels(input: {
  filteredAcknowledgedItems: ChecklistAcknowledgementItem[]
  filteredPendingItems: ChecklistAcknowledgementItem[]
  locale: AppLocale
  pendingItemCount: number
  resultSort: ChecklistSort
  selectedTab: ChecklistTab
  t: TranslateFunction
  onOpenResult: (item: ChecklistAcknowledgementItem) => void
  onToggleResultSort: (key: ChecklistSortKey) => void
}) {
  return (
    <>
      {input.selectedTab === 'inbox' ? (
        <section
          aria-labelledby="store-checklist-tab-inbox"
          className="store-checklists-command-card"
          id="store-checklist-panel-inbox"
          role="tabpanel"
        >
          <div className="store-checklists-section-head">
            <div>
              <div className="store-checklists-eyebrow">{input.t('storeChecklists.inboxEyebrow')}</div>
              <h3>{input.t('storeChecklists.inboxTitle')}</h3>
            </div>
            <ChecklistBadge tone={input.pendingItemCount > 0 ? 'warning' : 'calm'}>
              {input.pendingItemCount > 0
                ? input.t('storeChecklists.needsAcknowledgement')
                : input.t('storeChecklists.clear')}
            </ChecklistBadge>
          </div>

          {input.filteredPendingItems.length === 0 ? (
            <ChecklistEmptyBlock
              copy={input.t('storeChecklists.noPendingCopy')}
              title={input.t('storeChecklists.noPendingTitle')}
            />
          ) : (
            <ChecklistResultList
              items={input.filteredPendingItems}
              locale={input.locale}
              resultSort={input.resultSort}
              t={input.t}
              onOpen={input.onOpenResult}
              onSort={input.onToggleResultSort}
            />
          )}
        </section>
      ) : null}

      {input.selectedTab === 'history' ? (
        <section
          aria-labelledby="store-checklist-tab-history"
          className="store-checklists-command-card"
          id="store-checklist-panel-history"
          role="tabpanel"
        >
          <div className="store-checklists-section-head">
            <div>
              <div className="store-checklists-eyebrow">{input.t('storeChecklists.recentHistoryEyebrow')}</div>
              <h3>{input.t('storeChecklists.recentHistoryTitle')}</h3>
            </div>
          </div>

          {input.filteredAcknowledgedItems.length === 0 ? (
            <ChecklistEmptyBlock
              copy={input.t('storeChecklists.noAcknowledgementsCopy')}
              title={input.t('storeChecklists.noAcknowledgementsTitle')}
            />
          ) : (
            <ChecklistResultList
              items={input.filteredAcknowledgedItems}
              locale={input.locale}
              resultSort={input.resultSort}
              t={input.t}
              onOpen={input.onOpenResult}
              onSort={input.onToggleResultSort}
            />
          )}
        </section>
      ) : null}
    </>
  )
}

function ChecklistToolbar(input: {
  locale: AppLocale
  monthOptions: Array<{ label: string; value: string }>
  searchQuery: string
  selectedMonth: string
  statusFilter: ChecklistStatusFilter
  t: TranslateFunction
  typeFilter: ChecklistTypeFilter
  typeOptions: Array<{ value: ChecklistTypeFilter; label: string }>
  onClear: () => void
  onMonthChange: (value: string) => void
  onSearchChange: (value: string) => void
  onStatusChange: (value: ChecklistStatusFilter) => void
  onTypeChange: (value: ChecklistTypeFilter) => void
}) {
  return (
    <section className="store-checklists-toolbar" aria-label={getStaticCopy(input.locale, 'Checklist filtreleri', 'Checklist filters')}>
      <label className="store-checklists-filter store-checklists-filter-search">
        <span>{getStaticCopy(input.locale, 'Arama', 'Search')}</span>
        <input
          aria-label={getStaticCopy(input.locale, 'Checklist arama', 'Checklist search')}
          placeholder={getStaticCopy(input.locale, 'Mağaza veya checklist ara', 'Search store or checklist')}
          value={input.searchQuery}
          onChange={(event) => input.onSearchChange(event.target.value)}
        />
      </label>
      <label className="store-checklists-filter">
        <span>{getStaticCopy(input.locale, 'Ay', 'Month')}</span>
        <select
          aria-label={getStaticCopy(input.locale, 'Ay filtresi', 'Month filter')}
          value={input.selectedMonth}
          onChange={(event) => input.onMonthChange(event.target.value)}
        >
          {input.monthOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="store-checklists-filter">
        <span>{input.t('storeChecklists.templateType')}</span>
        <select
          aria-label={input.t('storeChecklists.templateType')}
          value={input.typeFilter}
          onChange={(event) => input.onTypeChange(event.target.value as ChecklistTypeFilter)}
        >
          {input.typeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="store-checklists-filter">
        <span>{input.t('storeChecklists.status')}</span>
        <select
          aria-label={input.t('storeChecklists.status')}
          value={input.statusFilter}
          onChange={(event) => input.onStatusChange(event.target.value as ChecklistStatusFilter)}
        >
          <option value="all">{getStaticCopy(input.locale, 'Tüm durumlar', 'All statuses')}</option>
          <option value="missing">{input.t('storeChecklists.noVisit')}</option>
          <option value="draft">{input.t('storeChecklists.coverage.draft')}</option>
          <option value="completed">{input.t('storeChecklists.status.completed')}</option>
          <option value="pending">{input.t('storeChecklists.needsAcknowledgement')}</option>
          <option value="acknowledged">{input.t('storeChecklists.acknowledged')}</option>
        </select>
      </label>
      <button className="store-checklists-ghost-button" type="button" onClick={input.onClear}>
        {getStaticCopy(input.locale, 'Filtreleri sıfırla', 'Reset filters')}
      </button>
    </section>
  )
}

function ChecklistTabs(input: {
  activeTab: ChecklistTab
  tabs: ChecklistTabOption[]
  onChange: (tab: ChecklistTab) => void
}) {
  return (
    <nav className="store-checklists-tabs" role="tablist" aria-label="Checklist bölümleri">
      {input.tabs.map((tab) => (
        <button
          aria-controls={`store-checklist-panel-${tab.key}`}
          aria-selected={input.activeTab === tab.key}
          className={`store-checklists-tab store-checklists-tone-${tab.tone}`}
          id={`store-checklist-tab-${tab.key}`}
          key={tab.key}
          role="tab"
          type="button"
          onClick={() => input.onChange(tab.key)}
        >
          <span>{tab.label}</span>
          <small>{tab.count}</small>
        </button>
      ))}
    </nav>
  )
}

function ChecklistResultList(input: {
  items: ChecklistAcknowledgementItem[]
  locale: AppLocale
  resultSort: ChecklistSort
  t: TranslateFunction
  onOpen: (item: ChecklistAcknowledgementItem) => void
  onSort: (key: ChecklistSortKey) => void
}) {
  return (
    <div className="store-checklists-table store-checklists-result-table">
      <div className="store-checklists-table-head">
        <SortButton
          active={input.resultSort.key === 'store'}
          direction={input.resultSort.direction}
          onClick={() => input.onSort('store')}
        >
          {input.t('storeChecklists.store')}
        </SortButton>
        <SortButton
          active={input.resultSort.key === 'score'}
          direction={input.resultSort.direction}
          onClick={() => input.onSort('score')}
        >
          {input.t('storeChecklists.score')}
        </SortButton>
        <SortButton
          active={input.resultSort.key === 'status'}
          direction={input.resultSort.direction}
          onClick={() => input.onSort('status')}
        >
          {input.t('storeChecklists.status')}
        </SortButton>
        <SortButton
          active={input.resultSort.key === 'date'}
          direction={input.resultSort.direction}
          onClick={() => input.onSort('date')}
        >
          {getStaticCopy(input.locale, 'Tamamlanma', 'Completed')}
        </SortButton>
        <span>{getStaticCopy(input.locale, 'Aksiyon', 'Action')}</span>
      </div>
      {input.items.map((item) => (
        <ChecklistResultRow
          item={item}
          key={item.checklistInstanceId}
          locale={input.locale}
          onOpen={() => input.onOpen(item)}
          t={input.t}
        />
      ))}
    </div>
  )
}

function ChecklistResultRow(input: {
  item: ChecklistAcknowledgementItem
  locale: AppLocale
  onOpen: () => void
  t: TranslateFunction
}) {
  const hasAcknowledgement = input.item.acknowledgement !== null
  const lowScoreCount = getLowScoreResponses(input.item.responses).length
  const scorePercent = input.item.totalScore ?? Math.round((input.item.complianceRate ?? 0) * 100)
  const digest = getChecklistResultDigest(input.t, input.locale, input.item)

  return (
    <article className="store-checklists-history-row">
      <div className="store-checklists-row-main">
        <ChecklistBadge tone={input.item.templateType === 'VM_STORE_VISIT' ? 'accent' : 'neutral'}>
          {formatChecklistTemplateType(input.t, input.item.templateType)}
        </ChecklistBadge>
        <strong>{input.item.templateName}</strong>
        <p>{formatCompletedSentence(input.t, input.locale, input.item)}</p>
        <p className="store-checklist-result-digest">
          <span>{getStaticCopy(input.locale, 'Sonuç özeti', 'Result summary')}</span>
          {digest.title}
        </p>
      </div>
      <ChecklistScoreBar
        label={input.t('storeChecklists.score')}
        percent={scorePercent}
        tone={scorePercent >= 70 ? 'calm' : 'warning'}
        value={formatScoreValue(input.t, input.item.totalScore)}
      />
      <ChecklistBadge tone={hasAcknowledgement ? 'calm' : 'warning'}>
        {hasAcknowledgement ? input.t('storeChecklists.acknowledged') : input.t('storeChecklists.needsAcknowledgement')}
      </ChecklistBadge>
      <ChecklistFact
        label={input.t('storeChecklists.resultLowScore')}
        value={input.t('storeChecklists.lowScoreCount', { count: lowScoreCount })}
      />
      <button className="store-checklists-action-button" type="button" onClick={input.onOpen}>
        {input.t('storeChecklists.viewResultDetail')}
      </button>
      {input.item.acknowledgement?.acknowledgementNote ? (
        <p className="store-checklists-row-note">{input.item.acknowledgement.acknowledgementNote}</p>
      ) : null}
    </article>
  )
}

function ChecklistVisitModal(input: {
  active?: MobileChecklistToday['activeInstances'][number]
  comments: Record<string, string>
  isCompleting: boolean
  isSaving: boolean
  isStarting: boolean
  locale: AppLocale
  onClose: () => void
  onCommentChange: (templateItemId: string, comment: string) => void
  onComplete: (checklistInstanceId: string) => void
  onScoreChange: (templateItemId: string, score: number | null) => void
  scores: Record<string, number>
  session: ChecklistSession
  t: TranslateFunction
}) {
  const sections = groupChecklistTemplateItems(input.session.template.items)
  const hasItems = input.session.template.items.length > 0
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
    if (!Number.isFinite(score) || item.maxScore <= 0) continue
    scoredRatioTotal += Math.round((score / item.maxScore) * 100)
    scoredRatioCount += 1
  }

  const currentScore =
    scoredRatioCount > 0 ? Math.round(scoredRatioTotal / scoredRatioCount) : 0
  const missingResponseCount = Math.max(input.session.template.items.length - answeredCount, 0)
  const canComplete =
    Boolean(input.active) && !input.isCompleting && hasItems && missingResponseCount === 0

  return (
    <div className="store-checklist-modal-backdrop">
      <section
        aria-labelledby="store-checklist-modal-title"
        aria-modal="true"
        className="store-checklist-modal"
        role="dialog"
      >
        <div className="store-checklist-modal-head">
          <div>
            <div className="store-checklists-eyebrow">{input.t('storeChecklists.sessionEyebrow')}</div>
            <h3 id="store-checklist-modal-title">{input.session.template.templateName}</h3>
            <p>
              {input.t('storeChecklists.sessionCopy', {
                store: input.session.store.storeName,
                template: input.session.template.templateCode,
                version: input.session.template.versionNo,
              })}
            </p>
          </div>
          <ChecklistBadge tone={input.active ? 'warning' : 'accent'}>
            {input.active
              ? formatChecklistStatus(input.t, input.active.status)
              : input.t('storeChecklists.newVisit')}
          </ChecklistBadge>
        </div>

        <div className="store-checklist-modal-summary">
          <ChecklistFact label={input.t('storeChecklists.store')} value={input.session.store.storeName} />
          <ChecklistFact label={input.t('storeChecklists.templateCode')} value={input.session.template.templateCode} />
          <ChecklistFact label={input.t('storeChecklists.templateVersion')} value={`v${input.session.template.versionNo}`} />
          <ChecklistScoreBar
            label={getStaticCopy(input.locale, 'İlerleme', 'Progress')}
            percent={progressPercent}
            tone={progressPercent >= 100 ? 'calm' : 'accent'}
            value={`${answeredCount}/${input.session.template.items.length}`}
          />
        </div>

        {!hasItems ? (
          <ChecklistEmptyBlock
            copy={input.t('storeChecklists.emptyTemplateCopy')}
            title={input.t('storeChecklists.emptyTemplateTitle')}
          />
        ) : (
          <div className="store-checklist-modal-layout">
            <aside className="store-checklist-modal-live">
              <span>{getStaticCopy(input.locale, 'Canlı skor', 'Live score')}</span>
              <strong>{currentScore}</strong>
              <ChecklistScoreBar
                label={input.t('storeChecklists.score')}
                percent={currentScore}
                tone={currentScore >= 70 ? 'calm' : 'warning'}
                value={`${currentScore}%`}
              />
              <p>
                {getStaticCopy(
                  input.locale,
                  'Maddeleri sırayla doldur; düşük puanlı cevaplarda not bırakmak saha takibini kolaylaştırır.',
                  'Answers are auto-saved as you fill items; notes on low scores make field follow-up easier.',
                )}
              </p>
            </aside>
            <div className="store-checklist-modal-sections">
              {sections.map((section) => (
                <article className="store-checklist-modal-section" key={section.name}>
                  <div className="store-checklist-modal-section-head">
                    <strong>{section.name}</strong>
                    <ChecklistBadge tone="accent">
                      {input.t('storeChecklists.sectionItemCount', { count: section.items.length })}
                    </ChecklistBadge>
                  </div>
                  <div className="store-checklist-modal-items">
                    {section.items.map((item) => (
                      <div className="store-checklist-modal-item" key={item.templateItemId}>
                        <div className="store-checklist-modal-item-copy">
                          <span>{item.itemNo}</span>
                          <div>
                            <strong>{item.itemText}</strong>
                            <p>
                              {input.t('storeChecklists.itemMeta', {
                                maxScore: item.maxScore,
                                weight: item.weight,
                              })}
                            </p>
                          </div>
                        </div>
                        <div className="store-checklist-modal-inputs">
                          <div className="store-checklist-modal-score-control">
                            <label>
                              <span>{input.t('storeChecklists.scoreInput')}</span>
                              <input
                                disabled={!input.active}
                                max={item.maxScore}
                                min={0}
                                type="number"
                                value={input.scores[item.templateItemId] ?? ''}
                                onChange={(event) =>
                                  input.onScoreChange(
                                    item.templateItemId,
                                    parseChecklistScoreInput(event.target.value, item.maxScore),
                                  )
                                }
                              />
                            </label>
                            <div className="store-checklist-modal-answer-cluster">
                              {getScoreQuickOptions(input.locale, item.maxScore).map((option) => (
                                <button
                                  className={
                                    input.scores[item.templateItemId] === option.value
                                      ? 'store-checklist-modal-answer-active'
                                      : ''
                                  }
                                  disabled={!input.active}
                                  key={option.label}
                                  type="button"
                                  onClick={() => input.onScoreChange(item.templateItemId, option.value)}
                                >
                                  {option.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <label>
                            <span>{input.t('storeChecklists.noteInput')}</span>
                            <textarea
                              disabled={!input.active}
                              rows={2}
                              value={input.comments[item.templateItemId] ?? ''}
                              onChange={(event) =>
                                input.onCommentChange(item.templateItemId, event.target.value)
                              }
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        <div className="store-checklist-modal-footer">
          {!input.active && input.isStarting ? (
            <p className="store-checklists-inline-notice">{input.t('storeChecklists.startPending')}</p>
          ) : missingResponseCount > 0 ? (
            <p className="store-checklists-inline-notice">
              {input.t('storeChecklists.missingResponsesHint', {
                count: missingResponseCount,
              })}
            </p>
          ) : input.isSaving ? (
            <p className="store-checklists-inline-notice">{input.t('storeChecklists.autosaving')}</p>
          ) : null}
          <button className="store-checklists-ghost-button" type="button" onClick={input.onClose}>
            {input.t('storeChecklists.cancelSession')}
          </button>
          <button
            className="store-checklists-action-button"
            disabled={!canComplete}
            type="button"
            onClick={() => {
              if (!input.active) return
              if (!window.confirm(input.t('storeChecklists.completeSessionConfirm'))) return
              input.onComplete(input.active.checklistInstanceId)
            }}
          >
            {input.isCompleting
              ? input.t('storeChecklists.completing')
              : input.t('storeChecklists.complete')}
          </button>
        </div>
      </section>
    </div>
  )
}

function ChecklistResultModal(input: {
  acknowledgementNote: string
  canAcknowledge: boolean
  isAcknowledging: boolean
  item: ChecklistAcknowledgementItem
  locale: AppLocale
  onAcknowledge: (acknowledgementNote: string) => void
  onClose: () => void
  onNoteChange: (note: string) => void
  t: TranslateFunction
}) {
  const acknowledgementNoteRef = useRef(input.acknowledgementNote)

  useEffect(() => {
    acknowledgementNoteRef.current = input.acknowledgementNote
  }, [input.acknowledgementNote])

  const lowScoreResponses = getLowScoreResponses(input.item.responses)
  const sections = groupChecklistResultResponses(input.item.responses)
  const hasAcknowledgement = input.item.acknowledgement !== null
  const scorePercent = input.item.totalScore ?? Math.round((input.item.complianceRate ?? 0) * 100)
  const digest = getChecklistResultDigest(input.t, input.locale, input.item)

  return (
    <div className="store-checklist-modal-backdrop">
      <section
        aria-labelledby="store-checklist-result-title"
        aria-modal="true"
        className="store-checklist-modal store-checklist-result-modal"
        role="dialog"
      >
        <div className="store-checklist-modal-head">
          <div>
            <div className="store-checklists-eyebrow">{input.t('storeChecklists.resultEyebrow')}</div>
            <h3 id="store-checklist-result-title">{input.item.templateName}</h3>
            <p>{formatCompletedSentence(input.t, input.locale, input.item)}</p>
          </div>
          <button className="store-checklists-ghost-button" type="button" onClick={input.onClose}>
            {input.t('storeChecklists.closeSession')}
          </button>
        </div>

        <div className="store-checklist-modal-summary">
          <ChecklistFact label={input.t('storeChecklists.store')} value={input.item.storeName || input.item.storeId} />
          <ChecklistFact label={input.t('storeChecklists.templateType')} value={formatChecklistTemplateType(input.t, input.item.templateType)} />
          <ChecklistScoreBar
            label={input.t('storeChecklists.score')}
            percent={scorePercent}
            tone={scorePercent >= 70 ? 'calm' : 'warning'}
            value={formatScoreValue(input.t, input.item.totalScore)}
          />
          <ChecklistFact
            label={input.t('storeChecklists.compliance')}
            value={formatComplianceValue(input.t, input.item.complianceRate)}
          />
        </div>

        <div className="store-checklist-result-summary">
          <ChecklistFact
            label={input.t('storeChecklists.resultCompletedBy')}
            value={input.item.completedByUserId ?? input.t('storeChecklists.unknown')}
          />
          <ChecklistFact
            label={input.t('storeChecklists.resultLowScore')}
            value={input.t('storeChecklists.lowScoreCount', { count: lowScoreResponses.length })}
          />
          <ChecklistFact
            label={input.t('storeChecklists.resultStatus')}
            value={
              hasAcknowledgement
                ? input.t('storeChecklists.acknowledged')
                : input.t('storeChecklists.needsAcknowledgement')
            }
          />
        </div>

        <div className={`store-checklist-result-digest-card store-checklist-result-digest-card-${digest.tone}`}>
          <span>{getStaticCopy(input.locale, 'Sonuç özeti', 'Result summary')}</span>
          <strong>{digest.title}</strong>
          <p>{digest.copy}</p>
        </div>

        {lowScoreResponses.length > 0 ? (
          <div className="store-checklist-result-alert">
            <strong>{input.t('storeChecklists.lowScoreTitle')}</strong>
            <p>
              {lowScoreResponses
                .slice(0, 3)
                .map((response) => response.itemText)
                .join(' / ')}
            </p>
          </div>
        ) : null}

        <div className="store-checklist-result-sections">
          {sections.map((section) => (
            <article className="store-checklist-result-section" key={section.name}>
              <div className="store-checklist-result-section-head">
                <div>
                  <strong>{section.name || input.t('storeChecklists.section')}</strong>
                  <p>
                    {input.t('storeChecklists.sectionResultSummary', {
                      score: section.averageScore,
                      count: section.items.length,
                    })}
                  </p>
                </div>
                <ChecklistScoreBar
                  label={input.t('storeChecklists.score')}
                  percent={section.averageScore}
                  tone={section.averageScore >= 70 ? 'calm' : 'warning'}
                  value={`${section.averageScore}%`}
                />
              </div>
              <div className="store-checklist-result-items">
                {section.items.map((response) => {
                  const ratio = getResponseRatio(response)
                  const isLowScore = ratio !== null && ratio < 70

                  return (
                    <div
                      className={`store-checklist-result-item${isLowScore ? ' store-checklist-result-item-low' : ''}`}
                      key={response.templateItemId}
                    >
                      <div>
                        <strong>{response.itemText}</strong>
                        {response.commentText ? <p>{response.commentText}</p> : null}
                      </div>
                      <ChecklistFact
                        label={input.t('storeChecklists.score')}
                        value={
                          response.scoreValue === null
                            ? input.t('storeChecklists.noScore')
                            : `${response.scoreValue}/${response.maxScore}`
                        }
                      />
                    </div>
                  )
                })}
              </div>
            </article>
          ))}
        </div>

        <div className="store-checklist-result-ack">
          {hasAcknowledgement ? (
            <>
              <div className="store-checklists-eyebrow">{input.t('storeChecklists.acknowledged')}</div>
              <p>
                {input.item.acknowledgement?.acknowledgedAt
                  ? formatDateTime(input.item.acknowledgement.acknowledgedAt, input.locale)
                  : input.t('storeChecklists.unknown')}
              </p>
              {input.item.acknowledgement?.acknowledgementNote ? (
                <p>{input.item.acknowledgement.acknowledgementNote}</p>
              ) : null}
            </>
          ) : input.canAcknowledge ? (
            <>
              <label className="store-checklists-eyebrow" htmlFor={`result-ack-note-${input.item.checklistInstanceId}`}>
                {input.t('storeChecklists.acknowledgementNote')}
              </label>
              <textarea
                id={`result-ack-note-${input.item.checklistInstanceId}`}
                rows={3}
                value={input.acknowledgementNote}
                onChange={(event) => {
                  acknowledgementNoteRef.current = event.target.value
                  input.onNoteChange(event.target.value)
                }}
                placeholder={input.t('storeChecklists.acknowledgementNotePlaceholder')}
              />
              <div className="store-checklist-modal-footer">
                <button className="store-checklists-ghost-button" type="button" onClick={input.onClose}>
                  {input.t('storeChecklists.cancelSession')}
                </button>
                <button
                  className="store-checklists-action-button"
                  disabled={input.isAcknowledging}
                  type="button"
                  onClick={() => input.onAcknowledge(acknowledgementNoteRef.current)}
                >
                  {input.isAcknowledging
                    ? input.t('storeChecklists.acknowledging')
                    : input.t('storeChecklists.acknowledge')}
                </button>
              </div>
            </>
          ) : (
            <p className="store-checklists-inline-notice">{input.t('storeChecklists.reviewOnlyCopy')}</p>
          )}
        </div>
      </section>
    </div>
  )
}
