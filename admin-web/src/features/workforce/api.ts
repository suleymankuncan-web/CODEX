import { fetchJson, sendJson } from '../../lib/api'
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

type RawHeadcountGap = {
  store_id: string
  planned_headcount: string
  active_headcount: string
  headcount_gap: string
  planned_fte: string
  active_fte: string
  fte_gap: string
  shortage_started_on?: string | null
  shortage_days?: number | string | null
} | null

export type StoreHeadcountGap = {
  storeId: string
  plannedHeadcount: string
  activeHeadcount: string
  headcountGap: string
  plannedFte: string
  activeFte: string
  fteGap: string
  shortageStartedOn: string | null
  shortageDays: string | null
} | null

export type OrgStore = {
  store_id: string
  store_code: string
  store_name: string
  region_id: string
  company_id: string
  status: string
}

export type OrgStoresResponse = {
  items: OrgStore[]
  meta?: {
    total?: number
  }
}

export type OffboardingAccessClosure = {
  userAccessClosed: boolean
  closedUserId: string | null
  closedRoleAssignments: number
  closedActionStoreAssignments: number
  revokedMobileSessions: number
}

type WorkforceRequestListInput = {
  status?: string
  storeId?: string
  limit?: number
  offset?: number
}

export async function getSellerCodeReference() {
  return fetchOpenApiJson('/api/workforce/seller-code-reference', {
    query: new URLSearchParams({ storeType: 'franchise' }),
  })
}

export async function getSellerCodeRequests(input?: WorkforceRequestListInput) {
  const params = new URLSearchParams()
  if (input?.status) {
    params.set('status', input.status)
  }
  appendOptionalQueryParam(params, 'storeId', input?.storeId)
  appendOptionalQueryParam(params, 'limit', input?.limit)
  appendOptionalQueryParam(params, 'offset', input?.offset)

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

export async function getStoreHeadcountGap(input: {
  storeId: string
  periodStart: string
  periodEnd: string
}) {
  const params = new URLSearchParams({
    storeId: input.storeId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
  })
  const response = await fetchJson<RawHeadcountGap>(
    `/workforce/headcount-gap?${params.toString()}`,
  )
  if (!response) return null

  return {
    storeId: response.store_id,
    plannedHeadcount: response.planned_headcount,
    activeHeadcount: response.active_headcount,
    headcountGap: response.headcount_gap,
    plannedFte: response.planned_fte,
    activeFte: response.active_fte,
    fteGap: response.fte_gap,
    shortageStartedOn: response.shortage_started_on ?? null,
    shortageDays: response.shortage_days === null || response.shortage_days === undefined
      ? null
      : String(response.shortage_days),
  } satisfies NonNullable<StoreHeadcountGap>
}

export async function getOrgStores() {
  return fetchJson<OrgStoresResponse>('/org/stores')
}

export async function getOffboardingRequests(input?: WorkforceRequestListInput) {
  const params = new URLSearchParams()
  if (input?.status) {
    params.set('status', input.status)
  }
  appendOptionalQueryParam(params, 'storeId', input?.storeId)
  appendOptionalQueryParam(params, 'limit', input?.limit)
  appendOptionalQueryParam(params, 'offset', input?.offset)

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

function appendOptionalQueryParam(params: URLSearchParams, key: string, value: string | number | undefined) {
  if (value === undefined || value === null || value === '') {
    return
  }

  params.set(key, String(value))
}
