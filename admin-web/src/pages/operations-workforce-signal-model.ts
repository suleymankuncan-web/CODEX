import type {
  OffboardingRequest,
  SellerCodeRequest,
} from '../features/workforce/api'

export type WorkforcePressure = {
  offboardingCount: number
  sellerCodeCount: number
  total: number
}

export function summarizeWorkforcePressure(input: {
  offboardingItems: OffboardingRequest[]
  sellerCodeItems: SellerCodeRequest[]
}): WorkforcePressure {
  return {
    offboardingCount: input.offboardingItems.length,
    sellerCodeCount: input.sellerCodeItems.length,
    total: input.offboardingItems.length + input.sellerCodeItems.length,
  }
}
