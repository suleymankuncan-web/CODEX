import { sendJson } from '../../lib/api'
import { fetchOpenApiJson, type ApiGetResponse } from '../../lib/openapi-client'

type CommandResponse<T> = {
  command: {
    status: string
    message: string
  }
  data: T
}

export type SellerCodeReference = ApiGetResponse<'/api/workforce/seller-code-reference'>

export type SellerCodeRequests = ApiGetResponse<'/api/workforce/seller-code-requests'>
export type SellerCodeRequest = SellerCodeRequests['items'][number]

export type SellerEmploymentType = 'full_time' | 'part_time' | 'temporary'

export type PositionOptions = ApiGetResponse<'/api/workforce/position-options'>
export type PositionOption = PositionOptions['items'][number]

export type StoreEmployees = ApiGetResponse<'/api/workforce/store-employees'>
export type StoreEmployee = StoreEmployees['items'][number]

export type OffboardingRequests = ApiGetResponse<'/api/workforce/offboarding-requests'>
export type OffboardingRequest = OffboardingRequests['items'][number]

export type OffboardingAccessClosure = {
  userAccessClosed: boolean
  closedUserId: string | null
  closedRoleAssignments: number
  closedActionStoreAssignments: number
  revokedMobileSessions: number
}

export async function getSellerCodeReference() {
  return fetchOpenApiJson('/api/workforce/seller-code-reference', {
    query: new URLSearchParams({ storeType: 'franchise' }),
  })
}

export async function getSellerCodeRequests(input?: { status?: string }) {
  const params = new URLSearchParams()
  if (input?.status) {
    params.set('status', input.status)
  }

  return fetchOpenApiJson('/api/workforce/seller-code-requests', { query: params })
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
  return fetchOpenApiJson('/api/workforce/position-options', { query: params })
}

export async function getStoreEmployees(storeId: string) {
  const params = new URLSearchParams({ storeId })
  return fetchOpenApiJson('/api/workforce/store-employees', { query: params })
}

export async function getOffboardingRequests(input?: { status?: string }) {
  const params = new URLSearchParams()
  if (input?.status) {
    params.set('status', input.status)
  }

  return fetchOpenApiJson('/api/workforce/offboarding-requests', { query: params })
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
  return sendJson<
    CommandResponse<{ request: OffboardingRequest; accessClosure: OffboardingAccessClosure }>
  >(
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
