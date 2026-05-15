import type { Tone } from '../../components/dashboard-primitives'
import type { ChecklistAcknowledgementItem } from '../checklists/api'
import type { TargetDistributionRequest } from '../targets/api'

type WorkflowItemType = 'approval' | 'acknowledgement' | 'task' | 'notification'

export type WorkflowInboxStatus = 'needs_attention' | 'completed' | 'informational'

export type WorkflowUrgency = 'high' | 'medium' | 'low'

export type WorkflowInboxItem = {
  itemType: WorkflowItemType
  sourceType: 'target_distribution_request' | 'checklist_receipt' | 'kpi_exception'
  sourceId: string
  title: string
  summary: string
  companyId?: string
  regionId?: string
  storeId: string
  storeName?: string
  workflowStatus: string
  inboxStatus: WorkflowInboxStatus
  urgency: WorkflowUrgency
  createdAt?: string | null
  needsAttentionAt?: string | null
  actorRole: string
  primaryActionLabel: string
  secondaryActionLabel?: string
  deepLink: string
  historyPreview?: string
}

export function mapInboxStatusTone(status: WorkflowInboxStatus): Tone {
  switch (status) {
    case 'needs_attention':
      return 'warning'
    case 'completed':
      return 'calm'
    case 'informational':
      return 'accent'
    default:
      return 'neutral'
  }
}

export function mapWorkflowUrgencyTone(urgency: WorkflowUrgency): Tone {
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

export function toTargetApprovalInboxItem(
  item: TargetDistributionRequest,
  deepLink = '/admin/targets',
): WorkflowInboxItem {
  const needsAttention = item.status === 'pending_region_approval'

  return {
    itemType: 'approval',
    sourceType: 'target_distribution_request',
    sourceId: item.requestId,
    title: item.targetLabel,
    summary: `${item.storeName || item.storeId} icin ${item.allocationCount} kisilik hedef dagitimi talebi`,
    companyId: item.companyId,
    regionId: item.regionId,
    storeId: item.storeId,
    storeName: item.storeName,
    workflowStatus: item.status,
    inboxStatus: needsAttention ? 'needs_attention' : 'completed',
    urgency: needsAttention ? 'medium' : 'low',
    createdAt: item.createdAt,
    needsAttentionAt: needsAttention ? item.createdAt : item.approvedAt,
    actorRole: 'REGION_APPROVER',
    primaryActionLabel: needsAttention ? 'Talebi onayla' : 'Geçmişi incele',
    secondaryActionLabel: 'Detayı aç',
    deepLink,
    historyPreview: item.approvalNote ?? item.requestReason ?? undefined,
  }
}

export function toChecklistAcknowledgementInboxItem(
  item: ChecklistAcknowledgementItem,
  deepLink = `/store/checklists?tab=inbox&result=${encodeURIComponent(item.checklistInstanceId)}`,
): WorkflowInboxItem {
  const needsAttention = item.acknowledgement === null

  return {
    itemType: 'acknowledgement',
    sourceType: 'checklist_receipt',
    sourceId: item.checklistInstanceId,
    title: item.templateName,
    summary: `${item.storeName || item.storeId} icin tamamlanan checklist sonucu`,
    storeId: item.storeId,
    storeName: item.storeName,
    workflowStatus: item.status,
    inboxStatus: needsAttention ? 'needs_attention' : 'completed',
    urgency: needsAttention ? 'medium' : 'low',
    createdAt: item.completedAt,
    needsAttentionAt: needsAttention ? item.completedAt : item.acknowledgement?.acknowledgedAt,
    actorRole: 'STORE_MANAGER',
    primaryActionLabel: needsAttention ? 'Kabul ediyorum' : 'Kabul kaydını gör',
    secondaryActionLabel: 'Checklist sonucunu aç',
    deepLink,
    historyPreview: item.acknowledgement?.acknowledgementNote ?? undefined,
  }
}
