import { fetchJson, sendJson } from '../../lib/api'
import { fetchOpenApiJson, type ApiGetResponse } from '../../lib/openapi-client'

type ListResponse<T> = {
  items: T[]
  meta: {
    count: number
    total: number
    limit: number
    offset: number
  }
}

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

export type StoreTargetingPerson = {
  employeeId: string
  displayName: string
  externalEmployeeRef: string | null
  periodStart: string | null
  periodEnd: string | null
  netSalesValue: number | null
}

export type TargetCoverage = ApiGetResponse<'/api/target-distributions/coverage'>
export type TargetCoverageRow = TargetCoverage['items'][number]
export type TargetCoverageSummary = TargetCoverage['summary']

export async function getStoreTargetingPersonnel(storeId: string) {
  const params = new URLSearchParams({ storeId })
  return fetchJson<ListResponse<StoreTargetingPerson>>(
    `/target-distributions/store-personnel?${params.toString()}`,
  )
}

export async function getTargetCoverage(input: { requestMonth: string; storeId?: string }) {
  const params = new URLSearchParams({ requestMonth: input.requestMonth })

  if (input.storeId) {
    params.set('storeId', input.storeId)
  }

  return fetchOpenApiJson('/api/target-distributions/coverage', { query: params })
}

export async function getTargetDistributionRequests(input?: { status?: string }) {
  const params = new URLSearchParams()

  if (input?.status) {
    params.set('status', input.status)
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
}) {
  return sendJson<CommandResponse<{ request: TargetDistributionRequest }>>(
    '/target-distributions/requests',
    {
      method: 'POST',
      body: input,
    },
  )
}

export async function approveTargetDistributionRequest(input: {
  requestId: string
  approvalNote?: string
}) {
  return sendJson<CommandResponse<{ request: TargetDistributionRequest }>>(
    `/target-distributions/requests/${input.requestId}/approve`,
    {
      method: 'PATCH',
      body: {
        approvalNote: input.approvalNote,
      },
    },
  )
}
