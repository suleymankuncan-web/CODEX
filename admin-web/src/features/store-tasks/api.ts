import { fetchOpenApiJson, type ApiGetResponse } from '../../lib/openapi-client'

export type TaskCommandWorkspaceResponse = ApiGetResponse<'/api/store/tasks/workspace'>
export type TaskCommandWorkspace = TaskCommandWorkspaceResponse['data']
export type TaskCommandWorkspaceItem = TaskCommandWorkspace['items'][number]
export type TaskCommandAuditPageResponse = ApiGetResponse<'/api/store/tasks/{actionPlanId}/events'>
export type TaskCommandAuditPage = TaskCommandAuditPageResponse['data']

export async function getTaskCommandWorkspace(input: {
  periodStart: string
  periodEnd: string
  limit?: number
  offset?: number
}) {
  const query = new URLSearchParams({
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
  })
  append(query, 'limit', input.limit)
  append(query, 'offset', input.offset)
  const response = await fetchOpenApiJson('/api/store/tasks/workspace', { query })
  return response.data
}

export async function getTaskCommandEvents(input: {
  actionPlanId: string
  limit?: number
  offset?: number
}) {
  const query = new URLSearchParams()
  append(query, 'limit', input.limit)
  append(query, 'offset', input.offset)
  const response = await fetchOpenApiJson('/api/store/tasks/{actionPlanId}/events', {
    params: { actionPlanId: input.actionPlanId },
    query,
  })
  return response.data
}

function append(query: URLSearchParams, key: string, value?: number) {
  if (value !== undefined) query.set(key, String(value))
}
