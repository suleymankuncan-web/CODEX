import type { ChecklistAcknowledgementItem, MobileChecklistToday } from '../features/checklists/api'
import type {
  ChecklistActiveInstance,
  ChecklistCompletedInstance,
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
  localCompletedInstances: Record<string, ChecklistCompletedInstance>
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
      const localActive = input.localActiveInstances[rowKey]
      const isLocallyCompleted = (instance: ChecklistActiveInstance | undefined) =>
        Boolean(instance && input.localCompletedInstances[instance.checklistInstanceId])
      const active = mergeChecklistActiveInstanceOverlay(
        isLocallyCompleted(queryActive) ? undefined : queryActive,
        isLocallyCompleted(localActive) ? undefined : localActive,
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
        localCompletedInstances: input.localCompletedInstances,
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
        completedScore: completedSource.score,
        localCompletedScore: completedSource.localScore,
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
  localCompletedInstances: Record<string, ChecklistCompletedInstance>
  mobileToday: MobileChecklistToday | undefined
  month: string
  storeId: string
}) {
  const completedByInstance = new Map<string, { completedAt: string; score: number | null }>()
  const localCompletedScores: number[] = []
  const addCompletedSource = (
    source: {
      checklistInstanceId: string
      checklistTemplateId: string
      completedAt: string | null
      complianceRate?: number | null
      storeId: string
      totalScore?: number | null
    },
    options: { local?: boolean } = {},
  ) => {
    if (
      source.storeId !== input.storeId ||
      source.checklistTemplateId !== input.checklistTemplateId ||
      !source.completedAt
    ) {
      return
    }
    if (input.month !== 'all' && getMonthKey(source.completedAt) !== input.month) return

    const current = completedByInstance.get(source.checklistInstanceId)
    const score =
      typeof source.totalScore === 'number'
        ? source.totalScore
        : typeof source.complianceRate === 'number'
          ? Math.round(source.complianceRate * 100)
          : null
    if (options.local && typeof score === 'number' && Number.isFinite(score)) {
      localCompletedScores.push(score)
    }
    if (!current || compareDate(source.completedAt, current.completedAt) > 0) {
      completedByInstance.set(source.checklistInstanceId, {
        completedAt: source.completedAt,
        score,
      })
    }
  }

  for (const item of input.mobileToday?.completedThisMonth ?? []) {
    addCompletedSource(item)
  }
  for (const item of input.mobileToday?.pendingAcknowledgements ?? []) {
    addCompletedSource(item)
  }
  for (const item of Object.values(input.localCompletedInstances)) {
    addCompletedSource(item, { local: true })
  }
  for (const item of input.acknowledgementItems) {
    addCompletedSource(item)
  }

  const completedRows = [...completedByInstance.values()]
  const completedScores = completedRows
    .map((item) => item.score)
    .filter((score): score is number => typeof score === 'number' && Number.isFinite(score))
  return {
    completedAt:
      completedRows
        .map((item) => item.completedAt)
        .toSorted((left, right) => compareDate(right, left))[0] ?? null,
    completedCount: completedByInstance.size,
    score:
      completedScores.length > 0
        ? Math.round((completedScores.reduce((sum, score) => sum + score, 0) / completedScores.length) * 100) / 100
        : null,
    localScore:
      localCompletedScores.length > 0
        ? Math.round((localCompletedScores.reduce((sum, score) => sum + score, 0) / localCompletedScores.length) * 100) / 100
        : null,
  }
}
