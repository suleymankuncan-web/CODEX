import { useMemo, useState, type ComponentType } from 'react'
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Cloud,
  FileText,
  ListChecks,
  MinusCircle,
  Store,
  UserRound,
  XIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import type { ChecklistAcknowledgementItem, MobileChecklistToday } from '../features/checklists/api'
import type { TranslateFunction } from '../features/localization/dictionary'
import { getErrorMessage } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import type { ChecklistSession } from './store-checklists-model'
import {
  formatChecklistStatus,
  getScoreQuickOptions,
  getStaticCopy,
  groupChecklistTemplateItems,
  parseChecklistScoreInput,
} from './store-checklists-logic'
import { ChecklistBadge, ChecklistEmptyBlock } from './store-checklists-atoms'
import { ChecklistResultModal } from './store-checklists-result-modal'

type ChecklistTemplateItem = ChecklistSession['template']['items'][number]
type ChecklistVisitItemEntry = {
  item: ChecklistTemplateItem
  itemIndex: number
  sectionIndex: number
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

                  <div className="store-checklist-session-note-field">
                    <label htmlFor={`checklist-session-note-${activeEntry.item.templateItemId}`}>
                      {input.t('storeChecklists.noteInput')}{' '}
                      <small>{getStaticCopy(input.locale, '(opsiyonel)', '(optional)')}</small>
                    </label>
                    <Textarea
                      disabled={!input.active}
                      id={`checklist-session-note-${activeEntry.item.templateItemId}`}
                      maxLength={500}
                      rows={3}
                      value={input.comments[activeEntry.item.templateItemId] ?? ''}
                      onChange={(event) =>
                        input.onCommentChange(activeEntry.item.templateItemId, event.target.value)
                      }
                    />
                  </div>

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
              {input.completeError ? (
                <span>{getErrorMessage(input.completeError)}</span>
              ) : !input.active && input.isStarting ? (
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
