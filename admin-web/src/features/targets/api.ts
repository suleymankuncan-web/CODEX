import { fetchJson, sendJson } from '../../lib/api'

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

export type TargetDistributionAllocation = {
  assigneeLabel: string
  targetValue: number
  note?: string
}

export type TargetDistributionRequest = {
  requestId: string
  companyId: string
  regionId: string
  storeId: string
  storeName: string
  requestMonth: string
  targetLabel: string
  totalTargetValue: number
  allocationCount: number
  status: string
  requestReason: string | null
  allocations: TargetDistributionAllocation[]
  submittedByUserId: string
  approvedByUserId: string | null
  approvedAt: string | null
  approvalNote: string | null
  createdAt: string
  updatedAt: string
}

export type StoreTargetingPerson = {
  employeeId: string
  displayName: string
  externalEmployeeRef: string | null
  periodStart: string | null
  periodEnd: string | null
  netSalesValue: number | null
}

export async function getStoreTargetingPersonnel(storeId: string) {
  const params = new URLSearchParams({ storeId })
  return fetchJson<ListResponse<StoreTargetingPerson>>(
    `/target-distributions/store-personnel?${params.toString()}`,
  )
}

export async function getTargetDistributionRequests(input?: { status?: string }) {
  const params = new URLSearchParams()

  if (input?.status) {
    params.set('status', input.status)
  }

  const query = params.toString()
  return fetchJson<ListResponse<TargetDistributionRequest>>(
    `/target-distributions/requests${query ? `?${query}` : ''}`,
  )
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
