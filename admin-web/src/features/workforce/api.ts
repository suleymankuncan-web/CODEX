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

export type SellerCodeReference = {
  storeType: 'franchise'
  prefix: 'FM'
  lastSellerCode: string | null
  nextSellerCodePreview: string | null
}

export type SellerCodeRequest = {
  requestId: string
  companyId: string
  regionId: string
  storeId: string
  storeCode: string
  storeName: string
  storeType: string
  requestType: string
  status: string
  firstName: string
  lastName: string
  nationalIdLast4: string
  phoneNumber: string
  hireDate: string
  requestedPositionId: string
  positionCode: string
  positionName: string
  employmentType: string
  requestedSellerCode: string | null
  approvedSellerCode: string | null
  lastReferenceSellerCode: string | null
  submittedByUserId: string
  reviewedByUserId: string | null
  reviewedAt: string | null
  reviewNote: string | null
  employeeId: string | null
  createdAt: string
  updatedAt: string
}

export type SellerEmploymentType = 'full_time' | 'part_time' | 'temporary'

export type PositionOption = {
  positionId: string
  positionCode: string
  positionName: string
  jobFamily: string | null
  isManagerial: boolean
}

export type StoreEmployee = {
  employeeId: string
  displayName: string
  externalEmployeeRef: string | null
  storeId: string
  positionId: string
  positionCode: string
  positionName: string
  assignmentStartDate: string
  employmentStatus: string
}

export type OffboardingRequest = {
  requestId: string
  companyId: string
  regionId: string
  storeId: string
  storeCode: string
  storeName: string
  employeeId: string
  displayName: string
  externalEmployeeRef: string | null
  positionCode: string | null
  positionName: string | null
  status: string
  terminationDate: string
  terminationReason: string
  requestReason: string | null
  submittedByUserId: string
  reviewedByUserId: string | null
  reviewedAt: string | null
  reviewNote: string | null
  createdAt: string
  updatedAt: string
}

export async function getSellerCodeReference() {
  return fetchJson<SellerCodeReference>('/workforce/seller-code-reference?storeType=franchise')
}

export async function getSellerCodeRequests(input?: { status?: string }) {
  const params = new URLSearchParams()
  if (input?.status) {
    params.set('status', input.status)
  }

  const query = params.toString()
  return fetchJson<ListResponse<SellerCodeRequest>>(
    `/workforce/seller-code-requests${query ? `?${query}` : ''}`,
  )
}

export async function approveSellerCodeRequest(input: {
  requestId: string
  sellerCode: string
  reviewNote?: string
}) {
  return sendJson<CommandResponse<{ request: SellerCodeRequest }>>(
    `/workforce/seller-code-requests/${input.requestId}/approve`,
    {
      method: 'PATCH',
      body: {
        sellerCode: input.sellerCode,
        reviewNote: input.reviewNote,
      },
    },
  )
}

export async function rejectSellerCodeRequest(input: {
  requestId: string
  reviewNote: string
}) {
  return sendJson<CommandResponse<{ request: SellerCodeRequest }>>(
    `/workforce/seller-code-requests/${input.requestId}/reject`,
    {
      method: 'PATCH',
      body: {
        reviewNote: input.reviewNote,
      },
    },
  )
}

export async function resubmitSellerCodeRequest(input: {
  requestId: string
  firstName: string
  lastName: string
  nationalId: string
  phoneNumber: string
  hireDate: string
  requestedPositionId: string
  employmentType: SellerEmploymentType
  requestReason?: string
}) {
  return sendJson<CommandResponse<{ request: SellerCodeRequest }>>(
    `/workforce/seller-code-requests/${input.requestId}/resubmit`,
    {
      method: 'PATCH',
      body: {
        firstName: input.firstName,
        lastName: input.lastName,
        nationalId: input.nationalId,
        phoneNumber: input.phoneNumber,
        hireDate: input.hireDate,
        requestedPositionId: input.requestedPositionId,
        employmentType: input.employmentType,
        requestReason: input.requestReason,
      },
    },
  )
}

export async function getPositionOptions(storeId: string) {
  const params = new URLSearchParams({ storeId })
  return fetchJson<ListResponse<PositionOption>>(
    `/workforce/position-options?${params.toString()}`,
  )
}

export async function getStoreEmployees(storeId: string) {
  const params = new URLSearchParams({ storeId })
  return fetchJson<ListResponse<StoreEmployee>>(`/workforce/store-employees?${params.toString()}`)
}

export async function getOffboardingRequests(input?: { status?: string }) {
  const params = new URLSearchParams()
  if (input?.status) {
    params.set('status', input.status)
  }

  const query = params.toString()
  return fetchJson<ListResponse<OffboardingRequest>>(
    `/workforce/offboarding-requests${query ? `?${query}` : ''}`,
  )
}

export async function createSellerCodeRequest(input: {
  storeId: string
  requestType: 'create_code'
  firstName: string
  lastName: string
  nationalId: string
  phoneNumber: string
  hireDate: string
  requestedPositionId: string
  employmentType: SellerEmploymentType
  requestReason?: string
}) {
  return sendJson<CommandResponse<{ request: SellerCodeRequest }>>(
    '/workforce/seller-code-requests',
    {
      method: 'POST',
      body: input,
    },
  )
}

export async function createOffboardingRequest(input: {
  storeId: string
  employeeId: string
  terminationDate: string
  terminationReason: string
  requestReason: string
}) {
  return sendJson<CommandResponse<{ request: OffboardingRequest }>>(
    '/workforce/offboarding-requests',
    {
      method: 'POST',
      body: input,
    },
  )
}

export async function approveOffboardingRequest(input: {
  requestId: string
  reviewNote?: string
}) {
  return sendJson<CommandResponse<{ request: OffboardingRequest }>>(
    `/workforce/offboarding-requests/${input.requestId}/approve`,
    {
      method: 'PATCH',
      body: {
        reviewNote: input.reviewNote,
      },
    },
  )
}

export async function rejectOffboardingRequest(input: {
  requestId: string
  reviewNote: string
}) {
  return sendJson<CommandResponse<{ request: OffboardingRequest }>>(
    `/workforce/offboarding-requests/${input.requestId}/reject`,
    {
      method: 'PATCH',
      body: {
        reviewNote: input.reviewNote,
      },
    },
  )
}

export async function resubmitOffboardingRequest(input: {
  requestId: string
  employeeId: string
  terminationDate: string
  terminationReason: string
  requestReason: string
}) {
  return sendJson<CommandResponse<{ request: OffboardingRequest }>>(
    `/workforce/offboarding-requests/${input.requestId}/resubmit`,
    {
      method: 'PATCH',
      body: {
        employeeId: input.employeeId,
        terminationDate: input.terminationDate,
        terminationReason: input.terminationReason,
        requestReason: input.requestReason,
      },
    },
  )
}
