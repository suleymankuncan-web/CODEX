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

const WORKSPACE_PAGE_SIZE = 200

export type RequestCenterWorkspace = {
  items: RequestCenterItem[]
  summary: RequestCenterPage['summary']
}

async function getCompleteBucket(bucket: 'open' | 'done') {
  const first = await getRequestCenterPage({
    bucket,
    type: 'all',
    status: 'all',
    limit: WORKSPACE_PAGE_SIZE,
    offset: 0,
  })
  const offsets = getRequestCenterWorkspaceOffsets(first.meta.total)
  const rest: RequestCenterPage[] = []
  for (const offset of offsets.slice(1)) {
    rest.push(await getRequestCenterPage({
        bucket,
        type: 'all',
        status: 'all',
        limit: WORKSPACE_PAGE_SIZE,
        offset,
      }))
  }
  return {
    items: [first, ...rest].flatMap((page) => page.items),
    summary: first.summary,
  }
}

export function getRequestCenterWorkspaceOffsets(total: number) {
  return Array.from(
    { length: Math.ceil(Math.max(0, total) / WORKSPACE_PAGE_SIZE) },
    (_, index) => index * WORKSPACE_PAGE_SIZE,
  )
}

export async function getRequestCenterWorkspace(): Promise<RequestCenterWorkspace> {
  const [open, done] = await Promise.all([
    getCompleteBucket('open'),
    getCompleteBucket('done'),
  ])
  return {
    items: [...open.items, ...done.items],
    summary: open.summary,
  }
}
