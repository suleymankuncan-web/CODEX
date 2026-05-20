import { useEffect, useRef } from 'react'
import type { ChecklistAcknowledgementItem } from '../features/checklists/api'
import type { TranslateFunction } from '../features/localization/dictionary'
import { formatDateTime } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import {
  formatChecklistTemplateType,
  formatCompletedSentence,
  formatComplianceValue,
  formatScoreValue,
  getChecklistResultDigest,
  getLowScoreResponses,
  getResponseRatio,
  getStaticCopy,
  groupChecklistResultResponses,
} from './store-checklists-logic'
import { ChecklistFact, ChecklistScoreBar } from './store-checklists-atoms'

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
