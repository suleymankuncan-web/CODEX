import { useEffect, useRef, type CSSProperties } from 'react'
import {
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Store as StoreIcon,
  UserRound,
  XIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import type { ChecklistAcknowledgementItem } from '../features/checklists/api'
import type { TranslateFunction } from '../features/localization/dictionary'
import { normalizeDisplayLabel } from '../lib/display-labels'
import { formatDateTime } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import {
  formatChecklistTemplateType,
  formatCompletedSentence,
  formatComplianceValue,
  formatScoreValue,
  getLowScoreResponses,
  getResponseRatio,
  getStaticCopy,
  groupChecklistResultResponses,
} from './store-checklists-logic'
import type { ChecklistTone } from './store-checklists-model'
import { ChecklistFact, ChecklistScoreBar } from './store-checklists-atoms'

type ChecklistResultItemTone = 'danger' | 'warning' | 'success' | 'neutral'

function getChecklistResultItemTone(item: ChecklistAcknowledgementItem['responses'][number]): ChecklistResultItemTone {
  const ratio = getResponseRatio(item)
  if (ratio === null) return 'neutral'
  if (ratio < 70) return 'danger'
  if (ratio < 80) return 'warning'
  return 'success'
}

function getChecklistResultItemToneLabel(t: TranslateFunction, tone: ChecklistResultItemTone) {
  switch (tone) {
    case 'danger':
      return t('storeChecklists.resultTone.low')
    case 'warning':
      return t('storeChecklists.resultTone.follow')
    case 'success':
      return t('storeChecklists.resultTone.good')
    case 'neutral':
      return t('storeChecklists.resultTone.noScore')
  }
}

export function ChecklistResultModal(input: {
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
  const scorePercent =
    input.item.totalScore ??
    (typeof input.item.complianceRate === 'number'
      ? Math.round(input.item.complianceRate * 100)
      : null)
  const scoreTone: ChecklistTone = scorePercent === null ? 'neutral' : scorePercent >= 70 ? 'calm' : 'warning'
  const scoreLabel = formatScoreValue(input.t, scorePercent)
  const scoreRingStyle = {
    '--store-checklist-result-score-percent': `${Math.min(Math.max(scorePercent ?? 0, 0), 100)}%`,
  } as CSSProperties
  const completedAt = input.item.completedAt
    ? formatDateTime(input.item.completedAt, input.locale)
    : input.t('storeChecklists.unknown')
  const storeLabel = normalizeDisplayLabel(input.item.storeName, input.t('storeChecklists.unknown'))
  const completedByLabel = normalizeDisplayLabel(
    input.item.completedByUserId,
    input.t('storeChecklists.unknown'),
  )

  return (
    <Dialog open onOpenChange={(open) => {
      if (!open) input.onClose()
    }}>
      <DialogContent
        className="store-checklist-modal store-checklist-result-modal tw:max-w-[min(1120px,calc(100vw-2rem))] tw:sm:max-w-[min(1120px,calc(100vw-2rem))]"
        showCloseButton={false}
      >
        <DialogHeader className="store-checklist-result-head">
          <div className="store-checklist-result-title-row">
            <span className={`store-checklist-result-icon store-checklists-tone-${scoreTone}`} aria-hidden="true">
              <ClipboardCheck />
            </span>
            <div>
              <div className="store-checklists-eyebrow">{input.t('storeChecklists.resultEyebrow')}</div>
              <DialogTitle id="store-checklist-result-title">{input.item.templateName}</DialogTitle>
              <DialogDescription>{formatCompletedSentence(input.t, input.locale, input.item)}</DialogDescription>
            </div>
          </div>
          <Button
            aria-label={input.t('storeChecklists.closeSession')}
            size="icon-sm"
            type="button"
            variant="ghost"
            onClick={input.onClose}
          >
            <XIcon aria-hidden="true" />
          </Button>
        </DialogHeader>

        <section className="store-checklist-result-overview" aria-label={input.t('storeChecklists.summaryAria')}>
          <div className={`store-checklist-result-score-card store-checklist-result-score-card-${scoreTone}`}>
            <div
              aria-label={`${input.t('storeChecklists.score')} ${scoreLabel}`}
              className="store-checklist-result-score-ring"
              style={scoreRingStyle}
            >
              <strong>{scoreLabel}</strong>
              <span>{input.t('storeChecklists.score')}</span>
            </div>
          </div>
          <div className="store-checklist-modal-summary">
            <ChecklistFact label={input.t('storeChecklists.store')} value={storeLabel} />
            <ChecklistFact label={input.t('storeChecklists.templateType')} value={formatChecklistTemplateType(input.t, input.item.templateType)} />
            <ChecklistFact
              label={input.t('storeChecklists.resultCompletedBy')}
              value={completedByLabel}
            />
            <ChecklistFact
              label={input.t('storeChecklists.resultStatus')}
              value={
                hasAcknowledgement
                  ? input.t('storeChecklists.acknowledged')
                  : input.t('storeChecklists.needsAcknowledgement')
              }
            />
            <ChecklistFact
              label={input.t('storeChecklists.resultLowScore')}
              value={input.t('storeChecklists.lowScoreCount', { count: lowScoreResponses.length })}
            />
            <ChecklistFact
              label={input.t('storeChecklists.compliance')}
              value={formatComplianceValue(input.t, input.item.complianceRate)}
            />
            <ChecklistFact
              label={input.t('storeChecklists.section')}
              value={input.t('storeChecklists.resultSectionCount', { count: sections.length })}
            />
            <ChecklistFact label={getStaticCopy(input.locale, 'Tamamlanma', 'Completed')} value={completedAt} />
          </div>
        </section>

        <div className="store-checklist-result-body">
          <section className="store-checklist-result-findings" aria-label={input.t('storeChecklists.resultBreakdownTitle')}>
            <div className="store-checklist-result-block-head">
              <div>
                <span>{input.t('storeChecklists.resultItemsEyebrow')}</span>
                <strong>{input.t('storeChecklists.resultBreakdownTitle')}</strong>
              </div>
              <span className="store-checklist-result-section-count">
                {input.t('storeChecklists.resultSectionCount', { count: sections.length })}
              </span>
            </div>
            <div className="store-checklist-result-status-legend" aria-label={input.t('storeChecklists.resultColorMeaning')}>
              <strong>{input.t('storeChecklists.resultColorMeaning')}</strong>
              <span>
                <i className="store-checklist-result-legend-dot store-checklist-result-legend-dot-danger" aria-hidden="true" />
                {input.t('storeChecklists.resultTone.low')}
              </span>
              <span>
                <i className="store-checklist-result-legend-dot store-checklist-result-legend-dot-warning" aria-hidden="true" />
                {input.t('storeChecklists.resultTone.follow')}
              </span>
              <span>
                <i className="store-checklist-result-legend-dot store-checklist-result-legend-dot-success" aria-hidden="true" />
                {input.t('storeChecklists.resultTone.good')}
              </span>
            </div>
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
                      const itemTone = getChecklistResultItemTone(response)
                      const itemToneLabel = getChecklistResultItemToneLabel(input.t, itemTone)

                      return (
                        <div
                          className={`store-checklist-result-item store-checklist-result-item-${itemTone}`}
                          key={response.templateItemId}
                        >
                          <div>
                            <div className="store-checklist-result-item-title-line">
                              <strong>{response.itemText}</strong>
                              <span className={`store-checklist-result-item-status store-checklist-result-item-status-${itemTone}`}>
                                {itemToneLabel}
                              </span>
                            </div>
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
          </section>

          <aside className="store-checklist-result-action-card">
            <div className="store-checklist-result-block-head">
              <div>
                <span>{getStaticCopy(input.locale, 'Aksiyon', 'Action')}</span>
                <strong>
                  {hasAcknowledgement
                    ? input.t('storeChecklists.acknowledged')
                    : input.canAcknowledge
                      ? input.t('storeChecklists.needsAcknowledgement')
                      : getStaticCopy(input.locale, 'İnceleme', 'Review')}
                </strong>
              </div>
              {hasAcknowledgement ? <CheckCircle2 aria-hidden="true" /> : <CalendarClock aria-hidden="true" />}
            </div>
            <div className="store-checklist-result-action-context">
              <span className="store-checklist-result-quick-fact-icon" aria-hidden="true"><StoreIcon /></span>
              <div>
                <span>{input.t('storeChecklists.store')}</span>
                <strong>{storeLabel}</strong>
              </div>
              <span className="store-checklist-result-quick-fact-icon" aria-hidden="true"><UserRound /></span>
              <div>
                <span>{input.t('storeChecklists.resultCompletedBy')}</span>
                <strong>{completedByLabel}</strong>
              </div>
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
                  <Textarea
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
                    <Button variant="outline" type="button" onClick={input.onClose}>
                      {input.t('storeChecklists.cancelSession')}
                    </Button>
                    <Button
                      disabled={input.isAcknowledging}
                      type="button"
                      onClick={() => input.onAcknowledge(acknowledgementNoteRef.current)}
                    >
                      {input.isAcknowledging
                        ? input.t('storeChecklists.acknowledging')
                        : input.t('storeChecklists.acknowledge')}
                    </Button>
                  </div>
                </>
              ) : (
                <p className="store-checklists-inline-notice">{input.t('storeChecklists.reviewOnlyCopy')}</p>
              )}
            </div>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  )
}
