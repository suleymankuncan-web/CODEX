import { useMemo } from 'react'
import {
  CheckCircle2,
  CircleAlert,
  Cloud,
  MinusCircle,
  Save,
  Store,
  XIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { ChecklistAcknowledgementItem, MobileChecklistToday } from '../features/checklists/api'
import type { TranslateFunction } from '../features/localization/dictionary'
import { getUserFacingErrorMessage } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import type { ChecklistSession } from './store-checklists-model'
import {
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

type ChecklistTemplateItem = ChecklistSession['template']['items'][number]
type ChecklistVisitItemEntry = {
  item: ChecklistTemplateItem
  sectionName: string
}

export function StoreChecklistsModals(input: {
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
    completeError: unknown | null
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
          completeError={input.visitState.completeError}
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
  onComplete: (checklistInstanceId: string) => void
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
      sections.flatMap((section) =>
        section.items.map((item) => ({
          item,
          sectionName: section.name,
        })),
      ),
    [sections],
  )
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
    if (typeof score !== 'number' || !Number.isFinite(score) || item.maxScore <= 0) continue
    scoredRatioTotal += Math.round((score / item.maxScore) * 100)
    scoredRatioCount += 1
  }

  const currentScore =
    scoredRatioCount > 0 ? Math.round(scoredRatioTotal / scoredRatioCount) : 0
  const missingResponseCount = Math.max(input.session.template.items.length - answeredCount, 0)
  const missingRequiredLowScoreNoteCount = input.session.template.items.filter((item) =>
    isChecklistLowScoreNoteMissing({
      commentText: input.comments[item.templateItemId],
      item,
      score: input.scores[item.templateItemId],
    }),
  ).length
  const canComplete =
    Boolean(input.active) &&
    !input.isCompleting &&
    hasItems &&
    missingResponseCount === 0 &&
    missingRequiredLowScoreNoteCount === 0
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
          : input.isSaving
            ? input.t('storeChecklists.autosaving')
            : input.t('storeChecklists.draftSaved')

  return (
    <Dialog open onOpenChange={(open) => {
      if (!open) input.onClose()
    }}>
      <DialogContent
        className="store-checklist-session-dialog tw:max-w-[min(760px,calc(100vw-1rem))] tw:sm:max-w-[min(760px,calc(100vw-1rem))]"
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
            <div
              className="store-checklist-session-draft-state"
              aria-label={input.t('storeChecklists.draftSaved')}
            >
              <Cloud data-icon="inline-start" />
              {input.t('storeChecklists.draftSaved')}
            </div>
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
            <main className="store-checklist-session-work" aria-label={input.t('storeChecklists.scoreInput')}>
              <div className="store-checklist-session-item-list">
                {itemEntries.map((entry, index) => {
                  const score = input.scores[entry.item.templateItemId]
                  const isAnswered = Number.isFinite(score)
                  const isLowScore = isChecklistLowScoreSelection(entry.item, score)
                  return (
                    <article
                      className="store-checklist-session-question-card"
                      data-answered={isAnswered ? 'true' : undefined}
                      key={entry.item.templateItemId}
                    >
                      <div className="store-checklist-session-question-copy">
                        <span className="store-checklist-session-question-badge">
                          Madde {index + 1}/{itemEntries.length} - {entry.sectionName}
                        </span>
                        <h3>{entry.item.itemText}</h3>
                      </div>

                      <ChecklistSessionAnswerControl
                        disabled={!input.active}
                        item={entry.item}
                        locale={input.locale}
                        score={score}
                        t={input.t}
                        onScoreChange={input.onScoreChange}
                      />

                      {isLowScore ? (
                        <p className="store-checklist-session-low-score-warning">
                          {input.t('storeChecklists.lowScoreTaskWarning')}
                        </p>
                      ) : null}

                      <div className="store-checklist-session-note-field">
                        <label htmlFor={`checklist-session-note-${entry.item.templateItemId}`}>
                          {input.t('storeChecklists.noteInput')}{' '}
                          <small>{getStaticCopy(input.locale, '(opsiyonel)', '(optional)')}</small>
                        </label>
                        <Textarea
                          disabled={!input.active}
                          id={`checklist-session-note-${entry.item.templateItemId}`}
                          maxLength={500}
                          rows={3}
                          value={input.comments[entry.item.templateItemId] ?? ''}
                          onChange={(event) =>
                            input.onCommentChange(entry.item.templateItemId, event.target.value)
                          }
                        />
                      </div>
                    </article>
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
              <Button type="button" variant="outline" onClick={input.onClose}>
                <Save data-icon="inline-start" />
                {input.t('storeChecklists.draftSave')}
              </Button>
              <Button type="button" variant="outline" onClick={input.onClose}>
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
  const scoreOptions = getChecklistScoreOptions(input.item)
  const choiceOptions = getChecklistChoiceOptions(input.locale, input.item)

  if (choiceOptions.length > 0) {
    return (
      <div className="store-checklist-session-answer-block">
        <div className="store-checklist-session-answer-heading">
          <span>{input.t('storeChecklists.scoreInput')}</span>
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
