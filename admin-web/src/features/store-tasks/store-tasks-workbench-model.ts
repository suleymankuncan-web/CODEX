import { getDisplayRoleCodes } from '../auth/display'
import type { TranslateFunction, TranslationKey } from '../localization/dictionary'
import type {
  StoreActionPlan,
  StoreActionPlanPriority,
  StoreActionPlanStatus,
} from '../store-actions/api'
import type { ReadOnlyStoreActionCandidate } from '../store-actions/candidates'
import type { WorkflowInboxItem } from '../workflow/contracts'
import { formatDate, formatDateTime, formatState } from '../../lib/format'
import type { AppLocale } from '../../lib/i18n'
import type { StoreSurfaceTone } from '../../pages/store-surface-primitives'

const actorRoleTranslationKeys: Partial<Record<string, TranslationKey>> = {
  REGION_APPROVER: 'storeTasks.role.REGION_APPROVER',
  REGION_MANAGER: 'storeTasks.role.REGION_MANAGER',
  REPORT_VIEWER: 'storeTasks.role.REPORT_VIEWER',
  STORE_MANAGER: 'storeTasks.role.STORE_MANAGER',
  STORE_PERSONNEL: 'storeTasks.role.STORE_PERSONNEL',
  SUPER_ADMIN: 'storeTasks.role.SUPER_ADMIN',
}

const activeStoreActionPlanStatuses = ['open', 'in_progress', 'blocked'] as const satisfies readonly StoreActionPlanStatus[]

export type TaskPersona = 'storeManager' | 'regionManager' | 'readOnly'
export type WorkbenchTabId = 'all' | 'checklist' | 'projection' | 'targets' | 'closed'
export type WorkbenchRowSource = 'plan' | 'workflow'
export type WorkbenchRowFamily = 'checklist' | 'projection' | 'targets' | 'other'
export type WorkbenchRowState = 'attention' | 'working' | 'reported' | 'closed'

export type WorkbenchSummary = {
  total: number
  pending: number
  checklist: number
  projection: number
  reported: number
}

export type WorkbenchRow = {
  id: string
  source: WorkbenchRowSource
  family: WorkbenchRowFamily
  state: WorkbenchRowState
  title: string
  summary: string
  storeId: string
  storeName: string
  statusLabel: string
  priorityLabel: string
  dueLabel: string
  evidenceLabel: string
  sourceLabel: string
  historyPreview?: string
  tone: StoreSurfaceTone
  priorityTone: StoreSurfaceTone
  plan?: StoreActionPlan
  workflowItem?: WorkflowInboxItem
  candidate?: ReadOnlyStoreActionCandidate
}

export function getWorkflowSourceKey(storeId: string, sourceType: WorkflowInboxItem['sourceType'], sourceId: string) {
  return `${storeId}:${sourceType}:${sourceId}`
}

export function getPlanSourceKey(storeId: string, sourceType: StoreActionPlan['sourceType'], sourceId: string) {
  return `${storeId}:${sourceType}:${sourceId}`
}

export function isActiveStatus(status: StoreActionPlanStatus) {
  return (activeStoreActionPlanStatuses as readonly StoreActionPlanStatus[]).includes(status)
}

export function formatDisplayRoleLabels(t: TranslateFunction, roleCodes: readonly string[] | null | undefined) {
  const displayRoleCodes = getDisplayRoleCodes(roleCodes)

  if (displayRoleCodes.length === 0) {
    return t('storeTasks.noRoles')
  }

  return displayRoleCodes.map((roleCode) => formatActorRoleLabel(t, roleCode)).join(', ')
}

export function formatActorRoleLabel(t: TranslateFunction, roleCode: string) {
  const translationKey = actorRoleTranslationKeys[roleCode]
  return translationKey ? t(translationKey) : formatState(roleCode)
}

export function formatWorkflowItemTypeLabel(t: TranslateFunction, type: WorkflowInboxItem['itemType']) {
  switch (type) {
    case 'approval':
      return t('storeTasks.itemType.approval')
    case 'acknowledgement':
      return t('storeTasks.itemType.acknowledgement')
    case 'task':
      return t('storeTasks.itemType.task')
    case 'notification':
      return t('storeTasks.itemType.notification')
    default:
      return type
  }
}

export function formatWorkflowPrimaryActionLabel(t: TranslateFunction, item: WorkflowInboxItem) {
  switch (item.sourceType) {
    case 'target_distribution_request':
      return item.inboxStatus === 'needs_attention'
        ? t('storeTasks.primary.targetApprove')
        : t('storeTasks.primary.targetHistory')
    case 'checklist_receipt':
      return item.inboxStatus === 'needs_attention'
        ? t('storeTasks.primary.checklistAccept')
        : t('storeTasks.primary.checklistRecord')
    case 'kpi_exception':
      return t('storeTasks.primary.kpiDetail')
    case 'store_action_plan':
      if (item.inboxStatus === 'informational') {
        return item.primaryActionLabel
      }
      return t('storeTasks.primary.actionPlan')
    default:
      return item.primaryActionLabel
  }
}

export function formatWorkflowInboxStatusLabel(t: TranslateFunction, status: WorkflowInboxItem['inboxStatus']) {
  switch (status) {
    case 'needs_attention':
      return t('storeTasks.inboxStatus.needs_attention')
    case 'completed':
      return t('storeTasks.inboxStatus.completed')
    case 'informational':
      return t('storeTasks.inboxStatus.informational')
    default:
      return formatState(status)
  }
}

export function formatWorkflowUrgencyLabel(t: TranslateFunction, urgency: WorkflowInboxItem['urgency']) {
  switch (urgency) {
    case 'high':
      return t('storeTasks.urgency.high')
    case 'medium':
      return t('storeTasks.urgency.medium')
    case 'low':
      return t('storeTasks.urgency.low')
    default:
      return formatState(urgency)
  }
}

export function mapWorkflowUrgencyTone(urgency: WorkflowInboxItem['urgency']): StoreSurfaceTone {
  switch (urgency) {
    case 'high':
      return 'danger'
    case 'medium':
      return 'warning'
    case 'low':
      return 'accent'
    default:
      return 'neutral'
  }
}

export function mapStoreActionPlanStatusTone(status: StoreActionPlanStatus): StoreSurfaceTone {
  switch (status) {
    case 'open':
      return 'warning'
    case 'in_progress':
      return 'accent'
    case 'blocked':
      return 'danger'
    case 'closed':
      return 'calm'
    case 'cancelled':
      return 'neutral'
    default:
      return 'neutral'
  }
}

export function mapStoreActionPlanPriorityTone(priority: StoreActionPlanPriority): StoreSurfaceTone {
  switch (priority) {
    case 'high':
      return 'danger'
    case 'medium':
      return 'warning'
    case 'low':
      return 'accent'
    default:
      return 'neutral'
  }
}

export function formatStoreActionPlanStatus(t: TranslateFunction, status: StoreActionPlanStatus) {
  switch (status) {
    case 'open':
      return t('storeTasks.actionPlanStatus.open')
    case 'in_progress':
      return t('storeTasks.actionPlanStatus.in_progress')
    case 'blocked':
      return t('storeTasks.actionPlanStatus.blocked')
    case 'closed':
      return t('storeTasks.actionPlanStatus.closed')
    case 'cancelled':
      return t('storeTasks.actionPlanStatus.cancelled')
    default:
      return status
  }
}

export function formatStoreActionPlanPriority(t: TranslateFunction, priority: StoreActionPlanPriority) {
  switch (priority) {
    case 'high':
      return t('storeTasks.actionPlanPriority.high')
    case 'medium':
      return t('storeTasks.actionPlanPriority.medium')
    case 'low':
      return t('storeTasks.actionPlanPriority.low')
    default:
      return priority
  }
}

export function formatStoreActionPlanSource(t: TranslateFunction, sourceType: StoreActionPlan['sourceType']) {
  switch (sourceType) {
    case 'kpi_exception':
      return t('storeTasks.sourceType.kpi_exception')
    case 'checklist_remediation':
      return t('storeTasks.sourceType.checklist_remediation')
    default:
      return sourceType
  }
}

export function formatWorkflowSourceType(t: TranslateFunction, sourceType: WorkflowInboxItem['sourceType']) {
  switch (sourceType) {
    case 'target_distribution_request':
      return t('storeTasks.sourceType.target_distribution_request')
    case 'checklist_receipt':
      return t('storeTasks.sourceType.checklist_receipt')
    case 'kpi_exception':
      return t('storeTasks.sourceType.kpi_exception')
    case 'store_action_plan':
      return t('storeTasks.sourceType.store_action_plan')
    default:
      return sourceType
  }
}

export function formatActionPlanDate(input: string, locale: AppLocale) {
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(input)
    ? `${input}T12:00:00.000Z`
    : input

  return formatDate(normalized, locale)
}

export function formatOptionalDateTime(input: string | null, locale: AppLocale, t: TranslateFunction) {
  return input ? formatDateTime(input, locale) : t('storeTasks.actionPlansNotAvailable')
}

export function formatOptionalValue(input: string | null, t: TranslateFunction) {
  const normalized = input?.trim()
  return normalized ? normalized : t('storeTasks.actionPlansNotAvailable')
}

export function mapWorkflowTone(item: WorkflowInboxItem): StoreSurfaceTone {
  if (item.inboxStatus === 'completed') return 'calm'
  if (item.inboxStatus === 'informational') return 'accent'
  if (item.urgency === 'high') return 'danger'
  if (item.urgency === 'medium') return 'warning'
  return 'neutral'
}

export function getSafeInAppPath(input: string | null) {
  if (!input || !input.startsWith('/') || input.startsWith('//')) {
    return null
  }

  for (let index = 0; index < input.length; index += 1) {
    const codePoint = input.charCodeAt(index)
    if (codePoint <= 31 || codePoint === 127) {
      return null
    }
  }

  return input
}
