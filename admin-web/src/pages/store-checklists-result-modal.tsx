import { useEffect, useRef, type CSSProperties } from 'react'
import {
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  XIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import type { ChecklistAcknowledgementItem } from '../features/checklists/api'
import type { TranslateFunction } from '../features/localization/dictionary'
import { normalizeDisplayLabel } from '../lib/display-labels'
import { formatDateTime, formatNumber } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import {
  formatCompletedSentence,
  formatScoreValue,
  getResponseRatio,
  getStaticCopy,
  getWeightedResponsePoints,
  groupChecklistResultResponses,
} from './store-checklists-logic'
import type { ChecklistTone } from './store-checklists-model'

type ChecklistResultItemTone = 'danger' | 'warning' | 'success' | 'neutral'
type ChecklistResultResponse = ChecklistAcknowledgementItem['responses'][number]

function getChecklistResultItemTone(item: ChecklistResultResponse): ChecklistResultItemTone {
  const ratio = getResponseRatio(item)
  if (ratio === null) return 'neutral'
  if (ratio < 70) return 'danger'
  if (ratio < 80) return 'warning'
  return 'success'
}

function getChecklistResultAnswerLabel(locale: AppLocale, response: ChecklistResultResponse) {
  if (response.scoreValue === null) return getStaticCopy(locale, 'Yanıt yok', 'No answer')

  switch (response.responseType.trim().toLowerCase()) {
    case 'compliance':
      switch (response.responseValue) {
        case 'compliant':
          return getStaticCopy(locale, 'Uygun', 'Compliant')
        case 'partially_compliant':
          return getStaticCopy(locale, 'Kısmen Uygun', 'Partially compliant')
        case 'non_compliant':
          return getStaticCopy(locale, 'Uygun Değil', 'Non-compliant')
        case 'not_applicable':
          return 'N/A'
        default:
          return getStaticCopy(locale, 'Yanıt yok', 'No answer')
      }
    case 'yes_no':
    case 'boolean':
      return response.scoreValue > 0
        ? getStaticCopy(locale, 'Evet', 'Yes')
        : getStaticCopy(locale, 'Hayır', 'No')
    case 'partial': {
      const ratio = getResponseRatio(response)
      if (ratio === null) return getStaticCopy(locale, 'Yanıt yok', 'No answer')
      if (ratio >= 80) return getStaticCopy(locale, 'Uygun', 'Good')
      if (ratio >= 40) return getStaticCopy(locale, 'Takip', 'Watch')
      return getStaticCopy(locale, 'Kritik', 'Critical')
    }
    case 'text':
      return normalizeDisplayLabel(
        response.commentText,
        getStaticCopy(locale, 'Yanıt yok', 'No answer'),
      )
    default:
      return String(response.scoreValue)
  }
}

function ChecklistResultSectionScore(input: {
  earnedPoints: number
  label: string
  locale: AppLocale
  maxPoints: number
  percent: number
}) {
  const percent = Math.min(Math.max(Math.round(input.percent), 0), 100)
  const earnedPoints = formatNumber(input.earnedPoints, input.locale, { maximumFractionDigits: 2 })
  const maxPoints = formatNumber(input.maxPoints, input.locale, { maximumFractionDigits: 2 })

  return (
    <div
      aria-label={`${earnedPoints} / ${maxPoints} ${input.label}, ${percent}%`}
      className="store-checklist-result-section-score"
      title={`${earnedPoints} / ${maxPoints} ${input.label} · ${percent}%`}
    >
      <strong><span>{earnedPoints}</span><i>/</i><span>{maxPoints}</span></strong>
      <small>{input.label}</small>
    </div>
  )
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

  const sections = groupChecklistResultResponses(input.item.responses)
  const sectionCount = sections.length
  const questionCount = input.item.responses.length
  const sectionUnit = getStaticCopy(
    input.locale,
    'bölüm',
    sectionCount === 1 ? 'section' : 'sections',
  )
  const questionUnit = getStaticCopy(
    input.locale,
    'soru',
    questionCount === 1 ? 'question' : 'questions',
  )
  const hasAcknowledgement = input.item.acknowledgement !== null
  const showAcknowledgementPanel = input.canAcknowledge || hasAcknowledgement
  const scorePercent =
    input.item.totalScore ??
    (typeof input.item.complianceRate === 'number'
      ? Math.round(input.item.complianceRate * 100)
      : null)
  const scoreTone: ChecklistTone = scorePercent === null ? 'neutral' : scorePercent >= 70 ? 'calm' : 'warning'
  const scoreLabel = formatScoreValue(input.t, scorePercent)
  const compactScore = scoreLabel.length > 4
  const scoreRingStyle = {
    '--store-checklist-result-score-percent': `${Math.min(Math.max(scorePercent ?? 0, 0), 100)}%`,
  } as CSSProperties
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
        className="store-checklist-modal store-checklist-result-modal tw:max-w-[min(960px,calc(100vw-1rem))] tw:sm:max-w-[min(960px,calc(100vw-1rem))]"
        showCloseButton={false}
      >
        <section className="store-checklist-result-hero" aria-label={input.t('storeChecklists.summaryAria')}>
          <DialogHeader className="store-checklist-result-head">
            <div className="store-checklist-result-title-row">
              <span className={`store-checklist-result-icon store-checklists-tone-${scoreTone}`} aria-hidden="true">
                <ClipboardCheck />
              </span>
              <div>
                <div className="store-checklists-eyebrow">{input.t('storeChecklists.resultEyebrow')}</div>
                <DialogTitle>{input.item.templateName}</DialogTitle>
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

          <div className="store-checklist-result-overview">
            <div className={`store-checklist-result-score-card store-checklist-result-score-card-${scoreTone}`}>
              <div
                aria-label={`${input.t('storeChecklists.score')} ${scoreLabel}`}
                className={`store-checklist-result-score-ring${compactScore ? ' is-compact' : ''}`}
                style={scoreRingStyle}
              >
                <strong>{scoreLabel}</strong>
                <span>{input.t('storeChecklists.score')}</span>
              </div>
            </div>
            <dl className="store-checklist-result-hero-facts">
              <div className="store-checklist-result-hero-fact">
                <dt>{input.t('storeChecklists.store')}</dt>
                <dd>{storeLabel}</dd>
              </div>
              <div className="store-checklist-result-hero-fact">
                <dt>{input.t('storeChecklists.resultCompletedBy')}</dt>
                <dd>{completedByLabel}</dd>
              </div>
            </dl>
          </div>
        </section>

        <div className={`store-checklist-result-body${showAcknowledgementPanel ? '' : ' store-checklist-result-body--solo'}`}>
          <section className="store-checklist-result-findings" aria-label={input.t('storeChecklists.resultBreakdownTitle')}>
            <div className="store-checklist-result-block-head">
              <div>
                <span>{input.t('storeChecklists.resultItemsEyebrow')}</span>
                <strong>{input.t('storeChecklists.resultBreakdownTitle')}</strong>
              </div>
              <span
                aria-label={`${sectionCount} ${sectionUnit}, ${questionCount} ${questionUnit}`}
                className="store-checklist-result-section-count"
              >
                <span><b>{sectionCount}</b> {sectionUnit}</span>
                <i aria-hidden="true" />
                <span><b>{questionCount}</b> {questionUnit}</span>
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
                    <ChecklistResultSectionScore
                      earnedPoints={section.earnedPoints}
                      label={getStaticCopy(input.locale, 'Puan', 'Points')}
                      locale={input.locale}
                      maxPoints={section.maxPoints}
                      percent={section.averageScore}
                    />
                  </div>
                  <div className="store-checklist-result-items">
                    {section.items.map((response, responseIndex) => {
                      const itemTone = getChecklistResultItemTone(response)
                      const itemNumber = response.itemNo || responseIndex + 1
                      const answerLabel = getChecklistResultAnswerLabel(input.locale, response)
                      const weightedPoints = getWeightedResponsePoints(response)
                      const scoreValue = response.responseValue === 'not_applicable'
                        ? getStaticCopy(input.locale, 'Puan dışı', 'Excluded')
                        : weightedPoints === null
                          ? input.t('storeChecklists.noScore')
                          : `${formatNumber(weightedPoints.earnedPoints, input.locale, { maximumFractionDigits: 2 })}/${formatNumber(weightedPoints.maxPoints, input.locale, { maximumFractionDigits: 2 })}`

                      return (
                        <div
                          className={`store-checklist-result-item store-checklist-result-item-${itemTone}`}
                          key={response.templateItemId}
                        >
                          <span className="store-checklist-result-item-index" aria-hidden="true">
                            {String(itemNumber).padStart(2, '0')}
                          </span>
                          <div className="store-checklist-result-item-main">
                            <div className="store-checklist-result-item-title-line">
                              <strong title={response.itemText}>{response.itemText}</strong>
                            </div>
                          </div>
                          <dl className="store-checklist-result-item-outcome">
                            <div>
                              <dt>{getStaticCopy(input.locale, 'Cevap', 'Answer')}</dt>
                              <dd title={answerLabel}>{answerLabel}</dd>
                            </div>
                            <div>
                              <dt>{getStaticCopy(input.locale, 'Puan', 'Score')}</dt>
                              <dd>{scoreValue}</dd>
                            </div>
                          </dl>
                        </div>
                      )
                    })}
                  </div>
                </article>
              ))}
            </div>
          </section>

          {showAcknowledgementPanel ? <aside className="store-checklist-result-action-card">
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
          </aside> : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
