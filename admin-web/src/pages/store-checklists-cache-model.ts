import type { MobileChecklistTodayResponse } from '../features/checklists/api'
import type { ChecklistCompletedInstance } from './store-checklists-model'
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
    totalScore: input.totalScore ?? 0,
  }
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
  const nextAverage =
    input.totalScore === null
      ? (existingSummary?.averageScore ?? null)
      : existingSummary?.averageScore === null || existingSummary?.averageScore === undefined || existingCompleted
        ? input.totalScore
        : Math.round(
            (((existingSummary.averageScore * previousCount) + input.totalScore) / Math.max(nextCount, 1)) * 100,
          ) / 100
  const pendingRow = {
    checklistInstanceId: input.checklistInstanceId,
    checklistTemplateId: input.checklistTemplateId,
    completedAt,
    storeId: input.storeId,
    totalScore: input.totalScore ?? 0,
  }

  return {
    ...current,
    data: {
      ...current.data,
      activeInstances: current.data.activeInstances.filter(
        (instance) => instance.checklistInstanceId !== input.checklistInstanceId,
      ),
      completedThisMonth: existingCompleted
        ? current.data.completedThisMonth.map((item) =>
            item.checklistInstanceId === input.checklistInstanceId ? completedRow : item,
          )
        : [completedRow, ...current.data.completedThisMonth],
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
