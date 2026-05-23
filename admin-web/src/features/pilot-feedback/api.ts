import {
  fetchOpenApiJson,
  sendOpenApiJson,
  type ApiGetResponse,
  type ApiMutationBody,
  type ApiMutationResponse,
} from '../../lib/openapi-client'

export type PilotFeedbackList = ApiGetResponse<'/api/admin/pilot-feedback'>
export type PilotFeedback = PilotFeedbackList['items'][number]
export type PilotFeedbackStatus = PilotFeedback['status']
export type PilotFeedbackClassification = NonNullable<PilotFeedback['classification']>
export type PilotFeedbackSeverity = PilotFeedback['severitySuggestion']
export type PilotFeedbackType = PilotFeedback['feedbackType']
export type CreatePilotFeedbackInput = ApiMutationBody<'/api/pilot-feedback', 'POST'>
export type CreatePilotFeedbackResponse = ApiMutationResponse<'/api/pilot-feedback', 'POST'>
export type ClassifyPilotFeedbackInput = ApiMutationBody<
  '/api/admin/pilot-feedback/{feedbackId}/classification',
  'PATCH'
>
export type ClassifyPilotFeedbackResponse = ApiMutationResponse<
  '/api/admin/pilot-feedback/{feedbackId}/classification',
  'PATCH'
>

export function createPilotFeedback(input: CreatePilotFeedbackInput) {
  return sendOpenApiJson('/api/pilot-feedback', {
    method: 'POST',
    body: input,
  })
}

export function listPilotFeedback(input: {
  status?: PilotFeedbackStatus | ''
  classification?: PilotFeedbackClassification | ''
  limit?: number
  offset?: number
} = {}) {
  const params = new URLSearchParams()

  appendQueryParam(params, 'status', input.status)
  appendQueryParam(params, 'classification', input.classification)
  appendQueryParam(params, 'limit', input.limit)
  appendQueryParam(params, 'offset', input.offset)

  return fetchOpenApiJson('/api/admin/pilot-feedback', { query: params })
}

export function classifyPilotFeedback(input: {
  feedbackId: string
  body: ClassifyPilotFeedbackInput
}) {
  return sendOpenApiJson('/api/admin/pilot-feedback/{feedbackId}/classification', {
    method: 'PATCH',
    params: { feedbackId: input.feedbackId },
    body: input.body,
  })
}

function appendQueryParam(
  params: URLSearchParams,
  key: string,
  value: string | number | undefined,
) {
  if (value === undefined || value === '') {
    return
  }

  params.set(key, String(value))
}
