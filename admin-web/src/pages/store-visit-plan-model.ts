import type { AuthSessionSummary } from '../features/auth/api'
import type { ChecklistAcknowledgementItem } from '../features/checklists/api'
import type {
  ChecklistCoverageRow,
  ChecklistStatusFilter,
  ChecklistStoreVisitRow,
} from './store-checklists-model'
import {
  canMutateChecklistTemplateType,
  compareDate,
  compareText,
  getCoverageScore,
  getLowScoreResponses,
  getStoreVisitDate,
} from './store-checklists-logic'

export type VisitRiskLevel = 'high' | 'medium' | 'low'

export type VisitPlanReasonCode =
  | 'missing_current_month_visit'
  | 'low_checklist_score'
  | 'watch_checklist_result'
  | 'active_draft'
  | 'pending_acknowledgement'
  | 'visit_completed'
  | 'strong_score'
  | 'insufficient_signal'

export type VisitPlanReason = {
  code: VisitPlanReasonCode
  label: string
  severity: VisitRiskLevel
}

export type VisitPlanRow = {
  actionTab: 'visits'
  bmScore: number | null
  lastVisitAt: string | null
  primaryReason: VisitPlanReason
  reasons: VisitPlanReason[]
  riskLevel: VisitRiskLevel
  riskScore: number
  storeId: string
  storeName: string
  vmScore: number | null
}

export type BuildVisitPlanInput = {
  acknowledgementItems: ChecklistAcknowledgementItem[]
  authSummary: AuthSessionSummary | null
  currentMonth: string
  evaluationMonth: string
  requiresCombinedVisitTemplates: boolean
  rows: ChecklistStoreVisitRow[]
  selectedMonth: string
}

const reasonCatalog: Record<VisitPlanReasonCode, { label: string; severity: VisitRiskLevel }> = {
  missing_current_month_visit: { label: 'Bu ay ziyaret yok', severity: 'high' },
  low_checklist_score: { label: 'Düşük checklist puanı', severity: 'high' },
  watch_checklist_result: { label: 'Takipte checklist sonucu', severity: 'medium' },
  active_draft: { label: 'Aktif taslak var', severity: 'medium' },
  pending_acknowledgement: { label: 'Mağaza kabulü bekliyor', severity: 'medium' },
  visit_completed: { label: 'Ziyaret tamam', severity: 'low' },
  strong_score: { label: 'Skor güçlü', severity: 'low' },
  insufficient_signal: { label: 'Sinyal yetersiz', severity: 'medium' },
}

const riskRank: Record<VisitRiskLevel, number> = {
  high: 3,
  medium: 2,
  low: 1,
}

const reasonScore: Record<VisitPlanReasonCode, number> = {
  missing_current_month_visit: 80,
  low_checklist_score: 70,
  pending_acknowledgement: 45,
  active_draft: 40,
  watch_checklist_result: 35,
  insufficient_signal: 30,
  strong_score: 15,
  visit_completed: 10,
}

export function buildVisitPlanRows(input: BuildVisitPlanInput): VisitPlanRow[] {
  const rows = input.rows.map((row) => {
    const reasons = sortVisitPlanReasons(buildVisitPlanReasons(row, input))
    const safeReasons = reasons.length > 0 ? reasons : [createVisitPlanReason('insufficient_signal')]
    const riskLevel = getVisitPlanRiskLevel(safeReasons)

    return {
      actionTab: 'visits' as const,
      bmScore: row.bm ? getVisitPlanCoverageScore(row.bm, input) : null,
      lastVisitAt: getVisitPlanLastVisitAt(row, input),
      primaryReason: safeReasons[0] ?? createVisitPlanReason('insufficient_signal'),
      reasons: safeReasons,
      riskLevel,
      riskScore: calculateVisitRiskScore(safeReasons, row, input),
      storeId: row.store.storeId,
      storeName: row.store.storeName,
      vmScore: row.vm ? getVisitPlanCoverageScore(row.vm, input) : null,
    }
  })

  return sortVisitPlanRows(rows)
}

export function getVisitPlanRiskLevel(reasons: VisitPlanReason[]): VisitRiskLevel {
  if (reasons.some((reason) => reason.severity === 'high')) return 'high'
  if (reasons.some((reason) => reason.severity === 'medium')) return 'medium'
  return 'low'
}

export function sortVisitPlanRows(rows: VisitPlanRow[]): VisitPlanRow[] {
  return rows.toSorted((left, right) => {
    const riskCompared = riskRank[right.riskLevel] - riskRank[left.riskLevel]
    if (riskCompared !== 0) return riskCompared

    const scoreCompared = right.riskScore - left.riskScore
    if (scoreCompared !== 0) return scoreCompared

    const dateCompared = compareDate(left.lastVisitAt, right.lastVisitAt)
    if (dateCompared !== 0) return dateCompared

    return compareText(left.storeName, right.storeName, 'tr')
  })
}

export function doesVisitPlanRowMatchStatusFilter(
  row: VisitPlanRow,
  statusFilter: ChecklistStatusFilter,
) {
  if (statusFilter === 'all') return true
  if (statusFilter === 'missing') return hasVisitPlanReason(row, 'missing_current_month_visit')
  if (statusFilter === 'draft') return hasVisitPlanReason(row, 'active_draft')
  if (statusFilter === 'completed') return hasVisitPlanReason(row, 'visit_completed')
  if (statusFilter === 'pending') return hasVisitPlanReason(row, 'pending_acknowledgement')
  return false
}

export function resolveVisitPlanEvaluationMonth(selectedMonth: string, currentMonth: string) {
  return selectedMonth === 'all' ? currentMonth : selectedMonth
}

export function getVisitPlanCurrentMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function buildVisitPlanReasons(
  row: ChecklistStoreVisitRow,
  input: BuildVisitPlanInput,
): VisitPlanReason[] {
  const visibleRows = [row.bm, row.vm].filter(
    (item): item is ChecklistCoverageRow => Boolean(item),
  )
  const actorActionableRows = visibleRows.filter((item) =>
    canMutateChecklistTemplateType(input.authSummary, item.template.templateType),
  )
  const reasons: VisitPlanReason[] = []

  if (actorActionableRows.some((item) => getVisitPlanCompletedCount(item, input) === 0)) {
    reasons.push(createVisitPlanReason('missing_current_month_visit'))
  }

  if (visibleRows.some((item) => item.active)) {
    reasons.push(createVisitPlanReason('active_draft'))
  }

  const visibleScores = visibleRows
    .map((item) => getVisitPlanCoverageScore(item, input))
    .filter((score): score is number => score !== null && Number.isFinite(score))

  if (visibleScores.some((score) => score < 70)) {
    reasons.push(createVisitPlanReason('low_checklist_score'))
  } else if (visibleScores.some((score) => score >= 70 && score <= 84)) {
    reasons.push(createVisitPlanReason('watch_checklist_result'))
  }

  const pendingAcknowledgements = getPendingAcknowledgementsForRow(row, visibleRows, input)
  if (pendingAcknowledgements.some((item) => getLowScoreResponses(item.responses).length > 0)) {
    reasons.push(createVisitPlanReason('low_checklist_score'))
    reasons.push(createVisitPlanReason('pending_acknowledgement'))
  } else if (pendingAcknowledgements.length > 0) {
    reasons.push(createVisitPlanReason('pending_acknowledgement'))
  }

  if (
    actorActionableRows.some(
      (item) => getVisitPlanCompletedCount(item, input) > 0 && getVisitPlanCoverageScore(item, input) === null,
    )
  ) {
    reasons.push(createVisitPlanReason('insufficient_signal'))
  }

  const actorCoverageExists =
    actorActionableRows.length > 0 &&
    actorActionableRows.every((item) => getVisitPlanCompletedCount(item, input) > 0)
  const hasVisibleStrongScore =
    visibleScores.length > 0 && visibleScores.every((score) => score >= 85)
  const hasBlockingRisk = reasons.some((reason) => reason.severity !== 'low')

  if (actorCoverageExists) {
    reasons.push(createVisitPlanReason('visit_completed'))
  }
  if (actorCoverageExists && hasVisibleStrongScore && !hasBlockingRisk) {
    reasons.push(createVisitPlanReason('strong_score'))
  }

  return dedupeVisitPlanReasons(reasons)
}

function getVisitPlanCoverageScore(row: ChecklistCoverageRow, input: BuildVisitPlanInput) {
  const summaryScore = getCoverageScore(row)
  if (summaryScore !== null) return summaryScore

  const evaluationMonth = input.evaluationMonth || resolveVisitPlanEvaluationMonth(
    input.selectedMonth,
    input.currentMonth,
  )
  const scores = input.acknowledgementItems
    .filter((item) => {
      if (!doesAcknowledgementItemMatchCoverageRow(item, row, input)) return false
      if (!item.completedAt) return false
      if (!item.completedAt.startsWith(evaluationMonth)) return false
      return true
    })
    .map((item) =>
      item.totalScore ?? (typeof item.complianceRate === 'number' ? Math.round(item.complianceRate * 100) : null),
    )
    .filter((score): score is number => score !== null && Number.isFinite(score))

  if (scores.length === 0) return null
  return Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10
}

function doesAcknowledgementItemMatchCoverageRow(
  item: ChecklistAcknowledgementItem,
  row: ChecklistCoverageRow,
  input: BuildVisitPlanInput,
) {
  if (item.storeId !== row.store.storeId) return false
  if (item.checklistTemplateId === row.template.checklistTemplateId) return true
  if (!shouldUseHistoricalTemplateTypeFallback(input)) return false
  return item.templateType === row.template.templateType
}

function getVisitPlanCompletedCount(row: ChecklistCoverageRow, input: BuildVisitPlanInput) {
  if (row.completedCount > 0) return row.completedCount
  if (!shouldUseHistoricalTemplateTypeFallback(input)) return 0

  return new Set(
    input.acknowledgementItems
      .filter((item) => {
        if (!doesAcknowledgementItemMatchCoverageRow(item, row, input)) return false
        if (!item.completedAt) return false
        return item.completedAt.startsWith(getVisitPlanEvaluationMonth(input))
      })
      .map((item) => item.checklistInstanceId),
  ).size
}

function getVisitPlanLastVisitAt(row: ChecklistStoreVisitRow, input: BuildVisitPlanInput) {
  const visibleRows = [row.bm, row.vm].filter(
    (item): item is ChecklistCoverageRow => Boolean(item),
  )
  const dates = visibleRows
    .flatMap((coverageRow) => [
      coverageRow.completedAt,
      ...input.acknowledgementItems
        .filter((item) => {
          if (!doesAcknowledgementItemMatchCoverageRow(item, coverageRow, input)) return false
          if (!item.completedAt) return false
          return item.completedAt.startsWith(getVisitPlanEvaluationMonth(input))
        })
        .map((item) => item.completedAt),
    ])
    .filter((date): date is string => Boolean(date))

  return dates.toSorted((left, right) => compareDate(right, left))[0] ?? getStoreVisitDate(row)
}

function getPendingAcknowledgementsForRow(
  row: ChecklistStoreVisitRow,
  visibleRows: ChecklistCoverageRow[],
  input: BuildVisitPlanInput,
) {
  const evaluationMonth = input.evaluationMonth || resolveVisitPlanEvaluationMonth(
    input.selectedMonth,
    input.currentMonth,
  )

  return input.acknowledgementItems.filter((item) => {
    if (item.storeId !== row.store.storeId) return false
    if (item.acknowledgement !== null) return false
    if (!visibleRows.some((visibleRow) => doesAcknowledgementItemMatchCoverageRow(item, visibleRow, input))) {
      return false
    }
    if (input.selectedMonth !== 'all' && item.completedAt) {
      return item.completedAt.startsWith(evaluationMonth)
    }
    return true
  })
}

function shouldUseHistoricalTemplateTypeFallback(input: BuildVisitPlanInput) {
  return input.selectedMonth !== 'all' && getVisitPlanEvaluationMonth(input) !== input.currentMonth
}

function getVisitPlanEvaluationMonth(input: BuildVisitPlanInput) {
  return input.evaluationMonth || resolveVisitPlanEvaluationMonth(
    input.selectedMonth,
    input.currentMonth,
  )
}

function calculateVisitRiskScore(
  reasons: VisitPlanReason[],
  row: ChecklistStoreVisitRow,
  input: BuildVisitPlanInput,
) {
  const base = riskRank[getVisitPlanRiskLevel(reasons)] * 100
  const reasonTotal = reasons.reduce((sum, reason) => sum + reasonScore[reason.code], 0)
  const missingActionableRows = [row.bm, row.vm].filter(
    (item): item is ChecklistCoverageRow => {
      if (!item) return false
      return (
        canMutateChecklistTemplateType(input.authSummary, item.template.templateType) &&
        getVisitPlanCompletedCount(item, input) === 0
      )
    },
  ).length

  return base + reasonTotal + missingActionableRows * 5 + (input.requiresCombinedVisitTemplates ? 1 : 0)
}

function createVisitPlanReason(code: VisitPlanReasonCode): VisitPlanReason {
  return {
    code,
    label: reasonCatalog[code].label,
    severity: reasonCatalog[code].severity,
  }
}

function hasVisitPlanReason(row: VisitPlanRow, code: VisitPlanReasonCode) {
  return row.reasons.some((reason) => reason.code === code)
}

function sortVisitPlanReasons(reasons: VisitPlanReason[]) {
  return reasons.toSorted((left, right) => {
    const severityCompared = riskRank[right.severity] - riskRank[left.severity]
    if (severityCompared !== 0) return severityCompared
    return reasonScore[right.code] - reasonScore[left.code]
  })
}

function dedupeVisitPlanReasons(reasons: VisitPlanReason[]) {
  const seen = new Set<VisitPlanReasonCode>()
  return reasons.filter((reason) => {
    if (seen.has(reason.code)) return false
    seen.add(reason.code)
    return true
  })
}
