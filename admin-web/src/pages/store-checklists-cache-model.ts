import type { MobileChecklistTodayResponse } from '../features/checklists/api'
import { upsertChecklistActiveResponse, type ChecklistCompletedInstance, type ChecklistResponseDraft } from './store-checklists-model'
import { getMonthKey } from './store-checklists-logic'

export function mergeCompletedInstanceIntoMobileToday(
  current: MobileChecklistTodayResponse | undefined,
  input: ChecklistCompletedInstance,
) {
  if (!current) return current

  const completedAt = input.completedAt ?? new Date().toISOString()
  const monthKey = getMonthKey(completedAt)
  const monthStart = monthKey ? `${monthKey}-01` : completedAt.slice(0, 10)
  const existingCompleted = current.data.completedThisMonth.some(
    (item) => item.checklistInstanceId === input.checklistInstanceId,
  )
  const completedRow = {
    acknowledgedAt: null,
    checklistInstanceId: input.checklistInstanceId,
    checklistTemplateId: input.checklistTemplateId,
    completedAt,
    storeId: input.storeId,
    totalScore: input.totalScore,
  }
  const completedThisMonth = existingCompleted
    ? current.data.completedThisMonth.map((item) =>
        item.checklistInstanceId === input.checklistInstanceId ? completedRow : item,
      )
    : [completedRow, ...current.data.completedThisMonth]
  const monthlySummaries = current.data.monthlySummaries.filter(
    (summary) =>
      !(
        summary.storeId === input.storeId &&
        summary.checklistTemplateId === input.checklistTemplateId &&
        getMonthKey(summary.monthStart) === monthKey
      ),
  )
  const existingSummary = current.data.monthlySummaries.find(
    (summary) =>
      summary.storeId === input.storeId &&
      summary.checklistTemplateId === input.checklistTemplateId &&
      getMonthKey(summary.monthStart) === monthKey,
  )
  const previousCount = existingSummary?.completedCount ?? 0
  const nextCount = existingCompleted ? Math.max(previousCount, 1) : previousCount + 1
  const scoredRows = completedThisMonth.filter((item) =>
    item.storeId === input.storeId && item.checklistTemplateId === input.checklistTemplateId &&
    getMonthKey(item.completedAt) === monthKey && item.totalScore !== null,
  )
  const nextAverage = scoredRows.length > 0
    ? Math.round((scoredRows.reduce((sum, item) => sum + (item.totalScore ?? 0), 0) / scoredRows.length) * 100) / 100
    : null
  const pendingRow = {
    checklistInstanceId: input.checklistInstanceId,
    checklistTemplateId: input.checklistTemplateId,
    completedAt,
    storeId: input.storeId,
    totalScore: input.totalScore,
  }

  return {
    ...current,
    data: {
      ...current.data,
      activeInstances: current.data.activeInstances.filter(
        (instance) => instance.checklistInstanceId !== input.checklistInstanceId,
      ),
      completedThisMonth,
      monthlySummaries: [
        ...monthlySummaries,
        {
          averageScore: nextAverage,
          checklistTemplateId: input.checklistTemplateId,
          completedCount: nextCount,
          monthStart,
          storeId: input.storeId,
        },
      ],
      pendingAcknowledgements: current.data.pendingAcknowledgements.some(
        (item) => item.checklistInstanceId === input.checklistInstanceId,
      )
        ? current.data.pendingAcknowledgements.map((item) =>
            item.checklistInstanceId === input.checklistInstanceId ? pendingRow : item,
          )
        : [pendingRow, ...current.data.pendingAcknowledgements],
    },
  }
}

export function mergeSavedResponseIntoMobileToday(
  current: MobileChecklistTodayResponse | undefined,
  draft: ChecklistResponseDraft,
  updatedAt: string | null,
) {
  if (!current) return current

  let didUpdate = false
  const activeInstances = current.data.activeInstances.map((instance) => {
    if (instance.checklistInstanceId !== draft.checklistInstanceId) return instance
    didUpdate = true
    return upsertChecklistActiveResponse(instance, draft, updatedAt)
  })

  if (!didUpdate) return current

  return {
    ...current,
    data: {
      ...current.data,
      activeInstances,
    },
  }
}
