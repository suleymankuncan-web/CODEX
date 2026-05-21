import type {
  OffboardingRequests,
  SellerCodeRequests,
} from '../features/workforce/api'

export type WorkforcePressure = {
  offboardingCount: number
  sellerCodeCount: number
  total: number
}

export function summarizeWorkforcePressure(input: {
  offboardingRequests: OffboardingRequests | undefined
  sellerCodeRequests: SellerCodeRequests | undefined
}): WorkforcePressure {
  const offboardingCount = input.offboardingRequests?.meta.total ?? 0
  const sellerCodeCount = input.sellerCodeRequests?.meta.total ?? 0

  return {
    offboardingCount,
    sellerCodeCount,
    total: offboardingCount + sellerCodeCount,
  }
}
