import {
  fetchOpenApiJson,
  sendOpenApiJson,
  type ApiGetResponse,
  type ApiMutationBody,
} from '../../lib/openapi-client'
import {
  buildChecklistCommandQuery,
  buildChecklistVisitPlanCandidateQuery,
  buildChecklistVisitPlanPeriodQuery,
  buildChecklistVisitPlanRegionOptionsQuery,
  type ChecklistCommandQueryInput,
  type ChecklistVisitPlanPeriodQueryInput,
} from './model'

export type ChecklistCommandResponse = ApiGetResponse<'/api/checklists/command-canvas'>
export type ChecklistCommandData = ChecklistCommandResponse['data']
export type ChecklistCommandRow = ChecklistCommandData['items'][number]
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

export function getChecklistCommandCanvas(input: ChecklistCommandQueryInput) {
  return fetchOpenApiJson('/api/checklists/command-canvas', {
    query: buildChecklistCommandQuery(input),
  })
}

export function getChecklistVisitPlan(input: { regionId: string; weekStart: string }) {
  const query = new URLSearchParams({ regionId: input.regionId, weekStart: input.weekStart })
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
