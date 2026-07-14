import { fetchOpenApiJson, type ApiGetResponse } from '../../lib/openapi-client'
import { buildChecklistCommandQuery, type ChecklistCommandQueryInput } from './model'

export type ChecklistCommandResponse = ApiGetResponse<'/api/checklists/command-canvas'>
export type ChecklistCommandData = ChecklistCommandResponse['data']
export type ChecklistCommandRow = ChecklistCommandData['items'][number]

export function getChecklistCommandCanvas(input: ChecklistCommandQueryInput) {
  return fetchOpenApiJson('/api/checklists/command-canvas', {
    query: buildChecklistCommandQuery(input),
  })
}
