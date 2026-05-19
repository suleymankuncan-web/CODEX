import type { Tone } from '../../components/dashboard-primitives'
import type { ApiGetResponse } from '../../lib/openapi-client'
import type { TargetDistributionRequest } from '../targets/api'

export type WorkflowInbox = ApiGetResponse<'/api/workflow/inbox'>
export type WorkflowInboxItem = WorkflowInbox['items'][number]
export type WorkflowInboxStatus = WorkflowInboxItem['inboxStatus']
export type WorkflowUrgency = WorkflowInboxItem['urgency']

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
