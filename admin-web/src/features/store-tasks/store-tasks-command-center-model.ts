import type { AppLocale } from '../../lib/i18n'
import { normalizeDisplayLabel } from '../../lib/display-labels'
import type { StoreActionPlan, StoreActionPlanPriority, StoreActionPlanStatus } from '../store-actions/api'
import type { ReadOnlyStoreActionCandidate } from '../store-actions/candidates'
import type { WorkflowInboxItem } from '../workflow/contracts'

export const ACTIVE_STORE_ACTION_PLAN_STATUSES = ['open', 'in_progress', 'blocked'] as const satisfies readonly StoreActionPlanStatus[]
export const RESULT_STORE_ACTION_PLAN_STATUSES = ['closed', 'cancelled'] as const satisfies readonly StoreActionPlanStatus[]

export type StoreTasksPersona = 'storeManager' | 'regionManager' | 'readOnly'
export type StoreTasksRegionMode = 'results' | 'openFollowups'
export type StoreTaskSourceGroup = 'checklist' | 'projection'
export type StoreTaskUiStatus = 'open' | 'in_progress' | 'blocked' | 'resolved' | 'cancelled'
export type StoreTaskFilter =
  | 'all'
  | StoreTaskUiStatus
  | StoreTaskSourceGroup

export type StoreTaskCommandRow = {
  id: string
  source: 'plan' | 'workflow'
  sourceGroup: StoreTaskSourceGroup
  uiStatus: StoreTaskUiStatus
  title: string
  summary: string
  storeId: string
  storeName: string
  ownerLabel: string
  sourceLabel: string
  priority: StoreActionPlanPriority | WorkflowInboxItem['urgency']
  priorityLabel: string
  assignedAt: string | null
  assignedAtLabel: string
  dueLabel: string
  completionAt: string | null
  completionAtLabel: string
  durationLabel: string
  sourcePeriod: string | null
  sourcePeriodLabel: string
  isCarriedOver: boolean
  nextStep: string
  historyPreview: string | null
  plan?: StoreActionPlan
  workflowItem?: WorkflowInboxItem
  candidate?: ReadOnlyStoreActionCandidate
}

export type StoreTasksCommandSummary = {
  visible: number
  actionable: number
  carriedOver: number
  inProgress: number
  closed: number
  reported: number
}

export function getCurrentMonthKey(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function formatPeriodLabel(periodKey: string, locale: AppLocale) {
  const date = parsePeriodKey(periodKey)
  if (!date) return 'Guncel donem'
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date)
}

export function shiftPeriod(periodKey: string, monthDelta: number) {
  const date = parsePeriodKey(periodKey) ?? new Date()
  date.setMonth(date.getMonth() + monthDelta)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function mapPlanSourceGroup(plan: StoreActionPlan): StoreTaskSourceGroup {
  return plan.sourceType === 'checklist_remediation' ? 'checklist' : 'projection'
}

export function mapWorkflowSourceGroup(item: WorkflowInboxItem): StoreTaskSourceGroup | null {
  if (item.sourceType === 'checklist_receipt' || item.sourceType === 'store_action_plan') return 'checklist'
  if (item.sourceType === 'kpi_exception') return 'projection'
  return null
}

export function isActiveStoreActionStatus(status: StoreActionPlanStatus) {
  return (ACTIVE_STORE_ACTION_PLAN_STATUSES as readonly StoreActionPlanStatus[]).includes(status)
}

export function getWorkflowSourceKey(storeId: string, sourceType: WorkflowInboxItem['sourceType'], sourceId: string) {
  return `${storeId}:${sourceType}:${sourceId}`
}

export function getPlanSourceKey(storeId: string, sourceType: StoreActionPlan['sourceType'], sourceId: string) {
  return `${storeId}:${sourceType}:${sourceId}`
}

export function mergeActionPlans(
  primaryPlans: readonly StoreActionPlan[],
  supplementalPlans: readonly StoreActionPlan[],
) {
  const plansById = new Map<string, StoreActionPlan>()
  for (const plan of primaryPlans) plansById.set(plan.actionPlanId, plan)
  for (const plan of supplementalPlans) {
    if (!plansById.has(plan.actionPlanId)) plansById.set(plan.actionPlanId, plan)
  }
  return [...plansById.values()]
}

export function buildStoreTaskCommandRows(input: {
  plans: readonly StoreActionPlan[]
  workflowItems: readonly WorkflowInboxItem[]
  actionCandidatesBySource: Map<string, ReadOnlyStoreActionCandidate>
  selectedPeriod: string
  locale: AppLocale
}): StoreTaskCommandRow[] {
  const workflowPlanRowsById = new Map(
    input.workflowItems
      .filter((item) => item.sourceType === 'store_action_plan')
      .map((item) => [item.sourceId, item]),
  )
  const workflowStoreNamesByStoreId = new Map<string, string>()
  for (const item of input.workflowItems) {
    const storeName = item.storeName?.trim()
    if (storeName && !workflowStoreNamesByStoreId.has(item.storeId)) {
      workflowStoreNamesByStoreId.set(item.storeId, storeName)
    }
  }
  const persistedPlanIds = new Set(input.plans.map((plan) => plan.actionPlanId))
  const persistedPlanSourceKeys = new Set(
    input.plans.map((plan) => getPlanSourceKey(plan.storeId, plan.sourceType, plan.sourceId)),
  )

  const planRows = input.plans
    .map((plan): StoreTaskCommandRow => {
      const workflowPlanRow = workflowPlanRowsById.get(plan.actionPlanId)
      const workflowStoreName = workflowPlanRow?.storeName ?? workflowStoreNamesByStoreId.get(plan.storeId)
      const storeName = normalizeDisplayLabel(workflowStoreName ?? plan.storeName, 'Mağaza adı yok')
      const assignedAt = plan.createdAt
      const completionAt = plan.closedAt ?? plan.cancelledAt
      const sourcePeriod = getMonthKeyFromDate(assignedAt)
      const isCarriedOver =
        isActiveStoreActionStatus(plan.status) &&
        sourcePeriod !== null &&
        sourcePeriod < input.selectedPeriod

      return {
        id: `plan:${plan.actionPlanId}`,
        source: 'plan',
        sourceGroup: mapPlanSourceGroup(plan),
        uiStatus: mapPlanUiStatus(plan.status),
        title: plan.title,
        summary: plan.summary?.trim() || 'Özet bulunamadı',
        storeId: plan.storeId,
        storeName,
        ownerLabel: normalizeDisplayLabel(plan.ownerDisplayName, 'Sorumlu yok'),
        sourceLabel: formatSourceGroupLabel(mapPlanSourceGroup(plan)),
        priority: plan.priority,
        priorityLabel: formatPriorityLabel(plan.priority),
        assignedAt,
        assignedAtLabel: formatDateLabel(assignedAt, input.locale),
        dueLabel: formatDateLabel(plan.dueOn, input.locale),
        completionAt,
        completionAtLabel: completionAt ? formatDateLabel(completionAt, input.locale) : 'Bekliyor',
        durationLabel: formatDurationLabel(assignedAt, completionAt, plan.status),
        sourcePeriod,
        sourcePeriodLabel: sourcePeriod ? formatPeriodLabel(sourcePeriod, input.locale) : 'Dönem yok',
        isCarriedOver,
        nextStep: buildPlanNextStep(plan.status),
        historyPreview: plan.resolutionNote ?? plan.cancelReason ?? workflowPlanRow?.historyPreview ?? null,
        plan,
      }
    })
    .filter((row) => isVisibleInSelectedPeriod(row, input.selectedPeriod))

  const workflowRows = input.workflowItems
    .filter((item) => {
      const sourceGroup = mapWorkflowSourceGroup(item)
      if (!sourceGroup) return false
      if (item.sourceType === 'store_action_plan') {
        return !persistedPlanIds.has(item.sourceId)
      }
      return !persistedPlanSourceKeys.has(getWorkflowSourceKey(item.storeId, item.sourceType, item.sourceId))
    })
    .map((item): StoreTaskCommandRow | null => {
      const sourceGroup = mapWorkflowSourceGroup(item)
      if (!sourceGroup) return null
      const assignedAt = item.needsAttentionAt ?? item.createdAt ?? null
      const sourcePeriod = getMonthKeyFromDate(assignedAt)
      const uiStatus = mapWorkflowUiStatus(item)
      const candidate = input.actionCandidatesBySource.get(
        getWorkflowSourceKey(item.storeId, item.sourceType, item.sourceId),
      )
      const row: StoreTaskCommandRow = {
        id: `workflow:${item.sourceType}:${item.sourceId}`,
        source: 'workflow',
        sourceGroup,
        uiStatus,
        title: item.title,
        summary: item.summary,
        storeId: item.storeId,
        storeName: normalizeDisplayLabel(item.storeName, 'Mağaza adı yok'),
        ownerLabel: formatActorRoleLabel(item.actorRole),
        sourceLabel: formatSourceGroupLabel(sourceGroup),
        priority: item.urgency,
        priorityLabel: formatPriorityLabel(item.urgency),
        assignedAt,
        assignedAtLabel: formatDateLabel(assignedAt, input.locale),
        dueLabel: item.needsAttentionAt ? formatDateLabel(item.needsAttentionAt, input.locale) : 'Plan yok',
        completionAt: item.inboxStatus === 'completed' ? item.needsAttentionAt ?? item.createdAt ?? null : null,
        completionAtLabel: item.inboxStatus === 'completed' ? formatDateLabel(item.needsAttentionAt ?? item.createdAt, input.locale) : 'Bekliyor',
        durationLabel: formatDurationLabel(assignedAt, item.inboxStatus === 'completed' ? item.needsAttentionAt ?? item.createdAt ?? null : null, uiStatus),
        sourcePeriod,
        sourcePeriodLabel: sourcePeriod ? formatPeriodLabel(sourcePeriod, input.locale) : 'Dönem yok',
        isCarriedOver:
          (uiStatus === 'open' || uiStatus === 'in_progress' || uiStatus === 'blocked') &&
          sourcePeriod !== null &&
          sourcePeriod < input.selectedPeriod,
        nextStep: item.sourceType === 'kpi_exception'
          ? 'Mağaza aksiyon planını netleştirir.'
          : 'Kaynak kaydı incelenir.',
        historyPreview: item.historyPreview ?? null,
        workflowItem: item,
        ...(candidate ? { candidate } : {}),
      }
      return isVisibleInSelectedPeriod(row, input.selectedPeriod) ? row : null
    })
    .filter((row): row is StoreTaskCommandRow => row !== null)

  return [...planRows, ...workflowRows]
}

export function filterStoreTaskRows(input: {
  rows: readonly StoreTaskCommandRow[]
  persona: StoreTasksPersona
  regionMode: StoreTasksRegionMode
  activeFilter: StoreTaskFilter
  search: string
}) {
  const search = input.search.trim().toLocaleLowerCase('tr-TR')
  return input.rows
    .filter((row) => {
      if (input.persona === 'regionManager') {
        if (input.regionMode === 'results' && !isResultRow(row)) return false
        if (input.regionMode === 'openFollowups' && isResultRow(row)) return false
      }

      if (
        input.activeFilter !== 'all' &&
        row.uiStatus !== input.activeFilter &&
        row.sourceGroup !== input.activeFilter
      ) {
        return false
      }

      if (!search) return true
      return `${row.title} ${row.summary} ${row.storeName} ${row.ownerLabel} ${row.sourceLabel}`
        .toLocaleLowerCase('tr-TR')
        .includes(search)
    })
    .toSorted(compareStoreTaskRows)
}

export function buildStoreTasksSummary(rows: readonly StoreTaskCommandRow[]): StoreTasksCommandSummary {
  return {
    visible: rows.length,
    actionable: rows.filter((row) => row.uiStatus === 'open' || row.uiStatus === 'in_progress' || row.uiStatus === 'blocked').length,
    carriedOver: rows.filter((row) => row.isCarriedOver).length,
    inProgress: rows.filter((row) => row.uiStatus === 'in_progress').length,
    closed: rows.filter((row) => row.uiStatus === 'resolved' || row.uiStatus === 'cancelled').length,
    reported: rows.filter((row) => row.uiStatus === 'resolved').length,
  }
}

export function formatSourceGroupLabel(sourceGroup: StoreTaskSourceGroup) {
  return sourceGroup === 'checklist' ? 'Checklist' : 'Projeksiyon'
}

export function formatUiStatusLabel(status: StoreTaskUiStatus) {
  switch (status) {
    case 'open':
      return 'Açık'
    case 'in_progress':
      return 'İşlemde'
    case 'blocked':
      return 'Bloke'
    case 'resolved':
      return 'Çözüm bildirildi'
    case 'cancelled':
      return 'İptal edildi'
    default:
      return status
  }
}

function mapPlanUiStatus(status: StoreActionPlanStatus): StoreTaskUiStatus {
  switch (status) {
    case 'closed':
      return 'resolved'
    case 'cancelled':
      return 'cancelled'
    default:
      return status
  }
}

function mapWorkflowUiStatus(item: WorkflowInboxItem): StoreTaskUiStatus {
  if (item.inboxStatus === 'completed' || item.inboxStatus === 'informational') return 'resolved'
  return item.urgency === 'high' ? 'open' : 'in_progress'
}

function isResultRow(row: StoreTaskCommandRow) {
  return row.uiStatus === 'resolved' || row.uiStatus === 'cancelled'
}

function isVisibleInSelectedPeriod(row: StoreTaskCommandRow, selectedPeriod: string) {
  if (row.sourcePeriod === selectedPeriod) return true
  const completionPeriod = getMonthKeyFromDate(row.completionAt)
  if (completionPeriod === selectedPeriod) return true
  return row.isCarriedOver
}

function compareStoreTaskRows(left: StoreTaskCommandRow, right: StoreTaskCommandRow) {
  const statusDelta = statusRank(left.uiStatus) - statusRank(right.uiStatus)
  if (statusDelta !== 0) return statusDelta
  const carryDelta = Number(right.isCarriedOver) - Number(left.isCarriedOver)
  if (carryDelta !== 0) return carryDelta
  const priorityDelta = priorityRank(left.priority) - priorityRank(right.priority)
  if (priorityDelta !== 0) return priorityDelta
  return getDateTime(right.assignedAt) - getDateTime(left.assignedAt)
}

function statusRank(status: StoreTaskUiStatus) {
  switch (status) {
    case 'blocked':
      return 0
    case 'open':
      return 1
    case 'in_progress':
      return 2
    case 'resolved':
      return 3
    case 'cancelled':
      return 4
    default:
      return 5
  }
}

function priorityRank(priority: StoreActionPlanPriority | WorkflowInboxItem['urgency']) {
  switch (priority) {
    case 'high':
      return 0
    case 'medium':
      return 1
    case 'low':
      return 2
    default:
      return 3
  }
}

function formatPriorityLabel(priority: StoreActionPlanPriority | WorkflowInboxItem['urgency']) {
  switch (priority) {
    case 'high':
      return 'Yüksek'
    case 'medium':
      return 'Orta'
    case 'low':
      return 'Düşük'
    default:
      return 'Normal'
  }
}

function formatActorRoleLabel(role: string | null | undefined) {
  switch (role) {
    case 'STORE_MANAGER':
      return 'Mağaza müdürü'
    case 'REGION_MANAGER':
      return 'Bölge müdürü'
    case 'SUPER_ADMIN':
      return 'Admin'
    default:
      return normalizeDisplayLabel(role, 'Sorumlu yok')
  }
}

function buildPlanNextStep(status: StoreActionPlanStatus) {
  switch (status) {
    case 'open':
      return 'Mağaza müdürü işi ele alır.'
    case 'in_progress':
      return 'Aksiyon devam ediyor; son durum notu beklenir.'
    case 'blocked':
      return 'Bloke nedeni netleştirilir.'
    case 'closed':
      return 'Bölge müdürü sonucu okur.'
    case 'cancelled':
      return 'Kayıt iptal geçmişinde tutulur.'
    default:
      return 'Sonraki adım bekleniyor.'
  }
}

function formatDurationLabel(start: string | null, end: string | null, status: StoreActionPlanStatus | StoreTaskUiStatus) {
  if (!start) return 'Süre yok'
  const days = Math.max(0, Math.ceil((getDateTime(end ?? new Date().toISOString()) - getDateTime(start)) / 86_400_000))
  const suffix = status === 'closed' || status === 'resolved' || status === 'cancelled' ? 'sürdü' : 'açık'
  return days === 0 ? `Bugün ${suffix}` : `${days} gün ${suffix}`
}

function formatDateLabel(input: string | null | undefined, locale: AppLocale) {
  if (!input) return 'Yok'
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(input) ? `${input}T12:00:00.000Z` : input
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return 'Yok'
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(date)
}

function getMonthKeyFromDate(input: string | null | undefined) {
  if (!input) return null
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(input) ? `${input}T12:00:00.000Z` : input
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return null
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function parsePeriodKey(periodKey: string) {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(periodKey)
  if (!match) return null
  return new Date(Number(match[1]), Number(match[2]) - 1, 1)
}

function getDateTime(input: string | null | undefined) {
  if (!input) return 0
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(input) ? `${input}T12:00:00.000Z` : input
  const time = new Date(normalized).getTime()
  return Number.isNaN(time) ? 0 : time
}
