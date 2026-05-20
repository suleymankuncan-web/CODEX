import { fetchOpenApiJson } from '../../lib/openapi-client'

export async function getWorkflowInbox() {
  return fetchOpenApiJson('/api/workflow/inbox')
}
