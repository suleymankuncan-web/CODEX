import {
  fetchOpenApiJson,
  sendOpenApiJson,
  type ApiGetResponse,
  type ApiMutationResponse,
  type ApiMutationBody,
} from '../../lib/openapi-client'
import {
  buildChecklistCommandQuery,
  buildChecklistCommandRegionsQuery,
  buildChecklistOperationalHistoryQuery,
  buildChecklistVisitPlanCandidateQuery,
  buildChecklistVisitPlanPeriodQuery,
  buildChecklistVisitPlanRegionOptionsQuery,
  type ChecklistCommandQueryInput,
  type ChecklistCommandRegionsQueryInput,
  type ChecklistOperationalHistoryQueryInput,
  type ChecklistVisitPlanPeriodQueryInput,
} from './model'

export type ChecklistCommandResponse = ApiGetResponse<'/api/checklists/command-canvas'>
export type ChecklistCommandData = ChecklistCommandResponse['data']
export type ChecklistCommandRow = ChecklistCommandData['items'][number]
export type ChecklistCommandRegionsResponse = ApiGetResponse<'/api/checklists/command-canvas/regions'>
export type ChecklistCommandRegion = ChecklistCommandRegionsResponse['data']['items'][number]
export type ChecklistOperationalHistoryResponse = ApiGetResponse<'/api/checklists/command-canvas/stores/{storeId}/operational-history'>
export type ChecklistOperationalHistory = ChecklistOperationalHistoryResponse['data']
export type ChecklistVisitPlanResponse = ApiGetResponse<'/api/checklists/command-canvas/visit-plans'>
export type ChecklistVisitPlan = ChecklistVisitPlanResponse['data']
export type ChecklistVisitPlanPeriodResponse = ApiGetResponse<'/api/checklists/command-canvas/visit-plans/period'>
export type ChecklistVisitPlanPeriod = ChecklistVisitPlanPeriodResponse['data']
export type ChecklistVisitPlanPeriodRow = ChecklistVisitPlanPeriod['items'][number]
export type ChecklistVisitPlanCandidateResponse = ApiGetResponse<'/api/checklists/command-canvas/visit-plans/candidates'>
export type ChecklistVisitPlanCandidate = ChecklistVisitPlanCandidateResponse['data']['items'][number]
export type ChecklistVisitPlanRegionOptionsResponse = ApiGetResponse<'/api/checklists/command-canvas/visit-plans/regions'>
export type ChecklistVisitPlanRegionOption = ChecklistVisitPlanRegionOptionsResponse['data']['items'][number]
export type SaveChecklistVisitPlanBody = ApiMutationBody<
  '/api/checklists/command-canvas/visit-plans/{regionId}/{weekStart}',
  'PUT'
>
export type CompleteChecklistVisitPlanItemBody = ApiMutationBody<
  '/api/checklists/command-canvas/visit-plans/items/{planItemId}/complete',
  'POST'
>
export type CompleteChecklistVisitPlanItemResponse = ApiMutationResponse<
  '/api/checklists/command-canvas/visit-plans/items/{planItemId}/complete',
  'POST'
>

export function getChecklistCommandCanvas(input: ChecklistCommandQueryInput) {
  return fetchOpenApiJson('/api/checklists/command-canvas', {
    query: buildChecklistCommandQuery(input),
  })
}

export function getChecklistCommandRegions(input: ChecklistCommandRegionsQueryInput) {
  return fetchOpenApiJson('/api/checklists/command-canvas/regions', {
    query: buildChecklistCommandRegionsQuery(input),
  })
}

export function getChecklistOperationalHistory(input: {
  storeId: string
  query: ChecklistOperationalHistoryQueryInput
  signal?: AbortSignal
}) {
  return fetchOpenApiJson('/api/checklists/command-canvas/stores/{storeId}/operational-history', {
    params: { storeId: input.storeId },
    query: buildChecklistOperationalHistoryQuery(input.query),
    ...(input.signal ? { signal: input.signal } : {}),
  })
}

export function getChecklistVisitPlan(input: { regionId?: string; managerUserId?: string; weekStart: string }) {
  const query = new URLSearchParams({ weekStart: input.weekStart })
  if (input.regionId) query.set('regionId', input.regionId)
  if (input.managerUserId) query.set('managerUserId', input.managerUserId)
  return fetchOpenApiJson('/api/checklists/command-canvas/visit-plans', { query })
}

export function getChecklistVisitPlanPeriod(input: ChecklistVisitPlanPeriodQueryInput) {
  return fetchOpenApiJson('/api/checklists/command-canvas/visit-plans/period', {
    query: buildChecklistVisitPlanPeriodQuery(input),
  })
}

export function getChecklistVisitPlanCandidates(input: {
  regionId: string
  query: string
  limit: number
  offset: number
}) {
  return fetchOpenApiJson('/api/checklists/command-canvas/visit-plans/candidates', {
    query: buildChecklistVisitPlanCandidateQuery(input),
  })
}

export function getChecklistVisitPlanRegionOptions(input: {
  query: string
  limit: number
  offset: number
}) {
  return fetchOpenApiJson('/api/checklists/command-canvas/visit-plans/regions', {
    query: buildChecklistVisitPlanRegionOptionsQuery(input),
  })
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

export function completeChecklistVisitPlanItem(input: {
  planItemId: string
  body: CompleteChecklistVisitPlanItemBody
}) {
  return sendOpenApiJson('/api/checklists/command-canvas/visit-plans/items/{planItemId}/complete', {
    method: 'POST',
    params: { planItemId: input.planItemId },
    body: input.body,
  })
}
