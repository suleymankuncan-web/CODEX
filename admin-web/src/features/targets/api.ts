import {
  fetchOpenApiJson,
  sendOpenApiJson,
  type ApiGetResponse,
} from '../../lib/openapi-client'

type CommandResponse<T> = {
  command: {
    status: string
    message: string
  }
  data: T
}

export type TargetDistributionRequests = ApiGetResponse<'/api/target-distributions/requests'>
export type TargetDistributionRequest = TargetDistributionRequests['items'][number]
export type TargetDistributionAllocation = TargetDistributionRequest['allocations'][number]

export type StoreTargetingPersonnel = ApiGetResponse<'/api/target-distributions/store-personnel'>
export type StoreTargetingPerson = StoreTargetingPersonnel['items'][number]

export type TargetCoverage = ApiGetResponse<'/api/target-distributions/coverage'>
export type TargetCoverageRow = TargetCoverage['items'][number]
export type TargetCoverageSummary = TargetCoverage['summary']
export type TargetRevisionBasis = ApiGetResponse<'/api/target-distributions/revision-basis'>

export async function getStoreTargetingPersonnel(storeId: string) {
  const params = new URLSearchParams({ storeId })
  return fetchOpenApiJson('/api/target-distributions/store-personnel', { query: params })
}

export async function getTargetCoverage(input: { requestMonth: string; storeId?: string }) {
  const params = new URLSearchParams({ requestMonth: input.requestMonth })

  if (input.storeId) {
    params.set('storeId', input.storeId)
  }

  return fetchOpenApiJson('/api/target-distributions/coverage', { query: params })
}

export async function getTargetRevisionBasis(input: { requestMonth: string; storeId: string }) {
  const params = new URLSearchParams({
    requestMonth: input.requestMonth,
    storeId: input.storeId,
  })
  return fetchOpenApiJson('/api/target-distributions/revision-basis', { query: params })
}

export async function getTargetDistributionRequests(input?: {
  limit?: number
  offset?: number
  requestMonth?: string
  status?: string
  storeId?: string
}) {
  const params = new URLSearchParams()

  if (input?.status) {
    params.set('status', input.status)
  }

  if (input?.requestMonth) {
    params.set('requestMonth', input.requestMonth)
  }

  if (input?.storeId) {
    params.set('storeId', input.storeId)
  }

  if (input?.limit !== undefined) {
    params.set('limit', String(input.limit))
  }

  if (input?.offset !== undefined) {
    params.set('offset', String(input.offset))
  }

  return fetchOpenApiJson('/api/target-distributions/requests', { query: params })
}

export async function createTargetDistributionRequest(input: {
  storeId: string
  requestMonth: string
  targetLabel: string
  totalTargetValue: number
  requestReason?: string
  allocations: TargetDistributionAllocation[]
  revision?: {
    baseReferenceIds: string[]
    removedEmployeeIds: string[]
  }
}) {
  return sendOpenApiJson('/api/target-distributions/requests', {
    method: 'POST',
    body: input,
  }) as Promise<CommandResponse<{ request: TargetDistributionRequest }>>
}

export async function approveTargetDistributionRequest(input: {
  requestId: string
  approvalNote?: string
  approvedTotalTargetValue?: number
  approvedAllocations?: TargetDistributionAllocation[]
}) {
  const body = {
    ...(input.approvalNote !== undefined ? { approvalNote: input.approvalNote } : {}),
    ...(input.approvedTotalTargetValue !== undefined
      ? { approvedTotalTargetValue: input.approvedTotalTargetValue }
      : {}),
    ...(input.approvedAllocations !== undefined
      ? { approvedAllocations: input.approvedAllocations }
      : {}),
  }

  return sendOpenApiJson('/api/target-distributions/requests/{requestId}/approve', {
    method: 'PATCH',
    params: { requestId: input.requestId },
    body,
  }) as unknown as Promise<CommandResponse<{ request: TargetDistributionRequest }>>
}
