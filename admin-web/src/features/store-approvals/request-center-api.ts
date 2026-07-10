import { fetchOpenApiJson, type ApiGetResponse } from '../../lib/openapi-client'

export type RequestCenterPage = ApiGetResponse<'/api/workflow/request-center'>
export type RequestCenterItem = RequestCenterPage['items'][number]

export type RequestCenterListInput = {
  bucket: 'open' | 'done'
  type: 'all' | 'target' | 'sellerCode' | 'offboarding'
  status: 'all' | 'pending' | 'returned' | 'approved'
  period?: string
  storeId?: string
  query?: string
  limit: number
  offset: number
}

export function buildRequestCenterQuery(input: RequestCenterListInput) {
  const params = new URLSearchParams({
    bucket: input.bucket,
    type: input.type,
    status: input.status,
  })

  if (input.period) {
    params.set('period', input.period)
  }
  if (input.storeId) {
    params.set('storeId', input.storeId)
  }

  const query = input.query?.trim()
  if (query) {
    params.set('q', query)
  }

  params.set('limit', String(input.limit))
  params.set('offset', String(input.offset))
  return params
}

export function getRequestCenterPage(input: RequestCenterListInput) {
  return fetchOpenApiJson('/api/workflow/request-center', {
    query: buildRequestCenterQuery(input),
  })
}
