import { useQuery } from '@tanstack/react-query'
import type { AuthSessionSummary } from '../auth/api'
import { getStoreQueryScopeSignature } from '../auth/store-query-scope'
import { fetchOpenApiJson, type ApiGetResponse } from '../../lib/openapi-client'
import { transientQueryRetryOptions } from '../../lib/query-retry'
import { ApiError } from '../../lib/api'

export type StoreReturnsLedger = ApiGetResponse<'/api/reports/store-returns'>['data']
export type StoreReturnRow = StoreReturnsLedger['rows'][number]
export type StoreReturnsRange = { storeId: string; periodStart: string; periodEnd: string }

export function storeReturnsQueryKey(auth: AuthSessionSummary | null, range: StoreReturnsRange, category: 'inside' | 'other', offset: number) {
  return ['store-returns', getStoreQueryScopeSignature(auth), range.storeId, range.periodStart, range.periodEnd, category, offset] as const
}

export function useStoreReturns(auth: AuthSessionSummary | null, range: StoreReturnsRange, category: 'inside' | 'other' = 'inside', offset = 0, enabled = true) {
  return useQuery({
    queryKey: storeReturnsQueryKey(auth, range, category, offset),
    queryFn: ({ signal }) => fetchOpenApiJson('/api/reports/store-returns', {
      query: new URLSearchParams({ storeId: range.storeId, periodStart: range.periodStart, periodEnd: range.periodEnd, category, offset: String(offset), limit: '50' }), signal,
    }),
    enabled: enabled && Boolean(auth?.authenticated && range.storeId && range.periodStart && range.periodEnd),
    staleTime: 30_000,
    ...transientQueryRetryOptions,
  })
}

export function isReturnsAccessError(error: unknown) {
  return error instanceof ApiError && (error.status === 401 || error.status === 403)
}
