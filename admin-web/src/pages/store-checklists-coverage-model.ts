import type { ChecklistAcknowledgementItem, MobileChecklistToday } from '../features/checklists/api'
import type {
  ChecklistActiveInstance,
  ChecklistCoverageRow,
  ChecklistStoreVisitRow,
} from './store-checklists-model'
import { mergeChecklistActiveInstanceOverlay } from './store-checklists-model'
import {
  buildChecklistStoreVisitRows,
  compareDate,
  getCoverageRowKey,
  getMonthKey,
} from './store-checklists-logic'

export type BuildChecklistCoverageRowsInput = {
  acknowledgementItems: ChecklistAcknowledgementItem[]
  localActiveInstances: Record<string, ChecklistActiveInstance>
  localCompletedRows: Record<string, number>
  mobileToday: MobileChecklistToday | undefined
  month: string
}

export function buildChecklistCoverageRows(
  input: BuildChecklistCoverageRowsInput,
): ChecklistCoverageRow[] {
  return (input.mobileToday?.stores ?? []).flatMap((store) =>
    (input.mobileToday?.templates ?? []).map((template) => {
      const rowKey = getCoverageRowKey(store.storeId, template.checklistTemplateId)
      const queryActive = input.mobileToday?.activeInstances.find(
        (item) =>
          item.storeId === store.storeId &&
          item.checklistTemplateId === template.checklistTemplateId,
      )
      const active = mergeChecklistActiveInstanceOverlay(
        queryActive,
        input.localActiveInstances[rowKey],
      )
      const matchingSummaries = (input.mobileToday?.monthlySummaries ?? []).filter(
        (item) =>
          item.storeId === store.storeId &&
          item.checklistTemplateId === template.checklistTemplateId,
      )
      const summary =
        input.month === 'all'
          ? matchingSummaries[0]
          : matchingSummaries.find((item) => getMonthKey(item.monthStart) === input.month)
      const completedSource = getCoverageCompletedSource({
        acknowledgementItems: input.acknowledgementItems,
        checklistTemplateId: template.checklistTemplateId,
        mobileToday: input.mobileToday,
        month: input.month,
        storeId: store.storeId,
      })

      return {
        store,
        template,
        active,
        summary,
        completedAt: completedSource.completedAt,
        completedCount: Math.max(
          summary?.completedCount ?? 0,
          completedSource.completedCount,
          input.localCompletedRows[rowKey] ?? 0,
        ),
      }
    }),
  )
}

export function buildChecklistVisitRows(
  input: BuildChecklistCoverageRowsInput,
): ChecklistStoreVisitRow[] {
  return buildChecklistStoreVisitRows(buildChecklistCoverageRows(input))
}

function getCoverageCompletedSource(input: {
  acknowledgementItems: ChecklistAcknowledgementItem[]
  checklistTemplateId: string
  mobileToday: MobileChecklistToday | undefined
  month: string
  storeId: string
}) {
  const completedByInstance = new Map<string, string>()
  const addCompletedSource = (source: {
    checklistInstanceId: string
    checklistTemplateId: string
    completedAt: string | null
    storeId: string
  }) => {
    if (
      source.storeId !== input.storeId ||
      source.checklistTemplateId !== input.checklistTemplateId ||
      !source.completedAt
    ) {
      return
    }
    if (input.month !== 'all' && getMonthKey(source.completedAt) !== input.month) return

    const current = completedByInstance.get(source.checklistInstanceId)
    if (!current || compareDate(source.completedAt, current) > 0) {
      completedByInstance.set(source.checklistInstanceId, source.completedAt)
    }
  }

  for (const item of input.mobileToday?.completedThisMonth ?? []) {
    addCompletedSource(item)
  }
  for (const item of input.mobileToday?.pendingAcknowledgements ?? []) {
    addCompletedSource(item)
  }
  for (const item of input.acknowledgementItems) {
    addCompletedSource(item)
  }

  const completedDates = [...completedByInstance.values()]
  return {
    completedAt: completedDates.toSorted((left, right) => compareDate(right, left))[0] ?? null,
    completedCount: completedByInstance.size,
  }
}
