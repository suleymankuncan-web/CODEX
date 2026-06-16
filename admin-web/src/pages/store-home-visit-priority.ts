import type { AuthSessionSummary } from '../features/auth/api'
import type { ChecklistAcknowledgementItem, MobileChecklistToday } from '../features/checklists/api'
import type { TranslateFunction } from '../features/localization/dictionary'
import type { StorePersona } from '../app/store-navigation'
import type { StoreSurfaceTone } from './store-surface-primitives'
import { buildChecklistVisitRows } from './store-checklists-coverage-model'
import {
  buildVisitPlanRows,
  getVisitPlanCurrentMonthKey,
  type VisitPlanRow,
} from './store-visit-plan-model'

export type VisitPriorityHomeSummary = {
  actionLabel: string
  copy: string
  highRiskCount: number
  title: string
  topStores: VisitPlanRow[]
  tone: StoreSurfaceTone
  value: string
}

export function buildVisitPriorityHomeSummary(input: {
  acknowledgementItems: ChecklistAcknowledgementItem[]
  authSummary: AuthSessionSummary | null
  isUnavailable: boolean
  isLoading: boolean
  mobileToday: MobileChecklistToday | null
  pendingValue: string
  persona: StorePersona
  t: TranslateFunction
}): VisitPriorityHomeSummary | null {
  if (input.persona !== 'regionManager') return null

  if (input.isLoading) {
    return {
      actionLabel: input.t('storeHome.visitPriority.action'),
      copy: input.t('storeHome.visitPriority.loadingCopy'),
      highRiskCount: 0,
      title: input.t('storeHome.visitPriority.title'),
      topStores: [],
      tone: 'neutral',
      value: input.pendingValue,
    }
  }

  if (input.isUnavailable) {
    return {
      actionLabel: input.t('storeHome.visitPriority.action'),
      copy: input.t('storeHome.visitPriority.unavailableCopy'),
      highRiskCount: 0,
      title: input.t('storeHome.visitPriority.title'),
      topStores: [],
      tone: 'warning',
      value: input.pendingValue,
    }
  }

  const currentMonth = getVisitPlanCurrentMonthKey()
  const visitRows = buildChecklistVisitRows({
    acknowledgementItems: input.acknowledgementItems,
    localActiveInstances: {},
    localCompletedRows: {},
    mobileToday: input.mobileToday ?? undefined,
    month: currentMonth,
  })
  const planRows = buildVisitPlanRows({
    acknowledgementItems: input.acknowledgementItems,
    authSummary: input.authSummary,
    currentMonth,
    evaluationMonth: currentMonth,
    requiresCombinedVisitTemplates: false,
    rows: visitRows,
    selectedMonth: currentMonth,
  })
  const highRiskCount = planRows.filter((row) => row.riskLevel === 'high').length

  return {
    actionLabel: input.t('storeHome.visitPriority.action'),
    copy: input.t(
      highRiskCount > 0
        ? 'storeHome.visitPriority.copy'
        : 'storeHome.visitPriority.emptyCopy',
      { count: String(highRiskCount) },
    ),
    highRiskCount,
    title: input.t('storeHome.visitPriority.title'),
    topStores: planRows.slice(0, 3),
    tone: highRiskCount > 0 ? 'warning' : 'calm',
    value: String(highRiskCount),
  }
}
