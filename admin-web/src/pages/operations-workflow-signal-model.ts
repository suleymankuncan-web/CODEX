import type { WorkflowInbox } from '../features/workflow/contracts'

export type WorkflowInboxPressure = {
  highUrgencyCount: number
  needsAttentionCount: number
  total: number
}

export function summarizeWorkflowInboxPressure(input: {
  inbox: WorkflowInbox | undefined
}): WorkflowInboxPressure {
  const items = input.inbox?.items ?? []
  const needsAttentionCount = items.filter((item) => item.inboxStatus === 'needs_attention').length
  const highUrgencyCount = items.filter((item) => item.urgency === 'high').length

  return {
    highUrgencyCount,
    needsAttentionCount,
    total: input.inbox?.meta.total ?? items.length,
  }
}
