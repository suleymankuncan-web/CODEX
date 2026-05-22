import type { WorkflowInboxItem } from '../workflow/contracts'

export type StoreActionCandidateSource = 'kpi_exception'

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
    item.sourceType === 'kpi_exception' &&
    item.inboxStatus === 'needs_attention'
  )
}
