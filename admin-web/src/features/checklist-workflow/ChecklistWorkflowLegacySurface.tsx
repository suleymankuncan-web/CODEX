import { RefreshCw } from 'lucide-react'
import type { AuthSessionSummary } from '../auth/api'
import { canAcknowledgeChecklist } from '../auth/authorization'
import {
  buildChecklistResponseDrafts,
  getCoverageRowKeyFromRow,
} from '../../pages/store-checklists-logic'
import { ChecklistTabs, ChecklistToolbar } from '../../pages/store-checklists-controls'
import { StoreChecklistsAcknowledgementPanels } from '../../pages/store-checklists-acknowledgement-panels'
import { StoreChecklistsHero } from '../../pages/store-checklists-hero'
import { StoreChecklistsModals } from '../../pages/store-checklists-modals'
import { StoreChecklistsVisitPlan } from '../../pages/store-checklists-visit-plan'
import { StoreChecklistsVisitPanel } from '../../pages/store-checklists-visit-panel'
import { StoreErrorState, StoreLoadingState, StoreSurfacePage } from '../../pages/store-surface-primitives'
import { useChecklistWorkflowLegacyController } from './useChecklistWorkflowLegacyController'

export function ChecklistWorkflowLegacySurface(input: { authSummary: AuthSessionSummary | null }) {
  const {
    acknowledgeMutation, ackNotes, actionVisitRowsByStoreId, activeVisitCount,
    assignedStoreIds, assignedVisitStoreCount, canManageVisits, canUseAcknowledgements, checklistTabs,
    comments, completeVisitMutation, dispatchPageState, effectiveTypeFilter,
    errorMessage, evaluationMonth, filteredAcknowledgedItems, filteredPendingItems,
    heroAverageScore, heroCompletedCount, heroScopeLabel, heroStoreCount,
    heroWaitingCount, hydrateActiveResponseDrafts, isError, isLoading, isRetrying,
    locale, mobileToday, monthOptions, openChecklistResult, openVisitWorkflowFromPlan,
    pendingItems, periodLabel, queueResponseAutoSave, requiresCombinedVisitTemplates,
    resultSort, retryChecklistQueries, saveResponseMutation, scores, searchQuery,
    selectedMonth, selectedResult, selectedSession, selectedTab, selectChecklistTab,
    showBmVisitScore, showVmVisitScore, startVisitMutation, statusFilter, t,
    templateTypeOptions, visitPlanRows, visitSort, visitStoreRows, vmOnlyVisitScope,
    closeChecklistResult, closeSession,
  } = useChecklistWorkflowLegacyController(input)

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
