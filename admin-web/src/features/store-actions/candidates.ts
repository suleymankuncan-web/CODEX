import type { WorkflowInboxItem } from '../workflow/contracts'

type StoreActionWorkflowSourceDecision =
  | 'read_only_candidate'
  | 'persisted_action_plan'
  | 'parked_acknowledgement_boundary'
  | 'parked_approval_boundary'

export const STORE_ACTION_WORKFLOW_SOURCE_DECISIONS = {
  kpi_exception: 'read_only_candidate',
  store_action_plan: 'persisted_action_plan',
  checklist_receipt: 'parked_acknowledgement_boundary',
  target_distribution_request: 'parked_approval_boundary',
} as const satisfies Record<WorkflowInboxItem['sourceType'], StoreActionWorkflowSourceDecision>

export type StoreActionCandidateSource = {
  [Source in WorkflowInboxItem['sourceType']]:
    (typeof STORE_ACTION_WORKFLOW_SOURCE_DECISIONS)[Source] extends 'read_only_candidate'
      ? Source
      : never
}[WorkflowInboxItem['sourceType']]

export type ReadOnlyStoreActionCandidate = {
  candidateId: string
  sourceType: StoreActionCandidateSource
  sourceId: string
  title: string
  summary: string
  storeId: string
  storeName: string | undefined
  urgency: WorkflowInboxItem['urgency']
  workflowStatus: string
  deepLink: string
  createdAt: string | null | undefined
  needsAttentionAt: string | null | undefined
  historyPreview: string | undefined
}

export function buildReadOnlyStoreActionCandidates(
  items: readonly WorkflowInboxItem[],
): ReadOnlyStoreActionCandidate[] {
  return items.filter(isReadOnlyStoreActionCandidate).map((item) => ({
    candidateId: `readonly:${item.sourceType}:${item.sourceId}`,
    sourceType: item.sourceType,
    sourceId: item.sourceId,
    title: item.title,
    summary: item.summary,
    storeId: item.storeId,
    storeName: item.storeName,
    urgency: item.urgency,
    workflowStatus: item.workflowStatus,
    deepLink: item.deepLink,
    createdAt: item.createdAt,
    needsAttentionAt: item.needsAttentionAt,
    historyPreview: item.historyPreview,
  }))
}

function isReadOnlyStoreActionCandidate(
  item: WorkflowInboxItem,
): item is WorkflowInboxItem & { sourceType: StoreActionCandidateSource } {
  return (
    item.itemType === 'task' &&
    STORE_ACTION_WORKFLOW_SOURCE_DECISIONS[item.sourceType] === 'read_only_candidate' &&
    item.inboxStatus === 'needs_attention'
  )
}
