import { useCallback, useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { CheckCircle2, ChevronRight, ClipboardCheck, RefreshCw, Store, X } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog'
import type { AuthSessionSummary } from '../auth/api'
import { canAcknowledgeChecklist, hasAnyRole } from '../auth/authorization'
import type { ChecklistAcknowledgementItem } from '../checklists/api'
import { getUserFacingErrorMessage } from '../../lib/format'
import {
  buildChecklistResponseDrafts,
  canMutateChecklistTemplateType,
  getCoverageScore,
  getCoverageRowKeyFromRow,
  isVisualMerchandiserOnly,
} from '../../pages/store-checklists-logic'
import { StoreChecklistsModals } from '../../pages/store-checklists-modals'
import type { ChecklistCoverageRow } from '../../pages/store-checklists-model'
import type { ChecklistWorkflowOverlayState } from './checklist-workflow-route-state'
import { useChecklistWorkflowController } from './useChecklistWorkflowController'

export function ChecklistWorkflowCommandOverlay(input: {
  authSummary: AuthSessionSummary | null
  routeState: ChecklistWorkflowOverlayState
  returnFocusRef: RefObject<HTMLElement | null>
  onClose: () => void
}) {
  const controller = useChecklistWorkflowController({ authSummary: input.authSummary })
  const {
    acknowledgeMutation,
    ackNotes,
    assignedStoreIds,
    comments,
    completeVisitMutation,
    dispatchPageState,
    errorMessage,
    filteredAcknowledgedItems,
    filteredPendingItems,
    hydrateActiveResponseDrafts,
    isError,
    isLoading,
    isRetrying,
    locale,
    mobileToday,
    monthOptions,
    openChecklistResult,
    queueResponseAutoSave,
    retryChecklistQueries,
    saveResponseMutation,
    scores,
    selectedResult,
    selectedMonth,
    selectedSession,
    sessionDirty,
    startVisitMutation,
    t,
    visitStoreRows,
    closeChecklistResult,
    closeSession,
  } = controller

  const workflowStoreId = input.routeState.kind === 'workflow' ? input.routeState.storeId : null
  const workflowStore = workflowStoreId
    ? visitStoreRows.find((row) => row.store.storeId === workflowStoreId)
    : undefined
  const nestedModalOpen = Boolean(selectedSession || selectedResult)
  const resultMissing = input.routeState.kind === 'result' && !isLoading && !selectedResult
  const resultSurface = input.routeState.kind === 'result' || (
    input.routeState.kind === 'workflow' && (input.routeState.tab === 'inbox' || input.routeState.tab === 'history')
  )
  const workflowResultItems = input.routeState.kind === 'workflow'
    ? (input.routeState.tab === 'inbox'
        ? filteredPendingItems
        : input.routeState.tab === 'history'
          ? filteredAcknowledgedItems
          : [])
        .filter((item) => item.storeId === workflowStoreId)
    : []
  const directOpenAttemptRef = useRef<string | null>(null)

  const openChecklistRow = useCallback((row: ChecklistCoverageRow, storeId: string) => {
    const rowKey = getCoverageRowKeyFromRow(row)
    if (row.active) {
      dispatchPageState({ type: 'openSession', rowKey, ...hydrateActiveResponseDrafts(row.active) })
      return
    }
    hydrateActiveResponseDrafts(undefined)
    dispatchPageState({ type: 'resetSessionDrafts' })
    startVisitMutation.mutate({ storeId, checklistTemplateId: row.template.checklistTemplateId })
  }, [dispatchPageState, hydrateActiveResponseDrafts, startVisitMutation])

  useEffect(() => {
    if (input.routeState.kind !== 'workflow' || input.routeState.tab !== 'visits' || !input.routeState.directChecklist || isLoading || isError || !workflowStore) return
    const row = input.routeState.directChecklist === 'vm' ? workflowStore.vm : workflowStore.bm
    if (!row) return
    const canMutate = canMutateChecklistTemplateType(input.authSummary, row.template.templateType)
    const assigned = assignedStoreIds.includes(workflowStore.store.storeId)
    if (!canMutate || !assigned) return
    const attemptKey = `${workflowStore.store.storeId}:${input.routeState.directChecklist}`
    if (directOpenAttemptRef.current === attemptKey) return
    directOpenAttemptRef.current = attemptKey
    openChecklistRow(row, workflowStore.store.storeId)
  }, [assignedStoreIds, input.authSummary, input.routeState, isError, isLoading, openChecklistRow, workflowStore])

  return (
    <>
      {!nestedModalOpen ? (
        <Dialog open onOpenChange={(open) => { if (!open) input.onClose() }}>
          <DialogContent
            className="checklist-workflow-command-drawer tw:min-w-0 tw:p-0"
            closeLabel={locale === 'tr' ? 'Checklist panelini kapat' : 'Close checklist panel'}
            onCloseAutoFocus={(event) => {
              if (!input.returnFocusRef.current) return
              event.preventDefault()
              input.returnFocusRef.current.focus()
            }}
            showCloseButton={false}
          >
            <DialogHeader className="checklist-workflow-command-drawer-header tw:grid tw:min-w-0 tw:grid-cols-[minmax(0,1fr)_auto] tw:gap-3 tw:text-left">
              <div className="checklist-workflow-command-drawer-identity tw:min-w-0">
                <span className="checklist-workflow-command-drawer-role" aria-hidden="true">
                  {isVisualMerchandiserOnly(input.authSummary) ? 'VM' : 'BM'}
                </span>
                <div className="tw:min-w-0">
                  <p>{resultSurface ? (locale === 'tr' ? 'CHECKLIST SONUCU' : 'CHECKLIST RESULT') : (locale === 'tr' ? 'MAĞAZA ZİYARETİ' : 'STORE VISIT')}</p>
                  <h2>{input.routeState.kind === 'result' ? (selectedResult?.storeName ?? (locale === 'tr' ? 'Checklist sonucu' : 'Checklist result')) : (workflowStore?.store.storeName ?? (locale === 'tr' ? 'Checklist akışı' : 'Checklist workflow'))}</h2>
                </div>
                <DialogTitle className="tw:sr-only">
                  {input.routeState.kind === 'result'
                    ? (locale === 'tr' ? 'Checklist sonucu' : 'Checklist result')
                    : (locale === 'tr' ? 'Checklist akışı' : 'Checklist workflow')}
                </DialogTitle>
                <DialogDescription className="tw:sr-only">
                  {locale === 'tr'
                    ? 'Mağaza checklistini bu ekrandan tamamlayın.'
                    : 'Complete the store checklist from this screen.'}
                </DialogDescription>
              </div>
              <Button aria-label={locale === 'tr' ? 'Checklist panelini kapat' : 'Close checklist panel'} size="icon-sm" type="button" variant="ghost" onClick={input.onClose}>
                <X />
              </Button>
            </DialogHeader>

            <div className="checklist-workflow-command-drawer-body tw:min-w-0">
              {input.routeState.kind === 'workflow' && input.routeState.tab === 'visits' && !isLoading && !isError ? (
                <div className="tw:mb-4 tw:flex tw:justify-end">
                  <Select value={selectedMonth} onValueChange={(value) => dispatchPageState({ type: 'setSelectedMonth', value })}>
                    <SelectTrigger aria-label={locale === 'tr' ? 'Ay filtresi' : 'Month filter'} className="tw:w-full tw:sm:w-52"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectGroup>{monthOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectGroup></SelectContent>
                  </Select>
                </div>
              ) : null}
              {isLoading ? (
                <OverlayState icon={RefreshCw} title={locale === 'tr' ? 'Checklist verileri yükleniyor' : 'Loading checklist data'} />
              ) : isError ? (
                <OverlayState
                  icon={RefreshCw}
                  title={locale === 'tr' ? 'Checklist akışı yüklenemedi' : 'Checklist workflow could not load'}
                  copy={getUserFacingErrorMessage(errorMessage, locale === 'tr' ? 'Tekrar deneyin.' : 'Try again.')}
                  action={
                    <Button disabled={isRetrying} type="button" variant="outline" onClick={retryChecklistQueries}>
                      <RefreshCw /> {isRetrying ? (locale === 'tr' ? 'Deneniyor' : 'Retrying') : (locale === 'tr' ? 'Tekrar dene' : 'Retry')}
                    </Button>
                  }
                />
              ) : resultMissing ? (
                <OverlayState
                  icon={ClipboardCheck}
                  title={locale === 'tr' ? 'Checklist sonucu bulunamadı' : 'Checklist result not found'}
                  copy={locale === 'tr' ? 'Kayıt bu rolün güncel kapsamında olmayabilir.' : 'The record may be outside the current role scope.'}
                />
              ) : input.routeState.kind === 'workflow' && (input.routeState.tab === 'inbox' || input.routeState.tab === 'history') ? (
                <ChecklistResultList
                  items={workflowResultItems}
                  locale={locale}
                  storeName={workflowStore?.store.storeName ?? null}
                  tab={input.routeState.tab}
                  onOpen={openChecklistResult}
                />
              ) : input.routeState.kind === 'workflow' && input.routeState.tab === 'plan' ? (
                <OverlayState
                  icon={ClipboardCheck}
                  title={locale === 'tr' ? 'Ziyaret planı Command Canvas üzerinden yönetilir' : 'Visit plans are managed from Command Canvas'}
                  copy={locale === 'tr' ? 'Plan görünümüne dönerek mağazanın güncel ziyaret planını açın.' : 'Return to the Plan view to open the current store visit plan.'}
                />
              ) : workflowStore ? (
                <section className="tw:min-w-0" aria-label={locale === 'tr' ? 'Mağaza checklistleri' : 'Store checklists'}>
                  <div className="tw:grid tw:min-w-0 tw:grid-cols-[minmax(0,1fr)] tw:gap-3 tw:sm:grid-cols-2">
                    {!isVisualMerchandiserOnly(input.authSummary) ? (
                      <ChecklistTypeCard
                        assigned={assignedStoreIds.includes(workflowStore.store.storeId)}
                        authSummary={input.authSummary}
                        label="BM Checklist"
                        locale={locale}
                        row={workflowStore.bm}
                        startPending={startVisitMutation.isPending}
                        onOpen={(row) => {
                          openChecklistRow(row, workflowStore.store.storeId)
                        }}
                      />
                    ) : null}
                    <ChecklistTypeCard
                      assigned={assignedStoreIds.includes(workflowStore.store.storeId)}
                      authSummary={input.authSummary}
                      label="VM Checklist"
                      locale={locale}
                      row={workflowStore.vm}
                      startPending={startVisitMutation.isPending}
                      onOpen={(row) => {
                        openChecklistRow(row, workflowStore.store.storeId)
                      }}
                    />
                  </div>
                  {startVisitMutation.isError ? (
                    <p role="alert" className="tw:mt-4 tw:rounded-lg tw:border tw:border-destructive/25 tw:bg-destructive/5 tw:p-3 tw:text-xs tw:text-destructive">
                      {getUserFacingErrorMessage(startVisitMutation.error, locale === 'tr' ? 'Checklist başlatılamadı.' : 'Checklist could not start.')}
                    </p>
                  ) : null}
                </section>
              ) : input.routeState.kind === 'workflow' && input.routeState.tab === 'visits' && workflowStoreId && assignedStoreIds.includes(workflowStoreId) ? (
                <OverlayState
                  icon={ClipboardCheck}
                  title={hasAnyRole(input.authSummary, ['VISUAL_MERCHANDISER'])
                    ? (locale === 'tr' ? 'VM şablonu yayında değil' : 'No published VM template')
                    : (locale === 'tr' ? 'Checklist şablonu yayında değil' : 'No published checklist template')}
                  copy={locale === 'tr' ? 'Mağaza atamanız korunuyor; yayınlanmış şablon olmadan checklist başlatılamaz.' : 'Your store assignment remains visible; a checklist cannot start without a published template.'}
                />
              ) : input.routeState.kind === 'workflow' ? (
                <OverlayState
                  icon={Store}
                  title={locale === 'tr' ? 'Mağaza bu kapsamda bulunamadı' : 'Store not found in this scope'}
                  copy={locale === 'tr' ? 'Mağaza ataması veya rol kapsamı değişmiş olabilir.' : 'The store assignment or role scope may have changed.'}
                />
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
      ) : null}

      <StoreChecklistsModals
        acknowledgementNote={selectedResult ? (ackNotes[selectedResult.checklistInstanceId] ?? '') : ''}
        comments={comments}
        {...(mobileToday?.evidenceCapabilities
          ? { evidenceCapabilities: mobileToday.evidenceCapabilities }
          : {})}
        locale={locale}
        resultState={{
          acknowledging: Boolean(selectedResult) && acknowledgeMutation.isPending,
          canAcknowledge: selectedResult ? canAcknowledgeChecklist(input.authSummary, selectedResult.storeId) : false,
        }}
        scores={scores}
        selectedResult={selectedResult}
        selectedSession={selectedSession}
        sessionDirty={sessionDirty}
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
            ...(acknowledgementNote.trim() ? { acknowledgementNote: acknowledgementNote.trim() } : {}),
          })
        }}
        onCloseResult={closeChecklistResult}
        onCloseSession={() => {
          closeSession()
          if (input.routeState.kind === 'workflow' && input.routeState.directChecklist) input.onClose()
        }}
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
            responses: buildChecklistResponseDrafts({ checklistInstanceId, comments, scores, session: selectedSession }),
            rowKey: getCoverageRowKeyFromRow(selectedSession),
            storeId: selectedSession.store.storeId,
          })
        }}
        onNoteChange={(note) => {
          if (!selectedResult) return
          dispatchPageState({ type: 'setAckNote', checklistInstanceId: selectedResult.checklistInstanceId, note })
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
    </>
  )
}

function ChecklistTypeCard(input: {
  assigned: boolean
  authSummary: AuthSessionSummary | null
  label: string
  locale: 'tr' | 'en'
  row: ChecklistCoverageRow | undefined
  startPending: boolean
  onOpen: (row: ChecklistCoverageRow) => void
}) {
  const canMutate = Boolean(input.row) && canMutateChecklistTemplateType(input.authSummary, input.row!.template.templateType)
  const canOpen = Boolean(input.row) && (Boolean(input.row?.active) || (input.assigned && canMutate))
  const score = input.row ? getCoverageScore(input.row) : null
  return (
    <article className="tw:flex tw:min-h-40 tw:min-w-0 tw:flex-col tw:rounded-xl tw:border tw:border-border tw:bg-card tw:p-4 tw:shadow-sm">
      <div className="tw:flex tw:items-start tw:justify-between tw:gap-3">
        <span className="tw:grid tw:size-9 tw:place-items-center tw:rounded-lg tw:bg-primary/10 tw:text-primary"><ClipboardCheck className="tw:size-4" /></span>
        {input.row?.active ? <span className="tw:rounded-full tw:bg-amber-500/10 tw:px-2 tw:py-1 tw:text-[10px] tw:font-semibold tw:text-amber-700">{input.locale === 'tr' ? 'Devam ediyor' : 'In progress'}</span> : null}
      </div>
      <strong className="tw:mt-3 tw:text-sm tw:text-foreground">{input.label}</strong>
      <span className="tw:mt-1 tw:text-xs tw:text-muted-foreground">
        {!input.row ? (input.locale === 'tr' ? 'Yayınlanmış şablon yok' : 'No published template') : score === null ? (input.locale === 'tr' ? 'Henüz puan yok' : 'No score yet') : `${score} ${input.locale === 'tr' ? 'puan' : 'points'}`}
      </span>
      {input.row?.completedAt ? <time className="tw:mt-1 tw:text-[10px] tw:text-muted-foreground" dateTime={input.row.completedAt}>{formatCoverageDate(input.row.completedAt, input.locale)}</time> : null}
      <Button className="tw:mt-auto tw:w-full" disabled={!canOpen || input.startPending} type="button" variant={input.row?.active ? 'default' : 'outline'} onClick={() => { if (input.row) input.onOpen(input.row) }}>
        {input.row?.active ? <CheckCircle2 /> : <ClipboardCheck />}
        {input.row?.active ? (input.locale === 'tr' ? 'Devam et' : 'Continue') : (input.locale === 'tr' ? 'Checklist başlat' : 'Start checklist')}
      </Button>
    </article>
  )
}

function formatCoverageDate(value: string, locale: 'tr' | 'en') {
  return new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-US', { dateStyle: 'medium' }).format(new Date(value))
}

function ChecklistResultList(input: {
  items: ChecklistAcknowledgementItem[]
  locale: 'tr' | 'en'
  storeName: string | null
  tab: 'inbox' | 'history'
  onOpen: (item: ChecklistAcknowledgementItem) => void
}) {
  const title = input.tab === 'inbox'
    ? (input.locale === 'tr' ? 'Sonuç kabulü' : 'Result acknowledgement')
    : (input.locale === 'tr' ? 'Sonuç geçmişi' : 'Result history')

  if (input.items.length === 0) {
    return (
      <OverlayState
        icon={ClipboardCheck}
        title={input.locale === 'tr' ? 'Bu mağaza için sonuç bulunamadı' : 'No result found for this store'}
        copy={input.tab === 'inbox'
          ? (input.locale === 'tr' ? 'Kabul bekleyen checklist sonucu yok.' : 'There is no checklist result awaiting acknowledgement.')
          : (input.locale === 'tr' ? 'Kabul edilmiş checklist sonucu yok.' : 'There is no acknowledged checklist result.')}
      />
    )
  }

  return (
    <section aria-label={title}>
      <div className="tw:flex tw:items-center tw:gap-3 tw:rounded-xl tw:border tw:border-border tw:bg-muted/25 tw:p-4">
        <span className="tw:grid tw:size-10 tw:shrink-0 tw:place-items-center tw:rounded-xl tw:bg-primary/10 tw:text-primary"><Store className="tw:size-5" /></span>
        <div className="tw:min-w-0">
          <p className="tw:text-[10px] tw:font-bold tw:uppercase tw:tracking-[0.12em] tw:text-muted-foreground">{title}</p>
          <h3 className="tw:truncate tw:text-base tw:font-semibold tw:text-foreground">{input.storeName ?? input.items[0]?.storeName}</h3>
        </div>
      </div>
      <div className="tw:mt-4 tw:grid tw:gap-2">
        {input.items.map((item) => (
          <article className="tw:flex tw:items-center tw:gap-3 tw:rounded-xl tw:border tw:border-border tw:bg-card tw:p-4" data-testid="checklist-workflow-result-row" key={item.checklistInstanceId}>
            <span className="tw:grid tw:size-9 tw:shrink-0 tw:place-items-center tw:rounded-lg tw:bg-primary/10 tw:text-primary"><ClipboardCheck className="tw:size-4" /></span>
            <div className="tw:min-w-0 tw:flex-1">
              <strong className="tw:block tw:truncate tw:text-sm tw:text-foreground">{item.templateName}</strong>
              <span className="tw:mt-1 tw:block tw:text-xs tw:text-muted-foreground">
                {formatChecklistResultDate(item.completedAt, input.locale)} · {item.totalScore === null ? (input.locale === 'tr' ? 'Puan yok' : 'No score') : `${Math.round(item.totalScore)} ${input.locale === 'tr' ? 'puan' : 'points'}`}
              </span>
            </div>
            <Button aria-label={input.locale === 'tr' ? 'Detayı gör' : 'View details'} size="sm" type="button" variant="ghost" onClick={() => input.onOpen(item)}>
              <span className="tw:hidden tw:sm:inline">{input.locale === 'tr' ? 'Detayı gör' : 'View details'}</span>
              <ChevronRight />
            </Button>
          </article>
        ))}
      </div>
    </section>
  )
}

function formatChecklistResultDate(value: string | null, locale: 'tr' | 'en') {
  if (!value) return locale === 'tr' ? 'Tarih yok' : 'No date'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(locale === 'tr' ? 'tr-TR' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

function OverlayState(input: {
  icon: typeof Store
  title: string
  copy?: string
  action?: ReactNode
}) {
  const Icon = input.icon
  return (
    <div className="tw:grid tw:min-h-56 tw:place-items-center tw:text-center">
      <div className="tw:max-w-sm">
        <span className="tw:mx-auto tw:grid tw:size-11 tw:place-items-center tw:rounded-xl tw:bg-muted tw:text-muted-foreground"><Icon className="tw:size-5" /></span>
        <h3 className="tw:mt-3 tw:text-sm tw:font-semibold tw:text-foreground">{input.title}</h3>
        {input.copy ? <p className="tw:mt-1 tw:text-xs tw:text-muted-foreground">{input.copy}</p> : null}
        {input.action ? <div className="tw:mt-4">{input.action}</div> : null}
      </div>
    </div>
  )
}
