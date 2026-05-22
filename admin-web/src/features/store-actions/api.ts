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

function appendQueryParam(params: URLSearchParams, key: string, value: string | number | undefined) {
  if (value === undefined) {
    return
  }

  params.set(key, String(value))
}
