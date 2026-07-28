import {
  fetchOpenApiJson,
  sendOpenApiJson,
  type ApiGetResponse,
  type ApiMutationBody,
  type ApiMutationResponse,
} from '../../lib/openapi-client'
import { fetchBlob, sendFormData, sendJson } from '../../lib/api'

export type StoreActionPlanList = ApiGetResponse<'/api/store-actions/plans'>
export type StoreActionPlan = StoreActionPlanList['items'][number]
export type StoreActionPlanDetailResponse = ApiGetResponse<'/api/store-actions/plans/{actionPlanId}'>
export type StoreActionPlanDetail = StoreActionPlanDetailResponse['data']['plan']
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
export type CancelStoreActionPlanInput = ApiMutationBody<
  '/api/store-actions/plans/{actionPlanId}/cancel',
  'PATCH'
>
export type CancelStoreActionPlanResponse = ApiMutationResponse<
  '/api/store-actions/plans/{actionPlanId}/cancel',
  'PATCH'
>
export type StoreActionPhotoReview = ApiGetResponse<'/api/store-actions/plans/{actionPlanId}/photo-review'>

export function listStoreActionPlans(input: {
  storeId?: string
  status?: StoreActionPlanStatus
  statuses?: readonly StoreActionPlanStatus[]
  periodStart?: string
  periodEnd?: string
  limit?: number
  offset?: number
} = {}) {
  const params = new URLSearchParams()

  appendQueryParam(params, 'storeId', input.storeId)
  appendQueryParam(params, 'status', input.status)
  for (const status of input.statuses ?? []) {
    params.append('statuses', status)
  }
  appendQueryParam(params, 'periodStart', input.periodStart)
  appendQueryParam(params, 'periodEnd', input.periodEnd)
  appendQueryParam(params, 'limit', input.limit)
  appendQueryParam(params, 'offset', input.offset)

  return fetchOpenApiJson('/api/store-actions/plans', { query: params })
}

export function getStoreActionPlan(input: { actionPlanId: string }) {
  return fetchOpenApiJson('/api/store-actions/plans/{actionPlanId}', {
    params: { actionPlanId: input.actionPlanId },
  })
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

export function cancelStoreActionPlan(input: {
  actionPlanId: string
  body: CancelStoreActionPlanInput
}) {
  return sendOpenApiJson('/api/store-actions/plans/{actionPlanId}/cancel', {
    method: 'PATCH',
    params: { actionPlanId: input.actionPlanId },
    body: input.body,
  })
}

export function getStoreActionPhotoReview(input: { actionPlanId: string }) {
  return fetchOpenApiJson('/api/store-actions/plans/{actionPlanId}/photo-review', {
    params: { actionPlanId: input.actionPlanId },
  })
}

export function uploadStoreActionSolutionEvidence(input: { actionPlanId: string; file: File }) {
  const body = new FormData()
  body.append('file', input.file)
  return sendFormData<{ mediaAssetId: string; state: 'uploaded' }>(
    `/store-actions/plans/${input.actionPlanId}/solution/uploads`, { method: 'POST', body },
  )
}

export function finalizeStoreActionSolutionEvidence(input: { actionPlanId: string; mediaAssetId: string }) {
  return sendJson<{ mediaAssetId: string; state: 'ready'; rawDisposal: 'verified' | 'pending' }>(
    `/store-actions/plans/${input.actionPlanId}/solution/uploads/${input.mediaAssetId}/finalize`,
    { method: 'POST', body: {} },
  )
}

export function submitStoreActionSolution(input: {
  actionPlanId: string
  body: { resolutionNote: string; mediaAssetId: string; expectedVersion: number; idempotencyKey: string }
}) {
  return sendOpenApiJson('/api/store-actions/plans/{actionPlanId}/solution-attempts', {
    method: 'POST', params: { actionPlanId: input.actionPlanId }, body: input.body,
  })
}

export function reviewStoreActionSolution(input: {
  actionPlanId: string
  solutionAttemptId: string
  body: { solutionAttemptId: string; decision: 'approve' | 'reject'; reason?: string; expectedVersion: number; idempotencyKey: string }
}) {
  return sendOpenApiJson('/api/store-actions/plans/{actionPlanId}/solution-attempts/{solutionAttemptId}/review', {
    method: 'POST', params: { actionPlanId: input.actionPlanId, solutionAttemptId: input.solutionAttemptId }, body: input.body,
  })
}

export function getStoreActionSolutionEvidenceContent(input: {
  actionPlanId: string; mediaAssetId: string; variant?: 'canonical' | 'thumbnail'
}) {
  return fetchBlob(`/store-actions/plans/${input.actionPlanId}/evidence/${input.mediaAssetId}/content/${input.variant ?? 'thumbnail'}`)
}

function appendQueryParam(params: URLSearchParams, key: string, value: string | number | undefined) {
  if (value === undefined) {
    return
  }

  params.set(key, String(value))
}
