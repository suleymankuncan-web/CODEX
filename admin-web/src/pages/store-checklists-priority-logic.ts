import type { ChecklistAcknowledgementItem } from '../features/checklists/api'
import type { TranslateFunction } from '../features/localization/dictionary'
import { formatNumber } from '../lib/format'
import type { AppLocale } from '../lib/i18n'
import type { ChecklistStoreVisitRow, ChecklistTone } from './store-checklists-model'
import {
  getChecklistResultDigest,
  getStoreVisitRiskLabel,
  getStoreVisitRiskTone,
  getStoreVisitRowKey,
  getStoreVisitScore,
} from './store-checklists-logic'

export type ChecklistPriorityAction = {
  copy: string
  id: string
  title: string
  tone: ChecklistTone
  value: string
  variant: 'visit' | 'inbox'
}

export function buildChecklistPriorityActions(input: {
  canManageVisits: boolean
  items: ChecklistAcknowledgementItem[]
  locale: AppLocale
  requiresCombinedVisitTemplates: boolean
  rows: ChecklistStoreVisitRow[]
  t: TranslateFunction
}): { items: ChecklistPriorityAction[]; totalCount: number } {
  if (input.canManageVisits) {
    const actions = input.rows.map((row) => {
      const score = getStoreVisitScore(row)
      const tone = getStoreVisitRiskTone(row, input.requiresCombinedVisitTemplates)
      return {
        copy: getStoreVisitRiskLabel(input.t, input.locale, row, input.requiresCombinedVisitTemplates),
        id: getStoreVisitRowKey(row),
        title: row.store.storeName,
        tone,
        value:
          score === null
            ? '-'
            : formatNumber(score, input.locale, { maximumFractionDigits: 1 }),
        variant: 'visit' as const,
      }
    })

    return {
      items: actions.slice(0, 5),
      totalCount: actions.length,
    }
  }

  const actions = input.items.map((item) => {
    const digest = getChecklistResultDigest(input.t, input.locale, item)
    const score = item.totalScore ?? (typeof item.complianceRate === 'number' ? item.complianceRate * 100 : null)

    return {
      copy: digest.copy,
      id: item.checklistInstanceId,
      title: item.storeName || item.storeId,
      tone: digest.tone,
      value:
        score === null
          ? '-'
          : formatNumber(score, input.locale, { maximumFractionDigits: 1 }),
      variant: 'inbox' as const,
    }
  })

  return {
    items: actions.slice(0, 5),
    totalCount: actions.length,
  }
}

export function isIncompleteStoreVisitRow(row: ChecklistStoreVisitRow, requiresCombinedVisitTemplates: boolean) {
  const visibleRows = [row.bm, row.vm].filter(Boolean)
  if (visibleRows.length === 0) return true
  if (requiresCombinedVisitTemplates) {
    return visibleRows.some((item) => (item?.completedCount ?? 0) === 0)
  }
  return visibleRows.every((item) => (item?.completedCount ?? 0) === 0)
}
