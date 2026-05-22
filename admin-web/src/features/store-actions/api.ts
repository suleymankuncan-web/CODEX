import { fetchOpenApiJson, type ApiGetResponse } from '../../lib/openapi-client'

export type StoreActionPlanList = ApiGetResponse<'/api/store-actions/plans'>
export type StoreActionPlan = StoreActionPlanList['items'][number]
export type StoreActionPlanPriority = StoreActionPlan['priority']
export type StoreActionPlanStatus = StoreActionPlan['status']

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

function appendQueryParam(params: URLSearchParams, key: string, value: string | number | undefined) {
  if (value === undefined) {
    return
  }

  params.set(key, String(value))
}
