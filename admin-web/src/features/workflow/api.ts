import { fetchJson } from '../../lib/api'
import type { WorkflowInboxItem } from './contracts'

type ListResponse<T> = {
  items: T[]
  meta: {
    count: number
    total: number
    limit: number
    offset: number
  }
}

export async function getWorkflowInbox() {
  return fetchJson<ListResponse<WorkflowInboxItem>>('/workflow/inbox')
}
