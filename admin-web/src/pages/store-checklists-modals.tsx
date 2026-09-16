import { useMemo, useRef, useState } from 'react'
import { AlertDialog as AlertDialogPrimitive } from 'radix-ui'
import {
  CheckCircle2,
  Cloud,
  MessageSquareText,
  Save,
  XIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type {
  ChecklistAcknowledgementItem,
  ChecklistComplianceResponseValue,
  MobileChecklistToday,
} from '../features/checklists/api'
import type { TranslateFunction } from '../features/localization/dictionary'
import { getUserFacingErrorMessage } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import type { ChecklistSession } from './store-checklists-model'
import {
  calculateChecklistLiveScore,
  formatChecklistStatus,
  getScoreQuickOptions,
  getStaticCopy,
  groupChecklistTemplateItems,
} from './store-checklists-logic'
import {
  getChecklistScoreBounds,
  getChecklistScoreOptions,
  isChecklistLowScoreNoteMissing,
  isChecklistLowScoreSelection,
  parseChecklistScoreInput,
} from './store-checklists-score-policy'
import { ChecklistBadge, ChecklistEmptyBlock } from './store-checklists-atoms'
import { ChecklistResultModal } from './store-checklists-result-modal'
import { countMissingRequiredChecklistEvidence } from '../features/checklist-workflow/checklist-item-evidence-model'

type ChecklistTemplateItem = ChecklistSession['template']['items'][number]
type ChecklistChoiceOption = {
  label: string
  responseValue?: ChecklistComplianceResponseValue
  scoreValue: number
  tone: string
  value: string
}

export function StoreChecklistsModals(input: {
  acknowledgementNote: string
  comments: Record<string, string>
  evidenceCapabilities?: MobileChecklistToday['evidenceCapabilities']
  locale: AppLocale
  resultState: {
    acknowledging: boolean
    canAcknowledge: boolean
  }
  responseValues: Record<string, ChecklistComplianceResponseValue>
  scores: Record<string, number>
  selectedResult: ChecklistAcknowledgementItem | null
  selectedSession: ChecklistSession | null
  sessionDirty: boolean
  t: TranslateFunction
  visitState: {
    completeError: unknown | null
    completing: boolean
    saving: boolean
    starting: boolean
  }
  onAcknowledgeResult: (acknowledgementNote: string) => void
  onCloseResult: () => void
  onCloseSession: () => void
  onCommentChange: (templateItemId: string, comment: string) => void
  onSaveComment: (templateItemId: string, comment: string) => Promise<void>
  onCompleteVisit: (checklistInstanceId: string) => void
  onNoteChange: (note: string) => void
  onScoreChange: (
    templateItemId: string,
    score: number | null,
    responseValue?: ChecklistComplianceResponseValue | null,
  ) => void
}) {
  return (
    <>
      {input.selectedSession ? (
        <ChecklistVisitModal
          active={input.selectedSession.active}
          comments={input.comments}
          completeError={input.visitState.completeError}
          isCompleting={input.visitState.completing}
          isSaving={input.visitState.saving}
          isStarting={input.visitState.starting}
          locale={input.locale}
          onClose={input.onCloseSession}
          onComplete={input.onCompleteVisit}
          onScoreChange={input.onScoreChange}
          onCommentChange={input.onCommentChange}
          onSaveComment={input.onSaveComment}
          responseValues={input.responseValues}
          scores={input.scores}
          sessionDirty={input.sessionDirty}
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
  completeError: unknown | null
  isCompleting: boolean
  isSaving: boolean
  isStarting: boolean
  locale: AppLocale
  onClose: () => void
  onCommentChange: (templateItemId: string, comment: string) => void
  onSaveComment: (templateItemId: string, comment: string) => Promise<void>
  onComplete: (checklistInstanceId: string) => void
  onScoreChange: (
    templateItemId: string,
    score: number | null,
    responseValue?: ChecklistComplianceResponseValue | null,
  ) => void
  responseValues: Record<string, ChecklistComplianceResponseValue>
  scores: Record<string, number>
  sessionDirty: boolean
  session: ChecklistSession
  t: TranslateFunction
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const [confirmClose, setConfirmClose] = useState(false)
  const [noteSaveStates, setNoteSaveStates] = useState<
    Record<string, 'idle' | 'saving' | 'saved' | 'error'>
  >({})
  const sessionEvidence = input.active?.evidence ?? []
  const sections = useMemo(
    () => groupChecklistTemplateItems(input.session.template.items),
    [input.session.template.items],
  )
  const itemIndexById = useMemo(
    () => new Map(input.session.template.items.map((item, index) => [item.templateItemId, index])),
    [input.session.template.items],
  )
  const hasItems = input.session.template.items.length > 0
  const answeredCount = input.session.template.items.filter(
    (item) => Number.isFinite(input.scores[item.templateItemId]),
  ).length
  const progressPercent = hasItems
    ? Math.round((answeredCount / input.session.template.items.length) * 100)
    : 0
  const currentScore = calculateChecklistLiveScore({
    items: input.session.template.items,
    responseValues: input.responseValues,
    scores: input.scores,
  })
  const missingResponseCount = Math.max(input.session.template.items.length - answeredCount, 0)
  const missingRequiredLowScoreNoteCount = input.session.template.items.filter(
    (item) =>
      input.responseValues[item.templateItemId] !== 'not_applicable' &&
      isChecklistLowScoreNoteMissing({
        commentText: input.comments[item.templateItemId],
        item,
        score: input.scores[item.templateItemId],
      }),
  ).length
  const missingRequiredEvidenceCount = countMissingRequiredChecklistEvidence(
    input.session.template.items,
    sessionEvidence.reduce<Record<string, number>>((counts, evidence) => {
      counts[evidence.templateItemId] = (counts[evidence.templateItemId] ?? 0) + 1
      return counts
    }, {}),
  )
  const canComplete =
    Boolean(input.active) &&
    !input.isCompleting &&
    hasItems &&
    missingResponseCount === 0 &&
    missingRequiredLowScoreNoteCount === 0 &&
    missingRequiredEvidenceCount === 0
  const sessionStatus = input.active
    ? formatChecklistStatus(input.t, input.active.status)
    : input.t('storeChecklists.newVisit')
  const footerStateText = input.completeError
    ? getUserFacingErrorMessage(input.completeError, input.t('storeChecklists.completeErrorCopy'))
    : !input.active && input.isStarting
      ? input.t('storeChecklists.startPending')
      : missingResponseCount > 0
        ? input.t('storeChecklists.missingResponsesHint', { count: missingResponseCount })
        : missingRequiredLowScoreNoteCount > 0
          ? input.t('storeChecklists.missingLowScoreNotesHint', {
              count: missingRequiredLowScoreNoteCount,
            })
          : missingRequiredEvidenceCount > 0
            ? `${missingRequiredEvidenceCount} zorunlu madde için fotoğraf kanıtı eksik.`
          : input.isSaving
            ? input.t('storeChecklists.autosaving')
            : input.t('storeChecklists.draftSaved')

  return (
    <AlertDialogPrimitive.Root open={confirmClose} onOpenChange={setConfirmClose}>
      <Dialog open onOpenChange={(open) => {
        if (!open) closeButtonRef.current?.click()
      }}>
        <DialogContent
        className="store-checklist-session-dialog tw:max-w-[min(760px,calc(100vw-1rem))] tw:sm:max-w-[min(760px,calc(100vw-1rem))]"
        closeLabel={input.t('storeChecklists.closeSession')}
        onInteractOutside={(event) => event.preventDefault()}
        showCloseButton={false}
      >
        <div className="store-checklist-session-shell">
          <DialogHeader className="store-checklist-session-topbar">
            <AlertDialogPrimitive.Trigger asChild>
              <Button
                ref={closeButtonRef}
                aria-label={input.t('storeChecklists.closeSession')}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <XIcon data-icon="inline-start" />
              </Button>
            </AlertDialogPrimitive.Trigger>
            <div className="store-checklist-session-title-block">
              <DialogTitle className="store-checklist-session-title">
                {input.t('storeChecklists.sessionTitle')}
              </DialogTitle>
              <DialogDescription className="store-checklist-session-subtitle">
                {normalizeChecklistDisplayText(input.session.template.templateName)}
              </DialogDescription>
            </div>
            <div
              className="store-checklist-session-draft-state"
              aria-label={input.t('storeChecklists.draftSaved')}
            >
              <Cloud data-icon="inline-start" />
              {input.t('storeChecklists.draftSaved')}
            </div>
          </DialogHeader>

          <section className="store-checklist-session-summary" aria-label={input.t('storeChecklists.summaryAria')}>
            <div className="store-checklist-session-summary-copy">
              <div className="store-checklist-session-summary-title-row">
                <h3>{input.session.store.storeName}</h3>
                <ChecklistBadge tone={input.active ? 'warning' : 'accent'}>{sessionStatus}</ChecklistBadge>
              </div>
              <p>
                {sections.length} {getStaticCopy(input.locale, 'bölüm', 'sections')} ·{' '}
                {input.session.template.items.length} {getStaticCopy(input.locale, 'madde', 'items')}
              </p>
            </div>
            <div
              className="store-checklist-session-score"
              data-tone={currentScore !== null && currentScore < 70 ? 'warning' : 'calm'}
            >
              <span>{input.t('storeChecklists.liveScore')}</span>
              <strong>{currentScore ?? '—'}</strong>
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
            <main className="store-checklist-session-work" aria-label={input.t('storeChecklists.scoreInput')}>
              <div className="store-checklist-session-item-list">
                {sections.map((section, sectionIndex) => {
                  const sectionAnsweredCount = section.items.filter((item) =>
                    Number.isFinite(input.scores[item.templateItemId]),
                  ).length

                  return (
                    <section className="store-checklist-session-section" key={section.name}>
                      <header className="store-checklist-session-section-header">
                        <div>
                          <span>
                            {getStaticCopy(input.locale, 'Bölüm', 'Section')} {String(sectionIndex + 1).padStart(2, '0')}
                          </span>
                          <h2>{normalizeChecklistDisplayText(section.name)}</h2>
                        </div>
                        <strong>{sectionAnsweredCount}/{section.items.length}</strong>
                      </header>

                      <div className="store-checklist-session-section-items">
                        {section.items.map((item) => {
                          const itemIndex = itemIndexById.get(item.templateItemId) ?? 0
                          const score = input.scores[item.templateItemId]
                          const responseValue = input.responseValues[item.templateItemId]
                          const comment = input.comments[item.templateItemId] ?? ''
                          const isAnswered = Number.isFinite(score)
                          const isLowScore = responseValue !== 'not_applicable'
                            && isChecklistLowScoreSelection(item, score)
                          const noteSaveState = noteSaveStates[item.templateItemId] ?? 'idle'

                          return (
                            <article
                              className="store-checklist-session-question-card"
                              data-answered={isAnswered ? 'true' : undefined}
                              key={item.templateItemId}
                            >
                              <div className="store-checklist-session-question-copy">
                                <span className="tw:sr-only">
                                  Madde {itemIndex + 1}/{input.session.template.items.length} -{' '}
                                  {normalizeChecklistDisplayText(section.name)}
                                </span>
                                <span className="store-checklist-session-question-index">
                                  {String(itemIndex + 1).padStart(2, '0')}
                                </span>
                                <h3>{normalizeChecklistDisplayText(item.itemText)}</h3>
                              </div>

                              <ChecklistSessionAnswerControl
                                disabled={!input.active}
                                item={item}
                                locale={input.locale}
                                responseValue={responseValue}
                                score={score}
                                t={input.t}
                                onScoreChange={input.onScoreChange}
                              />

                              {isLowScore ? (
                                <p className="store-checklist-session-low-score-warning">
                                  {input.t('storeChecklists.lowScoreTaskWarning')}
                                </p>
                              ) : null}

                              <div className="store-checklist-session-item-tools">
                                <details
                                  className="store-checklist-session-disclosure store-checklist-session-note-field"
                                  open={isLowScore || comment.trim().length > 0 || undefined}
                                >
                                  <summary>
                                    <MessageSquareText aria-hidden="true" />
                                    <span>
                                      {comment
                                        ? getStaticCopy(input.locale, 'Notu düzenle', 'Edit note')
                                        : getStaticCopy(input.locale, 'Not ekle', 'Add note')}
                                    </span>
                                    <small>
                                      {isLowScore
                                        ? getStaticCopy(input.locale, 'Zorunlu', 'Required')
                                        : getStaticCopy(input.locale, 'Opsiyonel', 'Optional')}
                                    </small>
                                  </summary>
                                  <label
                                    className="tw:sr-only"
                                    htmlFor={`checklist-session-note-${item.templateItemId}`}
                                  >
                                    {input.t('storeChecklists.noteInput')}
                                  </label>
                                  <Textarea
                                    disabled={!input.active}
                                    id={`checklist-session-note-${item.templateItemId}`}
                                    maxLength={500}
                                    placeholder={getStaticCopy(input.locale, 'Kısa bir açıklama yazın', 'Write a short note')}
                                    rows={2}
                                    value={comment}
                                    onChange={(event) => {
                                      setNoteSaveStates((current) => ({
                                        ...current,
                                        [item.templateItemId]: 'idle',
                                      }))
                                      input.onCommentChange(item.templateItemId, event.target.value)
                                    }}
                                  />
                                  <div className="store-checklist-session-note-actions">
                                    <span role="status">
                                      {noteSaveState === 'error'
                                        ? getStaticCopy(input.locale, 'Not kaydedilemedi', 'Note could not be saved')
                                        : !isAnswered
                                          ? getStaticCopy(input.locale, 'Önce yanıt seçin', 'Choose an answer first')
                                          : noteSaveState === 'saved'
                                            ? getStaticCopy(input.locale, 'Taslağa kaydedildi', 'Saved to draft')
                                            : ''}
                                    </span>
                                    <Button
                                      disabled={!input.active || !isAnswered || noteSaveState === 'saving'}
                                      size="sm"
                                      type="button"
                                      onClick={() => {
                                        setNoteSaveStates((current) => ({
                                          ...current,
                                          [item.templateItemId]: 'saving',
                                        }))
                                        void input.onSaveComment(item.templateItemId, comment)
                                          .then(() => {
                                            setNoteSaveStates((current) => ({
                                              ...current,
                                              [item.templateItemId]: 'saved',
                                            }))
                                          })
                                          .catch(() => {
                                            setNoteSaveStates((current) => ({
                                              ...current,
                                              [item.templateItemId]: 'error',
                                            }))
                                          })
                                      }}
                                    >
                                      <Save data-icon="inline-start" />
                                      {noteSaveState === 'saving'
                                        ? getStaticCopy(input.locale, 'Kaydediliyor...', 'Saving...')
                                        : getStaticCopy(input.locale, 'Notu kaydet', 'Save note')}
                                    </Button>
                                  </div>
                                </details>
                              </div>
                            </article>
                          )
                        })}
                      </div>
                    </section>
                  )
                })}
              </div>
            </main>
          )}

          <div className="store-checklist-session-footer">
            <div className="store-checklist-session-footer-progress">
              <div>
                <span className="store-checklist-session-state">{footerStateText}</span>
                <strong>{progressPercent}%</strong>
              </div>
              <span className="store-checklist-session-footer-bar" aria-hidden="true">
                <span style={{ width: `${progressPercent}%` }} />
              </span>
            </div>
            <div className="store-checklist-session-footer-actions">
              <Button type="button" variant="outline" onClick={() => closeButtonRef.current?.click()}>
                <Save data-icon="inline-start" />
                {input.t('storeChecklists.draftSave')}
              </Button>
              <Button type="button" variant="outline" onClick={() => closeButtonRef.current?.click()}>
                {input.t('storeChecklists.cancelSession')}
              </Button>
              <Button
                className="store-checklist-session-complete-button"
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
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="tw:fixed tw:inset-0 tw:z-[60] tw:bg-foreground/25 tw:backdrop-blur-[2px]" />
        <AlertDialogPrimitive.Content className="tw:fixed tw:top-1/2 tw:left-1/2 tw:z-[61] tw:grid tw:w-[min(330px,calc(100vw-1.5rem))] tw:-translate-x-1/2 tw:-translate-y-1/2 tw:gap-0 tw:overflow-hidden tw:rounded-2xl tw:border tw:border-border tw:bg-background tw:p-0 tw:text-foreground tw:shadow-[0_24px_70px_rgba(20,44,53,0.24)] tw:outline-none">
          <span aria-hidden="true" className="tw:h-1 tw:bg-gradient-to-r tw:from-[#6d28d9] tw:to-[#06b6d4]" />
          <AlertDialogPrimitive.Title className="tw:px-5 tw:pt-4 tw:text-[0.95rem] tw:font-semibold tw:tracking-[-0.01em]">
            {getStaticCopy(input.locale, input.sessionDirty ? 'Değişiklikler kaybolsun mu?' : 'Checklist kapatılsın mı?', input.sessionDirty ? 'Discard changes?' : 'Close checklist?')}
          </AlertDialogPrimitive.Title>
          <AlertDialogPrimitive.Description className="tw:mt-2 tw:px-5 tw:text-[0.78rem] tw:leading-5 tw:text-muted-foreground">
            {input.sessionDirty ? input.t('storeChecklists.sessionCloseConfirm') : input.t('storeChecklists.cancelSessionConfirm')}
          </AlertDialogPrimitive.Description>
          <div className="tw:mt-4 tw:grid tw:grid-cols-2 tw:gap-2 tw:border-t tw:border-border tw:bg-muted/35 tw:px-4 tw:py-3">
            <AlertDialogPrimitive.Cancel asChild>
              <Button className="tw:h-9 tw:w-full tw:rounded-full tw:border-border tw:bg-background tw:px-3 tw:text-xs tw:font-semibold tw:text-foreground tw:shadow-none tw:focus-visible:border-ring tw:focus-visible:ring-2 tw:focus-visible:ring-ring/20 hover:tw:bg-muted" type="button" variant="outline">{getStaticCopy(input.locale, "Checklist'e dön", 'Return to checklist')}</Button>
            </AlertDialogPrimitive.Cancel>
            <AlertDialogPrimitive.Action asChild>
              <Button className="tw:h-9 tw:w-full tw:rounded-full tw:border-0 tw:bg-destructive tw:px-3 tw:text-xs tw:font-semibold tw:text-destructive-foreground tw:shadow-none tw:focus-visible:ring-2 tw:focus-visible:ring-destructive/25 hover:tw:bg-destructive/90" type="button" variant="destructive" onClick={input.onClose}>{getStaticCopy(input.locale, 'Checklisti kapat', 'Close checklist')}</Button>
            </AlertDialogPrimitive.Action>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  )
}

function ChecklistSessionAnswerControl(input: {
  disabled: boolean
  item: ChecklistTemplateItem
  locale: AppLocale
  onScoreChange: (
    templateItemId: string,
    score: number | null,
    responseValue?: ChecklistComplianceResponseValue | null,
  ) => void
  responseValue: ChecklistComplianceResponseValue | undefined
  score: number | undefined
  t: TranslateFunction
}) {
  const scoreValue = Number.isFinite(input.score) ? String(input.score) : undefined
  const selectedChoiceValue = input.item.responseType === 'compliance'
    ? input.responseValue
    : scoreValue
  const scoreOptions = getChecklistScoreOptions(input.item)
  const choiceOptions = getChecklistChoiceOptions(input.locale, input.item)

  if (choiceOptions.length > 0) {
    return (
      <div className="store-checklist-session-answer-block">
        <ToggleGroup
          className="store-checklist-session-choice-grid"
          disabled={input.disabled}
          type="single"
          value={selectedChoiceValue ?? ''}
          onValueChange={(value) => {
            if (!value) return
            const option = choiceOptions.find((candidate) => candidate.value === value)
            if (!option) return
            input.onScoreChange(
              input.item.templateItemId,
              option.scoreValue,
              option.responseValue,
            )
          }}
        >
          {choiceOptions.map((option) => (
            <ToggleGroupItem
              className="store-checklist-session-choice"
              data-tone={option.tone}
              key={`${option.label}-${option.value}`}
              value={option.value}
            >
              <strong>{option.label}</strong>
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
        <ChecklistSessionScoreInput
          disabled={input.disabled}
          item={input.item}
          score={input.score}
          onScoreChange={input.onScoreChange}
        />
      )}
    </div>
  )
}

function ChecklistSessionScoreInput(input: {
  disabled: boolean
  item: ChecklistTemplateItem
  onScoreChange: (templateItemId: string, score: number | null) => void
  score: number | undefined
}) {
  const bounds = getChecklistScoreBounds(input.item)

  return (
    <Input
      disabled={input.disabled}
      max={bounds.maxScore}
      min={bounds.minScore}
      type="number"
      value={input.score ?? ''}
      onChange={(event) =>
        input.onScoreChange(
          input.item.templateItemId,
          parseChecklistScoreInput(event.target.value, input.item),
        )
      }
    />
  )
}

function getChecklistChoiceOptions(
  locale: AppLocale,
  item: ChecklistTemplateItem,
): ChecklistChoiceOption[] {
  const maxScore = Math.max(0, item.maxScore)

  if (item.responseType === 'yes_no') {
    return [
      {
        label: getStaticCopy(locale, 'Evet', 'Yes'),
        tone: 'good',
        scoreValue: maxScore,
        value: String(maxScore),
      },
      {
        label: getStaticCopy(locale, 'Hayır', 'No'),
        tone: 'critical',
        scoreValue: 0,
        value: '0',
      },
    ]
  }

  if (item.responseType === 'partial') {
    const [good, watch, critical] = getScoreQuickOptions(locale, maxScore)
    return [
      {
        label: getStaticCopy(locale, 'Uygun', 'Good'),
        tone: 'good',
        scoreValue: good?.value ?? maxScore,
        value: String(good?.value ?? maxScore),
      },
      {
        label: getStaticCopy(locale, 'Takip', 'Watch'),
        tone: 'watch',
        scoreValue: watch?.value ?? Math.round(maxScore * 0.6),
        value: String(watch?.value ?? Math.round(maxScore * 0.6)),
      },
      {
        label: getStaticCopy(locale, 'Kritik', 'Critical'),
        tone: 'critical',
        scoreValue: critical?.value ?? Math.round(maxScore * 0.2),
        value: String(critical?.value ?? Math.round(maxScore * 0.2)),
      },
    ]
  }

  if (item.responseType === 'compliance') {
    return [
      {
        label: getStaticCopy(locale, 'Uygun', 'Compliant'),
        responseValue: 'compliant' as const,
        scoreValue: maxScore,
        tone: 'good',
        value: 'compliant',
      },
      {
        label: getStaticCopy(locale, 'Kısmen Uygun', 'Partially compliant'),
        responseValue: 'partially_compliant' as const,
        scoreValue: maxScore / 2,
        tone: 'watch',
        value: 'partially_compliant',
      },
      {
        label: getStaticCopy(locale, 'Uygun Değil', 'Non-compliant'),
        responseValue: 'non_compliant' as const,
        scoreValue: 0,
        tone: 'critical',
        value: 'non_compliant',
      },
      {
        label: 'N/A',
        responseValue: 'not_applicable' as const,
        scoreValue: 0,
        tone: 'neutral',
        value: 'not_applicable',
      },
    ]
  }

  return []
}

function normalizeChecklistDisplayText(value: string) {
  return value
    .replace(/\bGorsel\b/g, 'Görsel')
    .replace(/\bgorsel\b/g, 'görsel')
    .replace(/\bGORSEL\b/g, 'GÖRSEL')
    .replace(/\bDuzen\b/g, 'Düzen')
    .replace(/\bduzen\b/g, 'düzen')
    .replace(/\bDUZEN\b/g, 'DÜZEN')
    .replace(/\bMagaza\b/g, 'Mağaza')
    .replace(/\bmagaza\b/g, 'mağaza')
    .replace(/\bMAGAZA\b/g, 'MAĞAZA')
    .replace(/\bstandardina\b/g, 'standardına')
    .replace(/\bStandardina\b/g, 'Standardına')
    .replace(/\btum\b/g, 'tüm')
    .replace(/\bTum\b/g, 'Tüm')
    .replace(/\bhizali\b/g, 'hizalı')
    .replace(/\bHizali\b/g, 'Hizalı')
    .replace(/\buzeri\b/g, 'üzeri')
    .replace(/\bUzeri\b/g, 'Üzeri')
    .replace(/\badi\b/g, 'adı')
    .replace(/\bAdi\b/g, 'Adı')
}
