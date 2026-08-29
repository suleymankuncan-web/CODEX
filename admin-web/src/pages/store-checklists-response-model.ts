import type { ChecklistComplianceResponseValue } from '../features/checklists/api'
import { formatDateTime } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import type { ChecklistResponseDraft, ChecklistSession } from './store-checklists-model'

export function normalizeSearch(input: string) {
  return input.trim().toLocaleLowerCase('tr-TR')
}

export function formatOptionalDate(value: string | null | undefined, locale: AppLocale) {
  return value ? formatDateTime(value, locale) : '-'
}

export function buildChecklistResponseDrafts(input: {
  checklistInstanceId: string
  comments: Record<string, string>
  responseValues: Record<string, ChecklistComplianceResponseValue>
  scores: Record<string, number>
  session: ChecklistSession
}): ChecklistResponseDraft[] {
  const drafts: ChecklistResponseDraft[] = []

  for (const item of input.session.template.items) {
    const score = input.scores[item.templateItemId]
    if (typeof score !== 'number' || !Number.isFinite(score)) continue

    const commentText = input.comments[item.templateItemId]
    drafts.push({
      checklistInstanceId: input.checklistInstanceId,
      templateItemId: item.templateItemId,
      ...(input.responseValues[item.templateItemId]
        ? { responseValue: input.responseValues[item.templateItemId] }
        : {}),
      scoreValue: score,
      ...(commentText ? { commentText } : {}),
    })
  }

  return drafts
}

export function getChecklistResponseDraftKey(input: { checklistInstanceId: string; templateItemId: string }) {
  return `${input.checklistInstanceId}:${input.templateItemId}`
}

export function serializeChecklistResponseDraft(input: {
  scoreValue: number
  responseValue?: string
  commentText?: string
}) {
  return JSON.stringify({
    commentText: input.commentText ?? '',
    responseValue: input.responseValue ?? '',
    scoreValue: input.scoreValue,
  })
}

export function getScoreQuickOptions(locale: AppLocale, maxScore: number) {
  const safeMax = Math.max(0, maxScore)
  const watch = Math.round(safeMax * 0.6)
  const critical = Math.round(safeMax * 0.2)
  const option = (tr: string, en: string, value: number) => ({ label: `${getStaticCopy(locale, tr, en)} ${value}`, value })

  return [option('Uygun', 'Good', safeMax), option('Takip', 'Watch', watch), option('Kritik', 'Critical', critical)]
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function getStaticCopy(locale: AppLocale, tr: string, en: string) {
  return locale === 'en' ? en : tr
}
