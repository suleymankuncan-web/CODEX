import {
  fetchOpenApiJson,
  sendOpenApiJson,
  type ApiGetResponse,
  type ApiMutationBody,
  type ApiMutationResponse,
} from '../../lib/openapi-client'

export type StoreActionPlanList = ApiGetResponse<'/api/store-actions/plans'>
export type StoreActionPlan = StoreActionPlanList['items'][number]
export type StoreActionPlanPriority = StoreActionPlan['priority']
export type StoreActionPlanStatus = StoreActionPlan['status']
export type CreateStoreActionPlanInput = ApiMutationBody<'/api/store-actions/plans', 'POST'>
export type CreateStoreActionPlanResponse = ApiMutationResponse<'/api/store-actions/plans', 'POST'>
export type UpdateStoreActionPlanStatusInput = ApiMutationBody<
  '/api/store-actions/plans/{actionPlanId}/status',
  'PATCH'
>
export type UpdateStoreActionPlanStatusResponse = ApiMutationResponse<
  '/api/store-actions/plans/{actionPlanId}/status',
  'PATCH'
>
export type CloseStoreActionPlanInput = ApiMutationBody<
  '/api/store-actions/plans/{actionPlanId}/close',
  'PATCH'
>
export type CloseStoreActionPlanResponse = ApiMutationResponse<
  '/api/store-actions/plans/{actionPlanId}/close',
  'PATCH'
>

export function listStoreActionPlans(input: {
  storeId?: string
  status?: StoreActionPlanStatus
  limit?: number
  offset?: number
} = {}) {
  const params = new URLSearchParams()

  appendQueryParam(params, 'storeId', input.storeId)
  appendQueryParam(params, 'status', input.status)
  appendQueryParam(params, 'limit', input.limit)
  appendQueryParam(params, 'offset', input.offset)

  return fetchOpenApiJson('/api/store-actions/plans', { query: params })
}

export function createStoreActionPlan(input: CreateStoreActionPlanInput) {
  return sendOpenApiJson('/api/store-actions/plans', {
    method: 'POST',
    body: input,
  })
}

export function updateStoreActionPlanStatus(input: {
  actionPlanId: string
  body: UpdateStoreActionPlanStatusInput
}) {
  return sendOpenApiJson('/api/store-actions/plans/{actionPlanId}/status', {
    method: 'PATCH',
    params: { actionPlanId: input.actionPlanId },
    body: input.body,
  })
}

export function closeStoreActionPlan(input: {
  actionPlanId: string
  body: CloseStoreActionPlanInput
}) {
  return sendOpenApiJson('/api/store-actions/plans/{actionPlanId}/close', {
    method: 'PATCH',
    params: { actionPlanId: input.actionPlanId },
    body: input.body,
  })
}

function appendQueryParam(params: URLSearchParams, key: string, value: string | number | undefined) {
  if (value === undefined) {
    return
  }

  params.set(key, String(value))
}
