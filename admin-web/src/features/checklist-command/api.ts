import {
  fetchOpenApiJson,
  sendOpenApiJson,
  type ApiGetResponse,
  type ApiMutationBody,
} from '../../lib/openapi-client'
import { buildChecklistCommandQuery, type ChecklistCommandQueryInput } from './model'

export type ChecklistCommandResponse = ApiGetResponse<'/api/checklists/command-canvas'>
export type ChecklistCommandData = ChecklistCommandResponse['data']
export type ChecklistCommandRow = ChecklistCommandData['items'][number]
export type ChecklistVisitPlanResponse = ApiGetResponse<'/api/checklists/command-canvas/visit-plans'>
export type ChecklistVisitPlan = ChecklistVisitPlanResponse['data']
export type SaveChecklistVisitPlanBody = ApiMutationBody<
  '/api/checklists/command-canvas/visit-plans/{regionId}/{weekStart}',
  'PUT'
>

export function getChecklistCommandCanvas(input: ChecklistCommandQueryInput) {
  return fetchOpenApiJson('/api/checklists/command-canvas', {
    query: buildChecklistCommandQuery(input),
  })
}

export function getChecklistVisitPlan(input: { regionId: string; weekStart: string }) {
  const query = new URLSearchParams({ regionId: input.regionId, weekStart: input.weekStart })
  return fetchOpenApiJson('/api/checklists/command-canvas/visit-plans', { query })
}

export function saveChecklistVisitPlan(input: {
  regionId: string
  weekStart: string
  body: SaveChecklistVisitPlanBody
}) {
  return sendOpenApiJson('/api/checklists/command-canvas/visit-plans/{regionId}/{weekStart}', {
    method: 'PUT',
    params: { regionId: input.regionId, weekStart: input.weekStart },
    body: input.body,
  })
}

export async function getAllChecklistCommandRowsForRegion(
  input: Omit<ChecklistCommandQueryInput, 'limit' | 'offset' | 'status' | 'sort' | 'query'> & {
    regionId: string
  },
) {
  const rows: ChecklistCommandRow[] = []
  let offset = 0
  do {
    const response = await getChecklistCommandCanvas({
      ...input,
      status: 'all',
      sort: 'store_asc',
      query: '',
      limit: 200,
      offset,
    })
    rows.push(...response.data.items)
    if (!response.data.page.hasMore) return rows
    if (response.data.items.length === 0) throw new Error('Checklist command pagination did not advance')
    offset += response.data.items.length
  } while (true)
}
