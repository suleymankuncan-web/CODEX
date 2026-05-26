import { formatDateTime, formatState } from '../../lib/format'
import type { AppLocale } from '../../lib/i18n'
import {
  StoreInfoGrid,
  StoreStatusBadge,
  type StoreSurfaceTone,
} from '../../pages/store-surface-primitives'
import type { TranslateFunction, TranslationKey } from '../localization/dictionary'
import { useLocalization } from '../localization/useLocalization'
import type { WorkflowInboxItem } from './contracts'

const actorRoleTranslationKeys: Partial<Record<string, TranslationKey>> = {
  REGION_APPROVER: 'storeTasks.role.REGION_APPROVER',
  REPORT_VIEWER: 'storeTasks.role.REPORT_VIEWER',
  STORE_MANAGER: 'storeTasks.role.STORE_MANAGER',
  STORE_PERSONNEL: 'storeTasks.role.STORE_PERSONNEL',
  SUPER_ADMIN: 'storeTasks.role.SUPER_ADMIN',
}

type InboxDetailSignal = {
  value: string
  tone: StoreSurfaceTone
}

type WorkflowInboxDetailModel = {
  detailSummary: string
  dueSignal: InboxDetailSignal
  escalation: InboxDetailSignal
  sourceAction: string
}

export function WorkflowInboxDetail(input: { item: WorkflowInboxItem }) {
  const { locale, t } = useLocalization()
  const detail = resolveWorkflowInboxDetail(input.item, t)

  return (
    <div aria-label="Inbox item detail" className="tw:flex tw:flex-col tw:gap-3">
      <div className="tw:flex tw:flex-wrap tw:gap-2" aria-label="Inbox governance signals">
        <StoreStatusBadge tone={detail.dueSignal.tone}>{detail.dueSignal.value}</StoreStatusBadge>
        <StoreStatusBadge tone={detail.escalation.tone}>{detail.escalation.value}</StoreStatusBadge>
      </div>
      <StoreInfoGrid
        items={[
          { label: t('storeTasks.detailSummary'), value: detail.detailSummary },
          { label: t('storeTasks.timeSignal'), value: resolveDueValue(input.item, locale, t) },
          { label: t('storeTasks.escalation'), value: detail.escalation.value },
          { label: t('storeTasks.sourceAction'), value: detail.sourceAction },
        ]}
      />
    </div>
  )
}

function resolveWorkflowInboxDetail(
  item: WorkflowInboxItem,
  t: TranslateFunction,
): WorkflowInboxDetailModel {
  return {
    detailSummary: `${formatWorkflowItemTypeLabel(t, item.itemType)} · ${formatWorkflowStatus(t, item.workflowStatus)} · ${formatActorRoleLabel(t, item.actorRole)}`,
    dueSignal: resolveDueSignal(item, t),
    escalation: resolveEscalationSignal(item, t),
    sourceAction: resolveSourceAction(item, t),
  }
}

function formatWorkflowItemTypeLabel(t: TranslateFunction, type: WorkflowInboxItem['itemType']) {
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

function formatWorkflowStatus(t: TranslateFunction, status: string) {
  switch (status) {
    case 'at_risk':
      return t('storeTasks.workflowStatus.at_risk')
    case 'off_track':
      return t('storeTasks.workflowStatus.off_track')
    case 'pending_region_approval':
      return t('storeTasks.workflowStatus.pending_region_approval')
    case 'completed':
      return t('storeTasks.workflowStatus.completed')
    default:
      return formatState(status)
  }
}

function resolveDueSignal(item: WorkflowInboxItem, t: TranslateFunction): InboxDetailSignal {
  if (item.inboxStatus === 'completed') {
    return { value: t('storeTasks.due.closed'), tone: 'calm' }
  }

  if (item.urgency === 'high') {
    return { value: t('storeTasks.due.today'), tone: 'danger' }
  }

  if (item.urgency === 'medium') {
    return { value: t('storeTasks.due.planned'), tone: 'warning' }
  }

  return { value: t('storeTasks.due.low'), tone: 'accent' }
}

function resolveEscalationSignal(item: WorkflowInboxItem, t: TranslateFunction): InboxDetailSignal {
  if (item.inboxStatus !== 'needs_attention') {
    return { value: t('storeTasks.escalation.none'), tone: 'calm' }
  }

  if (item.urgency === 'high') {
    return { value: t('storeTasks.escalation.candidate'), tone: 'danger' }
  }

  if (item.urgency === 'medium') {
    return { value: t('storeTasks.escalation.watch'), tone: 'warning' }
  }

  return { value: t('storeTasks.escalation.monitoring'), tone: 'accent' }
}

function resolveSourceAction(item: WorkflowInboxItem, t: TranslateFunction) {
  switch (item.sourceType) {
    case 'target_distribution_request':
      return t('storeTasks.sourceAction.target')
    case 'checklist_receipt':
      return t('storeTasks.sourceAction.checklist')
    case 'kpi_exception':
      return t('storeTasks.sourceAction.kpi')
    case 'store_action_plan':
      return t('storeTasks.sourceAction.actionPlan')
    default:
      return item.primaryActionLabel
  }
}

function resolveDueValue(
  item: WorkflowInboxItem,
  locale: AppLocale,
  t: TranslateFunction,
) {
  const dateValue = item.needsAttentionAt ?? item.createdAt
  return dateValue ? formatDateTime(dateValue, locale) : t('storeTasks.noTime')
}

function formatActorRoleLabel(t: TranslateFunction, roleCode: string) {
  const translationKey = actorRoleTranslationKeys[roleCode]
  return translationKey ? t(translationKey) : formatState(roleCode)
}
